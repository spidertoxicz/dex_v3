// ENGINE V3 — L1.5 LP SNAPSHOT TEST
// STATUS: FROZEN
// Purpose: Guardrail for spatial geometry integrity

import { generateL15Snapshot } from "./l15_snapshot"
import { L15Input, SpatialBands } from "./l15_types"

describe("L1.5 — LP Snapshot (Spatial Geometry)", () => {

  it("computes spatial band liquidity correctly (frozen vector)", () => {
    const input: L15Input = {
      blockNumber: 123456,
      poolAddress: "0xPOOL",
      currentTick: 100,
      activeLiquidity: 1000n,
      lpDeltas: [
        { tickIndex: 95,  liquidityNet:  200n },
        { tickIndex: 98,  liquidityNet: -50n  },
        { tickIndex: 100, liquidityNet: 300n },
        { tickIndex: 105, liquidityNet: -100n },
        { tickIndex: 120, liquidityNet: 400n }
      ]
    }

    const bands: SpatialBands = {
      near: { lowerTick: 98, upperTick: 102 },
      mid:  { lowerTick: 90, upperTick: 110 },
      far:  { lowerTick: 80, upperTick: 130 }
    }

    const snapshot = generateL15Snapshot(input, bands)

    expect(snapshot).toEqual({
      blockNumber: 123456,
      poolAddress: "0xPOOL",
      currentTick: 100,
      activeLiquidity: 1000n,
      bands: {
        near: { liquidity: 350n, netLiquidity: 250n },
        mid:  { liquidity: 650n, netLiquidity: 350n },
        far:  { liquidity: 1050n, netLiquidity: 750n }
      }
    })
  })

  it("handles empty bands and zero liquidity deltas", () => {
    const input: L15Input = {
      blockNumber: 123457,
      poolAddress: "0xPOOL",
      currentTick: 500,
      activeLiquidity: 0n,
      lpDeltas: [
        { tickIndex: 100, liquidityNet: 0n },
        { tickIndex: 200, liquidityNet: 0n }
      ]
    }

    const bands: SpatialBands = {
      near: { lowerTick: 480, upperTick: 490 },
      mid:  { lowerTick: 490, upperTick: 510 },
      far:  { lowerTick: 1000, upperTick: 1100 }
    }

    const snapshot = generateL15Snapshot(input, bands)

    expect(snapshot).toEqual({
      blockNumber: 123457,
      poolAddress: "0xPOOL",
      currentTick: 500,
      activeLiquidity: 0n,
      bands: {
        near: { liquidity: 0n, netLiquidity: 0n },
        mid:  { liquidity: 0n, netLiquidity: 0n },
        far:  { liquidity: 0n, netLiquidity: 0n }
      }
    })
  })

})
