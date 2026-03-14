export const clamp01 = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric <= 0) {
    return 0;
  }

  if (numeric >= 1) {
    return 1;
  }

  return numeric;
};

export const roundScore = (value, digits = 6) => Number(clamp01(value).toFixed(digits));

export const toDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const decayScore = ({ valueDate, now = new Date(), halfLifeHours = 24 }) => {
  const date = toDate(valueDate);
  if (!date) {
    return 0;
  }

  const ageHours = Math.max(0, (now.getTime() - date.getTime()) / (60 * 60 * 1000));
  if (ageHours === 0) {
    return 1;
  }

  return clamp01(Math.exp((-Math.log(2) * ageHours) / Math.max(1, halfLifeHours)));
};

export const cappedLogScore = ({ value = 0, cap = 1 }) => {
  const safeValue = Math.max(0, Number(value) || 0);
  const safeCap = Math.max(1, Number(cap) || 1);
  return clamp01(Math.log1p(safeValue) / Math.log1p(safeCap));
};

export const cappedLinearScore = ({ value = 0, cap = 1 }) => {
  const safeValue = Math.max(0, Number(value) || 0);
  const safeCap = Math.max(1, Number(cap) || 1);
  return clamp01(safeValue / safeCap);
};
