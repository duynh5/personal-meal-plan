export const fullWeekGroupPatterns = [
  ["fish", "beefPork", "chickenEgg", "fish", "beefPork"],
  ["beefPork", "fish", "chickenEgg", "beefPork", "fish"]
];

export const fullWeekStarchPatterns = [
  ["noodle", "noodle", "rice", "rice", "rice"],
  ["noodle", "rice", "noodle", "rice", "rice"],
  ["noodle", "rice", "rice", "noodle", "rice"],
  ["noodle", "rice", "rice", "rice", "noodle"],
  ["rice", "noodle", "noodle", "rice", "rice"],
  ["rice", "noodle", "rice", "noodle", "rice"],
  ["rice", "noodle", "rice", "rice", "noodle"],
  ["rice", "rice", "noodle", "noodle", "rice"],
  ["rice", "rice", "noodle", "rice", "noodle"],
  ["rice", "rice", "rice", "noodle", "noodle"]
];

function rotateIndex(seed, length) {
  return Math.abs(seed) % length;
}

export function groupPatternFor(weekIndex) {
  return fullWeekGroupPatterns[weekIndex % fullWeekGroupPatterns.length];
}

export function rotatedStarchPatterns(seed) {
  const start = rotateIndex(seed, fullWeekStarchPatterns.length);

  return fullWeekStarchPatterns.map((_, offset) => fullWeekStarchPatterns[(start + offset) % fullWeekStarchPatterns.length]);
}
