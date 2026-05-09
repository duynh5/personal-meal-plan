import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { readPlanConfig } from "./plan-config.mjs";

function tempConfigPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-plan-config-"));
  return path.join(dir, "plan-config.json");
}

describe("readPlanConfig", () => {
  it("defaults to an empty variant when the config file is absent", () => {
    assert.deepEqual(readPlanConfig(tempConfigPath()), { mealPlanVariant: "" });
  });

  it("reads the configured meal plan variant", () => {
    const configPath = tempConfigPath();
    fs.writeFileSync(configPath, `${JSON.stringify({ mealPlanVariant: "alt-1" })}\n`);

    assert.deepEqual(readPlanConfig(configPath), { mealPlanVariant: "alt-1" });
  });

  it("rejects non-string meal plan variants", () => {
    const configPath = tempConfigPath();
    fs.writeFileSync(configPath, `${JSON.stringify({ mealPlanVariant: 7 })}\n`);

    assert.throws(() => readPlanConfig(configPath), /mealPlanVariant must be a string/);
  });
});
