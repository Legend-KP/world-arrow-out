/** iOS World App / WKWebView (includes iPad desktop UA). */
export function isIOSWebView(): boolean {
    if (typeof navigator === "undefined") {
        return false
    }

    const ua = navigator.userAgent

    return (
        /iPad|iPhone|iPod/i.test(ua) ||
        (navigator.platform === "MacIntel" &&
            navigator.maxTouchPoints > 1)
    )
}

export function getMiniKitWarmupDelayMs(): number {
    return isIOSWebView() ? 3000 : 1000
}

export function getMiniKitPollIntervalMs(): number {
    return isIOSWebView() ? 500 : 300
}

export function getMiniKitMaxPollAttempts(): number {
    return isIOSWebView() ? 16 : 8
}

export function getWalletAuthMaxAttempts(): number {
    return isIOSWebView() ? 4 : 2
}

export function getWalletAuthRetryDelayMs(): number {
    return isIOSWebView() ? 1500 : 800
}
