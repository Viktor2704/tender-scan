// AI Tender Analysis via Google Gemini (free tier)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ error: "GEMINI_API_KEY not configured", analysis: null });
  }

  var body;
  try {
    if (req.method === "POST") {
      body = req.body;
    } else {
      body = req.query;
    }
  } catch (e) {
    body = req.query;
  }

  var title = body.title || "";
  var platform = body.platform || "";
  var link = body.link || "";
  var company = body.company || "";
  var price = body.price || "";
  var region = body.region || "";

  if (!title) {
    return res.status(200).json({ error: "title is required", analysis: null });
  }

  var prompt = "Ты — эксперт-аналитик тендеров в сфере слаботочных систем, пожарной безопасности, СКУД, видеонаблюдения, СКС, АСУ ТП в России. " +
    "Проанализируй тендер и дай структурированный анализ.\n\n" +
    "ТЕНДЕР:\n" +
    "Название: " + title + "\n" +
    "Площадка: " + platform + "\n" +
    (company ? "Заказчик: " + company + "\n" : "") +
    (price ? "Цена: " + price + " ₽\n" : "") +
    (region ? "Регион: " + region + "\n" : "") +
    (link ? "Ссылка: " + link + "\n" : "") +
    "\n" +
    "Дай анализ СТРОГО в следующем формате (каждый раздел обязателен):\n\n" +
    "АДРЕС ОБЪЕКТА:\n[Если можно определить из названия — укажи. Если нет — напиши предполагаемый тип объекта и район Москвы]\n\n" +
    "ОБЪЁМ РАБОТ:\n[Подробно опиши предполагаемый объём: количество оборудования, метраж кабельных трасс, количество точек/датчиков/камер, этажность. Основывайся на названии тендера и типичных проектах такого масштаба]\n\n" +
    "УСЛОВИЯ ОПЛАТЫ:\n[Типичные условия для таких тендеров: аванс, сроки оплаты, поэтапность]\n\n" +
    "ЮРИДИЧЕСКИЕ РИСКИ:\n[Оцени риск: НИЗКИЙ/СРЕДНИЙ/ВЫСОКИЙ. Укажи: неустойка, гарантия, обеспечение заявки, обеспечение контракта. Основывайся на площадке и типе заказчика]\n\n" +
    "СРОК ВЫПОЛНЕНИЯ:\n[Реалистичный срок для такого объёма работ в календарных/рабочих днях]\n\n" +
    "ОЦЕНКА НМЦ:\n[Адекватна ли цена? Средняя рыночная стоимость таких работ. Рекомендация по снижению]\n\n" +
    "РЕКОМЕНДАЦИЯ:\n[Стоит ли участвовать? Ключевые риски и преимущества. Что проверить перед подачей]\n\n" +
    "Отвечай по-русски, кратко и по делу. Без вступлений.";

  try {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;
    var resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
        },
      }),
    });

    var data = await resp.json();

    if (!resp.ok) {
      return res.status(200).json({ error: "Gemini API error: " + (data.error?.message || resp.status), analysis: null });
    }

    var text = "";
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      text = data.candidates[0].content.parts.map(function(p) { return p.text || ""; }).join("");
    }

    if (!text) {
      return res.status(200).json({ error: "Empty response from Gemini", analysis: null });
    }

    return res.status(200).json({ analysis: text, error: null });
  } catch (err) {
    return res.status(200).json({ error: "Fetch error: " + err.message, analysis: null });
  }
}
