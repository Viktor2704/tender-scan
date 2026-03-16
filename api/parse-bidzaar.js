import axios from "axios";
import * as cheerio from "cheerio";

// Bidzaar config from TZ
// Login: v.galkin@novinjstroi.ru (password in env)
// Login URL: https://bidzaar.com/home
// Search: https://bidzaar.com/requests/public/buy (public purchases)
// Max: 150 cards, 8 pages
const BASE_URL = "https://bidzaar.com";
const LOGIN_URL = `${BASE_URL}/home`;
const SEARCH_URL = `${BASE_URL}/requests/public/buy`;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
  "Connection": "keep-alive",
  "Referer": BASE_URL,
};

const ALLOWED_LINK_SUBSTRINGS = ["/process/", "/process/light/", "/tender", "/request", "/event", "/lot", "/purchase"];
const BLOCKED_LINK_SUBSTRINGS = [
  "logout", "login", "register", "mailto:",
  "/requests/applications", "/requests/public/buy", "/requests/public/sell",
  "/requests/public/registries", "/requests/external", "/companies/tendery/",
];
const DOC_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip"];

// Excluded regions per TZ
const EXCLUDED_REGIONS = ["воронеж", "краснодар", "кемерово", "оренбург", "симферополь", "вся территория рф", "россия", "несколько регионов", "по сети объектов"];

function isAllowedLink(href) {
  if (!href) return false;
  if (BLOCKED_LINK_SUBSTRINGS.some(b => href.includes(b))) return false;
  return ALLOWED_LINK_SUBSTRINGS.some(a => href.includes(a));
}

function isExcludedRegion(text) {
  const lower = (text || "").toLowerCase();
  return EXCLUDED_REGIONS.some(r => lower.includes(r));
}

async function loginBidzaar(login, password) {
  try {
    // Get login page first for CSRF/session
    const loginPage = await axios.get(LOGIN_URL, { headers: HEADERS, timeout: 10000 });
    const pageCookies = (loginPage.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");
    const $ = cheerio.load(loginPage.data);
    const csrfToken = $("meta[name='csrf-token']").attr("content") || $("input[name='_token']").val() || "";

    // Try API login
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      login, password,
    }, {
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
        Cookie: pageCookies,
      },
      timeout: 10000,
    });

    const token = response.data?.token || response.data?.access_token;
    const setCookies = (response.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");

    return { token, cookies: setCookies || pageCookies, error: null };
  } catch (err) {
    // Try form-based login
    try {
      const response = await axios.post(LOGIN_URL, new URLSearchParams({
        login, password,
      }).toString(), {
        headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
        maxRedirects: 5,
      });
      const setCookies = (response.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");
      return { token: null, cookies: setCookies, error: null };
    } catch (err2) {
      return { token: null, cookies: null, error: err2.message };
    }
  }
}

async function searchBidzaar(page, cookies, token) {
  const results = [];

  try {
    const url = `${SEARCH_URL}?page=${page}`;
    const headers = { ...HEADERS };
    if (cookies) headers.Cookie = cookies;
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await axios.get(url, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Parse tender/request cards
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (!isAllowedLink(href)) return;

      const title = $(el).text().trim();
      if (!title || title.length < 10 || title.length > 500) return;

      const idMatch = href.match(/\/(\d+)/) || href.match(/id[=/](\d+)/);
      const fullLink = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      results.push({
        platform: "bidzaar",
        title: title.substring(0, 300),
        number: idMatch ? `BZ-${idMatch[1]}` : "",
        company: "—",
        price: 0,
        deadline: "",
        published: "",
        region: "",
        link: fullLink,
        docs: [],
      });
    });

    // Deduplicate
    const seen = new Set();
    return {
      results: results.filter(r => {
        const key = r.link || r.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
      error: null,
    };
  } catch (err) {
    return { results: [], error: err.message, status: err.response?.status };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keywords = "", pages = 1 } = req.query || {};
  const login = process.env.BIDZAAR_LOGIN;
  const password = process.env.BIDZAAR_PASSWORD;

  const allResults = [];
  const logs = [];
  const pageCount = Math.min(parseInt(pages) || 1, 8);
  let cookies = null;
  let token = process.env.BIDZAAR_TOKEN || null;

  logs.push({ type: "info", msg: "Bidzaar: подключение..." });

  // Login
  if (!token && login && password) {
    logs.push({ type: "info", msg: "Bidzaar: авторизация..." });
    const auth = await loginBidzaar(login, password);
    if (auth.error) {
      logs.push({ type: "warn", msg: `Bidzaar: ошибка авторизации — ${auth.error}` });
    } else {
      cookies = auth.cookies;
      token = auth.token;
      logs.push({ type: "ok", msg: "Bidzaar: авторизация успешна" });
    }
  }

  for (let page = 1; page <= pageCount; page++) {
    logs.push({ type: "info", msg: `Bidzaar: загрузка страницы ${page}...` });
    const { results, error, status } = await searchBidzaar(page, cookies, token);

    if (error) {
      logs.push({ type: "err", msg: `Bidzaar: ошибка стр. ${page} — ${error} (HTTP ${status || "?"})` });
      if (status === 403 || status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        const retry = await searchBidzaar(page, cookies, token);
        if (!retry.error) {
          allResults.push(...retry.results);
          logs.push({ type: "ok", msg: `Bidzaar: повтор стр. ${page} — ${retry.results.length} тендеров` });
        }
      }
    } else {
      allResults.push(...results);
      logs.push({ type: "ok", msg: `Bidzaar: стр. ${page} — ${results.length} тендеров` });
    }
  }

  // Filter out excluded regions
  const filtered = allResults.filter(r => !isExcludedRegion(r.region));
  const excludedCount = allResults.length - filtered.length;
  if (excludedCount > 0) {
    logs.push({ type: "warn", msg: `Bidzaar: отфильтровано не-Москва: ${excludedCount}` });
  }

  // Deduplicate
  const seen = new Set();
  const unique = filtered.filter(r => {
    const key = r.link || r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  logs.push({ type: "ok", msg: `Bidzaar: итого ${unique.length} уникальных тендеров` });

  return res.status(200).json({ platform: "bidzaar", results: unique, total: unique.length, logs });
}
