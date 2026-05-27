"use client"

import { useEffect } from "react"

import {
    getMiniKitWarmupDelayMs
} from "@/lib/platform"

import {
    waitUntilMiniKitReady
} from "@/lib/minikitClient"

export function MiniKitBootstrap() {
    useEffect(() => {
        void (async () => {
            await new Promise((resolve) => {
                setTimeout(
                    resolve,
                    getMiniKitWarmupDelayMs()
                )
            })

            await waitUntilMiniKitReady()
        })()
    }, [])

    return null
}
