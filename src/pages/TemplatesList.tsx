import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';
import { useToastsStore } from '@/stores/toasts';

export function TemplatesList() {
  const { templates, invalidTemplateIds, loadFromStorage, deleteTemplate } = useTemplatesStore();
  const { instances } = useInstancesStore();
  const pushToast = useToastsStore((s) => s.pushToast);

  // Compute instance count per template once per render — used for both card display and delete confirm
  const instanceCountByTemplate: Record<string, number> = {};
  for (const inst of Object.values(instances)) {
    instanceCountByTemplate[inst.templateId] = (instanceCountByTemplate[inst.templateId] ?? 0) + 1;
  }

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const list = Object.values(templates).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="templates-list">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
        <Link
          to="/templates/new"
          data-testid="new-template-button"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
        >
          + New form
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No forms yet.</p>
          <p className="text-sm mt-1">Create your first form to get started.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((t) => {
            const isInvalid = invalidTemplateIds.has(t.id);
            const responseCount = instanceCountByTemplate[t.id] ?? 0;
            return (
              <li key={t.id} className="border rounded-lg p-4 bg-white flex items-center justify-between" data-testid={`template-card-${t.id}`}>
                <div>
                  <div className="font-medium text-gray-900">{t.title || 'Untitled'}</div>
                  <div className="text-xs text-gray-400 mt-0.5" data-testid={`template-meta-${t.id}`}>
                    {t.fields.length} field{t.fields.length !== 1 ? 's' : ''} ·{' '}
                    {responseCount} response{responseCount !== 1 ? 's' : ''} ·{' '}
                    Modified {new Date(t.modifiedAt).toLocaleDateString()}
                  </div>
                  {isInvalid && (
                    <div className="text-xs text-red-600 mt-1" data-testid={`quarantine-badge-${t.id}`}>
                      ⚠ Invalid conditional logic — open in builder to fix. New responses disabled.
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/templates/${t.id}/edit`}
                    data-testid={`open-template-${t.id}`}
                    className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  {!isInvalid && (
                    <Link
                      to={`/templates/${t.id}/fill`}
                      data-testid={`new-response-${t.id}`}
                      className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Fill
                    </Link>
                  )}
                  <Link
                    to={`/templates/${t.id}/instances`}
                    className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
                  >
                    Responses
                  </Link>
                  <button
                    type="button"
                    data-testid={`delete-template-${t.id}`}
                    onClick={() => {
                      const instanceCount = responseCount;
                      const responsePart = instanceCount === 0
                        ? ''
                        : instanceCount === 1
                          ? ' 1 filled response will also be deleted.'
                          : ` ${instanceCount} filled responses will also be deleted.`;
                      const message = `Delete template '${t.title}'?${responsePart} This cannot be undone.`;
                      if (window.confirm(message)) {
                        deleteTemplate(t.id);
                        pushToast('Form deleted');
                      }
                    }}
                    className="text-sm px-3 py-1.5 text-red-500 border border-red-200 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
