"use client"

import dynamic from "next/dynamic";

const ClientProviders = dynamic(
    () =>
        import("@/providers/ClientProviders").then(
            (mod) => mod.ClientProviders
        ),
    { ssr: false }
);

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