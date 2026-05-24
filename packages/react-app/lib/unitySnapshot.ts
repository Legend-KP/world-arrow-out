import type { UserSnapshot } from "./types"

import {
    normalizeWalletAddress
} from "./walletAddress"

function readBooleanField(
    source: Record<string, unknown> | null | undefined,
    ...keys: string[]
): boolean {
    if (!source) {
        return false
    }

    for (const key of keys) {
        if (key in source) {
            return !!source[key]
        }
    }

    return false
}

export function readTutorialCompleted(
    raw: Record<string, unknown> | null | undefined
): boolean {
    return readBooleanField(
        raw,
        "tutorialCompleted",
        "TutorialCompleted"
    )
}

export function readHasPurchasedGame(
    raw: Record<string, unknown> | null | undefined
): boolean {
    return readBooleanField(
        raw,
        "hasPurchasedGame",
        "HasPurchasedGame"
    )
}

/** Unity JsonUtility often expects PascalCase; Newtonsoft accepts camelCase. Send both. */
export function formatSnapshotForUnity(
    snapshot: UserSnapshot
) {
    const tutorialCompleted =
        !!snapshot.tutorialCompleted
    const hasPurchasedGame =
        !!snapshot.hasPurchasedGame

    return {
        walletAddress: snapshot.walletAddress,
        username: snapshot.username,
        hasPurchasedGame,
        HasPurchasedGame: hasPurchasedGame,
        hints: snapshot.hints,
        tutorialCompleted,
        TutorialCompleted: tutorialCompleted,
        classic: snapshot.classic,
        challenge: snapshot.challenge,
        universal: snapshot.universal
    }
}

export function normalizeIncomingSnapshot(
    snapshot: Record<string, unknown> | null | undefined
): UserSnapshot {
    const walletRaw =
        typeof snapshot?.walletAddress ===
        "string"
            ? snapshot.walletAddress.trim()
            : ""

    const walletAddress = walletRaw
        ? normalizeWalletAddress(walletRaw)
        : ""

    const classic =
        (snapshot?.classic as Record<
            string,
            unknown
        > | undefined) || {}
    const challenge =
        (snapshot?.challenge as Record<
            string,
            unknown
        > | undefined) || {}
    const universal =
        (snapshot?.universal as Record<
            string,
            unknown
        > | undefined) || {}

    return {
        walletAddress,
        username:
            typeof snapshot?.username ===
            "string" &&
            snapshot.username.trim()
                ? snapshot.username.trim()
                : "Player",
        hasPurchasedGame:
            readHasPurchasedGame(snapshot),
        hints: Math.max(
            0,
            Number(snapshot?.hints ?? 0)
        ),
        tutorialCompleted:
            readTutorialCompleted(snapshot),
        classic: {
            level: Math.max(
                1,
                Number(classic.level ?? 1)
            )
        },
        challenge: {
            chances: Math.max(
                0,
                Number(challenge.chances ?? 0)
            ),
            lastResetUnixMilliseconds:
                Number(
                    challenge.lastResetUnixMilliseconds ??
                    Date.now()
                ),
            streakCycleIndex:
                Number(
                    challenge.streakCycleIndex ?? 0
                ),
            streakMask: Math.max(
                0,
                Number(challenge.streakMask ?? 0)
            ),
            bestTimeSeconds:
                Number(
                    challenge.bestTimeSeconds ?? -1
                )
        },
        universal: {
            weeklyChallengeCycleIndex:
                Number(
                    universal.weeklyChallengeCycleIndex ??
                    0
                ),
            weeklyChallengeEndUnixMilliseconds:
                Number(
                    universal.weeklyChallengeEndUnixMilliseconds ??
                    0
                )
        }
    }
}
