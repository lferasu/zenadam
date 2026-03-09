import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../config/logger.js';
import { deleteSourcesByIds } from '../repositories/sourceRepository.js';
import { runSourceAudit } from './sourceAudit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PRUNE_REPORT_PATH = path.resolve(__dirname, '../../tmp/source-prune-report.json');

const ensureReportDir = async (reportPath) => {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
};

export const pruneFailedSources = async ({ apply = false, writeBack = true, reportPath = DEFAULT_PRUNE_REPORT_PATH } = {}) => {
  const { report: auditReport } = await runSourceAudit({ writeBack });
  const failedSources = auditReport.results.filter((result) => result.status === 'fail');
  const sourceIds = failedSources.map((source) => source.sourceId).filter(Boolean);

  const deletion = apply
    ? await deleteSourcesByIds(sourceIds)
    : { deletedCount: 0 };

  const pruneReport = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    totals: {
      audited: auditReport.summary.totalSourcesAudited,
      failedCandidates: failedSources.length,
      deleted: deletion.deletedCount
    },
    failedSources: failedSources.map((source) => ({
      sourceId: source.sourceId,
      slug: source.slug,
      name: source.name,
      type: source.type,
      reason: source.reason
    }))
  };

  await ensureReportDir(reportPath);
  await fs.writeFile(reportPath, JSON.stringify(pruneReport, null, 2), 'utf-8');

  logger.info('Source prune completed', {
    mode: pruneReport.mode,
    failedCandidates: pruneReport.totals.failedCandidates,
    deleted: pruneReport.totals.deleted,
    reportPath
  });

  return {
    pruneReport,
    reportPath
  };
};
