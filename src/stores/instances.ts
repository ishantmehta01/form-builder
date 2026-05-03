import { create } from 'zustand';
import type { Instance } from '@/types/template';
import { load } from '@/storage/load';
import { save } from '@/storage/save';

interface InstancesState {
  instances: Record<string, Instance>;
  templates: Record<string, import('@/types/template').Template>;

  loadFromStorage: () => void;
  addInstance: (instance: Instance) => void;
}

export const useInstancesStore = create<InstancesState>((set, get) => ({
  instances: {},
  templates: {},

  loadFromStorage: () => {
    try {
      const data = load();
      set({ instances: data.instances, templates: data.templates });
    } catch (err) {
      console.error('[store] Failed to load instances:', err);
    }
  },

  addInstance: (instance) => {
    const { instances, templates } = get();
    const next = { ...instances, [instance.id]: instance };
    set({ instances: next });
    save({ templates, instances: next });
  },
}));
