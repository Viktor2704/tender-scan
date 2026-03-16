// Zero external dependencies — uses only native fetch (Node 18+)

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchPage(url, opts = {}) {
  const headers = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
    ...opts.headers,
  };
  const resp = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeout || 10000),
  });
  const text = await resp.text();
  const setCookies = resp.headers.getSetCookie?.() || [];
  const cookies = setCookies.map(c => c.split(";")[0]).join("; ");
  return { text, cookies, status: resp.status, ok: resp.ok };
}

// Extract <a href="...">text</a> from HTML
function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (href && text && text.length >= 5 && text.length <= 500) {
      links.push({ href: href.startsWith("http") ? href : `${baseUrl}${href}`, text });
    }
  }
  return links;
}

// ==================== BIDZAAR ====================
async function parseBidzaar(pages, logs) {
  const results = [];
  const BZ = "https://bidzaar.com";
  const ALLOWED = ["/process/", "/tender", "/request", "/event", "/lot", "/purchase"];
  const BLOCKED = ["logout", "login", "register", "mailto:", "/requests/applications", "/requests/public/buy", "/requests/public/sell"];
  const pageCount = Math.min(parseInt(pages) || 1, 3);
  let cookie = "";

  const login = process.env.BIDZAAR_LOGIN;
  const password = process.env.BIDZAAR_PASSWORD;
  const token = process.env.BIDZAAR_TOKEN || "";

  if (!token && login && password) {
    logs.push({ type: "info", msg: "Bidzaar: авторизация..." });
    try {
      const pg = await fetchPage(`${BZ}/home`);
      cookie = pg.cookies;
      const csrfMatch = pg.text.match(/csrf-token["']\s+content=["']([^"']+)/) || pg.text.match(/_token["']\s+value=["']([^"']+)/);
      const csrf = csrfMatch ? csrfMatch[1] : "";
      const auth = await fetchPage(`${BZ}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf, Cookie: cookie },
        body: JSON.stringify({ login, password }),
      });
      if (auth.cookies) cookie = auth.cookies;
      logs.push({ type: "ok", msg: `Bidzaar: авторизация — HTTP ${auth.status}` });
    } catch (e) {
      logs.push({ type: "warn", msg: `Bidzaar: авторизация — ${e.message}` });
    }
  }

  for (let page = 1; page <= pageCount; page++) {
    try {
      const hdrs = {};
      if (cookie) hdrs.Cookie = cookie;
      if (token) hdrs.Authorization = `Bearer ${token}`;
      const resp = await fetchPage(`${BZ}/requests/public/buy?page=${page}`, { headers: hdrs });
      const links = extractLinks(resp.text, BZ);
      let count = 0;
      for (const { href, text } of links) {
        if (BLOCKED.some(b => href.includes(b))) continue;
        if (!ALLOWED.some(a => href.includes(a))) continue;
        if (text.length < 10) continue;
        const idMatch = href.match(/\/(\d+)/);
        results.push({ platform: "bidzaar", title: text.substring(0, 300), number: idMatch ? `BZ-${idMatch[1]}` : "", company: "—", price: 0, deadline: "", published: "", region: "", link: href, docs: [] });
        count++;
      }
      logs.push({ type: "ok", msg: `Bidzaar: стр. ${page} — ${count} тендеров` });
    } catch (e) {
      logs.push({ type: "err", msg: `Bidzaar: стр. ${page} — ${e.message}` });
    }
  }

  const seen = new Set();
  return results.filter(r => { const k = r.link; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ==================== B2B-CENTER ====================
async function parseB2B(logs) {
  const results = [];
  const B2B = "https://www.b2b-center.ru";
  const URLS = [`${B2B}/search-tender/regions-moskva/`, `${B2B}/search-tender/regions-moskovskaia-oblast/`];
  const ALLOWED = ["/market/", "/purchase/", "/tender/", "/lot/"];
  let cookie = "";

  const login = process.env.B2B_LOGIN;
  const password = process.env.B2B_PASSWORD;

  if (login && password) {
    logs.push({ type: "info", msg: "B2B-Center: авторизация..." });
    try {
      const pg = await fetchPage(`${B2B}/personal/`);
      cookie = pg.cookies;
      const csrfMatch = pg.text.match(/_token["']\s+value=["']([^"']+)/);
      const csrf = csrfMatch ? csrfMatch[1] : "";
      const auth = await fetchPage(`${B2B}/personal/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
        body: `login=${encodeURIComponent(login)}&password=${encodeURIComponent(password)}&_token=${encodeURIComponent(csrf)}`,
      });
      if (auth.cookies) cookie = auth.cookies;
      logs.push({ type: "ok", msg: `B2B-Center: авторизация — HTTP ${auth.status}` });
    } catch (e) {
      logs.push({ type: "warn", msg: `B2B-Center: авторизация — ${e.message}` });
    }
  }

  for (const url of URLS) {
    const label = url.includes("moskovskaia") ? "МО" : "Москва";
    try {
      const hdrs = {};
      if (cookie) hdrs.Cookie = cookie;
      const resp = await fetchPage(url, { headers: hdrs });
      const links = extractLinks(resp.text, B2B);
      let count = 0;
      for (const { href, text } of links) {
        if (!ALLOWED.some(a => href.includes(a))) continue;
        const m = href.match(/tender-(\d+)/) || href.match(/id=(\d+)/);
        if (!m) continue;
        results.push({ platform: "b2b", title: text.substring(0, 300), number: `B2B-${m[1]}`, company: "—", price: 0, deadline: "", published: "", region: "Москва", link: href, docs: [] });
        count++;
      }
      logs.push({ type: "ok", msg: `B2B: ${label} — ${count} тендеров` });
    } catch (e) {
      logs.push({ type: "err", msg: `B2B: ${label} — ${e.message}` });
    }
  }

  const seen = new Set();
  return results.filter(r => { if (seen.has(r.number)) return false; seen.add(r.number); return true; });
}

// ==================== FABRIKANT ====================
async function parseFabrikant(keywords, pages, logs) {
  const results = [];
  const FB = "https://www.fabrikant.ru";
  const ALLOWED = ["/trade/", "/trades/", "/purchase/", "/procedure/"];
  const pageCount = Math.min(parseInt(pages) || 1, 2);
  let cookie = "";

  const login = process.env.FABRIKANT_LOGIN;
  const password = process.env.FABRIKANT_PASSWORD;

  if (login && password) {
    logs.push({ type: "info", msg: "Фабрикант: авторизация..." });
    try {
      const auth = await fetchPage(`${FB}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, role: 1 }),
      });
      if (auth.cookies) cookie = auth.cookies;
      logs.push({ type: "ok", msg: `Фабрикант: авторизация — HTTP ${auth.status}` });
    } catch (e) {
      logs.push({ type: "warn", msg: `Фабрикант: авторизация — ${e.message}` });
    }
  }

  const kwList = (keywords || "").split(",").map(k => k.trim()).filter(Boolean).slice(0, 3);
  if (!kwList.length) kwList.push("");

  for (const kw of kwList) {
    for (let page = 1; page <= pageCount; page++) {
      try {
        const params = new URLSearchParams();
        params.append("customer_region_ids[]", "xVpBKhHQGM_wSt6xsRvDFg");
        params.append("customer_region_ids[]", "v5Vyhe3DF-8Z4oX6kQWKhA");
        params.append("page_number", String(page));
        params.append("section_ids[]", "8");
        params.append("section_ids[]", "2");
        params.append("statuses[]", "1");
        if (kw) params.append("query", kw);
        const url = `${FB}/procedure/search?${params}`;

        const hdrs = {};
        if (cookie) hdrs.Cookie = cookie;
        const resp = await fetchPage(url, { headers: hdrs });
        const links = extractLinks(resp.text, FB);
        let count = 0;
        for (const { href, text } of links) {
          if (!ALLOWED.some(a => href.includes(a))) continue;
          if (text.length < 10) continue;
          const idMatch = href.match(/\/(\d+)/);
          results.push({ platform: "fabrikant", title: text.substring(0, 300), number: idMatch ? `ФБ-${idMatch[1]}` : "", company: "—", price: 0, deadline: "", published: "", region: "Москва", link: href, docs: [] });
          count++;
        }
        logs.push({ type: "ok", msg: `Фабрикант: «${kw || "все"}» стр. ${page} — ${count}` });
      } catch (e) {
        logs.push({ type: "err", msg: `Фабрикант: «${kw || "все"}» — ${e.message}` });
      }
    }
  }

  const seen = new Set();
  return results.filter(r => { const k = r.link; if (seen.has(k)) return false; seen.add(k); return true; });
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

    logs.push({ type: "info", msg: `Парсинг: ${selected.join(", ")}` });

    const tasks = [];
    if (selected.includes("bidzaar")) tasks.push(parseBidzaar(pages, logs).catch(e => { logs.push({ type: "err", msg: `Bidzaar fatal: ${e.message}` }); return []; }));
    if (selected.includes("b2b")) tasks.push(parseB2B(logs).catch(e => { logs.push({ type: "err", msg: `B2B fatal: ${e.message}` }); return []; }));
    if (selected.includes("fabrikant")) tasks.push(parseFabrikant(keywords, pages, logs).catch(e => { logs.push({ type: "err", msg: `Фабрикант fatal: ${e.message}` }); return []; }));

    const batches = await Promise.all(tasks);
    const allResults = batches.flat();

    const seen = new Set();
    const unique = allResults.filter(t => {
      const key = (t.title || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });

    const formatted = unique.map((t, i) => ({
      id: `p-${Date.now()}-${i}`, number: t.number || `${(t.platform || "X").toUpperCase()}-${i}`,
      title: t.title, platform: t.platform, company: t.company || "—",
      region: t.region || "Москва", price: t.price || 0, deadline: t.deadline || "",
      published: t.published || "", eval: null, status: "active",
      participants: 0, notes: "", docs: t.docs || [], requiredDocs: [], link: t.link || "",
    }));

    logs.push({ type: "ok", msg: `Итого: ${formatted.length} тендеров` });
    return res.status(200).json({ results: formatted, total: formatted.length, logs });
  } catch (err) {
    return res.status(200).json({ results: [], total: 0, logs: [{ type: "err", msg: `Ошибка сервера: ${err.message}` }] });
  }
}
