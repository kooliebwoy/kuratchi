// TS-first schema DSL for Kuratchi
// Users define schemas as const objects, then we normalize to the internal DatabaseSchema

export type ColumnDefString = string; // e.g. "text primary key", "enum(a,b) default a", "text -> users.id cascade"

export type TableDsl = Record<string, ColumnDefString | true>;

export type MixinsDsl = Record<string, TableDsl>;

export type SchemaDsl = {
  name: string;
  version: number;
  mixins?: MixinsDsl;
  tables: Record<string, TableDsl>;
};

export type SchemaModule = { [k: string]: SchemaDsl };
