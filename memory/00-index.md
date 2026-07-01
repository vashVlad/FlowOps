# FlowOps — Memory Vault (Index)

This folder is FlowOps's persistent memory. Read this first, every session, before touching code or writing about the project's status.

**Read in this order:**
1. [[state]] — what's built, what's shipped, and the real deployment status (read this before quoting the README)
2. [[decisions-log]] — why things are the way they are
3. [[open-questions]] — unresolved items, blockers, things needing Vlad's input
4. [[session-log]] — dated log of work sessions (append a new entry at the end of any session with real changes)

**Related docs outside this vault:**
- `../README.md` — public-facing project description. **Caution:** as of 2026-07-01 it says "in active use," which is stale — see state.md.
- `docs/case-study.md`, `docs/impact-report.md` — external-facing writeups framed around the original Quinn's engagement; useful for the build narrative, not for current deployment status.
- `docs/development-log.md` — full narrative build history (13 sessions, 94 commits). This vault's `state.md` and `decisions-log.md` are distilled from it. **Session 14 in that log is the most important entry in the whole project right now.**
- `docs/codebase-audit.md` — technical audit of the codebase.
- `../../HireView/BLUEPRINT_Operations_Systems_Builder.md` — the cross-project methodology (lives in the HireView folder, applies here too — FlowOps is the Blueprint's Industry-5 logistics/ops proof point).

**Also present in this repo family:** `FlowOps-V1/` (initial `create-next-app` scaffold, effectively abandoned — do not confuse with V2) and `flowops-Prototype-Kimi/` (a single standalone HTML prototype, not part of the active codebase).

**Vault format:** plain markdown, Obsidian-compatible (`[[wikilinks]]` work if opened as a vault) but not Obsidian-dependent.
