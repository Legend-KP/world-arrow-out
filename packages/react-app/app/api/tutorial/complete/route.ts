import { NextResponse } from "next/server"

import { markTutorialCompleted } from "@/lib/server-user-state"
import { normalizeWalletAddress } from "@/lib/walletAddress"

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const rawWallet =
            typeof body.walletAddress ===
            "string"
                ? body.walletAddress.trim()
                : ""

        if (!rawWallet) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Wallet missing"
                },
                {
                    status: 400
                }
            )
        }

        const wallet =
            normalizeWalletAddress(
                rawWallet
            )

        const snapshot =
            await markTutorialCompleted(
                wallet
            )

        return NextResponse.json({
            success: true,
            snapshot
        })
    } catch (error: any) {
        console.error(
            "Tutorial complete API Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Could not save tutorial completion"
            },
            {
                status: 500
            }
        )
    }
}
