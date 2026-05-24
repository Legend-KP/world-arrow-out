import { NextResponse } from "next/server"
import { isAddress } from "viem"
import type { PayResult } from "@worldcoin/minikit-js/commands"

import { getReceivingWalletAddress } from "@/lib/receivingWalletAddress"

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const reference =
            typeof body.reference === "string"
                ? body.reference.trim()
                : ""

        const payload =
            body.payload as PayResult

        if (!reference) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Reference missing"
                },
                {
                    status: 400
                }
            )
        }

        if (
            !payload ||
            typeof payload !== "object"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Payment payload missing"
                },
                {
                    status: 400
                }
            )
        }

        if (
            payload.reference !==
            reference
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Reference mismatch"
                },
                {
                    status: 400
                }
            )
        }

        if (!payload.transactionId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Transaction ID missing"
                },
                {
                    status: 400
                }
            )
        }

        if (
            payload.chain !==
            "worldchain"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid chain"
                },
                {
                    status: 400
                }
            )
        }

        if (
            !payload.from ||
            !isAddress(payload.from)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid payer address"
                },
                {
                    status: 400
                }
            )
        }

        const receivingWallet =
            getReceivingWalletAddress()

        if (
            "to" in payload &&
            typeof payload.to === "string" &&
            payload.to.toLowerCase() !==
            receivingWallet.toLowerCase()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid receiver"
                },
                {
                    status: 400
                }
            )
        }

        return NextResponse.json({
            success: true
        })
    } catch (error: any) {
        console.error(
            "Payment Verify Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Payment verification failed"
            },
            {
                status: 500
            }
        )
    }
}
