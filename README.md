# ENGINE V3 — MASTER README (LOCKED)

STATUS: LOCKED
This file is the single source of truth.
All coding must follow this document.

If something is not written here, IT DOES NOT EXIST.

---

## 0. Core Philosophy

- No thresholds
- No scores
- No confidence metrics
- No indicators

Truth = Time + Structure  
Engine observes LP behavior, not predicts price.

---

## 1. Structural Ontology

### Anchor Lifecycle
- ANCHOR_NEW
- ANCHOR_ACTIVE
- ANCHOR_FADING
- ANCHOR_DEAD

Anchor = where LP lives and accepts price.

### Range Lifecycle
- RANGE_ACTIVE
- RANGE_STRESSED
- RANGE_ABANDONED
- RANGE_DEAD

Range = where LP defends.

---

## 2. Global Structural State

Anchor + Range → Global Structure

Examples:
- ACTIVE + ACTIVE → STRUCTURE_SETTLED
- NEW + ACTIVE → STRUCTURE_FORMING
- FADING + STRESSED → TRANSITION
- DEAD + DEAD → STRUCTURE_BROKEN

---

## 3. Engine Mode

- NOISE
- STRUCTURE_FORMING
- SCALP_ACTIVE
- STRUCTURE_SETTLED
- SWING_CANDIDATE
- SWING_ACTIVE
- STRUCTURE_BROKEN

Default = SCALP_ACTIVE  
Swing is escalation only.

---

## 4. Global Structural Workflow

L0 — Raw Ingest
- Swaps
- Mint/Burn
- Sync/Reserves
- Current Tick/Price

L1 — Pair Physics
- Price velocity
- Block velocity
- Net swap direction
- Liquidity velocity

L1.5 — LP Snapshot
- Current tick
- Active liquidity
- Bucketed liquidity bands:
  - Near ±0.5%
  - Mid ±2%
  - Far ±10%

L2 — Structural Context
- Ahead vs Behind
- Vacuum vs Wall
- Absorption vs Retreat
- Support rebuild behavior

L3 — Anchor Lifecycle Update
L4 — Range Lifecycle Update
L5 — Global Structural State
L6 — Engine Mode Controller
L7 — 15m Structural Checkpoint (ONLY OFFICIAL OUTPUT)

---

## 5. UI Role (Read-Only)

UI is NOT trading UI.
UI is NOT signal UI.

UI shows:
- LP Snapshot Heatmap
- Anchor Lifecycle
- Range Lifecycle
- Engine Mode
- Structural Timeline
- Structural Reasons

No candles.
No indicators.
No buy/sell.

---

## 6. Thread Separation

THREAD 0 — Bootstrap
- package.json
- tsconfig.json

THREAD A — Mock + UI
- Mock server
- UI rendering
- No engine logic

THREAD B — Snapshot Engine
- LP snapshot
- Band bucketization
- Snapshot cache

THREAD C — Lifecycle Engine
- Anchor lifecycle
- Range lifecycle
- Structure graph

THREAD D — Workflow + Checkpoint
- Engine controller
- 15m checkpoint
- Alert emitter

THREAD E — Replay & Audit (optional)

---

## 7. Anti-Chaos Rules (HARD)

DO NOT:
- Add indicators
- Add thresholds
- Add scores
- Add new panels
- Add new logic outside thread scope

All bugs must be debugged by checking which layer is wrong.

---

END OF ENGINE V3 MASTER README
