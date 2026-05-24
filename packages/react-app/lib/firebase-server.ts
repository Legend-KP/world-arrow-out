import "server-only"

import {
    getFirebaseAccessToken
} from "./firebase-auth"

function normalizeDatabaseUrl(
    rawUrl?: string
) {
    if (!rawUrl)
        return undefined

    const trimmed =
        rawUrl.trim().replace(/\/+$/, "")

    try {
        const url =
            new URL(trimmed)

        if (
            /firebaseio\.com$/i.test(
                url.hostname
            ) ||
            /firebasedatabase\.app$/i.test(
                url.hostname
            )
        ) {
            url.pathname = "/"
            url.search = ""
            url.hash = ""
            return url
                .toString()
                .replace(/\/$/, "")
        }
    } catch {
    }

    return trimmed
}

const databaseUrl =
    normalizeDatabaseUrl(
        process.env.FIREBASE_DATABASE_URL ||
        process.env
            .NEXT_PUBLIC_FIREBASE_DATABASE_URL
    )

async function buildDbUrl(
    path: string
) {
    if (!databaseUrl) {
        throw new Error(
            "Firebase database URL is missing. Set NEXT_PUBLIC_FIREBASE_DATABASE_URL or FIREBASE_DATABASE_URL."
        )
    }

    const normalizedPath =
        path
            .replace(/^\/+/, "")
            .replace(/\/+$/, "")

    const url = new URL(
        normalizedPath
            ? `${databaseUrl}/${normalizedPath}.json`
            : `${databaseUrl}/.json`
    )

    const auth =
        await getFirebaseAccessToken()

    if (!auth) {
        throw new Error(
            "Firebase credentials are missing. Set FIREBASE_DATABASE_SECRET on Cloudflare, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY."
        )
    }

    if (auth.kind === "legacy_secret") {
        url.searchParams.set(
            "auth",
            auth.value
        )
    } else {
        url.searchParams.set(
            "access_token",
            auth.value
        )
    }

    return url.toString()
}

async function requestJson<T>(
    method: string,
    path: string,
    body?: unknown
) {
    const response =
        await fetch(
            await buildDbUrl(path),
            {
                method,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    body === undefined
                        ? undefined
                        : JSON.stringify(body),
                cache: "no-store"
            }
        )

    if (!response.ok) {
        const rawBody =
            await response.text()

        if (response.status === 401) {
            throw new Error(
                "Firebase permission denied. Regenerate FIREBASE_DATABASE_SECRET in Firebase Console (Realtime Database → Settings) and set it as a Cloudflare secret, then redeploy."
            )
        }

        throw new Error(
            `Firebase ${method} ${path} failed with ${response.status}: ${rawBody}`
        )
    }

    if (
        response.status === 204 ||
        response.headers.get(
            "content-length"
        ) === "0"
    ) {
        return null as T
    }

    return await response.json() as T
}

export async function readDb<T>(
    path: string
) {
    return await requestJson<T>(
        "GET",
        path
    )
}

export async function writeDb(
    path: string,
    value: unknown
) {
    return await requestJson(
        "PUT",
        path,
        value
    )
}

export async function patchDb(
    path: string,
    value: unknown
) {
    return await requestJson(
        "PATCH",
        path,
        value
    )
}

export async function deleteDb(
    path: string
) {
    return await requestJson(
        "DELETE",
        path
    )
}
