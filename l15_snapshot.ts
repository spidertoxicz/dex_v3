// ENGINE V3 — L1.5 LP SNAPSHOT
// STATUS: LOCKED
// Tick-space spatial snapshot ONLY

import {
  L15Input,
  SpatialBands,
  L15SnapshotFrame,
  L0LPDelta
} from "./l15_types"

/**
 * Build TickLiquidityMap
 */
function buildTickLiquidityMap(
  lpDeltas: L0LPDelta[]
): Map<number, bigint> {
  const map = new Map<number, bigint>()

  for (const delta of lpDeltas) {
    const prev = map.get(delta.tickIndex) ?? 0n
    map.set(delta.tickIndex, prev + delta.liquidityNet)
  }

  return map
}

/**
 * Compute liquidity inside a tick-space band
 */
function computeBandLiquidity(
  tickMap: Map<number, bigint>,
  band: { lowerTick: number; upperTick: number }
): { liquidity: bigint; netLiquidity: bigint } {
  let liquidity = 0n
  let netLiquidity = 0n

  for (const [tick, liqNet] of tickMap.entries()) {
    if (tick >= band.lowerTick && tick <= band.upperTick) {
      netLiquidity += liqNet
      liquidity += liqNet >= 0n ? liqNet : -liqNet
    }
  }

  return { liquidity, netLiquidity }
}

/**
 * L1.5 Snapshot Generator
 * NO interpretation
 * NO thresholds
 * NO ratios
 */
export function generateL15Snapshot(
  input: L15Input,
  bands: SpatialBands
): L15SnapshotFrame {
  const tickMap = buildTickLiquidityMap(input.lpDeltas)

  return {
    blockNumber: input.blockNumber,
    poolAddress: input.poolAddress,
    currentTick: input.currentTick,
    activeLiquidity: input.activeLiquidity,
    bands: {
      near: computeBandLiquidity(tickMap, bands.near),
      mid: computeBandLiquidity(tickMap, bands.mid),
      far: computeBandLiquidity(tickMap, bands.far)
    }
  }
}
