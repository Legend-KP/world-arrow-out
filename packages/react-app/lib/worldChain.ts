/** World Chain mainnet (chain id 480). */
export const WORLD_CHAIN_ID = 480

/**
 * USDC on World Chain. MiniKit Pay uses `Tokens.USDC` — you do not pass this
 * address in `MiniKit.pay`. Kept for docs, future on-chain checks, or
 * `sendTransaction` if you add contract calls later.
 */
export const WORLD_CHAIN_USDC_ADDRESS =
    "0x79a02482a880bce3f13e09da970dc34db4cd24d1" as const

/** Uniswap Permit2 on World Chain (for MiniKit.sendTransaction flows). */
export const WORLD_CHAIN_PERMIT2_ADDRESS =
    "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const
