export async function apiPost(
    url: string,
    body: Record<string, unknown>
) {
    const payload = JSON.stringify(body)

    if (payload === "{}") {
        throw new Error(
            `apiPost(${url}): request body is empty — check all fields are defined`
        )
    }

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: payload
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
        } catch {
            throw new Error(rawBody)
        }
    }

    return await res.json()
}
