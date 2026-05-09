import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRollingPlan } from "./generate-meal-plan.mjs";
import { validatePlan } from "./validate-plan.mjs";

describe("buildRollingPlan", () => {
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

  it("rejects invalid run dates", () => {
    assert.throws(() => buildRollingPlan(new Date("not-a-date")), /runDate must be a valid Date/);
  });
});
