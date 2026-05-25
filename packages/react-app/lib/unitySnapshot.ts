import type { UserSnapshot } from "./types"

import {
    normalizeWalletAddress
} from "./walletAddress"

const TUTORIAL_COMPLETED_KEYS = [
    "tutorialCompleted",
    "TutorialCompleted",
    "tutorial_done",
    "TutorialDone",
    "isTutorialCompleted",
    "IsTutorialCompleted",
    "hasCompletedTutorial",
    "HasCompletedTutorial"
] as const

function parseBooleanish(
    value: unknown
): boolean {
    if (
        value === true ||
        value === 1
    ) {
        return true
    }

    if (
        value === false ||
        value === 0 ||
        value === null ||
        value === undefined
    ) {
        return false
    }

    if (typeof value === "string") {
        const lower =
            value.trim().toLowerCase()

        return (
            lower === "true" ||
            lower === "1" ||
            lower === "yes"
        )
    }

    return !!value
}

function readBooleanField(
    source: Record<string, unknown> | null | undefined,
    ...keys: string[]
): boolean {
    if (!source) {
        return false
    }

    for (const key of keys) {
        if (key in source) {
            return parseBooleanish(
                source[key]
            )
        }
    }

    return false
}

function asRecord(
    value: unknown
): Record<string, unknown> | null {
    if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return null
    }

    return value as Record<string, unknown>
}

export function readTutorialCompleted(
    raw: Record<string, unknown> | null | undefined
): boolean {
    return readBooleanField(
        raw,
        ...TUTORIAL_COMPLETED_KEYS
    )
}

export function extractTutorialCompletedFromPayload(
    payload: unknown
): boolean {
    const root = asRecord(payload)

    if (!root) {
        return false
    }

    const nested = [
        root,
        asRecord(root.userState),
        asRecord(root.snapshot),
        asRecord(root.data),
        asRecord(root.state)
    ].filter(
        (entry): entry is Record<string, unknown> =>
            !!entry
    )

    for (const entry of nested) {
        if (readTutorialCompleted(entry)) {
            return true
        }
    }

    return (
        parseBooleanish(
            root.completeTutorial
        ) ||
        parseBooleanish(
            root.markTutorialComplete
        )
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

/** Unity JsonUtility often expects PascalCase or 0/1 ints. */
export function formatSnapshotForUnity(
    snapshot: UserSnapshot
) {
    const tutorialCompleted =
        !!snapshot.tutorialCompleted
    const hasPurchasedGame =
        !!snapshot.hasPurchasedGame
    const tutorialFlag = tutorialCompleted
        ? 1
        : 0

    return {
        walletAddress: snapshot.walletAddress,
        username: snapshot.username,
        hasPurchasedGame,
        HasPurchasedGame: hasPurchasedGame,
        hints: snapshot.hints,
        tutorialCompleted,
        TutorialCompleted: tutorialCompleted,
        tutorial_completed: tutorialCompleted,
        tutorialCompletedInt: tutorialFlag,
        TutorialCompletedInt: tutorialFlag,
        classic: snapshot.classic,
        challenge: snapshot.challenge,
        universal: snapshot.universal
    }
}

export function sendTutorialStatusToUnity(
    sendToUnity: (
        method: string,
        payload?: unknown
    ) => void,
    tutorialCompleted: boolean
) {
    const flag = tutorialCompleted
        ? "true"
        : "false"
    const intFlag = tutorialCompleted
        ? "1"
        : "0"

    sendToUnity(
        "OnTutorialCompleted",
        flag
    )
    sendToUnity(
        "OnTutorialStatus",
        intFlag
    )
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

    const tutorialCompleted =
        extractTutorialCompletedFromPayload(
            snapshot
        )

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
        tutorialCompleted,
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
