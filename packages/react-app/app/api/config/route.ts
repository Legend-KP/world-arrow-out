import { NextResponse } from "next/server"

import { getPublicAppId } from "@/lib/appConfig"
import { getReceivingWalletAddress } from "@/lib/receivingWalletAddress"

export const dynamic = "force-dynamic"

export async function GET() {
    const appId = getPublicAppId()

    if (!appId) {
        return NextResponse.json(
            {
                error: "APP_ID is not configured on the server"
            },
            {
                status: 500
            }
        )
    }

    return NextResponse.json({
        appId,
        receivingWallet:
            getReceivingWalletAddress()
    })
}
