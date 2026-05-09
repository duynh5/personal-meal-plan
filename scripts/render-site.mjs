import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const siteDir = path.join(rootDir, "site");
const siteAssetsDir = path.join(siteDir, "assets");
const planPath = path.join(rootDir, "meal-plan.json");
const cssPath = path.join(rootDir, "assets", "site.css");
const jsPath = path.join(rootDir, "assets", "site.js");
const allowedGroups = new Set(["fish", "beefPork", "chickenEgg", "vegetarian"]);
const allowedStarches = new Set(["rice", "noodle", "porridge"]);

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

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

function assertString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
  }
}

function assertNullableString(value, path, errors) {
  if (value !== null && (typeof value !== "string" || value.trim() === "")) {
    errors.push(`${path} must be null or a non-empty string.`);
  }
}

function assertIsoDate(value, path, errors) {
  assertString(value, path, errors);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${path} must use YYYY-MM-DD format.`);
    return;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    errors.push(`${path} must be a valid calendar date.`);
  }
}

function listWeekdaysInMonth(year, month) {
  const dates = [];
  const lastDay = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const weekday = date.getUTCDay();

    if (weekday >= 1 && weekday <= 5) {
      dates.push(toIsoDate(date));
    }
  }

  return dates;
}

function validatePlan(plan) {
  const errors = [];
  const seenDates = new Set();
  let previousPlanDate = null;

  if (!plan || typeof plan !== "object") {
    throw new Error("meal-plan.json must contain an object.");
  }

  const metadata = plan.metadata;
  if (!metadata || typeof metadata !== "object") {
    errors.push("metadata must be an object.");
  } else {
    assertString(metadata.title, "metadata.title", errors);
    assertString(metadata.generatedAt, "metadata.generatedAt", errors);
    if (Number.isNaN(new Date(metadata.generatedAt).getTime())) {
      errors.push("metadata.generatedAt must be a valid date-time.");
    }
    if (!Number.isInteger(metadata.month) || metadata.month < 1 || metadata.month > 12) {
      errors.push("metadata.month must be an integer from 1 to 12.");
    }
    if (!Number.isInteger(metadata.year)) {
      errors.push("metadata.year must be an integer.");
    }
  }

  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    errors.push("weeks must be a non-empty array.");
  } else {
    for (const [weekIndex, week] of plan.weeks.entries()) {
      const weekPath = `weeks[${weekIndex}]`;
      if (!week || typeof week !== "object") {
        errors.push(`${weekPath} must be an object.`);
        continue;
      }

      assertString(week.startDate, `${weekPath}.startDate`, errors);
      assertString(week.endDate, `${weekPath}.endDate`, errors);
      if (!Array.isArray(week.notes)) {
        errors.push(`${weekPath}.notes must be an array.`);
      } else {
        for (const [noteIndex, note] of week.notes.entries()) {
          assertString(note, `${weekPath}.notes[${noteIndex}]`, errors);
        }
      }
      if (!Array.isArray(week.days) || week.days.length === 0) {
        errors.push(`${weekPath}.days must be a non-empty array.`);
        continue;
      }
      const firstDay = week.days[0];
      const lastDay = week.days[week.days.length - 1];

      if (firstDay && week.startDate !== firstDay.displayDate) {
        errors.push(`${weekPath}.startDate must match the first day displayDate.`);
      }
      if (lastDay && week.endDate !== lastDay.displayDate) {
        errors.push(`${weekPath}.endDate must match the last day displayDate.`);
      }
      if (firstDay && lastDay && week.title !== `Tuần ${firstDay.displayDate} - ${lastDay.displayDate}`) {
        errors.push(`${weekPath}.title must match the week date range.`);
      }

      for (const [dayIndex, day] of week.days.entries()) {
        const dayPath = `${weekPath}.days[${dayIndex}]`;
        if (!day || typeof day !== "object") {
          errors.push(`${dayPath} must be an object.`);
          continue;
        }

        assertIsoDate(day.date, `${dayPath}.date`, errors);
        if (typeof day.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
          if (seenDates.has(day.date)) {
            errors.push(`${dayPath}.date duplicates ${day.date}.`);
          }
          seenDates.add(day.date);
          if (previousPlanDate && day.date <= previousPlanDate) {
            errors.push(`${dayPath}.date must be later than the previous planned day.`);
          }
          previousPlanDate = day.date;
        }
        for (const field of ["displayDate", "weekday", "lunarDate", "main", "groupLabel"]) {
          assertString(day[field], `${dayPath}.${field}`, errors);
        }
        if (!allowedGroups.has(day.group)) {
          errors.push(`${dayPath}.group must be one of: ${[...allowedGroups].join(", ")}.`);
        }
        if (!allowedStarches.has(day.starch)) {
          errors.push(`${dayPath}.starch must be one of: ${[...allowedStarches].join(", ")}.`);
        }
        for (const field of ["soup", "side"]) {
          assertNullableString(day[field], `${dayPath}.${field}`, errors);
        }
        if (day.starch === "rice" && day.vegetarianDay !== true && (!day.soup || !day.side)) {
          errors.push(`${dayPath} rice meal must include soup and side.`);
        }
        if ((day.starch !== "rice" || day.vegetarianDay === true) && (day.soup || day.side)) {
          errors.push(`${dayPath} non-rice or vegetarian meal must not include soup or side.`);
        }
        if (typeof day.vegetarianDay !== "boolean") {
          errors.push(`${dayPath}.vegetarianDay must be a boolean.`);
        }
      }
    }
  }

  if (
    metadata &&
    typeof metadata === "object" &&
    Number.isInteger(metadata.month) &&
    Number.isInteger(metadata.year)
  ) {
    const expectedDates = listWeekdaysInMonth(metadata.year, metadata.month);
    for (const date of expectedDates) {
      if (!seenDates.has(date)) {
        errors.push(`meal-plan.json is missing weekday ${date}.`);
      }
    }
    for (const date of seenDates) {
      if (!expectedDates.includes(date)) {
        errors.push(`meal-plan.json includes unexpected date ${date}.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid meal plan data:\n- ${errors.join("\n- ")}`);
  }
}

function renderDay(day) {
  const tags = [
    `<span class="tag">${escapeHtml(day.groupLabel)}</span>`,
    `<span class="tag tag-muted">${escapeHtml(day.lunarDate)}</span>`
  ];

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
        <div>
          <dt>Món chính</dt>
          <dd>${escapeHtml(day.main)}</dd>
        </div>
        ${
          day.soup
            ? `<div><dt>Canh</dt><dd>${escapeHtml(day.soup)}</dd></div>`
            : ""
        }
        ${
          day.side
            ? `<div><dt>Xào/luộc</dt><dd>${escapeHtml(day.side)}</dd></div>`
            : ""
        }
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

function renderHtml(plan) {
  const updatedAt = formatGeneratedAt(plan.metadata.generatedAt);

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
        <p class="eyebrow">Bữa tối gia đình</p>
        <h1>${escapeHtml(plan.metadata.title)}</h1>
        <p class="header-subtitle">Lịch ăn từ thứ 2 đến thứ 6, tự động cập nhật mỗi tháng.</p>
      </div>
      <div class="header-panel" aria-label="Thông tin kế hoạch">
        <div>
          <span>Tháng</span>
          <strong>${String(plan.metadata.month).padStart(2, "0")}/${plan.metadata.year}</strong>
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
      <p>Chỉ bữa cơm mới có canh và món xào/luộc. Bún, mì, cháo, bánh canh chỉ ghi món chính.</p>
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
