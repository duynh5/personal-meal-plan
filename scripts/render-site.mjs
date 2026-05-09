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
const weekdayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const allowedGroups = new Set(["fish", "beefPork", "chickenEgg", "vegetarian"]);
const allowedStarches = new Set(["rice", "noodle", "porridge"]);
const rollingWeekCount = 4;
const weekdaysPerWeek = 5;

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

function parseIsoDate(value, path, errors) {
  assertString(value, path, errors);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${path} must use YYYY-MM-DD format.`);
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    errors.push(`${path} must be a valid calendar date.`);
    return null;
  }

  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function listWeekdaysInRange(startDate, endDate) {
  const dates = [];

  for (let date = startDate; date <= endDate; date.setUTCDate(date.getUTCDate() + 1)) {
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
  let rangeStart = null;
  let rangeEnd = null;

  if (!plan || typeof plan !== "object") {
    throw new Error("meal-plan.json must contain an object.");
  }

  const metadata = plan.metadata;
  if (!metadata || typeof metadata !== "object") {
    errors.push("metadata must be an object.");
  } else {
    assertString(metadata.title, "metadata.title", errors);
    if (metadata.timezone !== "Asia/Ho_Chi_Minh") {
      errors.push('metadata.timezone must be "Asia/Ho_Chi_Minh".');
    }
    assertString(metadata.generatedAt, "metadata.generatedAt", errors);
    if (Number.isNaN(new Date(metadata.generatedAt).getTime())) {
      errors.push("metadata.generatedAt must be a valid date-time.");
    }
    rangeStart = parseIsoDate(metadata.startDate, "metadata.startDate", errors);
    rangeEnd = parseIsoDate(metadata.endDate, "metadata.endDate", errors);
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      errors.push("metadata.startDate must not be after metadata.endDate.");
    } else if (rangeStart && rangeEnd) {
      const expectedEndDate = addDays(rangeStart, rollingWeekCount * 7 - 1);
      if (rangeStart.getUTCDay() !== 1) {
        errors.push("metadata.startDate must be a Monday.");
      }
      if (toIsoDate(rangeEnd) !== toIsoDate(expectedEndDate)) {
        errors.push(`metadata.endDate must be ${toIsoDate(expectedEndDate)} for a 4-week rolling plan.`);
      }
    }
  }

  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    errors.push("weeks must be a non-empty array.");
  } else {
    if (plan.weeks.length !== rollingWeekCount) {
      errors.push(`weeks must contain exactly ${rollingWeekCount} weeks.`);
    }
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

        const date = parseIsoDate(day.date, `${dayPath}.date`, errors);
        if (date) {
          if (seenDates.has(day.date)) {
            errors.push(`${dayPath}.date duplicates ${day.date}.`);
          }
          seenDates.add(day.date);
          if (previousPlanDate && day.date <= previousPlanDate) {
            errors.push(`${dayPath}.date must be later than the previous planned day.`);
          }
          previousPlanDate = day.date;
          if (day.weekday !== weekdayNames[date.getUTCDay()]) {
            errors.push(`${dayPath}.weekday does not match ${day.date}.`);
          }
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
        if (day.vegetarianDay === true && (day.group !== "vegetarian" || day.groupLabel !== "Chay")) {
          errors.push(`${dayPath} must use a vegetarian main on vegetarian lunar days.`);
        }
      }
    }
  }

  if (rangeStart && rangeEnd) {
    const expectedDates = listWeekdaysInRange(new Date(rangeStart), new Date(rangeEnd));
    if (expectedDates.length !== rollingWeekCount * weekdaysPerWeek) {
      errors.push(`metadata date range must contain exactly ${rollingWeekCount * weekdaysPerWeek} weekdays.`);
    }
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
        <p class="eyebrow">Bữa tối gia đình</p>
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
