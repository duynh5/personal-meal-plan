import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { buildRollingPlan, chooseRotatedOptionForTest } from "./generate-meal-plan.mjs";
import { validatePlan } from "./validate-plan.mjs";

const menu = JSON.parse(fs.readFileSync(new URL("../data/menu.json", import.meta.url), "utf8"));

function weekDishes(week) {
  return {
    breakfasts: new Set(week.days.map((day) => day.breakfast)),
    mains: new Set(week.days.map((day) => day.main)),
    soups: new Set(week.days.map((day) => day.soup).filter(Boolean)),
    sides: new Set(week.days.map((day) => day.side).filter(Boolean))
  };
}

function mainOptionsFor(day) {
  const group = day.vegetarianDay ? "vegetarian" : day.group;
  let options = menu.mains.filter((dish) => dish.group === group && dish.starch === day.starch);

  if (options.length === 0) {
    options = menu.mains.filter((dish) => dish.group === group);
  }

  return options;
}

describe("buildRollingPlan", () => {
  it("prefers non-previous-week options that still satisfy category rules", () => {
    const options = ["last-week", "blocked", "fresh"];
    const choice = chooseRotatedOptionForTest(
      options,
      0,
      (item) => item !== "blocked",
      (item) => item !== "last-week"
    );

    assert.equal(choice, "fresh");
  });

  it("falls back to previous-week options only when no preferred option is eligible", () => {
    const options = ["last-week", "blocked"];
    const choice = chooseRotatedOptionForTest(
      options,
      0,
      (item) => item !== "blocked",
      (item) => item !== "last-week"
    );

    assert.equal(choice, "last-week");
  });

  it("does not let fallback bypass category eligibility", () => {
    const choice = chooseRotatedOptionForTest(
      ["blocked"],
      0,
      () => false,
      () => true
    );

    assert.equal(choice, null);
  });

  it("keeps starch balance when a vegetarian lunar day lands on a rice slot", () => {
    const plan = buildRollingPlan(new Date("2026-06-12T01:00:00.000Z"));
    const firstDay = plan.weeks[0].days[0];

    assert.equal(firstDay.date, "2026-06-15");
    assert.equal(firstDay.vegetarianDay, true);
    assert.equal(firstDay.group, "vegetarian");
    assert.equal(firstDay.starch, "rice");
    assert.equal(plan.metadata.generatedAt, "2026-06-12T01:00:00.000Z");
    assert.doesNotThrow(() => validatePlan(plan));
  });

  it("does not repeat breakfast within a week", () => {
    const plan = buildRollingPlan(new Date("2026-05-09T01:00:00.000Z"));

    for (const week of plan.weeks) {
      const breakfasts = week.days.map((day) => day.breakfast);

      assert.equal(new Set(breakfasts).size, breakfasts.length);
    }
  });

  it("uses a stable variant input to change deterministic choices", () => {
    const runDate = new Date("2026-05-09T01:00:00.000Z");
    const defaultPlan = buildRollingPlan(runDate, { planVariant: "" });
    const variantPlan = buildRollingPlan(runDate, { planVariant: "alt-1" });
    const repeatedVariantPlan = buildRollingPlan(runDate, { planVariant: "alt-1" });

    assert.equal(variantPlan.metadata.planVariant, "alt-1");
    assert.notDeepEqual(variantPlan.weeks[0].days, defaultPlan.weeks[0].days);
    assert.notEqual(variantPlan.weeks[0].days[0].main, defaultPlan.weeks[0].days[0].main);
    assert.deepEqual(variantPlan.weeks[0].days, repeatedVariantPlan.weeks[0].days);
    assert.doesNotThrow(() => validatePlan(variantPlan));
  });

  it("avoids previous-week dishes when category alternatives exist", () => {
    const plan = buildRollingPlan(new Date("2026-05-09T01:00:00.000Z"));

    for (let weekIndex = 1; weekIndex < plan.weeks.length; weekIndex += 1) {
      const previousWeekDishes = weekDishes(plan.weeks[weekIndex - 1]);
      const weeklyRestrictedMains = new Set();

      for (const day of plan.weeks[weekIndex].days) {
        assert.equal(previousWeekDishes.breakfasts.has(day.breakfast), false, `${day.date} repeats breakfast`);
        if (previousWeekDishes.mains.has(day.main)) {
          const duplicateRestricted = day.group === "beefPork" || day.group === "chickenEgg";
          const hasAlternative = mainOptionsFor(day).some(
            (dish) =>
              !previousWeekDishes.mains.has(dish.name) &&
              (!duplicateRestricted || !weeklyRestrictedMains.has(dish.name))
          );

          assert.equal(hasAlternative, false, `${day.date} repeats main`);
        }
        if (day.soup) {
          assert.equal(previousWeekDishes.soups.has(day.soup), false, `${day.date} repeats soup`);
        }
        if (day.side) {
          assert.equal(previousWeekDishes.sides.has(day.side), false, `${day.date} repeats side`);
        }
        if (day.group === "beefPork" || day.group === "chickenEgg") {
          weeklyRestrictedMains.add(day.main);
        }
      }
    }
  });

  it("uses adjacent existing plan data before choosing the first generated week", () => {
    const runDate = new Date("2026-05-15T01:00:00.000Z");
    const unseededPlan = buildRollingPlan(runDate);
    const firstUnseededDay = unseededPlan.weeks[0].days[0];
    const previousWeekDates = ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"];
    const previousPlan = {
      weeks: [
        {
          days: unseededPlan.weeks[0].days.map((day, index) => ({
            ...day,
            date: previousWeekDates[index]
          }))
        }
      ]
    };
    const seededPlan = buildRollingPlan(runDate, { previousPlan });
    const firstSeededDay = seededPlan.weeks[0].days[0];

    assert.notEqual(firstSeededDay.breakfast, firstUnseededDay.breakfast);
    assert.notEqual(firstSeededDay.main, firstUnseededDay.main);
    assert.notEqual(firstSeededDay.soup, firstUnseededDay.soup);
    assert.notEqual(firstSeededDay.side, firstUnseededDay.side);
    assert.doesNotThrow(() => validatePlan(seededPlan));
  });

  it("ignores incomplete adjacent existing plan data", () => {
    const runDate = new Date("2026-05-15T01:00:00.000Z");
    const unseededPlan = buildRollingPlan(runDate);
    const firstUnseededDay = unseededPlan.weeks[0].days[0];
    const previousPlan = {
      weeks: [
        {
          days: [
            null,
            { ...firstUnseededDay, date: "2026-05-11" },
            { ...firstUnseededDay, date: "2026-05-11" }
          ]
        }
      ]
    };
    const seededPlan = buildRollingPlan(runDate, { previousPlan });
    const firstSeededDay = seededPlan.weeks[0].days[0];

    assert.equal(firstSeededDay.breakfast, firstUnseededDay.breakfast);
    assert.equal(firstSeededDay.main, firstUnseededDay.main);
    assert.equal(firstSeededDay.soup, firstUnseededDay.soup);
    assert.equal(firstSeededDay.side, firstUnseededDay.side);
  });

  it("accepts null options", () => {
    const plan = buildRollingPlan(new Date("2026-05-15T01:00:00.000Z"), null);

    assert.equal(plan.metadata.startDate, "2026-05-18");
  });

  it("rejects invalid run dates", () => {
    assert.throws(() => buildRollingPlan(new Date("not-a-date")), /runDate must be a valid Date/);
  });
});
