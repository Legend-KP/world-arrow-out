import { NextResponse } from "next/server"

import { getReceivingWalletAddress } from "@/lib/receivingWalletAddress"

export async function POST() {
    const reference =
        crypto.randomUUID().replace(
            /-/g,
            ""
        )

    return NextResponse.json({
        reference,
        receivingWallet:
            getReceivingWalletAddress()
    })
}
