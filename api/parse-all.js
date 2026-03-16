import axios from "axios";

// Unified endpoint that calls all parsers
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const {
    keywords = "",
    region = "Москва",
    pages = "2",
    platforms = "bidzaar,b2b,fabrikant",
  } = req.query || {};

  const selectedPlatforms = platforms.split(",").map(p => p.trim()).filter(Boolean);
  const allResults = [];
  const allLogs = [];
  const errors = [];

  allLogs.push({ type: "info", msg: "Инициализация парсера тендеров..." });
  allLogs.push({ type: "info", msg: `Ключевые слова: ${keywords || "(все)"}` });
  allLogs.push({ type: "info", msg: `Регион: ${region}` });
  allLogs.push({ type: "info", msg: `Площадки: ${selectedPlatforms.join(", ")}` });

  // Determine base URL for internal API calls
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  // Parse all platforms in parallel
  const promises = selectedPlatforms.map(async (platform) => {
    const endpoint = `${baseUrl}/api/parse-${platform}`;
    try {
      const response = await axios.get(endpoint, {
        params: { keywords, region, pages },
        timeout: 30000,
      });
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      return {
        platform,
        results: [],
        total: 0,
        logs: [
          { type: "err", msg: `${platform}: не удалось подключиться — ${errorMsg}` },
        ],
      };
    }
  });

  const responses = await Promise.allSettled(promises);

  responses.forEach((response, i) => {
    const platform = selectedPlatforms[i];
    if (response.status === "fulfilled" && response.value) {
      const data = response.value;
      allResults.push(...(data.results || []));
      allLogs.push(...(data.logs || []));
    } else {
      const reason = response.reason?.message || "Неизвестная ошибка";
      allLogs.push({ type: "err", msg: `${platform}: критическая ошибка — ${reason}` });
      errors.push({ platform, error: reason });
    }
  });

  // Deduplicate by title
  const seen = new Set();
  const unique = allResults.filter(t => {
    const key = t.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dupeCount = allResults.length - unique.length;
  if (dupeCount > 0) {
    allLogs.push({ type: "info", msg: "Дедупликация..." });
    allLogs.push({ type: "warn", msg: `Удалено дублей: ${dupeCount}` });
  }

  // Format results with IDs
  const formatted = unique.map((t, i) => ({
    id: `parse-${Date.now()}-${i}`,
    number: t.number || `${t.platform.toUpperCase()}-${i}`,
    title: t.title,
    platform: t.platform,
    company: t.company || "—",
    region: t.region || region,
    price: t.price || 0,
    deadline: t.deadline || "",
    published: t.published || "",
    eval: null,
    status: "active",
    participants: 0,
    notes: t.notes || "",
    docs: t.docs || [],
    requiredDocs: [],
    link: t.link || "",
  }));

  allLogs.push({ type: "ok", msg: `Парсинг завершён. Найдено: ${formatted.length} тендеров` });

  return res.status(200).json({
    results: formatted,
    total: formatted.length,
    logs: allLogs,
    errors,
  });
}
