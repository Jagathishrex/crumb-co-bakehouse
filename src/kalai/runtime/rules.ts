// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// Checks values against the model before they are stored: known fields, the right kind of value, required fields,
// text length. The same checks run in the simulated backend and in production, so the prototype behaves like the
// deployed app.
import type { Field, Table } from '../model/index.ts';

export class RuleError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(message: string, status: number, field?: string) {
    super(message);
    this.name = 'RuleError';
    this.status = status;
    this.field = field;
  }
}

/**
 * A RuleError, also from another copy of this file: a hosted app bundles both the project's runtime copy and Kalai's
 * own (its Catalyst driver), so `instanceof` alone misses half of them.
 */
export function isRuleError(error: unknown): error is RuleError {
  return error instanceof RuleError || (error instanceof Error && error.name === 'RuleError' && typeof (error as RuleError).status === 'number');
}

function fits(field: Field, value: unknown): boolean {
  switch (field.type) {
    case 'text':
      return typeof value === 'string' && value.length <= (field.maxLength ?? 255);
    case 'longtext':
    case 'link':
      return typeof value === 'string';
    case 'number':
    case 'bignumber':
      return Number.isInteger(value);
    case 'decimal':
      return typeof value === 'number' && Number.isFinite(value);
    case 'yesno':
      return typeof value === 'boolean';
    case 'choice':
      return typeof value === 'string' && (field.options ?? []).includes(value);
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }
}

const kKinds: Record<Field['type'], string> = {
  text: 'text',
  longtext: 'text',
  link: 'the id of a row',
  number: 'a whole number',
  bignumber: 'a whole number',
  decimal: 'a number',
  yesno: 'true or false',
  date: 'a date like 2026-11-24',
  datetime: 'a date and time',
  choice: 'one of its values',
};

/** The values to store, or a RuleError. `creating` fills defaults and checks required fields. */
export function checkValues(table: Table, input: unknown, creating: boolean): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('Send the values as an object', 400);
  const fields = new Map(table.fields.map((field) => [field.name, field]));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = fields.get(key);
    if (!field) throw new RuleError(`${table.name} has no field "${key}"`, 400, key);
    if (value === null || value === undefined) {
      if (field.required) throw new RuleError(`${key} is required`, 400, key);
      out[key] = null;
      continue;
    }
    if (field.type === 'text' && typeof value === 'string' && value.length > (field.maxLength ?? 255)) {
      throw new RuleError(`${key} can be at most ${field.maxLength ?? 255} characters`, 400, key);
    }
    if (!fits(field, value)) throw new RuleError(`${key} should be ${field.type === 'choice' ? `one of ${(field.options ?? []).join(', ')}` : kKinds[field.type]}`, 400, key);
    out[key] = value;
  }
  if (creating) {
    for (const field of table.fields) {
      if (out[field.name] !== undefined) continue;
      if (field.default !== undefined) out[field.name] = field.default;
      else if (field.required) throw new RuleError(`${field.name} is required`, 400, field.name);
      else out[field.name] = null;
    }
  }
  return out;
}
