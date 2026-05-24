import "server-only"

import { isAddress } from "viem"
import type { PayResult } from "@worldcoin/minikit-js/commands"

import { getReceivingWalletAddress } from "@/lib/receivingWalletAddress"
import {
    isPortalTransactionSuccessful,
    verifyPaymentWithPortal
} from "@/lib/worldPortal"

export function validatePayPayload(
    reference: string,
    payload: PayResult
): { ok: true; from: string } | { ok: false; error: string } {
    if (
        !payload ||
        typeof payload !== "object"
    ) {
        return {
            ok: false,
            error: "Payment payload missing"
        }
    }

    if (payload.reference !== reference) {
        return {
            ok: false,
            error: "Reference mismatch"
        }
    }

    if (!payload.transactionId) {
        return {
            ok: false,
            error: "Transaction ID missing"
        }
    }

    if (payload.chain !== "worldchain") {
        return {
            ok: false,
            error: "Invalid chain"
        }
    }

    if (
        !payload.from ||
        !isAddress(payload.from)
    ) {
        return {
            ok: false,
            error: "Invalid payer address"
        }
    }

    const receivingWallet =
        getReceivingWalletAddress()

    if (
        "to" in payload &&
        typeof payload.to === "string" &&
        payload.to.toLowerCase() !==
        receivingWallet.toLowerCase()
    ) {
        return {
            ok: false,
            error: "Invalid receiver"
        }
    }

    return {
        ok: true,
        from: payload.from
    }
}

export async function verifyPayment(
    reference: string,
    payload: PayResult
) {
    const local =
        validatePayPayload(
            reference,
            payload
        )

    if (!local.ok) {
        return local
    }

    const portal =
        await verifyPaymentWithPortal(
            payload.transactionId
        )

    if (portal.ok) {
        if (
            !isPortalTransactionSuccessful(
                portal.transaction
            )
        ) {
            return {
                ok: false as const,
                error: "Payment not confirmed by World App"
            }
        }

        return {
            ok: true as const,
            from: local.from,
            verifiedBy: "portal" as const
        }
    }

    if (portal.skipped) {
        return {
            ok: true as const,
            from: local.from,
            verifiedBy: "payload" as const
        }
    }

    // Portal 403/5xx on Workers: fall back to payload checks (Sand Drop pattern).
    if (
        portal.status === 403 ||
        portal.status >= 500
    ) {
        console.warn(
            "Portal payment lookup unavailable, using payload validation",
            portal.status,
            portal.error
        )

        return {
            ok: true as const,
            from: local.from,
            verifiedBy: "payload" as const
        }
    }

    return {
        ok: false as const,
        error:
            portal.error ||
            "Payment verification failed"
    }
}
