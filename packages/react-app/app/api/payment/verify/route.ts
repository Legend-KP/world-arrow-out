import { NextResponse } from "next/server"
import type { PayResult } from "@worldcoin/minikit-js/commands"

import { verifyPayment } from "@/lib/paymentVerify"

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

        const result =
            await verifyPayment(
                reference,
                payload
            )

        if (!result.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error
                },
                {
                    status: 400
                }
            )
        }

        return NextResponse.json({
            success: true,
            from: result.from,
            verifiedBy:
                result.verifiedBy
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
