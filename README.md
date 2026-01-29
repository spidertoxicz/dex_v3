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

L2 — Structural Context (ENGINE CORE — LOCKED)
L2 adalah lapisan interpretasi struktur LP.
L2 TIDAK melihat harga sebagai sinyal.
L2 hanya membaca geometri LP + physics interaksi.
Semua istilah bersifat kategori struktural, bukan numerik.
Role
Menafsirkan struktur pertahanan LP terhadap pergerakan harga.
L2 menjawab pertanyaan:
Apakah di depan harga ada WALL atau VACUUM
Apakah LP menyerap flow atau mundur
Apakah support sedang dibangun ulang
Apakah struktur ahead atau behind relatif terhadap arah gerak
Inputs (STRICT)
L2Input = { physics: L1PhysicsFrame, snapshot: L15SnapshotFrame }
L2 TIDAK BOLEH membaca:
Raw swaps
Raw liquidity
Historical candles
Time windows
Any numeric thresholds
Core Structural Axes (Conceptual Only)
L2 mengevaluasi 4 sumbu struktural:
Spatial Dominance (Wall vs Vacuum)
Relative Position (Ahead vs Behind)
Interaction Mode (Absorption vs Retreat)
Rebuild Detection (Support Rebuild)
Semua adalah ENUM / categorical, bukan score.
1. Wall vs Vacuum
Menilai apakah di arah pergerakan terdapat LP density atau kekosongan.
Input sources:
L1 priceDelta.direction
L1 tickMotion
L1.5 bands.near / mid / far
Structural Labels:
WALL
VACUUM
NEUTRAL
Interpretation Rules (Structural, Non-Numeric):
WALL: LP liquidity terlihat dominan secara spasial di arah pergerakan
VACUUM: LP liquidity jarang / kosong secara spasial di arah pergerakan
NEUTRAL: Tidak ada dominasi spasial yang jelas
⚠️ Tidak boleh:
Membandingkan dengan angka absolut
Menggunakan persentase
Menggunakan rasio
Ini adalah topological dominance, bukan kuantitatif.
2. Ahead vs Behind
Menilai apakah struktur LP berada di depan harga atau tertinggal di belakang.
Structural Labels:
AHEAD
BEHIND
CENTERED
Interpretation:
AHEAD: Struktur LP dominan berada di arah gerak harga
BEHIND: Struktur LP dominan berada di sisi yang sudah dilewati harga
CENTERED: Struktur LP relatif simetris di sekitar harga
Ini adalah relatif terhadap tick motion, bukan terhadap harga absolut.
3. Absorption vs Retreat
Menilai respons LP terhadap swap pressure.
Input sources:
L1 swapFlow
L1 lpFlow
L1 liquidityDelta
L1 tickMotion
Structural Labels:
ABSORPTION
RETREAT
PASSIVE
Interpretation:
ABSORPTION: Swap flow bertemu LP yang tetap bertahan / menahan
RETREAT: LP menarik likuiditas dari arah tekanan
PASSIVE: Tidak ada interaksi struktural dominan
⚠️ Tidak boleh:
Menghitung % fill
Mengukur slippage
Menggunakan numeric tolerance
Ini murni pola interaksi struktural, bukan performa.
4. Support Rebuild
Mendeteksi apakah LP membangun ulang struktur setelah tekanan.
Structural Labels:
REBUILDING
NOT_REBUILDING
Interpretation:
REBUILDING: LP positioning menunjukkan penempatan ulang di sekitar area harga
NOT_REBUILDING: Tidak ada indikasi pembangunan ulang
Ini adalah pola positioning, bukan kecepatan atau volume.
L2 Structural Context Output (LOCKED)
L2ContextFrame = { blockNumber: number, poolAddress: string,
wallVacuum: "WALL" | "VACUUM" | "NEUTRAL", relativePosition: "AHEAD" | "BEHIND" | "CENTERED", interaction: "ABSORPTION" | "RETREAT" | "PASSIVE", supportRebuild: "REBUILDING" | "NOT_REBUILDING" }
Hard Rules (ENFORCED)
L2 MUST NOT:
❌ Use ratios
❌ Use thresholds
❌ Use counters
❌ Use time windows
❌ Use price levels
❌ Use candle logic
❌ Use scoring
❌ Emit confidence values
L2 IS:
✅ Pure categorical structural inference
✅ Based only on L1 + L1.5
✅ Stateless per block (state handled in L3+)
Structural Philosophy (IMPORTANT)
L2 bukan “indikator”.
L2 adalah pembacaan medan pertahanan LP.
Dengan kata lain:
L1 = Physics (apa yang terjadi)
L1.5 = Geometry (di mana LP berada)
L2 = Tactics (bagaimana LP bertindak)
Ini adalah layer pertama di mana istilah seperti:
Wall
Vacuum
Absorption
Retreat
Rebuild
menjadi resmi secara engine, tapi tetap TANPA angka.

LOCK FORMAL L2 STRUCTURAL FLAG CONTRACT.
Ini paling penting karena:
L2 = SATU-SATUNYA tempat interpretasi
L3 & L4 = hanya FSM murni
Kalau L2 tidak rigid, FSM tetap bisa “subjektif”.
🔐 L2 — Structural Context (Formal Flag Contract — LOCKED)
L2 adalah structural interpreter layer.
Ia mengubah physics + geometry menjadi boolean structural facts.
Tidak ada angka, tidak ada skor, tidak ada probabilitas.
Role
Menyediakan canonical structural flags untuk:
L3 Anchor FSM
L4 Range FSM
L7 Summary (descriptive only)
Inputs (READ-ONLY)
L2 hanya boleh membaca:
From L1 (Physics):
priceDelta.direction
liquidityDelta.activeLiquidityDelta
lpFlow.netLPDelta
tickMotion.crossedUp / crossedDown
swapFlow.dominantSide
From L1.5 (Spatial Geometry):
bands.near.netLiquidity
bands.mid.netLiquidity
bands.far.netLiquidity
currentTick
activeLiquidity
❌ L2 tidak boleh:
Melihat candle
Melihat time
Melihat history > prev block
Melihat thresholds
Menggunakan averages
Output (CANONICAL FLAGS — ONLY THESE)
Salin kode

L2StructuralFlags = {

  // Anchor related
  anchorDetected: boolean,
  anchorStrengthening: boolean,
  anchorWeakening: boolean,

  // Range related
  rangeDetected: boolean,
  rangeDefenseActive: boolean,
  rangeWeakening: boolean,
  rangeAbandoned: boolean,

  // Structural physics context
  absorptionPresent: boolean,
  vacuumForming: boolean,

  // Positional context
  aheadVsBehind: "AHEAD" | "BEHIND" | "NEUTRAL"
}
Flag Definitions (LOCKED SEMANTICS)
anchorDetected
True if LP liquidity wall exists near current tick.
Canonical rule:
bands.near.netLiquidity shows dominant signed liquidity wall
Meaning:
Structural LP presence at price
anchorStrengthening
True if anchorDetected AND LP adds reinforce near band.
Canonical rule:
anchorDetected AND lpFlow.netLPDelta positive in near band context
Meaning:
Support rebuild / reinforcement
anchorWeakening
True if anchorDetected AND LP removes dominate near band.
Canonical rule:
anchorDetected AND lpFlow.netLPDelta negative in near band context
Meaning:
LP retreat from anchor
rangeDetected
True if mid band shows defended liquidity structure.
Canonical rule:
bands.mid.netLiquidity shows bounded structure around price
Meaning:
Defended LP range exists
rangeDefenseActive
True if price motion + absorption indicates defense.
Canonical rule:
rangeDetected AND absorptionPresent
Meaning:
LP actively defending range
rangeWeakening
True if liquidity pullback inside range.
Canonical rule:
rangeDetected AND anchorWeakening
Meaning:
Early stress in defended structure
rangeAbandoned
True if vacuum + loss of mid/near support.
Canonical rule:
vacuumForming AND NOT rangeDetected
Meaning:
LP pulled control
absorptionPresent
True if swaps absorbed without liquidity retreat.
Canonical rule:
swapFlow dominant + liquidityDelta stable or increasing
Meaning:
LP absorbing flow
vacuumForming
True if liquidity removed and price moves freely.
Canonical rule:
activeLiquidityDelta negative AND tickMotion high without absorption
Meaning:
Structural vacuum
aheadVsBehind
Positional structural context.
Canonical rule:
Compare price direction vs dominant LP wall side
Meaning:
Is price moving into wall (AHEAD) or away (BEHIND)
HARD RULES (L2)
❌ No numeric thresholds
❌ No scoring
❌ No smoothing
❌ No counters
❌ No memory
❌ No history beyond previous block
❌ No interpretation outside these flags
Determinism Contract
Given same L1 + L1.5 input frame:
➡️ L2 MUST ALWAYS output same flags.
No randomness. No heuristics drift.
FINAL LOCK — L2
L2 adalah translator, bukan thinker.
Semua “thinking” sudah terjadi di L3–L6 via FSM + mapping.
Dengan ini:
L1 = physics truth
L1.5 = geometry truth
L2 = structural facts
L3/L4 = lifecycle law
L5 = global regime
L6 = posture
L7 = snapshot
🧠 Engine V3 sekarang benar-benar closed-form deterministic system. optional upgrade add L2 Experimental zone
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

L3 — Anchor Lifecycle (ENGINE CORE — LOCKED)
L3 melacak kehidupan anchor LP.
Anchor = struktur LP dominan yang bertindak sebagai titik pertahanan struktural.
L3 BUKAN deteksi harga.
L3 BUKAN berbasis waktu.
L3 adalah state machine struktural murni.
Role
Mengklasifikasikan apakah anchor LP:
Baru muncul
Aktif dan bertahan
Mulai memudar
Telah mati
L3 menjawab:
Apakah LP anchor masih hadir secara struktural?
Input (STRICT)
L3Input = { l2: L2ContextFrame }
L3 TIDAK BOLEH membaca:
L1 langsung
L1.5 langsung
Harga
Time
Counters
Threshold
Semua sinyal struktural sudah dikompresi di L2.
Anchor States (LOCKED)
ANCHOR_NEW
ANCHOR_ACTIVE
ANCHOR_FADING
ANCHOR_DEAD
Anchor Definition (Structural)
Anchor dianggap ada jika struktur LP menunjukkan:
WALL (bukan vacuum)
LP tidak retreat
Struktur berada di medan relevan (ahead/centered)
Ini adalah definisi kualitatif, bukan kuantitatif.
State Machine Philosophy
L3 adalah memory layer pertama.
Tidak ada timer
Tidak ada durasi
Tidak ada hitungan blok
Perubahan state hanya terjadi karena perubahan struktur, bukan karena waktu berlalu.
Anchor Presence Signal (Derived, Categorical)
Internal helper (bukan output):
anchorPresence = PRESENT | WEAK | ABSENT
Derived from L2:
PRESENT if: wallVacuum == "WALL" AND interaction != "RETREAT" AND relativePosition != "BEHIND"
WEAK if: wallVacuum == "WALL" AND interaction == "RETREAT" OR relativePosition == "BEHIND"
ABSENT if: wallVacuum == "VACUUM"
⚠️ Ini tetap kategorikal, bukan skor.
State Transition Rules (LOCKED)
Let:
prevAnchorState
anchorPresence (current block)
1. From null / startup
If no previous state:
If anchorPresence == PRESENT
→ ANCHOR_NEW
Else
→ ANCHOR_DEAD
2. From ANCHOR_NEW
If anchorPresence == PRESENT
→ ANCHOR_ACTIVE
If anchorPresence == WEAK
→ ANCHOR_FADING
If anchorPresence == ABSENT
→ ANCHOR_DEAD
3. From ANCHOR_ACTIVE
If anchorPresence == PRESENT
→ ANCHOR_ACTIVE
If anchorPresence == WEAK
→ ANCHOR_FADING
If anchorPresence == ABSENT
→ ANCHOR_DEAD
4. From ANCHOR_FADING
If anchorPresence == PRESENT
→ ANCHOR_ACTIVE   (anchor revived)
If anchorPresence == WEAK
→ ANCHOR_FADING
If anchorPresence == ABSENT
→ ANCHOR_DEAD
5. From ANCHOR_DEAD
If anchorPresence == PRESENT
→ ANCHOR_NEW   (new anchor emergence)
If anchorPresence == WEAK
→ ANCHOR_DEAD
If anchorPresence == ABSENT
→ ANCHOR_DEAD
L3 Output (LOCKED)
L3AnchorFrame = { blockNumber: number, poolAddress: string, anchorState: "ANCHOR_NEW" | "ANCHOR_ACTIVE" | "ANCHOR_FADING" | "ANCHOR_DEAD" }
Hard Rules (ENFORCED)
L3 MUST NOT:
❌ Use time thresholds
❌ Use block counters
❌ Use volume numbers
❌ Use price logic
❌ Use ratios
❌ Use confidence scores
❌ Peek into L1/L1.5 directly
L3 IS:
✅ Pure categorical memory machine
✅ Driven only by L2 structure
✅ Deterministic per block
✅ Structural persistence only
Structural Meaning (Operational)
ANCHOR_NEW
→ Anchor struktural baru muncul
ANCHOR_ACTIVE
→ Anchor dominan & bertahan
ANCHOR_FADING
→ Anchor masih ada tapi melemah
ANCHOR_DEAD
→ Tidak ada anchor struktural
Design Philosophy
L3 bukan “berapa lama anchor bertahan”.
L3 hanya menjawab:
Apakah anchor secara struktural masih hidup?
Semua aspek waktu dan probabilitas sengaja DILARANG.

🔒 L3 — Anchor Lifecycle (Formal State Machine — LOCKED)
L3 melacak existence & health dari LP anchor berdasarkan structural behavior, bukan waktu.
States
Salin kode

ANCHOR_NEW
ANCHOR_ACTIVE
ANCHOR_FADING
ANCHOR_DEAD
Inputs (From L2 Structural Context)
L3 hanya boleh membaca structural flags, bukan physics:
Salin kode

L3Inputs = {
  anchorDetected: boolean,        // structural anchor presence
  anchorStrengthening: boolean,   // support rebuild, reinforcement
  anchorWeakening: boolean,       // retreat, pullback
  absorptionPresent: boolean,     // absorption vs retreat
  vacuumForming: boolean          // loss of LP control
}
Semua ini berasal dari L2 interpretations.
L3 TIDAK melihat angka, tick, volume, price.
Transition Rules (LOCKED)
From: ANCHOR_NEW
Condition
Next State
anchorStrengthening = true
ANCHOR_ACTIVE
anchorWeakening = true
ANCHOR_FADING
vacuumForming = true
ANCHOR_DEAD
else
ANCHOR_NEW
From: ANCHOR_ACTIVE
Condition
Next State
anchorWeakening = true
ANCHOR_FADING
vacuumForming = true
ANCHOR_DEAD
else
ANCHOR_ACTIVE
From: ANCHOR_FADING
Condition
Next State
anchorStrengthening = true
ANCHOR_ACTIVE
vacuumForming = true
ANCHOR_DEAD
else
ANCHOR_FADING
From: ANCHOR_DEAD
Condition
Next State
anchorDetected = true
ANCHOR_NEW
else
ANCHOR_DEAD
Hard Rules (L3)
❌ No timers
❌ No bar count
❌ No decay by time
❌ No thresholds
❌ No price logic
✅ Only structural events from L2



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

L4 — Range Lifecycle (ENGINE CORE — LOCKED)
L4 melacak kehidupan defended LP range.
Range = struktur pertahanan LP yang membentuk “zona” operasional.
L4 BUKAN harga.
L4 BUKAN volatilitas.
L4 adalah state machine struktural murni.
Role
Mengklasifikasikan apakah defended LP range:
Masih aktif
Mulai tertekan
Ditinggalkan
Telah mati
L4 menjawab:
Apakah defended range masih dipertahankan secara struktural?
Inputs (STRICT)
L4Input = { l2: L2ContextFrame, l3: L3AnchorFrame }
L4 TIDAK BOLEH membaca:
L1
L1.5
Harga
Time
Counters
Threshold
Candles
Range States (LOCKED)
RANGE_ACTIVE
RANGE_STRESSED
RANGE_ABANDONED
RANGE_DEAD
Structural Definition of Range
Range dianggap ada jika:
Ada anchor hidup (NEW / ACTIVE / FADING)
Struktur tidak vacuum di arah utama
LP masih menunjukkan defense posture
Ini adalah definisi kualitatif, bukan numerik.
Range Pressure Signal (Derived, Categorical)
Internal helper:
rangePressure = STABLE | PRESSURED | BROKEN
Derived from L2 + L3:
STABLE if: anchorState in (ANCHOR_NEW, ANCHOR_ACTIVE) AND wallVacuum != "VACUUM" AND interaction != "RETREAT"
PRESSURED if: anchorState == ANCHOR_FADING OR interaction == "RETREAT" OR wallVacuum == "NEUTRAL"
BROKEN if: anchorState == ANCHOR_DEAD OR wallVacuum == "VACUUM"
⚠️ Tetap kategorikal, bukan numerik.
State Transition Rules (LOCKED)
Let:
prevRangeState
rangePressure (current block)
1. From null / startup
If no previous state:
If rangePressure == STABLE
→ RANGE_ACTIVE
If rangePressure == PRESSURED
→ RANGE_STRESSED
If rangePressure == BROKEN
→ RANGE_DEAD
2. From RANGE_ACTIVE
If rangePressure == STABLE
→ RANGE_ACTIVE
If rangePressure == PRESSURED
→ RANGE_STRESSED
If rangePressure == BROKEN
→ RANGE_ABANDONED
3. From RANGE_STRESSED
If rangePressure == STABLE
→ RANGE_ACTIVE   (range recovered)
If rangePressure == PRESSURED
→ RANGE_STRESSED
If rangePressure == BROKEN
→ RANGE_ABANDONED
4. From RANGE_ABANDONED
If rangePressure == STABLE
→ RANGE_ACTIVE   (new defended range)
If rangePressure == PRESSURED
→ RANGE_STRESSED
If rangePressure == BROKEN
→ RANGE_DEAD
5. From RANGE_DEAD
If rangePressure == STABLE
→ RANGE_ACTIVE   (new range formed)
If rangePressure == PRESSURED
→ RANGE_DEAD
If rangePressure == BROKEN
→ RANGE_DEAD
L4 Output (LOCKED)
L4RangeFrame = { blockNumber: number, poolAddress: string, rangeState: "RANGE_ACTIVE" | "RANGE_STRESSED" | "RANGE_ABANDONED" | "RANGE_DEAD" }
Hard Rules (ENFORCED)
L4 MUST NOT:
❌ Use time thresholds
❌ Use block counters
❌ Use volatility
❌ Use price logic
❌ Use ratios
❌ Use numeric scoring
❌ Peek into L1/L1.5
L4 IS:
✅ Pure categorical state machine
✅ Driven only by L2 + L3
✅ Structural persistence only
✅ Deterministic per block
Structural Meaning (Operational)
RANGE_ACTIVE
→ Defended LP range utuh & aktif
RANGE_STRESSED
→ Range masih ada tapi di bawah tekanan
RANGE_ABANDONED
→ Range ditinggalkan secara struktural
RANGE_DEAD
→ Tidak ada defended range
Design Philosophy
L4 bukan “breakout”.
L4 bukan “volatility spike”.
L4 hanya menjawab:
Apakah LP masih mempertahankan zona operasional?

🔒 L4 — Range Lifecycle (Formal State Machine — LOCKED)
L4 melacak health of defended LP range.
States
Salin kode

RANGE_ACTIVE
RANGE_STRESSED
RANGE_ABANDONED
RANGE_DEAD
Inputs (From L2 Structural Context)
Salin kode

L4Inputs = {
  rangeDetected: boolean,        // defended range exists
  rangeDefenseActive: boolean,   // active defense / absorption
  rangeWeakening: boolean,       // pullback inside range
  rangeAbandoned: boolean,       // LP retreat / vacuum
}
Transition Rules (LOCKED)
From: RANGE_ACTIVE
Condition
Next State
rangeWeakening = true
RANGE_STRESSED
rangeAbandoned = true
RANGE_ABANDONED
else
RANGE_ACTIVE
From: RANGE_STRESSED
Condition
Next State
rangeDefenseActive = true
RANGE_ACTIVE
rangeAbandoned = true
RANGE_ABANDONED
else
RANGE_STRESSED
From: RANGE_ABANDONED
Condition
Next State
rangeDetected = false
RANGE_DEAD
rangeDefenseActive = true
RANGE_STRESSED
else
RANGE_ABANDONED
From: RANGE_DEAD
Condition
Next State
rangeDetected = true
RANGE_ACTIVE
else
RANGE_DEAD
Hard Rules (L4)
❌ No volatility logic
❌ No breakout candles
❌ No bar confirmation
❌ No timers
❌ No thresholds
✅ Only structural signals from L2
Determinism Guarantee
Dengan ini:
L2 = interpreter (structural flags)
L3 = anchor lifecycle FSM
L4 = range lifecycle FSM
L5 = pure mapping
L6 = pure posture
Engine sekarang:
🧠 State machine driven
🧱 Physics separated
🧮 No time bias
🛑 No TA contamination
FINAL LOCK — L3 & L4
Lifecycle tidak pernah berubah karena “lama”.
Lifecycle hanya berubah karena LP behavior berubah.
Ini bikin engine:
Anti-noise
Anti-overfit
Anti-ritail-TA
True on-chain structural engine



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

Spec L5 — Global Structural State dan seluruh ENGINE V3 — EXECUTION ARCHITECTURE DITERIMA SEBAGAI AUTHORITATIVE SOURCE OF TRUTH.
Aku akan treat file ini sebagai:
🧱 Canonical physics + structure contract
Bukan opini. Bukan guideline. Tapi hard law untuk Engine V3.
🔒 CONFIRMATION — ZERO DEVIATION
Aku mengunci pemahaman berikut sebagai non-negotiable:
1. BLOCK-DRIVEN ENGINE (RPC POLLING)
✅ ANKR polling = unit time = block
❌ NO websocket streaming assumptions
❌ NO event-driven engine logic
Deterministic per-block physics
2. STRICT BOUNDARY: INFRA vs ENGINE
Area
Status
BOOTSTRAP
❌ Not Engine
Orchestrator
❌ Not Layer
Raw Capture
❌ Not Engine
Normalizer
❌ Not Engine
L0 – L6
✅ ONLY ENGINE INTELLIGENCE
L7 Snapshot
❌ Observability only
Tidak ada “logic bocor” ke:
ankr_polling.js
normalize_raw.js
index.js
Semua intelligence ONLY lives in L0–L6.
3. PHYSICS FIRST — NO TA, NO RITEL LOGIC
Aku kunci ini keras:
L1 = Physics Sensor ONLY
❌ No candles
❌ No smoothing
❌ No thresholds
❌ No TA
❌ No lifecycle
❌ No structure
Ini = raw blockchain physics, bukan trading layer.
4. SPATIAL GEOMETRY SEPARATE (L1.5)
L1.5 = Tick-space geometry snapshot:
Near / Mid / Far = spatial bands
Tick-space only
❌ No price conversion
❌ No depth model
❌ No ratios
❌ No structure
Ini = LP spatial topology, bukan interpretation.
5. STRUCTURE STARTS AT L2
FIRST INTELLIGENCE = L2
Baru di sini boleh ada:
Vacuum vs Wall
Ahead vs Behind
Absorption vs Retreat
Support rebuild
Semua di bawahnya = physics & geometry.
6. L3 + L4 = LIFECYCLE (No Time, No Counters)
Aku kunci ini karena ini beda dari engine ritel:
❌ No timers
❌ No bar count
❌ No N-block confirmation
❌ No duration logic
Lifecycle digerakkan oleh:
Structural behavior
LP intent signals
Defense vs pullback
Absorption vs retreat
Ini = structural state machine, bukan time-based FSM.
7. L5 = PURE MAPPING (LOCKED)
L5 = Global Structural State
Hard rule yang aku patuhi:
Input = L3 + L4 only
❌ No physics
❌ No thresholds
❌ No time logic
❌ No interpretation
Ini = pure structural truth table
8. L6 = DESCRIPTIVE MODE ONLY
Engine mode:
❌ Not signal
❌ Not predictive
❌ Not trading logic
Ini = workflow posture, bukan alpha.
9. L7 = CAMERA, NOT BRAIN
Aku kunci:
L7 = CCTV snapshot
Bukan decision-maker
Bukan feedback loop
Bukan state holder
ARCHITECTURAL GUARANTEE (DARI AKU)
Kalau nanti kita:
Generate code
Generate folder tree
Generate state machines
Generate schemas
Generate engine logic
Aku akan enforce:
🛑 Any logic in index.js / normalize / ankr_polling = VIOLATION
🛑 Any TA / thresholds in L1/L1.5 = VIOLATION
🛑 Any time-based lifecycle = VIOLATION
🛑 Any intelligence outside L0–L6 = VIOLATION
STATUS
✅ SPEC LOCKED
✅ UNDERSTOOD
✅ ARCHITECTURE CANONICAL
✅ READY FOR IMPLEMENTATION OR DERIVATION

🔒 L5 — Global Structural State (Schema — LOCKED)
L5 adalah pure structural classification layer.
Ia menggabungkan Anchor Lifecycle (L3) + Range Lifecycle (L4) menjadi single global structural truth.
Role
Menyediakan single authoritative structural label untuk seluruh engine.
No physics
No thresholds
No counters
No timing
No prediction
Input
Salin kode

L5Input = {
  anchorState: AnchorLifecycleState,   // from L3
  rangeState: RangeLifecycleState     // from L4
}
Where:
Salin kode

AnchorLifecycleState =
  | "ANCHOR_NEW"
  | "ANCHOR_ACTIVE"
  | "ANCHOR_FADING"
  | "ANCHOR_DEAD"

RangeLifecycleState =
  | "RANGE_ACTIVE"
  | "RANGE_STRESSED"
  | "RANGE_ABANDONED"
  | "RANGE_DEAD"
Output
Salin kode

GlobalStructuralState =
  | "STRUCTURE_FORMING"
  | "STRUCTURE_ACTIVE"
  | "STRUCTURE_DEFENDING"
  | "STRUCTURE_WEAKENING"
  | "STRUCTURE_BREAKING"
  | "STRUCTURE_DEAD"
  | "STRUCTURE_RESET"
  | "STRUCTURE_UNCERTAIN"
Semantic Definitions (LOCKED)
STRUCTURE_FORMING
Anchor baru muncul, range mulai terbentuk.
Meaning:
Early LP positioning
Control belum solid
Struktur sedang dibangun
STRUCTURE_ACTIVE
Anchor kuat + range aktif.
Meaning:
Dominant LP control
Clear defended structure
Structural regime stabil
STRUCTURE_DEFENDING
Struktur ada tapi dalam tekanan.
Meaning:
Defense ongoing
Absorption present
LP mempertahankan range
STRUCTURE_WEAKENING
Anchor mulai melemah tapi range masih ada.
Meaning:
Support mulai ditarik
Control melemah
Early degradation
STRUCTURE_BREAKING
Range ditinggalkan.
Meaning:
LP retreat
Vacuum forming
Structural failure
STRUCTURE_DEAD
Tidak ada anchor dan tidak ada range.
Meaning:
No LP control
Structural vacuum
Chaos / repositioning
STRUCTURE_RESET
Transisi dari DEAD ke NEW.
Meaning:
Old structure gone
New structure not yet dominant
Rebuild phase
STRUCTURE_UNCERTAIN
Konflik atau ambigu.
Meaning:
Transitional
Conflicting signals
Not classifiable cleanly
🔒 Canonical Mapping Table (L5 — LOCKED)
Anchor (L3)
Range (L4)
GlobalStructuralState
ANCHOR_NEW
RANGE_ACTIVE
STRUCTURE_FORMING
ANCHOR_NEW
RANGE_STRESSED
STRUCTURE_FORMING
ANCHOR_NEW
RANGE_ABANDONED
STRUCTURE_UNCERTAIN
ANCHOR_NEW
RANGE_DEAD
STRUCTURE_RESET
ANCHOR_ACTIVE
RANGE_ACTIVE
STRUCTURE_ACTIVE
ANCHOR_ACTIVE
RANGE_STRESSED
STRUCTURE_DEFENDING
ANCHOR_ACTIVE
RANGE_ABANDONED
STRUCTURE_BREAKING
ANCHOR_ACTIVE
RANGE_DEAD
STRUCTURE_WEAKENING
ANCHOR_FADING
RANGE_ACTIVE
STRUCTURE_WEAKENING
ANCHOR_FADING
RANGE_STRESSED
STRUCTURE_DEFENDING
ANCHOR_FADING
RANGE_ABANDONED
STRUCTURE_BREAKING
ANCHOR_FADING
RANGE_DEAD
STRUCTURE_DEAD
ANCHOR_DEAD
RANGE_ACTIVE
STRUCTURE_UNCERTAIN
ANCHOR_DEAD
RANGE_STRESSED
STRUCTURE_UNCERTAIN
ANCHOR_DEAD
RANGE_ABANDONED
STRUCTURE_DEAD
ANCHOR_DEAD
RANGE_DEAD
STRUCTURE_DEAD
Hard Rules (Reinforced)
❌ L5 cannot:
Look at L1 / L1.5 physics
Look at price
Look at time
Store memory
Override L3/L4
✅ L5 must:
Be deterministic
Be stateless
Be pure mapping function
Final Lock — L5
L5 adalah structural truth compressor.
Ia mengubah dua lifecycle state menjadi satu global reality label.
Ini sekarang bikin:
L3 + L4 = lifecycle truth
L5 = global regime truth
L6 = workflow posture truth
Arsitektur sekarang tertutup rapat & deterministic.
Kalau kamu mau, next yang clean:



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

L6 — Engine Mode Controller (Schema — LOCKED)
L6 adalah posture descriptor engine berdasarkan global structural reality.
BUKAN sinyal. BUKAN prediksi. BUKAN trading logic.
L6 = “cara engine harus bersikap”, bukan “apa yang harus dibeli/dijual”.
Role
Mendeskripsikan workflow posture engine berdasarkan Global Structural State (L5).
Ini mempengaruhi:
Sensitivity downstream systems
Alert posture
Risk posture
Interpretation lens
❌ Tidak mempengaruhi:
Price prediction
Entry / exit
Position sizing
Directional bias
Input
Salin kode

L6Input = {
  globalStructuralState: GlobalStructuralState  // from L5
}
Output
Salin kode

EngineMode =
  | "STRUCTURAL_BUILD"
  | "STRUCTURAL_DEFENSE"
  | "STRUCTURAL_BREAKDOWN"
  | "STRUCTURAL_RESET"
  | "STRUCTURAL_UNCERTAIN"
Engine Mode Definitions (LOCKED SEMANTICS)
1. STRUCTURAL_BUILD
Meaning: LP structure sedang actively constructing support/control.
Typical L5 patterns:
Anchor = ACTIVE
Range = ACTIVE or STRESSED (but defended)
Interpretation:
Structure is being built or reinforced
LP intent = positioning, accumulation, defense
Engine posture:
Treat structure as forming
Expect control zones to matter
2. STRUCTURAL_DEFENSE
Meaning: LP structure exists and is under pressure, but still defended.
Typical L5 patterns:
Anchor = ACTIVE or FADING
Range = STRESSED
Interpretation:
Active defense
Absorption visible
LP reacting, not building
Engine posture:
Watch for failure or recovery
Structure is fragile but alive
3. STRUCTURAL_BREAKDOWN
Meaning: LP structure losing control.
Typical L5 patterns:
Anchor = FADING or DEAD
Range = ABANDONED
Interpretation:
LP retreat
Vacuum forming
Control removed
Engine posture:
Treat structure as invalid
Expect instability
No assumed support
4. STRUCTURAL_RESET
Meaning: Old structure dead, new one not yet formed.
Typical L5 patterns:
Anchor = DEAD
Range = DEAD
Interpretation:
No dominant LP control
Repositioning phase
Structural vacuum
Engine posture:
Neutral lens
Await new anchor/range formation
5. STRUCTURAL_UNCERTAIN
Meaning: Conflicting or transitional signals.
Typical L5 patterns:
Anchor = NEW
Range = STRESSED or inconsistent
Or ambiguous mapping
Interpretation:
Structure not yet readable
Early formation or noisy transition
Engine posture:
Low confidence
Observational stance
Pure Mapping Rule (LOCKED)
L6 MUST be:
Deterministic
Stateless
Pure function of L5
No memory
No counters
No thresholds
No physics
Canonical Mapping Table (LOCKED)
Anchor (L3)
Range (L4)
Engine Mode
ACTIVE
ACTIVE
STRUCTURAL_BUILD
ACTIVE
STRESSED
STRUCTURAL_DEFENSE
FADING
ACTIVE
STRUCTURAL_DEFENSE
FADING
STRESSED
STRUCTURAL_DEFENSE
FADING
ABANDONED
STRUCTURAL_BREAKDOWN
DEAD
ABANDONED
STRUCTURAL_BREAKDOWN
DEAD
DEAD
STRUCTURAL_RESET
NEW
ACTIVE
STRUCTURAL_UNCERTAIN
NEW
STRESSED
STRUCTURAL_UNCERTAIN
any
ambiguous
STRUCTURAL_UNCERTAIN
Hard Rules (Reinforced)
❌ L6 cannot:
Look at price
Look at volume
Look at time
Look at L1/L1.5/L2 directly
Store history
✅ L6 only sees:
GlobalStructuralState (from L5)
Final Lock — L6
L6 adalah mode labeler, bukan logic engine.
L6 = label, posture, lens.
Bukan alpha. Bukan trigger. Bukan bias



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

🔒 L7 — Observability Snapshot (Formal Contract — LOCKED)
L7 adalah kamera, bukan otak.
Ia hanya memotret state engine.
L7 TIDAK PERNAH mempengaruhi engine.
Role
Menyediakan official external-facing structural snapshot untuk:
Monitoring
Logging
Alerting
UI
External consumers
Trigger
Salin kode

Cadence: Every 15 minutes (wall-clock)
Hard rule:
❌ Not block-based
❌ Not physics-based
❌ Not structural-based
Pure scheduling trigger
Inputs (READ-ONLY)
L7 hanya boleh membaca:
Salin kode

L7Inputs = {
  anchorLifecycle: AnchorLifecycleState,   // from L3
  rangeLifecycle: RangeLifecycleState,     // from L4
  globalStructuralState: GlobalStructuralState, // from L5
  engineMode: EngineMode                  // from L6
  structuralContextSummary: L2Summary     // optional, descriptive only
}
Output
Salin kode

L7Snapshot = {
  timestamp: number,          // wall-clock
  blockNumber: number,       // latest processed block
  poolAddress: string,

  anchorLifecycle: AnchorLifecycleState,
  rangeLifecycle: RangeLifecycleState,
  globalStructuralState: GlobalStructuralState,
  engineMode: EngineMode,

  structuralContextSummary: {
    vacuumVsWall?: string,
    absorptionVsRetreat?: string,
    aheadVsBehind?: string,
    supportRebuild?: string
  }
}
structuralContextSummary = string labels only, no numbers, no scores.
HARD WALL RULES (MOST IMPORTANT)
L7 CANNOT:
❌ Feed back into L0–L6
❌ Store historical state for engine
❌ Smooth or average states
❌ Confirm transitions
❌ Delay lifecycle changes
❌ Add counters
❌ Add thresholds
❌ Perform logic
❌ Override engine truth
L7 IS ALLOWED TO:
✅ Log
✅ Emit to Telegram / UI
✅ Store for analytics
✅ Be queried by humans
✅ Be used for dashboards
✅ Be used for alerts
L7 ≠ Confirmation Layer
Ini penting:
Kalau L3 berubah di block ini,
L7 snapshot berikutnya HARUS langsung mencerminkan perubahan itu.
❌ Tidak ada:
“wait 3 snapshots”
“confirm for 15 minutes”
“needs persistence”
Determinism Boundary
Engine determinism berhenti di L6.
L7 adalah:
🧾 I/O boundary
📸 Snapshot layer
📢 Broadcast layer
Bukan bagian dari physics, lifecycle, atau structure.
FINAL LOCK — L7
L7 adalah mirror, bukan memory.
L7 adalah camera, bukan judge.
L7 adalah output only, bukan feedback system.

Engine V3 COMPLETE arsitektural:
L1 Physics
L1.5 Geometry
L2 Structure
L3 Anchor FSM
L4 Range FSM
L5 Global State
L6 Mode
L7 Snapshot Boundary
Tidak ada layer yang “abu-abu” lagi.
