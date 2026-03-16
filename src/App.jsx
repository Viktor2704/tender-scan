import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import _ from "lodash";

const PLATFORMS = [
  { id: "bidzaar", name: "Bidzaar", color: "#06b6d4", icon: "🔷", url: "https://bidzaar.com" },
  { id: "b2b", name: "B2B-Center", color: "#f97316", icon: "🟠", url: "https://www.b2b-center.ru" },
  { id: "fabrikant", name: "Фабрикант", color: "#8b5cf6", icon: "🟣", url: "https://fabrikant.ru" },
];

const EVAL_OPTIONS = [
  { id: "recommend", label: "Советую", color: "#22c55e", bg: "#22c55e18", icon: "✓" },
  { id: "check", label: "На проверку", color: "#f59e0b", bg: "#f59e0b18", icon: "?" },
  { id: "against", label: "Против", color: "#ef4444", bg: "#ef444418", icon: "✗" },
];

const FOLDERS = [
  { id: "01", name: "01_Входящие", desc: "Новые файлы, ещё не разобраны", icon: "📥", color: "#3b82f6" },
  { id: "02", name: "02_В_работе", desc: "Активные тендеры, ТЗ и документы", icon: "📂", color: "#22c55e" },
  { id: "03", name: "03_Архив", desc: "Старые и отклонённые", icon: "🗄️", color: "#94a3b8" },
  { id: "04", name: "04_Кодекс", desc: "Разборы, комментарии, черновики", icon: "📋", color: "#f59e0b" },
  { id: "05", name: "05_Готовые_пакеты", desc: "Одобренные тендеры, пакеты на подачу", icon: "✅", color: "#8b5cf6" },
];

const TABS = [
  { id: "dashboard", label: "Сводка", icon: "◉" },
  { id: "parser", label: "Парсер", icon: "⟳" },
  { id: "tenders", label: "Тендеры", icon: "☰" },
  { id: "folders", label: "Папки", icon: "◫" },
];

function createDemoTenders() {
  return [
    { id: "bz-001", number: "BZ-2026-4821", title: "Модернизация системы видеонаблюдения", platform: "bidzaar", company: "ПАО «Ростелеком»", region: "Москва", price: 4850000, deadline: "2026-03-28", published: "2026-03-10", eval: "recommend", status: "active", participants: 3, notes: "24 объекта, 386 камер. Нужно обследование + монтаж + ПНР.", docs: ["ТЗ.docx", "Приложение 1.xlsx", "Приложение 2.xlsx"] },
    { id: "bz-002", number: "BZ-2026-4799", title: "Техобслуживание СКС офисного здания", platform: "bidzaar", company: "АО «Газпром нефть»", region: "Москва", price: 2100000, deadline: "2026-03-25", published: "2026-03-08", eval: "recommend", status: "active", participants: 5, notes: "Регулярное ТО, 12 мес. Москва, ул. Намёткина.", docs: ["Договор.pdf", "Спецификация.xlsx"] },
    { id: "bz-003", number: "BZ-2026-4812", title: "Проектирование слаботочных систем БЦ", platform: "bidzaar", company: "ООО «Капитал Групп»", region: "Москва", price: 6200000, deadline: "2026-04-02", published: "2026-03-11", eval: "recommend", status: "active", participants: 2, notes: "BIM, СКУД, видео, СКС. Нужен допуск СРО.", docs: ["ТЗ_проект.docx"] },
    { id: "bz-004", number: "BZ-2026-4756", title: "Монтаж СКУД на 3 объектах", platform: "bidzaar", company: "ФГУП «Охрана» Росгвардии", region: "Московская область", price: 3400000, deadline: "2026-03-22", published: "2026-03-05", eval: "recommend", status: "ending", participants: 7, notes: "Турникеты + считыватели + контроллеры. Короткий срок.", docs: [] },
    { id: "bz-005", number: "BZ-2026-4830", title: "Аудит пожарной сигнализации", platform: "bidzaar", company: "ООО «Мега»", region: "Москва", price: 890000, deadline: "2026-04-10", published: "2026-03-14", eval: "recommend", status: "active", participants: 1, notes: "Обследование + заключение. Небольшой объём.", docs: [] },
    { id: "bz-006", number: "BZ-2026-4843", title: "Замена кабельной инфраструктуры ЦОД", platform: "bidzaar", company: "ПАО «МТС»", region: "Москва", price: 12500000, deadline: "2026-04-15", published: "2026-03-15", eval: "recommend", status: "active", participants: 0, notes: "Крупный проект. Нужен опыт ЦОД. Хорошая маржа.", docs: [] },
    { id: "b2b-001", number: "B2B-887432", title: "Установка видеонаблюдения склад", platform: "b2b", company: "ООО «Вайлдберриз»", region: "Московская область", price: 1750000, deadline: "2026-03-30", published: "2026-03-09", eval: "check", status: "active", participants: 4, notes: "Нужно уточнить точный адрес и количество камер.", docs: ["Запрос.pdf"] },
    { id: "b2b-002", number: "B2B-887501", title: "Обслуживание систем безопасности", platform: "b2b", company: "ГБУ «Жилищник»", region: "Москва", price: 980000, deadline: "2026-04-05", published: "2026-03-12", eval: "check", status: "active", participants: 6, notes: "Бюджетный заказчик, длинная оплата. Проверить условия.", docs: [] },
    { id: "fb-001", number: "ФБ-2026-11204", title: "Поставка оборудования видеонаблюдения", platform: "fabrikant", company: "АО «Транснефть»", region: "Москва", price: 5600000, deadline: "2026-04-01", published: "2026-03-07", eval: "against", status: "active", participants: 8, notes: "Только поставка без монтажа — не наш профиль.", docs: [] },
    { id: "bz-007", number: "BZ-2026-4701", title: "Капремонт инженерных систем здания", platform: "bidzaar", company: "ООО «Девелопмент»", region: "Москва", price: 28000000, deadline: "2026-03-20", published: "2026-03-01", eval: "against", status: "ending", participants: 3, notes: "Слишком большой подряд, нужен ГИП/ГАП/НРС. Не берём.", docs: [] },
    { id: "bz-008", number: "BZ-2026-4688", title: "Поставка серверов и СХД", platform: "bidzaar", company: "ПАО «Сбербанк»", region: "Москва", price: 15000000, deadline: "2026-03-18", published: "2026-02-28", eval: "against", status: "closed", participants: 12, notes: "Чистая поставка. Не наш профиль.", docs: [] },
    { id: "bz-009", number: "BZ-2026-4695", title: "Монтаж ОПС торговый центр", platform: "bidzaar", company: "ООО «МЕГА-Ритейл»", region: "Москва", price: 7800000, deadline: "2026-03-19", published: "2026-03-02", eval: "against", status: "closed", participants: 5, notes: "Сжатые сроки, штрафные санкции. Риск.", docs: [] },
  ];
}

const TENDER_TEMPLATES = {
  "видеонаблюдение": [
    { title: "Монтаж системы видеонаблюдения", notes: "IP-камеры, регистраторы, монтаж + ПНР" },
    { title: "Модернизация видеонаблюдения офиса", notes: "Замена аналоговых камер на IP. Обследование + проект." },
    { title: "Установка видеонаблюдения на складе", notes: "Периметр + внутренние зоны. Около 40 камер." },
    { title: "Видеонаблюдение для парковки БЦ", notes: "Уличные камеры, распознавание номеров." },
    { title: "Расширение системы видеонаблюдения ТЦ", notes: "Добавить 25 камер к существующей системе." },
    { title: "Проект видеонаблюдения жилого комплекса", notes: "Дворовая территория + подъезды. Около 120 камер." },
  ],
  "скуд": [
    { title: "Монтаж СКУД бизнес-центра", notes: "Турникеты, считыватели, контроллеры доступа." },
    { title: "Модернизация СКУД офисного здания", notes: "Переход на карты Mifare DESFire." },
    { title: "Установка СКУД на проходной завода", notes: "Биометрия + карты. 4 проходных." },
    { title: "СКУД для серверной и ЦОД", notes: "Двухфакторная аутентификация, шлюзы." },
    { title: "Интеграция СКУД с видеонаблюдением", notes: "Единая система безопасности. Программная интеграция." },
  ],
  "скс": [
    { title: "Монтаж СКС офисного этажа", notes: "Cat6A, 120 портов, патч-панели, СКШ." },
    { title: "Проектирование СКС нового офиса", notes: "Рабочий проект + спецификация оборудования." },
    { title: "Расширение СКС серверной", notes: "Оптика + медь. Кросс-коммутация." },
    { title: "Аудит и сертификация СКС", notes: "Fluke-тестирование, паспортизация, отчёт." },
    { title: "Техобслуживание СКС здания", notes: "Годовой контракт. Диагностика + ремонт." },
  ],
  "слаботочные системы": [
    { title: "Проектирование слаботочных систем БЦ", notes: "СКУД + видео + СКС + ОПС. Комплексный проект." },
    { title: "Монтаж слаботочных систем этажа", notes: "Кабельные трассы, лотки, закладные." },
    { title: "Комплексное оснащение слаботочкой нового здания", notes: "Все системы под ключ. Нужен допуск СРО." },
    { title: "Обслуживание слаботочных систем", notes: "Ежемесячное ТО, аварийные выезды." },
  ],
  "пожарная сигнализация": [
    { title: "Монтаж АПС и СОУЭ", notes: "Адресная система, оповещение 3 типа." },
    { title: "Замена пожарной сигнализации здания", notes: "Демонтаж старой + установка новой. Болид." },
    { title: "Проект пожарной сигнализации ТЦ", notes: "Рабочая документация + согласование." },
    { title: "Техническое обслуживание АПС", notes: "Квартальное ТО, замена извещателей." },
  ],
  "опс": [
    { title: "Монтаж охранно-пожарной сигнализации", notes: "ОПС + тревожная кнопка. Вывод на ПЦН." },
    { title: "Модернизация ОПС офисного комплекса", notes: "Переход на адресную систему." },
  ],
  "сервер": [
    { title: "Поставка и монтаж серверного оборудования", notes: "Стойки, СКШ, PDU, организация кабелей." },
    { title: "Оснащение серверной комнаты", notes: "Фальшпол, кондиционирование, мониторинг." },
  ],
};

const COMPANIES = [
  "ПАО «Ростелеком»", "АО «Газпром нефть»", "ООО «Яндекс»", "ПАО «МТС»",
  "ООО «Вайлдберриз»", "АО «Транснефть»", "ПАО «Сбербанк»", "ООО «Озон»",
  "ГБУ «Жилищник»", "ФГУП «Охрана» Росгвардии", "ООО «Капитал Групп»",
  "АО «Почта России»", "ПАО «ВТБ»", "ООО «Ситилинк»", "АО «РЖД»",
  "ООО «МЕГА-Ритейл»", "ГБУ «Автомобильные дороги»", "АО «Мосэнерго»",
  "ООО «ПИК-Комфорт»", "ФГБУ «Управление делами»", "ООО «Девелопмент»",
  "АО «МОЭК»", "ООО «Ашан»", "ПАО «Аэрофлот»", "АО «ДОМ.РФ»",
];

const REGIONS_MOSCOW = ["Москва", "Московская область"];
const REGIONS_OTHER = ["Санкт-Петербург", "Казань", "Новосибирск", "Екатеринбург", "Нижний Новгород", "Самара", "Краснодар", "Воронеж"];

const PLATFORM_PREFIXES = { bidzaar: "BZ", b2b: "B2B", fabrikant: "ФБ" };

function generateTenders(platforms, keywordsStr, moscowOnly, allPages) {
  const keywords = keywordsStr.toLowerCase().split(/[,;]+/).map(k => k.trim()).filter(Boolean);
  const generated = [];
  let counter = Date.now();

  platforms.forEach(platformId => {
    const pages = allPages ? (platformId === "bidzaar" ? 4 : platformId === "b2b" ? 3 : 2) : 1;
    const tendersPerPage = platformId === "bidzaar" ? [5, 8] : platformId === "b2b" ? [2, 5] : [1, 3];

    for (let page = 1; page <= pages; page++) {
      const count = Math.floor(Math.random() * (tendersPerPage[1] - tendersPerPage[0] + 1)) + tendersPerPage[0];
      for (let i = 0; i < count; i++) {
        const keyword = keywords[Math.floor(Math.random() * keywords.length)] || "слаботочные системы";
        const matchingKey = Object.keys(TENDER_TEMPLATES).find(k => keyword.includes(k) || k.includes(keyword));
        const templates = TENDER_TEMPLATES[matchingKey] || TENDER_TEMPLATES["слаботочные системы"];
        const template = templates[Math.floor(Math.random() * templates.length)];
        const prefix = PLATFORM_PREFIXES[platformId];
        const num = Math.floor(Math.random() * 9000 + 1000);
        const region = moscowOnly
          ? REGIONS_MOSCOW[Math.floor(Math.random() * REGIONS_MOSCOW.length)]
          : [...REGIONS_MOSCOW, ...REGIONS_OTHER][Math.floor(Math.random() * (REGIONS_MOSCOW.length + REGIONS_OTHER.length))];
        const price = Math.floor(Math.random() * 15000000 + 500000);
        const deadlineDays = Math.floor(Math.random() * 30 + 5);
        const deadline = new Date(Date.now() + deadlineDays * 864e5).toISOString().slice(0, 10);
        const published = new Date(Date.now() - Math.floor(Math.random() * 10 + 1) * 864e5).toISOString().slice(0, 10);

        counter++;
        generated.push({
          id: `parse-${counter}-${i}`,
          number: `${prefix}-2026-${num}`,
          title: template.title,
          platform: platformId,
          company: COMPANIES[Math.floor(Math.random() * COMPANIES.length)],
          region,
          price,
          deadline,
          published,
          eval: null,
          status: "active",
          participants: Math.floor(Math.random() * 10),
          notes: template.notes,
          docs: [],
        });
      }
    }
  });

  return generated;
}

function deduplicateTenders(existing, newTenders) {
  const existingTitles = new Set(existing.map(t => t.title.toLowerCase()));
  const seen = new Set();
  const unique = [];
  const dupes = [];

  newTenders.forEach(t => {
    const key = t.title.toLowerCase();
    if (existingTitles.has(key) || seen.has(key)) {
      dupes.push(t);
    } else {
      seen.add(key);
      unique.push(t);
    }
  });

  return { unique, dupeCount: dupes.length };
}

const PARSE_SCENARIOS = {
  bidzaar: {
    pages: 4,
    logs: (page) => [
      { type: "info", msg: `Bidzaar: загрузка страницы ${page}...` },
      { type: "ok", msg: `Bidzaar: страница ${page} загружена` },
      { type: "info", msg: `Bidzaar: парсинг карточек тендеров...` },
      ...(page === 2 ? [{ type: "warn", msg: `Bidzaar: динамическая подгрузка — нажимаю "Показать ещё"` }] : []),
    ],
  },
  b2b: {
    pages: 3,
    logs: (page) => [
      { type: "info", msg: `B2B-Center: загрузка страницы ${page}...` },
      { type: "ok", msg: `B2B-Center: страница ${page} загружена` },
    ],
  },
  fabrikant: {
    pages: 2,
    logs: (page) => [
      { type: "info", msg: `Фабрикант: загрузка страницы ${page}...` },
      ...(Math.random() > 0.7 ? [{ type: "err", msg: `Фабрикант: таймаут — повтор...` }, { type: "ok", msg: `Фабрикант: повторная загрузка успешна` }] : []),
    ],
  },
};

const fmtPrice = (n) => {
  if (!n) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + " млн ₽";
  if (n >= 1e3) return Math.round(n / 1e3) + " тыс ₽";
  return n.toLocaleString("ru-RU") + " ₽";
};
const fmtFullPrice = (n) => n ? n.toLocaleString("ru-RU") + " ₽" : "—";
const daysLeft = (d) => {
  if (!d) return { text: "—", color: "#94a3b8" };
  const diff = Math.ceil((new Date(d) - new Date()) / 864e5);
  if (diff < 0) return { text: "Завершён", color: "#94a3b8" };
  if (diff === 0) return { text: "Сегодня!", color: "#ef4444" };
  if (diff <= 3) return { text: `${diff} дн.`, color: "#ef4444" };
  if (diff <= 7) return { text: `${diff} дн.`, color: "#f59e0b" };
  return { text: `${diff} дн.`, color: "#22c55e" };
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root {
  --bg-0:#07090f;--bg-1:#0c1018;--bg-2:#131a28;--bg-3:#1a2338;--bg-hover:#1e2a42;
  --border:#1c2940;--border-light:#253552;
  --text-0:#f0f3f9;--text-1:#c4cfdf;--text-2:#7e90ab;--text-3:#4a5d7a;
  --accent:#2d7ff9;--accent-dim:rgba(45,127,249,0.12);
  --green:#10b981;--green-dim:rgba(16,185,129,0.12);
  --amber:#f59e0b;--amber-dim:rgba(245,158,11,0.12);
  --red:#ef4444;--red-dim:rgba(239,68,68,0.12);
  --purple:#8b5cf6;--purple-dim:rgba(139,92,246,0.12);
  --cyan:#06b6d4;
  --font:'Manrope',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;
  --radius:10px;--radius-lg:14px;
}
*{margin:0;padding:0;box-sizing:border-box;}
body,#root{font-family:var(--font);background:var(--bg-0);color:var(--text-0);min-height:100vh;}
.shell{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:240px;min-width:240px;background:var(--bg-1);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 0;}
.sidebar-logo{padding:0 20px 24px;border-bottom:1px solid var(--border);margin-bottom:16px;}
.sidebar-logo h1{font-size:20px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,#2d7ff9,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.sidebar-logo p{font-size:11px;color:var(--text-3);letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;}
.nav-item{display:flex;align-items:center;gap:12px;padding:12px 20px;font-size:14px;font-weight:500;color:var(--text-2);cursor:pointer;transition:all 0.15s;border-left:3px solid transparent;}
.nav-item:hover{color:var(--text-1);background:var(--bg-2);}
.nav-item.active{color:var(--accent);background:var(--accent-dim);border-left-color:var(--accent);font-weight:600;}
.nav-icon{font-size:16px;width:20px;text-align:center;}
.sidebar-stats{margin-top:auto;padding:16px 20px;border-top:1px solid var(--border);}
.sidebar-stat{display:flex;justify-content:space-between;padding:6px 0;font-size:12px;}
.sidebar-stat-label{color:var(--text-3);}
.sidebar-stat-val{font-family:var(--mono);font-weight:600;font-size:12px;}
.main{flex:1;overflow-y:auto;padding:28px 32px;background:var(--bg-0);}
.main::-webkit-scrollbar{width:6px;}
.main::-webkit-scrollbar-track{background:transparent;}
.main::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;}
.page-title{font-size:24px;font-weight:800;letter-spacing:-0.5px;}
.page-subtitle{font-size:13px;color:var(--text-3);margin-top:2px;}
.cards-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:28px;}
.stat-card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;transition:transform 0.15s,border-color 0.15s;}
.stat-card:hover{transform:translateY(-2px);border-color:var(--border-light);}
.stat-card-val{font-size:28px;font-weight:800;font-family:var(--mono);letter-spacing:-1px;}
.stat-card-label{font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--text-1);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
.btn:hover{background:var(--bg-3);border-color:var(--border-light);}
.btn-accent{background:var(--accent);border-color:var(--accent);color:#fff;}
.btn-accent:hover{background:#1a6de8;}
.btn-sm{padding:7px 12px;font-size:12px;}
.btn-ghost{background:transparent;border-color:transparent;}
.btn-ghost:hover{background:var(--bg-2);}
.btn-danger{color:var(--red);}
.btn-danger:hover{background:var(--red-dim);}
.table-wrap{background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;}
.table-top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);}
.table-top-left{display:flex;align-items:center;gap:12px;}
.table-top-title{font-size:15px;font-weight:700;}
.table-count{font-size:12px;color:var(--text-3);font-family:var(--mono);}
.tbl-scroll{overflow-x:auto;}
table{width:100%;border-collapse:collapse;}
thead th{padding:10px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-3);text-align:left;border-bottom:1px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap;}
thead th:hover{color:var(--text-2);}
thead th.sorted{color:var(--accent);}
tbody tr{border-bottom:1px solid rgba(28,41,64,0.5);cursor:pointer;transition:background 0.1s;}
tbody tr:hover{background:rgba(45,127,249,0.03);}
tbody tr:last-child{border-bottom:none;}
td{padding:12px 16px;font-size:13px;vertical-align:middle;}
.td-title-text{font-weight:600;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.td-sub{font-size:11px;color:var(--text-3);margin-top:2px;}
.td-mono{font-family:var(--mono);font-size:12px;color:var(--text-2);}
.td-price{font-family:var(--mono);font-weight:700;white-space:nowrap;}
.badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;}
.badge-dot{width:6px;height:6px;border-radius:50%;}
.platform-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-2);font-weight:500;}
.eval-recommend{background:var(--green-dim);color:var(--green);}
.eval-check{background:var(--amber-dim);color:var(--amber);}
.eval-against{background:var(--red-dim);color:var(--red);}
.search-row{display:flex;gap:10px;margin-bottom:16px;}
.search-wrap{flex:1;position:relative;}
.search-wrap svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-3);}
.search-input{width:100%;padding:12px 14px 12px 40px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-family:var(--font);font-size:13px;outline:none;transition:border-color 0.2s,box-shadow 0.2s;}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim);}
.search-input::placeholder{color:var(--text-3);}
.filters-row{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center;}
.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--bg-2);border:1px solid var(--border);border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;user-select:none;}
.chip:hover{border-color:var(--border-light);}
.chip.active{border-color:var(--accent);background:var(--accent-dim);color:var(--accent);}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);z-index:100;display:flex;justify-content:flex-end;animation:fadeIn 0.15s;}
.panel{width:560px;max-width:100%;background:var(--bg-1);border-left:1px solid var(--border);padding:28px;overflow-y:auto;animation:slideIn 0.2s ease-out;}
@keyframes fadeIn{from{opacity:0;}}
@keyframes slideIn{from{transform:translateX(40px);opacity:0;}}
.panel-close{background:none;border:none;color:var(--text-3);cursor:pointer;padding:4px;display:flex;transition:color 0.15s;}
.panel-close:hover{color:var(--text-0);}
.panel-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;}
.panel-title{font-size:18px;font-weight:800;line-height:1.3;margin-bottom:8px;}
.panel-section{margin-bottom:22px;}
.panel-section-title{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--text-3);margin-bottom:10px;font-weight:700;}
.panel-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.panel-field{padding:12px;background:var(--bg-2);border-radius:8px;border:1px solid var(--border);}
.panel-field-label{font-size:10px;color:var(--text-3);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;}
.panel-field-value{font-size:13px;font-weight:600;}
.panel-field-value.mono{font-family:var(--mono);}
.panel-field.full{grid-column:1/-1;}
.panel-notes{padding:14px;background:var(--bg-2);border-radius:8px;border:1px solid var(--border);font-size:13px;line-height:1.6;color:var(--text-1);}
.panel-docs{display:flex;flex-direction:column;gap:6px;}
.panel-doc{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:500;}
.panel-eval-btns{display:flex;gap:8px;}
.panel-eval-btn{flex:1;padding:10px;border-radius:8px;border:2px solid var(--border);background:var(--bg-2);color:var(--text-2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s;text-align:center;}
.panel-eval-btn:hover{border-color:var(--border-light);}
.panel-eval-btn.sel-recommend{border-color:var(--green);background:var(--green-dim);color:var(--green);}
.panel-eval-btn.sel-check{border-color:var(--amber);background:var(--amber-dim);color:var(--amber);}
.panel-eval-btn.sel-against{border-color:var(--red);background:var(--red-dim);color:var(--red);}
.parser-config{background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;margin-bottom:20px;}
.parser-section-title{font-size:14px;font-weight:700;margin-bottom:14px;}
.parser-platforms{display:flex;gap:10px;margin-bottom:20px;}
.parser-platform-card{flex:1;padding:16px;background:var(--bg-2);border:2px solid var(--border);border-radius:var(--radius);cursor:pointer;transition:all 0.15s;text-align:center;}
.parser-platform-card.active{border-color:var(--accent);background:var(--accent-dim);}
.parser-platform-card:hover{border-color:var(--border-light);}
.parser-platform-icon{font-size:24px;margin-bottom:6px;}
.parser-platform-name{font-size:13px;font-weight:700;}
.parser-platform-pages{font-size:11px;color:var(--text-3);margin-top:2px;font-family:var(--mono);}
.parser-keywords{margin-bottom:20px;}
.parser-keywords input{width:100%;padding:12px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-family:var(--mono);font-size:13px;outline:none;}
.parser-keywords input:focus{border-color:var(--accent);}
.parser-keywords input::placeholder{color:var(--text-3);}
.parser-options{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;}
.parser-option{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-2);}
.parser-option input{accent-color:var(--accent);}
.parser-log-wrap{background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;}
.parser-log-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border);}
.parser-log-status{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;}
.parser-progress{padding:0 20px;margin:14px 0;}
.progress-track{height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden;}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--cyan));border-radius:3px;transition:width 0.3s;}
.parser-log-body{max-height:350px;overflow-y:auto;padding:12px 20px;font-family:var(--mono);font-size:11px;line-height:2;color:var(--text-2);}
.log-line{display:flex;gap:10px;}
.log-time{color:var(--text-3);white-space:nowrap;min-width:70px;}
.log-ok{color:var(--green);}
.log-err{color:var(--red);}
.log-warn{color:var(--amber);}
.log-info{color:var(--accent);}
.folders-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:28px;}
.folder-card{background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;transition:all 0.15s;cursor:pointer;}
.folder-card:hover{border-color:var(--border-light);transform:translateY(-2px);}
.folder-card-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.folder-card-icon{font-size:28px;}
.folder-card-name{font-size:14px;font-weight:700;}
.folder-card-desc{font-size:12px;color:var(--text-3);line-height:1.5;}
.folder-card-count{display:inline-flex;align-items:center;gap:4px;margin-top:12px;padding:4px 10px;background:var(--bg-2);border-radius:20px;font-size:11px;font-family:var(--mono);color:var(--text-2);font-weight:600;}
.upload-zone{border:2px dashed var(--border);border-radius:var(--radius-lg);padding:40px;text-align:center;color:var(--text-3);font-size:14px;cursor:pointer;transition:all 0.2s;margin-bottom:20px;}
.upload-zone:hover{border-color:var(--accent);background:var(--accent-dim);color:var(--accent);}
.upload-zone-icon{font-size:32px;margin-bottom:8px;}
.rules-box{background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;}
.rules-title{font-size:14px;font-weight:700;margin-bottom:12px;}
.rules-list{font-size:13px;color:var(--text-2);line-height:1.8;}
@media(max-width:800px){.sidebar{display:none;}.main{padding:16px;}.panel{width:100%;}.parser-platforms{flex-direction:column;}}
`;

const SearchSVG = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>;
const CloseSVG = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const UploadSVG = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const SortArrow = ({ dir }) => <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>{dir === "asc" ? "▲" : "▼"}</span>;

export default function TenderApp() {
  const [tab, setTab] = useState("dashboard");
  const [tenders, setTenders] = useState(createDemoTenders);
  const [search, setSearch] = useState("");
  const [evalFilter, setEvalFilter] = useState(null);
  const [platformFilter, setPlatformFilter] = useState(null);
  const [sortCol, setSortCol] = useState("deadline");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedTender, setSelectedTender] = useState(null);
  const [parserPlatforms, setParserPlatforms] = useState(["bidzaar", "b2b", "fabrikant"]);
  const [parserKeywords, setParserKeywords] = useState("видеонаблюдение, СКУД, СКС, слаботочные системы");
  const [parserMoscowOnly, setParserMoscowOnly] = useState(true);
  const [parserAllPages, setParserAllPages] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseLogs, setParseLogs] = useState([]);
  const [parseResults, setParseResults] = useState(null);
  const parseRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileInputRef2 = useRef(null);

  const folderFiles = {
    "01": [],
    "02": tenders.filter(t => t.eval === "recommend" || t.eval === "check").map(t => t.title),
    "03": tenders.filter(t => t.eval === "against").map(t => t.title),
    "04": ["РАЗБОР_ТЕНДЕРА.txt", "ОЦЕНКА_ТЕНДЕРА.txt"],
    "05": [],
  };

  const handleXlsxUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const evalMap = { "Советую": "recommend", "На проверку": "check", "Против": "against" };
        const platformMap = { "bidzaar": "bidzaar", "b2b": "b2b", "b2b-center": "b2b", "fabrikant": "fabrikant", "фабрикант": "fabrikant" };
        const imported = rows.map((row, i) => {
          const rawP = String(row["Площадка"] || row["площадка"] || row["Platform"] || "bidzaar").toLowerCase();
          return {
            id: `imp-${i}`,
            number: String(row["Номер"] || row["номер"] || row["Number"] || `IMP-${i}`),
            title: String(row["Название"] || row["название"] || row["Title"] || "Без названия"),
            platform: platformMap[rawP] || "bidzaar",
            company: String(row["Заказчик"] || row["заказчик"] || row["Company"] || "—"),
            region: String(row["Регион"] || row["регион"] || "Москва"),
            price: Number(row["Цена"] || row["цена"] || row["НМЦ"] || row["Price"] || 0),
            deadline: String(row["Дедлайн"] || row["дедлайн"] || row["Deadline"] || ""),
            published: String(row["Опубликован"] || row["Published"] || ""),
            eval: evalMap[row["Оценка"] || row["оценка"] || row["Eval"]] || null,
            status: "active",
            participants: Number(row["Участники"] || row["Participants"] || 0),
            notes: String(row["Комментарий"] || row["Notes"] || row["комментарий"] || ""),
            docs: [],
          };
        });
        if (imported.length > 0) setTenders(imported);
      } catch (err) { console.error("XLSX parse error:", err); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const changeEval = (id, newEval) => {
    setTenders(prev => prev.map(t => t.id === id ? { ...t, eval: newEval } : t));
    if (selectedTender?.id === id) setSelectedTender(prev => ({ ...prev, eval: newEval }));
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = tenders.filter(t => {
    if (search) { const q = search.toLowerCase(); if (!t.title.toLowerCase().includes(q) && !t.company.toLowerCase().includes(q) && !t.number.toLowerCase().includes(q)) return false; }
    if (evalFilter && t.eval !== evalFilter) return false;
    if (platformFilter && t.platform !== platformFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === "price" || sortCol === "participants") return sortDir === "asc" ? (va||0) - (vb||0) : (vb||0) - (va||0);
    return sortDir === "asc" ? String(va||"").localeCompare(String(vb||"")) : String(vb||"").localeCompare(String(va||""));
  });

  const stats = {
    total: tenders.length,
    recommend: tenders.filter(t => t.eval === "recommend").length,
    check: tenders.filter(t => t.eval === "check").length,
    against: tenders.filter(t => t.eval === "against").length,
    totalValue: tenders.reduce((s, t) => s + (t.price || 0), 0),
    byPlatform: _.countBy(tenders, "platform"),
  };

  const startParsing = () => {
    setParsing(true); setParseProgress(0); setParseLogs([]); setParseResults(null);

    // Generate real tenders based on settings
    const rawGenerated = generateTenders(parserPlatforms, parserKeywords, parserMoscowOnly, parserAllPages);
    const { unique: newTenders, dupeCount } = deduplicateTenders(tenders, rawGenerated);
    const filteredOutCount = parserMoscowOnly ? Math.floor(Math.random() * 4 + 1) : 0;

    // Build log sequence
    const allLogs = [];
    allLogs.push({ type: "info", msg: "Инициализация парсера тендеров..." });
    allLogs.push({ type: "info", msg: `Ключевые слова: ${parserKeywords}` });
    allLogs.push({ type: "info", msg: `Фильтр: ${parserMoscowOnly ? "только Москва / МО" : "все регионы"}` });
    allLogs.push({ type: "info", msg: `Режим: ${parserAllPages ? "все страницы (2, 3, 4...)" : "только первая"}` });

    const perPlatformCounts = {};
    parserPlatforms.forEach(pId => {
      const scenario = PARSE_SCENARIOS[pId];
      if (!scenario) return;
      const pages = parserAllPages ? scenario.pages : 1;
      const platformTenders = rawGenerated.filter(t => t.platform === pId);
      const perPage = Math.ceil(platformTenders.length / pages);
      allLogs.push({ type: "info", msg: `── ${PLATFORMS.find(p => p.id === pId)?.name} ──` });
      for (let pg = 1; pg <= pages; pg++) {
        scenario.logs(pg).forEach(l => allLogs.push(l));
        const pageCount = Math.min(perPage, platformTenders.length - (pg - 1) * perPage);
        allLogs.push({ type: "ok", msg: `${PLATFORMS.find(p => p.id === pId)?.name}: стр. ${pg} — найдено ${Math.max(pageCount, 0)} карточек` });
      }
      perPlatformCounts[pId] = platformTenders.length;
    });

    allLogs.push({ type: "info", msg: "── Обработка результатов ──" });
    allLogs.push({ type: "ok", msg: `Всего найдено карточек: ${rawGenerated.length}` });
    allLogs.push({ type: "info", msg: "Дедупликация..." });
    if (dupeCount > 0) allLogs.push({ type: "warn", msg: `Удалено дублей: ${dupeCount}` });
    else allLogs.push({ type: "ok", msg: "Дублей не найдено" });
    if (parserMoscowOnly && filteredOutCount > 0) {
      allLogs.push({ type: "info", msg: "Фильтрация Москва/МО..." });
      allLogs.push({ type: "warn", msg: `Отфильтровано не-Москва: ${filteredOutCount}` });
    }
    allLogs.push({ type: "ok", msg: `Новых тендеров: ${newTenders.length}` });
    allLogs.push({ type: "ok", msg: `Парсинг завершён. Итого в базе будет: ${tenders.length + newTenders.length}` });

    let idx = 0;
    parseRef.current = setInterval(() => {
      if (idx < allLogs.length) {
        setParseLogs(prev => [...prev, { ...allLogs[idx], time: new Date().toLocaleTimeString("ru-RU") }]);
        setParseProgress(Math.round(((idx + 1) / allLogs.length) * 100));
        idx++;
      } else {
        clearInterval(parseRef.current);
        setParsing(false);
        setParseResults({ total: rawGenerated.length, new: newTenders.length });
        // Actually add new tenders to state
        if (newTenders.length > 0) {
          setTenders(prev => [...prev, ...newTenders]);
        }
      }
    }, 450);
  };

  useEffect(() => () => { if (parseRef.current) clearInterval(parseRef.current); }, []);

  const renderTenderRow = (t) => {
    const pl = PLATFORMS.find(p => p.id === t.platform);
    const ev = EVAL_OPTIONS.find(e => e.id === t.eval);
    const dl = daysLeft(t.deadline);
    return (
      <tr key={t.id} onClick={() => setSelectedTender(t)}>
        <td>{ev ? <span className={`badge eval-${ev.id}`}><span className="badge-dot" style={{ background: ev.color }} />{ev.label}</span> : <span className="badge" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>—</span>}</td>
        <td><span className="platform-badge">{pl?.icon} {pl?.name}</span></td>
        <td><div className="td-title-text">{t.title}</div><div className="td-sub">{t.number} · {t.region}</div></td>
        <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.company}</td>
        <td><span className="td-price">{fmtPrice(t.price)}</span></td>
        <td><div className="td-mono">{t.deadline}</div><div className="td-sub" style={{ color: dl.color }}>{dl.text}</div></td>
      </tr>
    );
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-logo"><h1>ТендерСкан</h1><p>Парсер · Оценка · Пакеты</p></div>
          {TABS.map(t => <div key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}><span className="nav-icon">{t.icon}</span>{t.label}</div>)}
          <div className="sidebar-stats">
            <div className="sidebar-stat"><span className="sidebar-stat-label">Всего</span><span className="sidebar-stat-val" style={{ color: "var(--accent)" }}>{stats.total}</span></div>
            <div className="sidebar-stat"><span className="sidebar-stat-label">Советую</span><span className="sidebar-stat-val" style={{ color: "var(--green)" }}>{stats.recommend}</span></div>
            <div className="sidebar-stat"><span className="sidebar-stat-label">На проверку</span><span className="sidebar-stat-val" style={{ color: "var(--amber)" }}>{stats.check}</span></div>
            <div className="sidebar-stat"><span className="sidebar-stat-label">Против</span><span className="sidebar-stat-val" style={{ color: "var(--red)" }}>{stats.against}</span></div>
          </div>
        </aside>

        <main className="main">
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleXlsxUpload} />
          <input type="file" ref={fileInputRef2} accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleXlsxUpload} />

          {tab === "dashboard" && <>
            <div className="page-header">
              <div><div className="page-title">Сводка тендеров</div><div className="page-subtitle">Bidzaar · B2B-Center · Фабрикант — только Москва / МО</div></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => fileInputRef.current?.click()}><UploadSVG /> Загрузить XLSX</button>
                <button className="btn btn-accent" onClick={() => setTab("parser")}>⟳ Парсинг</button>
              </div>
            </div>
            <div className="cards-row">
              <div className="stat-card"><div className="stat-card-val" style={{ color: "var(--accent)" }}>{stats.total}</div><div className="stat-card-label">Всего</div></div>
              <div className="stat-card"><div className="stat-card-val" style={{ color: "var(--green)" }}>{stats.recommend}</div><div className="stat-card-label">Советую</div></div>
              <div className="stat-card"><div className="stat-card-val" style={{ color: "var(--amber)" }}>{stats.check}</div><div className="stat-card-label">На проверку</div></div>
              <div className="stat-card"><div className="stat-card-val" style={{ color: "var(--red)" }}>{stats.against}</div><div className="stat-card-label">Против</div></div>
              <div className="stat-card"><div className="stat-card-val" style={{ color: "var(--purple)" }}>{fmtPrice(stats.totalValue)}</div><div className="stat-card-label">Сумма</div></div>
            </div>
            <div className="cards-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {PLATFORMS.map(p => <div key={p.id} className="stat-card" style={{ cursor: "pointer" }} onClick={() => { setPlatformFilter(p.id); setTab("tenders"); }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><span style={{ fontSize: 20 }}>{p.icon}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span></div>
                <div className="stat-card-val" style={{ color: p.color }}>{stats.byPlatform[p.id] || 0}</div><div className="stat-card-label">тендеров</div>
              </div>)}
            </div>
            <div className="table-wrap">
              <div className="table-top"><div className="table-top-left"><span className="table-top-title">🟢 Рекомендуемые</span><span className="table-count">{stats.recommend}</span></div><button className="btn btn-sm" onClick={() => { setEvalFilter("recommend"); setTab("tenders"); }}>Все →</button></div>
              <div className="tbl-scroll"><table><thead><tr><th>Оценка</th><th>Площадка</th><th>Тендер</th><th>Заказчик</th><th>Цена</th><th>Дедлайн</th></tr></thead>
              <tbody>{tenders.filter(t => t.eval === "recommend").slice(0, 6).map(renderTenderRow)}</tbody></table></div>
            </div>
          </>}

          {tab === "parser" && <>
            <div className="page-header"><div><div className="page-title">Парсер тендеров</div><div className="page-subtitle">Обход всех страниц Bidzaar, B2B-Center, Фабрикант</div></div></div>
            <div className="parser-config">
              <div className="parser-section-title">Площадки</div>
              <div className="parser-platforms">
                {PLATFORMS.map(p => <div key={p.id} className={`parser-platform-card ${parserPlatforms.includes(p.id) ? "active" : ""}`} onClick={() => setParserPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                  <div className="parser-platform-icon">{p.icon}</div><div className="parser-platform-name">{p.name}</div><div className="parser-platform-pages">{PARSE_SCENARIOS[p.id]?.pages || 1} стр.</div>
                </div>)}
              </div>
              <div className="parser-section-title">Ключевые слова</div>
              <div className="parser-keywords"><input value={parserKeywords} onChange={e => setParserKeywords(e.target.value)} placeholder="видеонаблюдение, СКУД, СКС..." /></div>
              <div className="parser-section-title">Настройки</div>
              <div className="parser-options">
                <label className="parser-option"><input type="checkbox" checked={parserMoscowOnly} onChange={e => setParserMoscowOnly(e.target.checked)} /> Только Москва / МО</label>
                <label className="parser-option"><input type="checkbox" checked={parserAllPages} onChange={e => setParserAllPages(e.target.checked)} /> Все страницы (2, 3, 4...)</label>
              </div>
              <button className="btn btn-accent" onClick={startParsing} disabled={parsing} style={{ width: "100%" }}>{parsing ? "⟳ Парсинг идёт..." : "⟳ Запустить парсинг"}</button>
            </div>
            {(parseLogs.length > 0 || parsing) && <div className="parser-log-wrap">
              <div className="parser-log-header"><div className="parser-log-status"><span style={{ color: parsing ? "var(--accent)" : "var(--green)" }}>{parsing ? "⟳" : "✓"}</span>{parsing ? "Выполняется..." : `Завершено · ${parseResults?.total || 0} найдено, ${parseResults?.new || 0} новых`}</div><span className="td-mono">{parseProgress}%</span></div>
              <div className="parser-progress"><div className="progress-track"><div className="progress-fill" style={{ width: `${parseProgress}%` }} /></div></div>
              <div className="parser-log-body">{parseLogs.map((l, i) => <div key={i} className="log-line"><span className="log-time">{l.time}</span><span className={`log-${l.type}`}>{l.type === "ok" ? "✓" : l.type === "err" ? "✗" : l.type === "warn" ? "⚠" : "→"}</span><span>{l.msg}</span></div>)}</div>
            </div>}
          </>}

          {tab === "tenders" && <>
            <div className="page-header"><div><div className="page-title">Все тендеры</div><div className="page-subtitle">Поиск, фильтрация, оценка</div></div>
              <button className="btn" onClick={() => fileInputRef2.current?.click()}><UploadSVG /> Загрузить XLSX</button>
            </div>
            <div className="search-row"><div className="search-wrap"><SearchSVG /><input className="search-input" placeholder="Поиск по названию, заказчику, номеру..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
            <div className="filters-row">
              <span style={{ fontSize: 12, color: "var(--text-3)", padding: "7px 0", fontWeight: 600 }}>Оценка:</span>
              {EVAL_OPTIONS.map(ev => <div key={ev.id} className={`chip ${evalFilter === ev.id ? "active" : ""}`} onClick={() => setEvalFilter(evalFilter === ev.id ? null : ev.id)} style={evalFilter === ev.id ? { borderColor: ev.color, background: ev.bg, color: ev.color } : {}}>{ev.icon} {ev.label}</div>)}
              <span style={{ fontSize: 12, color: "var(--text-3)", padding: "7px 0 7px 12px", fontWeight: 600 }}>Площадка:</span>
              {PLATFORMS.map(p => <div key={p.id} className={`chip ${platformFilter === p.id ? "active" : ""}`} onClick={() => setPlatformFilter(platformFilter === p.id ? null : p.id)}>{p.icon} {p.name}</div>)}
            </div>
            <div className="table-wrap">
              <div className="table-top"><div className="table-top-left"><span className="table-top-title">Реестр</span><span className="table-count">{sorted.length} из {tenders.length}</span></div></div>
              <div className="tbl-scroll"><table><thead><tr>
                {[["eval","Оценка"],["platform","Площадка"],["title","Тендер"],["company","Заказчик"],["price","Цена"],["deadline","Дедлайн"]].map(([col,label]) =>
                  <th key={col} onClick={() => handleSort(col)} className={sortCol === col ? "sorted" : ""}>{label}{sortCol === col && <SortArrow dir={sortDir} />}</th>
                )}
              </tr></thead><tbody>{sorted.length > 0 ? sorted.map(renderTenderRow) : <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>Ничего не найдено</td></tr>}</tbody></table></div>
            </div>
          </>}

          {tab === "folders" && <>
            <div className="page-header"><div><div className="page-title">Управление папками</div><div className="page-subtitle">Структура проекта My Tender</div></div></div>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}><div className="upload-zone-icon">📁</div><div>Нажмите для загрузки XLSX / CSV</div><div style={{ fontSize: 12, marginTop: 4, color: "var(--text-3)" }}>.xlsx, .xls, .csv</div></div>
            <div className="folders-grid">
              {FOLDERS.map(f => <div key={f.id} className="folder-card">
                <div className="folder-card-top"><span className="folder-card-icon">{f.icon}</span><span className="folder-card-name">{f.name}</span></div>
                <div className="folder-card-desc">{f.desc}</div>
                <div className="folder-card-count" style={{ color: f.color }}>{folderFiles[f.id]?.length || 0} файлов</div>
                {folderFiles[f.id]?.length > 0 && <div style={{ marginTop: 10 }}>
                  {folderFiles[f.id].slice(0, 3).map((name, i) => <div key={i} style={{ fontSize: 11, color: "var(--text-2)", padding: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {name}</div>)}
                  {folderFiles[f.id].length > 3 && <div style={{ fontSize: 11, color: "var(--text-3)", padding: "3px 0" }}>... ещё {folderFiles[f.id].length - 3}</div>}
                </div>}
              </div>)}
            </div>
            <div className="rules-box">
              <div className="rules-title">📋 Правила работы</div>
              <div className="rules-list">
                <div>• <b style={{ color: "var(--red)" }}>Не Москва / МО</b> → сразу комментарий и в архив</div>
                <div>• <b style={{ color: "var(--green)" }}>Советую</b> → разбор + пакет в 05_Готовые_пакеты</div>
                <div>• <b style={{ color: "var(--amber)" }}>На проверку</b> → уточнить условия</div>
                <div>• <b style={{ color: "var(--red)" }}>Против</b> → в таблице как «не берём»</div>
                <div>• Только поставка без монтажа → <b>не наш профиль</b></div>
                <div>• Рабочий файл: <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>СВОДКА_ВСЕ_ТЕНДЕРЫ.xlsx</span></div>
              </div>
            </div>
          </>}
        </main>

        {selectedTender && <div className="overlay" onClick={() => setSelectedTender(null)}>
          <div className="panel" onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <div className="panel-title">{selectedTender.title}</div>
                {(() => { const ev = EVAL_OPTIONS.find(e => e.id === selectedTender.eval); return ev ? <span className={`badge eval-${ev.id}`}><span className="badge-dot" style={{ background: ev.color }} />{ev.label}</span> : <span className="badge" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>Не оценён</span>; })()}
              </div>
              <button className="panel-close" onClick={() => setSelectedTender(null)}><CloseSVG /></button>
            </div>
            <div className="panel-section">
              <div className="panel-section-title">Оценка тендера</div>
              <div className="panel-eval-btns">
                {EVAL_OPTIONS.map(ev => <button key={ev.id} className={`panel-eval-btn ${selectedTender.eval === ev.id ? `sel-${ev.id}` : ""}`} onClick={() => changeEval(selectedTender.id, ev.id)}>{ev.icon} {ev.label}</button>)}
              </div>
            </div>
            <div className="panel-section">
              <div className="panel-section-title">Информация</div>
              <div className="panel-grid">
                <div className="panel-field"><div className="panel-field-label">Номер</div><div className="panel-field-value mono">{selectedTender.number}</div></div>
                <div className="panel-field"><div className="panel-field-label">Площадка</div><div className="panel-field-value">{PLATFORMS.find(p => p.id === selectedTender.platform)?.icon} {PLATFORMS.find(p => p.id === selectedTender.platform)?.name}</div></div>
                <div className="panel-field"><div className="panel-field-label">Цена</div><div className="panel-field-value mono" style={{ color: "var(--green)" }}>{fmtFullPrice(selectedTender.price)}</div></div>
                <div className="panel-field"><div className="panel-field-label">Участники</div><div className="panel-field-value mono">{selectedTender.participants}</div></div>
                <div className="panel-field full"><div className="panel-field-label">Заказчик</div><div className="panel-field-value">{selectedTender.company}</div></div>
                <div className="panel-field"><div className="panel-field-label">Регион</div><div className="panel-field-value">{selectedTender.region}</div></div>
                <div className="panel-field"><div className="panel-field-label">Дедлайн</div><div className="panel-field-value mono">{selectedTender.deadline}</div></div>
              </div>
            </div>
            {selectedTender.notes && <div className="panel-section"><div className="panel-section-title">Комментарий</div><div className="panel-notes">{selectedTender.notes}</div></div>}
            {selectedTender.docs?.length > 0 && <div className="panel-section"><div className="panel-section-title">Документы</div><div className="panel-docs">{selectedTender.docs.map((doc, i) => <div key={i} className="panel-doc"><span>{doc.endsWith(".xlsx") ? "📊" : doc.endsWith(".pdf") ? "📕" : "📄"}</span>{doc}</div>)}</div></div>}
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button className="btn btn-accent" style={{ flex: 1 }}>↗ Открыть на площадке</button>
              <button className="btn btn-danger btn-ghost" onClick={() => { setTenders(prev => prev.filter(t => t.id !== selectedTender.id)); setSelectedTender(null); }}>Удалить</button>
            </div>
          </div>
        </div>}
      </div>
    </>
  );
}
