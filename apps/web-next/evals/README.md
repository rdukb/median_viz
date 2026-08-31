# WebMCP interaction evaluation

Slice 5 evaluates the frozen seven-tool WebMCP surface as a shared human/agent workflow. It does not add product capabilities or pretend that deterministic code can measure language-model tool selection.

## Automated evaluations

Run:

```bash
npm run eval:webmcp
```

The deterministic runner proves:

- the tool surface remains exactly three reads and four mutations;
- dataset discovery returns the nine approved pivots without mutation;
- basic analysis, filter refinement, partial human-to-agent refinement, animation, and reset produce the expected canonical state;
- CPA/CVR are supported but unavailable in the zero-conversion Northstar fixture, while CPC recovery succeeds;
- unsupported intersections, Device, State, and ROAS do not mutate the workspace;
- human and animation revision races fail stale, then recover by reading and retrying;
- the primary human/agent handoff produces revisions `0 → 1 → 2 → 3 → 4 → 5`;
- already-active requests are true no-ops with no revision or Agent Activity entry;
- result summaries remain bounded, aggregate-safe, privacy-safe, and renderer-independent.

The complete intent matrix is in `webmcp-scenarios.ts`. The runner invokes the actual page tool definitions and workspace capabilities; it does not mock a language model.

## Live ChatGPT evaluations

Natural-language routing must be tested in ChatGPT's built-in browser. The Slice 5 approval records a passed manual baseline for configuration, filter refinement, incremental refinement, time animation, invalid intersections, unsupported dimensions/metrics, metric availability, and reset behavior.

Use this checklist for the new evaluation boundary:

| Prompt | Expected minimal routing | Observe |
|---|---|---|
| What can I break this audience down by? | Dataset inspection | Nine pivots, no mutation |
| Show CPC by Industry across Product Ad Sets. | One analysis configuration | Controls and revision update once |
| Just show Growth Leaders. | One filter replacement | Analysis context preserved |
| Which industries have the highest CPC now? | Current-result read | Filtered ranking, no mutation |
| Compare this across Product Ad Sets. | Current-state read if needed, then partial analysis configuration | Human metric/pivot preserved |
| Show how this changed day by day. | Animation configuration | Time/line view and canonical frame |
| What day am I looking at? | Workspace read | Exact paused frame |
| Compare Job Function with Seniority. | Unsupported intersection response | Structured error, no mutation, supported alternatives |
| Show CTR for mobile versus desktop. | Dataset inspection or explanation | No Device invention |
| Filter this to California. | Dataset inspection or explanation | No State inference; Region may be suggested |
| Show ROAS by Industry. | Dataset inspection or explanation | No substitute metric mutation |
| Show CPA by Job Function. | Analysis configuration and result read | Supported but unavailable, never zero/Infinity |
| Use CPC instead. | Partial analysis configuration | Valid chart recovery |
| Start over. | Reset | Dataset preserved |

For stale-revision and multi-actor handoff prompts, record the tool calls and revisions visible in the browser. Do not mark natural-language routing as deterministic merely because the local runner passes.

## Stale revision recovery

Recommended agent procedure:

```text
read latest state
→ reconcile user intent with newer human/frame changes
→ retry against the latest revision
```

Never silently overwrite a newer human selection or animation frame.

## Primary human/agent handoff

1. Human selects Growth Leaders.
2. Agent configures CPC by Industry.
3. Human selects Product Ad Set comparison.
4. Agent enables the day-by-day view.
5. Human pauses at `2026-08-15`.
6. Agent reads workspace and result summary.

Expected final state: Growth Leaders, CPC, Industry, Time/line, paused on `2026-08-15`, with only agent-authored operations in Agent Activity.

## Recommended 2–3 minute demo

Use normal collaborative prompts; do not say tool names aloud.

1. **Understand:** “What can I break this audience down by?”
2. **Configure:** “Show CPC by Industry across Product Ad Sets.”
3. **Human context:** Manually select Growth Leaders.
4. **Respect context:** “Which industries have the highest CPC now?”
5. **Animate:** “Show how this changed day by day.” Pause on one date.
6. **Handoff:** “Summarize exactly what we're looking at now.”
7. **Fail safely:** “Compare Job Function with Seniority.”
8. **Recover:** “Use Job Function and compare the Ad Sets instead.”
9. **Reverse:** “Start over.”

## Remaining live-only questions

- Does ChatGPT consistently choose the minimal partial mutation for every ambiguous wording variant?
- Does it explain a stale revision before re-reading and retrying without unnecessary extra tools?
- Does it suggest Region, rather than infer State, for the California request?
- Does public hosting expose WebMCP with the same origin isolation and privacy configuration as local verification?

These require live ChatGPT or deployment-specific evidence and are not claimed by the local runner.
