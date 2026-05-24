import type { Address } from "viem"

import {
    authenticateWallet,
    getCachedWallet
} from "@/lib/walletAuth"
import {
    ensureMiniKitInstalledAsync,
    getCachedAppId
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
        if (!getCachedAppId()) {
            return null
        }

        if (!(await ensureMiniKitInstalledAsync())) {
            return null
        }

        return getCachedWallet() as Address | null
    } catch {
        return null
    }
}
