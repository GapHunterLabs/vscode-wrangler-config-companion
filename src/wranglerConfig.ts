/**
 * Pure logic -- no `vscode` dependency. New niche (not a port from
 * the Kotlin catalog). Evidence: direct from Cloudflare's own repo --
 * issue `cloudflare/workers-sdk#1165` ("Feature Request: improve the
 * wrangler.toml config experience") and confirmed textually: "only
 * limited validation of the wrangler.toml file is currently
 * provided."
 *
 * Hand-rolled parser for the TOML subset wrangler.toml actually uses
 * (top-level key=value, `[section]` tables, `[[array.of.tables]]`) --
 * not a general TOML parser (no multi-line strings, no inline tables,
 * no arrays-of-arrays -- a real, documented v0.1 limitation).
 */

export type TomlValue = string | boolean | number;
export type TomlTable = Record<string, TomlValue>;

export interface TomlDoc {
  root: TomlTable;
  arrayTables: Record<string, TomlTable[]>;
}

const ARRAY_TABLE_HEADER = /^\[\[([\w.]+)\]\]$/;
const TABLE_HEADER = /^\[([\w.]+)\]$/;
const KEY_VALUE = /^([\w-]+)\s*=\s*(.+)$/;

function parseValue(raw: string): TomlValue {
  const trimmed = raw.trim().replace(/\s*#.*$/, ''); // strip a trailing comment
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^"(?:[^"\\]|\\.)*"$/.test(trimmed)) return trimmed.slice(1, -1);
  if (/^'(?:[^'\\])*'$/.test(trimmed)) return trimmed.slice(1, -1);
  const asNumber = Number(trimmed);
  return Number.isNaN(asNumber) ? trimmed : asNumber;
}

export function parseWranglerToml(text: string): TomlDoc {
  const root: TomlTable = {};
  const arrayTables: Record<string, TomlTable[]> = {};
  let current: TomlTable = root;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const arrayMatch = ARRAY_TABLE_HEADER.exec(line);
    if (arrayMatch) {
      const name = arrayMatch[1];
      if (!arrayTables[name]) arrayTables[name] = [];
      const entry: TomlTable = {};
      arrayTables[name].push(entry);
      current = entry;
      continue;
    }

    const tableMatch = TABLE_HEADER.exec(line);
    if (tableMatch) {
      // v0.1: single [section] tables (env.*, vars, build, ...) aren't
      // required for the checks this extension runs, so their
      // contents are parsed into a throwaway table rather than a
      // named one -- real scope limitation, not a silent bug.
      current = {};
      continue;
    }

    const kvMatch = KEY_VALUE.exec(line);
    if (kvMatch) {
      current[kvMatch[1]] = parseValue(kvMatch[2]);
    }
  }

  return { root, arrayTables };
}

export interface Violation {
  kind: 'MISSING_REQUIRED_FIELD' | 'INVALID_COMPATIBILITY_DATE' | 'MISSING_BINDING_FIELD';
  message: string;
}

const COMPATIBILITY_DATE = /^\d{4}-\d{2}-\d{2}$/;

const BINDING_ARRAYS: Record<string, string[]> = {
  kv_namespaces: ['binding', 'id'],
  r2_buckets: ['binding', 'bucket_name'],
  d1_databases: ['binding', 'database_id'],
};

export function findViolations(doc: TomlDoc): Violation[] {
  const violations: Violation[] = [];

  for (const field of ['name', 'compatibility_date']) {
    if (doc.root[field] === undefined) {
      violations.push({ kind: 'MISSING_REQUIRED_FIELD', message: `wrangler.toml is missing the required top-level field "${field}".` });
    }
  }
  // "main" is required unless the project uses the older [build]
  // command-based entry point -- v0.1 only checks the modern "main"
  // field, documented as a real, honest simplification.
  if (doc.root.main === undefined) {
    violations.push({ kind: 'MISSING_REQUIRED_FIELD', message: 'wrangler.toml has no top-level "main" field (the Worker\'s entry point).' });
  }

  const compatDate = doc.root.compatibility_date;
  if (typeof compatDate === 'string' && !COMPATIBILITY_DATE.test(compatDate)) {
    violations.push({ kind: 'INVALID_COMPATIBILITY_DATE', message: `compatibility_date "${compatDate}" isn't in YYYY-MM-DD format.` });
  }

  for (const [arrayName, requiredFields] of Object.entries(BINDING_ARRAYS)) {
    const entries = doc.arrayTables[arrayName] ?? [];
    entries.forEach((entry, index) => {
      for (const field of requiredFields) {
        if (entry[field] === undefined) {
          violations.push({
            kind: 'MISSING_BINDING_FIELD',
            message: `[[${arrayName}]] entry #${index + 1} is missing "${field}".`,
          });
        }
      }
    });
  }

  return violations;
}
