export function breakfastItemsForDay(menu, vegetarianDay) {
  return vegetarianDay ? menu.vegetarianBreakfasts : menu.breakfasts;
}

export function breakfastNamesForDay(menu, vegetarianDay) {
  return vegetarianDay ? menu.vegetarianBreakfastNames : menu.breakfastNames;
}

export function soupItemsForDay(menu, vegetarianDay) {
  return vegetarianDay ? menu.vegetarianSoups : menu.soups;
}

export function soupNamesForDay(menu, vegetarianDay) {
  return vegetarianDay ? menu.vegetarianSoupNames : menu.soupNames;
}

export function sideItemsForDay(menu, vegetarianDay) {
  return vegetarianDay ? menu.vegetarianSides : menu.sides;
}

export function sideNamesForDay(menu, vegetarianDay) {
  return vegetarianDay ? menu.vegetarianSideNames : menu.sideNames;
}

export function shouldIncludeRiceSides(menu, vegetarianDay, starch) {
  return (
    starch === "rice" &&
    (!vegetarianDay || (menu.vegetarianSoups.length > 0 && menu.vegetarianSides.length > 0))
  );
}

export function vegetarianNoteForDays(days) {
  const vegetarianDays = days.filter((day) => day.vegetarianDay);

  if (vegetarianDays.length === 0) {
    return "Không có ngày chay mùng 1 hoặc rằm âm lịch trong các ngày ăn của tuần.";
  }

  return `Có ngày chay âm lịch: ${vegetarianDays
    .map((day) => `${day.weekday} ${day.displayDate}`)
    .join(", ")}.`;
}
