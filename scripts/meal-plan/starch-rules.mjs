const fullWeekStapleCount = 3;
const fullWeekNoodleCount = 2;

export function isWateryDish(dish) {
  return dish?.wateryStarch === true;
}

export function canFollowWateryStarch(previousWateryStarch, dish) {
  return !previousWateryStarch || !isWateryDish(dish);
}

export function hasConsecutiveWateryMains(days, mainsByName) {
  return days.some((day, index) =>
    index > 0 &&
    isWateryDish(mainsByName.get(days[index - 1]?.main)) &&
    isWateryDish(mainsByName.get(day?.main))
  );
}

export function assertFullWeekStarchRules(days, label, errors, mainsByName) {
  const stapleCount = days.filter((day) => day.starch === "rice" || day.starch === "porridge").length;
  const noodleCount = days.filter((day) => day.starch === "noodle").length;

  if (stapleCount !== fullWeekStapleCount) {
    errors.push(`${label} expected ${fullWeekStapleCount} rice or porridge entries, found ${stapleCount}.`);
  }
  if (noodleCount !== fullWeekNoodleCount) {
    errors.push(`${label} expected ${fullWeekNoodleCount} noodle entries, found ${noodleCount}.`);
  }

  for (let index = 1; index < days.length; index += 1) {
    if (isWateryDish(mainsByName.get(days[index - 1]?.main)) && isWateryDish(mainsByName.get(days[index]?.main))) {
      errors.push(
        `${label} must not schedule watery starch mains on consecutive days (${days[index - 1].date} and ${days[index].date}).`
      );
    }
  }
}
