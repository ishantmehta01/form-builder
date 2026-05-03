import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { singleSelectFieldModule } from './index';
import type { SingleSelectField } from '@/types/field';

const OPTIONS = [
  { id: 'opt1', label: 'Apple' },
  { id: 'opt2', label: 'Banana' },
];

function makeField(displayType: SingleSelectField['config']['displayType'] = 'radio'): SingleSelectField {
  return {
    id: 'f1',
    type: 'single_select',
    label: 'Fruit',
    conditions: [],
    conditionLogic: 'OR',
    defaultVisible: true,
    defaultRequired: false,
    config: { options: OPTIONS, displayType },
  };
}

const { validator, renderer: Renderer, configEditor: ConfigEditor } = singleSelectFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('single_select validator', () => {
  it('required + empty → required error', () => {
    expect(validator('', { options: OPTIONS, displayType: 'radio' }, { isRequired: true }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'required' })]));
  });

  it('required + valid option → no error', () => {
    expect(validator('opt1', { options: OPTIONS, displayType: 'radio' }, { isRequired: true }))
      .toHaveLength(0);
  });

  it('optional + empty → no error', () => {
    expect(validator('', { options: OPTIONS, displayType: 'radio' }, { isRequired: false }))
      .toHaveLength(0);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('single_select renderer — radio', () => {
  it('renders all options as radio buttons', () => {
    render(<Renderer field={makeField('radio')} value="" onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('fires onChange when radio selected', () => {
    const onChange = vi.fn();
    render(<Renderer field={makeField('radio')} value="" onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Apple' }));
    expect(onChange).toHaveBeenCalledWith('opt1');
  });
});

describe('single_select renderer — dropdown', () => {
  it('renders as a select element', () => {
    render(<Renderer field={makeField('dropdown')} value="" onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('fires onChange when option selected', () => {
    const onChange = vi.fn();
    render(<Renderer field={makeField('dropdown')} value="" onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'opt2' } });
    expect(onChange).toHaveBeenCalledWith('opt2');
  });
});

describe('single_select renderer — tiles', () => {
  it('renders options as buttons', () => {
    render(<Renderer field={makeField('tiles')} value="" onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByRole('button', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Banana' })).toBeInTheDocument();
  });

  it('fires onChange when tile clicked', () => {
    const onChange = vi.fn();
    render(<Renderer field={makeField('tiles')} value="" onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    expect(onChange).toHaveBeenCalledWith('opt1');
  });
});

describe('single_select renderer — required', () => {
  it('shows asterisk when isRequired=true', () => {
    render(<Renderer field={makeField()} value="" onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('single_select configEditor', () => {
  it('renders display type selector', () => {
    render(<ConfigEditor config={{ options: [], displayType: 'radio' }} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    // Display type selector is the combobox in this config editor
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Display type')).toBeInTheDocument();
  });

  it('fires onChange when display type changed', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{ options: [], displayType: 'radio' }} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dropdown' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ displayType: 'dropdown' }));
  });
});
