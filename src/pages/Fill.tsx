import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';
import { useToastsStore } from '@/stores/toasts';
import { registry } from '@/registry';
import { evaluate } from '@/engine/evaluate';
import { validateForm } from '@/engine/validateForm';
import type { Values } from '@/types/template';
import type { ValidationError } from '@/types/condition';

export function Fill() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { templates, invalidTemplateIds, loadFromStorage: loadTemplates } = useTemplatesStore();
  const { addInstance, loadFromStorage: loadInstances } = useInstancesStore();
  const pushToast = useToastsStore((s) => s.pushToast);

  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, ValidationError[]>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [visitedFields, setVisitedFields] = useState<Set<string>>(new Set());
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    loadTemplates();
    loadInstances();
  }, [loadTemplates, loadInstances]);

  const template = templateId ? templates[templateId] : undefined;

  if (!template) {
    return <div className="p-8 text-gray-500">Form not found.</div>;
  }

  if (invalidTemplateIds.has(template.id)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-red-600 border border-red-200 rounded p-4">
          This form has invalid conditional logic. It must be fixed in the builder before accepting responses.
        </div>
        <Link to={`/templates/${template.id}/edit`} className="mt-4 inline-block text-blue-600 underline text-sm">
          Open in builder
        </Link>
      </div>
    );
  }

  const engineResult = evaluate(values, template, registry);
  const { visibility, required } = engineResult;

  const handleChange = (fieldId: string, next: unknown) => {
    const nextValues = { ...values, [fieldId]: next };
    if (next === undefined) {
      delete nextValues[fieldId];
    }
    setValues(nextValues);

    // Real-time error clearing for already-errored fields
    if (errors[fieldId]) {
      const nextErrors = { ...errors };
      delete nextErrors[fieldId];
      setErrors(nextErrors);
    }
  };

  const handleBlur = (fieldId: string) => {
    if (!visitedFields.has(fieldId)) {
      setVisitedFields((prev) => new Set([...prev, fieldId]));
    }
    // Validate on blur after first visit
    const result = evaluate(values, template, registry);
    const allErrors = validateForm(template, values, result, registry);
    setErrors((prev) => ({
      ...prev,
      ...(allErrors[fieldId] ? { [fieldId]: allErrors[fieldId]! } : {}),
    }));
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    const result = evaluate(values, template, registry);
    const allErrors = validateForm(template, values, result, registry);
    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      // Scroll to first error
      const firstErrorId = template.fields.find((f) => allErrors[f.id])?.id;
      if (firstErrorId) {
        fieldRefs.current[firstErrorId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      pushToast('Please fix the errors before submitting', 'error');
      return;
    }

    // Build submitted values: visible values + computed calc results for visible calcs
    const submittedValues: Values = {};
    for (const field of template.fields) {
      if (result.visibility[field.id] !== false) {
        const val = result.computedValues[field.id];
        if (val !== undefined) {
          submittedValues[field.id] = val;
        }
      }
    }

    const instance = {
      id: crypto.randomUUID(),
      templateId: template.id,
      templateSnapshot: template,
      values: submittedValues,
      visibility: result.visibility,
      submittedAt: new Date().toISOString(),
    };

    addInstance(instance);
    pushToast('Response submitted');
    navigate(`/instances/${instance.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">← Forms</Link>
        <h1 className="text-2xl font-bold text-gray-900">{template.title}</h1>
      </div>

      <div className="space-y-6">
        {template.fields.map((field) => {
          if (visibility[field.id] === false) return null;

          const fieldErrors = (submitAttempted || visitedFields.has(field.id))
            ? (errors[field.id] ?? [])
            : [];

          return (
            <div
              key={field.id}
              ref={(el) => { fieldRefs.current[field.id] = el; }}
              onBlur={() => handleBlur(field.id)}
            >
              {registry[field.type].renderer({
                field: field as never,
                value: engineResult.computedValues[field.id],
                onChange: (next) => handleChange(field.id, next),
                isRequired: required[field.id] ?? false,
                errors: fieldErrors,
                disabled: field.type === 'calculation',
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-6 py-2.5 rounded font-medium hover:bg-blue-700"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
