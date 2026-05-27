import { NextResponse } from "next/server"

/**
 * Stateless nonce endpoint.
 *
 * Avoid cookie-bound nonce checks here; mobile webview retries can issue
 * multiple nonce requests and cause cookie/body drift.
 */
export async function GET() {
    const nonce =
        crypto.randomUUID().replace(
            /-/g,
            ""
        )

    return NextResponse.json({
        nonce
    })
}
