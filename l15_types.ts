// ENGINE V3 — L1.5 LP SNAPSHOT
// STATUS: LOCKED
// Pure spatial geometry only

export type L0LPDelta = {
  tickIndex: number
  liquidityNet: bigint
}

export type L15Input = {
  blockNumber: number
  poolAddress: string
  currentTick: number
  activeLiquidity: bigint
  lpDeltas: L0LPDelta[]
}

export type SpatialBand = {
  lowerTick: number
  upperTick: number
}

export type SpatialBands = {
  near: SpatialBand
  mid: SpatialBand
  far: SpatialBand
}

export type BandLiquiditySnapshot = {
  liquidity: bigint
  netLiquidity: bigint
}

export type L15SnapshotFrame = {
  blockNumber: number
  poolAddress: string
  currentTick: number
  activeLiquidity: bigint
  bands: {
    near: BandLiquiditySnapshot
    mid: BandLiquiditySnapshot
    far: BandLiquiditySnapshot
  }
}
