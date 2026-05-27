import { NextResponse } from "next/server"

import {
    submitChallengeScore,
    getChallengeLeaderboard
} from "@/lib/Leaderboard"

import {
    applyChallengeDailyReset,
    getOrCreateUserSnapshot,
    recordChallengePlay
} from "@/lib/server-user-state"

import { normalizeWalletAddress } from "@/lib/walletAddress"

const MAX_LEADERBOARD_ENTRIES = 25

function parseOptionalCycleIndex(
    value: unknown
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null
    }

    const numericValue = Number(
        value
    )

    return Number.isFinite(numericValue)
        ? Math.floor(numericValue)
        : null
}

function parseOptionalPatternName(
    value: unknown
) {
    if (
        typeof value !== "string" ||
        !value.trim()
    ) {
        return null
    }

    return value.trim()
}

function clampLimit(
    value: unknown
) {
    const numericValue = Number(
        value
    )

    if (!Number.isFinite(numericValue))
        return MAX_LEADERBOARD_ENTRIES

    return Math.min(
        MAX_LEADERBOARD_ENTRIES,
        Math.max(1, Math.floor(numericValue))
    )
}

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const action =
            body.action

        if (action === "submit") {
            const walletAddress =
                body.walletAddress
            const playerName =
                body.playerName ||
                "Guest"
            const cycleIndex = Number(
                body.cycleIndex || 0
            )
            const patternName =
                body.patternName ||
                "Unknown"
            const completionSeconds = Number(
                body.completionSeconds || 0
            )

            if (!walletAddress) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Wallet missing"
                    },
                    {
                        status: 400
                    }
                )
            }

            const chancesAfterPlay =
                typeof body.chances ===
                "number"
                    ? body.chances
                    : typeof body.chancesLeft ===
                      "number"
                      ? body.chancesLeft
                      : typeof body.challenge
                            ?.chances ===
                        "number"
                        ? body.challenge.chances
                        : undefined

            const playResult =
                await recordChallengePlay(
                    walletAddress,
                    completionSeconds,
                    chancesAfterPlay
                )

            if (!playResult.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            playResult.error ||
                            "No chances left",
                        chancesLeft:
                            playResult.snapshot
                                .challenge.chances
                    },
                    {
                        status: 400
                    }
                )
            }

            const result =
                await submitChallengeScore(
                    walletAddress,
                    playerName,
                    cycleIndex,
                    patternName,
                    completionSeconds
                )

            return NextResponse.json({
                success: true,
                result,
                challenge:
                    playResult.snapshot.challenge,
                chancesLeft:
                    playResult.snapshot.challenge
                        .chances
            })
        }

        if (action === "get") {
            const cycleIndex =
                parseOptionalCycleIndex(
                    body.cycleIndex
                )
            const patternName =
                parseOptionalPatternName(
                    body.patternName
                )
            const limit = clampLimit(
                body.limit
            )
            const playerWallet =
                body.walletAddress

            const leaderboard =
                await getChallengeLeaderboard(
                    cycleIndex,
                    patternName,
                    limit,
                    playerWallet
                )

            let playerChallenge = null

            if (playerWallet) {
                try {
                    const wallet =
                        normalizeWalletAddress(
                            playerWallet
                        )
                    const user =
                        await getOrCreateUserSnapshot(
                            wallet
                        )

                    playerChallenge =
                        applyChallengeDailyReset(
                            user.challenge
                        )
                } catch {
                    playerChallenge = null
                }
            }

            return NextResponse.json({
                success: true,
                entries:
                    leaderboard.entries,
                playerRank:
                    leaderboard.playerRank,
                cycleIndex:
                    leaderboard.cycleIndex,
                patternName:
                    leaderboard.patternName,
                playerChallenge,
                chancesLeft:
                    playerChallenge?.chances ??
                    null
            })
        }

        return NextResponse.json(
            {
                success: false,
                error:
                    "Unknown action"
            },
            {
                status: 400
            }
        )
    } catch (error: any) {
        console.error(
            "Leaderboard API Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Leaderboard API failed"
            },
            {
                status: 500
            }
        )
    }
}
