import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { buildRollingPlan } from "./generate-meal-plan.mjs";
import { normalizeMenu, readMenu } from "./meal-plan/menu.mjs";
import { shouldIncludeRiceSides } from "./meal-plan/menu-rules.mjs";
import { validatePlan } from "./validate-plan.mjs";

const validPlan = JSON.parse(fs.readFileSync(new URL("../meal-plan.json", import.meta.url), "utf8"));

function clonePlan() {
  return structuredClone(validPlan);
}

function assertValidationError(plan, pattern) {
  assert.throws(() => validatePlan(plan), pattern);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstDayIsoDate(plan) {
  return plan.weeks[0].days[0].date;
}

function firstRiceDay(week) {
  const day = week.days.find((candidate) => candidate.starch === "rice" && !candidate.vegetarianDay);
  if (!day) {
    throw new Error("Expected at least one non-vegetarian rice day in the week fixture.");
  }

  return day;
}

function firstTwoRiceDays(week) {
  const days = week.days.filter((candidate) => candidate.starch === "rice" && !candidate.vegetarianDay);
  if (days.length < 2) {
    throw new Error("Expected at least two non-vegetarian rice days in the week fixture.");
  }

  return days;
}

const menuOptions = {
  allowedGroups: new Set(["fish", "beefPork", "chickenEgg", "vegetarian"]),
  allowedStarches: new Set(["rice", "noodle", "porridge"]),
  minimumBreakfasts: 5,
  requiredGroups: new Set(["fish", "beefPork", "chickenEgg"]),
  requiredStarches: new Set(["rice", "noodle"])
};

const groupLabels = {
  fish: "Cá",
  beefPork: "Bò/heo",
  chickenEgg: "Gà/trứng",
  vegetarian: "Chay"
};
const actualMenu = readMenu(new URL("../data/menu.json", import.meta.url), menuOptions);

function sidePairForDay(vegetarianDay) {
  const soup = vegetarianDay ? actualMenu.vegetarianSoups[0] : actualMenu.soups[0];
  const side = vegetarianDay ? actualMenu.vegetarianSides[0] : actualMenu.sides[0];

  if (!soup || !side) {
    throw new Error("Expected soup and side fixtures for a rice main.");
  }

  return { soup: soup.name, side: side.name };
}

function assignMain(day, dish) {
  const riceSides = shouldIncludeRiceSides(actualMenu, day.vegetarianDay, dish.starch)
    ? sidePairForDay(day.vegetarianDay)
    : { soup: null, side: null };

  Object.assign(day, {
    main: dish.name,
    group: dish.group,
    groupLabel: groupLabels[dish.group],
    starch: dish.starch,
    ...riceSides
  });
}

function findDryMainForDay(day, usedMains, preferredStarch = day.starch) {
  const candidates = actualMenu.mains.filter(
    (dish) => dish.group === day.group && dish.wateryStarch !== true && !usedMains.has(dish.name)
  );

  return candidates.find((dish) => dish.starch === preferredStarch) ?? candidates[0];
}

function canReplaceStarchWithoutChangingBalance(dish, starch) {
  return dish.starch === starch || ((starch === "rice" || starch === "porridge") && dish.starch === "porridge");
}

function findWateryMainForDay(day, usedMains) {
  return actualMenu.mains.find(
    (dish) =>
      dish.group === day.group &&
      dish.wateryStarch === true &&
      !usedMains.has(dish.name) &&
      canReplaceStarchWithoutChangingBalance(dish, day.starch)
  );
}

function allPlanMains(plan) {
  return new Set(plan.weeks.flatMap((week) => week.days.map((day) => day.main)));
}

function previousDayInPlan(plan, weekIndex, dayIndex) {
  if (dayIndex > 0) {
    return plan.weeks[weekIndex].days[dayIndex - 1];
  }

  return plan.weeks[weekIndex - 1]?.days.at(-1) ?? null;
}

function nextDayInPlan(plan, weekIndex, dayIndex) {
  const week = plan.weeks[weekIndex];
  if (dayIndex < week.days.length - 1) {
    return week.days[dayIndex + 1];
  }

  return plan.weeks[weekIndex + 1]?.days[0] ?? null;
}

function isWateryPlanDay(day) {
  return actualMenu.mainsByName.get(day?.main)?.wateryStarch === true;
}

function ensureWeekHasWateryMain(plan, firstDryDay, secondDryDay) {
  const weekIndex = plan.weeks.findIndex((week) => week.days.includes(firstDryDay));
  const week = plan.weeks[weekIndex];

  if (week.days.some(isWateryPlanDay)) {
    return;
  }

  const usedMains = allPlanMains(plan);
  for (const [dayIndex, day] of week.days.entries()) {
    if (
      day === firstDryDay ||
      day === secondDryDay ||
      day.vegetarianDay ||
      isWateryPlanDay(previousDayInPlan(plan, weekIndex, dayIndex)) ||
      isWateryPlanDay(nextDayInPlan(plan, weekIndex, dayIndex))
    ) {
      continue;
    }

    const replacement = findWateryMainForDay(day, usedMains);
    if (replacement) {
      assignMain(day, replacement);
      return;
    }
  }

  throw new Error("Expected a non-adjacent watery replacement to preserve full-week starch rules.");
}

function findConsecutiveDryNoodleMutation(plan) {
  for (const [weekIndex, week] of plan.weeks.entries()) {
    for (let dayIndex = 0; dayIndex < week.days.length - 1; dayIndex += 1) {
      const firstDay = week.days[dayIndex];
      const secondDay = week.days[dayIndex + 1];
      const previousDay = previousDayInPlan(plan, weekIndex, dayIndex);
      const previousMain = previousDay ? actualMenu.mainsByName.get(previousDay.main) : null;

      if (
        firstDay.vegetarianDay ||
        secondDay.vegetarianDay ||
        firstDay.starch !== "noodle" ||
        secondDay.starch !== "noodle" ||
        previousMain?.wateryStarch === true
      ) {
        continue;
      }

      const usedMains = allPlanMains(plan);
      usedMains.delete(firstDay.main);
      usedMains.delete(secondDay.main);

      const firstReplacement = findDryMainForDay(firstDay, usedMains, "noodle");
      if (firstReplacement) {
        usedMains.add(firstReplacement.name);
      }
      const secondReplacement = findDryMainForDay(secondDay, usedMains, "noodle");

      if (firstReplacement && secondReplacement) {
        return { firstDay, firstReplacement, secondDay, secondReplacement };
      }
    }
  }

  throw new Error("Expected adjacent non-vegetarian noodle days with dry replacements.");
}

function validMenu() {
  return {
    breakfasts: [
      { name: "breakfast 1", category: "bread", vegetarian: true },
      { name: "breakfast 2", category: "stickyRice", vegetarian: true },
      { name: "breakfast 3", category: "riceCake", vegetarian: false },
      { name: "breakfast 4", category: "dumpling", vegetarian: false },
      { name: "breakfast 5", category: "tofu", vegetarian: true }
    ],
    mains: [
      { name: "fish rice", group: "fish", starch: "rice" },
      { name: "beef rice", group: "beefPork", starch: "rice" },
      { name: "egg rice", group: "chickenEgg", starch: "rice" },
      { name: "veg rice", group: "vegetarian", starch: "rice" },
      { name: "veg noodle", group: "vegetarian", starch: "noodle" }
    ],
    soups: [{ name: "light soup", profile: "light", vegetarian: false }],
    sides: [{ name: "boiled greens", vegetarian: true }]
  };
}

function replaceWateryMainsWithDryAlternatives(week) {
  for (const day of week.days) {
    if (actualMenu.mainsByName.get(day.main)?.wateryStarch !== true) {
      continue;
    }

    const usedMains = new Set(week.days.map((candidate) => candidate.main));
    usedMains.delete(day.main);
    const replacement = findDryMainForDay(day, usedMains);

    if (!replacement) {
      throw new Error(`Expected a dry replacement for ${day.main}.`);
    }

    assignMain(day, replacement);
  }
}

describe("normalizeMenu", () => {
  it("accepts breakfast categories, soup profiles, and vegetarian metadata", () => {
    assert.doesNotThrow(() => normalizeMenu(validMenu(), menuOptions));
  });

  it("rejects breakfast entries without English category metadata", () => {
    const menu = validMenu();
    menu.breakfasts[0].category = "xôi";

    assert.throws(() => normalizeMenu(menu, menuOptions), /breakfasts\[0\]\.category has invalid value/);
  });

  it("rejects soup entries without a valid profile", () => {
    const menu = validMenu();
    menu.soups[0].profile = "heavy";

    assert.throws(() => normalizeMenu(menu, menuOptions), /soups\[0\]\.profile has invalid value "heavy"/);
  });

  it("rejects missing vegetarian metadata", () => {
    const menu = validMenu();
    delete menu.breakfasts[0].vegetarian;
    delete menu.soups[0].vegetarian;
    delete menu.sides[0].vegetarian;

    assert.throws(() => normalizeMenu(menu, menuOptions), /vegetarian must be a boolean/);
  });

  it("rejects invalid watery starch metadata", () => {
    const menu = validMenu();
    menu.mains[0].wateryStarch = "yes";

    assert.throws(() => normalizeMenu(menu, menuOptions), /mains\[0\]\.wateryStarch must be a boolean/);
  });

  it("rejects duplicate soup names after normalization", () => {
    const menu = validMenu();
    menu.soups.push({ name: "light soup", profile: "protein", vegetarian: false });

    assert.throws(() => normalizeMenu(menu, menuOptions), /soups\[1\]\.name duplicates "light soup"/);
  });
});

describe("validatePlan", () => {
  it("accepts the checked-in rolling plan", () => {
    assert.doesNotThrow(() => validatePlan(clonePlan()));
  });

  it("rejects a display date that does not match the ISO date", () => {
    const plan = clonePlan();
    const expectedDate = firstDayIsoDate(plan);
    plan.weeks[0].days[0].displayDate = "12/05/2026";

    assertValidationError(plan, new RegExp(`displayDate does not match ${escapeRegExp(expectedDate)}`));
  });

  it("rejects a group label that does not match the group key", () => {
    const plan = clonePlan();
    const targetDay = plan.weeks[0].days[0];
    targetDay.groupLabel = "Sai nhóm";

    assertValidationError(plan, new RegExp(`groupLabel must match group "${targetDay.group}"`));
  });

  it("rejects a lunar label that does not match the date", () => {
    const plan = clonePlan();
    const expectedDate = firstDayIsoDate(plan);
    plan.weeks[0].days[0].lunarDate = "1/1 âm lịch";

    assertValidationError(plan, new RegExp(`lunarDate does not match ${escapeRegExp(expectedDate)}`));
  });

  it("rejects date-only generatedAt metadata", () => {
    const plan = clonePlan();
    plan.metadata.generatedAt = "2026-05-09";

    assertValidationError(plan, /metadata\.generatedAt must be a valid date-time/);
  });

  it("rejects timezone-less generatedAt metadata", () => {
    const plan = clonePlan();
    plan.metadata.generatedAt = "2026-05-09T08:00:00";

    assertValidationError(plan, /metadata\.generatedAt must be a valid date-time/);
  });

  it("rejects blank plan variant metadata", () => {
    const plan = clonePlan();
    plan.metadata.planVariant = " ";

    assertValidationError(plan, /metadata\.planVariant must be a non-empty string/);
  });

  it("rejects a title that does not match the start date", () => {
    const plan = clonePlan();
    const expectedTitle = plan.metadata.title;
    plan.metadata.title = "Kế hoạch ăn 4 tuần từ 12/05/2026";

    assertValidationError(
      plan,
      new RegExp(`metadata\\.title must be "${escapeRegExp(expectedTitle)}"`)
    );
  });

  it("rejects a blank main dish", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].main = " ";

    assertValidationError(plan, /main must be a non-empty string/);
  });

  it("rejects a blank breakfast", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].breakfast = " ";

    assertValidationError(plan, /breakfast must be a non-empty string/);
  });

  it("rejects breakfast dishes that are not in the menu source data", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].breakfast = "bữa sáng không có trong menu";

    assertValidationError(plan, /breakfast must exist in data\/menu\.json/);
  });

  it("rejects non-vegetarian breakfast on vegetarian lunar days", () => {
    const plan = buildRollingPlan(new Date("2026-06-12T01:00:00.000Z"));
    plan.weeks[0].days[0].breakfast = "mì gói";

    assertValidationError(plan, /breakfast must be vegetarian on vegetarian lunar days/);
  });

  it("rejects duplicate breakfast dishes in the same week", () => {
    const plan = clonePlan();
    plan.weeks[0].days[1].breakfast = plan.weeks[0].days[0].breakfast;

    assertValidationError(plan, /breakfast repeats ".+" in the same week/);
  });

  it("rejects avoidable breakfast repeats from the previous week", () => {
    const plan = clonePlan();
    plan.weeks[1].days[0].breakfast = plan.weeks[0].days[0].breakfast;

    assertValidationError(plan, /breakfast repeats ".+" from the previous week/);
  });

  it("rejects dishes that are not in the menu source data", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].main = "cơm cá không có trong menu";

    assertValidationError(plan, /main must exist in data\/menu\.json/);
  });

  it("rejects avoidable main repeats from the previous week", () => {
    const plan = clonePlan();
    Object.assign(plan.weeks[1].days[0], {
      main: plan.weeks[0].days[4].main,
      group: plan.weeks[0].days[4].group,
      groupLabel: plan.weeks[0].days[4].groupLabel,
      starch: plan.weeks[0].days[4].starch
    });

    assertValidationError(plan, /main repeats ".+" from the previous week/);
  });

  it("rejects previous-week fish noodle repeats when other fish mains exist", () => {
    const plan = clonePlan();
    const fishNoodleDay = {
      main: "bánh canh cá",
      group: "fish",
      groupLabel: "Cá",
      starch: "noodle",
      soup: null,
      side: null
    };

    Object.assign(plan.weeks[0].days[3], fishNoodleDay);
    Object.assign(plan.weeks[1].days[1], fishNoodleDay);

    assertValidationError(plan, /main repeats "bánh canh cá" from the previous week/);
  });

  it("rejects consecutive watery starch mains", () => {
    const plan = clonePlan();
    Object.assign(plan.weeks[0].days[0], {
      main: "bánh canh cá",
      group: "fish",
      groupLabel: "Cá",
      starch: "noodle",
      soup: null,
      side: null
    });
    Object.assign(plan.weeks[0].days[1], {
      main: "cháo gà gỏi",
      group: "chickenEgg",
      groupLabel: "Gà/trứng",
      starch: "porridge",
      soup: null,
      side: null
    });

    assertValidationError(plan, /watery starch mains on consecutive days/);
  });

  it("rejects watery starch mains across a week boundary", () => {
    const plan = clonePlan();
    Object.assign(plan.weeks[0].days[4], {
      main: "bánh canh cá",
      group: "fish",
      groupLabel: "Cá",
      starch: "noodle",
      soup: null,
      side: null
    });
    Object.assign(plan.weeks[1].days[0], {
      main: "hủ tíu lẩu cá thác lác",
      group: "fish",
      groupLabel: "Cá",
      starch: "noodle",
      soup: null,
      side: null
    });

    assertValidationError(plan, /must not follow another watery starch main on the previous day/);
  });

  it("rejects full weeks without a watery starch main", () => {
    const plan = clonePlan();
    replaceWateryMainsWithDryAlternatives(plan.weeks[0]);

    assertValidationError(plan, /weeks\[0\] expected at least 1 watery starch main, found 0/);
  });

  it("allows consecutive dry noodle mains", () => {
    const plan = clonePlan();
    const { firstDay, firstReplacement, secondDay, secondReplacement } = findConsecutiveDryNoodleMutation(plan);

    assignMain(firstDay, firstReplacement);
    assignMain(secondDay, secondReplacement);
    ensureWeekHasWateryMain(plan, firstDay, secondDay);

    assert.doesNotThrow(() => validatePlan(plan));
  });

  it("does not let fallback bypass same-week main duplicate rules", () => {
    const plan = clonePlan();
    Object.assign(plan.weeks[0].days[1], {
      main: plan.weeks[0].days[4].main,
      group: plan.weeks[0].days[4].group,
      groupLabel: plan.weeks[0].days[4].groupLabel,
      starch: plan.weeks[0].days[4].starch
    });

    assertValidationError(plan, /repeats ".+" in the same week/);
  });

  it("rejects avoidable main repeats across the rolling plan", () => {
    const plan = clonePlan();
    Object.assign(plan.weeks[2].days[2], {
      main: plan.weeks[0].days[2].main,
      group: plan.weeks[0].days[2].group,
      groupLabel: plan.weeks[0].days[2].groupLabel,
      starch: plan.weeks[0].days[2].starch
    });

    assertValidationError(plan, /main repeats ".+" in the rolling plan/);
  });

  it("rejects avoidable breakfast repeats across the rolling plan", () => {
    const plan = clonePlan();
    plan.weeks[2].days[0].breakfast = plan.weeks[0].days[0].breakfast;

    assertValidationError(plan, /breakfast repeats ".+" in the rolling plan/);
  });

  it("rejects side dishes that are not in the menu source data", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].side = "rau không có trong menu";

    assertValidationError(plan, /side must exist in data\/menu\.json/);
  });

  it("rejects non-vegetarian soup and side on vegetarian lunar days", () => {
    const plan = buildRollingPlan(new Date("2026-06-12T01:00:00.000Z"));
    Object.assign(plan.weeks[0].days[0], {
      soup: "canh khoai mỡ",
      side: "khổ qua xào trứng"
    });

    assertValidationError(plan, /soup must be vegetarian on vegetarian lunar days/);
    assertValidationError(plan, /side must be vegetarian on vegetarian lunar days/);
  });

  it("rejects avoidable soup repeats from the previous week", () => {
    const plan = clonePlan();
    const sourceDay = firstRiceDay(plan.weeks[0]);
    const targetDay = firstRiceDay(plan.weeks[1]);
    targetDay.soup = sourceDay.soup;

    assertValidationError(plan, /soup repeats ".+" from the previous week/);
  });

  it("rejects avoidable side repeats from the previous week", () => {
    const plan = clonePlan();
    const sourceDay = firstRiceDay(plan.weeks[0]);
    const targetDay = firstRiceDay(plan.weeks[1]);
    targetDay.side = sourceDay.side;

    assertValidationError(plan, /side repeats ".+" from the previous week/);
  });

  it("rejects avoidable soup repeats in the same week", () => {
    const plan = clonePlan();
    const [sourceDay, targetDay] = firstTwoRiceDays(plan.weeks[0]);
    targetDay.soup = sourceDay.soup;

    assertValidationError(plan, /soup repeats ".+" in the same week/);
  });

  it("rejects avoidable soup repeats across the rolling plan", () => {
    const plan = clonePlan();
    const sourceDay = firstRiceDay(plan.weeks[0]);
    const targetDay = firstRiceDay(plan.weeks[2]);
    targetDay.soup = sourceDay.soup;

    assertValidationError(plan, /soup repeats ".+" in the rolling plan/);
  });

  it("rejects avoidable side repeats in the same week", () => {
    const plan = clonePlan();
    const [sourceDay, targetDay] = firstTwoRiceDays(plan.weeks[0]);
    targetDay.side = sourceDay.side;

    assertValidationError(plan, /side repeats ".+" in the same week/);
  });

  it("rejects avoidable side repeats across the rolling plan", () => {
    const plan = clonePlan();
    const sourceDay = firstRiceDay(plan.weeks[0]);
    const targetDay = firstRiceDay(plan.weeks[2]);
    targetDay.side = sourceDay.side;

    assertValidationError(plan, /side repeats ".+" in the rolling plan/);
  });

  it("keeps non-vegetarian weekly group caps when a vegetarian meal is present", () => {
    const plan = clonePlan();
    const weekIndex = plan.weeks.findIndex((week) =>
      week.days.filter((day) => day.group === "fish").length === 2 &&
      week.days.filter((day) => day.group !== "fish").length >= 2
    );
    assert.notEqual(weekIndex, -1, "Expected a week with two fish days and two non-fish days.");

    const nonFishDays = plan.weeks[weekIndex].days.filter((day) => day.group !== "fish");
    Object.assign(nonFishDays[0], {
      group: "vegetarian",
      groupLabel: groupLabels.vegetarian
    });
    Object.assign(nonFishDays[1], {
      group: "fish",
      groupLabel: groupLabels.fish
    });

    assertValidationError(
      plan,
      new RegExp(`weeks\\[${weekIndex}\\] expected at most 2 fish entries, found 3`)
    );
  });

  it("rejects redistributed days even when the global date range is complete", () => {
    const plan = clonePlan();
    plan.weeks[0].days.push(plan.weeks[1].days.shift());

    assertValidationError(plan, /weeks\[0\]\.days must contain exactly 5 weekdays/);
  });

  it("rejects stale vegetarian-day week notes", () => {
    const plan = buildRollingPlan(new Date("2026-06-12T01:00:00.000Z"));
    plan.weeks[0].notes = ["Không có ngày chay mùng 1 hoặc rằm âm lịch trong các ngày ăn của tuần."];

    assertValidationError(plan, /notes must include "Có ngày chay âm lịch: Thứ 2 15\/06\/2026\."/);
  });

  it("reports non-array week notes without crashing", () => {
    const plan = clonePlan();
    plan.weeks[0].notes = "Không có ngày chay";

    assertValidationError(plan, /weeks\[0\]\.notes must be an array/);
  });
});
