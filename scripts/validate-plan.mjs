import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lunarDateLabel, solarToLunar } from "./lunar.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(scriptPath);
const rootDir = path.resolve(__dirname, "..");
const planPath = path.join(rootDir, "meal-plan.json");
const menuPath = path.join(rootDir, "data", "menu.json");
const menu = JSON.parse(fs.readFileSync(menuPath, "utf8"));
const breakfastNames = new Set(Array.isArray(menu.breakfasts) ? menu.breakfasts : []);
const mainsByName = new Map((Array.isArray(menu.mains) ? menu.mains : []).map((dish) => [dish.name, dish]));
const soupNames = new Set(Array.isArray(menu.soups) ? menu.soups : []);
const sideNames = new Set(Array.isArray(menu.sides) ? menu.sides : []);

const weekdayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const allowedGroups = new Set(["fish", "beefPork", "chickenEgg", "vegetarian"]);
const allowedStarches = new Set(["rice", "noodle", "porridge"]);
const groupLabels = new Map([
  ["fish", "Cá"],
  ["beefPork", "Bò/heo"],
  ["chickenEgg", "Gà/trứng"],
  ["vegetarian", "Chay"]
]);
const rollingWeekCount = 4;
const weekdaysPerWeek = 5;
const fullWeekGroupCounts = new Map([
  ["fish", 2],
  ["beefPork", 2],
  ["chickenEgg", 1]
]);
const fullWeekStapleCount = 3;
const fullWeekNoodleCount = 2;

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toDisplayDate(date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}/${date.getUTCFullYear()}`;
}

function countBy(items, field) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item[field], (counts.get(item[field]) ?? 0) + 1);
  }
  return counts;
}

function assertCount(counts, expectedCounts, label, errors) {
  for (const [key, expected] of expectedCounts) {
    const actual = counts.get(key) ?? 0;
    if (actual !== expected) {
      errors.push(`${label} expected ${expected} ${key} entries, found ${actual}.`);
    }
  }
}

function assertMaxCount(counts, maximumCounts, label, errors) {
  for (const [key, maximum] of maximumCounts) {
    const actual = counts.get(key) ?? 0;
    if (actual > maximum) {
      errors.push(`${label} expected at most ${maximum} ${key} entries, found ${actual}.`);
    }
  }
}

function assertFullWeekStarches(days, label, errors) {
  const stapleCount = days.filter((day) => day.starch === "rice" || day.starch === "porridge").length;
  const noodleCount = days.filter((day) => day.starch === "noodle").length;

  if (stapleCount !== fullWeekStapleCount) {
    errors.push(`${label} expected ${fullWeekStapleCount} rice or porridge entries, found ${stapleCount}.`);
  }
  if (noodleCount !== fullWeekNoodleCount) {
    errors.push(`${label} expected ${fullWeekNoodleCount} noodle entries, found ${noodleCount}.`);
  }
}

function expectedVegetarianNote(days) {
  const vegetarianDays = days.filter((day) => day.vegetarianDay);

  if (vegetarianDays.length === 0) {
    return "Không có ngày chay mùng 1 hoặc rằm âm lịch trong các ngày ăn của tuần.";
  }

  return `Có ngày chay âm lịch: ${vegetarianDays
    .map((day) => `${day.weekday} ${day.displayDate}`)
    .join(", ")}.`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
}

function isValidDateTime(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
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

export function validatePlan(plan) {
  const errors = [];
  const seenDates = new Set();
  let previousPlanDate = null;
  let rangeStart = null;
  let rangeEnd = null;

  if (!plan || typeof plan !== "object") {
    throw new Error("meal-plan.json must contain an object.");
  }
  if (!plan.metadata || typeof plan.metadata !== "object") {
    throw new Error("meal-plan.json metadata must be an object.");
  }
  if (!isNonEmptyString(plan.metadata.title)) {
    errors.push("metadata.title must be a non-empty string.");
  }
  if (plan.metadata.timezone !== "Asia/Ho_Chi_Minh") {
    errors.push('metadata.timezone must be "Asia/Ho_Chi_Minh".');
  }
  if (!isNonEmptyString(plan.metadata.generatedAt)) {
    errors.push("metadata.generatedAt must be a non-empty string.");
  } else if (!isValidDateTime(plan.metadata.generatedAt)) {
    errors.push("metadata.generatedAt must be a valid date-time.");
  }
  rangeStart = parseIsoDate(plan.metadata.startDate);
  rangeEnd = parseIsoDate(plan.metadata.endDate);
  if (!rangeStart) {
    errors.push("metadata.startDate must be a valid YYYY-MM-DD date.");
  }
  if (!rangeEnd) {
    errors.push("metadata.endDate must be a valid YYYY-MM-DD date.");
  }
  if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
    errors.push("metadata.startDate must not be after metadata.endDate.");
  } else if (rangeStart && rangeEnd) {
    const expectedEndDate = addDays(rangeStart, rollingWeekCount * 7 - 1);
    const expectedTitle = `Kế hoạch ăn 4 tuần từ ${toDisplayDate(rangeStart)}`;
    if (rangeStart.getUTCDay() !== 1) {
      errors.push("metadata.startDate must be a Monday.");
    }
    if (plan.metadata.title !== expectedTitle) {
      errors.push(`metadata.title must be "${expectedTitle}".`);
    }
    if (toIsoDate(rangeEnd) !== toIsoDate(expectedEndDate)) {
      errors.push(`metadata.endDate must be ${toIsoDate(expectedEndDate)} for a 4-week rolling plan.`);
    }
  }
  if (!Array.isArray(plan.weeks)) {
    throw new Error("meal-plan.json weeks must be an array.");
  } else if (plan.weeks.length !== rollingWeekCount) {
    errors.push(`weeks must contain exactly ${rollingWeekCount} weeks.`);
  }

  for (const [weekIndex, week] of plan.weeks.entries()) {
    const weekLabel = `weeks[${weekIndex}]`;
    if (!week || typeof week !== "object") {
      errors.push(`${weekLabel} must be an object.`);
      continue;
    }
    for (const field of ["startDate", "endDate", "title"]) {
      if (!isNonEmptyString(week[field])) {
        errors.push(`${weekLabel}.${field} must be a non-empty string.`);
      }
    }
    if (!Array.isArray(week.notes)) {
      errors.push(`${weekLabel}.notes must be an array.`);
    } else {
      for (const [noteIndex, note] of week.notes.entries()) {
        if (!isNonEmptyString(note)) {
          errors.push(`${weekLabel}.notes[${noteIndex}] must be a non-empty string.`);
        }
      }
    }
    if (!Array.isArray(week.days) || week.days.length === 0) {
      errors.push(`${weekLabel}.days must be a non-empty array.`);
      continue;
    }
    if (week.days.length !== weekdaysPerWeek) {
      errors.push(`${weekLabel}.days must contain exactly ${weekdaysPerWeek} weekdays.`);
    }

    const fullWeek = week.days.length === 5;
    let hasVegetarianMain = false;
    const weeklyBreakfasts = new Set();
    const duplicateRestrictedDishes = new Set();
    const firstDay = week.days[0];
    const lastDay = week.days[week.days.length - 1];

    if (firstDay && week.startDate !== firstDay.displayDate) {
      errors.push(`${weekLabel}.startDate must match the first day displayDate.`);
    }
    if (lastDay && week.endDate !== lastDay.displayDate) {
      errors.push(`${weekLabel}.endDate must match the last day displayDate.`);
    }
    if (firstDay && lastDay && week.title !== `Tuần ${firstDay.displayDate} - ${lastDay.displayDate}`) {
      errors.push(`${weekLabel}.title must match the week date range.`);
    }

    for (const [dayIndex, day] of week.days.entries()) {
      const dayLabel = `${weekLabel}.days[${dayIndex}]`;
      if (!day || typeof day !== "object") {
        errors.push(`${dayLabel} must be an object.`);
        continue;
      }
      const date = parseIsoDate(day.date);

      if (!date) {
        errors.push(`${dayLabel}.date must be a valid YYYY-MM-DD date.`);
        continue;
      }

      if (seenDates.has(day.date)) {
        errors.push(`${dayLabel}.date duplicates ${day.date}.`);
      }
      seenDates.add(day.date);
      if (previousPlanDate && day.date <= previousPlanDate) {
        errors.push(`${dayLabel}.date must be later than the previous planned day.`);
      }
      previousPlanDate = day.date;

      const weekday = date.getUTCDay();
      if (weekday < 1 || weekday > 5) {
        errors.push(`${dayLabel}.date must be Monday through Friday.`);
      }
      if (day.weekday !== weekdayNames[weekday]) {
        errors.push(`${dayLabel}.weekday does not match ${day.date}.`);
      }
      if (day.displayDate !== toDisplayDate(date)) {
        errors.push(`${dayLabel}.displayDate does not match ${day.date}.`);
      }
      if (
        rangeStart &&
        rangeEnd &&
        (date < rangeStart || date > rangeEnd)
      ) {
        errors.push(`${dayLabel}.date is outside the metadata date range.`);
      }

      const lunar = solarToLunar(date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear());
      const isVegetarianLunarDay = lunar.day === 1 || lunar.day === 15;
      if (day.vegetarianDay !== isVegetarianLunarDay) {
        errors.push(`${dayLabel}.vegetarianDay does not match lunar day ${lunar.day}.`);
      }
      if (day.lunarDate !== lunarDateLabel(date)) {
        errors.push(`${dayLabel}.lunarDate does not match ${day.date}.`);
      }
      if (!isNonEmptyString(day.breakfast)) {
        errors.push(`${dayLabel}.breakfast must be a non-empty string.`);
      } else {
        if (!breakfastNames.has(day.breakfast)) {
          errors.push(`${dayLabel}.breakfast must exist in data/menu.json.`);
        }
        if (weeklyBreakfasts.has(day.breakfast)) {
          errors.push(`${dayLabel}.breakfast repeats "${day.breakfast}" in the same week.`);
        }
        weeklyBreakfasts.add(day.breakfast);
      }
      if (!isNonEmptyString(day.main)) {
        errors.push(`${dayLabel}.main must be a non-empty string.`);
      } else if (!mainsByName.has(day.main)) {
        errors.push(`${dayLabel}.main must exist in data/menu.json.`);
      } else {
        const menuDish = mainsByName.get(day.main);
        if (day.group !== menuDish.group || day.starch !== menuDish.starch) {
          errors.push(`${dayLabel}.main metadata must match data/menu.json.`);
        }
      }
      if (day.vegetarianDay) {
        if (day.group !== "vegetarian" || day.groupLabel !== "Chay") {
          errors.push(`${dayLabel} must use a vegetarian main on vegetarian lunar days.`);
        }
      }
      if (day.group === "vegetarian") {
        hasVegetarianMain = true;
      }
      if (!allowedGroups.has(day.group)) {
        errors.push(`${dayLabel}.group must be one of: ${[...allowedGroups].join(", ")}.`);
      } else if (day.groupLabel !== groupLabels.get(day.group)) {
        errors.push(`${dayLabel}.groupLabel must match group "${day.group}".`);
      }
      if (!allowedStarches.has(day.starch)) {
        errors.push(`${dayLabel}.starch must be one of: ${[...allowedStarches].join(", ")}.`);
      }
      if (day.group === "beefPork" || day.group === "chickenEgg") {
        if (duplicateRestrictedDishes.has(day.main)) {
          errors.push(`${dayLabel} repeats "${day.main}" in the same week.`);
        }
        duplicateRestrictedDishes.add(day.main);
      }

      if (day.starch === "rice" && !day.vegetarianDay && (!day.soup || !day.side)) {
        errors.push(`${dayLabel} rice meal must include soup and side.`);
      }
      for (const field of ["soup", "side"]) {
        if (day[field] !== null && !isNonEmptyString(day[field])) {
          errors.push(`${dayLabel}.${field} must be null or a non-empty string.`);
        }
      }
      if (isNonEmptyString(day.soup) && !soupNames.has(day.soup)) {
        errors.push(`${dayLabel}.soup must exist in data/menu.json.`);
      }
      if (isNonEmptyString(day.side) && !sideNames.has(day.side)) {
        errors.push(`${dayLabel}.side must exist in data/menu.json.`);
      }
      if ((day.starch !== "rice" || day.vegetarianDay) && (day.soup || day.side)) {
        errors.push(`${dayLabel} non-rice or vegetarian meal must not include soup or side.`);
      }
    }

    if (fullWeek) {
      const groupCounts = countBy(week.days, "group");
      const vegetarianNote = expectedVegetarianNote(week.days);
      if (Array.isArray(week.notes) && !week.notes.includes(vegetarianNote)) {
        errors.push(`${weekLabel}.notes must include "${vegetarianNote}".`);
      }
      if (hasVegetarianMain) {
        assertMaxCount(groupCounts, fullWeekGroupCounts, weekLabel, errors);
      } else {
        assertCount(groupCounts, fullWeekGroupCounts, weekLabel, errors);
      }
      assertFullWeekStarches(week.days, weekLabel, errors);
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
    throw new Error(`Invalid meal plan:\n- ${errors.join("\n- ")}`);
  }
}

if (process.argv[1] === scriptPath) {
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  validatePlan(plan);
  console.log("Validated meal-plan.json.");
}
