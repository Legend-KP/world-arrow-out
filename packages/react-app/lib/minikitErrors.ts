const PAY_ERROR_MESSAGES: Record<string, string> = {
    input_error: "Payment request was invalid",
    user_rejected: "Payment cancelled",
    payment_rejected: "Payment cancelled",
    invalid_receiver:
        "Payment receiver is not configured correctly. Whitelist your wallet in the World Developer Portal.",
    insufficient_balance:
        "Insufficient USDC balance on World Chain",
    transaction_failed: "Payment failed on-chain",
    generic_error: "Payment failed",
    user_blocked:
        "Payments are not available in your region"
}

const WALLET_AUTH_ERROR_MESSAGES: Record<string, string> = {
    malformed_request: "Wallet sign-in request was invalid",
    user_rejected: "Wallet sign-in cancelled",
    generic_error: "Wallet sign-in failed"
}

function readErrorCode(
    error: unknown
): string | null {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code ===
            "string"
    ) {
        return (error as { code: string }).code
    }

    return null
}

function readErrorMessage(
    error: unknown
): string {
    if (error instanceof Error) {
        return error.message
    }

    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message: unknown })
            .message === "string"
    ) {
        return (error as { message: string }).message
    }

    return String(error || "")
}

export function normalizeMiniKitPayError(
    error: unknown
): string {
    const code = readErrorCode(error)

    if (code && PAY_ERROR_MESSAGES[code]) {
        return PAY_ERROR_MESSAGES[code]
    }

    const message =
        readErrorMessage(error).toLowerCase()

    for (const [key, label] of Object.entries(
        PAY_ERROR_MESSAGES
    )) {
        if (message.includes(key)) {
            return label
        }
    }

    if (message.includes("world app")) {
        return readErrorMessage(error)
    }

    return (
        readErrorMessage(error) || "Payment failed"
    )
}

export function normalizeWalletAuthError(
    error: unknown
): string {
    const code = readErrorCode(error)

    if (
        code &&
        WALLET_AUTH_ERROR_MESSAGES[code]
    ) {
        return WALLET_AUTH_ERROR_MESSAGES[code]
    }

    const message =
        readErrorMessage(error).toLowerCase()

    for (const [key, label] of Object.entries(
        WALLET_AUTH_ERROR_MESSAGES
    )) {
        if (message.includes(key)) {
            return label
        }
    }

    return (
        readErrorMessage(error) ||
        "Wallet sign-in failed"
    )
}
