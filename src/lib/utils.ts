/**
 * Sets optional properties on an object, removing keys whose value is undefined.
 * Required because exactOptionalPropertyTypes distinguishes `key?: T` from `key: T | undefined`.
 */
export function setOpt<T extends Record<string, unknown>>(obj: T, updates: { [K in keyof T]?: T[K] | undefined }): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(updates) as (keyof T)[]) {
    const value = updates[key];
    if (value === undefined) {
      delete result[key as string];
    } else {
      result[key as string] = value;
    }
  }
  return result as T;
}
