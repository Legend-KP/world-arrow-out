import { MiniKit } from "@worldcoin/minikit-js"

import { apiPost } from "@/lib/api"
import { normalizeWalletAuthError } from "@/lib/minikitErrors"
import {
    ensureMiniKitInstalled,
    getMiniKitUnavailableMessage
} from "@/lib/minikitClient"

const WALLET_AUTH_STATEMENT =
    "Sign in to Arrow Out"

let cachedWallet: string | null = null

export function getCachedWallet(): string | null {
    return (
        cachedWallet ||
        MiniKit.user?.walletAddress ||
        null
    )
}

export function setCachedWallet(
    address: string
) {
    cachedWallet = address
}

export async function authenticateWallet(): Promise<string> {
    if (!ensureMiniKitInstalled()) {
        throw new Error(
            getMiniKitUnavailableMessage()
        )
    }

    const existing =
        getCachedWallet()

    if (existing) {
        return existing
    }

    try {
        const nonceResponse =
            await fetch("/api/nonce")

        if (!nonceResponse.ok) {
            throw new Error(
                "Could not start wallet authentication"
            )
        }

        const { nonce } =
            await nonceResponse.json()

        if (!nonce) {
            throw new Error(
                "Could not start wallet authentication"
            )
        }

        const result =
            await MiniKit.walletAuth({
                nonce,
                statement:
                    WALLET_AUTH_STATEMENT,
                expirationTime: new Date(
                    Date.now() +
                    1000 * 60 * 60
                )
            })

        if (
            result.executedWith ===
            "fallback"
        ) {
            throw new Error(
                "Please open this app inside World App"
            )
        }

        const response =
            await apiPost(
                "/api/complete-siwe",
                {
                    payload: result.data,
                    nonce
                }
            )

        if (
            !response.isValid ||
            !response.address
        ) {
            throw new Error(
                response.error ||
                "Wallet authentication failed"
            )
        }

        setCachedWallet(
            response.address
        )

        return response.address
    } catch (error) {
        throw new Error(
            normalizeWalletAuthError(error)
        )
    }
}
