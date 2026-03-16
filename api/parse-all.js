import axios from "axios";

// ==================== SHARED ====================
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
};

// Extract all <a href="...">text</a> from HTML without cheerio
function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const rawText = match[2].replace(/<[^>]*>/g, "").trim();
    if (href && rawText) {
      const fullHref = href.startsWith("http") ? href : `${baseUrl}${href}`;
      links.push({ href: fullHref, text: rawText });
    }
  }
  return links;
}

// ==================== BIDZAAR ====================
const BZ_BASE = "https://bidzaar.com";
const BZ_SEARCH = `${BZ_BASE}/requests/public/buy`;
const BZ_ALLOWED = ["/process/", "/tender", "/request", "/event", "/lot", "/purchase"];
const BZ_BLOCKED = ["logout", "login", "register", "mailto:", "/requests/applications", "/requests/public/buy", "/requests/public/sell", "/requests/public/registries", "/requests/external"];

async function parseBidzaar(pages, logs) {
  const results = [];
  const pageCount = Math.min(parseInt(pages) || 1, 3);
  let cookies = null;
  let token = process.env.BIDZAAR_TOKEN || null;
  const login = process.env.BIDZAAR_LOGIN;
  const password = process.env.BIDZAAR_PASSWORD;

  // Login
  if (!token && login && password) {
    logs.push({ type: "info", msg: "Bidzaar: авторизация..." });
    try {
      const loginPage = await axios.get(`${BZ_BASE}/home`, { headers: { ...HEADERS, Referer: BZ_BASE }, timeout: 8000 });
      const pageCookies = (loginPage.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");

      // Extract CSRF token with regex
      const csrfMatch = loginPage.data.match(/meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/) ||
                         loginPage.data.match(/name=["']_token["']\s+value=["']([^"']+)["']/);
      const csrf = csrfMatch ? csrfMatch[1] : "";

      const resp = await axios.post(`${BZ_BASE}/api/auth/login`, { login, password }, {
        headers: { ...HEADERS, "Content-Type": "application/json", "X-CSRF-TOKEN": csrf, Cookie: pageCookies, Referer: BZ_BASE },
        timeout: 8000,
      });
      token = resp.data?.token || resp.data?.access_token;
      cookies = (resp.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ") || pageCookies;
      logs.push({ type: "ok", msg: "Bidzaar: авторизация успешна" });
    } catch (e) {
      logs.push({ type: "warn", msg: `Bidzaar: авторизация не удалась — ${e.message}` });
    }
  }

  for (let page = 1; page <= pageCount; page++) {
    try {
      const hdrs = { ...HEADERS, Referer: BZ_BASE };
      if (cookies) hdrs.Cookie = cookies;
      if (token) hdrs.Authorization = `Bearer ${token}`;

      const resp = await axios.get(`${BZ_SEARCH}?page=${page}`, { headers: hdrs, timeout: 10000, maxRedirects: 5 });
      const links = extractLinks(resp.data, BZ_BASE);

      for (const { href, text } of links) {
        if (BZ_BLOCKED.some(b => href.includes(b))) continue;
        if (!BZ_ALLOWED.some(a => href.includes(a))) continue;
        if (text.length < 10 || text.length > 500) continue;

        const idMatch = href.match(/\/(\d+)/) || href.match(/id[=/](\d+)/);
        results.push({
          platform: "bidzaar", title: text.substring(0, 300),
          number: idMatch ? `BZ-${idMatch[1]}` : "", company: "—",
          price: 0, deadline: "", published: "", region: "",
          link: href, docs: [],
        });
      }
      logs.push({ type: "ok", msg: `Bidzaar: стр. ${page} — ${links.length} ссылок` });
    } catch (e) {
      logs.push({ type: "err", msg: `Bidzaar: стр. ${page} — ${e.message}` });
    }
  }

  const seen = new Set();
  return results.filter(r => {
    const key = r.link || r.title;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// ==================== B2B-CENTER ====================
const B2B_BASE = "https://www.b2b-center.ru";
const B2B_URLS = [
  `${B2B_BASE}/search-tender/regions-moskva/#search-result`,
  `${B2B_BASE}/search-tender/regions-moskovskaia-oblast/#search-result`,
];
const B2B_ALLOWED = ["/market/", "/purchase/", "/tender/", "/lot/"];
const B2B_BLOCKED = ["logout", "login", "register", "mailto:", "/help/"];

async function parseB2B(logs) {
  const results = [];
  let cookies = null;
  const login = process.env.B2B_LOGIN;
  const password = process.env.B2B_PASSWORD;

  if (login && password) {
    logs.push({ type: "info", msg: "B2B-Center: авторизация..." });
    try {
      const loginPage = await axios.get(`${B2B_BASE}/personal/`, { headers: { ...HEADERS, Referer: B2B_BASE }, timeout: 8000, maxRedirects: 5 });
      const csrfMatch = loginPage.data.match(/name=["']_token["']\s+value=["']([^"']+)["']/) ||
                         loginPage.data.match(/meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/);
      const csrf = csrfMatch ? csrfMatch[1] : "";
      const pageCookies = (loginPage.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");

      const resp = await axios.post(`${B2B_BASE}/personal/`, new URLSearchParams({ login, password, _token: csrf }).toString(), {
        headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded", Referer: B2B_BASE, Cookie: pageCookies },
        timeout: 8000, maxRedirects: 5,
      });
      const sc = resp.headers["set-cookie"] || [];
      cookies = sc.length ? sc.map(c => c.split(";")[0]).join("; ") : pageCookies;
      logs.push({ type: "ok", msg: "B2B-Center: авторизация успешна" });
    } catch (e) {
      logs.push({ type: "warn", msg: `B2B-Center: авторизация не удалась — ${e.message}` });
    }
  }

  for (const url of B2B_URLS) {
    const label = url.includes("moskovskaia") ? "МО" : "Москва";
    try {
      const hdrs = { ...HEADERS, Referer: B2B_BASE };
      if (cookies) hdrs.Cookie = cookies;
      const resp = await axios.get(url, { headers: hdrs, timeout: 10000, maxRedirects: 5 });
      const links = extractLinks(resp.data, B2B_BASE);

      for (const { href, text } of links) {
        if (B2B_BLOCKED.some(b => href.includes(b))) continue;
        if (!B2B_ALLOWED.some(a => href.includes(a))) continue;
        const tenderMatch = href.match(/tender-(\d+)/) || href.match(/id=(\d+)/);
        if (!tenderMatch) continue;
        if (text.length < 5 || text.length > 500) continue;

        results.push({
          platform: "b2b", title: text.substring(0, 300),
          number: `B2B-${tenderMatch[1]}`, company: "—",
          price: 0, deadline: "", published: "", region: "Москва",
          link: href, docs: [],
        });
      }
      logs.push({ type: "ok", msg: `B2B-Center: ${label} — ${links.length} ссылок` });
    } catch (e) {
      logs.push({ type: "err", msg: `B2B-Center: ${label} — ${e.message}` });
    }
  }

  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.number)) return false;
    seen.add(r.number); return true;
  });
}

// ==================== FABRIKANT ====================
const FB_BASE = "https://www.fabrikant.ru";
const FB_ALLOWED = ["/trade/", "/trades/", "/purchase/", "/procedure/"];
const FB_BLOCKED = ["logout", "login", "register", "mailto:"];

function fbSearchUrl(query, page) {
  const params = new URLSearchParams();
  params.append("customer_region_ids[]", "xVpBKhHQGM_wSt6xsRvDFg");
  params.append("customer_region_ids[]", "v5Vyhe3DF-8Z4oX6kQWKhA");
  params.append("page_number", String(page));
  params.append("section_ids[]", "8");
  params.append("section_ids[]", "2");
  params.append("statuses[]", "1");
  if (query) params.append("query", query);
  return `${FB_BASE}/procedure/search?${params.toString()}`;
}

async function parseFabrikant(keywords, pages, logs) {
  const results = [];
  let cookies = null;
  const login = process.env.FABRIKANT_LOGIN;
  const password = process.env.FABRIKANT_PASSWORD;
  const pageCount = Math.min(parseInt(pages) || 1, 2);

  if (login && password) {
    logs.push({ type: "info", msg: "Фабрикант: авторизация..." });
    try {
      const resp = await axios.post(`${FB_BASE}/api/auth/login`, { login, password, role: 1 }, {
        headers: { ...HEADERS, "Content-Type": "application/json", Referer: FB_BASE },
        timeout: 8000,
      });
      const sc = resp.headers["set-cookie"] || [];
      cookies = sc.map(c => c.split(";")[0]).join("; ");
      logs.push({ type: "ok", msg: "Фабрикант: авторизация успешна" });
    } catch (e) {
      logs.push({ type: "warn", msg: `Фабрикант: авторизация не удалась — ${e.message}` });
    }
  }

  const kwList = (keywords || "").split(",").map(k => k.trim()).filter(Boolean).slice(0, 3);
  if (kwList.length === 0) kwList.push("");

  for (const kw of kwList) {
    for (let page = 1; page <= pageCount; page++) {
      try {
        const hdrs = { ...HEADERS, Referer: FB_BASE };
        if (cookies) hdrs.Cookie = cookies;
        const resp = await axios.get(fbSearchUrl(kw, page), { headers: hdrs, timeout: 10000, maxRedirects: 5 });
        const links = extractLinks(resp.data, FB_BASE);

        for (const { href, text } of links) {
          if (FB_BLOCKED.some(b => href.includes(b))) continue;
          if (!FB_ALLOWED.some(a => href.includes(a))) continue;
          if (text.length < 10 || text.length > 500) continue;
          const idMatch = href.match(/id[=/](\d+)/) || href.match(/\/(\d+)/);
          results.push({
            platform: "fabrikant", title: text.substring(0, 300),
            number: idMatch ? `ФБ-${idMatch[1]}` : "", company: "—",
            price: 0, deadline: "", published: "", region: "Москва",
            link: href, docs: [],
          });
        }
        logs.push({ type: "ok", msg: `Фабрикант: «${kw || "все"}» стр. ${page} — ${links.length} ссылок` });
      } catch (e) {
        logs.push({ type: "err", msg: `Фабрикант: «${kw || "все"}» — ${e.message}` });
      }
    }
  }

  const seen = new Set();
  return results.filter(r => {
    const key = r.link || r.title;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// ==================== HANDLER ====================
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { keywords = "", pages = "1", platforms = "bidzaar,b2b,fabrikant" } = req.query || {};
    const selected = platforms.split(",").map(p => p.trim()).filter(Boolean);
    const logs = [];
    let allResults = [];

    logs.push({ type: "info", msg: `Парсинг: ${selected.join(", ")}` });

    // Run all parsers in parallel
    const tasks = [];
    if (selected.includes("bidzaar")) tasks.push(parseBidzaar(pages, logs).catch(e => { logs.push({ type: "err", msg: `Bidzaar: ${e.message}` }); return []; }));
    if (selected.includes("b2b")) tasks.push(parseB2B(logs).catch(e => { logs.push({ type: "err", msg: `B2B: ${e.message}` }); return []; }));
    if (selected.includes("fabrikant")) tasks.push(parseFabrikant(keywords, pages, logs).catch(e => { logs.push({ type: "err", msg: `Фабрикант: ${e.message}` }); return []; }));

    const results = await Promise.all(tasks);
    results.forEach(r => allResults.push(...r));

    // Deduplicate
    const seen = new Set();
    const unique = allResults.filter(t => {
      const key = (t.title || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Format
    const formatted = unique.map((t, i) => ({
      id: `parse-${Date.now()}-${i}`,
      number: t.number || `${(t.platform || "X").toUpperCase()}-${i}`,
      title: t.title, platform: t.platform,
      company: t.company || "—", region: t.region || "Москва",
      price: t.price || 0, deadline: t.deadline || "",
      published: t.published || "", eval: null, status: "active",
      participants: 0, notes: "", docs: t.docs || [],
      requiredDocs: [], link: t.link || "",
    }));

    logs.push({ type: "ok", msg: `Итого: ${formatted.length} тендеров` });

    return res.status(200).json({ results: formatted, total: formatted.length, logs });
  } catch (err) {
    return res.status(200).json({
      results: [], total: 0,
      logs: [{ type: "err", msg: `Критическая ошибка: ${err.message}` }],
    });
  }
}
