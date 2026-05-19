import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lunarDateLabel, solarToLunar } from "./lunar.mjs";
import { readMenu } from "./meal-plan/menu.mjs";
import { renderMarkdown } from "./meal-plan/render-markdown.mjs";
import { fullWeekGroupPatterns, fullWeekStarchPatterns, groupPatternFor, rotatedStarchPatterns } from "./meal-plan/week-patterns.mjs";
import { readPlanConfig } from "./plan-config.mjs";
import { createWeekDishes, previousWeekDishesFromPlan } from "./week-dishes.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(scriptPath);
const rootDir = path.resolve(__dirname, "..");
const planConfigPath = path.join(rootDir, "data", "plan-config.json");
const menuPath = path.join(rootDir, "data", "menu.json");
const outputJsonPath = path.join(rootDir, "meal-plan.json");
const outputMdPath = path.join(rootDir, "meal-plan.md");
const timeZone = "Asia/Ho_Chi_Minh", vietnamUtcOffset = 7, rollingWeekCount = 4;
const planConfig = readPlanConfig(planConfigPath);
const defaultPlanVariant = process.env.MEAL_PLAN_VARIANT ?? planConfig.mealPlanVariant;

const weekdayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const groupLabels = {
  fish: "Cá",
  beefPork: "Bò/heo",
  chickenEgg: "Gà/trứng",
  vegetarian: "Chay"
};
const allowedStarches = new Set(["rice", "noodle", "porridge"]);
const menu = readMenu(menuPath, {
  allowedGroups: new Set(Object.keys(groupLabels)),
  allowedStarches,
  minimumBreakfasts: 5,
  requiredGroups: new Set(fullWeekGroupPatterns.flat()),
  requiredStarches: new Set(fullWeekStarchPatterns.flat())
});

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

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentVietnamDate(date = new Date()) {
  const parts = getVietnamDateParts(date);

  return makeUtcDate(Number(parts.year), Number(parts.month), Number(parts.day));
}

function assertValidDate(value, label) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date.`);
  }
}

function nextMondayOnOrAfter(date) {
  const weekday = date.getUTCDay();
  const daysUntilMonday = weekday === 1 ? 0 : (8 - weekday) % 7;

  return addDays(date, daysUntilMonday);
}

function listWeekdaysInRange(startDate, endDate) {
  const days = [];

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
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

function seedOffsetFor(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;
  }

  return hash;
}

function chooseRotatedOption(options, seed, isAllowed, isPreferred) {
  const start = rotateIndex(seed, options.length);

  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length];

    if (isAllowed(option) && isPreferred(option)) {
      return option;
    }
  }

  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length];

    if (isAllowed(option)) {
      return option;
    }
  }

  return null;
}

function chooseScoredOption(options, seed, isAllowed, scoreOption) {
  const start = rotateIndex(seed, options.length);
  let bestOption = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length];

    if (!isAllowed(option)) {
      continue;
    }

    const score = scoreOption(option);
    if (score < bestScore) {
      bestOption = option;
      bestScore = score;
    }
  }

  return bestOption;
}

function mainOptionsFor(group, starch) {
  return menu.mains.filter((dish) => dish.group === group && dish.starch === starch);
}

function mainDishScore(dish, usedNames, previousWeekMains) {
  return (usedNames.has(dish.name) ? 1000 : 0) + (previousWeekMains.has(dish.name) ? 500 : 0);
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

function findDish(group, starch, seed, usedNames, previousWeekMains) {
  const starchOptions = mainOptionsFor(group, starch);
  const groupOptions = menu.mains.filter((dish) => dish.group === group);
  const starchDish = chooseScoredOption(
    starchOptions,
    seed,
    () => true,
    (option) => mainDishScore(option, usedNames, previousWeekMains)
  );
  const anyStarchDish = chooseScoredOption(
    groupOptions,
    seed,
    () => true,
    (option) =>
      mainDishScore(option, usedNames, previousWeekMains) + (option.starch === starch ? 0 : 300)
  );
  const dish = anyStarchDish
    && (!starchDish
      || mainDishScore(anyStarchDish, usedNames, previousWeekMains)
        < mainDishScore(starchDish, usedNames, previousWeekMains))
    ? anyStarchDish
    : starchDish;

  if (!dish) {
    throw new Error(`Unable to choose a ${group} main for starch "${starch}".`);
  }

  return dish;
}

function scoreStarchPattern(dates, weekIndex, seedOffset, starchPattern, previousWeekDishes) {
  const groupPattern = groupPatternFor(weekIndex);
  const usedMains = new Set();
  let previousWeekMainRepeats = 0;
  let fallbackStarchChoices = 0;

  for (const [dayIndex, date] of dates.entries()) {
    const seed = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate() + seedOffset;
    const vegetarianDay = isVegetarianLunarDay(date);
    const group = vegetarianDay ? "vegetarian" : groupPattern[dayIndex];
    const starch = starchPattern[dayIndex];
    const dish = vegetarianDay
      ? chooseVegetarianDish(starch, seed + weekIndex, previousWeekDishes.mains)
      : findDish(group, starch, seed + weekIndex, usedMains, previousWeekDishes.mains);

    if (previousWeekDishes.mains.has(dish.name)) {
      previousWeekMainRepeats += 1;
    }
    if (dish.starch !== starch) {
      fallbackStarchChoices += 1;
    }
    usedMains.add(dish.name);
  }

  return previousWeekMainRepeats * 100 + fallbackStarchChoices;
}

function chooseWeekStarchPattern(dates, weekIndex, seedOffset, previousWeekDishes) {
  const seed = dates[0].getUTCFullYear() * 10000 + (dates[0].getUTCMonth() + 1) * 100 + dates[0].getUTCDate() + seedOffset;
  let bestPattern = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const starchPattern of rotatedStarchPatterns(seed + weekIndex * 17)) {
    const score = scoreStarchPattern(dates, weekIndex, seedOffset, starchPattern, previousWeekDishes);

    if (score < bestScore) {
      bestPattern = starchPattern;
      bestScore = score;
    }
    if (bestScore === 0) {
      break;
    }
  }

  return bestPattern;
}

function chooseVegetarianDish(starch, seed, previousWeekMains) {
  const starchOptions = mainOptionsFor("vegetarian", starch);
  const dishes = starchOptions.length > 0
    ? starchOptions
    : menu.mains.filter((dish) => dish.group === "vegetarian");

  return chooseRotatedOption(
    dishes,
    seed,
    () => true,
    (dish) => !previousWeekMains.has(dish.name)
  );
}

function chooseSide(list, seed, weekItems, previousWeekItems, previousSide) {
  return chooseScoredOption(
    list,
    seed,
    () => true,
    (item) =>
      (weekItems.has(item) ? 1000 : 0) +
      (previousWeekItems.has(item) ? 500 : 0) +
      (item === previousSide ? 100 : 0)
  );
}

function chooseSoup(seed, weekSoups, previousWeekSoups, previousSoup) {
  const soup = chooseScoredOption(
    menu.soups,
    seed,
    () => true,
    (item) =>
      (weekSoups.has(item.name) ? 1000 : 0) +
      (previousWeekSoups.has(item.name) ? 500 : 0) +
      (item.name === previousSoup ? 100 : 0) +
      (item.profile === "protein" ? 10 : 0)
  );

  return soup?.name ?? null;
}

function chooseBreakfast(seed, weekDishes, previousWeekBreakfasts, previousBreakfastCategory) {
  const breakfast = chooseScoredOption(
    menu.breakfasts,
    seed,
    (item) => !weekDishes.breakfasts.has(item.name),
    (item) =>
      (previousWeekBreakfasts.has(item.name) ? 1000 : 0) +
      (weekDishes.breakfastCategoryCounts.get(item.category) ?? 0) * 50 +
      (item.category === previousBreakfastCategory ? 10 : 0)
  );

  if (!breakfast) {
    throw new Error("Unable to choose a non-duplicate breakfast for the week.");
  }

  return breakfast.name;
}

export function chooseRotatedOptionForTest(options, seed, isAllowed, isPreferred) {
  return chooseRotatedOption(options, seed, isAllowed, isPreferred);
}

function buildDay(date, weekIndex, seedOffset, weekDishes, previousWeekDishes, group, starch) {
  const seed = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate() + seedOffset;
  const previousBreakfastName = weekDishes.lastBreakfast ?? previousWeekDishes.lastBreakfast;
  const previousBreakfastCategory = menu.breakfastByName.get(previousBreakfastName)?.category;
  const breakfast = chooseBreakfast(
    seed + weekIndex * 11,
    weekDishes,
    previousWeekDishes.breakfasts,
    previousBreakfastCategory
  );
  const vegetarianDay = isVegetarianLunarDay(date);
  const dish = vegetarianDay
    ? chooseVegetarianDish(starch, seed + weekIndex, previousWeekDishes.mains)
    : findDish(group, starch, seed + weekIndex, weekDishes.mains, previousWeekDishes.mains);

  weekDishes.breakfasts.add(breakfast);
  weekDishes.lastBreakfast = breakfast;
  const breakfastCategory = menu.breakfastByName.get(breakfast).category;
  weekDishes.breakfastCategoryCounts.set(
    breakfastCategory,
    (weekDishes.breakfastCategoryCounts.get(breakfastCategory) ?? 0) + 1
  );
  weekDishes.mains.add(dish.name);

  const hasRiceSides = !vegetarianDay && dish.starch === "rice";
  const previousSoup = weekDishes.lastSoup ?? previousWeekDishes.lastSoup;
  const previousSide = weekDishes.lastSide ?? previousWeekDishes.lastSide;
  const soup = hasRiceSides ? chooseSoup(seed + 3, weekDishes.soups, previousWeekDishes.soups, previousSoup) : null;
  const side = hasRiceSides
    ? chooseSide(menu.sides, seed + 7, weekDishes.sides, previousWeekDishes.sides, previousSide)
    : null;

  if (soup) {
    weekDishes.soups.add(soup);
    weekDishes.lastSoup = soup;
  }
  if (side) {
    weekDishes.sides.add(side);
    weekDishes.lastSide = side;
  }

  return {
    date: toIsoDate(date),
    displayDate: toDisplayDate(date),
    weekday: weekdayNames[date.getUTCDay()],
    lunarDate: lunarDateLabel(date),
    breakfast,
    main: dish.name,
    group: dish.group,
    groupLabel: groupLabels[dish.group],
    starch: dish.starch,
    soup,
    side,
    vegetarianDay
  };
}

function buildPlanFromDays(days, metadata, seedOffset, initialPreviousWeekDishes = createWeekDishes()) {
  const weeks = [];
  let previousWeekDishes = initialPreviousWeekDishes;

  for (const [weekIndex, week] of groupByWeek(days).entries()) {
    const weekDishes = createWeekDishes();
    const groupPattern = groupPatternFor(weekIndex);
    const starchPattern = chooseWeekStarchPattern(week.days, weekIndex, seedOffset, previousWeekDishes);
    const days = week.days.map((date, dayIndex) =>
      buildDay(
        date,
        weekIndex,
        seedOffset,
        weekDishes,
        previousWeekDishes,
        groupPattern[dayIndex],
        starchPattern[dayIndex]
      )
    );
    const vegetarianDays = days.filter((day) => day.vegetarianDay);
    const notes = [];

    if (days.length < 5) {
      notes.push("Tuần chưa đủ 5 ngày ăn trong giai đoạn kế hoạch.");
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

    weeks.push({
      startDate: days[0].displayDate,
      endDate: days[days.length - 1].displayDate,
      title: `Tuần ${days[0].displayDate} - ${days[days.length - 1].displayDate}`,
      notes,
      days
    });

    previousWeekDishes = weekDishes;
  }

  return {
    metadata,
    weeks
  };
}

export function buildRollingPlan(runDate = new Date(), options = {}) {
  assertValidDate(runDate, "runDate");

  const startDate = nextMondayOnOrAfter(currentVietnamDate(runDate));
  const endDate = addDays(startDate, rollingWeekCount * 7 - 1);
  const days = listWeekdaysInRange(startDate, endDate);
  const previousWeekDates = new Set(
    listWeekdaysInRange(addDays(startDate, -7), addDays(startDate, -1)).map(toIsoDate)
  );
  const previousWeekDishes = previousWeekDishesFromPlan(options?.previousPlan, previousWeekDates);
  const planVariant = options?.planVariant ?? defaultPlanVariant;
  const seedOffset = seedOffsetFor(planVariant);

  return buildPlanFromDays(days, {
    title: `Kế hoạch ăn 4 tuần từ ${toDisplayDate(startDate)}`,
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
    timezone: timeZone,
    generatedAt: runDate.toISOString(),
    ...(planVariant ? { planVariant: String(planVariant) } : {})
  }, seedOffset, previousWeekDishes);
}

if (process.argv[1] === scriptPath) {
  let previousPlan = null;
  if (fs.existsSync(outputJsonPath)) {
    try {
      previousPlan = JSON.parse(fs.readFileSync(outputJsonPath, "utf8"));
    } catch (error) {
      throw new Error(`Unable to read existing meal-plan.json for previous-week context: ${error.message}`);
    }
  }

  const plan = buildRollingPlan(new Date(), {
    previousPlan,
    planVariant: defaultPlanVariant
  });

  fs.writeFileSync(outputJsonPath, `${JSON.stringify(plan, null, 2)}\n`);
  fs.writeFileSync(outputMdPath, renderMarkdown(plan));
  console.log(`Generated ${plan.metadata.title}.`);
}
