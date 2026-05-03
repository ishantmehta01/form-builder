import type { StoredData } from '@/types/storage';
import { CURRENT_VERSION } from '@/types/storage';
import { migrations } from './migrations';
import { findCycle } from '@/engine/graph';
import { buildConditionGraph } from '@/engine/graph';

const STORAGE_KEY = 'formBuilder';

function isStoredData(v: unknown): v is StoredData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'version' in v &&
    typeof (v as Record<string, unknown>).version === 'number' &&
    'templates' in v &&
    'instances' in v
  );
}

export function load(): StoredData & { invalidTemplateIds: Set<string> } {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === null) {
    return { version: CURRENT_VERSION, templates: {}, instances: {}, invalidTemplateIds: new Set() };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[storage] JSON parse failure — returning empty state');
    return { version: CURRENT_VERSION, templates: {}, instances: {}, invalidTemplateIds: new Set() };
  }

  if (!isStoredData(parsed)) {
    console.error('[storage] Stored data does not match expected shape — returning empty state');
    return { version: CURRENT_VERSION, templates: {}, instances: {}, invalidTemplateIds: new Set() };
  }

  if (parsed.version > CURRENT_VERSION) {
    throw new Error(
      `Data version ${parsed.version} is newer than app version ${CURRENT_VERSION}. Please update the app.`,
    );
  }

  // Run migrations
  let data: unknown = parsed;
  for (let v = parsed.version; v < CURRENT_VERSION; v++) {
    const migration = migrations[v];
    if (!migration) {
      throw new Error(`Missing migration from version ${v} to ${v + 1}`);
    }
    data = migration(data);
  }

  if (!isStoredData(data)) {
    throw new Error('Data became invalid after migrations');
  }

  // Load-time cycle re-validation (P3)
  const invalidTemplateIds = new Set<string>();
  for (const template of Object.values(data.templates)) {
    const graph = buildConditionGraph(template);
    const cycle = findCycle(graph);
    if (cycle !== null) {
      console.warn(`[storage] Template "${template.id}" has cycle: ${cycle.join(' → ')} — quarantined`);
      invalidTemplateIds.add(template.id);
    }
  }

  return { ...data, invalidTemplateIds };
}
