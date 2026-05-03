import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string | undefined;
  suffix?: string | undefined;
}

export function AffixedInput({ prefix, suffix, className = '', ...rest }: Props) {
  if (!prefix && !suffix) {
    return <input className={`border rounded px-3 py-2 w-full ${className}`} {...rest} />;
  }

  return (
    <div className="flex border rounded overflow-hidden w-full">
      {prefix && (
        <span className="px-3 py-2 bg-gray-100 text-gray-600 border-r text-sm shrink-0">
          {prefix}
        </span>
      )}
      <input className={`flex-1 px-3 py-2 outline-none min-w-0 ${className}`} {...rest} />
      {suffix && (
        <span className="px-3 py-2 bg-gray-100 text-gray-600 border-l text-sm shrink-0">
          {suffix}
        </span>
      )}
    </div>
  );
}
