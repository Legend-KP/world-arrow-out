import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
    const nonce =
        crypto.randomUUID().replace(
            /-/g,
            ""
        )

    const cookieStore =
        await cookies()

    const isProduction =
        process.env.NODE_ENV ===
        "production"

    cookieStore.set("siwe", nonce, {
        httpOnly: true,
        sameSite: isProduction
            ? "none"
            : "lax",
        secure: isProduction,
        path: "/"
    })

    return NextResponse.json({
        nonce
    })
}
