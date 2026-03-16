import axios from "axios";
import * as cheerio from "cheerio";

const BASE_URL = "https://www.b2b-center.ru";
const LOGIN_URL = `${BASE_URL}/personal/`;
const SEARCH_MOSCOW = `${BASE_URL}/search-tender/regions-moskva/#search-result`;
const SEARCH_MO = `${BASE_URL}/search-tender/regions-moskovskaia-oblast/#search-result`;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
  "Connection": "keep-alive",
  "Referer": BASE_URL,
};

const ALLOWED_LINK_SUBSTRINGS = ["/market/", "/purchase/", "/tender/", "/lot/"];
const BLOCKED_LINK_SUBSTRINGS = ["logout", "login", "register", "mailto:", "/help/"];
const DOC_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip"];

function isAllowedLink(href) {
  if (!href) return false;
  if (BLOCKED_LINK_SUBSTRINGS.some(b => href.includes(b))) return false;
  return ALLOWED_LINK_SUBSTRINGS.some(a => href.includes(a));
}

async function loginB2B(login, password) {
  try {
    const session = axios.create({ headers: HEADERS, maxRedirects: 5, timeout: 10000 });
    const loginPage = await session.get(LOGIN_URL);
    const $ = cheerio.load(loginPage.data);
    const csrfToken = $("input[name='_token']").val() || $("meta[name='csrf-token']").attr("content") || "";

    const response = await session.post(LOGIN_URL, new URLSearchParams({
      login, password, _token: csrfToken,
    }).toString(), {
      headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    });

    const setCookies = response.headers["set-cookie"] || loginPage.headers["set-cookie"] || [];
    return { cookies: setCookies.map(c => c.split(";")[0]).join("; "), error: null };
  } catch (err) {
    return { cookies: null, error: err.message };
  }
}

async function searchB2BPage(url, cookies) {
  const results = [];
  try {
    const response = await axios.get(url, {
      headers: { ...HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (!isAllowedLink(href)) return;

      const tenderMatch = href.match(/tender-(\d+)/) || href.match(/id=(\d+)/);
      if (!tenderMatch) return;

      const title = $(el).text().trim();
      if (!title || title.length < 5 || title.length > 500) return;

      const fullLink = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      results.push({
        platform: "b2b",
        title: title.substring(0, 300),
        number: `B2B-${tenderMatch[1]}`,
        company: "—",
        price: 0,
        deadline: "",
        published: "",
        region: "Москва",
        link: fullLink,
        docs: [],
      });
    });

    const seen = new Set();
    return {
      results: results.filter(r => {
        if (seen.has(r.number)) return false;
        seen.add(r.number);
        return true;
      }),
      error: null,
    };
  } catch (err) {
    return { results: [], error: err.message, status: err.response?.status };
  }
}

// Core function — can be imported by parse-all
export async function parseB2B(keywords, pages) {
  const allResults = [];
  const logs = [];
  let cookies = null;
  const login = process.env.B2B_LOGIN;
  const password = process.env.B2B_PASSWORD;

  logs.push({ type: "info", msg: "B2B-Center: подключение..." });

  if (login && password) {
    logs.push({ type: "info", msg: "B2B-Center: авторизация..." });
    const auth = await loginB2B(login, password);
    if (auth.error) {
      logs.push({ type: "warn", msg: `B2B-Center: ошибка авторизации — ${auth.error}` });
    } else {
      cookies = auth.cookies;
      logs.push({ type: "ok", msg: "B2B-Center: авторизация успешна" });
    }
  }

  logs.push({ type: "info", msg: "B2B-Center: поиск Москва..." });
  const moscowResult = await searchB2BPage(SEARCH_MOSCOW, cookies);
  if (moscowResult.error) {
    logs.push({ type: "err", msg: `B2B-Center: ошибка Москва — ${moscowResult.error}` });
  } else {
    allResults.push(...moscowResult.results);
    logs.push({ type: "ok", msg: `B2B-Center: Москва — ${moscowResult.results.length} тендеров` });
  }

  logs.push({ type: "info", msg: "B2B-Center: поиск Московская область..." });
  const moResult = await searchB2BPage(SEARCH_MO, cookies);
  if (moResult.error) {
    logs.push({ type: "err", msg: `B2B-Center: ошибка МО — ${moResult.error}` });
  } else {
    allResults.push(...moResult.results);
    logs.push({ type: "ok", msg: `B2B-Center: МО — ${moResult.results.length} тендеров` });
  }

  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.number)) return false;
    seen.add(r.number);
    return true;
  });

  logs.push({ type: "ok", msg: `B2B-Center: итого ${unique.length} уникальных тендеров` });

  return { platform: "b2b", results: unique, total: unique.length, logs };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keywords = "", pages = 1 } = req.query || {};
  const result = await parseB2B(keywords, pages);
  return res.status(200).json(result);
}
