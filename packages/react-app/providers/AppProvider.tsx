"use client"

import type { ReactNode } from "react"

import { MiniKitBootstrap } from "@/providers/MiniKitBootstrap"

export function AppProvider({
    children
}: {
    children: ReactNode
}) {
    return (
        <>
            <MiniKitBootstrap />
            {children}
        </>
    )
}
