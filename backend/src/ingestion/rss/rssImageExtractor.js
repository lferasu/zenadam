const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;
const BAD_PATH_HINTS = ['logo', 'icon', 'avatar', 'sprite'];

const asArray = (value) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const normalizeDimension = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const toAbsoluteHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const hasBadPathHint = (url) => {
  const pathname = url.toLowerCase();
  return BAD_PATH_HINTS.some((hint) => pathname.includes(hint));
};

const looksLikeImageMime = (value) => typeof value === 'string' && value.toLowerCase().startsWith('image/');

const passesDimensionCheck = (width, height) => {
  if (width && width < MIN_WIDTH) {
    return false;
  }

  if (height && height < MIN_HEIGHT) {
    return false;
  }

  return true;
};

const toImageCandidate = ({ url, source, width, height }) => {
  const normalizedUrl = toAbsoluteHttpUrl(url);
  if (!normalizedUrl || hasBadPathHint(normalizedUrl)) {
    return null;
  }

  const normalizedWidth = normalizeDimension(width);
  const normalizedHeight = normalizeDimension(height);
  if (!passesDimensionCheck(normalizedWidth, normalizedHeight)) {
    return null;
  }

  return {
    url: normalizedUrl,
    source,
    ...(normalizedWidth ? { width: normalizedWidth } : {}),
    ...(normalizedHeight ? { height: normalizedHeight } : {})
  };
};

const extractHtmlImageUrl = (html) => {
  if (typeof html !== 'string' || !html.trim()) {
    return null;
  }

  const match = html.match(/<img[^>]+src=["']([^"' >]+)["']/i);
  return match?.[1] ?? null;
};

const extractFromMediaContent = (entry) => {
  const candidates = [
    ...asArray(entry?.['media:content']),
    ...asArray(entry?.media?.content)
  ];

  for (const candidate of candidates) {
    const image = toImageCandidate({
      url: candidate?.url ?? candidate?.href,
      source: 'rss_media_content',
      width: candidate?.width,
      height: candidate?.height
    });

    if (image) {
      return image;
    }
  }

  return null;
};

const extractFromMediaThumbnail = (entry) => {
  const candidates = [
    ...asArray(entry?.['media:thumbnail']),
    ...asArray(entry?.media?.thumbnail)
  ];

  for (const candidate of candidates) {
    const image = toImageCandidate({
      url: candidate?.url ?? candidate?.href,
      source: 'rss_media_thumbnail',
      width: candidate?.width,
      height: candidate?.height
    });

    if (image) {
      return image;
    }
  }

  return null;
};

const extractFromEnclosure = (entry) => {
  const candidates = asArray(entry?.enclosure);

  for (const candidate of candidates) {
    if (!looksLikeImageMime(candidate?.type)) {
      continue;
    }

    const image = toImageCandidate({
      url: candidate?.url ?? candidate?.href,
      source: 'rss_enclosure',
      width: candidate?.width,
      height: candidate?.height
    });

    if (image) {
      return image;
    }
  }

  return null;
};

const extractFromItunesImage = (entry) => {
  const candidate = entry?.['itunes:image'] ?? entry?.itunes?.image;

  return toImageCandidate({
    url: candidate?.href ?? candidate?.url ?? candidate,
    source: 'rss_itunes_image'
  });
};

const extractFromHtmlField = (value, source) => {
  const url = extractHtmlImageUrl(typeof value === 'string' ? value : value?.['#text']);
  return toImageCandidate({ url, source });
};

export const extractImageFromRssEntry = (entry) => {
  const extractors = [
    () => extractFromMediaContent(entry),
    () => extractFromMediaThumbnail(entry),
    () => extractFromEnclosure(entry),
    () => extractFromItunesImage(entry),
    () => extractFromHtmlField(entry?.['content:encoded'] ?? entry?.content, 'rss_content_image'),
    () => extractFromHtmlField(entry?.description ?? entry?.summary, 'rss_description_image')
  ];

  for (const extractor of extractors) {
    const image = extractor();
    if (image) {
      return image;
    }
  }

  return null;
};
