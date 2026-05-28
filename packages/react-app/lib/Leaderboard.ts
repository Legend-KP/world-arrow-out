import "server-only"

import {
    patchDb,
    readDb
} from "./firebase-server"
import { normalizeWalletAddress } from "./walletAddress"

const CURRENT_CHALLENGE_PATH =
    "universal/currentChallenge"
const MAX_LEADERBOARD_ENTRIES = 25

export interface LeaderboardEntry {
    rank: number
    playerName: string
    walletAddress: string
    completionSeconds: number
}

interface StoredLeaderboardEntry {
    playerName: string
    walletAddress: string
    completionSeconds: number
    updatedAt: number
}

export function normalizePatternName(
    patternName: string
) {
    const normalized = (
        patternName || "unknown"
    )
        .trim()
        .toLowerCase()

    return normalized || "unknown"
}

function clampLimit(
    limit: number
) {
    if (!Number.isFinite(limit))
        return MAX_LEADERBOARD_ENTRIES

    return Math.min(
        MAX_LEADERBOARD_ENTRIES,
        Math.max(1, Math.floor(limit))
    )
}

function sortEntries(
    entries: StoredLeaderboardEntry[]
) {
    entries.sort(
        (left, right) => {
            const timeDelta =
                left.completionSeconds -
                right.completionSeconds

            if (Math.abs(timeDelta) > 0.0001)
                return timeDelta

            const updatedAtDelta =
                left.updatedAt -
                right.updatedAt

            if (updatedAtDelta !== 0)
                return updatedAtDelta

            return left.walletAddress.localeCompare(
                right.walletAddress
            )
        }
    )

    return entries
}

function mapToSortedEntries(
    raw:
        | Record<
              string,
              StoredLeaderboardEntry
          >
        | null
        | undefined
) {
    const entries = Object.values(
        raw || {}
    ).filter(
        entry =>
            !!entry &&
            !!normalizeWalletAddress(
                entry.walletAddress
            ) &&
            Number.isFinite(
                entry.completionSeconds
            ) &&
            entry.completionSeconds > 0
    )

    sortEntries(entries)

    return entries.map(
        (entry, index) => ({
            rank: index + 1,
            playerName:
                typeof entry.playerName ===
                    "string" &&
                entry.playerName.trim()
                    ? entry.playerName.trim()
                    : "Player",
            walletAddress:
                normalizeWalletAddress(
                    entry.walletAddress
                ),
            completionSeconds: Number(entry.completionSeconds)
        })
    )
}

function toStoredLeaderboard(
    entries: LeaderboardEntry[]
) {
    const leaderboard: Record<
        string,
        StoredLeaderboardEntry
    > = {}

    for (const entry of entries) {
        const walletAddress =
            normalizeWalletAddress(
                entry.walletAddress
            )

        if (!walletAddress)
            continue

        leaderboard[walletAddress] = {
            playerName:
                typeof entry.playerName ===
                    "string" &&
                entry.playerName.trim()
                    ? entry.playerName.trim()
                    : "Player",
            walletAddress,
            completionSeconds:
                Number(
                    entry.completionSeconds
                ),
            updatedAt: Date.now()
        }
    }

    return leaderboard
}

function isNewChallengeWeek(
    state: any,
    cycleIndex: number,
    normalizedPatternName: string
) {
    const storedCycle = Number(
        state?.leaderboardMeta?.cycleIndex ??
            state?.leaderboardCycleIndex ??
            -1
    )
    const storedPattern =
        normalizePatternName(
            String(
                state?.leaderboardMeta
                    ?.patternName ||
                state?.leaderboardPatternName ||
                ""
            )
        )
    const hasLeaderboardData =
        !!state?.leaderboardTop25 &&
        typeof state.leaderboardTop25 ===
            "object" &&
        Object.keys(state.leaderboardTop25)
            .length > 0

    if (
        !hasLeaderboardData &&
        storedCycle < 0
    ) {
        return false
    }

    return (
        storedCycle !== cycleIndex ||
        storedPattern !==
            normalizedPatternName
    )
}

export async function submitChallengeScore(
    walletAddress: string,
    playerName: string,
    cycleIndex: number,
    patternName: string,
    completionSeconds: number
) {
    const normalizedWallet =
        normalizeWalletAddress(
            walletAddress
        )
    const normalizedPatternName =
        normalizePatternName(
            patternName
        )
    const safePlayerName =
        typeof playerName === "string" &&
        playerName.trim()
            ? playerName.trim()
            : "Player"
    const safeCompletionSeconds =
        Number(completionSeconds)

    if (!normalizedWallet) {
        throw new Error(
            "Wallet missing"
        )
    }

    if (
        !Number.isFinite(
            safeCompletionSeconds
        ) ||
        safeCompletionSeconds <= 0
    ) {
        throw new Error(
            "Completion time is invalid"
        )
    }

    const state = await readDb<any>(
        CURRENT_CHALLENGE_PATH
    )

    const newChallengeWeek =
        isNewChallengeWeek(
            state,
            cycleIndex,
            normalizedPatternName
        )

    console.log(
        "[Leaderboard] submit cycle check",
        {
            requestedCycle: cycleIndex,
            requestedPattern:
                normalizedPatternName,
            storedCycle:
                state?.leaderboardMeta
                    ?.cycleIndex ??
                state?.leaderboardCycleIndex,
            storedPattern:
                state?.leaderboardMeta
                    ?.patternName ??
                state?.leaderboardPatternName,
            newChallengeWeek,
            existingEntryCount: Object.keys(
                state?.leaderboardTop25 || {}
            ).length
        }
    )

    const currentEntries = newChallengeWeek
        ? []
        : mapToSortedEntries(
              state?.leaderboardTop25
          )

    const existingEntry =
        currentEntries.find(
            entry =>
                entry.walletAddress.toLowerCase() ===
                normalizedWallet.toLowerCase()
        )

    if (
        existingEntry &&
        existingEntry.completionSeconds <=
            safeCompletionSeconds
    ) {
        return {
            success: true,
            improved: false,
            entries: currentEntries,
            playerRank:
                existingEntry.rank <=
                MAX_LEADERBOARD_ENTRIES
                    ? existingEntry.rank
                    : -1
        }
    }

    const nextEntries =
        currentEntries.filter(
            entry =>
                entry.walletAddress.toLowerCase() !==
                normalizedWallet.toLowerCase()
        )

    nextEntries.push({
        rank: 0,
        playerName: safePlayerName,
        walletAddress: normalizedWallet,
        completionSeconds: safeCompletionSeconds
    })

    const now = Date.now()
    const previousVersion = Number(
        state?.leaderboardMeta?.version ??
            0
    )
    const trimmedEntries =
        mapToSortedEntries(
            toStoredLeaderboard(
                nextEntries
            )
        ).slice(
            0,
            MAX_LEADERBOARD_ENTRIES
        )

    await patchDb(
        CURRENT_CHALLENGE_PATH,
        {
            leaderboardCycleIndex:
                cycleIndex,
            leaderboardPatternName:
                normalizedPatternName,
            "leaderboardMeta/cycleIndex":
                cycleIndex,
            "leaderboardMeta/patternName":
                normalizedPatternName,
            "leaderboardMeta/version":
                Number.isFinite(previousVersion)
                    ? previousVersion + 1
                    : 1,
            "leaderboardMeta/updatedAt":
                now,
            leaderboardTop25:
                toStoredLeaderboard(
                    trimmedEntries
                )
        }
    )

    const playerRank =
        trimmedEntries.findIndex(
            entry =>
                entry.walletAddress.toLowerCase() ===
                normalizedWallet.toLowerCase()
        ) + 1

    return {
        success: true,
        improved: true,
        entries: trimmedEntries,
        playerRank:
            playerRank > 0
                ? playerRank
                : -1,
        version:
            Number.isFinite(previousVersion)
                ? previousVersion + 1
                : 1,
        updatedAt: now
    }
}

export async function getChallengeLeaderboard(
    limit: number =
        MAX_LEADERBOARD_ENTRIES,
    playerWallet?: string
) {
    const safeLimit = clampLimit(
        limit
    )
    const state = await readDb<any>(
        CURRENT_CHALLENGE_PATH
    )

    if (!state) {
        return {
            entries: [],
            playerRank: -1,
            cycleIndex: -1,
            patternName: "unknown",
            version: 0,
            updatedAt: 0
        }
    }

    const stateCycleIndex = Number(
        state?.leaderboardMeta?.cycleIndex ??
            state?.leaderboardCycleIndex ??
            -1
    )
    const statePatternName =
        normalizePatternName(
            String(
                state?.leaderboardMeta
                    ?.patternName ||
                state?.leaderboardPatternName ||
                ""
            )
        )
    const version = Number(
        state?.leaderboardMeta?.version ??
            0
    )
    const updatedAt = Number(
        state?.leaderboardMeta?.updatedAt ??
            0
    )

    const entries = mapToSortedEntries(
        state?.leaderboardTop25
    ).slice(0, safeLimit)

    console.log(
        "[Leaderboard] get",
        {
            storedCycle: stateCycleIndex,
            storedPattern: statePatternName,
            entryCount: entries.length,
            version,
            updatedAt
        }
    )

    let normalizedPlayerWallet = ""

    if (
        typeof playerWallet ===
            "string" &&
        playerWallet.trim()
    ) {
        try {
            normalizedPlayerWallet =
                normalizeWalletAddress(
                    playerWallet
                ).toLowerCase()
        } catch {
            normalizedPlayerWallet = ""
        }
    }

    const playerRank =
        normalizedPlayerWallet
            ? entries.findIndex(
                  entry =>
                      entry.walletAddress.toLowerCase() ===
                      normalizedPlayerWallet
              ) + 1
            : -1

    return {
        entries,
        playerRank:
            playerRank > 0
                ? playerRank
                : -1,
        cycleIndex: stateCycleIndex,
        patternName: statePatternName,
        version:
            Number.isFinite(version) &&
            version > 0
                ? version
                : 0,
        updatedAt:
            Number.isFinite(updatedAt) &&
            updatedAt > 0
                ? updatedAt
                : 0
    }
}
