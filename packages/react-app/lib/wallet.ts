import type { Address } from "viem"

import {
    authenticateWallet,
    getCachedWallet
} from "@/lib/walletAuth"
import {
    ensureMiniKitInstalled
} from "@/lib/minikitClient"
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
        if (!ensureMiniKitInstalled()) {
            return null
        }

        return getCachedWallet() as Address | null
    } catch {
        return null
    }
}
