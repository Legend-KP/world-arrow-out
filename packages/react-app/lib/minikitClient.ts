import { MiniKit } from "@worldcoin/minikit-js"

function getAppId(): string {
    return (
        process.env.NEXT_PUBLIC_APP_ID ||
        ""
    ).trim()
}

export function ensureMiniKitInstalled(): boolean {
    if (typeof window === "undefined") {
        return false
    }

    if (MiniKit.isInstalled()) {
        return true
    }

    const appId = getAppId()

    if (!appId) {
        console.error(
            "[MiniKit] NEXT_PUBLIC_APP_ID is missing from the client bundle"
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

export function getMiniKitUnavailableMessage(): string {
    if (typeof window === "undefined") {
        return "MiniKit is not available"
    }

    if (!getAppId()) {
        return "App is misconfigured (missing NEXT_PUBLIC_APP_ID). Rebuild with env vars set."
    }

    if (!MiniKit.isInWorldApp()) {
        return "Please open this app inside World App"
    }

    return "World App wallet is not ready yet. Close and reopen the mini app, then try again."
}
