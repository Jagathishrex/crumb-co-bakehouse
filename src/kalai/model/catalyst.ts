// The model as Catalyst Data Store tables. Catalyst keeps its own ROWID, CREATORID, CREATEDTIME and MODIFIEDTIME;
// Kalai's id, created_at and updated_at are kept as columns too, so rows look the same on every target.
// The request body Catalyst's create-column API expects is not confirmed yet (docs/PLAN.md, "Test deploys").
import { hasOwner, type AppModel, type Field } from './schema.ts';

export interface CatalystColumn {
  column_name: string;
  data_type: 'varchar' | 'text' | 'int' | 'bigint' | 'double' | 'boolean' | 'date' | 'datetime' | 'foreign key';
  max_length?: number;
  is_mandatory: boolean;
  is_unique: boolean;
  default_value?: string;
  /** foreign key only */
  parent_table?: string;
  on_delete?: 'Null' | 'Cascade';
}

export interface CatalystTable {
  table_name: string;
  columns: CatalystColumn[];
}

const kTypes: Record<Field['type'], CatalystColumn['data_type']> = {
  text: 'varchar',
  longtext: 'text',
  number: 'int',
  bignumber: 'bigint',
  decimal: 'double',
  yesno: 'boolean',
  date: 'date',
  datetime: 'datetime',
  // One of the field's values, checked by the API.
  choice: 'varchar',
  // Catalyst's foreign keys point at ROWID; Kalai links by id, so a link is kept as text and checked by the API.
  link: 'varchar',
};

function column(field: Field): CatalystColumn {
  const data_type = kTypes[field.type];
  return {
    column_name: field.name,
    data_type,
    ...(data_type === 'varchar' ? { max_length: field.maxLength ?? 255 } : {}),
    is_mandatory: Boolean(field.required),
    // Catalyst can't make long text unique; Kalai checks it instead (validate.ts warns).
    is_unique: Boolean(field.unique) && field.type !== 'longtext',
    ...(field.default !== undefined ? { default_value: String(field.default) } : {}),
  };
}

const system = (name: string): CatalystColumn => ({ column_name: name, data_type: 'varchar', max_length: 255, is_mandatory: false, is_unique: name === 'id' });

export function catalystTables(model: AppModel): CatalystTable[] {
  return model.tables.map((table) => ({
    table_name: table.name,
    columns: [system('id'), system('created_at'), system('updated_at'), ...(hasOwner(table) ? [system('owner')] : []), ...table.fields.map(column)],
  }));
}
