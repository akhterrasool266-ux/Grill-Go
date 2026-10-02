export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'time' | 'select' | 'checkbox' | 'email' | 'tel' | 'color' | 'student' | 'staff';

export interface Option { value: string; label: string }

export interface RelationDef {
  table: string;
  /** PostgREST select, must include `id`. */
  select?: string;
  label: (row: any) => string;
  order?: string;
  /** Only rows of the campus selected in the top bar (or all if none). */
  campusScoped?: boolean;
  eq?: Record<string, string | boolean | number>;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  options?: Option[];
  relation?: RelationDef;
  min?: number;
  max?: number;
  step?: number;
  default?: string | number | boolean;
  /** Not editable after creation (e.g. a key). */
  createOnly?: boolean;
  maxLength?: number;
}

export type ColType = 'text' | 'money' | 'date' | 'time' | 'badge' | 'bool' | 'number' | 'datetime';
export interface ColumnDef { key: string; label: string; type?: ColType; hideOnMobile?: boolean }

export interface RowRpc {
  label: string;
  fn: string;
  args: (row: any) => Record<string, unknown>;
  /** Only show when this returns true. */
  when?: (row: any) => boolean;
  perm?: string;
  confirm?: string;
  tone?: 'primary' | 'secondary' | 'danger';
}

export interface ResourceDef {
  key: string;
  table: string;
  title: string;
  singular: string;
  description?: string;
  /** Permission module: <perm>.view / .create / .edit / .delete */
  perm: string;
  /** Table has campus_id: set from the campus switcher (or a campus field if several). */
  campusScoped?: boolean;
  columns: ColumnDef[];
  fields: FieldDef[];
  select?: string;
  order?: [string, boolean];
  searchCols?: string[];
  canDelete?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  /** Extra permission needed (any user without it gets "forbidden"). */
  alsoNeeds?: string;
  rowRpcs?: RowRpc[];
  /** Where "back" goes. */
  hub?: { href: string; label: string };
  exportPerm?: string;
  /** Static default values written on insert (not shown in the form). */
  insertDefaults?: Record<string, unknown>;
}
