import { MiniKit } from "@worldcoin/minikit-js"

import { apiPost } from "@/lib/api"
import { normalizeWalletAuthError } from "@/lib/minikitErrors"
import { normalizeWalletAddress } from "@/lib/walletAddress"
import {
    getWalletAuthMaxAttempts,
    getWalletAuthRetryDelayMs
} from "@/lib/platform"

import {
    getMiniKitUnavailableMessageAsync,
    waitUntilMiniKitReady
} from "@/lib/minikitClient"

const WALLET_AUTH_STATEMENT =
    "Sign in to Arrow Out"

let cachedWallet: string | null = null

export function getCachedWallet(): string | null {
    const raw =
        cachedWallet ||
        MiniKit.user?.walletAddress ||
        null

    if (!raw) {
        return null
    }

    try {
        return normalizeWalletAddress(
            raw
        )
    } catch {
        return raw
    }
}

export function setCachedWallet(
    address: string
) {
    cachedWallet = address
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export async function authenticateWallet(): Promise<string> {
    const existing =
        getCachedWallet()

    if (existing) {
        return existing
    }

    const ready =
        await waitUntilMiniKitReady()

    if (!ready) {
        throw new Error(
            await getMiniKitUnavailableMessageAsync()
        )
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

        const address =
            normalizeWalletAddress(
                response.address
            )

        setCachedWallet(address)

        return address
    } catch (error) {
        throw new Error(
            normalizeWalletAuthError(error)
        )
    }
}

/** iOS MiniKit is often late; retry wallet auth before Unity falls back to PlayerPrefs. */
export async function authenticateWalletWithRetry(): Promise<string> {
    const cached =
        getCachedWallet()

    if (cached) {
        return cached
    }

    const maxAttempts =
        getWalletAuthMaxAttempts()
    const retryDelayMs =
        getWalletAuthRetryDelayMs()

    let lastError: unknown

    for (
        let attempt = 0;
        attempt < maxAttempts;
        attempt++
    ) {
        try {
            return await authenticateWallet()
        } catch (error) {
            lastError = error

            if (attempt >= maxAttempts - 1) {
                break
            }

            console.warn(
                "[WalletAuth] retry",
                attempt + 1,
                error
            )

            await sleep(retryDelayMs)
            await waitUntilMiniKitReady()
        }
    }

    throw new Error(
        normalizeWalletAuthError(lastError)
    )
}
