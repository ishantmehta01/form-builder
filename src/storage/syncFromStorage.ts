import { load } from './load';
import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';

export function syncFromStorage(): void {
  try {
    const data = load();
    useTemplatesStore.setState({
      templates: data.templates,
      instances: data.instances,
      invalidTemplateIds: data.invalidTemplateIds,
    });
    useInstancesStore.setState({
      instances: data.instances,
      templates: data.templates,
    });
  } catch (err) {
    console.error('[storage] syncFromStorage failed:', err);
  }
}
