import type { Address } from "viem"

const FALLBACK_RECEIVING_WALLET =
    "0x11015f39Ac7389201aEc778Be8e3D84f2aF44A70" as Address

export function getReceivingWalletAddress(): Address {
    const fromEnv =
        process.env.WORLD_RECEIVING_WALLET ||
        process.env.NEXT_PUBLIC_WORLD_RECEIVING_WALLET

    return (fromEnv || FALLBACK_RECEIVING_WALLET) as Address
}
