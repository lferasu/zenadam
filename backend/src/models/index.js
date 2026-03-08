import { createNormalizedItemIndexes } from './NormalizedItem.js';
import { createSourceIndexes } from './Source.js';
import { createSourceItemIndexes } from './SourceItem.js';
import { createStoryIndexes } from './Story.js';

export { SOURCE_COLLECTION, SOURCE_STATUS, SOURCE_TYPES } from './Source.js';
export { SOURCE_ITEM_COLLECTION, SOURCE_ITEM_INGEST_STATUS } from './SourceItem.js';
export { NORMALIZED_ITEM_COLLECTION } from './NormalizedItem.js';
export { STORY_COLLECTION, STORY_STATUS } from './Story.js';

export const ensureModelIndexes = async (db) => {
  await Promise.all([
    createSourceIndexes(db),
    createSourceItemIndexes(db),
    createNormalizedItemIndexes(db),
    createStoryIndexes(db)
  ]);
};
