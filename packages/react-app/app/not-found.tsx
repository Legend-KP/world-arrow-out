import Link from "next/link";

export default function NotFound() {
    return (
        <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
            <h1>Page not found</h1>
            <p>
                <Link href="/">Return to the game</Link>
            </p>
        </main>
    );
}
