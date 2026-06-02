import { NextResponse } from "next/server"

import {
    bootstrapUserSnapshot
} from "@/lib/server-user-state"
import { normalizeWalletAddress } from "@/lib/walletAddress"

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const rawWallet =
            typeof body.walletAddress === "string"
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
        const username =
            typeof body.username === "string" &&
            body.username.trim()
                ? body.username.trim()
                : undefined

        const snapshot =
            await bootstrapUserSnapshot(
                wallet,
                username
            )

        return NextResponse.json({
            success: true,
            snapshot
        })
    } catch (error: any) {
        console.error(
            "Bootstrap Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Bootstrap failed"
            },
            {
                status: 500
            }
        )
    }
}
