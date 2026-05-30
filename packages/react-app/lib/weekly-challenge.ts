/** Display names rotated by `weeklyChallengeCycleIndex` (Unity fallback list). */
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

/**
 * Must match Unity `ChallengeSceneController.challengePatternNames` order exactly.
 * Index = `weeklyChallengeCycleIndex % length`.
 */
export const WEEKLY_CHALLENGE_PATTERN_NAMES = [
    "Cow",
    "Heart",
    "Leaf",
    "Star",
    "Octagon",
    "Wolf",
    "Semi-Circle",
    "Apple",
    "Sun",
    "Guitar pick",
    "Arrow",
    "Glass",
    "Diamond",
    "Dog",
    "Butterfly",
    "Cloud",
    "X",
    "Triangle",
    "Spades",
    "Pentagon",
    "Hexagon",
    "Bat",
    "Ninja Star",
    "Flag",
    "Flower",
    "Leaf2",
    "Plane",
    "Human",
    "Energy",
    "Flame",
    "Call",
    "Tree",
    "Video",
    "Mountains"
] as const

export function getWeeklyPatternNameForCycle(
    cycleIndex: number
) {
    const safeCycle = Math.max(
        0,
        Math.floor(Number(cycleIndex) || 0)
    )
    const patternCount =
        WEEKLY_CHALLENGE_PATTERN_NAMES.length

    return WEEKLY_CHALLENGE_PATTERN_NAMES[
        safeCycle % patternCount
    ]
}

function parseCycleIndex(
    value: unknown
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null
    }

    const numericValue = Number(value)

    return Number.isFinite(numericValue)
        ? Math.floor(numericValue)
        : null
}

/** Prefer universal weekly fields; fall back to legacy leaderboard columns. */
export function resolveChallengeCycleAndPattern(
    storedState: Record<string, unknown> | null | undefined
) {
    const weeklyCycle = parseCycleIndex(
        storedState?.weeklyChallengeCycleIndex
    )

    if (weeklyCycle !== null && weeklyCycle >= 0) {
        const weeklyPatternRaw =
            storedState?.weeklyChallengePatternName
        const displayPattern =
            typeof weeklyPatternRaw === "string" &&
            weeklyPatternRaw.trim()
                ? weeklyPatternRaw.trim()
                : getWeeklyPatternNameForCycle(
                      weeklyCycle
                  )

        return {
            cycleIndex: weeklyCycle,
            patternName:
                normalizePatternName(
                    displayPattern
                ),
            displayPatternName:
                displayPattern
        }
    }

    const leaderboardCycle = parseCycleIndex(
        storedState?.leaderboardCycleIndex
    )
    const leaderboardMeta = storedState?.leaderboardMeta as
        | Record<string, unknown>
        | undefined
    const metaCycle = parseCycleIndex(
        leaderboardMeta?.cycleIndex
    )
    const resolvedCycle =
        leaderboardCycle ?? metaCycle

    const patternRaw =
        (typeof storedState?.leaderboardPatternName ===
            "string" &&
            storedState.leaderboardPatternName) ||
        (typeof leaderboardMeta?.patternName ===
            "string" &&
            leaderboardMeta.patternName) ||
        ""

    if (
        resolvedCycle !== null &&
        resolvedCycle >= 0 &&
        patternRaw.trim()
    ) {
        const displayPattern =
            patternRaw.trim()
        return {
            cycleIndex: resolvedCycle,
            patternName:
                normalizePatternName(
                    displayPattern
                ),
            displayPatternName:
                displayPattern
        }
    }

    const cycleIndex = 0
    const displayPattern =
        getWeeklyPatternNameForCycle(
            cycleIndex
        )

    return {
        cycleIndex,
        patternName:
            normalizePatternName(
                displayPattern
            ),
        displayPatternName:
            displayPattern
    }
}

export function buildUniversalChallengeDbPatch(
    cycleIndex: number,
    weekEndUnixMilliseconds: number,
    options: {
        clearLeaderboard?: boolean
        previousVersion?: number
    } = {}
) {
    const displayPatternName =
        getWeeklyPatternNameForCycle(
            cycleIndex
        )
    const normalizedPatternName =
        normalizePatternName(
            displayPatternName
        )
    const now = Date.now()
    const previousVersion = Number(
        options.previousVersion ?? 0
    )

    const patch: Record<string, unknown> = {
        weeklyChallengeCycleIndex:
            cycleIndex,
        weeklyChallengeEndUnixMilliseconds:
            weekEndUnixMilliseconds,
        weeklyChallengePatternName:
            displayPatternName,
        leaderboardCycleIndex:
            cycleIndex,
        leaderboardPatternName:
            normalizedPatternName,
        "leaderboardMeta/cycleIndex":
            cycleIndex,
        "leaderboardMeta/patternName":
            normalizedPatternName,
        "leaderboardMeta/updatedAt":
            now
    }

    if (options.clearLeaderboard) {
        patch.leaderboardTop25 = {}
        patch["leaderboardMeta/version"] =
            Number.isFinite(previousVersion) &&
            previousVersion > 0
                ? previousVersion + 1
                : 1
    }

    return {
        patch,
        displayPatternName,
        normalizedPatternName
    }
}

export function validateClientChallengeCycleAndPattern(
    body: {
        cycleIndex?: unknown
        patternName?: unknown
    },
    authoritative: {
        cycleIndex: number
        patternName: string
    }
) {
    const clientCycle = parseCycleIndex(
        body.cycleIndex
    )
    const clientPattern =
        typeof body.patternName ===
            "string" &&
        body.patternName.trim()
            ? normalizePatternName(
                  body.patternName
              )
            : null

    if (
        clientCycle !== null &&
        clientPattern &&
        clientCycle ===
            authoritative.cycleIndex &&
        clientPattern ===
            authoritative.patternName
    ) {
        return authoritative
    }

    if (
        clientCycle !== null &&
        clientCycle !==
            authoritative.cycleIndex
    ) {
        console.warn(
            "[WeeklyChallenge] client cycle mismatch; using server",
            {
                clientCycle,
                serverCycle:
                    authoritative.cycleIndex
            }
        )
    }

    if (
        clientPattern &&
        clientPattern !==
            authoritative.patternName
    ) {
        console.warn(
            "[WeeklyChallenge] client pattern mismatch; using server",
            {
                clientPattern,
                serverPattern:
                    authoritative.patternName
            }
        )
    }

    return authoritative
}
