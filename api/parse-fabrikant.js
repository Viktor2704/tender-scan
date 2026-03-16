import axios from "axios";
import * as cheerio from "cheerio";

// Fabrikant config from TZ
// Login: v.galkin@novinjstroi.ru (password in env)
// Login URL: https://www.fabrikant.ru/auth?role=1&section=2
// Search with Moscow/MO filters baked into URL
const BASE_URL = "https://www.fabrikant.ru";
const LOGIN_URL = `${BASE_URL}/auth?role=1&section=2`;

// Pre-configured search URL with Moscow + MO regions, commercial, active status
function buildSearchUrl(query, page = 1) {
  const params = new URLSearchParams();
  params.append("customer_region_ids[]", "xVpBKhHQGM_wSt6xsRvDFg"); // Moscow
  params.append("customer_region_ids[]", "v5Vyhe3DF-8Z4oX6kQWKhA"); // Moscow Oblast
  params.append("page_number", String(page));
  params.append("section_ids[]", "8"); // Commercial
  params.append("section_ids[]", "2"); // Commercial
  params.append("statuses[]", "1"); // Active (accepting applications)
  if (query) params.append("query", query);
  return `${BASE_URL}/procedure/search?${params.toString()}`;
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
  "Connection": "keep-alive",
  "Referer": BASE_URL,
};

const ALLOWED_LINK_SUBSTRINGS = ["/trade/", "/trades/", "/purchase/", "/procedure/"];
const BLOCKED_LINK_SUBSTRINGS = ["logout", "login", "register", "mailto:"];
const DOC_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip"];

function isAllowedLink(href) {
  if (!href) return false;
  if (BLOCKED_LINK_SUBSTRINGS.some(b => href.includes(b))) return false;
  return ALLOWED_LINK_SUBSTRINGS.some(a => href.includes(a));
}

async function loginFabrikant(login, password, cookies) {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      login, password, role: 1,
    }, {
      headers: { ...HEADERS, "Content-Type": "application/json" },
      timeout: 10000,
      maxRedirects: 5,
    });
    const setCookies = response.headers["set-cookie"] || [];
    return { cookies: setCookies.map(c => c.split(";")[0]).join("; "), error: null };
  } catch (err) {
    return { cookies: null, error: err.message };
  }
}

async function parseFabrikant(query, page, cookies) {
  const results = [];
  const url = buildSearchUrl(query, page);

  try {
    const response = await axios.get(url, {
      headers: { ...HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Parse procedure/tender cards
    $("a, [class*='procedure'], [class*='trade'], [class*='tender'], [class*='lot'], tr").each((_, el) => {
      const $el = $(el);
      const href = $el.attr("href") || $el.find("a").first().attr("href") || "";

      if (!isAllowedLink(href)) return;

      const title = $el.text().trim() || $el.find("a").first().text().trim();
      if (!title || title.length < 10 || title.length > 500) return;

      // Extract documents
      const docs = [];
      $el.find("a").each((_, a) => {
        const docHref = $(a).attr("href") || "";
        if (DOC_EXTENSIONS.some(ext => docHref.toLowerCase().endsWith(ext))) {
          docs.push($(a).text().trim() || docHref.split("/").pop());
        }
      });

      const fullLink = href.startsWith("http") ? href : `${BASE_URL}${href}`;
      const idMatch = href.match(/id[=/](\d+)/) || href.match(/\/(\d+)/);

      results.push({
        platform: "fabrikant",
        title: title.substring(0, 300),
        number: idMatch ? `ФБ-${idMatch[1]}` : "",
        company: "—",
        price: 0,
        deadline: "",
        published: "",
        region: "Москва",
        link: fullLink,
        docs,
      });
    });

    // Deduplicate by link
    const seen = new Set();
    const unique = results.filter(r => {
      if (!r.link || seen.has(r.link)) return false;
      seen.add(r.link);
      return true;
    });

    return { results: unique, error: null };
  } catch (err) {
    return { results: [], error: err.message, status: err.response?.status };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keywords = "АПС", region = "Москва", pages = 1 } = req.query || {};
  const login = process.env.FABRIKANT_LOGIN;
  const password = process.env.FABRIKANT_PASSWORD;

  const allResults = [];
  const logs = [];
  const pageCount = Math.min(parseInt(pages) || 1, 8);
  let cookies = null;

  logs.push({ type: "info", msg: "Фабрикант: подключение..." });

  // Login if credentials available
  if (login && password) {
    logs.push({ type: "info", msg: "Фабрикант: авторизация..." });
    const auth = await loginFabrikant(login, password);
    if (auth.error) {
      logs.push({ type: "warn", msg: `Фабрикант: ошибка авторизации — ${auth.error}` });
    } else {
      cookies = auth.cookies;
      logs.push({ type: "ok", msg: "Фабрикант: авторизация успешна" });
    }
  }

  // Split keywords and search for each
  const keywordList = keywords.split(",").map(k => k.trim()).filter(Boolean).slice(0, 5);

  for (const kw of keywordList) {
    for (let page = 1; page <= pageCount; page++) {
      logs.push({ type: "info", msg: `Фабрикант: «${kw}» стр. ${page}...` });
      const { results, error, status } = await parseFabrikant(kw, page, cookies);

      if (error) {
        logs.push({ type: "err", msg: `Фабрикант: ошибка — ${error} (HTTP ${status || "?"})` });
        if (status === 403 || status === 429) {
          await new Promise(r => setTimeout(r, 2000));
          const retry = await parseFabrikant(kw, page, cookies);
          if (!retry.error) {
            allResults.push(...retry.results);
            logs.push({ type: "ok", msg: `Фабрикант: повтор — ${retry.results.length} тендеров` });
          }
        }
      } else {
        allResults.push(...results);
        logs.push({ type: "ok", msg: `Фабрикант: «${kw}» стр. ${page} — ${results.length} тендеров` });
      }
    }
  }

  // Deduplicate across keywords
  const seen = new Set();
  const unique = allResults.filter(r => {
    const key = r.link || r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  logs.push({ type: "ok", msg: `Фабрикант: итого ${unique.length} уникальных тендеров` });

  return res.status(200).json({ platform: "fabrikant", results: unique, total: unique.length, logs });
}
