import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { calculationFieldModule } from './index';
import type { CalculationField, NumberField } from '@/types/field';

const baseField: CalculationField = {
  id: 'calc1',
  type: 'calculation',
  label: 'Total',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  config: { sourceFieldIds: ['a', 'b'], aggregation: 'sum', decimalPlaces: 2 },
};

const numberField: NumberField = {
  id: 'a',
  type: 'number',
  label: 'Amount',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  defaultRequired: false,
  config: { decimalPlaces: 0 },
};

const { validator, renderer: Renderer, configEditor: ConfigEditor } = calculationFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('calculation validator', () => {
  it('always returns no errors (read-only field)', () => {
    expect(validator(undefined, baseField.config, { isRequired: true })).toHaveLength(0);
    expect(validator(42, baseField.config, { isRequired: false })).toHaveLength(0);
    expect(validator('anything', baseField.config, { isRequired: true })).toHaveLength(0);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('calculation renderer', () => {
  it('renders computed value with decimal places', () => {
    render(<Renderer field={baseField} value={123.456} onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByText('123.46')).toBeInTheDocument();
  });

  it('renders — when value is absent', () => {
    render(<Renderer field={baseField} value={undefined} onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders as read-only (no interactive input)', () => {
    const { container } = render(
      <Renderer field={baseField} value={42} onChange={vi.fn()} isRequired={false} errors={[]} />,
    );
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('calculation configEditor', () => {
  it('renders aggregation selector', () => {
    render(<ConfigEditor config={baseField.config} onChange={vi.fn()} allFields={[numberField]} ownerFieldId="calc1" />);
    // Aggregation is the first combobox (aggregation select)
    expect(screen.getAllByRole('combobox')[0]).toBeInTheDocument();
    expect(screen.getByText('Aggregation')).toBeInTheDocument();
  });

  it('shows single-source warning when only one source', () => {
    render(
      <ConfigEditor
        config={{ ...baseField.config, sourceFieldIds: ['a'] }}
        onChange={vi.fn()}
        allFields={[numberField]}
        ownerFieldId="calc1"
      />,
    );
    expect(screen.getByText(/single-source calc/i)).toBeInTheDocument();
  });

  it('no warning when multiple sources', () => {
    render(
      <ConfigEditor
        config={{ ...baseField.config, sourceFieldIds: ['a', 'b'] }}
        onChange={vi.fn()}
        allFields={[numberField, { ...numberField, id: 'b', label: 'B' }]}
        ownerFieldId="calc1"
      />,
    );
    expect(screen.queryByText(/single-source calc/i)).toBeNull();
  });
});
