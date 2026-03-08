import { clusterNormalizedItems } from '../clustering/storyClusterer.js';
import { STORY_STATUS } from '../models/Story.js';
import { findUnclusteredNormalizedItems, markNormalizedItemsClustered } from '../repositories/normalizedItemRepository.js';
import { listActiveStories, upsertStoryByClusterKey } from '../repositories/storyRepository.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

export const generateStoriesFromNormalizedItems = async ({ limit = 250 } = {}) => {
  await ensureRuntimeInitialized();

  const items = await findUnclusteredNormalizedItems(limit);
  if (!items.length) {
    return { scanned: 0, generated: 0 };
  }

  const clusters = clusterNormalizedItems(items);
  let generated = 0;

  for (const cluster of clusters) {
    await upsertStoryByClusterKey({
      ...cluster,
      status: STORY_STATUS.ACTIVE
    });
    await markNormalizedItemsClustered(
      cluster.normalizedItemIds.map((id) => String(id)),
      cluster.clusterKey
    );
    generated += 1;
  }

  return {
    scanned: items.length,
    generated
  };
};

export const getFeedStories = async ({ limit = 25 } = {}) => {
  await ensureRuntimeInitialized();

  const stories = await listActiveStories({ limit });

  return stories.map((story) => ({
    id: String(story._id),
    title: story.title,
    summary: story.summary,
    heroImageUrl: null,
    sourceCount: Array.isArray(story.sourceIds) ? story.sourceIds.length : 0,
    itemCount: Array.isArray(story.itemIds) ? story.itemIds.length : 0,
    updatedAt: story.updatedAt?.toISOString?.() ?? null,
    language: story.language
  }));
};
