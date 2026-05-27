export async function apiPost(
    url: string,
    body: Record<string, unknown> = {}
) {
    const cleaned = Object.fromEntries(
        Object.entries(body).filter(
            ([, value]) => value !== undefined
        )
    )

    if (
        Object.keys(body).length > 0 &&
        Object.keys(cleaned).length === 0
    ) {
        throw new Error(
            `apiPost(${url}): request body is empty — check all fields are defined`
        )
    }

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(cleaned)
    })

    if (!res.ok) {
        const rawBody =
            await res.text()

        try {
            const parsed =
                JSON.parse(rawBody)

            throw new Error(
                parsed?.error ||
                parsed?.message ||
                rawBody
            )
        } catch (error) {
            if (error instanceof Error) {
                throw error
            }

            throw new Error(rawBody)
        }
    }

    return await res.json()
}
