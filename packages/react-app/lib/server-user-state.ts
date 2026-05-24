import "server-only"

import type { Address } from "viem"

import type {
    UniversalProgress,
    UserSnapshot
} from "./types"

import {
    getLegacyWalletDbKeys,
    normalizeWalletAddress
} from "./walletAddress"

import {
    readHasPurchasedGame,
    readTutorialCompleted
} from "./unitySnapshot"

import {
    readDb,
    writeDb,
    patchDb,
    deleteDb
} from "./firebase-server"

const DEFAULT_UNIVERSAL: UniversalProgress = {
    weeklyChallengeCycleIndex: 0,
    weeklyChallengeEndUnixMilliseconds: 0
}

const FREE_UNLOCK_HINT_REWARD = 5
const CHALLENGE_COOLDOWN_MS =
    24 * 60 * 60 * 1000
const DEFAULT_CHALLENGE_CHANCES = 1

function mergeStoredUserRecords(
    primary: Record<string, unknown>,
    secondary: Record<string, unknown>
) {
    const primaryChallenge =
        (primary.challenge as Record<
            string,
            unknown
        >) || {}
    const secondaryChallenge =
        (secondary.challenge as Record<
            string,
            unknown
        >) || {}

    const primaryClassic =
        (primary.classic as Record<
            string,
            unknown
        >) || {}
    const secondaryClassic =
        (secondary.classic as Record<
            string,
            unknown
        >) || {}

    const primaryBest = Number(
        primaryChallenge.bestTimeSeconds ?? -1
    )
    const secondaryBest = Number(
        secondaryChallenge.bestTimeSeconds ?? -1
    )

    let bestTimeSeconds = primaryBest

    if (
        secondaryBest >= 0 &&
        (primaryBest < 0 ||
            secondaryBest < primaryBest)
    ) {
        bestTimeSeconds = secondaryBest
    }

    return {
        username:
            (typeof primary.username ===
            "string" &&
            primary.username.trim()) ||
            (typeof secondary.username ===
            "string" &&
            secondary.username.trim()) ||
            "Player",
        hasPurchasedGame:
            readHasPurchasedGame(primary) ||
            readHasPurchasedGame(secondary),
        hints: Math.max(
            Number(primary.hints ?? 0),
            Number(secondary.hints ?? 0)
        ),
        tutorialCompleted:
            readTutorialCompleted(primary) ||
            readTutorialCompleted(secondary),
        classic: {
            level: Math.max(
                Number(
                    primaryClassic.level ?? 1
                ),
                Number(
                    secondaryClassic.level ?? 1
                )
            )
        },
        challenge: {
            chances: Math.min(
                Number(
                    primaryChallenge.chances ?? 0
                ),
                Number(
                    secondaryChallenge.chances ??
                    0
                )
            ),
            lastResetUnixMilliseconds:
                Math.max(
                    Number(
                        primaryChallenge.lastResetUnixMilliseconds ??
                        0
                    ),
                    Number(
                        secondaryChallenge.lastResetUnixMilliseconds ??
                        0
                    )
                ),
            streakCycleIndex:
                Math.max(
                    Number(
                        primaryChallenge.streakCycleIndex ??
                        0
                    ),
                    Number(
                        secondaryChallenge.streakCycleIndex ??
                        0
                    )
                ),
            streakMask:
                Number(
                    primaryChallenge.streakMask ??
                    0
                ) |
                Number(
                    secondaryChallenge.streakMask ??
                    0
                ),
            bestTimeSeconds
        }
    }
}

export function buildDefaultUserSnapshot(
    walletAddress: string,
    universal: UniversalProgress = DEFAULT_UNIVERSAL
): UserSnapshot {
    return {
        walletAddress,
        username: "Player",
        hasPurchasedGame: false,
        hints: 0,
        tutorialCompleted: false,
        classic: {
            level: 1
        },
        challenge: {
            chances: 1,
            lastResetUnixMilliseconds: Date.now(),
            streakCycleIndex: 0,
            streakMask: 0,
            bestTimeSeconds: -1
        },
        universal
    }
}

export function buildStoredUserRecord(
    snapshot: UserSnapshot
) {
    return {
        walletAddress: snapshot.walletAddress,
        username: snapshot.username,
        hasPurchasedGame: snapshot.hasPurchasedGame,
        hints: snapshot.hints,
        tutorialCompleted: snapshot.tutorialCompleted,
        classic: snapshot.classic,
        challenge: snapshot.challenge
    }
}

export function mergeSnapshot(
    walletAddress: string,
    raw: any,
    universal: UniversalProgress
): UserSnapshot {
    const base =
        buildDefaultUserSnapshot(
            walletAddress,
            universal
        )

    return {
        walletAddress,
        username:
            typeof raw?.username === "string" &&
            raw.username.trim()
                ? raw.username.trim()
                : base.username,
        hasPurchasedGame:
            readHasPurchasedGame(raw),
        hints:
            Math.max(
                0,
                Number(
                    raw?.hints ??
                    base.hints
                )
            ),
        tutorialCompleted:
            readTutorialCompleted(raw),
        classic: {
            level:
                Math.max(
                    1,
                    Number(
                        raw?.classic?.level ??
                        base.classic.level
                    )
                )
        },
        challenge: {
            chances:
                Math.max(
                    0,
                    Number(
                        raw?.challenge?.chances ??
                        base.challenge.chances
                    )
                ),
            lastResetUnixMilliseconds:
                Number(
                    raw?.challenge?.lastResetUnixMilliseconds ??
                    base.challenge.lastResetUnixMilliseconds
                ),
            streakCycleIndex:
                Number(
                    raw?.challenge?.streakCycleIndex ??
                    base.challenge.streakCycleIndex
                ),
            streakMask:
                Math.max(
                    0,
                    Number(
                        raw?.challenge?.streakMask ??
                        base.challenge.streakMask
                    )
                ),
            bestTimeSeconds:
                Number(
                    raw?.challenge?.bestTimeSeconds ??
                    base.challenge.bestTimeSeconds
                )
        },
        universal
    }
}

async function readMergedStoredUserRecord(
    wallet: string
) {
    const dbKeys =
        getLegacyWalletDbKeys(wallet)

    let mergedRaw:
        | Record<string, unknown>
        | null = null

    for (const key of dbKeys) {
        const raw =
            await readDb<
                Record<string, unknown>
            >(`users/${key}`)

        if (!raw) {
            continue
        }

        mergedRaw = mergedRaw
            ? mergeStoredUserRecords(
                mergedRaw,
                raw
            )
            : raw
    }

    return mergedRaw
}

function mergeBestTimeSeconds(
    incoming: number,
    stored: number
) {
    if (incoming < 0) {
        return stored
    }

    if (stored < 0) {
        return incoming
    }

    return Math.min(incoming, stored)
}

/** Counters that go down on use — sync must not Math.max with stored. */
function mergeDecreasingCounter(
    incoming: number,
    stored: number
) {
    const inc = Math.max(
        0,
        Number(incoming)
    )
    const st = Math.max(
        0,
        Number(stored)
    )

    if (inc <= st) {
        return inc
    }

    return st
}

function mergeHints(
    incoming: number,
    stored: number
) {
    return mergeDecreasingCounter(
        incoming,
        stored
    )
}

function mergeChances(
    incoming: number,
    stored: number
) {
    return mergeDecreasingCounter(
        incoming,
        stored
    )
}

export function applyChallengeDailyReset(
    challenge: UserSnapshot["challenge"]
): UserSnapshot["challenge"] {
    const now = Date.now()
    const lastReset = Number(
        challenge.lastResetUnixMilliseconds || 0
    )

    if (
        now - lastReset <
        CHALLENGE_COOLDOWN_MS
    ) {
        return challenge
    }

    return {
        ...challenge,
        chances: DEFAULT_CHALLENGE_CHANCES,
        lastResetUnixMilliseconds: now
    }
}

function mergeIncomingSnapshotWithStored(
    incoming: UserSnapshot,
    stored: UserSnapshot | null
): UserSnapshot {
    if (!stored) {
        return incoming
    }

    return {
        ...incoming,
        hasPurchasedGame:
            incoming.hasPurchasedGame ||
            stored.hasPurchasedGame,
        tutorialCompleted:
            incoming.tutorialCompleted ||
            stored.tutorialCompleted,
        hints: mergeHints(
            incoming.hints,
            stored.hints
        ),
        classic: {
            level: Math.max(
                incoming.classic.level,
                stored.classic.level
            )
        },
        challenge: {
            chances: mergeChances(
                incoming.challenge.chances,
                stored.challenge.chances
            ),
            lastResetUnixMilliseconds:
                Math.max(
                    incoming.challenge
                        .lastResetUnixMilliseconds,
                    stored.challenge
                        .lastResetUnixMilliseconds
                ),
            streakCycleIndex: Math.max(
                incoming.challenge.streakCycleIndex,
                stored.challenge.streakCycleIndex
            ),
            streakMask:
                Number(
                    incoming.challenge.streakMask
                ) |
                Number(
                    stored.challenge.streakMask
                ),
            bestTimeSeconds:
                mergeBestTimeSeconds(
                    incoming.challenge
                        .bestTimeSeconds,
                    stored.challenge
                        .bestTimeSeconds
                )
        }
    }
}

export async function getUniversalSnapshot() {
    const snapshot =
        await readDb<any>(
            "universal/currentChallenge"
        )

    const weeklyChallengeCycleIndex =
        Number(
            snapshot?.weeklyChallengeCycleIndex ??
            DEFAULT_UNIVERSAL.weeklyChallengeCycleIndex
        )
    const weeklyChallengeEndUnixMilliseconds =
        Number(
            snapshot?.weeklyChallengeEndUnixMilliseconds ??
            DEFAULT_UNIVERSAL.weeklyChallengeEndUnixMilliseconds
        )

    if (!snapshot) {
        await patchDb(
            "universal/currentChallenge",
            DEFAULT_UNIVERSAL
        )

        return DEFAULT_UNIVERSAL
    }

    if (
        snapshot.weeklyChallengeCycleIndex ===
            undefined &&
        snapshot.weeklyChallengeEndUnixMilliseconds ===
            undefined
    ) {
        await patchDb(
            "universal/currentChallenge",
            DEFAULT_UNIVERSAL
        )
    }

    return {
        weeklyChallengeCycleIndex,
        weeklyChallengeEndUnixMilliseconds
    }
}

export async function getOrCreateUserSnapshot(
    wallet: Address | string
) {
    const canonicalWallet =
        normalizeWalletAddress(
            wallet as string
        )

    const universal =
        await getUniversalSnapshot()

    const dbKeys =
        getLegacyWalletDbKeys(
            canonicalWallet
        )

    let mergedRaw:
        | Record<string, unknown>
        | null = null
    const keysToDelete: string[] =
        []

    for (const key of dbKeys) {
        const raw =
            await readDb<
                Record<string, unknown>
            >(`users/${key}`)

        if (!raw) {
            continue
        }

        mergedRaw = mergedRaw
            ? mergeStoredUserRecords(
                mergedRaw,
                raw
            )
            : raw

        if (key !== canonicalWallet) {
            keysToDelete.push(key)
        }
    }

    if (!mergedRaw) {
        const user =
            buildDefaultUserSnapshot(
                canonicalWallet,
                universal
            )

        await writeDb(
            `users/${canonicalWallet}`,
            buildStoredUserRecord(user)
        )
        await deleteDb(
            `users/${canonicalWallet}/universal`
        )

        return user
    }

    let user =
        mergeSnapshot(
            canonicalWallet,
            mergedRaw,
            universal
        )

    const resetChallenge =
        applyChallengeDailyReset(
            user.challenge
        )
    const didResetChallenge =
        resetChallenge.chances !==
            user.challenge.chances ||
        resetChallenge.lastResetUnixMilliseconds !==
            user.challenge.lastResetUnixMilliseconds

    if (didResetChallenge) {
        user = {
            ...user,
            challenge: resetChallenge
        }
    }

    const hasLegacyFields =
        Object.prototype.hasOwnProperty.call(
            mergedRaw,
            "revives"
        ) ||
        Object.prototype.hasOwnProperty.call(
            mergedRaw,
            "lives"
        ) ||
        Object.prototype.hasOwnProperty.call(
            mergedRaw,
            "universal"
        )

    const shouldPersist =
        keysToDelete.length > 0 ||
        hasLegacyFields ||
        didResetChallenge

    if (shouldPersist) {
        await writeDb(
            `users/${canonicalWallet}`,
            buildStoredUserRecord(user)
        )

        for (const key of keysToDelete) {
            await deleteDb(`users/${key}`)
            await deleteDb(
                `users/${key}/universal`
            )
        }

        await deleteDb(
            `users/${canonicalWallet}/universal`
        )
    }

    return user
}

export function sanitizeSnapshot(
    snapshot: UserSnapshot
): UserSnapshot {
    const walletAddress =
        snapshot.walletAddress
            ? normalizeWalletAddress(
                snapshot.walletAddress
            )
            : ""

    return {
        walletAddress,
        username:
            snapshot.username || "Player",
        hasPurchasedGame:
            readHasPurchasedGame(
                snapshot as unknown as Record<
                    string,
                    unknown
                >
            ),
        hints:
            Math.max(
                0,
                Number(snapshot.hints || 0)
            ),
        tutorialCompleted:
            readTutorialCompleted(
                snapshot as unknown as Record<
                    string,
                    unknown
                >
            ),
        classic: {
            level: Math.max(
                1,
                Number(snapshot.classic?.level || 1)
            )
        },
        challenge: {
            chances: Math.max(
                0,
                Number(snapshot.challenge?.chances || 0)
            ),
            lastResetUnixMilliseconds:
                Number(
                    snapshot.challenge?.lastResetUnixMilliseconds ||
                    Date.now()
                ),
            streakCycleIndex:
                Number(
                    snapshot.challenge?.streakCycleIndex || 0
                ),
            streakMask:
                Math.max(
                    0,
                    Number(snapshot.challenge?.streakMask || 0)
                ),
            bestTimeSeconds:
                Number(
                    snapshot.challenge?.bestTimeSeconds || -1
                )
        },
        universal: {
            weeklyChallengeCycleIndex:
                Number(
                    snapshot.universal?.weeklyChallengeCycleIndex || 0
                ),
            weeklyChallengeEndUnixMilliseconds:
                Number(
                    snapshot.universal?.weeklyChallengeEndUnixMilliseconds ||
                    0
                )
        }
    }
}

export async function bootstrapUserSnapshot(
    walletAddress: string
) {
    return await getOrCreateUserSnapshot(
        walletAddress as Address
    )
}

export async function syncUserSnapshot(
    snapshot: UserSnapshot
) {
    const cleanSnapshot =
        sanitizeSnapshot(snapshot)

    const universal =
        await getUniversalSnapshot()

    const storedRaw =
        await readMergedStoredUserRecord(
            cleanSnapshot.walletAddress
        )

    const storedSnapshot = storedRaw
        ? mergeSnapshot(
            cleanSnapshot.walletAddress,
            storedRaw,
            universal
        )
        : null

    const mergedSnapshot = mergeIncomingSnapshotWithStored(
        {
            ...cleanSnapshot,
            universal
        },
        storedSnapshot
    )

    await writeDb(
        `users/${mergedSnapshot.walletAddress}`,
        buildStoredUserRecord(mergedSnapshot)
    )
    await deleteDb(
        `users/${mergedSnapshot.walletAddress}/universal`
    )

    return mergedSnapshot
}

export async function completeGamePurchase(
    walletAddress: string
) {
    const user =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const snapshot = {
        ...user,
        hasPurchasedGame: true,
        hints:
            user.hasPurchasedGame
                ? user.hints
                : user.hints + FREE_UNLOCK_HINT_REWARD
    }

    await writeDb(
        `users/${wallet}`,
        buildStoredUserRecord(snapshot)
    )
    await deleteDb(
        `users/${wallet}/universal`
    )

    return {
        success: true,
        snapshot
    }
}

export async function completeHintPurchase(
    walletAddress: string,
    amount: number
) {
    const user =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const hints =
        user.hints + Math.max(0, amount)

    const snapshot = {
        ...user,
        hints
    }

    await writeDb(
        `users/${wallet}`,
        buildStoredUserRecord(snapshot)
    )
    await deleteDb(
        `users/${wallet}/universal`
    )

    return {
        success: true,
        snapshot
    }
}

export async function completeRevivePurchase(
    walletAddress: string
) {
    const snapshot =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    return {
        success: true,
        snapshot
    }
}

export async function recordChallengePlay(
    walletAddress: string,
    completionSeconds: number,
    chancesAfterPlay?: number
) {
    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const user =
        await getOrCreateUserSnapshot(
            wallet
        )

    let challenge =
        applyChallengeDailyReset(
            user.challenge
        )

    const hasExplicitChances =
        typeof chancesAfterPlay ===
        "number" &&
        Number.isFinite(chancesAfterPlay)

    const nextChances = hasExplicitChances
        ? Math.max(
            0,
            Math.floor(chancesAfterPlay)
        )
        : challenge.chances - 1

    if (
        !hasExplicitChances &&
        challenge.chances <= 0
    ) {
        return {
            success: false,
            error: "No chances left",
            snapshot: {
                ...user,
                challenge
            }
        }
    }

    if (nextChances < 0) {
        return {
            success: false,
            error: "No chances left",
            snapshot: {
                ...user,
                challenge
            }
        }
    }

    challenge = {
        ...challenge,
        chances: nextChances,
        bestTimeSeconds:
            mergeBestTimeSeconds(
                Number(completionSeconds),
                challenge.bestTimeSeconds
            )
    }

    const snapshot = {
        ...user,
        challenge
    }

    await writeDb(
        `users/${wallet}`,
        buildStoredUserRecord(snapshot)
    )
    await deleteDb(
        `users/${wallet}/universal`
    )

    return {
        success: true,
        snapshot
    }
}
