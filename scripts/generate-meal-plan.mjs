import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lunarDateLabel, solarToLunar } from "./lunar.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const menuPath = path.join(rootDir, "data", "menu.json");
const outputJsonPath = path.join(rootDir, "meal-plan.json");
const outputMdPath = path.join(rootDir, "meal-plan.md");
const timeZone = "Asia/Ho_Chi_Minh";
const vietnamUtcOffset = 7;

const weekdayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const groupLabels = {
  fish: "Cá",
  beefPork: "Bò/heo",
  chickenEgg: "Gà/trứng",
  vegetarian: "Chay"
};
const allowedStarches = new Set(["rice", "noodle", "porridge"]);
const fullWeekPatterns = [
  [
    ["fish", "rice"],
    ["beefPork", "noodle"],
    ["chickenEgg", "rice"],
    ["fish", "noodle"],
    ["beefPork", "rice"]
  ],
  [
    ["beefPork", "rice"],
    ["fish", "noodle"],
    ["chickenEgg", "rice"],
    ["beefPork", "noodle"],
    ["fish", "rice"]
  ]
];
const menu = JSON.parse(fs.readFileSync(menuPath, "utf8"));

function pad(number) {
  return String(number).padStart(2, "0");
}

function toIsoDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function toDisplayDate(date) {
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

function makeUtcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function validateTargetMonth({ year, month }, source) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid target month${source ? ` from ${source}` : ""}: ${year}-${pad(month)}.`);
  }
}

function validateMenu() {
  const errors = [];
  const allowedGroups = new Set(Object.keys(groupLabels));
  const requiredGroupStarches = new Set(
    fullWeekPatterns.flat().map(([group, starch]) => `${group}:${starch}`)
  );
  const mains = Array.isArray(menu.mains) ? menu.mains : [];
  const soups = Array.isArray(menu.soups) ? menu.soups : [];
  const sides = Array.isArray(menu.sides) ? menu.sides : [];

  if (!Array.isArray(menu.mains) || menu.mains.length === 0) {
    errors.push("data/menu.json must include a non-empty mains array.");
  }
  if (!Array.isArray(menu.soups) || menu.soups.length === 0) {
    errors.push("data/menu.json must include a non-empty soups array.");
  }
  if (!Array.isArray(menu.sides) || menu.sides.length === 0) {
    errors.push("data/menu.json must include a non-empty sides array.");
  }

  const mainNames = new Set();
  for (const [index, dish] of mains.entries()) {
    const label = `mains[${index}]`;
    if (!dish || typeof dish !== "object") {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (typeof dish.name !== "string" || dish.name.trim() === "") {
      errors.push(`${label}.name must be a non-empty string.`);
    } else if (mainNames.has(dish.name)) {
      errors.push(`${label}.name duplicates "${dish.name}".`);
    } else {
      mainNames.add(dish.name);
    }
    if (!allowedGroups.has(dish.group)) {
      errors.push(`${label}.group must be one of: ${[...allowedGroups].join(", ")}.`);
    }
    if (!allowedStarches.has(dish.starch)) {
      errors.push(`${label}.starch must be one of: ${[...allowedStarches].join(", ")}.`);
    }
  }

  for (const key of requiredGroupStarches) {
    const [group, starch] = key.split(":");
    if (!mains.some((dish) => dish.group === group && dish.starch === starch)) {
      errors.push(`data/menu.json needs at least one ${group} main with starch "${starch}".`);
    }
  }
  if (!mains.some((dish) => dish.group === "vegetarian")) {
    errors.push("data/menu.json needs at least one vegetarian main.");
  }

  for (const [field, items] of [
    ["soups", soups],
    ["sides", sides]
  ]) {
    for (const [index, item] of items.entries()) {
      if (typeof item !== "string" || item.trim() === "") {
        errors.push(`${field}[${index}] must be a non-empty string.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid menu data:\n- ${errors.join("\n- ")}`);
  }
}

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function isLastDayInVietnam(date = new Date()) {
  const parts = getVietnamDateParts(date);
  const current = makeUtcDate(Number(parts.year), Number(parts.month), Number(parts.day));
  const tomorrow = addDays(current, 1);

  return current.getUTCMonth() !== tomorrow.getUTCMonth();
}

function parseTargetMonth(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const target = { year: Number(match[1]), month: Number(match[2]) };
    validateTargetMonth(target, value);
    return target;
  }

  match = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (match) {
    const target = { year: Number(match[2]), month: Number(match[1]) };
    validateTargetMonth(target, value);
    return target;
  }

  match = trimmed.match(/^(\d{4})\/(\d{2})$/);
  if (match) {
    const target = { year: Number(match[1]), month: Number(match[2]) };
    validateTargetMonth(target, value);
    return target;
  }

  throw new Error(`Unsupported TARGET_MONTH format: ${value}. Use YYYY-MM or MM/YYYY.`);
}

function nextMonthFromVietnamDate() {
  const parts = getVietnamDateParts();
  let year = Number(parts.year);
  let month = Number(parts.month) + 1;

  if (month === 13) {
    month = 1;
    year += 1;
  }

  return { year, month };
}

function monthName({ month, year }) {
  return `${pad(month)}/${year}`;
}

function listWeekdaysInMonth(year, month) {
  const days = [];
  const lastDay = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();

  for (let day = 1; day <= lastDay; day += 1) {
    const date = makeUtcDate(year, month, day);
    const weekday = date.getUTCDay();

    if (weekday >= 1 && weekday <= 5) {
      days.push(date);
    }
  }

  return days;
}

function weekKeyFor(date) {
  const monday = addDays(date, -(date.getUTCDay() - 1));
  return toIsoDate(monday);
}

function groupByWeek(days) {
  const weeks = [];
  const byKey = new Map();

  for (const date of days) {
    const key = weekKeyFor(date);
    if (!byKey.has(key)) {
      const week = { key, days: [] };
      byKey.set(key, week);
      weeks.push(week);
    }
    byKey.get(key).days.push(date);
  }

  return weeks;
}

function rotateIndex(seed, length) {
  return Math.abs(seed) % length;
}

function findDish(group, starch, seed, usedNames) {
  let options = menu.mains.filter((dish) => dish.group === group && dish.starch === starch);

  if (options.length === 0) {
    options = menu.mains.filter((dish) => dish.group === group);
  }

  const start = rotateIndex(seed, options.length);
  for (let offset = 0; offset < options.length; offset += 1) {
    const dish = options[(start + offset) % options.length];
    const duplicateRestricted = group === "beefPork" || group === "chickenEgg";

    if (!duplicateRestricted || !usedNames.has(dish.name)) {
      return dish;
    }
  }

  return options[start];
}

function isVegetarianLunarDay(date) {
  const lunar = solarToLunar(
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCFullYear(),
    vietnamUtcOffset
  );

  return lunar.day === 1 || lunar.day === 15;
}

function chooseVegetarianDish(seed) {
  const dishes = menu.mains.filter((dish) => dish.group === "vegetarian");
  return dishes[rotateIndex(seed, dishes.length)];
}

function chooseSide(list, seed) {
  return list[rotateIndex(seed, list.length)];
}

function buildDay(date, weekIndex, usedNames) {
  const weekdayIndex = date.getUTCDay() - 1;
  const seed = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const vegetarianDay = isVegetarianLunarDay(date);
  const pattern = fullWeekPatterns[weekIndex % fullWeekPatterns.length];
  const [group, starch] = pattern[weekdayIndex];
  const dish = vegetarianDay
    ? chooseVegetarianDish(seed + weekIndex)
    : findDish(group, starch, seed + weekIndex, usedNames);

  usedNames.add(dish.name);

  const hasRiceSides = !vegetarianDay && dish.starch === "rice";
  return {
    date: toIsoDate(date),
    displayDate: toDisplayDate(date),
    weekday: weekdayNames[date.getUTCDay()],
    lunarDate: lunarDateLabel(date),
    main: dish.name,
    group: dish.group,
    groupLabel: groupLabels[dish.group],
    starch: dish.starch,
    soup: hasRiceSides ? chooseSide(menu.soups, seed + 3) : null,
    side: hasRiceSides ? chooseSide(menu.sides, seed + 7) : null,
    vegetarianDay
  };
}

function buildPlan(target) {
  const weekdays = listWeekdaysInMonth(target.year, target.month);
  const weeks = groupByWeek(weekdays).map((week, weekIndex) => {
    const usedNames = new Set();
    const days = week.days.map((date) => buildDay(date, weekIndex, usedNames));
    const vegetarianDays = days.filter((day) => day.vegetarianDay);
    const notes = [];

    if (days.length < 5) {
      notes.push("Tuần lẻ trong tháng, chỉ lập các ngày thứ 2 đến thứ 6 thuộc tháng này.");
    }
    if (vegetarianDays.length > 0) {
      notes.push(
        `Có ngày chay âm lịch: ${vegetarianDays
          .map((day) => `${day.weekday} ${day.displayDate}`)
          .join(", ")}.`
      );
    } else {
      notes.push("Không có ngày chay mùng 1 hoặc rằm âm lịch trong các ngày ăn của tuần.");
    }

    return {
      startDate: days[0].displayDate,
      endDate: days[days.length - 1].displayDate,
      title: `Tuần ${days[0].displayDate} - ${days[days.length - 1].displayDate}`,
      notes,
      days
    };
  });

  return {
    metadata: {
      title: `Kế hoạch ăn tháng ${monthName(target)}`,
      month: target.month,
      year: target.year,
      timezone: timeZone,
      generatedAt: new Date().toISOString()
    },
    weeks
  };
}

function renderMarkdown(plan) {
  const lines = [`# ${plan.metadata.title}`, ""];

  for (const week of plan.weeks) {
    lines.push(`## ${week.title}`, "");
    for (const note of week.notes) {
      lines.push(`Ghi chú: ${note}`);
    }
    lines.push("");

    for (const day of week.days) {
      lines.push(`### ${day.weekday} - ${day.displayDate}`, "");
      lines.push(`- Ngày âm: ${day.lunarDate}`);
      lines.push(`- ${day.vegetarianDay ? "Món chính" : "Món mặn chính"}: ${day.main}`);
      if (day.soup) {
        lines.push(`- Món canh: ${day.soup}`);
      }
      if (day.side) {
        lines.push(`- Món xào/luộc: ${day.side}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

const inputTarget = process.env.TARGET_MONTH || process.argv[2] || "";
const target = parseTargetMonth(inputTarget) ?? nextMonthFromVietnamDate();
const isManualTarget = Boolean(inputTarget);
validateTargetMonth(target);
validateMenu();

if (!isManualTarget && process.env.FORCE_RUN !== "1" && !isLastDayInVietnam()) {
  console.log("Not the last day of the month in Asia/Ho_Chi_Minh; skipping.");
  process.exit(0);
}

const plan = buildPlan(target);

fs.writeFileSync(outputJsonPath, `${JSON.stringify(plan, null, 2)}\n`);
fs.writeFileSync(outputMdPath, renderMarkdown(plan));
console.log(`Generated ${plan.metadata.title}.`);
