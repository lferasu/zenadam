import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  findRecentCandidateArticles,
  findRepresentativeNormalizedItemForStory,
  reassignStoryForNormalizedItems
} from '../repositories/normalizedItemRepository.js';
import { listSingletonStories, mergeStoryIntoTarget } from '../repositories/storyRepository.js';
import { cosineSimilarity } from '../services/embeddingService.js';
import { evaluateStoryCandidates } from '../services/incrementalClusteringService.js';
import { refreshStoryHeroImage } from '../services/storyImageService.js';
import { ensureRuntimeInitialized } from '../services/runtimeService.js';
import { refreshStoryRanking } from '../ranking/storyRankingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPORT_PATH = path.resolve(__dirname, '../../tmp/story-reconcile-report.json');

const ensureReportDir = async (reportPath) => {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
};

const parseOptions = (options = {}) => {
  const lookbackDays = Number(options.lookbackDays ?? 7);
  const limit = Number(options.limit ?? 200);
  const strongThreshold = Number(options.strongThreshold ?? env.SIMILARITY_STRONG_THRESHOLD);

  return {
    apply: Boolean(options.apply),
    lookbackDays: Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 7,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 200,
    strongThreshold: Number.isFinite(strongThreshold) ? strongThreshold : 0.88,
    reportPath: options.reportPath ?? DEFAULT_REPORT_PATH
  };
};

const buildNearestCandidates = (article, candidates) => {
  return candidates
    .filter((candidate) => candidate.storyId && String(candidate.storyId) !== String(article.storyId))
    .map((candidate) => ({
      ...candidate,
      similarity: cosineSimilarity(article.embedding, candidate.embedding)
    }))
    .filter((candidate) => candidate.similarity >= env.SIMILARITY_BORDERLINE_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, env.MAX_NEAREST_ARTICLES);
};

export const reconcileStories = async (rawOptions = {}) => {
  await ensureRuntimeInitialized();
  const options = parseOptions(rawOptions);
  const since = new Date(Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000);
  const singletonStories = await listSingletonStories({ since, limit: options.limit });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    options: {
      lookbackDays: options.lookbackDays,
      limit: options.limit,
      strongThreshold: options.strongThreshold
    },
    totals: {
      singletonStoriesScanned: singletonStories.length,
      mergeCandidates: 0,
      merged: 0,
      skippedNoRepresentative: 0,
      skippedNoCandidates: 0,
      skippedWeakScore: 0,
      failed: 0
    },
    actions: []
  };

  for (const story of singletonStories) {
    try {
      const representative = await findRepresentativeNormalizedItemForStory(story._id);
      if (!representative || !Array.isArray(representative.embedding) || !representative.embedding.length) {
        report.totals.skippedNoRepresentative += 1;
        report.actions.push({
          sourceStoryId: String(story._id),
          action: 'skip',
          reason: 'no_representative_with_embedding'
        });
        continue;
      }

      const candidateArticles = await findRecentCandidateArticles(representative, {
        candidateWindowHours: env.CANDIDATE_WINDOW_HOURS,
        maxCandidateArticles: env.MAX_CANDIDATE_ARTICLES
      });
      const nearestCandidates = buildNearestCandidates(representative, candidateArticles);

      if (!nearestCandidates.length) {
        report.totals.skippedNoCandidates += 1;
        report.actions.push({
          sourceStoryId: String(story._id),
          action: 'skip',
          reason: 'no_candidate_articles'
        });
        continue;
      }

      const bestStory = evaluateStoryCandidates(representative, nearestCandidates);
      if (!bestStory || bestStory.score < options.strongThreshold) {
        report.totals.skippedWeakScore += 1;
        report.actions.push({
          sourceStoryId: String(story._id),
          action: 'skip',
          reason: 'weak_match_score',
          bestScore: bestStory?.score ?? 0
        });
        continue;
      }

      report.totals.mergeCandidates += 1;
      const action = {
        sourceStoryId: String(story._id),
        targetStoryId: String(bestStory.storyId),
        action: options.apply ? 'merge' : 'would_merge',
        score: bestStory.score
      };

      if (options.apply) {
        await reassignStoryForNormalizedItems({
          fromStoryId: story._id,
          toStoryId: bestStory.storyId
        });

        const mergeResult = await mergeStoryIntoTarget({
          sourceStoryId: story._id,
          targetStoryId: bestStory.storyId
        });

        if (mergeResult.merged) {
          await refreshStoryHeroImage({ storyId: bestStory.storyId });
          await refreshStoryRanking({ storyId: bestStory.storyId });
          report.totals.merged += 1;
        } else {
          report.totals.failed += 1;
          action.action = 'failed_merge';
          action.reason = mergeResult.reason;
        }
      }

      report.actions.push(action);
    } catch (error) {
      report.totals.failed += 1;
      report.actions.push({
        sourceStoryId: String(story._id),
        action: 'error',
        reason: error.message
      });
    }
  }

  await ensureReportDir(options.reportPath);
  await fs.writeFile(options.reportPath, JSON.stringify(report, null, 2), 'utf-8');

  logger.info('Story reconciliation completed', {
    mode: report.mode,
    scanned: report.totals.singletonStoriesScanned,
    mergeCandidates: report.totals.mergeCandidates,
    merged: report.totals.merged,
    reportPath: options.reportPath
  });

  return {
    reportPath: options.reportPath,
    report
  };
};
