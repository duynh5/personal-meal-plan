export function createWeekDishes() {
  return {
    breakfasts: new Set(),
    mains: new Set(),
    soups: new Set(),
    sides: new Set()
  };
}

function createWeekDishesFromDays(days) {
  const dishes = createWeekDishes();

  for (const day of days) {
    if (typeof day.breakfast === "string") {
      dishes.breakfasts.add(day.breakfast);
    }
    if (typeof day.main === "string") {
      dishes.mains.add(day.main);
    }
    if (typeof day.soup === "string") {
      dishes.soups.add(day.soup);
    }
    if (typeof day.side === "string") {
      dishes.sides.add(day.side);
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
