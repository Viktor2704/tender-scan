const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchPage(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 10000);
  try {
    const resp = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
        ...(opts.headers || {}),
      },
      body: opts.body,
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await resp.text();
    // Extract cookies from set-cookie header
    const rawCookies = resp.headers.get("set-cookie") || "";
    const cookies = rawCookies.split(",").map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");
    return { text, cookies, status: resp.status, ok: resp.ok };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function extractLinks(html, baseUrl) {
  var links = [];
  var regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = regex.exec(html)) !== null) {
    var href = m[1];
    var text = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (href && text && text.length >= 5 && text.length <= 500) {
      links.push({ href: href.startsWith("http") ? href : baseUrl + href, text: text });
    }
  }
  return links;
}

// ==================== BIDZAAR ====================
async function parseBidzaar(pages, logs) {
  var results = [];
  var BZ = "https://bidzaar.com";
  var ALLOWED = ["/process/", "/tender", "/request", "/event", "/lot", "/purchase"];
  var BLOCKED = ["logout", "login", "register", "mailto:", "/requests/applications", "/requests/public/buy", "/requests/public/sell"];
  var pageCount = Math.min(parseInt(pages) || 1, 3);
  var cookie = "";
  var token = process.env.BIDZAAR_TOKEN || "";
  var login = process.env.BIDZAAR_LOGIN || "";
  var password = process.env.BIDZAAR_PASSWORD || "";

  if (!token && login && password) {
    logs.push({ type: "info", msg: "Bidzaar: авторизация..." });
    try {
      var pg = await fetchPage(BZ + "/home");
      cookie = pg.cookies;
      var csrfMatch = pg.text.match(/csrf-token["']\s+content=["']([^"']+)/) || pg.text.match(/_token["']\s+value=["']([^"']+)/);
      var csrf = csrfMatch ? csrfMatch[1] : "";
      var auth = await fetchPage(BZ + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf, "Cookie": cookie },
        body: JSON.stringify({ login: login, password: password }),
      });
      if (auth.cookies) cookie = auth.cookies;
      logs.push({ type: "ok", msg: "Bidzaar: авторизация — HTTP " + auth.status });
    } catch (e) {
      logs.push({ type: "warn", msg: "Bidzaar: авторизация — " + e.message });
    }
  }

  for (var page = 1; page <= pageCount; page++) {
    try {
      var hdrs = {};
      if (cookie) hdrs["Cookie"] = cookie;
      if (token) hdrs["Authorization"] = "Bearer " + token;
      var resp = await fetchPage(BZ + "/requests/public/buy?page=" + page, { headers: hdrs });
      var links = extractLinks(resp.text, BZ);
      var count = 0;
      for (var i = 0; i < links.length; i++) {
        var href = links[i].href;
        var text = links[i].text;
        if (BLOCKED.some(function(b) { return href.includes(b); })) continue;
        if (!ALLOWED.some(function(a) { return href.includes(a); })) continue;
        if (text.length < 10) continue;
        var idMatch = href.match(/\/(\d+)/);
        results.push({ platform: "bidzaar", title: text.substring(0, 300), number: idMatch ? "BZ-" + idMatch[1] : "", company: "—", price: 0, deadline: "", published: "", region: "", link: href, docs: [] });
        count++;
      }
      logs.push({ type: "ok", msg: "Bidzaar: стр. " + page + " — " + count + " тендеров" });
    } catch (e) {
      logs.push({ type: "err", msg: "Bidzaar: стр. " + page + " — " + e.message });
    }
  }

  var seen = new Set();
  return results.filter(function(r) { if (seen.has(r.link)) return false; seen.add(r.link); return true; });
}

// ==================== B2B-CENTER ====================
async function parseB2B(logs) {
  var results = [];
  var B2B = "https://www.b2b-center.ru";
  var URLS = [B2B + "/search-tender/regions-moskva/", B2B + "/search-tender/regions-moskovskaia-oblast/"];
  var ALLOWED = ["/market/", "/purchase/", "/tender/", "/lot/"];
  var cookie = "";
  var login = process.env.B2B_LOGIN || "";
  var password = process.env.B2B_PASSWORD || "";

  if (login && password) {
    logs.push({ type: "info", msg: "B2B-Center: авторизация..." });
    try {
      var pg = await fetchPage(B2B + "/personal/");
      cookie = pg.cookies;
      var csrfMatch = pg.text.match(/_token["']\s+value=["']([^"']+)/);
      var csrf = csrfMatch ? csrfMatch[1] : "";
      var auth = await fetchPage(B2B + "/personal/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie },
        body: "login=" + encodeURIComponent(login) + "&password=" + encodeURIComponent(password) + "&_token=" + encodeURIComponent(csrf),
      });
      if (auth.cookies) cookie = auth.cookies;
      logs.push({ type: "ok", msg: "B2B-Center: авторизация — HTTP " + auth.status });
    } catch (e) {
      logs.push({ type: "warn", msg: "B2B-Center: авторизация — " + e.message });
    }
  }

  for (var u = 0; u < URLS.length; u++) {
    var url = URLS[u];
    var label = url.includes("moskovskaia") ? "МО" : "Москва";
    try {
      var hdrs = {};
      if (cookie) hdrs["Cookie"] = cookie;
      var resp = await fetchPage(url, { headers: hdrs });
      var links = extractLinks(resp.text, B2B);
      var count = 0;
      for (var i = 0; i < links.length; i++) {
        var href = links[i].href;
        var text = links[i].text;
        if (!ALLOWED.some(function(a) { return href.includes(a); })) continue;
        var m = href.match(/tender-(\d+)/) || href.match(/id=(\d+)/);
        if (!m) continue;
        results.push({ platform: "b2b", title: text.substring(0, 300), number: "B2B-" + m[1], company: "—", price: 0, deadline: "", published: "", region: "Москва", link: href, docs: [] });
        count++;
      }
      logs.push({ type: "ok", msg: "B2B: " + label + " — " + count + " тендеров" });
    } catch (e) {
      logs.push({ type: "err", msg: "B2B: " + label + " — " + e.message });
    }
  }

  var seen = new Set();
  return results.filter(function(r) { if (seen.has(r.number)) return false; seen.add(r.number); return true; });
}

// ==================== FABRIKANT ====================
async function parseFabrikant(keywords, pages, logs) {
  var results = [];
  var FB = "https://www.fabrikant.ru";
  var ALLOWED = ["/trade/", "/trades/", "/purchase/", "/procedure/"];
  var pageCount = Math.min(parseInt(pages) || 1, 2);
  var cookie = "";
  var login = process.env.FABRIKANT_LOGIN || "";
  var password = process.env.FABRIKANT_PASSWORD || "";

  if (login && password) {
    logs.push({ type: "info", msg: "Фабрикант: авторизация..." });
    try {
      var auth = await fetchPage(FB + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login, password: password, role: 1 }),
      });
      if (auth.cookies) cookie = auth.cookies;
      logs.push({ type: "ok", msg: "Фабрикант: авторизация — HTTP " + auth.status });
    } catch (e) {
      logs.push({ type: "warn", msg: "Фабрикант: авторизация — " + e.message });
    }
  }

  var kwList = (keywords || "").split(",").map(function(k) { return k.trim(); }).filter(Boolean).slice(0, 3);
  if (!kwList.length) kwList.push("");

  for (var k = 0; k < kwList.length; k++) {
    var kw = kwList[k];
    for (var page = 1; page <= pageCount; page++) {
      try {
        var params = "customer_region_ids%5B%5D=xVpBKhHQGM_wSt6xsRvDFg&customer_region_ids%5B%5D=v5Vyhe3DF-8Z4oX6kQWKhA&page_number=" + page + "&section_ids%5B%5D=8&section_ids%5B%5D=2&statuses%5B%5D=1";
        if (kw) params += "&query=" + encodeURIComponent(kw);
        var url = FB + "/procedure/search?" + params;
        var hdrs = {};
        if (cookie) hdrs["Cookie"] = cookie;
        var resp = await fetchPage(url, { headers: hdrs });
        var links = extractLinks(resp.text, FB);
        var count = 0;
        for (var i = 0; i < links.length; i++) {
          var href = links[i].href;
          var text = links[i].text;
          if (!ALLOWED.some(function(a) { return href.includes(a); })) continue;
          if (text.length < 10) continue;
          var idMatch = href.match(/\/(\d+)/);
          results.push({ platform: "fabrikant", title: text.substring(0, 300), number: idMatch ? "ФБ-" + idMatch[1] : "", company: "—", price: 0, deadline: "", published: "", region: "Москва", link: href, docs: [] });
          count++;
        }
        logs.push({ type: "ok", msg: "Фабрикант: «" + (kw || "все") + "» стр. " + page + " — " + count });
      } catch (e) {
        logs.push({ type: "err", msg: "Фабрикант: «" + (kw || "все") + "» — " + e.message });
      }
    }
  }

  var seen = new Set();
  return results.filter(function(r) { if (seen.has(r.link)) return false; seen.add(r.link); return true; });
}

// ==================== HANDLER ====================
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  var logs = [];
  try {
    var query = req.query || {};
    var keywords = query.keywords || "";
    var pages = query.pages || "1";
    var platforms = (query.platforms || "bidzaar,b2b,fabrikant").split(",");

    logs.push({ type: "info", msg: "Старт парсинга: " + platforms.join(", ") });

    var tasks = [];
    if (platforms.includes("bidzaar")) tasks.push(parseBidzaar(pages, logs).catch(function(e) { logs.push({ type: "err", msg: "Bidzaar: " + e.message }); return []; }));
    if (platforms.includes("b2b")) tasks.push(parseB2B(logs).catch(function(e) { logs.push({ type: "err", msg: "B2B: " + e.message }); return []; }));
    if (platforms.includes("fabrikant")) tasks.push(parseFabrikant(keywords, pages, logs).catch(function(e) { logs.push({ type: "err", msg: "Фабрикант: " + e.message }); return []; }));

    var batches = await Promise.all(tasks);
    var allResults = [];
    for (var b = 0; b < batches.length; b++) {
      for (var r = 0; r < batches[b].length; r++) {
        allResults.push(batches[b][r]);
      }
    }

    var seen = new Set();
    var unique = allResults.filter(function(t) {
      var key = (t.title || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });

    var now = Date.now();
    var formatted = unique.map(function(t, i) {
      return {
        id: "p-" + now + "-" + i, number: t.number || (t.platform || "X").toUpperCase() + "-" + i,
        title: t.title, platform: t.platform, company: t.company || "—",
        region: t.region || "Москва", price: t.price || 0, deadline: t.deadline || "",
        published: t.published || "", eval: null, status: "active",
        participants: 0, notes: "", docs: t.docs || [], requiredDocs: [], link: t.link || "",
      };
    });

    logs.push({ type: "ok", msg: "Итого: " + formatted.length + " тендеров" });
    return res.status(200).json({ results: formatted, total: formatted.length, logs: logs });
  } catch (err) {
    logs.push({ type: "err", msg: "Критическая ошибка: " + err.message });
    return res.status(200).json({ results: [], total: 0, logs: logs });
  }
}
