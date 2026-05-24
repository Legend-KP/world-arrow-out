import { MiniKit } from "@worldcoin/minikit-js"

import { apiPost } from "@/lib/api"

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
    if (!MiniKit.isInstalled()) {
        throw new Error(
            "Please open this app inside World App"
        )
    }

    const existing =
        getCachedWallet()

    if (existing) {
        return existing
    }

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
                "Sign in to Arrow Out",
            expirationTime: new Date(
                Date.now() +
                1000 * 60 * 60 * 24 * 7
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
}
