import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_STATUS, SOURCE_TYPES } from '../models/Source.js';
import { upsertSourceBySlug } from '../repositories/sourceRepository.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_CONFIG_PATH = path.resolve(__dirname, '../../examples/source-configs.json');

const VALID_SOURCE_TYPES = new Set(Object.values(SOURCE_TYPES));
const VALID_SOURCE_STATUSES = new Set(Object.values(SOURCE_STATUS));

const loadSourceConfigs = async () => {
  const raw = await fs.readFile(SOURCE_CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Source config file must contain a non-empty array.');
  }

  return parsed.map((source, index) => {
    if (!source?.slug || !source?.name) {
      throw new Error(`Source config at index ${index} is missing slug or name.`);
    }

    if (!VALID_SOURCE_TYPES.has(source.type)) {
      throw new Error(`Source ${source.slug} has invalid type "${source.type}".`);
    }

    if (source.status && !VALID_SOURCE_STATUSES.has(source.status)) {
      throw new Error(`Source ${source.slug} has invalid status "${source.status}".`);
    }

    if (!Array.isArray(source.entryUrls) || source.entryUrls.length === 0) {
      throw new Error(`Source ${source.slug} must define at least one entry URL.`);
    }

    return {
      ...source,
      status: source.status ?? SOURCE_STATUS.ACTIVE
    };
  });
};

export const ensureDefaultSources = async () => {
  await ensureRuntimeInitialized();

  const sourceConfigs = await loadSourceConfigs();
  const results = [];

  for (const sourceConfig of sourceConfigs) {
    const result = await upsertSourceBySlug(sourceConfig);
    const createdAt = result?.createdAt?.getTime?.() ?? null;
    const updatedAt = result?.updatedAt?.getTime?.() ?? null;

    results.push({
      slug: result.slug,
      created: createdAt !== null && updatedAt !== null && createdAt === updatedAt,
      source: result
    });
  }

  return {
    created: results.some((result) => result.created),
    createdCount: results.filter((result) => result.created).length,
    updatedCount: results.filter((result) => !result.created).length,
    total: results.length,
    source: results[0]?.source ?? null,
    results
  };
};
