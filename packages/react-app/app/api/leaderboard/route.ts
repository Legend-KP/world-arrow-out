import { NextResponse } from "next/server"

import {
    submitChallengeScore,
    getChallengeLeaderboard
} from "@/lib/Leaderboard"

import {
    applyChallengeDailyReset,
    getOrCreateUserSnapshot,
    getUniversalSnapshot,
    recordChallengePlay
} from "@/lib/server-user-state"

import { normalizeWalletAddress } from "@/lib/walletAddress"

import {
    resolveChallengeCycleAndPattern,
    validateClientChallengeCycleAndPattern
} from "@/lib/weekly-challenge"

const MAX_LEADERBOARD_ENTRIES = 25

function clampLimit(
    _value: unknown
) {
    // Always return the shared top-25 window for all clients.
    return MAX_LEADERBOARD_ENTRIES
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
            const universal =
                await getUniversalSnapshot()
            const resolved =
                resolveChallengeCycleAndPattern(
                    universal as unknown as Record<
                        string,
                        unknown
                    >
                )
            const authoritative = {
                cycleIndex:
                    resolved.cycleIndex,
                patternName:
                    resolved.patternName
            }
            const {
                cycleIndex,
                patternName
            } =
                validateClientChallengeCycleAndPattern(
                    body,
                    authoritative
                )

            console.log(
                "[Submit] resolved cycle/pattern",
                {
                    resolvedCycle:
                        cycleIndex,
                    resolvedPattern:
                        patternName,
                    clientCycle:
                        body.cycleIndex,
                    clientPattern:
                        body.patternName
                }
            )

            const completionSeconds = Number(
                body.completionSeconds || 0
            )

            const rawWalletAddress =
                body.walletAddress

            if (!rawWalletAddress) {
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

            const walletAddress =
                normalizeWalletAddress(
                    rawWalletAddress
                )
            const userSnapshot =
                await getOrCreateUserSnapshot(
                    walletAddress
                )
            const playerName =
                userSnapshot.username ||
                "Player"

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
            await getUniversalSnapshot()

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
