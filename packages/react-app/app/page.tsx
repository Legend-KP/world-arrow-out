"use client"

import dynamic from "next/dynamic";

import { ClientProviders } from "@/providers/ClientProviders";

const GameClient = dynamic(
    () => import("@/components/GameClient"),
    { ssr: false }
);

export default function Page() {
    return (
        <ClientProviders>
            <GameClient />
        </ClientProviders>
    );
}
