import { parseBidzaar } from "./parse-bidzaar.js";
import { parseB2B } from "./parse-b2b.js";
import { parseFabrikant } from "./parse-fabrikant.js";

const PARSERS = {
  bidzaar: parseBidzaar,
  b2b: parseB2B,
  fabrikant: parseFabrikant,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const {
    keywords = "",
    pages = "2",
    platforms = "bidzaar,b2b,fabrikant",
  } = req.query || {};

  const selectedPlatforms = platforms.split(",").map(p => p.trim()).filter(p => PARSERS[p]);
  const allResults = [];
  const allLogs = [];

  allLogs.push({ type: "info", msg: "Инициализация парсера тендеров..." });
  allLogs.push({ type: "info", msg: `Ключевые слова: ${keywords || "(все)"}` });
  allLogs.push({ type: "info", msg: `Площадки: ${selectedPlatforms.join(", ")}` });

  // Run all parsers in parallel — direct function calls, no HTTP
  const promises = selectedPlatforms.map(async (platform) => {
    try {
      return await PARSERS[platform](keywords, pages);
    } catch (err) {
      return {
        platform,
        results: [],
        total: 0,
        logs: [{ type: "err", msg: `${platform}: критическая ошибка — ${err.message}` }],
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
      allLogs.push({ type: "err", msg: `${platform}: ${reason}` });
    }
  });

  // Deduplicate by title
  const seen = new Set();
  const unique = allResults.filter(t => {
    const key = (t.title || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dupeCount = allResults.length - unique.length;
  if (dupeCount > 0) {
    allLogs.push({ type: "warn", msg: `Удалено дублей: ${dupeCount}` });
  }

  // Format results with IDs
  const formatted = unique.map((t, i) => ({
    id: `parse-${Date.now()}-${i}`,
    number: t.number || `${(t.platform || "").toUpperCase()}-${i}`,
    title: t.title,
    platform: t.platform,
    company: t.company || "—",
    region: t.region || "Москва",
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
  });
}
