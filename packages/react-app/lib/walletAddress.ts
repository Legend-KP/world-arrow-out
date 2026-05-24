import {
    getAddress,
    isAddress
} from "viem"

/** Single canonical form (EIP-55) for DB keys and API payloads. */
export function normalizeWalletAddress(
    address: string
): string {
    const trimmed =
        address.trim()

    if (!isAddress(trimmed)) {
        throw new Error(
            "Invalid wallet address"
        )
    }

    return getAddress(trimmed)
}

export function getLegacyWalletDbKeys(
    canonical: string
): string[] {
    const lower =
        canonical.toLowerCase()

    if (lower === canonical) {
        return [canonical]
    }

    return [canonical, lower]
}
