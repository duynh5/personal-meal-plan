export function createWeekDishes() {
  return {
    breakfasts: new Set(),
    breakfastCategoryCounts: new Map(),
    lastBreakfast: null,
    mains: new Set(),
    soups: new Set(),
    lastSoup: null,
    sides: new Set(),
    lastSide: null
  };
}

function createWeekDishesFromDays(days) {
  const dishes = createWeekDishes();
  const sortedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));

  for (const day of sortedDays) {
    if (typeof day.breakfast === "string") {
      dishes.breakfasts.add(day.breakfast);
      dishes.lastBreakfast = day.breakfast;
    }
    if (typeof day.main === "string") {
      dishes.mains.add(day.main);
    }
    if (typeof day.soup === "string") {
      dishes.soups.add(day.soup);
      dishes.lastSoup = day.soup;
    }
    if (typeof day.side === "string") {
      dishes.sides.add(day.side);
      dishes.lastSide = day.side;
    }
  }

  return dishes;
}

export function previousWeekDishesFromPlan(previousPlan, previousWeekDates) {
  if (!previousPlan || !Array.isArray(previousPlan.weeks)) {
    return createWeekDishes();
  }

  const previousWeekDays = previousPlan.weeks
    .flatMap((week) => (Array.isArray(week.days) ? week.days : []))
    .filter((day) => day && previousWeekDates.has(day.date));
  const matchedDates = new Set(previousWeekDays.map((day) => day.date));

  if (previousWeekDays.length !== previousWeekDates.size || matchedDates.size !== previousWeekDates.size) {
    return createWeekDishes();
  }

  return createWeekDishesFromDays(previousWeekDays);
}
