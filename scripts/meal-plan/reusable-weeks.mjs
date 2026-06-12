import { lunarDateLabel } from "../lunar.mjs";
import { createWeekDishes } from "../week-dishes.mjs";
import { toDisplayDate, toIsoDate } from "./dates.mjs";
import { shouldIncludeRiceSides, vegetarianNoteForDays } from "./menu-rules.mjs";
import { hasConsecutiveWateryMains } from "./starch-rules.mjs";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function createWeekDishesFromWeek(week, mainsByName = new Map()) {
  const dishes = createWeekDishes();
  const days = Array.isArray(week?.days) ? [...week.days] : [];
  days.sort((left, right) => left.date.localeCompare(right.date));

  for (const day of days) {
    if (isNonEmptyString(day?.breakfast)) {
      dishes.breakfasts.add(day.breakfast);
      dishes.lastBreakfast = day.breakfast;
    }
    if (isNonEmptyString(day?.main)) {
      dishes.mains.add(day.main);
      dishes.lastWateryStarch = mainsByName.get(day.main)?.wateryStarch === true;
    }
    if (isNonEmptyString(day?.soup)) {
      dishes.soups.add(day.soup);
      dishes.lastSoup = day.soup;
    }
    if (isNonEmptyString(day?.side)) {
      dishes.sides.add(day.side);
      dishes.lastSide = day.side;
    }
  }

  return dishes;
}

export function reusableWeeksByStartDate(previousPlan) {
  if (!previousPlan || !Array.isArray(previousPlan.weeks)) {
    return new Map();
  }

  const byStartDate = new Map();

  for (const week of previousPlan.weeks) {
    if (!Array.isArray(week?.days) || week.days.length === 0) {
      continue;
    }

    const firstDay = week.days[0];
    if (!isNonEmptyString(firstDay?.date)) {
      continue;
    }

    byStartDate.set(firstDay.date, week);
  }

  return byStartDate;
}

function weekMatchesDates(week, expectedDates) {
  if (!Array.isArray(week?.days) || week.days.length !== expectedDates.length) {
    return false;
  }

  return week.days.every((day, index) => day?.date === expectedDates[index]);
}

function dayMatchesCurrentRules(day, date, context) {
  if (!day || typeof day !== "object" || Array.isArray(day)) {
    return false;
  }

  const { groupLabels, isVegetarianLunarDay, menu, weekdayNames } = context;
  const menuDish = menu.mainsByName.get(day.main);
  const menuBreakfast = menu.breakfastByName.get(day.breakfast);
  const menuSoup = menu.soupByName.get(day.soup);
  const menuSide = menu.sideByName.get(day.side);
  const vegetarianDay = isVegetarianLunarDay(date);
  const hasRiceSides = shouldIncludeRiceSides(menu, vegetarianDay, menuDish?.starch);

  return (
    day.displayDate === toDisplayDate(date) &&
    day.weekday === weekdayNames[date.getUTCDay()] &&
    day.lunarDate === lunarDateLabel(date) &&
    day.vegetarianDay === vegetarianDay &&
    menuBreakfast &&
    (!vegetarianDay || menuBreakfast.vegetarian) &&
    menuDish &&
    day.group === menuDish.group &&
    day.groupLabel === groupLabels[menuDish.group] &&
    day.starch === menuDish.starch &&
    (!vegetarianDay || day.group === "vegetarian") &&
    (day.soup === null || (menuSoup && (!vegetarianDay || menuSoup.vegetarian))) &&
    (day.side === null || (menuSide && (!vegetarianDay || menuSide.vegetarian))) &&
    (hasRiceSides ? isNonEmptyString(day.soup) && isNonEmptyString(day.side) : day.soup === null && day.side === null)
  );
}

function hasNoRepeatedValues(values) {
  return new Set(values).size === values.length;
}

function hasReusableMealVariety(days, menu) {
  return (
    hasNoRepeatedValues(days.map((day) => day.breakfast)) &&
    hasNoRepeatedValues(days.map((day) => day.main)) &&
    hasNoRepeatedValues(days.map((day) => day.soup).filter(isNonEmptyString)) &&
    hasNoRepeatedValues(days.map((day) => day.side).filter(isNonEmptyString)) &&
    !hasConsecutiveWateryMains(days, menu.mainsByName)
  );
}

export function isReusableWeek(week, weekDates, context) {
  const expectedDates = weekDates.map(toIsoDate);

  if (!weekMatchesDates(week, expectedDates)) {
    return false;
  }

  const days = week.days;
  const { menu } = context;
  return (
    week.startDate === days[0].displayDate &&
    week.endDate === days[days.length - 1].displayDate &&
    week.title === `Tuần ${days[0].displayDate} - ${days[days.length - 1].displayDate}` &&
    Array.isArray(week.notes) &&
    week.notes.includes(vegetarianNoteForDays(days)) &&
    hasReusableMealVariety(days, menu) &&
    days.every((day, index) => dayMatchesCurrentRules(day, weekDates[index], context))
  );
}
