<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

---

## Internationalization (i18n)

The UI is fully translated via **react-i18next**. All strings live in
`src/i18n/locales/*.json`; the bootstrap is `src/i18n/index.ts`. Locales are
**bundled into the IIFE** (no runtime HTTP fetch) because this ships as a
Shadow-DOM web component. English (`en`) is the base + fallback.

### Conversion pattern (when adding/converting UI strings)

- **Every React component** — including module-level helpers that are themselves
  components — gets its own `const { t } = useTranslation();`.
- **Non-component helpers** take `t: TFunction` as a parameter instead.
- `useTranslation()` MUST be placed **before any early `return`** in a component
  (React hooks ordering — the FileViewer markdown early-return was the gotcha).
- **Pluralization:** `_one` / `_other` key suffixes + `{{count}}`.
  **Interpolation:** `{{var}}`.
- Leave purely-decorative strings, raw filenames, and technical/code-bearing
  snippets untranslated rather than risk breaking JSX/markup.

### Adding a new language (4 steps)

1. Copy `src/i18n/locales/en.json` → `<code>.json`, translate values (keep keys,
   `{{placeholders}}`, and `_one`/`_other` suffixes).
2. Import it in `src/i18n/index.ts` and add to `resources` —
   `SUPPORTED_LANGUAGES` and the Settings → Language picker update automatically.
3. Add the display name under the `languages` key in **every** locale file
   (e.g. `"de": "German"`).
4. `npm run build`.

Language is selectable via Settings → Language, `?lang=<code>`, or the `lang`
attribute on the web component; persisted in `localStorage` (`zl-fm-lang`).

### Verify after i18n work

- `npx tsc -b` after each batch (catches `t` not-in-scope and bad keys' types).
- `npm run build` for the final full bundle.
- **TODO / nice-to-have:** a key-validation script (diff each locale's key set
  against `en.json`) + a visual smoke-test in a non-English locale to catch
  layout overflow (German runs long).
