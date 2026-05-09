import fs from "node:fs";

export function readPlanConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { mealPlanVariant: "" };
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read data/plan-config.json: ${error.message}`);
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("data/plan-config.json must contain an object.");
  }
  if (
    Object.hasOwn(config, "mealPlanVariant") &&
    typeof config.mealPlanVariant !== "string"
  ) {
    throw new Error("data/plan-config.json mealPlanVariant must be a string.");
  }

  return {
    mealPlanVariant: config.mealPlanVariant ?? ""
  };
}
