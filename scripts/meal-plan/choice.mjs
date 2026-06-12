function rotateIndex(seed, length) {
  return Math.abs(seed) % length;
}

export function seedOffsetFor(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;
  }

  return hash;
}

export function chooseRotatedOption(options, seed, isAllowed, isPreferred) {
  const start = rotateIndex(seed, options.length);

  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length];

    if (isAllowed(option) && isPreferred(option)) {
      return option;
    }
  }

  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length];

    if (isAllowed(option)) {
      return option;
    }
  }

  return null;
}

export function chooseScoredOption(options, seed, isAllowed, scoreOption) {
  const start = rotateIndex(seed, options.length);
  let bestOption = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length];

    if (!isAllowed(option)) {
      continue;
    }

    const score = scoreOption(option);
    if (score < bestScore) {
      bestOption = option;
      bestScore = score;
    }
  }

  return bestOption;
}
