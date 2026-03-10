import { env } from '../config/env.js';
import { generateStorySummary } from '../ai/index.js';
import {
  listStoryArticlesForSummary,
  updateStorySummaryFailed,
  updateStorySummaryProcessing,
  updateStorySummaryReady
} from '../repositories/storyRepository.js';

export const refreshStorySummary = async ({ storyId }) => {
  if (!env.ZENADAM_ENABLE_STORY_SUMMARY_REFRESH) {
    return { refreshed: false, reason: 'story_summary_refresh_disabled' };
  }

  await updateStorySummaryProcessing({
    storyId,
    targetLanguage: env.ZENADAM_TARGET_LANGUAGE
  });

  try {
    const articles = await listStoryArticlesForSummary({ storyId, limit: 12 });
    const summary = await generateStorySummary({
      articles,
      targetLanguage: env.ZENADAM_TARGET_LANGUAGE
    });

    await updateStorySummaryReady({
      storyId,
      storyTitle: summary.storyTitle,
      storySummary: summary.storySummary,
      targetLanguage: summary.targetLanguage
    });

    return { refreshed: true };
  } catch (error) {
    await updateStorySummaryFailed({ storyId, error: error.message });
    return { refreshed: false, reason: error.message };
  }
};
