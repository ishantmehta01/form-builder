import { useState, useEffect, useRef } from 'react';
import { JsonTree } from './JsonTree';

export function DevToolsMenu() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [storageData, setStorageData] = useState<{ found: false } | { found: true; value: unknown }>({ found: false });
  const menuRef = useRef<HTMLDivElement>(null);
  const confirmTitleId = 'dev-tools-confirm-title';
  const confirmDescId = 'dev-tools-confirm-desc';
  const storageTitleId = 'dev-tools-storage-title';

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  useEffect(() => {
    if (!confirmOpen && !storageOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setConfirmOpen(false);
        setStorageOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmOpen, storageOpen]);

  function handleClearConfirm() {
    localStorage.removeItem('formBuilder');
    window.location.reload();
  }

  function handleShowStorage() {
    const raw = localStorage.getItem('formBuilder');
    if (raw === null) {
      setStorageData({ found: false });
    } else {
      try {
        setStorageData({ found: true, value: JSON.parse(raw) });
      } catch {
        setStorageData({ found: true, value: raw });
      }
    }
    setOpen(false);
    setStorageOpen(true);
  }

  return (
    <>
      <div
        ref={menuRef}
        style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 50 }}
      >
        <button
          data-testid="dev-tools-button"
          onClick={() => setOpen(prev => !prev)}
          className="w-10 h-10 rounded-full bg-gray-200/70 hover:bg-gray-300/80 text-gray-600 flex items-center justify-center text-lg shadow"
          title="Dev Tools"
        >
          ⚙
        </button>

        {open && (
          <div
            data-testid="dev-tools-menu"
            className="absolute bottom-12 right-0 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
          >
            <button
              data-testid="show-storage-action"
              onClick={handleShowStorage}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Show localStorage
            </button>
            <button
              data-testid="clear-storage-action"
              onClick={() => { setOpen(false); setConfirmOpen(true); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Clear localStorage
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
          >
            <h2 id={confirmTitleId} className="text-base font-semibold text-gray-900 mb-2">
              Clear all data?
            </h2>
            <p id={confirmDescId} className="text-sm text-gray-600 mb-5">
              Delete all templates and responses? This wipes everything in localStorage and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="cancel-clear-storage"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                autoFocus
              >
                Cancel
              </button>
              <button
                data-testid="confirm-clear-storage"
                onClick={handleClearConfirm}
                aria-describedby={confirmDescId}
                className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {storageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setStorageOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={storageTitleId}
            className="bg-white rounded-lg shadow-xl flex flex-col mx-4"
            style={{ width: '700px', maxWidth: '90vw', maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 id={storageTitleId} className="text-base font-semibold text-gray-900">
                localStorage — formBuilder
              </h2>
              <button
                data-testid="close-storage-viewer"
                onClick={() => setStorageOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="overflow-auto flex-1" data-testid="storage-content">
              {storageData.found
                ? <JsonTree value={storageData.value} />
                : <p className="p-5 text-sm text-gray-400 italic">
                    (empty — no formBuilder key found)
                  </p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
