# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root if it exists; otherwise the **Glossary** section of **`PRD.md`**.
- **`PRD.md`** (what) and **`TRD.md`** (how) for the module you're touching.
- **`docs/decisions/`**: read decision records (ADRs) that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved. New ADRs go in `docs/decisions/`, numbered after the last one (`NNNN-slug.md`).

## File structure

Single-context repo:

```
/
├── PRD.md               ← includes the Glossary section
├── TRD.md
├── GLOSSARY.md          ← optional; supersedes the PRD glossary once created
├── docs/decisions/
│   └── 0001-focus-on-supply-capacity-matching.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the glossary. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing decision record, surface it explicitly rather than silently overriding:

> _Contradicts decision 0001 (focus on supply-capacity matching), but worth reopening because…_
