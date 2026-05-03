import { useState } from 'react';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function JsonNode({ label, value, depth }: { label?: string; value: JsonValue; depth: number }) {
  const isExpandable = value !== null && typeof value === 'object';
  const [expanded, setExpanded] = useState(depth === 0);

  const labelEl = label !== undefined ? (
    <span className="text-purple-700 font-mono">"{label}"</span>
  ) : null;
  const colon = label !== undefined ? <span className="text-gray-400 mr-1">:</span> : null;

  if (!isExpandable) {
    return (
      <div className="leading-5">
        {labelEl}{colon}
        <Primitive value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const keys = isArray ? null : Object.keys(value as object);
  const count = isArray ? (value as JsonValue[]).length : (keys as string[]).length;
  const empty = count === 0;
  const bracket = isArray ? ['[', ']'] : ['{', '}'];

  if (empty) {
    return (
      <div className="leading-5">
        {labelEl}{colon}
        <span className="text-gray-400">{bracket[0]}{bracket[1]}</span>
      </div>
    );
  }

  return (
    <div className="leading-5">
      <button
        onClick={() => setExpanded(e => !e)}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 select-none"
      >
        <span className="w-3 text-center text-xs">{expanded ? '▾' : '▸'}</span>
        {labelEl}{colon}
        <span className="text-gray-400">
          {expanded ? bracket[0] : `${bracket[0]} … ${bracket[1]}`}
        </span>
        {!expanded && (
          <span className="text-gray-400 text-xs ml-1">
            {count} {isArray ? 'items' : 'keys'}
          </span>
        )}
      </button>

      {expanded && (
        <>
          <div className="ml-4 border-l border-gray-200 pl-3">
            {isArray
              ? (value as JsonValue[]).map((item, i) => (
                  <JsonNode key={i} label={String(i)} value={item} depth={depth + 1} />
                ))
              : (keys as string[]).map(k => {
                  const v = (value as Record<string, JsonValue>)[k];
                  return v !== undefined
                    ? <JsonNode key={k} label={k} value={v} depth={depth + 1} />
                    : null;
                })}
          </div>
          <span className="text-gray-400">{bracket[1]}</span>
        </>
      )}
    </div>
  );
}

function Primitive({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span className="text-gray-400 font-mono">null</span>;
  if (typeof value === 'boolean')
    return <span className="text-blue-600 font-mono">{String(value)}</span>;
  if (typeof value === 'number')
    return <span className="text-blue-700 font-mono">{value}</span>;
  return <span className="text-green-700 font-mono">"{value}"</span>;
}

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div
      data-testid="json-tree"
      className="text-sm font-mono overflow-auto p-4 bg-gray-50 rounded-b-lg"
    >
      <JsonNode value={value as JsonValue} depth={0} />
    </div>
  );
}
