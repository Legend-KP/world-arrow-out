import { NextResponse } from "next/server"
import type { MiniAppWalletAuthSuccessPayload } from "@worldcoin/minikit-js/commands"
import { verifySiweMessage } from "@worldcoin/minikit-js/siwe"

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const payload =
            body.payload as MiniAppWalletAuthSuccessPayload

        const nonce =
            typeof body.nonce === "string"
                ? body.nonce.trim()
                : ""

        if (!nonce) {
            return NextResponse.json(
                {
                    isValid: false,
                    error:
                        "Missing nonce — sign in again"
                },
                {
                    status: 400
                }
            )
        }

        const verification =
            await verifySiweMessage(
                payload,
                nonce,
                "Sign in to Arrow Out"
            )

        if (!verification.isValid) {
            return NextResponse.json(
                {
                    isValid: false,
                    error: "Invalid wallet signature"
                },
                {
                    status: 400
                }
            )
        }

        return NextResponse.json({
            isValid: true,
            address:
                verification.siweMessageData
                    .address
        })
    } catch (error: any) {
        console.error(
            "Complete SIWE Error",
            error
        )

        return NextResponse.json(
            {
                isValid: false,
                error:
                    error?.message ||
                    "Wallet authentication failed"
            },
            {
                status: 400
            }
        )
    }
}
