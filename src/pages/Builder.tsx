import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTemplatesStore } from "@/stores/templates";
import { useToastsStore } from "@/stores/toasts";
import { registry } from "@/registry";
import { findCycle, buildConditionGraph } from "@/engine/graph";
import type { Field, FieldType } from "@/types/field";
import type { Template } from "@/types/template";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  textarea: "Text Area",
  number: "Number",
  date: "Date",
  single_select: "Single Select",
  multi_select: "Multi Select",
  file: "File Upload",
  section_header: "Section Header",
  calculation: "Calculation",
};

function newField(type: FieldType): Field {
  const mod = registry[type];
  const base = {
    id: crypto.randomUUID(),
    label: FIELD_TYPE_LABELS[type],
    conditions: [],
    conditionLogic: "OR" as const,
    defaultVisible: true,
  };

  if (type === "section_header" || type === "calculation") {
    return { ...base, type, config: mod.defaultConfig } as Field;
  }
  return {
    ...base,
    type,
    defaultRequired: false,
    config: mod.defaultConfig,
  } as Field;
}

interface SortableFieldItemProps {
  field: Field;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  hasDependents: boolean;
}

function SortableFieldItem({
  field,
  isSelected,
  onSelect,
  onDelete,
  hasDependents,
}: SortableFieldItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded p-3 cursor-pointer flex items-center gap-2 group ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        className="text-gray-300 cursor-grab hover:text-gray-500 shrink-0"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-800 truncate">
          {field.label || "(untitled)"}
        </div>
        <div className="text-xs text-gray-400">
          {FIELD_TYPE_LABELS[field.type]}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasDependents) {
            if (
              !window.confirm(
                "Other fields reference this field. Delete anyway?",
              )
            )
              return;
          }
          onDelete();
        }}
        className="text-gray-300 hover:text-red-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete field"
      >
        ✕
      </button>
    </div>
  );
}

function ConditionEditor({
  field,
  allFields,
  onChange,
}: {
  field: Field;
  allFields: Field[];
  onChange: (f: Field) => void;
}) {
  const targets = allFields.filter((f) => f.id !== field.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Combine conditions with</span>
        <select
          className="border rounded px-2 py-1 text-xs"
          value={field.conditionLogic}
          onChange={(e) =>
            onChange({
              ...field,
              conditionLogic: e.target.value as "AND" | "OR",
            })
          }
        >
          <option value="OR">OR</option>
          <option value="AND">AND</option>
        </select>
      </div>

      {field.conditions.map((cond, idx) => {
        const target = allFields.find((f) => f.id === cond.targetId);
        const ops = target ? registry[target.type].operators : [];
        return (
          <div
            key={idx}
            className="border rounded p-2 text-xs space-y-1.5 bg-gray-50"
          >
            <div className="flex gap-1">
              <select
                className="border rounded px-1 py-0.5 flex-1"
                value={cond.effect}
                onChange={(e) => {
                  const conditions = [...field.conditions];
                  conditions[idx] = {
                    ...cond,
                    effect: e.target
                      .value as import("@/types/condition").Effect,
                  };
                  onChange({ ...field, conditions });
                }}
              >
                <option value="show">Show</option>
                <option value="hide">Hide</option>
                <option value="require">Require</option>
                <option value="not_require">Not require</option>
              </select>
              <span className="py-0.5 text-gray-500">if</span>
              <select
                className="border rounded px-1 py-0.5 flex-1"
                value={cond.targetId}
                onChange={(e) => {
                  const newTarget = allFields.find(
                    (f) => f.id === e.target.value,
                  );
                  if (!newTarget) return;
                  const newOps = registry[newTarget.type].operators;
                  const newOp = newOps[0];
                  if (!newOp) return;
                  const conditions = [...field.conditions];
                  conditions[idx] = {
                    targetId: e.target.value,
                    effect: cond.effect,
                    operator: newOp,
                    value: "",
                  } as typeof cond;
                  onChange({ ...field, conditions });
                }}
              >
                <option value="">— pick field —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label || "(untitled)"}
                  </option>
                ))}
              </select>
            </div>
            {cond.targetId && ops.length > 0 && (
              <div className="flex gap-1">
                <select
                  className="border rounded px-1 py-0.5 flex-1"
                  value={cond.operator}
                  onChange={(e) => {
                    // Reset value to a sensible default for the NEW operator's expected shape.
                    // Always-'' was wrong for number/multi/within_range operators.
                    const newOp = e.target.value;
                    const defaultValue: unknown =
                      newOp === "number_within_range"
                        ? [0, 0]
                        : newOp.startsWith("number_")
                          ? 0
                          : newOp.startsWith("multi_")
                            ? []
                            : "";
                    const conditions = [...field.conditions];
                    conditions[idx] = {
                      ...cond,
                      operator: newOp as typeof cond.operator,
                      value: defaultValue,
                    } as typeof cond;
                    onChange({ ...field, conditions });
                  }}
                >
                  {ops.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                {(() => {
                  // Per-operator value editor. A bare text input is wrong for
                  // every operator except text_*: select operators compare against
                  // option IDs (UUIDs), multi_contains_* expects string[], date_*
                  // expects YYYY-MM-DD, number_within_range expects [min, max].
                  // Storing the raw label/string here was the S8 bug — engine
                  // compared "Yes" against the option's UUID and never matched.
                  const op = cond.operator;
                  const updateValue = (val: unknown) => {
                    const conditions = [...field.conditions];
                    conditions[idx] = { ...cond, value: val } as typeof cond;
                    onChange({ ...field, conditions });
                  };

                  // Single-select option picker (stores option ID)
                  if (op === "select_equals" || op === "select_not_equals") {
                    const opts =
                      target && target.type === "single_select"
                        ? target.config.options
                        : [];
                    return (
                      <select
                        className="border rounded px-1 py-0.5 flex-1"
                        value={typeof cond.value === "string" ? cond.value : ""}
                        onChange={(e) => updateValue(e.target.value)}
                      >
                        <option value="">— pick option —</option>
                        {opts.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    );
                  }

                  // Multi-select option pickers (stores string[])
                  if (
                    op === "multi_contains_any" ||
                    op === "multi_contains_all" ||
                    op === "multi_contains_none"
                  ) {
                    const opts =
                      target && target.type === "multi_select"
                        ? target.config.options
                        : [];
                    const selected = Array.isArray(cond.value)
                      ? (cond.value as string[])
                      : [];
                    return (
                      <div className="flex flex-col gap-0.5 flex-1 border rounded px-1 py-1">
                        {opts.length === 0 && (
                          <span className="text-xs text-gray-400 italic">
                            target has no options
                          </span>
                        )}
                        {opts.map((opt) => (
                          <label
                            key={opt.id}
                            className="flex items-center gap-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(opt.id)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selected, opt.id]
                                  : selected.filter((id) => id !== opt.id);
                                updateValue(next);
                              }}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    );
                  }

                  // Number within range — two number inputs (stores [min, max])
                  if (op === "number_within_range") {
                    const range: [number, number] =
                      Array.isArray(cond.value) && cond.value.length === 2
                        ? (cond.value as [number, number])
                        : [0, 0];
                    return (
                      <div className="flex gap-1 flex-1 items-center">
                        <input
                          type="number"
                          className="border rounded px-1 py-0.5 w-full"
                          placeholder="min"
                          value={range[0]}
                          onChange={(e) =>
                            updateValue([
                              parseFloat(e.target.value) || 0,
                              range[1],
                            ])
                          }
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                          type="number"
                          className="border rounded px-1 py-0.5 w-full"
                          placeholder="max"
                          value={range[1]}
                          onChange={(e) =>
                            updateValue([
                              range[0],
                              parseFloat(e.target.value) || 0,
                            ])
                          }
                        />
                      </div>
                    );
                  }

                  // Number scalar (stores number)
                  if (
                    op === "number_equals" ||
                    op === "number_gt" ||
                    op === "number_lt"
                  ) {
                    return (
                      <input
                        type="number"
                        className="border rounded px-1 py-0.5 flex-1"
                        placeholder="value"
                        value={typeof cond.value === "number" ? cond.value : ""}
                        onChange={(e) =>
                          updateValue(parseFloat(e.target.value) || 0)
                        }
                      />
                    );
                  }

                  // Date (stores YYYY-MM-DD string)
                  if (
                    op === "date_equals" ||
                    op === "date_before" ||
                    op === "date_after"
                  ) {
                    return (
                      <input
                        type="date"
                        className="border rounded px-1 py-0.5 flex-1"
                        value={typeof cond.value === "string" ? cond.value : ""}
                        onChange={(e) => updateValue(e.target.value)}
                      />
                    );
                  }

                  // Default: text operators (text_equals / text_not_equals / text_contains)
                  return (
                    <input
                      className="border rounded px-1 py-0.5 flex-1"
                      placeholder="value"
                      value={typeof cond.value === "string" ? cond.value : ""}
                      onChange={(e) => updateValue(e.target.value)}
                    />
                  );
                })()}
              </div>
            )}
            <button
              type="button"
              className="text-red-500 text-xs"
              onClick={() => {
                const conditions = field.conditions.filter((_, i) => i !== idx);
                onChange({ ...field, conditions });
              }}
            >
              Remove condition
            </button>
          </div>
        );
      })}

      <button
        type="button"
        className="text-blue-600 text-xs"
        onClick={() => {
          const firstTarget = targets[0];
          if (!firstTarget) return;
          const op = registry[firstTarget.type].operators[0];
          if (!op) return;
          const newCond = {
            targetId: firstTarget.id,
            effect: "show" as const,
            operator: op,
            value: "",
          } as Field["conditions"][0];
          onChange({ ...field, conditions: [...field.conditions, newCond] });
        }}
      >
        + Add condition
      </button>
    </div>
  );
}

interface ConfigPanelProps {
  field: Field;
  allFields: Field[];
  onChange: (f: Field) => void;
}

function ConfigPanel({ field, allFields, onChange }: ConfigPanelProps) {
  const mod = registry[field.type];
  const ConfigEditor = mod.configEditor;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Label
        </label>
        <input
          className="border rounded px-2 py-1 w-full text-sm"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>

      {"defaultRequired" in field && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.defaultRequired}
            onChange={(e) =>
              onChange({ ...field, defaultRequired: e.target.checked } as Field)
            }
          />
          Required by default
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={field.defaultVisible}
          onChange={(e) =>
            onChange({ ...field, defaultVisible: e.target.checked })
          }
        />
        Visible by default
      </label>

      <div>
        <div className="text-xs font-medium text-gray-600 mb-2">
          Field settings
        </div>
        <ConfigEditor
          config={field.config as never}
          onChange={(next) => onChange({ ...field, config: next } as Field)}
          allFields={allFields}
          ownerFieldId={field.id}
        />
      </div>

      {allFields.length > 1 && (
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">
            Conditions
          </div>
          <ConditionEditor
            field={field}
            allFields={allFields}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

export function Builder() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { templates, addTemplate, updateTemplate } = useTemplatesStore();
  const pushToast = useToastsStore((s) => s.pushToast);

  const isNew = templateId === undefined || templateId === "new";
  const existing = templateId && !isNew ? templates[templateId] : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [fields, setFields] = useState<Field[]>(existing?.fields ?? []);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [previewConfirmOpen, setPreviewConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load existing template data when navigating directly
  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setFields(existing.fields);
    }
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.id === active.id);
    const newIdx = fields.findIndex((f) => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = [...fields];
    const [moved] = next.splice(oldIdx, 1);
    if (moved === undefined) return;
    next.splice(newIdx, 0, moved);
    setFields(next);
    setIsDirty(true);
    if (selectedIdx === oldIdx) setSelectedIdx(newIdx);
  };

  const addField = (type: FieldType) => {
    const insertAfter = selectedIdx ?? fields.length - 1;
    const field = newField(type);
    const next = [...fields];
    next.splice(insertAfter + 1, 0, field);
    setFields(next);
    setSelectedIdx(insertAfter + 1);
    setIsDirty(true);
  };

  const updateField = (idx: number, field: Field) => {
    const next = [...fields];
    next[idx] = field;
    setFields(next);
    setIsDirty(true);
  };

  const deleteField = (idx: number) => {
    const next = fields.filter((_, i) => i !== idx);
    setFields(next);
    setIsDirty(true);
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx)
      setSelectedIdx(selectedIdx - 1);
  };

  const hasDependents = (fieldId: string) =>
    fields.some(
      (f) =>
        f.conditions.some((c) => c.targetId === fieldId) ||
        (f.type === "calculation" && f.config.sourceFieldIds.includes(fieldId)),
    );

  const handleSave = (): boolean => {
    setSaveError(null);

    // Cycle detection
    const mockTemplate: Template = {
      id: templateId ?? "new",
      title,
      fields,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    const graph = buildConditionGraph(mockTemplate);
    const cycle = findCycle(graph);
    if (cycle !== null) {
      // Map field IDs to human-readable labels for the error message.
      // findCycle returns IDs because the graph algorithm doesn't know about labels;
      // the Builder is the right place to do the lookup since it owns `fields`.
      const cycleLabels = cycle
        .map((id) => {
          const field = fields.find((f) => f.id === id);
          const label = field?.label?.trim();
          return label && label.length > 0 ? `'${label}'` : "(unnamed field)";
        })
        .join(" → ");
      setSaveError(
        `Cycle detected in conditions: ${cycleLabels}. Fix before saving.`,
      );
      pushToast("Fix errors before saving", "error");
      return false;
    }

    const template: Template = {
      id: existing?.id ?? crypto.randomUUID(),
      title: title || "Untitled",
      fields,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    if (isNew || !existing) {
      addTemplate(template);
      setIsDirty(false);
      pushToast("Form created");
      navigate(`/templates/${template.id}/edit`, { replace: true });
    } else {
      updateTemplate(template);
      setIsDirty(false);
      pushToast("Form saved");
    }
    return true;
  };

  const selectedField = selectedIdx !== null ? fields[selectedIdx] : undefined;

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-white shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Forms
        </Link>
        <input
          className="flex-1 font-bold text-lg border-none outline-none"
          placeholder="Untitled form"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
        />
        <div className="flex gap-2 items-center">
          {saveError && (
            <span className="text-red-600 text-xs">{saveError}</span>
          )}
          {isDirty && (
            <span className="text-amber-500 text-xs">Unsaved changes</span>
          )}
          {existing && (
            <button
              type="button"
              data-testid="preview-button"
              onClick={() => {
                // If clean, navigate directly. If dirty, open confirm dialog
                // (Option B from the UX discussion: explicit "Save & preview" consent
                // rather than silent auto-save). Without this guard, clicking Preview
                // with unsaved changes silently navigated to the LAST SAVED template
                // — confusing because the user expected to see what's on the canvas.
                if (isDirty) {
                  setPreviewConfirmOpen(true);
                } else {
                  navigate(`/templates/${existing.id}/fill`, {
                    state: { from: "builder" },
                  });
                }
              }}
              className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
            >
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel — field type palette */}
        <div className="w-48 border-r p-3 overflow-y-auto shrink-0 bg-gray-50">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Add field
          </div>
          <div className="space-y-1">
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addField(type)}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white hover:shadow-sm transition-all"
              >
                {FIELD_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Center — sortable canvas */}
        <div className="flex-1 p-4 overflow-y-auto">
          {fields.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Add fields from the left panel</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 max-w-xl">
                  {fields.map((field, idx) => (
                    <SortableFieldItem
                      key={field.id}
                      field={field}
                      isSelected={selectedIdx === idx}
                      onSelect={() => setSelectedIdx(idx)}
                      onDelete={() => deleteField(idx)}
                      hasDependents={hasDependents(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Right panel — config editor */}
        <div className="w-72 border-l p-4 overflow-y-auto shrink-0 bg-white">
          {selectedField && selectedIdx !== null ? (
            <ConfigPanel
              field={selectedField}
              allFields={fields}
              onChange={(f) => updateField(selectedIdx, f)}
            />
          ) : (
            <div className="text-gray-400 text-sm text-center mt-8">
              Select a field to edit
            </div>
          )}
        </div>
      </div>

      {/* Preview confirmation dialog — opens when user clicks Preview with unsaved changes */}
      {previewConfirmOpen && existing && (
        <div
          data-testid="preview-confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-confirm-title"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Click on backdrop (not on dialog itself) closes the dialog
            if (e.target === e.currentTarget) setPreviewConfirmOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreviewConfirmOpen(false);
          }}
        >
          <div
            data-testid="preview-confirm-dialog"
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h2
              id="preview-confirm-title"
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              Unsaved changes
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              You have unsaved changes. The preview reads from the saved
              version, so your latest edits won&rsquo;t appear unless you save
              first. Save and open the preview?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="preview-confirm-cancel"
                autoFocus
                onClick={() => setPreviewConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="preview-confirm-save"
                onClick={() => {
                  const saved = handleSave();
                  setPreviewConfirmOpen(false);
                  if (saved) {
                    navigate(`/templates/${existing.id}/fill`, {
                      state: { from: "builder" },
                    });
                  }
                  // If save failed (e.g., cycle detected), the inline error and toast
                  // are already surfaced by handleSave; we just close the dialog and let
                  // the user fix the issue.
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Save &amp; preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
