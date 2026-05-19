export function weekRepeatsRollingItems(week, rollingDishes) {
  return week.days.some((day) =>
    rollingDishes.breakfasts.has(day.breakfast) ||
    rollingDishes.mains.has(day.main) ||
    (day.soup && rollingDishes.soups.has(day.soup)) ||
    (day.side && rollingDishes.sides.has(day.side))
  );
}

export function addWeekToRolling(rollingDishes, week) {
  for (const day of week.days) {
    rollingDishes.breakfasts.add(day.breakfast);
    rollingDishes.mains.add(day.main);
    if (day.soup) {
      rollingDishes.soups.add(day.soup);
    }
    if (day.side) {
      rollingDishes.sides.add(day.side);
    }
  }
}
