import { MiniKit } from "@worldcoin/minikit-js"
import {
    Tokens,
    tokenToDecimals
} from "@worldcoin/minikit-js/commands"

import { apiPost } from "@/lib/api"
import { normalizeMiniKitPayError } from "@/lib/minikitErrors"
import { normalizeWalletAddress } from "@/lib/walletAddress"
import {
    getMiniKitUnavailableMessageAsync,
    waitUntilMiniKitReady
} from "@/lib/minikitClient"

export async function miniKitPay(
    amount: string,
    description: string
): Promise<string> {
    if (!(await waitUntilMiniKitReady())) {
        throw new Error(
            await getMiniKitUnavailableMessageAsync()
        )
    }

    const initiate =
        await apiPost(
            "/api/payment/initiate"
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
            verifyResponse.from ||
            result.data.from

        if (!payer) {
            throw new Error(
                "Payment did not return a wallet address"
            )
        }

        return normalizeWalletAddress(
            payer
        )
    } catch (error) {
        throw new Error(
            normalizeMiniKitPayError(error)
        )
    }
}
