import { useEffect } from 'react';
import { syncFromStorage } from './syncFromStorage';
import { getActiveEditor } from './activeEditorRegistry';
import { load } from './load';
import { useTemplatesStore } from '@/stores/templates';
import { useToastsStore } from '@/stores/toasts';

export function useStorageSync(): void {
  useEffect(() => {
    syncFromStorage();

    const handler = (e: StorageEvent) => {
      if (e.key !== 'formBuilder' && e.key !== null) return;

      if (e.key === null) {
        syncFromStorage();
        return;
      }

      const active = getActiveEditor();
      if (active?.isDirty) {
        try {
          const incoming = load();
          const currentTemplate = useTemplatesStore.getState().templates[active.templateId];
          const incomingTemplate = incoming.templates[active.templateId];

          if (incomingTemplate && JSON.stringify(incomingTemplate) !== JSON.stringify(currentTemplate)) {
            useToastsStore.getState().pushToast(
              'Another tab changed this form. Reload to see changes.',
              'info',
              Infinity,
              { label: 'Reload', onClick: () => window.location.reload() },
            );
            return;
          }
        } catch {
          return;
        }
      }

      syncFromStorage();
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
}
