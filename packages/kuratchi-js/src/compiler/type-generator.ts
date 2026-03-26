import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Generate TypeScript types from kuratchi schema and runtime definitions.
 * Outputs to src/app.d.ts or a specified path.
 */

interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
}

interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

function sqliteTypeToTs(sqlType: string): string {
  const lower = sqlType.toLowerCase();
  if (lower.includes('integer') || lower.includes('int') || lower.includes('real') || lower.includes('numeric')) {
    return 'number';
  }
  if (lower.includes('text') || lower.includes('varchar') || lower.includes('char')) {
    return 'string';
  }
  if (lower.includes('blob')) {
    return 'Uint8Array';
  }
  if (lower.includes('json')) {
    return 'Record<string, unknown>';
  }
  if (lower.includes('boolean') || lower.includes('bool')) {
    return 'boolean';
  }
  return 'unknown';
}

function parseSchemaColumn(name: string, definition: string): SchemaColumn {
  const lower = definition.toLowerCase();
  const nullable = !lower.includes('not null');
  const hasDefault = lower.includes('default');
  const type = sqliteTypeToTs(definition);
  
  return { name, type, nullable, hasDefault };
}

function parseSchemaFromSource(source: string): SchemaTable[] {
  const tables: SchemaTable[] = [];
  
  // Match tables: { tableName: { col: 'def', ... }, ... }
  const tablesMatch = source.match(/tables\s*:\s*\{([\s\S]*?)\n\t?\}/);
  if (!tablesMatch) return tables;
  
  const tablesBlock = tablesMatch[1];
  
  // Match each table definition
  const tableRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = tableRegex.exec(tablesBlock)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    const columns: SchemaColumn[] = [];
    
    // Match each column: name: 'definition'
    const colRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
    let colMatch;
    
    while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
      columns.push(parseSchemaColumn(colMatch[1], colMatch[2]));
    }
    
    tables.push({ name: tableName, columns });
  }
  
  return tables;
}

function generateTableTypes(tables: SchemaTable[]): string {
  const lines: string[] = [];
  
  for (const table of tables) {
    const pascalName = table.name
      .split('_')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    
    lines.push(`    /** Row type for ${table.name} table */`);
    lines.push(`    interface ${pascalName}Row {`);
    
    for (const col of table.columns) {
      const optional = col.nullable || col.hasDefault ? '?' : '';
      lines.push(`      ${col.name}${optional}: ${col.type};`);
    }
    
    lines.push(`    }`);
    lines.push('');
  }
  
  return lines.join('\n');
}

export interface GenerateTypesOptions {
  projectDir: string;
  schemaPath?: string;
  outputPath?: string;
  localsInterface?: string;
}

export function generateAppTypes(options: GenerateTypesOptions): string {
  const {
    projectDir,
    schemaPath = 'src/server/schema.ts',
    outputPath = 'src/app.d.ts',
    localsInterface,
  } = options;
  
  const schemaFullPath = path.join(projectDir, schemaPath);
  let tables: SchemaTable[] = [];
  
  if (fs.existsSync(schemaFullPath)) {
    const schemaSource = fs.readFileSync(schemaFullPath, 'utf-8');
    tables = parseSchemaFromSource(schemaSource);
  }
  
  const tableTypes = tables.length > 0 ? generateTableTypes(tables) : '';
  
  // Check if user has existing Locals definition to preserve
  const outputFullPath = path.join(projectDir, outputPath);
  let existingLocals: string | null = null;
  
  if (fs.existsSync(outputFullPath)) {
    const existing = fs.readFileSync(outputFullPath, 'utf-8');
    // Extract user-defined Locals interface (between USER LOCALS START/END markers)
    const localsMatch = existing.match(/\/\/ USER LOCALS START\n([\s\S]*?)\/\/ USER LOCALS END/);
    if (localsMatch) {
      existingLocals = localsMatch[1];
    }
  }
  
  const localsBlock = existingLocals || localsInterface || `    interface Locals {
      userId: number;
      userEmail: string;
    }`;
  
  const output = `/**
 * Type declarations for kuratchi app.
 * 
 * DB types are auto-generated from schema.ts - regenerate with: kuratchi types
 * Edit the Locals interface below to match your runtime.hook.ts
 */
declare global {
  namespace App {
    /** Request-scoped locals set by runtime hooks */
// USER LOCALS START
${localsBlock}
// USER LOCALS END

${tableTypes ? `    // Database table row types (auto-generated from schema.ts)\n${tableTypes}` : ''}  }
}

export {};
`;
  
  return output;
}

export function writeAppTypes(options: GenerateTypesOptions): void {
  const output = generateAppTypes(options);
  const outputPath = path.join(options.projectDir, options.outputPath || 'src/app.d.ts');
  
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`[kuratchi] Generated types → ${path.relative(options.projectDir, outputPath)}`);
}
