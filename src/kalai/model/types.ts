// The model as TypeScript, written into a project's src/kalai/types.ts so screens get typed rows.
import { hasOwner, type AppModel, type Field } from './schema.ts';

const pascal = (name: string) => name.replace(/(^|_)([a-z0-9])/g, (_, __, letter: string) => letter.toUpperCase());

/** "classes" → "Class", "categories" → "Category", "tasks" → "Task". */
export function rowTypeName(table: string): string {
  const singular = table.endsWith('ies')
    ? `${table.slice(0, -3)}y`
    : /(ss|x|ch|sh)es$/.test(table)
      ? table.slice(0, -2)
      : table.endsWith('s') && !table.endsWith('ss')
        ? table.slice(0, -1)
        : table;
  return pascal(singular);
}

function tsType(field: Field): string {
  switch (field.type) {
    case 'number':
    case 'bignumber':
    case 'decimal':
      return 'number';
    case 'yesno':
      return 'boolean';
    case 'choice':
      return field.options?.length ? field.options.map((option) => JSON.stringify(option)).join(' | ') : 'string';
    default:
      return 'string';
  }
}

export function generateTypes(model: AppModel): string {
  const lines = ['// Written by Kalai from kalai.app.json. Change the model, not this file.', ''];
  for (const table of model.tables) {
    const type = rowTypeName(table.name);
    lines.push(`export interface ${type} {`, '  id: string;', '  created_at: string;', '  updated_at: string;');
    if (hasOwner(table)) lines.push('  owner: string | null;');
    for (const field of table.fields) lines.push(`  ${field.name}: ${tsType(field)}${field.required ? '' : ' | null'};`);
    lines.push('}', '');
    lines.push(`export interface New${type} {`);
    for (const field of table.fields) {
      const optional = !field.required || field.default !== undefined;
      lines.push(`  ${field.name}${optional ? '?' : ''}: ${tsType(field)}${field.required ? '' : ' | null'};`);
    }
    lines.push('}', '');
  }
  lines.push('export interface Tables {');
  for (const table of model.tables) {
    const type = rowTypeName(table.name);
    lines.push(`  ${table.name}: { row: ${type}; new: New${type} };`);
  }
  lines.push('}', '');
  return lines.join('\n');
}
