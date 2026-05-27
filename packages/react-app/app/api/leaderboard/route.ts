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

    return value.trim().toLowerCase()
}

function pickFirstDefined(
    ...values: unknown[]
) {
    for (const value of values) {
        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            return value
        }
    }

    return undefined
}

function extractCycleAndPatternFromText(
    value: unknown
) {
    if (typeof value !== "string") {
        return {
            cycleIndex: null as number | null,
            patternName: null as string | null
        }
    }

    const text = value.trim()

    if (!text) {
        return {
            cycleIndex: null as number | null,
            patternName: null as string | null
        }
    }

    const match = text.match(
        /challenge\s*#\s*(\d+)(?:\s*[-:]\s*([a-z0-9 _-]+))?/i
    )

    if (!match) {
        return {
            cycleIndex: null as number | null,
            patternName: null as string | null
        }
    }

    const parsedCycle = parseOptionalCycleIndex(
        match[1]
    )
    const parsedPattern =
        parseOptionalPatternName(
            match[2]
        )

    return {
        cycleIndex: parsedCycle,
        patternName: parsedPattern
    }
}

function resolveChallengeText(
    payload: any
) {
    return pickFirstDefined(
        payload?.challengeTitle,
        payload?.weeklyChallengeTitle,
        payload?.title,
        payload?.headerText,
        payload?.challenge?.title,
        payload?.challenge?.label,
        payload?.challengeLabel,
        payload?.challengeDisplayName
    )
}

function resolveRequestedCycleIndex(
    payload: any
) {
    const fromExplicitField =
        parseOptionalCycleIndex(
            pickFirstDefined(
                payload?.cycleIndex,
                payload?.challengeCycleIndex,
                payload?.challenge?.cycleIndex,
                payload?.playerChallenge
                    ?.streakCycleIndex
            )
        )

    if (fromExplicitField !== null) {
        return fromExplicitField
    }

    const fromTitle =
        extractCycleAndPatternFromText(
            pickFirstDefined(
                resolveChallengeText(
                    payload
                ),
                payload?.challenge?.name,
                payload?.patternName
            )
        ).cycleIndex

    if (fromTitle !== null) {
        return fromTitle
    }

    return parseOptionalCycleIndex(
        pickFirstDefined(
            payload?.weeklyChallengeCycleIndex,
            payload?.challenge
                ?.weeklyChallengeCycleIndex,
            payload?.universal
                ?.weeklyChallengeCycleIndex,
            payload?.snapshot?.universal
                ?.weeklyChallengeCycleIndex
        )
    )
}

function resolveRequestedPatternName(
    payload: any
) {
    const fromField =
        parseOptionalPatternName(
            pickFirstDefined(
                payload?.patternName,
                payload?.challengePatternName,
                payload?.challenge?.patternName,
                payload?.challenge?.name
            )
        )

    if (fromField) {
        return fromField
    }

    return extractCycleAndPatternFromText(
        pickFirstDefined(
            resolveChallengeText(
                payload
            ),
            payload?.challenge?.name
        )
    ).patternName
}

function resolveLeaderboardCycleAndPattern(
    payload: any,
    storedState: any
) {
    const requestedCycle =
        resolveRequestedCycleIndex(
            payload
        )
    const requestedPattern =
        resolveRequestedPatternName(
            payload
        )

    const cycleIndex = Number(
        requestedCycle ??
            storedState?.leaderboardCycleIndex ??
            0
    )
    const patternName =
        normalizePatternName(
            requestedPattern ||
                (typeof storedState?.leaderboardPatternName ===
                "string"
                    ? storedState.leaderboardPatternName
                    : "") ||
                "unknown"
        )

    return {
        cycleIndex,
        patternName
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
                    "universal/currentChallenge"
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
                    body,
                    storedState
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
                cycleIndex,
                patternName,
                chancesLeft:
                    playResult.snapshot.challenge
                        .chances
            })
        }

        if (action === "get") {
            const storedState =
                await readDb<any>(
                    "universal/currentChallenge"
                )
            const {
                cycleIndex,
                patternName
            } =
                resolveLeaderboardCycleAndPattern(
                    body,
                    storedState
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
