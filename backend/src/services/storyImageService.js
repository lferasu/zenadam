import { listStoryImageCandidates } from '../repositories/normalizedItemRepository.js';
import { updateStoryHeroImage } from '../repositories/storyRepository.js';

const toTime = (value) => {
  const date = value ? new Date(value) : null;
  return Number.isFinite(date?.getTime()) ? date.getTime() : 0;
};

const toArea = (image) => {
  if (!image?.width || !image?.height) {
    return 0;
  }

  return Number(image.width) * Number(image.height);
};

const hasValidImage = (item) => typeof item?.image?.url === 'string' && item.image.url.trim().length > 0;

export const selectStoryHeroImage = (items = []) => {
  const candidates = items.filter(hasValidImage);
  if (!candidates.length) {
    return null;
  }

  const sorted = [...candidates].sort((left, right) => {
    const areaDelta = toArea(right.image) - toArea(left.image);
    if (areaDelta !== 0) {
      return areaDelta;
    }

    const publishedDelta = toTime(right.publishedAt ?? right.updatedAt ?? right.createdAt) - toTime(left.publishedAt ?? left.updatedAt ?? left.createdAt);
    if (publishedDelta !== 0) {
      return publishedDelta;
    }

    return 0;
  });

  const winner = sorted[0];
  const bestResolutionAvailable = toArea(winner.image) > 0;
  const mostRecentAvailable = !bestResolutionAvailable && candidates.some((item) => toTime(item.publishedAt ?? item.updatedAt ?? item.createdAt) > 0);

  return {
    url: winner.image.url,
    sourceItemId: winner.sourceItemId ?? winner._id,
    selectionReason: bestResolutionAvailable ? 'best_resolution' : mostRecentAvailable ? 'most_recent' : 'first_valid',
    ...(winner.image.width ? { width: winner.image.width } : {}),
    ...(winner.image.height ? { height: winner.image.height } : {}),
    updatedAt: new Date()
  };
};

export const refreshStoryHeroImage = async ({ storyId, deps = {} }) => {
  const listCandidates = deps.listStoryImageCandidates ?? listStoryImageCandidates;
  const persistHeroImage = deps.updateStoryHeroImage ?? updateStoryHeroImage;

  const items = await listCandidates(storyId);
  const heroImage = selectStoryHeroImage(items);
  await persistHeroImage({ storyId, heroImage });

  return heroImage;
};
