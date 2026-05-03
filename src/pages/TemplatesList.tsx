import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTemplatesStore } from '@/stores/templates';

export function TemplatesList() {
  const { templates, invalidTemplateIds, loadFromStorage, deleteTemplate } = useTemplatesStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const list = Object.values(templates).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
        <Link
          to="/templates/new"
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
            return (
              <li key={t.id} className="border rounded-lg p-4 bg-white flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{t.title || 'Untitled'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.fields.length} field{t.fields.length !== 1 ? 's' : ''} ·
                    Modified {new Date(t.modifiedAt).toLocaleDateString()}
                  </div>
                  {isInvalid && (
                    <div className="text-xs text-red-600 mt-1">
                      ⚠ Invalid conditional logic — open in builder to fix. New responses disabled.
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/templates/${t.id}/edit`}
                    className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  {!isInvalid && (
                    <Link
                      to={`/templates/${t.id}/fill`}
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
                    onClick={() => {
                      if (window.confirm(`Delete "${t.title}"? This cannot be undone.`)) {
                        deleteTemplate(t.id);
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
