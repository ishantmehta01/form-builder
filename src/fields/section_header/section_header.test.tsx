import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { sectionHeaderFieldModule } from './index';
import type { SectionHeaderField } from '@/types/field';

function makeField(size: SectionHeaderField['config']['size']): SectionHeaderField {
  return {
    id: 'f1',
    type: 'section_header',
    label: 'Section Title',
    conditions: [],
    conditionLogic: 'OR',
    defaultVisible: true,
    config: { size },
  };
}

const { validator, renderer: Renderer, configEditor: ConfigEditor } = sectionHeaderFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('section_header validator', () => {
  it('always returns empty errors regardless of value or required', () => {
    expect(validator(undefined, { size: 'md' }, { isRequired: true })).toHaveLength(0);
    expect(validator('anything', { size: 'md' }, { isRequired: false })).toHaveLength(0);
  });
});

// ── G3: Renderer — semantic heading levels (per H4) ─────────────────────

describe('section_header renderer — heading levels', () => {
  it.each([
    ['xl', 'H2'],
    ['lg', 'H2'],
    ['md', 'H3'],
    ['sm', 'H4'],
    ['xs', 'H4'],
  ] as const)('size=%s renders as <%s>', (size, expectedTag) => {
    render(<Renderer field={makeField(size)} value={undefined} onChange={vi.fn()} isRequired={false} errors={[]} />);
    const heading = screen.getByText('Section Title');
    expect(heading.tagName).toBe(expectedTag);
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('section_header configEditor', () => {
  it('renders size selector', () => {
    render(<ConfigEditor config={{ size: 'md' }} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
  });

  it('fires onChange when size changed', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{ size: 'md' }} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'xl' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ size: 'xl' }));
  });
});
