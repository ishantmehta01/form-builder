import type { StoredData } from '@/types/storage';
import { CURRENT_VERSION } from '@/types/storage';

const STORAGE_KEY = 'formBuilder';

export function save(data: Omit<StoredData, 'version'>): void {
  const stored: StoredData = { version: CURRENT_VERSION, ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}
