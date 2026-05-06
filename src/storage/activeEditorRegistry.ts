let active: { templateId: string; isDirty: boolean } | null = null;

export function setActiveEditor(v: { templateId: string; isDirty: boolean } | null): void {
  active = v;
}

export function getActiveEditor(): { templateId: string; isDirty: boolean } | null {
  return active;
}
