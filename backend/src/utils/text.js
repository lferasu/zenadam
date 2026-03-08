const BOILERPLATE_PATTERNS = [/read more/gi, /click here/gi];

export const normalizeWhitespace = (value = '') => {
  return value.replace(/\s+/g, ' ').trim();
};

export const stripBasicBoilerplate = (value = '') => {
  return BOILERPLATE_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, ''), value);
};

export const normalizeText = (value = '') => {
  return normalizeWhitespace(stripBasicBoilerplate(String(value)));
};

export const tokenizeTitle = (value = '') => {
  const cleaned = normalizeText(value).toLowerCase();

  return cleaned
    .split(/[\s\-_/|:,.!?()[\]"'`]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
};

export const pickKeywords = (title = '', content = '', limit = 8) => {
  const counts = new Map();

  [...tokenizeTitle(title), ...tokenizeTitle(content)]
    .filter((token) => token.length <= 30)
    .forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
};
