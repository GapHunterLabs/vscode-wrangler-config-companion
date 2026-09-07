import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWranglerToml, findViolations } from '../wranglerConfig';

const GOOD_CONFIG = `
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2026-01-15"

[[kv_namespaces]]
binding = "MY_KV"
id = "abc123"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"
`;

test('parseWranglerToml reads top-level key=value pairs', () => {
  const doc = parseWranglerToml(GOOD_CONFIG);
  assert.equal(doc.root.name, 'my-worker');
  assert.equal(doc.root.main, 'src/index.ts');
  assert.equal(doc.root.compatibility_date, '2026-01-15');
});

test('parseWranglerToml reads [[array.of.tables]] entries', () => {
  const doc = parseWranglerToml(GOOD_CONFIG);
  assert.equal(doc.arrayTables.kv_namespaces.length, 1);
  assert.equal(doc.arrayTables.kv_namespaces[0].binding, 'MY_KV');
  assert.equal(doc.arrayTables.kv_namespaces[0].id, 'abc123');
});

test('parseWranglerToml handles multiple entries of the same array table', () => {
  const text = `[[kv_namespaces]]\nbinding = "A"\nid = "1"\n[[kv_namespaces]]\nbinding = "B"\nid = "2"`;
  const doc = parseWranglerToml(text);
  assert.equal(doc.arrayTables.kv_namespaces.length, 2);
  assert.equal(doc.arrayTables.kv_namespaces[1].binding, 'B');
});

test('parseWranglerToml parses booleans', () => {
  const doc = parseWranglerToml('workers_dev = true');
  assert.equal(doc.root.workers_dev, true);
});

test('parseWranglerToml strips trailing comments from values', () => {
  const doc = parseWranglerToml('name = "my-worker" # the worker name');
  assert.equal(doc.root.name, 'my-worker');
});

test('findViolations reports nothing for a fully valid config', () => {
  const doc = parseWranglerToml(GOOD_CONFIG);
  assert.deepEqual(findViolations(doc), []);
});

test('findViolations flags a missing required field', () => {
  const doc = parseWranglerToml('main = "src/index.ts"\ncompatibility_date = "2026-01-15"');
  const violations = findViolations(doc);
  assert.ok(violations.some((v) => v.kind === 'MISSING_REQUIRED_FIELD' && v.message.includes('name')));
});

test('findViolations flags an invalid compatibility_date format', () => {
  const doc = parseWranglerToml('name = "x"\nmain = "y"\ncompatibility_date = "Jan 2026"');
  const violations = findViolations(doc);
  assert.ok(violations.some((v) => v.kind === 'INVALID_COMPATIBILITY_DATE'));
});

test('findViolations flags a kv_namespaces entry missing its id', () => {
  const text = `name="x"\nmain="y"\ncompatibility_date="2026-01-15"\n[[kv_namespaces]]\nbinding = "MY_KV"`;
  const doc = parseWranglerToml(text);
  const violations = findViolations(doc);
  assert.ok(violations.some((v) => v.kind === 'MISSING_BINDING_FIELD' && v.message.includes('id')));
});

test('findViolations flags an r2_buckets entry missing bucket_name', () => {
  const text = `name="x"\nmain="y"\ncompatibility_date="2026-01-15"\n[[r2_buckets]]\nbinding = "B"`;
  const doc = parseWranglerToml(text);
  const violations = findViolations(doc);
  assert.ok(violations.some((v) => v.kind === 'MISSING_BINDING_FIELD' && v.message.includes('bucket_name')));
});
