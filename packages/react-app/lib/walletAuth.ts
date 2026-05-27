import { MiniKit } from "@worldcoin/minikit-js"
import type { MiniAppWalletAuthSuccessPayload } from "@worldcoin/minikit-js/commands"

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
let authInFlight: Promise<string> | null =
    null

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

async function fetchSiweNonce(): Promise<string> {
    const nonceResponse =
        await fetch("/api/nonce", {
            cache: "no-store",
            credentials: "include"
        })

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

    return nonce
}

function isWalletAuthStageError(
    error: unknown
) {
    const message =
        error instanceof Error
            ? error.message
            : String(error || "")

    const lower =
        message.toLowerCase()

    return (
        lower.includes(
            "please open this app inside world app"
        ) ||
        lower.includes("wallet auth") ||
        lower.includes("cancel") ||
        lower.includes("rejected") ||
        lower.includes("denied")
    )
}

async function runWalletAuthentication(): Promise<string> {
    const ready =
        await waitUntilMiniKitReady()

    if (!ready) {
        throw new Error(
            await getMiniKitUnavailableMessageAsync()
        )
    }

    const maxAttempts =
        getWalletAuthMaxAttempts()
    const retryDelayMs =
        getWalletAuthRetryDelayMs()

    let nonce: string | null = null
    let signedPayload:
        | MiniAppWalletAuthSuccessPayload
        | null = null

    let lastError: unknown

    for (
        let attempt = 0;
        attempt < maxAttempts;
        attempt++
    ) {
        try {
            if (!nonce) {
                nonce =
                    await fetchSiweNonce()
            }

            if (!signedPayload) {
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
                    nonce = null

                    throw new Error(
                        "Please open this app inside World App"
                    )
                }

                signedPayload =
                    result.data
            }

            const response =
                await apiPost(
                    "/api/complete-siwe",
                    {
                        payload:
                            signedPayload,
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
            lastError = error

            if (
                isWalletAuthStageError(
                    error
                )
            ) {
                nonce = null
                signedPayload = null
            }

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

export async function authenticateWallet(): Promise<string> {
    const existing =
        getCachedWallet()

    if (existing) {
        return existing
    }

    return authenticateWalletWithRetry()
}

/**
 * One auth flow at a time. Retries must not fetch a new nonce after the user
 * already signed — that caused "Nonce mismatch" on /api/complete-siwe.
 */
export async function authenticateWalletWithRetry(): Promise<string> {
    const cached =
        getCachedWallet()

    if (cached) {
        return cached
    }

    if (authInFlight) {
        return authInFlight
    }

    authInFlight = runWalletAuthentication().finally(
        () => {
            authInFlight = null
        }
    )

    return authInFlight
}
