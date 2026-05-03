import type { Registry } from './contract';
import { textFieldModule } from '@/fields/text';
import { textareaFieldModule } from '@/fields/textarea';
import { numberFieldModule } from '@/fields/number';
import { dateFieldModule } from '@/fields/date';
import { singleSelectFieldModule } from '@/fields/single_select';
import { multiSelectFieldModule } from '@/fields/multi_select';
import { fileFieldModule } from '@/fields/file';
import { sectionHeaderFieldModule } from '@/fields/section_header';
import { calculationFieldModule } from '@/fields/calculation';

export const registry: Registry = {
  text: textFieldModule,
  textarea: textareaFieldModule,
  number: numberFieldModule,
  date: dateFieldModule,
  single_select: singleSelectFieldModule,
  multi_select: multiSelectFieldModule,
  file: fileFieldModule,
  section_header: sectionHeaderFieldModule,
  calculation: calculationFieldModule,
};
