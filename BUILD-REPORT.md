# BUILD REPORT — dishmath

Rebuild of `com.graziechef/kitchen-tools` v1.0.0 (npm
`@deusflight/graziechef-mcp`), built clean-room from the sole
authority spec at
`~/workspace/mcp-rebuild-100/specs-batch26/dishmath.md`.
Factory mechanics followed `~/workspace/mcp-rebuild-100/TEMPLATE.md`
with `builds/signalfeed/` as layout reference (mechanics only; no
prose or logic copied from any sibling or from the original).

## Tools (4)

- `food_cost_calculator` — plate cost from ingredients
  (`{ name, quantity, unit, unit_cost }` entries), the price that
  hits a target food-cost %, and the actual food-cost % at a
  current price.
- `menu_price_calculator` — from plate cost and target food cost:
  net price, price including VAT, menu price rounded **up** to a
  clean step, gross profit (net of tax) and real food cost after
  rounding. Output line labels mirror the spec's worked example.
- `recipe_scaler` — scales every quantity from N to M portions;
  batch cost and cost per portion are added only when every
  ingredient carries a unit cost.
- `allergen_matrix` — dish × allergen table for the 14 allergens
  of EU Reg. 1169/2011 Annex II, plus dishes to avoid per
  allergen. Allergens are user-declared per dish (never guessed
  from dish names); English, Italian and common names are
  normalised ("shrimp" → crustaceans, "dairy" → milk,
  "glutine" → cereals containing gluten, "solfiti" →
  sulphur dioxide/sulphites, …).

Pure local computation: no `fetch`, no network call, no key, no
account anywhere in `src/`. `currency` is an optional ISO code
(default `EUR`) that only changes formatting. Money rounds
half-up to 2 decimals, percentages half-up to 1 decimal. Every
result ends with the interactive-tool link line
(`https://graziechef.com/tools`).

## Pinned worked example (test oracle)

Verified digit for digit, both in the test suite and against the
built `dist/cli.js` CLI: plate cost 3.20, 30% target, 10% VAT,
0.50 step →

```
Net price (before tax): €10.67
Price incl. 10% tax: €11.74
Menu price (rounded up to 0.5): €12.00
Gross profit per plate (net of tax): €7.71
Real food cost after rounding: 29.3%
```

The pinned derivation is implemented as specified: tax is
computed from the rounded net, the menu price is the incl-tax
price rounded up to the step, and profit / real food cost are
computed back from the rounded menu price, net of tax.

## Files created (19-file factory set + report + parity-out/)

`package.json`, `server.json`, `Dockerfile`, `tsconfig.json`,
`.gitignore`, `package-lock.json`, `README.md`, `LICENSE`,
`CHANGELOG.md`, `src/index.ts`, `src/cli.ts`, `src/mcp.ts`,
`src/types.ts`, `src/kitchen.ts`, `test/kitchen.test.ts`,
`.github/workflows/ci.yml`, `.github/workflows/publish.yml`,
`.github/workflows/publish-container.yml`,
`.github/workflows/registry-publish.yml`, plus this
`BUILD-REPORT.md` and `parity-out/` (`tools-rebuild.json`,
`parity.json`, `parity.md`).

Server mechanics: low-level `Server` + `StdioServerTransport`
with explicit JSON-schema literals per tool (not the
McpServer/zod registration path). One bin, `dist/cli.js`,
serves the CLI and the `mcp` subcommand; `--version` prints
`0.1.0`.

For the local `tsc` build and tests, a sibling's intact
`node_modules` (`../signalfeed/node_modules`) was symlinked in
and removed again afterwards; `dist/` is a real `tsc` emit from
this build's own sources (verified: `node dist/cli.js
--version` → `0.1.0`, built CLI reproduces the worked example
above, unknown command exits 2 with Usage).

## Tests — actually run, observed counts

`npm test` (`tsx --test test/*.test.ts`, node:test, fixture
arithmetic only, no network):

- Tests: **23 run, 23 pass, 0 fail** (5 suites:
  rounding helpers 4, menu_price_calculator 6,
  food_cost_calculator 4, recipe_scaler 4, allergen_matrix 5).
- The pinned worked example is asserted line by line, digit
  for digit.

## Parity

- Original-side fixture written to
  `~/workspace/mcp-rebuild-100/harness/fixtures/graziechef-tools-original.json`
  (`_source` labels the spec and the reconstruction status of
  the schemas).
- Rebuild side captured from the live server's `tools/list`
  (initialize handshake confirmed `serverInfo` name `dishmath`,
  version `0.1.0`) into `parity-out/tools-rebuild.json`.
- Harness run: `python3 harness/parity.py --original … --rebuild … --out parity-out/`
  → **verdict PASS, parity 100.0** (4/4 tools, identical
  schemas, no missing, no extra, no schema diffs).

## Lockfile verification

Generated in a temp dir from this build's `package.json` alone
(no `node_modules` present): `npm install --package-lock-only
--ignore-scripts --offline` (Route 1, succeeded; the proxy
fallback was not needed). Verified after generation and again
after placement in the build dir:

- Parses as JSON; `name` == `@reneturcios/dishmath`.
- **`packages` entries: 128.**
- md5 identical before/after placement:
  `41f79076a9ea584ea5c8a8b9f4c75a3a`.

## server.json / Dockerfile checks

- Description is exactly the spec's Factory-notes string,
  measured **97 chars**:
  "Local restaurant math: food cost, menu price with VAT,
  recipe scaling and the EU allergen matrix."
- npm package entry carries `"version": "0.1.0"`; the OCI entry
  carries **no** `version` field (version only in the tagged
  identifier `ghcr.io/cloudcorprecords/dishmath:0.1.0`).
- Dockerfile carries
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/dishmath"`,
  matching `server.json` `name` and `package.json` `mcpName`.
- Version consistency: `package.json`, `server.json` (top,
  npm entry, OCI tag), core `VERSION`, and the newest
  `CHANGELOG.md` heading are all `0.1.0`.

## Reconstructions and gaps (as labelled by the spec)

- **Argument schemas are LABELLED RECONSTRUCTIONS.** The spec
  pins tool names, behaviour, the example questions and the
  worked example, but not parameter tables. Shapes used:
  `{ name, quantity, unit, unit_cost }` ingredient entries for
  `food_cost_calculator` (unit_cost required) and
  `recipe_scaler` (unit_cost optional there, since batch cost
  is reported only "when unit costs are given"); scalar
  `plate_cost` / `target_food_cost_percent` / `vat_percent` /
  `rounding_step` / `currency` for `menu_price_calculator`;
  `{ name, allergens[] }` dishes for `allergen_matrix`.
  Defaults chosen where the spec is silent: VAT defaults to 0
  and the rounding step to none (no "Menu price" line) when
  omitted; `recipe_scaler` quantities round half-up to 3
  decimals.
- **Per-tool interactive URLs are a LABELLED RECONSTRUCTION.**
  The spec pins that each result ends with a link to the
  matching interactive tool on graziechef.com, with the exact
  per-tool URL unknown; the spec directs using
  `https://graziechef.com/tools` as the base, which is what
  every result carries.
- **Allergen alias table** beyond the spec's two pinned
  examples ("shrimp" → crustaceans, "dairy" → milk) is a
  reconstruction: a conservative set of English/Italian/common
  aliases for the 14 canonical Annex II names (canonical names
  themselves always accepted). Unknown names are rejected with
  an error rather than guessed.
- The registry-listed original repo was not read (per the
  spec, the GitHub route was degraded); nothing was copied
  from the original's README text — all prose and code here
  were written fresh from the spec.

## Spec conflicts

None found. The brief and the spec agreed on every point
checked (tool set, worked example, description string and its
97-char measure, link base URL, lockfile expectations).
