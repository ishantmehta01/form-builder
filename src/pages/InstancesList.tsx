import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';
import { exportCSV } from '@/lib/csv';

export function InstancesList() {
  const { templateId } = useParams<{ templateId: string }>();
  const { templates, loadFromStorage: loadTemplates } = useTemplatesStore();
  const { instances, loadFromStorage: loadInstances } = useInstancesStore();

  useEffect(() => {
    loadTemplates();
    loadInstances();
  }, [loadTemplates, loadInstances]);

  const template = templateId ? templates[templateId] : undefined;
  const templateInstances = Object.values(instances)
    .filter((i) => i.templateId === templateId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  if (!template) {
    return <div className="p-8 text-gray-500">Template not found.</div>;
  }

  const handleExportCSV = () => {
    exportCSV(templateInstances, `${template.title.replace(/[^a-z0-9]/gi, '_')}_responses.csv`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">← Forms</Link>
        <h1 className="text-2xl font-bold text-gray-900">{template.title} — Responses</h1>
      </div>

      <div className="flex gap-3 mb-6">
        <Link
          to={`/templates/${templateId}/fill`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
        >
          + New response
        </Link>
        {templateInstances.length > 0 && (
          <button
            type="button"
            onClick={handleExportCSV}
            className="border px-4 py-2 rounded hover:bg-gray-50 text-sm"
          >
            Export CSV
          </button>
        )}
      </div>

      {templateInstances.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No responses yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {templateInstances.map((inst) => (
            <li key={inst.id} className="border rounded-lg p-4 bg-white flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Response #{inst.id.slice(-6)}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Submitted {new Date(inst.submittedAt).toLocaleString()}
                </div>
              </div>
              <Link
                to={`/instances/${inst.id}`}
                className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
