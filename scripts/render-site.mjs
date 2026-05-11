import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePlan } from "./validate-plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const siteDir = path.join(rootDir, "site");
const siteAssetsDir = path.join(siteDir, "assets");
const planPath = path.join(rootDir, "meal-plan.json");
const cssPath = path.join(rootDir, "assets", "site.css");
const themeCssPath = path.join(rootDir, "assets", "site-theme.css");
const jsPath = path.join(rootDir, "assets", "site.js");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatGeneratedAt(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderDay(day) {
  const tags = [
    `<span class="tag">${escapeHtml(day.groupLabel)}</span>`,
    `<span class="tag tag-muted">${escapeHtml(day.lunarDate)}</span>`
  ];
  const details = [
    day.soup ? `<div class="meal-list__item meal-list__soup"><dt>Canh</dt><dd>${escapeHtml(day.soup)}</dd></div>` : "",
    day.side ? `<div class="meal-list__item meal-list__side"><dt>Xào/luộc</dt><dd>${escapeHtml(day.side)}</dd></div>` : ""
  ]
    .filter(Boolean)
    .map((detail) => `\n        ${detail}`)
    .join("");

  if (day.vegetarianDay) {
    tags.push('<span class="tag tag-veg">Ngày chay</span>');
  }

  return `
    <article class="day-card" data-date="${escapeHtml(day.date)}">
      <div class="day-card__top">
        <div>
          <p class="day-card__weekday">${escapeHtml(day.weekday)}</p>
          <h3>${escapeHtml(day.displayDate)}</h3>
        </div>
        <div class="day-card__tags">${tags.join("")}</div>
      </div>
      <dl class="meal-list">
        <div class="meal-list__item meal-list__breakfast">
          <dt>Bữa sáng</dt>
          <dd>${escapeHtml(day.breakfast)}</dd>
        </div>
        <div class="meal-list__item meal-list__dinner">
          <dt>Bữa tối</dt>
          <dd>${escapeHtml(day.main)}</dd>
        </div>${details}
      </dl>
    </article>
  `;
}

function renderWeek(week, index) {
  return `
    <section class="week-section" id="week-${index + 1}" data-week="week-${index + 1}">
      <div class="week-heading">
        <div>
          <p class="eyebrow">Tuần ${index + 1}</p>
          <h2>${escapeHtml(week.startDate)} - ${escapeHtml(week.endDate)}</h2>
        </div>
        <a class="week-link" href="#week-${index + 1}">Mở tuần</a>
      </div>
      <ul class="notes">
        ${week.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
      <div class="day-grid">
        ${week.days.map(renderDay).join("")}
      </div>
    </section>
  `;
}

function displayIsoDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function planPeriod(plan) {
  return {
    label: "Giai đoạn",
    value: `${displayIsoDate(plan.metadata.startDate)} - ${displayIsoDate(plan.metadata.endDate)}`
  };
}

function planSummary(plan) {
  const days = plan.weeks.flatMap((week) => week.days);
  const vegetarianDays = days.filter((day) => day.vegetarianDay).length;
  const riceDinners = days.filter((day) => day.main.toLowerCase().includes("cơm")).length;

  return `${vegetarianDays} ngày chay · ${riceDinners} bữa cơm`;
}

function renderHtml(plan) {
  const updatedAt = formatGeneratedAt(plan.metadata.generatedAt);
  const period = planPeriod(plan);
  const summary = planSummary(plan);

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(plan.metadata.title)}</title>
    <link rel="stylesheet" href="assets/site.css">
    <link rel="stylesheet" href="assets/site-theme.css">
  </head>
  <body>
    <a class="skip-link" href="#main-content">Đến nội dung chính</a>
    <header class="page-header">
      <div class="header-copy">
        <p class="eyebrow">Bữa sáng và bữa tối gia đình</p>
        <h1>${escapeHtml(plan.metadata.title)}</h1>
        <p class="header-subtitle">Lịch ăn từ thứ 2 đến thứ 6, tự động cập nhật theo chu kỳ 4 tuần.</p>
      </div>
      <div class="header-panel" aria-label="Thông tin kế hoạch">
        <div>
          <span>${escapeHtml(period.label)}</span>
          <strong>${escapeHtml(period.value)}</strong>
        </div>
        <div>
          <span>Cập nhật</span>
          <strong>${escapeHtml(updatedAt)}</strong>
        </div>
        <div>
          <span>Tóm tắt</span>
          <strong>${escapeHtml(summary)}</strong>
        </div>
      </div>
    </header>

    <main id="main-content">
      <nav class="week-nav" aria-label="Danh sách tuần">
        ${plan.weeks
          .map(
            (week, index) =>
              `<a class="week-nav__link" data-week-target="week-${index + 1}" href="#week-${index + 1}">Tuần ${index + 1}<span>${escapeHtml(
                week.startDate
              )}</span></a>`
          )
          .join("")}
      </nav>

      <div class="toolbar">
        <p id="today-status">Đang kiểm tra ngày hôm nay...</p>
        <div class="toolbar-actions">
          <button type="button" id="today-button">Đến hôm nay</button>
          <button type="button" id="top-button">Lên đầu trang</button>
          <button type="button" id="print-button">In / lưu PDF</button>
        </div>
      </div>

      <section class="legend" aria-label="Chú thích màu món ăn">
        <h2>Chú thích</h2>
        <ul>
          <li class="legend__breakfast">Bữa sáng</li>
          <li class="legend__dinner">Bữa tối</li>
          <li class="legend__soup">Canh</li>
          <li class="legend__side">Xào/luộc</li>
        </ul>
      </section>

      ${plan.weeks.map(renderWeek).join("")}
    </main>

    <footer class="page-footer">
      <p>Bữa sáng không trùng trong cùng tuần. Chỉ bữa cơm tối mới có canh và món xào/luộc.</p>
    </footer>

    <script src="assets/site.js"></script>
  </body>
</html>
`;
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
validatePlan(plan);

fs.mkdirSync(siteAssetsDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, "index.html"), renderHtml(plan));
fs.copyFileSync(planPath, path.join(siteDir, "meal-plan.json"));
fs.copyFileSync(cssPath, path.join(siteAssetsDir, "site.css"));
fs.copyFileSync(themeCssPath, path.join(siteAssetsDir, "site-theme.css"));
fs.copyFileSync(jsPath, path.join(siteAssetsDir, "site.js"));
fs.writeFileSync(path.join(siteDir, ".nojekyll"), "");

console.log(`Rendered ${path.relative(rootDir, siteDir)}.`);
