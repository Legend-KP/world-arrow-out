import type { Address } from "viem"
import { MiniKit } from "@worldcoin/minikit-js"

import {
    authenticateWallet,
    getCachedWallet
} from "@/lib/walletAuth"

export async function getWallet(): Promise<Address> {
    const cached =
        getCachedWallet()

    if (cached) {
        return cached as Address
    }

    return (await authenticateWallet()) as Address
}

export async function getWalletSafe(): Promise<Address | null> {
    try {
        if (!MiniKit.isInstalled()) {
            return null
        }

        return getCachedWallet() as Address | null
    } catch {
        return null
    }
}
