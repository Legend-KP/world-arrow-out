"use client"

import { useEffect } from "react"

import {
    ensureMiniKitInstalled
} from "@/lib/minikitClient"

export function MiniKitBootstrap() {
    useEffect(() => {
        ensureMiniKitInstalled()
    }, [])

    return null
}
