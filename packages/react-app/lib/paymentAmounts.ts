export type PurchaseKind =
    | "entry"
    | "hint"
    | "reviveClassic"
    | "reviveChallenge"

// Matches on-chain FEE() on Celo payment contracts (USDC, 6 decimals).
export const PAYMENT_AMOUNTS_USDC: Record<PurchaseKind, string> = {
    entry: "0.5",
    hint: "0.1",
    reviveClassic: "0.05",
    reviveChallenge: "0.05"
}

const PAYMENT_DESCRIPTIONS: Record<PurchaseKind, string> = {
    entry: "Arrow Out - Game Entry",
    hint: "Arrow Out - Hints",
    reviveClassic: "Arrow Out - Revive (Classic)",
    reviveChallenge: "Arrow Out - Revive (Challenge)"
}

export function getPaymentAmount(
    kind: PurchaseKind
): string {
    return PAYMENT_AMOUNTS_USDC[kind]
}

export function getPaymentDescription(
    kind: PurchaseKind
): string {
    return PAYMENT_DESCRIPTIONS[kind]
}
