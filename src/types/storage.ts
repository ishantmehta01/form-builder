import type { Template, Instance } from './template';

export const CURRENT_VERSION = 1;

export interface StoredData {
  version: number;
  templates: Record<string, Template>;
  instances: Record<string, Instance>;
}

export type Migration = (data: unknown) => unknown;
export type Migrations = Record<number, Migration>;
