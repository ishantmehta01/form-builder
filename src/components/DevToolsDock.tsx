import { useState, useEffect } from 'react';
import { useDevToolsStore, DOCK_PREF_KEY } from '@/stores/devtools';
import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';
import { JsonTree } from './JsonTree';

export function DevToolsDock() {
  const { docked, setDocked, setStorageOpen } = useDevToolsStore();
  const templates = useTemplatesStore((s) => s.templates);
  const instances = useInstancesStore((s) => s.instances);
  const [storageJson, setStorageJson] = useState<unknown>(null);

  // Push page content left when docked so nothing is hidden behind the panel
  useEffect(() => {
    document.body.style.paddingRight = docked ? '360px' : '';
    return () => { document.body.style.paddingRight = ''; };
  }, [docked]);

  // Auto-show if the user docked in a previous session
  useEffect(() => {
    try {
      if (localStorage.getItem(DOCK_PREF_KEY) === 'true') {
        setDocked(true);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-read localStorage whenever either store writes new data
  useEffect(() => {
    refresh();
  }, [templates, instances]); // eslint-disable-line react-hooks/exhaustive-deps

  function refresh() {
    try {
      const raw = localStorage.getItem('formBuilder');
      setStorageJson(raw ? JSON.parse(raw) : null);
    } catch {
      setStorageJson(null);
    }
  }

  if (!docked) return null;

  return (
    <div
      data-testid="dev-tools-dock"
      style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 360, zIndex: 40 }}
      className="flex flex-col border-l border-gray-200 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">localStorage</span>
        <div className="flex items-center gap-1">
          <button
            data-testid="refresh-dock"
            onClick={refresh}
            title="Refresh"
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded"
          >
            ↻
          </button>
          <button
            data-testid="undock-storage-viewer"
            onClick={() => { setDocked(false); setStorageOpen(true); }}
            title="Undock"
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded"
          >
            ← Undock
          </button>
          <button
            data-testid="close-dock"
            onClick={() => setDocked(false)}
            aria-label="Close dock"
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {storageJson !== null
          ? <JsonTree value={storageJson} expandDepth={1} />
          : <p className="p-4 text-sm text-gray-400 italic">(empty — no formBuilder key found)</p>}
      </div>
    </div>
  );
}
