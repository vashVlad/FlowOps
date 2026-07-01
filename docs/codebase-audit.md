# FlowOps V2 — Codebase Audit

*Compiled from a full read of the codebase on 2026-06-30 (branch `feature/backup-restore`).*

---

## 1. What operational problem does FlowOps solve?

FlowOps runs the back-of-house logistics for a consignment/donation warehouse that resells goods
through auctions (a Habitat for Humanity ReStore-style operation, based on the terminology —
"consigner," "J-Number," "auction color," "donation/trash split").

The core business problem: **goods arrive from many different consigners in an unpredictable
stream, and someone has to track every physical item from the loading dock to the auction floor
without losing track of whose stuff is whose, without letting anything sit forgotten, and without
overloading any one stage of the process.**

Before a system like this, that tracking would live in people's heads, a whiteboard, or paper
tags — which breaks down as soon as:
- More than one person needs to know where a rack of a consigner's items is.
- A consigner calls asking "did my donation sell yet / when's the auction?"
- Management needs to know whether the warehouse is falling behind (and where).
- A truck shows up unannounced and staff need to spin up tracking for it in seconds.
- The business needs to bill a consigner for trash disposal, or prove how much of their donation
  was sellable vs. dumped.

FlowOps replaces "tribal knowledge + whiteboard" with a live, role-specific, single source of
truth that every warehouse worker and the front desk look at, so a delivery can be traced from the
moment it's dropped off to the moment it's picked up (sold) by auction, and management gets
early warning when any stage is falling behind.

---

## 2. The full workflow FlowOps manages — intake to completion

### 2.1 Delivery intake (Front Desk)
A **delivery** represents one consigner's drop-off. Two intake paths:
- **Walk-in**: a truck shows up unannounced. Front Desk creates the delivery on the spot; it
  starts in `arrived` status immediately (no scheduling step).
- **Scheduled**: pre-booked with an expected date; sits in `scheduled` status until the truck
  actually shows up.

A delivery carries: consigner name, optional J-Number (a warehouse-assigned consigner ID),
type, status, scheduled date, and later an optional auction deadline.

Delivery status lifecycle: `scheduled → arrived → processing → complete`.
`complete` is set **automatically** once every rack linked to the delivery reaches `ready` or
further (see §5).

### 2.2 Unpacking & sorting (Unpacker / Sorter roles)
Staff at the `/unpack` page pick (or search for) the delivery, then create **racks** — the
physical unit of tracking (one cart/shelf of a consigner's goods). Each rack gets:
- An auto-generated code (`RC-0001…`) or a manual override (supports slash-delimited codes like
  `Yellow/Red` for color-coded racks).
- A starting status (defaults to `unpacking_sorting`, but can start further along the pipeline —
  e.g. an already-sorted rack).
- An optional auction color, linking it to a specific future auction run.
- Immediately added to the print queue for a QR-code label (see §4, Labels).

Racks in `unpacking_sorting` are visually inspected/culled; the sorter marks priority
(high/normal/low) and advances them to `sorted`.

### 2.3 Lotting (Lotter role)
Sorted racks queue up at `/lotting`. Lotting = grouping/organizing goods into sellable auction
lots. The queue view sorts by priority-then-wait-time so the oldest/most urgent racks surface
first. Once lotting work starts on a rack it moves to `lotting`, then to `ready` when the lot is
finished and staged for its auction date.

### 2.4 Ready → Pickup (Pickup role)
`ready` racks wait for their auction date. When an auction cycle opens, ready racks move to
`pickup` and are **automatically placed in the "PU" (Pick-Up) zone** the moment they advance
(see §5). The Pick-Up zone has its own dedicated page (`/zones/[PU-id]`) with a drag-and-drop
warehouse floor plan (bay/row/slot grid) so staff can visually lay out exactly where each rack
sits for the buyer/auction house to load out.

### 2.5 Completion
When a `pickup` rack is physically picked up/sold, staff mark it "Complete" — which **deletes the
rack record** (its full stage history remains in `rack_events`/`HistoryEvent` for reporting, but
the rack itself is done and removed from active views). This is the terminal state.

### 2.6 Supporting workflows running in parallel
- **Zones**: the physical warehouse floor is modeled as named zones (Gallery bays G1–G7,
  Warehouse bays W1–W10, fixed utility zones H/Hallway, B/Lotting Room, C/Sorting Room, and PU).
  A zone can be purposed as: an active delivery's staging area, a future scheduled delivery's
  spot, an auction color's staging area, or simply reserved.
- **Consigners**: not a first-class stored entity — profiles are computed on the fly by grouping
  deliveries/racks/standalone consigner records by normalized name. Tracks total & active
  deliveries, active racks, average turnaround time, and auto-generated "quality tags"
  (e.g. "Frequently held," "Slow to process").
- **Holds**: any rack can be paused mid-pipeline with a reason (waiting on boxes, director
  review, donation/sell decision, mixed inventory, space, pickup blocked). Held racks are
  excluded from "needs attention" alerting — they're intentionally paused, not stuck.
- **Dumpsters**: two physical dumpsters (Gallery, Warehouse) tracked as fill-percent gauges.
  Each "add" entry is tied to a delivery (or marked "operational use") and becomes that
  delivery's `trashPercent`, feeding the donation/trash/sellable billing split on the delivery
  page and the dumpster CSV export used for trash-charge billing.
- **Auction colors & dates**: racks/zones can be tagged with a color (representing a specific
  future auction run). A single global date-per-color mapping (`auctionColorDates` store) lets
  admins set one date that then displays everywhere that color appears — dashboard, zone map,
  rack cards, PU floor plan — without re-entering the date on every rack/zone individually.

---

## 3. Measurable bottlenecks the app is designed to catch

The system doesn't just log data — it actively watches for backups and encodes real,
business-tuned thresholds (`lib/timeTracking.ts`, `lib/businessTime.ts`). All time math runs on a
**business-hours clock** (Mon–Fri, 9am–6pm) so a rack sitting overnight or over a weekend doesn't
falsely appear "stuck."

| Stage | Threshold | What it catches |
|---|---|---|
| Unpacking & Sorting | 5 business days | Goods not being processed off the truck fast enough |
| Sorted (queued for lotting) | 24 business hours | Sorted racks piling up before lotting starts |
| Lotting | 16 business hours (~2 days) | Lots taking too long to build |
| Ready (waiting for auction) | 14 business days | Expected long wait — excluded from "stuck" alerting |
| Pickup (staged, capacity-constrained) | 7 business days | Expected wait — excluded from "stuck" alerting |

Additional named bottlenecks with hard-coded operational thresholds:
- **Lotting queue capacity**: ~4 racks/day throughput assumed; `LOTTING_QUEUE_WARN = 10` racks
  triggers a dashboard/lotting-page warning that the queue exceeds daily capacity.
- **Pickup cycle capacity**: 16 racks per auction cycle (`PICKUP_OVERLOADED`), warning at 13
  (`PICKUP_WARN`) — flags when the PU zone is approaching/at capacity for the current auction.
- **Stage pressure** (`getStagePressure`): flags any active stage whose rack count is more than
  2.5x the average across stages, or over 5 racks outright — an early warning of an emerging
  bottleneck before it breaches the hard time threshold.
- **Auction-date urgency**: any delivery with an auction date within 3 business days that still
  has racks not yet `ready`/`pickup`/`completed` surfaces as a dashboard alert — catching goods
  that won't make their auction slot.
- **Intake forecast**: if ≥8 racks are already in lotting and ≥2 more deliveries are scheduled in
  the next 7 days, the dashboard proactively warns that lotting load is about to compound —
  catching a bottleneck before it happens, not after.

These numbers (5 days sorting, 16h lotting, 16-rack pickup cycle, etc.) read as tuned from real
operational experience — i.e., this is what actually used to go wrong before the system existed:
racks getting lost in sorting for days, lotting queues backing up, and pickup staging areas
overflowing past what a single auction cycle could clear.

---

## 4. What each section of the app does

| Section | Route(s) | Purpose |
|---|---|---|
| **Dashboard** | `/` | Admin-only live overview: KPIs (active deliveries, in pipeline, in lotting, ready for pickup), stage efficiency score, warehouse floor zone map, pipeline distribution bar, stage velocity (avg time vs. threshold per stage), and a unified operational-alerts feed (needs-attention, held, auction-urgent, lotting/pickup overload, weekly forecast). Also hosts the auction-color-to-date mapping panel. |
| **Deliveries** | `/deliveries`, `/deliveries/[id]` | List and detail view of every delivery: status timeline, linked racks and their progress %, notes, photos, donation/trash outcome %, zone assignment. |
| **Front Desk** | `/front-desk` | The intake role's home screen: one-tap walk-in or scheduled-delivery creation, consigner lookup/autocomplete, today's and upcoming delivery lists. |
| **Racks** | `/racks`, `/racks/[id]`, `/racks/needs-attention` | The core tracking list — every rack, filterable by stage/needs-attention/held/auction color, role-scoped to what that worker's job touches (e.g. a sorter only sees `unpacking_sorting`/`ready`). Rack detail holds hold/priority controls, notes, and history. |
| **Unpack (Create Rack)** | `/unpack` | The intake workflow for physically creating a rack: pick a delivery (or "no consigner" / add a new consigner inline), set auction color and starting status, generate/override the rack code, and auto-queue its label for printing. |
| **Zones** | `/zones`, `/zones/[id]` | A literal map of the warehouse floor (Gallery + Warehouse bay grid, drawn to the actual physical layout with hallways). Each zone cell shows what's occupying it (delivery in progress, scheduled delivery, auction staging, reserved, or empty) color-coded by state. Zone detail lets staff assign a "purpose" to a zone (active delivery / scheduled delivery / auction staging / reserved) and, for PU specifically, a full drag-and-drop floor-plan layout tool for placing individual racks into numbered slots. |
| **Consigners** | `/consigners`, `/consigners/[slug]` | Auto-derived consigner directory (computed from delivery/rack history, not a manually maintained table) with activity stats, average turnaround time, and quality tags (e.g. frequently held, slow to process). Supports standalone consigner creation for record-keeping before any delivery exists. |
| **Lotting** | `/lotting` | The lotter's working queue: racks waiting to be lotted (`sorted`) and racks currently being lotted, sorted by priority then wait time, with one-tap "start lotting" / "mark ready" actions and queue-overload alerts. |
| **Pickup** | `/pickup` | Redirects straight into the PU zone detail page (the drag-and-drop pickup floor plan) — pickup workers don't need a separate landing page, they need the floor plan. |
| **Dumpsters** | `/dumpsters` | Visual fill-level gauges for the two physical dumpsters (Gallery, Warehouse). Staff drag/enter a percent to log trash added (tied to a delivery, feeding that delivery's trash % for billing, or "operational use"), or record a full swap. Full activity log underneath. |
| **Scan** | `/scan` | Mobile camera-based QR scanner. Scanning a rack's label QR code (which encodes `/racks/{id}`) jumps straight to that rack's detail page — the fast lookup path for a worker standing in the warehouse. |
| **Labels / Print Queue** | `/labels/queue`, `/racks/[id]/label` | Batch-printable rack labels (QR code + rack code + consigner + auction color) queued up during rack creation, printable individually or all at once with print-specific CSS (page breaks per label). |
| **Reports** | `/reports` (admin only) | CSV exports: all deliveries (with progress/outcome %), all racks (status/priority/zone/stuck flag), per-rack stage-duration breakdown, and dumpster activity log for billing. Also hosts the full-database JSON backup/restore tool and a link to the PDF user guide. |
| **Search** | `/search` | Global fuzzy search across racks, deliveries, and zones by code/name/J-Number, ranked by match quality then severity (critical/needs-attention racks surface first). |
| **Admin / Users** | `/admin/users` | Admin-only user management: invite users, assign/revoke roles, set a default role — backed by the Supabase service-role key via API routes. |

---

## 5. Automation / "smart" logic built in, and what it replaced

FlowOps has no external AI/LLM integration — its "intelligence" is entirely rule-based
domain logic baked into `lib/` and a couple of Postgres functions. Still, it replaces real manual
work:

- **Business-hours-aware duration tracking** (`lib/businessTime.ts`) — every "how long has this
  been sitting" calculation excludes nights, weekends, and time outside 9–6, so the system never
  falsely flags a rack as stuck just because it sat over a weekend. Replaces a human having to
  mentally subtract non-working time when eyeballing "how old is this."

- **Automatic stuck/needs-attention detection** (`isRackNeedsAttention`, per-stage thresholds) —
  replaces someone manually walking the floor / checking a whiteboard to notice a rack has been
  sitting too long in a given stage.

- **Stage pressure & velocity analytics** (`getStagePressure`, `getStageVelocity`,
  `getBottleneckSummary`) — statistically flags which pipeline stage is overloaded relative to
  the others (>2.5x the mean stage headcount, or >5 racks) and shows average dwell time vs.
  threshold per stage. Replaces a manager manually tallying rack counts per stage to spot where
  the line is backing up.

- **Automatic status transition side effects** (`store/racks.ts` `advanceStatus`) —
  - Moving a rack to `pickup` **auto-assigns it to the PU zone** — no manual zone-move step.
  - Moving the last outstanding rack of a delivery to `ready` (or further) **auto-completes the
    delivery** — no one has to remember to close it out.
  - Completing a rack (`pickup → completed`) **deletes the rack row** while preserving its full
    audit trail in `rack_events`, keeping active-view lists clean without losing history.
  These replace a person having to manually watch every rack in a delivery and manually flip the
  delivery's status once the last one clears.

- **Atomic status-advance + history logging** (`advance_rack_status` Postgres function) — status
  change and its audit-trail event insert happen as one atomic DB transaction (with a row lock),
  so the stage-duration math can never see a rack whose status changed but whose history didn't
  (or vice versa) — a correctness guarantee that would be hard to enforce by hand/spreadsheet.

- **Auto-generated sequential codes** (`DEL-0001`, `RC-0001`, via Postgres sequences) — replaces
  manually assigning/writing IDs on tags, with automatic collision-safe uniqueness (`23505`
  unique-violation is specifically caught and surfaced as "Rack ID already exists" so the UI can
  offer to resolve/delete the conflicting rack right there in the unpack flow).

- **Historical rack-count estimation for a new delivery** (`estimateRackCount` in
  `lib/consigners.ts`) — averages a given consigner's past delivery-to-rack-count ratio to predict
  how many racks a new delivery from that consigner will likely need, from their name alone.
  Replaces guessing capacity needs from memory of "how much stuff does this consigner usually
  bring."

- **Auto-derived consigner directory & quality tags** (`buildConsignerProfiles`) — there's no
  manually maintained consigner table; the whole directory (activity counts, average processing
  time, "frequently held" / "slow to process" tags) is computed live from delivery/rack/history
  data every time the page loads. Replaces a manually kept consigner spreadsheet that would
  inevitably drift out of date.

- **Intake forecasting** (`buildIntakeForecast`) — proactively warns when upcoming scheduled
  deliveries are likely to compound an already-loaded lotting queue, before it actually happens.
  Replaces a manager needing to cross-reference the delivery calendar against current floor load
  by hand.

- **QR-code scan-to-navigate** (`/scan`) — decodes a rack's label QR and jumps directly to that
  rack's record. Replaces manually typing/searching a rack code while standing at a shelf.

- **One-time auto-color-assignment migration logic** (`store/racks.ts` `hydrate`) — on load, any
  rack sitting in `lotting` with no auction color gets automatically backfilled with a default
  blue, a defensive cleanup step that runs transparently rather than requiring a manual data-fix
  pass.

- **Full-database JSON backup/restore** (`lib/backup.ts`) — one-click export of every operational
  table to a single downloadable JSON snapshot, and upsert-based restore (by primary key, never
  deletes) that also resyncs the DB sequence counters afterward so newly created codes don't
  collide with restored ones. Replaces manual/ad-hoc database dumps and the risk of a bad restore
  colliding with the live ID sequence.
