# Frozen Studio prototype interaction and data contract

## Milestone boundary

`/studio` is a non-production executable wireframe for validating a shared human/agent LinkedIn demographic exploration. The behavioral contract is frozen, and the approved Slice 1 shared-workspace architecture now implements it.

The active fixture is deterministic, representative demo data that conforms to the approved August 8–21 export contract; it is not an export of staging delivery and does not represent real customer performance. Public artifacts use only the fictional Northstar Media identity. Slice 3 registers three browser-only read tools; Slice 4 adds exactly four guarded workspace-mutation tools; Slice 5 evaluates the frozen seven-tool interaction surface. The prototype connects to no backend or Cloud SQL database.

Current public disclosure:

> **Demo dataset — representative LinkedIn B2B audience performance data**

When an already-anonymized staging export replaces the representative fixture, change the provenance contract and disclosure together to:

> **Anonymized historical sample — privacy-adjusted directional data**

The public identity mapping is centralized in `lib/dataset/public-demo-identities.ts` and frozen as:

| Identity | ID | Public label |
|---|---|---|
| Client | `client_demo_001` | Northstar Media |
| Product Campaign | `pc_demo_001` | Growth Leaders |
| Product Campaign | `pc_demo_002` | Executive Reach |
| Product Ad Set | `pas_demo_001` | Innovation Buyers |
| Product Ad Set | `pas_demo_002` | Revenue Leaders |
| Product Ad Set | `pas_demo_003` | Operations Decision Makers |

Selectors, workspace identity state, Agent Activity, and Product Campaign/Product Ad Set Plotly comparison labels fail closed when a value is outside this mapping. The Studio does not persist workspace or identity state in `localStorage`, `sessionStorage`, or IndexedDB.

## Canonical identity model

The three identity layers are distinct and must never share an ambiguous `campaignId` or `campaignName` field:

| Layer | Canonical fields | Meaning |
|---|---|---|
| Product Campaign | `productCampaignId`, `productCampaignName` | Growth Leaders product grouping that can contain Product Ad Sets |
| Product Ad Set | `productAdSetId`, `productAdSetName` | Analytical product subject shown in the Studio |
| LinkedIn source Campaign | `linkedinSourceCampaignUrn` | LinkedIn `sponsoredCampaign` source identity, read at analytics reporting level `CAMPAIGN`, mapped to one Product Ad Set |

UI controls and comparison labels must say **Product Campaign** or **Product Ad Set**. “LinkedIn source Campaign” is reserved for the source identity and must not be presented as the Product Campaign.

## Canonical dataset contract

```ts
type LinkedInDemographicDatasetContract = {
  datasetId: string
  provenance: 'representative_demo' | 'anonymized_historical_sample'
  disclosure: string
  client: { id: 'client_demo_001'; name: 'Northstar Media' }
  sourceType: 'daily_provisional_directional'
  reportingLevel: 'CAMPAIGN'
  linkedinSourceEntityType: 'sponsoredCampaign'
  productSubjectType: 'product_ad_set'
  window: { startDate: string; endDate: string }
  privacyAdjusted: true
  qualitySemantics: {
    statusOnlyEvidencePreserved: true
    unresolvedLabelsPreserved: true
    missingMetricsAreNotZero: true
    caveats: string[]
  }
  rows: LinkedInDemographicFixtureRow[]
}

type LinkedInDemographicFixtureRow = {
  reportDate: string
  subjectKind: 'product_ad_set'
  productCampaignId: string
  productCampaignName: string
  productAdSetId: string
  productAdSetName: string
  linkedinSourceCampaignUrn: string
  demographicDimension: B2BDemographicPivot
  pivotValue: string | null
  pivotLabel: string | null
  pivotLabelStatus: 'resolved' | 'unresolved' | 'not_applicable'
  evidenceKind: 'metric_observation' | 'status_only'
  coverageStatus:
    | 'complete'
    | 'empty_observed'
    | 'partial'
    | 'rejected'
    | 'not_attempted'
  privacyAdjusted: true
  impressions: number | null
  clicks: number | null
  costInLocalCurrency: number | null
  externalWebsiteConversions: number | null
}
```

The target window is `2026-08-08` through `2026-08-21`, inclusive. Status-only rows and unavailable metrics retain `null`; they are never normalized to zero. Unresolved labels preserve `pivotValue` and render a clearly marked fallback rather than an invented label.

The directional source caveats are contractual:

- daily snapshots are directional sums, not exact-window demographic totals or deduplicated reach;
- LinkedIn privacy thresholds and adjustments may suppress or revise rows;
- confirmed-empty pivots contribute status evidence but no zero-valued metric row;
- partial, rejected, and not-attempted evidence is excluded from metrics rather than treated as zero.

## Independent demographic pivots

The nine captured B2B pivots are:

- `MEMBER_JOB_FUNCTION`
- `MEMBER_SENIORITY`
- `MEMBER_JOB_TITLE`
- `MEMBER_COMPANY`
- `MEMBER_COMPANY_SIZE`
- `MEMBER_INDUSTRY`
- `MEMBER_COUNTRY_V2`
- `MEMBER_REGION_V2`
- `MEMBER_COUNTY`

Pivots are mutually independent. A row and an analytical query carry exactly one pivot. A Product Ad Set, Product Campaign, or time comparison groups values inside that pivot; it never adds a second demographic axis.

## Analytical capability contract

All human and simulated agent views execute through one capability:

```ts
type AnalyticalQuery = {
  demographicDimensions: B2BDemographicPivot[]
  comparisonDimension: 'none' | 'productAdSet' | 'productCampaign' | 'time'
  metric: MetricKey
  filters: {
    productCampaignId: string
    productAdSetId: string
  }
  startDate: string
  endDate: string
  animationEnabled: boolean
  currentDate: string
}
```

The capability rejects zero or multiple requested pivots before filtering or aggregation:

```ts
{
  ok: false,
  error: {
    code: 'unsupported_demographic_intersection',
    message: 'LinkedIn demographic pivots are independent. An analytical query must select exactly one demographic dimension.',
    details: {
      requestedDemographicDimensions: B2BDemographicPivot[],
      requiredCount: 1
    }
  }
}
```

Disabled UI controls are only guidance; this capability response is the actual enforcement boundary.

## Metric support and availability

`supported` describes whether the dataset contract defines a metric. `available` is calculated for the current evidence selection.

```ts
type MetricAvailability = {
  metric: MetricKey
  supported: boolean
  available: boolean
  unavailableReason: string | null
}
```

Rules:

- Supported raw metrics remain available when metric observations exist, including an observed numeric zero.
- A selection containing only status evidence has no available metrics.
- CPA and CVR are unavailable when no conversions were observed; they do not render as zero.
- CTR and CPM require impressions; CPC requires clicks.
- Missing, suppressed, unavailable, or status-only metrics never silently become zero.

## Shared interaction state

The client-side reducer stores:

- one `demographicDimension`;
- one bounded `comparisonDimension`;
- metric and compatible chart type;
- Product Campaign and Product Ad Set filters;
- report-date range and optional daily animation marker;
- deterministic highlight state;
- workspace revision and visible Agent Activity.

Human controls and simulated agent actions dispatch the same command shape:

```ts
{
  actor: 'human' | 'agent'
  label: string
  patch: WorkspacePatch
}
```

Every accepted command increments the workspace revision. Agent-authored commands also append a human-readable Agent Activity entry. Human changes update the same state immediately but do not masquerade as agent activity.

## Slice 1 architecture

The frozen behavior is implemented through these boundaries:

```text
staging-export-shaped fixture
        ↓
dataset adapter → canonical dataset
        ↓
analysis query → grouped cells, totals, quality, availability
        ↓
workspace provider → reducer state + semantic capabilities
        ↓
visualization model → Plotly traces/layout
        ↓
Studio React controls
```

- `lib/dataset/` owns canonical identities, dimensions, evidence semantics, the staging-export shape, fixture generation, and adaptation.
- `lib/analysis/` owns validation, filtering, pivot isolation, additive aggregation, derived metrics, comparison grouping, ordered time results, quality, and metric availability. It imports no React, Plotly, or WebMCP code.
- `lib/workspace/` owns nested workspace state, the reducer, selectors, and semantic capabilities. Human controls and demo agent operations use this same capability surface.
- `lib/visualization/` owns chart compatibility and converts successful analytical results into Plotly view models. Plotly state is never canonical workspace state.
- `components/studio/StudioWorkspaceProvider.tsx` binds the pure store and analysis layers to React Context and `useReducer`.

Canonical workspace state is grouped into used responsibilities:

```ts
{
  dataset,
  selection,
  analysis,
  visualization,
  animation,
  story,
  runtime
}
```

`animation.currentFrame` is workspace state. `workspace.getState()` and the semantic capabilities form the WebMCP seam. Slice 1 introduced the seam without registration; Slice 3 attaches only the approved read-only tools.

## Slice 2 fixture boundary

The public fixture filenames are frozen as:

```text
adset-demographics-sample.csv
adset-demographics-sample.meta.json
```

`lib/dataset/csv-fixture-adapter.ts` parses those artifacts into the staging-export shape and then reuses the canonical dataset adapter. Studio, workspace, analysis, and visualization code never consume CSV column names.

The CSV adapter fails closed unless:

- metadata uses `median-viz.adset-demographics-export.v1`;
- client/account identity is the fictional Northstar Media identity;
- Product Campaigns are Growth Leaders and Executive Reach;
- Product Ad Sets are Innovation Buyers, Revenue Leaders, and Operations Decision Makers;
- IDs and LinkedIn source Campaign references use the approved demo namespaces;
- all nine pivot types are declared;
- exactly two Product Campaigns and three Product Ad Sets are present;
- the export states that only latest imported revisions were retained;
- anonymization occurred before repository write;
- status-only metrics remain null.

`npm test` scans source inputs before running tests. `npm run build` scans source before compilation and generated `.next` output afterward. Both reject non-canonical demo identity tokens and browser-persisted Studio state. CI can additionally set `PUBLIC_DEMO_PRIVATE_DENYLIST_PATH` to a newline-delimited file outside the repository. Vercel can provide the same newline-delimited content as a base64-encoded secret in `DEMO_PRIVATE_DENYLIST_BASE64`. This keeps sensitive customer knowledge out of public source while scanning both source and generated artifacts.

The deterministic TypeScript fixture remains available for unit tests and local fallback validation. It uses the same fictional identities and contains no real client, account, Campaign, Ad Set, or source Campaign identifiers.

## Slice 3 WebMCP boundary

WebMCP is a browser-only progressive enhancement. `lib/webmcp/` registers tools on the fully active `document.modelContext` when it exists. Unsupported browsers continue to run the normal Studio without registration, errors, backend calls, or behavior changes.

Exactly three tools are registered:

| Tool | Input schema | Bounded result |
|---|---|---|
| `inspect_dataset` | Strict empty object | Dataset identity, semantics, dates, nine pivots, comparisons, metrics, constraints, and quality summary |
| `get_workspace_state` | Strict empty object | Canonical workspace revision, view, filters, dates, animation frame, availability, and relevant warnings |
| `get_current_result_summary` | Strict empty object | Aggregate-safe totals, availability, comparison groups, and deterministic top/bottom five segments |

All three declare `readOnlyHint: true` and `untrustedContentHint: false`. They return JSON-serializable objects and never expose raw rows, source Campaign references, Plotly internals, executable code, or noncanonical identities.

Tool callbacks read the latest state through `WorkspaceCapabilities.getState()` and convert it to an analytical query with `workspaceStateToQuery()`. The existing analysis engine remains the only implementation of filtering, aggregation, derived metrics, availability, and evidence semantics.

Registration uses one `AbortController` lifecycle per document model context. A replacement registration aborts the prior lifecycle before registering the same seven names, preventing React Strict Mode duplicates. Component cleanup aborts the active registration. The registration adapter uses the current `document.modelContext` API and does not use legacy bulk-context APIs.

## Slice 4 guarded mutation boundary

Exactly four mutation tools share the same registration lifecycle and call `WorkspaceCapabilities`; they never import reducer internals or Plotly:

| Tool | Strict bounded input | Capability behavior |
|---|---|---|
| `configure_analysis` | Approved metric, exactly one pivot, comparison, compatible visualization, optional `expectedRevision` | Applies supplied analysis fields atomically |
| `apply_filters` | `mode: replace`, canonical Product Campaign/Product Ad Set IDs, Aug 8–21 dates, optional `expectedRevision` | Replaces supplied selection fields atomically |
| `set_animation` | `day_by_day` or `off`, enabled/playing state, bounded current frame, optional `expectedRevision` | Uses supported time/line animation semantics |
| `reset_view` | Optional `expectedRevision` only | Resets view/filter/animation state and preserves the loaded dataset |

All four declare `readOnlyHint: false`. A successful mutation returns `ok`, the previous and new revisions, a concise canonical state summary, and bounded warnings. The revision must increment exactly once and one controlled Agent Activity entry is appended. A mismatched `expectedRevision` returns `stale_workspace_revision` without dispatching.

An already-active request returns `ok: true`, `noOp: true`, equal previous/new revisions, and no Agent Activity entry. Partial updates preserve unrelated human state.

Invalid identities, dates, animation states, and visualization/comparison combinations fail before mutation. A multi-pivot `demographicDimension` request is passed to the existing analysis validator and returns the frozen `unsupported_demographic_intersection` error without creating invalid UI state.

## Slice 5 evaluation boundary

`evals/webmcp-scenarios.ts` records the natural-language intent matrix: expected tools and arguments, workspace transition, result/explanation, mutation permission, revision behavior, privacy, recovery, and whether evidence is automated or live-only.

`evals/webmcp-eval-runner.ts` deterministically invokes the actual tool definitions and workspace capabilities. It covers discovery, configuration, filtering, partial refinement, animation, unsupported semantics, unavailable CPA/CVR recovery, human and animation revision races, the primary human/agent handoff, semantic no-ops, bounded summaries, and privacy. It does not claim to evaluate language-model tool selection.

Run `npm run eval:webmcp`. Live natural-language routing and the 2–3 minute demo checklist are documented in `evals/README.md` and remain explicit ChatGPT-in-browser evidence.

## Slice 6 deployment preflight boundary

The current fixture provenance is `representative_demo`. `DEPLOYMENT_PREFLIGHT.md` defines the proposed Vercel root, Node/build configuration, private privacy-denylist gate, immutable source binding, preview-only smoke checks, hosted WebMCP verification, rollback evidence, and approval boundary. No Vercel project, environment variable, deployment, domain, or production routing is created or changed by the preflight.

## Demo agent actions

- **Switch to seniority** replaces the active pivot; it does not add Seniority as a second axis.
- **Compare Product Ad Sets** groups the current pivot by Product Ad Set.
- **Compare Product Campaigns** groups the current pivot by Product Campaign.
- **Show the daily trend** groups the current pivot by report date across August 8–21.
- **Highlight the highest CPA value** ranks available values only inside the active pivot.
- **Reset the exploration** restores the default Job Function view without unloading the fixture.

## Explicit non-production boundaries

- No Cloud SQL or hosted staging query
- No claim that fixture metric values are real delivery
- Exactly three read and four guarded workspace-mutation WebMCP tools; no dataset writes or remote MCP server
- No backend, API routes, authentication, or multi-user collaboration
- No persistence, sharing, export, or durable history
- No LLM call; agent actions and findings are deterministic presets
- No production-scale data engine or performance claim
- No change to `/pie`, `/bar`, or `/map`

## Frozen acceptance criteria

- Product Campaign, Product Ad Set, and LinkedIn source Campaign are unambiguous in code and UI.
- Metric support and current-selection availability are separate.
- `daily_provisional_directional`, privacy adjustment, status-only evidence, and unresolved labels are preserved in the canonical dataset contract.
- The capability rejects any analytical query that does not request exactly one demographic pivot.
- Only None, Product Ad Set, Product Campaign, and Time are offered as comparisons.
- Human and simulated agent actions update the same visible state and Agent Activity.
- Existing visualization routes remain available.

This milestone stops after Slice 1 shared-workspace architecture. WebMCP, backend, Cloud SQL, hosted fixture replacement, and deployment each require separate approval.
