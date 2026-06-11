import fs from "node:fs";

const breakfastCategoryPattern = /^[a-z][A-Za-z0-9]*$/;
const soupProfiles = new Set(["light", "protein"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateVegetarianFlag(item, label, errors) {
  if (typeof item.vegetarian !== "boolean") {
    errors.push(`${label}.vegetarian must be a boolean.`);
  }
}

function validateNamedMetadataItems(items, field, metadataField, isValidMetadata, errors) {
  const names = new Set();

  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`data/menu.json must include a non-empty ${field} array.`);
    return;
  }

  for (const [index, item] of items.entries()) {
    const label = `${field}[${index}]`;

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(item.name)) {
      errors.push(`${label}.name must be a non-empty string.`);
    } else if (item.name !== item.name.trim()) {
      errors.push(`${label}.name must not have leading or trailing whitespace.`);
    } else if (names.has(item.name)) {
      errors.push(`${label}.name duplicates "${item.name}".`);
    } else {
      names.add(item.name);
    }
    if (!isNonEmptyString(item[metadataField])) {
      errors.push(`${label}.${metadataField} must be a non-empty string.`);
    } else if (!isValidMetadata(item[metadataField])) {
      errors.push(`${label}.${metadataField} has invalid value "${item[metadataField]}".`);
    }
    validateVegetarianFlag(item, label, errors);
  }
}

function validateSides(items, errors) {
  const names = new Set();

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("data/menu.json must include a non-empty sides array.");
    return;
  }

  for (const [index, item] of items.entries()) {
    const label = `sides[${index}]`;

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(item.name)) {
      errors.push(`${label}.name must be a non-empty string.`);
    } else if (item.name !== item.name.trim()) {
      errors.push(`${label}.name must not have leading or trailing whitespace.`);
    } else if (names.has(item.name)) {
      errors.push(`${label}.name duplicates "${item.name}".`);
    } else {
      names.add(item.name);
    }
    validateVegetarianFlag(item, label, errors);
  }
}

function validateMains(mains, allowedGroups, allowedStarches, errors) {
  const names = new Set();

  if (!Array.isArray(mains) || mains.length === 0) {
    errors.push("data/menu.json must include a non-empty mains array.");
    return;
  }

  for (const [index, dish] of mains.entries()) {
    const label = `mains[${index}]`;

    if (!dish || typeof dish !== "object" || Array.isArray(dish)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(dish.name)) {
      errors.push(`${label}.name must be a non-empty string.`);
    } else if (dish.name !== dish.name.trim()) {
      errors.push(`${label}.name must not have leading or trailing whitespace.`);
    } else if (names.has(dish.name)) {
      errors.push(`${label}.name duplicates "${dish.name}".`);
    } else {
      names.add(dish.name);
    }
    if (!allowedGroups.has(dish.group)) {
      errors.push(`${label}.group must be one of: ${[...allowedGroups].join(", ")}.`);
    }
    if (!allowedStarches.has(dish.starch)) {
      errors.push(`${label}.starch must be one of: ${[...allowedStarches].join(", ")}.`);
    }
    if (dish.wateryStarch !== undefined && typeof dish.wateryStarch !== "boolean") {
      errors.push(`${label}.wateryStarch must be a boolean when present.`);
    }
  }
}

export function normalizeMenu(menu, options = {}) {
  const errors = [];
  const allowedGroups = options.allowedGroups ?? new Set();
  const allowedStarches = options.allowedStarches ?? new Set();
  const requiredGroups = options.requiredGroups ?? new Set();
  const requiredStarches = options.requiredStarches ?? new Set();

  if (!menu || typeof menu !== "object" || Array.isArray(menu)) {
    throw new Error("data/menu.json must contain an object.");
  }

  validateNamedMetadataItems(
    menu.breakfasts,
    "breakfasts",
    "category",
    (value) => breakfastCategoryPattern.test(value),
    errors
  );
  if (
    Array.isArray(menu.breakfasts) &&
    options.minimumBreakfasts &&
    menu.breakfasts.length < options.minimumBreakfasts
  ) {
    errors.push(`data/menu.json must include at least ${options.minimumBreakfasts} breakfast entries.`);
  }
  validateMains(menu.mains, allowedGroups, allowedStarches, errors);
  validateNamedMetadataItems(menu.soups, "soups", "profile", (value) => soupProfiles.has(value), errors);
  validateSides(menu.sides, errors);

  const breakfasts = Array.isArray(menu.breakfasts) ? menu.breakfasts : [];
  const mains = Array.isArray(menu.mains)
    ? menu.mains.map((dish) => ({
        ...dish,
        wateryStarch: dish?.wateryStarch === true
      }))
    : [];
  const soups = Array.isArray(menu.soups) ? menu.soups : [];
  const sides = Array.isArray(menu.sides) ? menu.sides : [];

  for (const group of requiredGroups) {
    if (!mains.some((dish) => dish?.group === group)) {
      errors.push(`data/menu.json needs at least one ${group} main.`);
    }
  }
  if (!mains.some((dish) => dish?.group === "vegetarian")) {
    errors.push("data/menu.json needs at least one vegetarian main.");
  }
  if (!breakfasts.some((item) => item?.vegetarian)) {
    errors.push("data/menu.json needs at least one vegetarian breakfast.");
  }
  if (!sides.some((item) => item?.vegetarian)) {
    errors.push("data/menu.json needs at least one vegetarian side.");
  }
  for (const starch of requiredStarches) {
    if (!mains.some((dish) => dish?.group === "vegetarian" && dish.starch === starch)) {
      errors.push(`data/menu.json needs at least one vegetarian main with starch "${starch}".`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid menu data:\n- ${errors.join("\n- ")}`);
  }

  return {
    breakfasts,
    breakfastNames: breakfasts.map((item) => item.name),
    breakfastByName: new Map(breakfasts.map((item) => [item.name, item])),
    vegetarianBreakfasts: breakfasts.filter((item) => item.vegetarian),
    vegetarianBreakfastNames: breakfasts.filter((item) => item.vegetarian).map((item) => item.name),
    mains,
    mainsByName: new Map(mains.map((dish) => [dish.name, dish])),
    soups,
    soupNames: soups.map((item) => item.name),
    soupByName: new Map(soups.map((item) => [item.name, item])),
    vegetarianSoups: soups.filter((item) => item.vegetarian),
    vegetarianSoupNames: soups.filter((item) => item.vegetarian).map((item) => item.name),
    sides,
    sideNames: sides.map((item) => item.name),
    sideByName: new Map(sides.map((item) => [item.name, item])),
    vegetarianSides: sides.filter((item) => item.vegetarian),
    vegetarianSideNames: sides.filter((item) => item.vegetarian).map((item) => item.name)
  };
}

export function readMenu(menuPath, options) {
  return normalizeMenu(JSON.parse(fs.readFileSync(menuPath, "utf8")), options);
}
