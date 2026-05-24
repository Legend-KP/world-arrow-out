"use client"

import {
    useEffect,
    useRef
} from "react"

import {
    authenticateWallet
} from "@/lib/walletAuth"

import {
    sendToUnity
} from "@/lib/bridge"

import {
    apiPost
} from "@/lib/api"

import {
    runWorldPayment
} from "@/lib/worldPay"

import {
    formatSnapshotForUnity,
    normalizeIncomingSnapshot
} from "@/lib/unitySnapshot"

declare global {
    interface Window {
        unityInstance?: any
    }
}

export default function GameClient() {
    const initialized =
        useRef(false)

    useEffect(() => {
        if (initialized.current)
            return

        initialized.current = true

        async function handleMessage(
            event: MessageEvent
        ) {
            const data = event.data

            if (!data)
                return

            try {
                switch (data.type) {
                    case "MINIPAY_BOOTSTRAP":
                        await handleBootstrap()
                        break

                    case "MINIPAY_SYNC_USER_STATE":
                        await handleSync(
                            data.payload
                        )
                        break

                    case "MINIPAY_PURCHASE_GAME":
                        await handlePurchaseGame()
                        break

                    case "MINIPAY_BUY_HINTS":
                        await handleBuyHints(
                            data.payload
                        )
                        break

                    case "MINIPAY_BUY_REVIVE":
                    case "MINIPAY_BUY_LIVES":
                        await handleBuyRevive(
                            data.payload
                        )
                        break

                    case "MINIPAY_SUBMIT_SCORE":
                        await handleSubmitScore(
                            data.payload
                        )
                        break

                    case "MINIPAY_GET_LEADERBOARD":
                        await handleGetLeaderboard(
                            data.payload
                        )
                        break
                }
            } catch (error: any) {
                console.error(
                    "GameClient Error",
                    error
                )

                sendToUnity(
                    "OnBridgeLogReceived",
                    error?.message ||
                    "Unknown error"
                )
            }
        }

        window.addEventListener(
            "message",
            handleMessage
        )

        return () => {
            window.removeEventListener(
                "message",
                handleMessage
            )
        }
    }, [])

    async function bootstrap(
        wallet: string
    ) {
        const walletAddress =
            wallet?.trim()

        if (!walletAddress) {
            throw new Error(
                "Wallet missing — cannot bootstrap"
            )
        }

        const response =
            await apiPost(
                "/api/bootstrap",
                {
                    walletAddress
                }
            )

        if (!response.success) {
            throw new Error(
                response.error
            )
        }

        sendToUnity(
            "OnBootstrapDataReceived",
            formatSnapshotForUnity(
                response.snapshot
            )
        )
    }

    function getPaymentFailureKind(
        error: unknown
    ) {
        const message =
            error instanceof Error
                ? error.message
                : String(
                    error ||
                    "Payment failed"
                )

        const lower =
            message.toLowerCase()

        if (
            lower.includes("cancel") ||
            lower.includes("rejected") ||
            lower.includes("denied") ||
            lower.includes("insufficient") ||
            lower.includes("world app")
        ) {
            return {
                message,
                shouldShowFailedPanel: true
            }
        }

        return {
            message,
            shouldShowFailedPanel: false
        }
    }

    async function handleBootstrap() {
        try {
            const wallet =
                await authenticateWallet()

            sendToUnity(
                "OnWalletAddressResolved",
                wallet
            )

            await bootstrap(wallet)
        } catch (error: any) {
            console.error(
                "Bootstrap failed",
                error
            )

            sendToUnity(
                "OnWalletAddressResolved",
                ""
            )

            sendToUnity(
                "OnBridgeLogReceived",
                error?.message ||
                "Could not connect wallet"
            )
        }
    }

    async function handleSync(
        snapshot: any
    ) {
        const normalizedSnapshot =
            normalizeIncomingSnapshot(
                snapshot
            )

        const response =
            await apiPost(
                "/api/sync",
                {
                    snapshot:
                        normalizedSnapshot
                }
            )

        if (!response.success) {
            throw new Error(
                response.error
            )
        }

        sendToUnity(
            "OnUserStateSynced",
            formatSnapshotForUnity(
                response.snapshot
            )
        )
    }

    async function handlePurchaseGame() {
        try {
            const wallet =
                await runWorldPayment(
                    "entry"
                )

            try {
                const response =
                    await apiPost(
                        "/api/purchase",
                        {
                            action: "game",
                            walletAddress: wallet
                        }
                    )

                if (!response.success) {
                    throw new Error(
                        response.error
                    )
                }

                sendToUnity(
                    "OnGamePurchaseSuccess",
                    response.result?.snapshot
                        ? formatSnapshotForUnity(
                            response.result.snapshot
                        )
                        : ""
                )
            } catch (error: any) {
                console.error(
                    "Purchase sync failed",
                    error
                )

                try {
                    await bootstrap(wallet)

                    sendToUnity(
                        "OnGamePurchaseStatus",
                        "Payment completed. Restoring your game access..."
                    )
                } catch (recoveryError) {
                    console.error(
                        "Purchase bootstrap recovery failed",
                        recoveryError
                    )

                    sendToUnity(
                        "OnGamePurchaseStatus",
                        "Payment completed, but the game could not unlock yet. Please reopen the app."
                    )
                }
            }
        } catch (error: any) {
            const result =
                getPaymentFailureKind(
                    error
                )

            if (
                result.shouldShowFailedPanel
            ) {
                sendToUnity(
                    "OnGamePurchaseFailed",
                    result.message
                )
            } else {
                sendToUnity(
                    "OnGamePurchaseStatus",
                    result.message
                )
            }
        }
    }

    async function handleBuyHints(
        payload: any
    ) {
        try {
            const wallet =
                await runWorldPayment(
                    "hint"
                )

            const response =
                await apiPost(
                    "/api/purchase",
                    {
                        action: "hints",
                        walletAddress: wallet,
                        amount:
                            payload?.amount || 5
                    }
                )

            if (!response.success) {
                throw new Error(
                    response.error
                )
            }

            sendToUnity(
                "OnHintPurchaseSuccess",
                response.result?.snapshot
                    ? formatSnapshotForUnity(
                        response.result.snapshot
                    )
                    : ""
            )
        } catch (error: any) {
            sendToUnity(
                "OnHintPurchaseFailed",
                error?.message ||
                "Hint purchase failed"
            )
        }
    }

    async function handleBuyRevive(
        payload: any
    ) {
        try {
            const reviveKind =
                payload?.mode === "challenge"
                    ? "reviveChallenge"
                    : "reviveClassic"

            const wallet =
                await runWorldPayment(
                    reviveKind
                )

            const response =
                await apiPost(
                    "/api/purchase",
                    {
                        action: "revive",
                        walletAddress: wallet
                    }
                )

            if (!response.success) {
                throw new Error(
                    response.error
                )
            }

            const snapshotPayload =
                response.result?.snapshot
                    ? formatSnapshotForUnity(
                        response.result.snapshot
                    )
                    : ""

            sendToUnity(
                "OnRevivePurchaseSuccess",
                snapshotPayload
            )
            sendToUnity(
                "OnLivesPurchaseSuccess",
                snapshotPayload
            )
        } catch (error: any) {
            const message =
                error?.message ||
                "Revive purchase failed"

            sendToUnity(
                "OnRevivePurchaseFailed",
                message
            )
            sendToUnity(
                "OnLivesPurchaseFailed",
                message
            )
        }
    }

    async function handleSubmitScore(
        payload: any
    ) {
        try {
            const response =
                await apiPost(
                    "/api/leaderboard",
                    {
                        action: "submit",
                        ...payload
                    }
                )

            if (!response.success) {
                throw new Error(
                    response.error
                )
            }

            sendToUnity(
                "OnLeaderboardSubmitted",
                JSON.stringify({
                    chancesLeft:
                        response.chancesLeft,
                    challenge:
                        response.challenge
                })
            )
        } catch (error: any) {
            sendToUnity(
                "OnLeaderboardSubmitFailed",
                error?.message ||
                "Leaderboard submit failed"
            )
        }
    }

    async function handleGetLeaderboard(
        payload: any
    ) {
        try {
            const response =
                await apiPost(
                    "/api/leaderboard",
                    {
                        action: "get",
                        ...payload
                    }
                )

            if (!response.success) {
                throw new Error(
                    response.error
                )
            }

            sendToUnity(
                "OnChallengeLeaderboardReceived",
                JSON.stringify({
                    entries:
                        response.entries,
                    playerRank:
                        response.playerRank,
                    chancesLeft:
                        response.chancesLeft,
                    playerChallenge:
                        response.playerChallenge
                })
            )
        } catch (error: any) {
            sendToUnity(
                "OnLeaderboardFailed",
                error?.message ||
                "Leaderboard failed"
            )
        }
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                overflow: "hidden"
            }}
        >
            <iframe
                src="https://pub-dc20f441675048ea9b7645055b8de789.r2.dev/index.html"
                style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block"
                }}
            />
        </div>
    )
}
