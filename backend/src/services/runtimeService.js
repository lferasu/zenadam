import { getDb } from '../config/database.js';
import { ensureModelIndexes } from '../models/index.js';

let runtimeInitPromise;

export const ensureRuntimeInitialized = async () => {
  if (runtimeInitPromise) {
    return runtimeInitPromise;
  }

  runtimeInitPromise = (async () => {
    const db = await getDb();
    await ensureModelIndexes(db);
  })();

  return runtimeInitPromise;
};
