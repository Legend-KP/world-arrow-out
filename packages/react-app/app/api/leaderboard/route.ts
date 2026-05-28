import { NextResponse } from "next/server"

import {
    submitChallengeScore,
    getChallengeLeaderboard,
    normalizePatternName
} from "@/lib/Leaderboard"

import {
    applyChallengeDailyReset,
    getOrCreateUserSnapshot,
    recordChallengePlay
} from "@/lib/server-user-state"
import { readDb } from "@/lib/firebase-server"

import { normalizeWalletAddress } from "@/lib/walletAddress"

const MAX_LEADERBOARD_ENTRIES = 25
const LEADERBOARD_META_PATH =
    "universal/currentChallenge"

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

function resolveLeaderboardCycleAndPattern(
    storedState: any
) {
    const storedCycle =
        parseOptionalCycleIndex(
            storedState?.leaderboardCycleIndex
        )
    const storedPattern =
        typeof storedState?.leaderboardPatternName ===
            "string" &&
        storedState.leaderboardPatternName.trim()
            ? normalizePatternName(
                  storedState.leaderboardPatternName
              )
            : null

    if (
        storedCycle !== null &&
        storedPattern
    ) {
        return {
            cycleIndex: storedCycle,
            patternName: storedPattern
        }
    }

    return {
        cycleIndex: 0,
        patternName: "star"
    }
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
            const storedState =
                await readDb<any>(
                    LEADERBOARD_META_PATH
                )
            const walletAddress =
                body.walletAddress
            const playerName =
                body.playerName ||
                "Guest"
            const {
                cycleIndex,
                patternName
            } =
                resolveLeaderboardCycleAndPattern(
                    storedState
                )
            console.log(
                "[Submit] resolved cycle/pattern",
                {
                    resolvedCycle:
                        cycleIndex,
                    resolvedPattern:
                        patternName,
                    storedCycle:
                        storedState?.leaderboardCycleIndex,
                    storedPattern:
                        storedState?.leaderboardPatternName
                }
            )
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

            const result =
                await submitChallengeScore(
                    walletAddress,
                    playerName,
                    cycleIndex,
                    patternName,
                    completionSeconds
                )

            let playSnapshot = null
            let chancesLeft = null

            try {
                const playResult =
                    await recordChallengePlay(
                        walletAddress,
                        completionSeconds,
                        chancesAfterPlay
                    )

                if (playResult.success) {
                    playSnapshot =
                        playResult.snapshot ?? null
                    chancesLeft =
                        playResult.snapshot
                            ?.challenge?.chances ??
                        null
                }
            } catch (playError) {
                console.warn(
                    "recordChallengePlay failed after leaderboard submit",
                    playError
                )
            }

            return NextResponse.json({
                success: true,
                result,
                challenge:
                    playSnapshot?.challenge ??
                    null,
                cycleIndex,
                patternName,
                chancesLeft
            })
        }

        if (action === "get") {
            const limit = clampLimit(
                body.limit
            )
            const playerWallet =
                body.walletAddress

            const leaderboard =
                await getChallengeLeaderboard(
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
                version:
                    leaderboard.version,
                updatedAt:
                    leaderboard.updatedAt,
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
