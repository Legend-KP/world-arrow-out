"use client"

import { useEffect } from "react"
import { MiniKit } from "@worldcoin/minikit-js"

export function MiniKitBootstrap() {
    useEffect(() => {
        const appId =
            process.env.NEXT_PUBLIC_APP_ID

        if (appId) {
            MiniKit.install(appId)
        }
    }, [])

    return null
}
