import { MiniKit } from "@worldcoin/minikit-js"
import {
    Tokens,
    tokenToDecimals
} from "@worldcoin/minikit-js/commands"

import { apiPost } from "@/lib/api"
import {
    ensureMiniKitInstalled,
    getMiniKitUnavailableMessage
} from "@/lib/minikitClient"

function normalizePayError(
    error: unknown
): string {
    if (!(error instanceof Error)) {
        return "Payment failed"
    }

    const message = error.message.toLowerCase()

    if (
        message.includes("user_rejected") ||
        message.includes("payment_rejected") ||
        message.includes("cancel")
    ) {
        return "Payment cancelled"
    }

    if (message.includes("insufficient_balance")) {
        return "Insufficient USDC balance on World Chain"
    }

    if (message.includes("invalid_receiver")) {
        return "Payment receiver is not configured correctly"
    }

    if (message.includes("input_error")) {
        return "Payment request was invalid"
    }

    if (message.includes("world app")) {
        return error.message
    }

    return error.message || "Payment failed"
}

export async function miniKitPay(
    amount: string,
    description: string
): Promise<string> {
    if (!ensureMiniKitInstalled()) {
        throw new Error(
            getMiniKitUnavailableMessage()
        )
    }

    const initiate =
        await apiPost(
            "/api/payment/initiate",
            {}
        )

    const reference =
        initiate.reference as string

    const receivingWallet =
        initiate.receivingWallet as string

    if (!reference || !receivingWallet) {
        throw new Error(
            "Could not start payment"
        )
    }

    try {
        const result =
            await MiniKit.pay({
                reference,
                to: receivingWallet,
                tokens: [
                    {
                        symbol: Tokens.USDC,
                        token_amount:
                            tokenToDecimals(
                                Number(amount),
                                Tokens.USDC
                            ).toString()
                    }
                ],
                description,
                fallback: () => {
                    throw new Error(
                        "Please open this app inside World App to pay"
                    )
                }
            })

        if (
            result.executedWith !==
            "minikit"
        ) {
            throw new Error(
                "Payment was cancelled or could not be completed in World App"
            )
        }

        const verifyResponse =
            await apiPost(
                "/api/payment/verify",
                {
                    reference,
                    payload: result.data
                }
            )

        if (!verifyResponse.success) {
            throw new Error(
                verifyResponse.error ||
                "Payment verification failed"
            )
        }

        const payer =
            result.data.from

        if (!payer) {
            throw new Error(
                "Payment did not return a wallet address"
            )
        }

        return payer
    } catch (error) {
        throw new Error(
            normalizePayError(error)
        )
    }
}
