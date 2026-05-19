import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { buildRollingPlan } from "./generate-meal-plan.mjs";
import { normalizeMenu } from "./meal-plan/menu.mjs";
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

function validMenu() {
  return {
    breakfasts: [
      { name: "breakfast 1", category: "bread" },
      { name: "breakfast 2", category: "stickyRice" },
      { name: "breakfast 3", category: "riceCake" },
      { name: "breakfast 4", category: "dumpling" },
      { name: "breakfast 5", category: "tofu" }
    ],
    mains: [
      { name: "fish rice", group: "fish", starch: "rice" },
      { name: "beef rice", group: "beefPork", starch: "rice" },
      { name: "egg rice", group: "chickenEgg", starch: "rice" },
      { name: "veg rice", group: "vegetarian", starch: "rice" },
      { name: "veg noodle", group: "vegetarian", starch: "noodle" }
    ],
    soups: [{ name: "light soup", profile: "light" }],
    sides: ["boiled greens"]
  };
}

describe("normalizeMenu", () => {
  it("accepts breakfast categories and soup profiles", () => {
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

  it("rejects duplicate soup names after normalization", () => {
    const menu = validMenu();
    menu.soups.push({ name: "light soup", profile: "protein" });

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
    plan.weeks[0].days[0].groupLabel = "Bò/heo";

    assertValidationError(plan, /groupLabel must match group "fish"/);
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

  it("rejects side dishes that are not in the menu source data", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].side = "rau không có trong menu";

    assertValidationError(plan, /side must exist in data\/menu\.json/);
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

  it("rejects avoidable side repeats in the same week", () => {
    const plan = clonePlan();
    const [sourceDay, targetDay] = firstTwoRiceDays(plan.weeks[0]);
    targetDay.side = sourceDay.side;

    assertValidationError(plan, /side repeats ".+" in the same week/);
  });

  it("keeps non-vegetarian weekly group caps when a vegetarian meal is present", () => {
    const plan = clonePlan();
    Object.assign(plan.weeks[0].days[1], {
      main: "mì xào chay",
      group: "vegetarian",
      groupLabel: "Chay",
      starch: "noodle",
      soup: null,
      side: null
    });
    Object.assign(plan.weeks[0].days[4], {
      main: "cơm cá chiên",
      group: "fish",
      groupLabel: "Cá",
      starch: "rice"
    });

    assertValidationError(plan, /expected at most 2 fish entries, found 3/);
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
