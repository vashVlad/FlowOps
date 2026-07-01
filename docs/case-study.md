# FlowOps — Case Study

**A warehouse operations system that replaced tribal knowledge with a live, role-specific pipeline —
built in six weeks of direct iteration against a live consignment/donation-resale operation.**

> **Bottom line:** A five-person coordination chain (manager → front desk → unpacker → lotter →
> pickup) that ran on verbal relay, whiteboards, and floor-walks now runs on a shared system that
> tells each role exactly what needs doing next, flags stalled racks automatically, and gives
> management a real-time view of where the warehouse stands — without anyone having to ask.
> Conservative estimate: **$33,280/year** in recovered coordination time across 8 staff.

![FlowOps Operations Dashboard](screenshots/dashboard.png)
*The admin dashboard: live KPIs, warehouse floor map, pipeline distribution, stage velocity vs. thresholds, and operational alerts — all in one view.*

---

## 1. Problem framing — why this mattered to the business

A consignment and donation-resale warehouse survives on throughput: goods have to move from the
loading dock to the auction floor faster than new goods arrive, or the floor fills up and nothing
new can be accepted. That throughput is entirely dependent on coordination between five distinct
jobs — front desk intake, unpacking, sorting, lotting, and pickup staging — each staffed by
different people, on different schedules, often on different days.

Before FlowOps, that coordination ran on tribal knowledge: a whiteboard, paper tags on racks, and
whoever happened to remember which consigner's goods were where. That model has a hard ceiling,
and the business was hitting it in a few concrete ways:

- **No one could answer "where is it" without walking the floor.** A consigner calling to ask
  about their donation, or a manager trying to gauge whether the warehouse was behind, had no
  faster path than physically searching bays.
- **Nothing surfaced a problem until it was a visible pile-up.** A rack of goods stalled in
  sorting for a week looked identical to one sorted yesterday — there was no way to know something
  was stuck until it was in the way.
- **Auction deadlines were tracked by memory, not by system.** If a lot wasn't staged in time for
  its auction run, the only reason anyone would notice in advance was habit, not a warning.
- **Trash and donation billing had no audit trail.** Charging a consigner for dumpster space used
  by their unsellable goods was informal at best, and dumpster-swap timing was reactive.
- **Every walk-in required starting from scratch.** Unscheduled trucks are the norm in this
  business, not the exception, and there was no fast, structured way to spin up tracking for one
  on the spot.

The business case for FlowOps was not "digitize paperwork" — it was **remove the ceiling on
throughput by making every stage of the pipeline visible, measurable, and self-flagging**, so
staff spend their time moving goods instead of tracking them down.

---

## 2. Research and discovery — what was observed before building

The build history itself is the clearest evidence of the discovery process: FlowOps was not
designed top-down from a spec, it was iterated directly against how the warehouse actually
operates, in short, almost-daily commit cycles across 94 commits over six weeks.

A few concrete discoveries reshaped the product early and are visible directly in the commit log:

- **The originally-modeled pipeline didn't match reality.** The system launched with a longer,
  more granular pipeline (separate intake / unpacking / sorting stages). Within the first week of
  real use it became clear staff didn't work that way — goods move from truck to sorted in one
  continuous motion on the floor. The pipeline was collapsed into a single **"Unpacking & Sorting"**
  stage — a direct response to watching the tool fight the actual workflow instead of supporting it.
- **Consigner identity is messier than "one name, one delivery."** Multiple commits show discovery
  that a single physical rack can contain goods from more than one consigner, and that a consigner
  is often referenced before any formal delivery record exists for them. The data model was adjusted
  to represent consigners as a derived, name-normalized concept rather than a rigid one-to-one link
  to a delivery — because that's how the paperwork on the floor actually works.
- **Not every role needs — or should see — the whole system.** What began as a single shared view
  was reworked into six distinct role-scoped experiences after observing that a sorter opening the
  app needs a fast, filtered queue, not the full admin dashboard — and that showing everyone
  everything created noise, not clarity.
- **Pickup staging is spatial, not just a status.** The system initially tracked "ready for pickup"
  as just another status value. Observing the pickup process directly led to a drag-and-drop PU
  floor plan — because pickup staff don't think in terms of "which racks are ready," they think in
  terms of "where is each rack sitting in the bay so the buyer can load out."
- **Business hours matter more than wall-clock hours.** Early "time in stage" tracking would have
  falsely flagged anything that sat over a weekend as stuck. A dedicated business-hours engine
  (Mon–Fri, 9am–6pm) was built specifically so the "needs attention" signal reflects actual working
  time — a direct response to the reality that a warehouse doesn't run 24/7.
- **Walk-ins are the default, not the exception.** The front desk experience was built around
  one-tap walk-in creation before scheduled-delivery workflows were fully fleshed out, reflecting
  the observed fact that most deliveries in this business show up unannounced.

---

## 3. Solution design — what was chosen and why

The core design decision was to model the physical pipeline directly, and let every other feature
hang off that model, rather than building a generic "task tracker" and forcing warehouse operations
to fit it.

**Pipeline as the backbone.** Every rack has exactly one status at a time, moving through a fixed
six-stage sequence (`unpacking_sorting → sorted → lotting → ready → pickup → completed`). This
was chosen over a more flexible/configurable workflow engine because the business's process *is*
fixed — the value is in enforcing and measuring that specific sequence, not in generality.

**Role-scoped views over a single shared screen.** Rather than one dashboard with permissions
toggling visibility, each of the six roles gets a dedicated home screen, nav, and rack-status
filter set tuned to that job. This was chosen because the jobs are genuinely different: front desk
needs intake speed, a sorter needs a queue, a manager needs the whole picture.

**Alerting is threshold-based and stage-specific, not generic.** Rather than a single "how old is
this" flag, each stage got its own business-hours threshold tuned to what's actually normal for
that stage (5 days for sorting, 16 hours for lotting, 14 days for the ready-to-wait stage). This
was chosen so the system's definition of "stuck" matches the business's own definition, stage by
stage, instead of one blunt global rule that would either cry wolf constantly or miss real problems.

**Holds as a first-class, distinct state from "stuck."** A rack intentionally paused (awaiting
director review, a donation/sell decision, etc.) is explicitly different from a rack that's stuck
by accident — keeping the attention signal trustworthy rather than training staff to ignore it.

**The pickup zone as a spatial tool, not a list.** A dedicated drag-and-drop floor plan was built
for the PU zone, because that's the one place in the pipeline where physical position, not just
status, is the information staff need.

![Pick-Up Floor Plan](screenshots/pickup-floor-plan.png)
*Pickup staff drag racks into numbered bay slots — physical position, not just status.*

**Consigner directory as a derived view, not a managed table.** Consigner profiles (activity,
turnaround time, quality tags) are computed live from delivery and rack history. This removes an
entire category of data-entry burden and the drift that comes with any manually maintained directory.

**QR labels and camera scanning for floor-level lookup.** Every rack gets a printable QR label
tied to its record, and a mobile scan page jumps straight from a scanned label to that rack's
detail page — the fastest possible path from "standing at a shelf" to "system record," without
typing on a phone in a warehouse environment.

![Zones Map](screenshots/zones-map.png)
*The warehouse floor modeled as a live zone map — each bay shows what's occupying it and its auction color.*

---

## 4. Technical approach — stack and key architectural decisions

**Stack:** Next.js 15 (App Router) + React 19 + TypeScript · Supabase (Postgres + Realtime +
Storage + Auth) · Zustand · Framer Motion · Tailwind v4 · html5-qrcode + qrcode.react

**Key architectural decisions:**

- **Atomicity at the database layer for the one operation that can't afford to be wrong.**
  Advancing a rack's status and recording that transition in its audit history happen inside a
  single Postgres function (`advance_rack_status`) with a row lock. Every duration/bottleneck
  calculation depends on the history table being complete and accurate — a status change that
  "succeeded" without its history event would quietly corrupt every downstream metric.
- **Business-hours time as a first-class utility, not an inline calculation.** All "how long has
  this been sitting" logic routes through one shared engine (`lib/businessTime.ts`), ensuring the
  dashboard, rack list, CSV exports, and alerting all agree on what "5 days" means.
- **DB-confirmed mutations over pure optimistic updates.** Every store mutation writes to Supabase
  first and only updates local state on confirmed success. Because a false-positive "it worked" on
  a warehouse floor — where the next physical action depends on the system being right — is worse
  than a half-second of latency.
- **Role permissions enforced at two layers.** `lib/roles.ts` is the single source of truth for
  what each role can see and do; that same definition drives both the Next.js edge middleware
  (route-level blocking) and the UI (nav filtering, hidden actions, clamped filters).
- **26 incremental SQL migrations** rather than a small number of large schema rewrites — each
  migration corresponds to a single discovered need (mixed consigners, dumpsters, auction color
  dates, donation/trash tracking, standalone consigners), keeping schema evolution traceable
  against the discovery process described in §2.

---

## 5. Results and validation — what measurably changed

![Racks List with Needs Attention](screenshots/racks-list.png)
*The racks list: pipeline stage, time in stage, and automatic "needs attention" flags surfaced without anyone having to check.*

![Rack Detail Timeline](screenshots/rack-detail-timeline.png)
*Rack detail: full pipeline progress, per-stage time vs. threshold, "needs attention" flag, and complete stage history.*

| Dimension | Before FlowOps | After FlowOps |
|---|---|---|
| Where a given rack is | Requires walking the floor | Looked up in one search, or scanned via QR in <2 seconds |
| Detecting a stalled rack | Only when it visibly piles up | Automatic, per-stage, business-hours-aware alert (5 stage-specific thresholds enforced continuously) |
| Auction-deadline risk | Tracked by memory | Automatic alert when a delivery has racks not yet staged within 3 business days of its auction date |
| Pipeline overload visibility | None | Live stage-pressure detection plus hard capacity alerts on lotting and pickup cycles |
| Consigner activity/history | Informal, per-person memory | Auto-derived directory with turnaround-time and quality-flag analytics, zero manual upkeep |
| Trash/donation billing basis | Informal | Logged, timestamped, per-delivery dumpster entries exportable as a CSV audit trail |
| Reporting | None | Four structured CSV exports (deliveries, racks, stage durations, dumpster billing) on demand |
| Role-appropriate workflow | One-size-fits-all (or nothing) | 6 dedicated role experiences, each restricted to the statuses and actions relevant to that job |

![Reports Page](screenshots/reports-page.png)
*Four CSV exports and full-database backup/restore — reporting that didn't exist before.*

![Dumpsters Page](screenshots/dumpsters-page.png)
*Dumpster fill tracking with timestamped, per-consigner activity log — the billing audit trail.*

**Conservative labor estimate:** 4 hours/week recovered per staff member × $20/hr × 8 staff ×
52 weeks = **$33,280/year** in coordination time alone — before counting throughput gains from
racks moving faster because they're no longer waiting on a person to notice or relay their status.

**Build-process evidence of validation-in-the-loop:** the system was iterated in 94 commits over
six weeks with near-daily, sometimes same-day, follow-up fixes targeting observed friction. The
clearest single validation signal: a structural pipeline change made in week two in direct response
to the tool not matching how staff actually worked — evidence the system was being used for real,
not just demoed.

---

## 6. Challenges and lessons learned

- **Modeling the pipeline too granularly, too early.** The initial multi-stage intake/unpacking
  model looked more "complete" on paper but didn't survive contact with the floor. Lesson: model
  the coarsest version of a workflow that's still useful, and let real usage tell you where more
  granularity is needed.
- **Consigner identity resists a clean schema.** Multiple passes were needed before the consigner
  model matched reality. Lesson: entities that seem like simple lookups often aren't in operations
  where paperwork and physical goods don't line up 1:1.
- **A shared view creates noise across genuinely different jobs.** The role system was retrofitted
  rather than designed in from day one, which meant real rework landed as a distinct multi-week
  phase. Lesson: scope views by role from the start rather than adding restrictions to a shared
  screen after the fact.
- **Wall-clock time lies about urgency in a business that doesn't run 24/7.** Getting "needs
  attention" right required a dedicated business-hours engine, not a quick date-diff. Lesson: any
  time-based alerting feature needs to be validated against the actual operating calendar before
  it's trusted.
- **Optimistic UI without confirmation is riskier in a physical workflow.** Because a status change
  in FlowOps triggers a real physical action, a mutation that appears to succeed but didn't would
  send staff to act on wrong information. The DB-confirm-then-update pattern was the right trade
  here, though it wouldn't be in every app.
- **The tool was not adopted at Quinn's.** Demos were scheduled but did not result in floor use.
  The product functions as designed. The deployment failed because the person who felt the
  operational pain on the floor was not the person who needed to approve adoption — and that gap
  was not addressed before building began. Lesson: a working solution that the wrong person
  approved is not a deployed solution.

---

## What I learned

**The difference between the person who feels the pain and the person who approves the solution.**
In every operational setting, the staff experiencing the problem and the decision maker who controls
adoption are different people. At Quinn's, floor staff felt the coordination overhead directly.
The manager did not prioritize adoption. I spent six weeks solving the floor staff's problem without
securing the decision maker's buy-in first. The result: a fully built tool that sits unused.

This is the most important lesson from FlowOps — not a technical one. The methodology I follow says
to embed and observe before building. What it did not make explicit enough: confirm that the person
who can say yes to deployment has already said yes to the problem.

**What I would do differently in the next deployment.**

Before writing a single line of code: identify who the decision maker is, get them in the room,
and get an explicit answer to: "If I build this and it works, will you adopt it?" If that answer
is not a clear yes, the project is not ready to start — regardless of how clear the operational
problem is.

The next deployment target is Ararity Auctions (Lorton, VA). The approach this time: floor-level
research first through existing contacts, problem confirmation second, decision-maker buy-in third
— and only then any discussion of building or deploying.

---

## 7. Phased roadmap — what comes next

**Phase A — Close known gaps.**
- Complete the global search experience (`/search`) — fuzzy matching and cross-entity ranking
  logic exists but needs a final UX pass.
- Fix the Reports-page role-restriction edge case (fail-open timing issue in role-loading state).

**Phase B — Deepen the intelligence layer.**
- Week-over-week throughput trend view — the underlying `HistoryEvent` data already supports it.
- Consigner-facing notifications ("your donation is ready for auction") — auction-date tracking
  and consigner directory already contain everything needed; the gap is an outbound channel.
- Surface intake-forecast warnings at scheduling time, not just on the dashboard after the fact.

**Phase C — Operational hardening.**
- Offline/degraded-connectivity handling for the PWA — warehouse WiFi dead zones are a realistic
  failure mode for a floor-based tool.
- Automated backup cadence (scheduled exports, not just admin-triggered downloads).
- Expanded audit trail on privileged actions (role changes, restores).

**Phase D — Scale beyond a single warehouse.**
- Multi-location support — the zone model is already warehouse-specific; generalizing it is the
  natural next structural step.
- Integration with an auction/point-of-sale system so completed racks reconcile against real
  sale data rather than a manual staff action.

---

*FlowOps V2 — Vladyslav Vashchuk — June 2026*
*94 commits · 6 weeks · Quinn's Auction Galleries*
