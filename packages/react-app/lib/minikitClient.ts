import { MiniKit } from "@worldcoin/minikit-js"

import {
    getMiniKitMaxPollAttempts,
    getMiniKitPollIntervalMs,
    isIOSWebView
} from "@/lib/platform"

let resolvedAppId: string | null = null

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}
let resolveAppIdPromise: Promise<string> | null =
    null

function getBundledAppId(): string {
    return (
        process.env.NEXT_PUBLIC_APP_ID ||
        ""
    ).trim()
}

export function getCachedAppId(): string {
    return (
        resolvedAppId ||
        getBundledAppId()
    )
}

/** Resolves app id from build bundle, then /api/config (Cloudflare APP_ID). */
export async function resolveAppId(): Promise<string> {
    const bundled = getBundledAppId()

    if (bundled) {
        resolvedAppId = bundled
        return bundled
    }

    if (resolvedAppId) {
        return resolvedAppId
    }

    if (resolveAppIdPromise) {
        return resolveAppIdPromise
    }

    resolveAppIdPromise = (async () => {
        const response =
            await fetch("/api/config", {
                cache: "no-store"
            })

        if (!response.ok) {
            throw new Error(
                "Could not load app configuration from server"
            )
        }

        const data =
            await response.json()

        const appId =
            typeof data.appId === "string"
                ? data.appId.trim()
                : ""

        if (!appId) {
            throw new Error(
                "Server is missing APP_ID. Set APP_ID in Cloudflare Worker variables."
            )
        }

        resolvedAppId = appId
        return appId
    })().finally(() => {
        resolveAppIdPromise = null
    })

    return resolveAppIdPromise
}

export async function ensureMiniKitInstalledAsync(): Promise<boolean> {
    if (typeof window === "undefined") {
        return false
    }

    if (MiniKit.isInstalled()) {
        return true
    }

    let appId: string

    try {
        appId = await resolveAppId()
    } catch (error) {
        console.error(
            "[MiniKit] Failed to resolve app id",
            error
        )
        return false
    }

    if (!MiniKit.isInWorldApp()) {
        console.warn(
            "[MiniKit] window.WorldApp not found — not running inside World App"
        )
        return false
    }

    const result =
        MiniKit.install(appId)

    if (
        result &&
        "success" in result &&
        result.success === false
    ) {
        console.warn(
            "[MiniKit] install failed",
            result
        )
    }

    return MiniKit.isInstalled()
}

/**
 * iOS World App often injects MiniKit after the Unity iframe loads.
 * Poll until install succeeds or timeout.
 */
export async function waitUntilMiniKitReady(): Promise<boolean> {
    if (typeof window === "undefined") {
        return false
    }

    const maxAttempts =
        getMiniKitMaxPollAttempts()
    const delayMs =
        getMiniKitPollIntervalMs()

    for (
        let attempt = 0;
        attempt < maxAttempts;
        attempt++
    ) {
        if (
            MiniKit.isInstalled() &&
            MiniKit.isInWorldApp()
        ) {
            return true
        }

        const installed =
            await ensureMiniKitInstalledAsync()

        if (
            installed &&
            MiniKit.isInWorldApp()
        ) {
            return true
        }

        if (attempt < maxAttempts - 1) {
            await sleep(delayMs)
        }
    }

    console.warn(
        "[MiniKit] waitUntilMiniKitReady timed out",
        {
            ios: isIOSWebView(),
            installed: MiniKit.isInstalled(),
            inWorldApp: MiniKit.isInWorldApp()
        }
    )

    return (
        MiniKit.isInstalled() &&
        MiniKit.isInWorldApp()
    )
}

export async function getMiniKitUnavailableMessageAsync(): Promise<string> {
    if (typeof window === "undefined") {
        return "MiniKit is not available"
    }

    try {
        await resolveAppId()
    } catch (error) {
        return error instanceof Error
            ? error.message
            : "App configuration failed"
    }

    if (!getCachedAppId()) {
        return "App is misconfigured (missing APP_ID). Set APP_ID in Cloudflare and redeploy."
    }

    if (!MiniKit.isInWorldApp()) {
        return "Please open this app inside World App"
    }

    return "World App wallet is not ready yet. Close and reopen the mini app, then try again."
}

/** @deprecated Use ensureMiniKitInstalledAsync */
export function ensureMiniKitInstalled(): boolean {
    if (MiniKit.isInstalled()) {
        return true
    }

    const appId = getCachedAppId()

    if (!appId || !MiniKit.isInWorldApp()) {
        return false
    }

    MiniKit.install(appId)
    return MiniKit.isInstalled()
}
