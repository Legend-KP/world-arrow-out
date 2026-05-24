"use client"

import {
    useEffect,
    useRef
} from "react"

import {
    getWalletSafe
} from "@/lib/wallet"

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

        async function preload() {
            try {
                let wallet: string | null =
                    (await getWalletSafe()) as
                        | string
                        | null

                if (!wallet) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, 1500)
                    )

                    try {
                        wallet =
                            await authenticateWallet()
                    } catch (authError) {
                        console.log(
                            "Auth not available:",
                            authError
                        )

                        return
                    }
                }

                if (!wallet) {
                    console.log(
                        "Wallet not connected yet"
                    )

                    return
                }

                await bootstrap(wallet)
            } catch (error) {
                console.error(
                    "Preload failed",
                    error
                )
            }
        }

        preload()

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
        const response =
            await apiPost(
                "/api/bootstrap",
                {
                    walletAddress:
                        wallet
                }
            )

        if (!response.success) {
            throw new Error(
                response.error
            )
        }

        sendToUnity(
            "OnBootstrapDataReceived",
            response.snapshot
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
        const response =
            await apiPost(
                "/api/sync",
                {
                    snapshot
                }
            )

        if (!response.success) {
            throw new Error(
                response.error
            )
        }

        sendToUnity(
            "OnUserStateSynced",
            response.snapshot
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
                    response.result?.snapshot || ""
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
                response.result?.snapshot || ""
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
                response.result?.snapshot || ""

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
                ""
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
                        response.playerRank
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
