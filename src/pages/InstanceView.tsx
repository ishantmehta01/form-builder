import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInstancesStore } from '@/stores/instances';
import { registry } from '@/registry';
import { triggerPrint } from '@/lib/pdf';
import '@/lib/pdf.css';

export function InstanceView() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { instances, loadFromStorage } = useInstancesStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const instance = instanceId ? instances[instanceId] : undefined;
  if (!instance) {
    return <div className="p-8 text-gray-500">Response not found.</div>;
  }

  const { templateSnapshot, values, visibility } = instance;

  return (
    <>
      {/* Print region — only this shows when printing */}
      <div id="print-region" style={{ display: 'none' }}>
        <h1 style={{ fontSize: '18pt', fontWeight: 'bold', marginBottom: '8pt' }}>{templateSnapshot.title}</h1>
        <p style={{ fontSize: '9pt', color: '#666', marginBottom: '16pt' }}>
          Submitted: {new Date(instance.submittedAt).toLocaleString()}
        </p>
        {templateSnapshot.fields.map((field) => {
          if (visibility[field.id] === false) return null;
          const value = values[field.id];
          return (
            <div key={field.id}>
              {registry[field.type].pdfRenderer(
                field as never,
                value ?? undefined,
              )}
            </div>
          );
        })}
      </div>

      {/* Screen region */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/templates/${instance.templateId}/instances`} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Responses
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{templateSnapshot.title}</h1>
        </div>

        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={triggerPrint}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
          >
            Download PDF
          </button>
        </div>

        <div className="text-xs text-gray-400 mb-4">
          Submitted {new Date(instance.submittedAt).toLocaleString()}
        </div>

        <div className="border rounded-lg p-6 bg-white space-y-4">
          {templateSnapshot.fields.map((field) => {
            if (visibility[field.id] === false) return null;
            const value = values[field.id];
            return (
              <div key={field.id}>
                {registry[field.type].renderer({
                  field: field as never,
                  value: value ?? undefined,
                  onChange: () => undefined,
                  isRequired: false,
                  errors: [],
                  disabled: true,
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
