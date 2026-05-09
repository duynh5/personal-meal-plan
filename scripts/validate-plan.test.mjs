import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { buildRollingPlan } from "./generate-meal-plan.mjs";
import { validatePlan } from "./validate-plan.mjs";

const validPlan = JSON.parse(fs.readFileSync(new URL("../meal-plan.json", import.meta.url), "utf8"));

function clonePlan() {
  return structuredClone(validPlan);
}

function assertValidationError(plan, pattern) {
  assert.throws(() => validatePlan(plan), pattern);
}

describe("validatePlan", () => {
  it("accepts the checked-in rolling plan", () => {
    assert.doesNotThrow(() => validatePlan(clonePlan()));
  });

  it("rejects a display date that does not match the ISO date", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].displayDate = "12/05/2026";

    assertValidationError(plan, /displayDate does not match 2026-05-11/);
  });

  it("rejects a group label that does not match the group key", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].groupLabel = "Bò/heo";

    assertValidationError(plan, /groupLabel must match group "fish"/);
  });

  it("rejects a lunar label that does not match the date", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].lunarDate = "1/1 âm lịch";

    assertValidationError(plan, /lunarDate does not match 2026-05-11/);
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

  it("rejects a title that does not match the start date", () => {
    const plan = clonePlan();
    plan.metadata.title = "Kế hoạch ăn 4 tuần từ 12/05/2026";

    assertValidationError(plan, /metadata\.title must be "Kế hoạch ăn 4 tuần từ 11\/05\/2026"/);
  });

  it("rejects a blank main dish", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].main = " ";

    assertValidationError(plan, /main must be a non-empty string/);
  });

  it("rejects dishes that are not in the menu source data", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].main = "cơm cá không có trong menu";

    assertValidationError(plan, /main must exist in data\/menu\.json/);
  });

  it("rejects side dishes that are not in the menu source data", () => {
    const plan = clonePlan();
    plan.weeks[0].days[0].side = "rau không có trong menu";

    assertValidationError(plan, /side must exist in data\/menu\.json/);
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
