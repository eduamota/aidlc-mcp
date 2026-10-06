/**
 * Official AI-DLC Sensor Specifications generated from awslabs/aidlc-workflows/core/sensors/
 * Total sensors: 6
 */

export interface SensorSpec {
  id: string;
  kind: string;
  command: string;
  defaultSeverity: "advisory" | "strict" | string;
  fireOn: "gate" | "code" | string;
  description: string;
  category: "document-provenance" | "document-shape" | "document-traceability" | "code-quality" | string;
  matches: string;
  timeoutSeconds: number;
  markdown: string;
}

export const SENSOR_SPECS: Record<string, SensorSpec> = {
  "type-check": {
    "id": "type-check",
    "kind": "deterministic",
    "command": "{{INVOKE}} engine sensor-type-check",
    "defaultSeverity": "advisory",
    "fireOn": "code",
    "description": "Wraps the project's configured type-checker (tsc by default for v0.5.0); fires on TS/TSX code outputs",
    "category": "code-quality",
    "matches": "**/*.{ts,tsx}",
    "timeoutSeconds": 1200,
    "markdown": "---\nid: type-check\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-type-check\ndefault_severity: advisory\ndescription: Wraps the project's configured type-checker (tsc by default for v0.5.0); fires on TS/TSX code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,tsx}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  errors:\n    - file: string\n      line: number\n      column: number\n      message: string\ntimeout_seconds: 1200\n---\n\n# type-check sensor\n\nWraps the project's configured type-checker. v0.5.0 defaults to tsc;\nmulti-language auto-detection (mypy, go vet, cargo-check) is deferred\nto v0.6.0+.\n\nEchoes Fowler's \"type checkers\" example from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/type-check-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the type-checker's\nstructured output.\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate type-checker).\n"
  },
  "upstream-coverage": {
    "id": "upstream-coverage",
    "kind": "deterministic",
    "command": "{{INVOKE}} engine sensor-upstream-coverage",
    "defaultSeverity": "advisory",
    "fireOn": "gate",
    "description": "Checks the stage's deliverables reference the upstream artifacts the stage frontmatter declares it consumes",
    "category": "document-shape",
    "matches": "**/{aidlc-docs,intents,codekb}/**",
    "timeoutSeconds": 300,
    "markdown": "---\nid: upstream-coverage\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-upstream-coverage\ndefault_severity: advisory\nfire_on: gate\ndescription: Checks the stage's deliverables reference the upstream artifacts the stage frontmatter declares it consumes\ncategory: document-shape\nmatches: \"**/{aidlc-docs,intents,codekb}/**\"\ninput_schema:\n  output_path: string\n  stage_slug: string\n  consumes: string[]\n  deliverables: string[]\noutput_schema:\n  pass: boolean\n  unreferenced_artifacts: string[]\ntimeout_seconds: 300\n---\n\n# upstream-coverage sensor\n\nReads the stage frontmatter `consumes:` list and checks the stage's\ndeliverables reference each upstream artifact. A reference counts in any\nof the forms the framework's artifacts actually use:\n\n- the artifact slug as a standalone token (not embedded in a longer\n  kebab token: `requirements` inside `nfr-requirements` does not count)\n- a wikilink (`[[<slug>]]`) or backticked filename (`` `<slug>.md` ``)\n- the producing stage's directory as a path segment (e.g. a provenance\n  header citing `nfr-requirements/` covers every artifact that stage\n  produces)\n\nCoverage is a property of the stage's whole output, not of each file:\nthe check runs over the union of the stage's declared deliverables in\nthe output directory (scaffolding - `*-questions.md`, `*-timestamp.md`,\n`memory.md` - is excluded from both sides), so a citation in a sibling\ndeliverable counts.\n\nPure derivation from frontmatter - no per-stage config needed.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail listing artifacts declared in\n`consumes:` that appear in none of the stage's deliverables in any\naccepted form.\n"
  },
  "traceability": {
    "id": "traceability",
    "kind": "deterministic",
    "command": "{{INVOKE}} engine sensor-traceability",
    "defaultSeverity": "advisory",
    "fireOn": "gate",
    "description": "Verifies element-level upstream coverage, downstream targets, and derived orphans in traceability.json",
    "category": "document-traceability",
    "matches": "**/traceability.json",
    "timeoutSeconds": 300,
    "markdown": "---\nid: traceability\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-traceability\ndefault_severity: advisory\ndescription: Verifies element-level upstream coverage, downstream targets, and derived orphans in traceability.json\ncategory: document-traceability\nmatches: \"**/traceability.json\"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  gaps: string[]\n  orphans: string[]\n  missing_from_table: string[]\n  missing_from_upstream_ids: string[]\n  invalid_entries: string[]\n  invalid_targets: string[]\n  findings_count: integer\n  reason: string\ntimeout_seconds: 300\n---\n\n# traceability sensor\n\nDeterministic element-level verification of each stage's JSON coverage table:\n\n1. Validates the runtime JSON shape and the closed status set.\n2. Fails on `GAP`, `ORPHAN`, missing coverage rows, or undeclared upstream IDs.\n3. Requires non-empty targets for `OK`, `Deferred`, and `N/A`.\n4. Resolves upstream IDs from the authored artifacts and fails closed when the\n   expected source is missing or yields no IDs.\n5. Verifies deterministic targets where possible: stories, Unit mappings,\n   business rules, and workspace-relative code paths.\n6. Derives functional-design orphans from `rules.md` rather than\n   trusting only the self-reported `reverse` array.\n\n## Expected JSON schema\n\n```json\n{\n  \"stage\": \"functional-design\",\n  \"unit\": \"u1-auth\",\n  \"upstream_ids\": [\"AC1.1.1\", \"AC1.2.1\"],\n  \"coverage\": [\n    { \"id\": \"AC1.1.1\", \"status\": \"OK\", \"target\": \"BR1.1\" },\n    { \"id\": \"AC1.2.1\", \"status\": \"GAP\" }\n  ],\n  \"reverse\": [\n    { \"id\": \"BR1.3\", \"status\": \"ORPHAN\" }\n  ]\n}\n```\n\nValid statuses are `OK`, `GAP`, `ORPHAN`, `Deferred`, and `N/A`.\n"
  },
  "required-sections": {
    "id": "required-sections",
    "kind": "deterministic",
    "command": "{{INVOKE}} engine sensor-required-sections",
    "defaultSeverity": "advisory",
    "fireOn": "gate",
    "description": "Checks at the gate that stage output contains the required H2 headings",
    "category": "document-shape",
    "matches": "**/{aidlc-docs,intents,codekb}/**",
    "timeoutSeconds": 300,
    "markdown": "---\nid: required-sections\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-required-sections\ndefault_severity: advisory\nfire_on: gate\ndescription: Checks at the gate that stage output contains the required H2 headings\ncategory: document-shape\nmatches: \"**/{aidlc-docs,intents,codekb}/**\"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  h2_count: integer\n  headings: string[]\n  findings_count: integer\n  edge_block: string\n  template: string\n  template_expected: string[]\n  template_missing: string[]\n  config_warning: string\ntimeout_seconds: 300\n---\n\n# required-sections sensor\n\nDefault mode: checks the output contains at least 2 H2 headings (generic\ncontent-shape sanity check).\n\nA timestamp marker (`<artifact>-timestamp.md`, such as\n`practices-discovery-timestamp.md`) is a run record rather than a document,\nso it always passes; its headings are still reported. Questions markers keep\nthe floor.\n\nFor `unit-of-work-dependency.md` (units-generation 2.7), additionally\nrequires the fenced `yaml` `units:` edge block to be present, well-formed,\nand cycle-free — the machine-readable DAG the runtime compiler parses into\nthe batch fan-out. The check reports `edge_block` as `ok`, `absent`,\n`malformed`, or `cyclic`; anything but `ok` fails the sensor at the gate so\nthe malformed block never reaches the compiler. Every other artefact keeps\nthe generic H2-count check only.\n\n## Heading-set overrides — two paths, with precedence\n\nThe default heading set can be overridden two ways. **Precedence: a resolving\n`templates/<artifact>.md` wins over a `## Sensors`-documented heading set.**\n\n1. **Template-override layer (file-driven, preferred).** A team drops\n   `aidlc/spaces/<space>/memory/templates/<artifact>.md` (keyed by the output filename stem —\n   artifact `X` writes to `X.md`). When one resolves for the output path, its\n   `##` headings become the expected set and the sensor passes iff\n   `expected ⊆ output`; the missing headings are precise findings. Whole-doc,\n   advisory — the human decides at the gate. The same file is the skeleton the\n   agent fills (see the stage protocol § Template overrides), so the produced\n   shape and the checked shape cannot drift. A template applies only to a\n   template-eligible artifact (the stage's prose `produces` entries, threaded by\n   the dispatcher); a template resolving for a questions/timestamp marker is\n   ignored with a config warning. A questions marker keeps the generic floor,\n   and a timestamp marker still passes.\n\n2. **`## Sensors`-prose override (in-stage, legacy anticipation).** A stage's\n   `## Sensors` body may document a heading-set override (post-milestone-12\n   mechanism). This applies only when no template file resolves for the output.\n\nThe framework ships no per-stage `## Sensors` overrides by default — teams\nintroduce specific heading shapes either by authoring a template (path 1) or via\nthe §13 learning loop when there's a real reason. When neither override is\npresent, the output keeps the generic ≥2-H2 floor (a timestamp marker still\npasses).\n\n## Failure mode\n\nWhen required headings are missing, emits `SENSOR_FAILED` and writes detail\nto `aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/required-sections-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail lists the missing headings.\n"
  },
  "linter": {
    "id": "linter",
    "kind": "deterministic",
    "command": "{{INVOKE}} engine sensor-linter",
    "defaultSeverity": "advisory",
    "fireOn": "code",
    "description": "Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs",
    "category": "code-quality",
    "matches": "**/*.{ts,js}",
    "timeoutSeconds": 1200,
    "markdown": "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n"
  },
  "claim-sources": {
    "id": "claim-sources",
    "kind": "deterministic",
    "command": "{{INVOKE}} engine sensor-claim-sources",
    "defaultSeverity": "advisory",
    "fireOn": "gate",
    "description": "Checks Intent Capture claims carry source tags that resolve to the stage's confirmed source register and answers",
    "category": "document-provenance",
    "matches": "**/{aidlc-docs,intents}/**",
    "timeoutSeconds": 300,
    "markdown": "---\nid: claim-sources\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-claim-sources\ndefault_severity: advisory\nfire_on: gate\ndescription: Checks Intent Capture claims carry source tags that resolve to the stage's confirmed source register and answers\ncategory: document-provenance\nmatches: \"**/{aidlc-docs,intents}/**\"\ninput_schema:\n  output_path: string\n  stage_slug: string\n  deliverables: string[]\noutput_schema:\n  pass: boolean\n  findings: string[]\n  scanned_files: string[]\n  questions_file: string\n  findings_count: integer\ntimeout_seconds: 300\n---\n\n# claim-sources sensor\n\nChecks the existing Intent Capture deliverables as a set when the stage enters\nits approval gate.\n\nFor each deliverable, the sensor verifies:\n\n- a `## Assumptions & Open Questions` section exists\n- every substantive paragraph, list item, and table data row has an inline\n  `[desc]`, `[scope]`, `[Q<n>]`, `[memory:<id>]`, or `[assumption]` tag\n- source-register entries are visible Markdown list items; `[desc]` exactly\n  matches the authoritative directions derived from committed\n  `project-description.json` (or the legacy state field), `[scope]` exactly\n  matches `aidlc-state.md`, and memory entries name the active space's\n  stage-loaded `org.md`, `team.md`, or `project.md` and exactly match a visible\n  rule under the cited H2\n- question tags resolve to visible filled answers in the sibling\n  `intent-capture-questions.md`\n- when the initial description carries a pasted document (any `<document>` or\n  `</document>` marker), deliverables cannot use `[desc]`; request and document\n  claims require confirmed `[Q<n>]`\n- `[scope]` grounds claims only in a workflow-selected Initial Scope Signal\n- `[assumption]` appears only in the assumptions section\n- retained assumptions exactly match entries under an\n  `## Assumption Confirmation` answered exactly `A. Accept assumptions`\n\nContract headings (`Sources`, `Q<n>`, `Assumption Confirmation`,\n`Assumptions & Open Questions`, `Initial Scope Signal`) are recognised by this\nsensor with or without a leading decoration: a run of fully-qualified emoji,\noptionally joined by U+200D, followed by whitespace, so `## ℹ️ Sources` names\nthe `Sources` section. A bare text-presentation symbol such as `©`, `™` or `▶`\nis not decoration. Findings quote the heading as written. Two headings keep\nexact matching because decoration must never widen what passes: `## Review`,\nwhose content the sensor skips, and the H2 a `[memory:<id>]` source cites,\nwhich names the memory file's exact heading. The Consolidated Summary\nConfirmation digest reads its `Q<n>` and `Assumption Confirmation` headings\nthrough the same rule, before and after its checkpoint.\n\nThe sensor reads block structure and link reference definitions through the\nbuilt-in `Bun.markdown` CommonMark/GFM parser. Where that parser accepts a link\nreference destination CommonMark rejects (an unbalanced parenthesis or one\nnested more than 32 deep, `<` inside angle brackets, an ASCII control\ncharacter, a backslash before anything but ASCII punctuation, or text after the\ndestination that cannot open a title), the line stays claim text, because a\nconforming renderer shows it. It excludes scaffolding, fenced code, code spans\n(at the parser's exact columns), HTML comments, and any legacy reviewer-added\n`## Review` content still embedded in an artifact.\nIndented code remains inspected as claim text by sensor policy, and a nonblank\nline the parser cannot place is read as its own claim.\nParagraph continuations stay\nin the same claim block; a new list item starts a new block. Each GFM table data\nrow is a separate claim, while its header and delimiter are scaffolding.\nIt validates citation shape and resolution only; the stage's adversarial\nreviewer judges whether the cited source actually supports the claim.\n\nEvery HTML block (CommonMark kinds 1 to 7) supplies the text it renders, as raw\nHTML text rather than Markdown headings, definitions, links, or code. Comments,\nprocessing instructions, declarations, CDATA, and hidden elements (`script`,\n`style`, `pre`, `template`, `code`, a `hidden` or `aria-hidden` attribute, or a\n`display:none` or `visibility:hidden` style, quoted or not) render nothing, so a\nblock made only of them is not a claim; text after a comment or closing tag on\nthe block's last line is visible and is a claim. Fence, comment, and\ncode-span syntax inside those blocks cannot change their Markdown extent:\nbackticks are literal, while actual HTML comments and hidden elements or\nattributes still cannot ground a claim. A visible literal `[Q1]` in a `div`\ncan ground its claim; `[Q1]: /url` in that block never defines a Markdown link.\nRaw HTML content cannot open a control section or supply an answer tag in the\nquestions file.\n\nUnder a deliverable's `## Sources`, the exact single-line declaration\n``- [scope] Workflow-selected scope: `<scope>`.`` is metadata only when its\nscope matches the validated questions register and authoritative workflow state.\nThe `[scope]` label must remain visible literal text, not a Markdown link.\nThis exception applies only to that complete declaration: wrong values,\nmalformed or unregistered declarations, appended text, neighboring claims, and\nother source tags still receive the normal checks. A `Sources` heading never\nexempts an entire section or makes unsupported content valid.\n\nA tag counts when the rendered document shows it as literal text. Bracket pairs\nresolve as Markdown links only against a definition parsed from the original\ndocument, including definitions nested in containers and multiline definitions.\nThus `[Q1][Q2]` remains two visible tags when neither reference resolves, while\n`[Q1]` in Markdown prose with a matching `[Q1]: /url` definition is a link and\ngrounds nothing. Definition-shaped lines that the parser identifies as prose\nremain claim text: a definition cannot interrupt a paragraph, and a nested\nordered list not starting at `1` cannot interrupt it either.\n\nAccepted assumptions use the same parser-backed claim blocks within\n`## Assumption Confirmation`. Only list-item entries carrying `[assumption]`\ncount; the two fixed option lines and `[Answer]:` are scaffolding. Wrapped or\nlazy-continuation text belongs to the whole entry, so a shorter confirmation\ncannot accept a longer retained assumption.\n\nWhere this reading cannot afford full CommonMark, the divergence must land as a\nfalse failure and never as a false pass: the sensor may ask for a citation the\ndocument did not owe, but it must not let unsourced or invisible-tag content\nthrough.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail listing missing sections, untagged\nclaim blocks, unresolved source ids, misplaced assumption tags, or an\nunconfirmed assumption set.\n"
  }
};

export function getSensorSpec(id: string): SensorSpec | undefined {
  return SENSOR_SPECS[id];
}

export function getAllSensorSpecs(): SensorSpec[] {
  return Object.values(SENSOR_SPECS);
}
