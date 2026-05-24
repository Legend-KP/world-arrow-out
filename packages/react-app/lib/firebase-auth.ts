import "server-only"

function normalizePrivateKey(
    rawKey?: string
) {
    if (!rawKey) {
        return undefined
    }

    let privateKey = rawKey.trim()

    if (
        privateKey.startsWith('"') &&
        privateKey.endsWith('"')
    ) {
        privateKey = privateKey.slice(1, -1)
    }

    return privateKey.replace(/\\n/g, "\n")
}

let cachedAccessToken:
    | {
        token: string
        expiresAt: number
    }
    | null = null

async function getServiceAccountToken(
    clientEmail: string,
    privateKey: string
) {
    if (
        cachedAccessToken &&
        cachedAccessToken.expiresAt >
        Date.now() + 60_000
    ) {
        return {
            kind: "access_token" as const,
            value: cachedAccessToken.token
        }
    }

    const { SignJWT, importPKCS8 } =
        await import("jose")

    const key = await importPKCS8(
        privateKey,
        "RS256"
    )

    const jwt = await new SignJWT({
        scope:
            "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email"
    })
        .setProtectedHeader({
            alg: "RS256",
            typ: "JWT"
        })
        .setIssuedAt()
        .setExpirationTime("1h")
        .setIssuer(clientEmail)
        .setSubject(clientEmail)
        .setAudience(
            "https://oauth2.googleapis.com/token"
        )
        .sign(key)

    const response = await fetch(
        "https://oauth2.googleapis.com/token",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type:
                    "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt
            }),
            cache: "no-store"
        }
    )

    const payload =
        await response.json()

    if (
        !response.ok ||
        !payload.access_token
    ) {
        throw new Error(
            payload.error_description ||
            payload.error ||
            "Could not authenticate with Firebase service account"
        )
    }

    cachedAccessToken = {
        token: payload.access_token,
        expiresAt:
            Date.now() +
            Number(payload.expires_in || 3600) *
            1000
    }

    return {
        kind: "access_token" as const,
        value: payload.access_token
    }
}

export async function getFirebaseAccessToken() {
    const clientEmail =
        process.env.FIREBASE_CLIENT_EMAIL

    const privateKey =
        normalizePrivateKey(
            process.env.FIREBASE_PRIVATE_KEY
        )

    if (clientEmail && privateKey) {
        try {
            return await getServiceAccountToken(
                clientEmail,
                privateKey
            )
        } catch (error) {
            console.warn(
                "Firebase service account auth failed",
                error
            )
        }
    }

    const databaseSecret =
        process.env.FIREBASE_DATABASE_SECRET

    if (databaseSecret) {
        return {
            kind: "legacy_secret" as const,
            value: databaseSecret
        }
    }

    return null
}
