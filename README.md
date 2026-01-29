ENGINE V3 — EXECUTION ARCHITECTURE (LOCKED)

> AUTHORITATIVE SOURCE OF TRUTH This file defines execution architecture ONLY. UI behavior and rendering MUST live in README_UI.md. If something is not written here, IT DOES NOT EXIST.



> IMPORTANT ASSUMPTION (LOCKED) Engine V3 is BLOCK-DRIVEN using RPC POLLING (ANKR). This engine does NOT assume websocket event streaming. All logic is aligned to block-by-block deterministic processing.




---

High-Level Execution Flow (Authoritative)

BOOTSTRAP (Pre-Engine)
  ↓
ENGINE RUNTIME (Orchestrator)
  ↓
RAW ON-CHAIN CAPTURE (ANKR Polling)
  ↓
DATA NORMALIZATION (Canonicalizer)
  ↓
L0 – L6 (TRUE ENGINE)
  ↓
L7 (OBSERVABILITY SNAPSHOT)

This reflects real blockchain physics + engine contract boundaries.


---

1. PROJECT BOOTSTRAP (Pre-Engine)

NOT part of the engine.

Role: Infrastructure and environment setup only.

Files:

package.json

tsconfig.json

.env


Responsibilities:

Dependency management

Build & runtime configuration

Secrets and API keys


Environment Variables (.env)

ANKR_RPC_URL=
ANKR_API_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

Rules:

Not part of engine layers

Not part of engine threads

Must be completed before engine runs

Contains NO engine logic



---

2. ENGINE RUNTIME (Orchestrator — Non-Layer)

NOT a structural layer.

Files:

index.js


Role: Pipeline runner and block-driven scheduler.

Responsibilities:

Maintain block cursor

Poll latest blocks

Trigger raw capture

Route data through normalization

Route normalized data to L0 → L6

Trigger L7 snapshot on 15m cadence

Handle retries and lifecycle


Rules:

Contains NO structural logic

Does NOT compute anchors, ranges, or modes

Does NOT make structural decisions

Plumbing only



---

3. RAW ON-CHAIN CAPTURE (INFRA — Not Engine)

Files:

ankr_polling.js


Role: Block-driven raw on-chain data collector.

Responsibilities (Per Block):

Poll block N

Fetch logs for block N

Fetch receipts if needed

Fetch pool state (slot0, liquidity)

Batch raw events per block

Handle provider quirks, retries, pagination


Output (RAW):

raw_swap_log

raw_mint_log

raw_burn_log

raw_collect_log

raw_block

raw_state


Rules:

NOT L0

NOT engine

No ABI semantic interpretation

No physics

No structural logic



---

4. DATA NORMALIZATION (Canonicalizer — Non-Layer)

NOT a structural layer.

Files:

normalize_raw.js


Role: Transform raw provider data into canonical engine contract format.

Responsibilities:

Decode ABI

Standardize field names

Convert units

Normalize timestamps

Normalize ordering

Remove provider quirks


Output (Canonical Events):

canonical_swap

canonical_mint

canonical_burn

canonical_collect

canonical_tick_cross (optional)


Rules:

Contains NO structural logic

Does NOT compute physics

Does NOT compute lifecycle

Does NOT interpret LP intent



---

5. TRUE ENGINE (L0 – L6)

These layers contain ALL structural logic. This is the ONLY place where engine intelligence exists.


---

L0 — Engine Raw Ingest (ENGINE ENTRY)

Role: Engine-side intake valve for canonical block data.

Input: Canonical block batch from normalize_raw.js.

Responsibilities:

Block gating & determinism

Duplicate protection

Pool scoping

Minimal struct packing

Merge MINT/BURN into signed LP deltas

Route per-pool frames to L1


Rules:

No RPC

No ABI decoding

No normalization

No physics

No structure



---

L1 — Pair Physics

Role: Measure raw physical deltas.

Examples:

Price velocity

Block velocity

Net swap direction

Active liquidity velocity


Rules:

No candles

No smoothing

No thresholds

No reserve logic


L1 — Pair Physics (Schema — LOCKED)

> L1 is a pure physics sensor layer. No structure. No lifecycle. No interpretation. Block = unit time (polling mode).



Input (from L0)

L1InputFrame = {
  blockNumber: number,
  blockTimestamp: number,
  pool: { address: string, tick: number, sqrtPriceX96: bigint, liquidity: bigint },
  swaps: L0Swap[],
  lpAdds: L0LPDelta[],
  lpRemoves: L0LPDelta[],
  collects: L0Collect[],
  tickCrosses: L0TickCross[]
}

Internal Minimal State (Physics Only)

L1PrevState = { prevTick: number, prevSqrtPriceX96: bigint, prevLiquidity: bigint, prevBlockNumber: number }

Output (L1PhysicsFrame)

L1PhysicsFrame = {
  blockNumber: number,
  poolAddress: string,
  priceDelta: { tickDelta: number, sqrtPriceDelta: bigint, direction: "UP" | "DOWN" | "FLAT" },
  liquidityDelta: { activeLiquidityDelta: bigint, activeLiquidityVelocity: number },
  swapFlow: { netAmount0: bigint, netAmount1: bigint, dominantSide: "TOKEN0" | "TOKEN1" | "NEUTRAL" },
  lpFlow: { netLPDelta: bigint, lpAddVolume: bigint, lpRemoveVolume: bigint },
  tickMotion: { crossedUp: number, crossedDown: number }
}

Hard Rules:

NO candles

NO smoothing

NO thresholds

NO TA

NO structure

NO lifecycle


Physics Definitions:

tickDelta = currentTick - prevTick

activeLiquidityDelta = currentLiquidity - prevLiquidity

activeLiquidityVelocity = activeLiquidityDelta per block

netAmount0 = sum(swaps.amount0)

netAmount1 = sum(swaps.amount1)

lpAddVolume = sum(+liquidityDelta)

lpRemoveVolume = sum(-liquidityDelta)

netLPDelta = lpAddVolume - lpRemoveVolume

crossedUp / crossedDown from tickCross events



---

L1.5 — LP Snapshot

Role: Spatial snapshot of LP liquidity around price.

Includes:

Current tick

Active liquidity

Near / Mid / Far liquidity bands (tick-space)


Rules:

Bands computed in tick-space

% only defines spatial window

No reserve depth

No orderbook depth


L1.5 — LP Snapshot (Schema — LOCKED)

> Pure spatial geometry. No physics. No lifecycle. No interpretation.



Input

L15Input = { blockNumber: number, poolAddress: string, currentTick: number, activeLiquidity: bigint, lpDeltas: L0LPDelta[] }

Internal Spatial Model

TickLiquidityMap = Map<tickIndex, liquidityNet>

Spatial Bands (Tick-Space Windows)

SpatialBands = { near: { lowerTick: number, upperTick: number }, mid: { lowerTick: number, upperTick: number }, far: { lowerTick: number, upperTick: number } }

Output (L15SnapshotFrame)

L15SnapshotFrame = {
  blockNumber: number,
  poolAddress: string,
  currentTick: number,
  activeLiquidity: bigint,
  bands: {
    near: { liquidity: bigint, netLiquidity: bigint },
    mid:  { liquidity: bigint, netLiquidity: bigint },
    far:  { liquidity: bigint, netLiquidity: bigint }
  }
}

Definitions:

liquidity = sum of absolute liquidity in band

netLiquidity = sum of signed liquidityNet in band


Hard Rules:

Tick-space only (NO price conversion)

NO orderbook depth

NO reserve depth

NO structure labels

NO ratios

NO thresholds

NO lifecycle



---

L2 — Structural Context

Role: Interpret LP structure.

Includes:

Vacuum vs Wall

Ahead vs Behind

Absorption vs Retreat

Support rebuild


Rules:

No ratios

No thresholds

No numeric scoring

Structural dominance only



---

L3 — Anchor Lifecycle

Role: Track LP anchor presence over time.

States:

ANCHOR_NEW

ANCHOR_ACTIVE

ANCHOR_FADING

ANCHOR_DEAD


Driven by:

LP positioning

Absorption vs Retreat

Support rebuild

Active liquidity behavior


Rules:

No counters

No time thresholds

No price pattern logic



---

L4 — Range Lifecycle

Role: Track defended LP range structure.

States:

RANGE_ACTIVE

RANGE_STRESSED

RANGE_ABANDONED

RANGE_DEAD


Driven by:

LP defense structure

Liquidity pullback

Vacuum vs Wall shifts

Absorption vs Retreat


Rules:

No breakout candles

No volatility thresholds

Structural only



---

L5 — Global Structural State

Role: Classify combined Anchor + Range state.

Input:

Anchor lifecycle (L3)

Range lifecycle (L4)


Output:

Global structural classification


Characteristics:

Pure mapping layer

No physics

No thresholds

No time logic



---

L6 — Engine Mode Controller

Role: Describe engine workflow posture.

Input:

Global structural state (L5)


Output:

engine_mode


Characteristics:

Descriptive only

Not a trading signal

Not predictive


Rules:

No price logic

No counters

No thresholds



---

6. L7 — Observability Snapshot (Not Engine Logic)

NOT part of engine intelligence.

Role: Official structural snapshot for observability and external systems.

Trigger: Every 15 minutes (cadence only)

Output Includes:

Anchor lifecycle state

Range lifecycle state

Global structural state

Engine mode

Structural context summary


Rules:

L7 is NOT used as engine input

L7 does NOT affect engine logic

L7 does NOT maintain state

No confirmation

No smoothing

No counters


> L7 is a freeze-frame of truth, not a source of truth.




---

FINAL LOCK

Engine V3 is BLOCK-DRIVEN (Polling)

Engine starts at L0

Raw + Normalize are INFRA

L1–L6 contain ALL intelligence

L7 is OBSERVABILITY ONLY


Any deviation from this file is considered ARCHITECTURAL VIOLATION.
