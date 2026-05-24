import "server-only"

export function getPublicAppId(): string {
    return (
        process.env.NEXT_PUBLIC_APP_ID ||
        process.env.APP_ID ||
        process.env.WORLD_APP_ID ||
        ""
    ).trim()
}
