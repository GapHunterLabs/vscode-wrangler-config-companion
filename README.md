# Wrangler Config Companion (VS Code)

Validates `wrangler.toml` (Cloudflare Workers) — required fields
(`name`/`main`/`compatibility_date`), date format, and missing
`binding`/id fields in `kv_namespaces`/`r2_buckets`/`d1_databases`
entries. No data leaves your editor.

**v0.1, new niche.** Not a port from the Gap Hunter Labs IntelliJ-
family catalog. Evidence, direct from Cloudflare's own repo: issue
[`cloudflare/workers-sdk#1165`](https://github.com/cloudflare/workers-sdk/issues/1165)
("Feature Request: improve the wrangler.toml config experience"),
confirmed textually — *"only limited validation of the wrangler.toml
file is currently provided."*

## What it checks

Live, on any `wrangler.toml`:

- Missing top-level `name`, `main`, or `compatibility_date`.
- `compatibility_date` not in `YYYY-MM-DD` format.
- A `[[kv_namespaces]]` entry missing `binding` or `id`.
- A `[[r2_buckets]]` entry missing `binding` or `bucket_name`.
- A `[[d1_databases]]` entry missing `binding` or `database_id`.

**v0.1 scope, honestly noted:** a hand-rolled parser for the TOML
subset `wrangler.toml` actually uses (top-level key=value,
`[section]` tables, `[[array.of.tables]]`) — not a general TOML
parser (no multi-line strings, no inline tables). `main` is checked
as the modern entry-point field; the older `[build]` command-based
convention isn't specially recognized.

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against the file already open in your editor.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
