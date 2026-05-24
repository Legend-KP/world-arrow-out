import "server-only"

function getPortalAppId(): string | null {
    const appId =
        process.env.APP_ID ||
        process.env.WORLD_APP_ID ||
        process.env.NEXT_PUBLIC_APP_ID

    return appId?.trim() || null
}

function getPortalApiKey(): string | null {
    const apiKey =
        process.env.DEV_PORTAL_API_KEY ||
        process.env.WORLD_API_KEY

    return apiKey?.trim() || null
}

export type PortalPaymentLookup =
    | {
        ok: true
        transaction: unknown
    }
    | {
        ok: false
        status: number
        error: string
        skipped?: boolean
    }

/**
 * Confirms a Pay transaction via World Developer Portal (recommended in docs).
 * Returns skipped when credentials are missing so callers can fall back to
 * payload-only validation.
 */
export async function verifyPaymentWithPortal(
    transactionId: string
): Promise<PortalPaymentLookup> {
    const appId = getPortalAppId()
    const apiKey = getPortalApiKey()

    if (!appId || !apiKey) {
        return {
            ok: false,
            status: 0,
            error: "Portal API credentials not configured",
            skipped: true
        }
    }

    const url =
        new URL(
            `https://developer.worldcoin.org/api/v2/minikit/transaction/${encodeURIComponent(transactionId)}`
        )

    url.searchParams.set("app_id", appId)
    url.searchParams.set("type", "payment")

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`
        },
        cache: "no-store"
    })

    const rawBody = await response.text()

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            error: rawBody || response.statusText
        }
    }

    try {
        return {
            ok: true,
            transaction: JSON.parse(rawBody)
        }
    } catch {
        return {
            ok: true,
            transaction: rawBody
        }
    }
}

export function isPortalTransactionSuccessful(
    transaction: unknown
): boolean {
    if (!transaction || typeof transaction !== "object") {
        return false
    }

    const record =
        transaction as Record<string, unknown>

    const status =
        record.status ??
        record.state ??
        record.payment_status

    if (typeof status === "string") {
        const normalized =
            status.toLowerCase()

        if (
            normalized.includes("fail") ||
            normalized.includes("reject") ||
            normalized.includes("cancel")
        ) {
            return false
        }

        if (
            normalized.includes("success") ||
            normalized.includes("complete") ||
            normalized.includes("confirmed") ||
            normalized === "mined"
        ) {
            return true
        }
    }

    // Portal shape varies; treat presence of transaction hash as success.
    return Boolean(
        record.transaction_hash ||
        record.transactionHash ||
        record.tx_hash
    )
}
