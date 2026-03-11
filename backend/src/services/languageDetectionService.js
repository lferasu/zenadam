const AMHARIC_REGEX = /[\u1200-\u137F]/;

export const detectLanguage = (text = '') => {
  if (AMHARIC_REGEX.test(text)) {
    return 'am';
  }

  return 'en';
};
