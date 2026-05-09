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
    <section class="week-section" id="week-${index + 1}">
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

function renderHtml(plan) {
  const updatedAt = formatGeneratedAt(plan.metadata.generatedAt);
  const period = planPeriod(plan);

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(plan.metadata.title)}</title>
    <link rel="stylesheet" href="assets/site.css">
  </head>
  <body>
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
      </div>
    </header>

    <main>
      <nav class="week-nav" aria-label="Danh sách tuần">
        ${plan.weeks
          .map(
            (week, index) =>
              `<a href="#week-${index + 1}">Tuần ${index + 1}<span>${escapeHtml(
                week.startDate
              )}</span></a>`
          )
          .join("")}
      </nav>

      <div class="toolbar">
        <p id="today-status">Đang kiểm tra ngày hôm nay...</p>
        <button type="button" id="print-button">In / lưu PDF</button>
      </div>

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
fs.copyFileSync(jsPath, path.join(siteAssetsDir, "site.js"));
fs.writeFileSync(path.join(siteDir, ".nojekyll"), "");

console.log(`Rendered ${path.relative(rootDir, siteDir)}.`);
