"use client"

import { useEffect } from "react"

import {
    ensureMiniKitInstalledAsync
} from "@/lib/minikitClient"

export function MiniKitBootstrap() {
    useEffect(() => {
        void ensureMiniKitInstalledAsync()
    }, [])

    return null
}
