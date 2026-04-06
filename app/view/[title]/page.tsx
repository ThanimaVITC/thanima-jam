import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Song {
    title: string;
    lyrics: string;
}

export default async function SongViewPage({
    params,
}: {
    params: Promise<{ title: string }>;
}) {
    const { title } = await params;
    const decodedTitle = decodeURIComponent(title);

    // Load songs from songs.json
    const songsPath = path.join(process.cwd(), "songs.json");
    const songs: Song[] = JSON.parse(fs.readFileSync(songsPath, "utf-8"));

    const song = songs.find((s) => s.title === decodedTitle);

    if (!song) {
        notFound();
    }

    return (
        <main className="page">
            {/* Header */}
            <header className="app-header">
                <Link href="/" className="admin-back-link">
                    ← Back to library
                </Link>
                <h2 className="app-title">Lyrics</h2>
            </header>

            {/* Now Playing Bar style for the title */}
            <div className="now-playing-bar static-view-bar">
                <div className="album-art">
                    <div className="album-art-icon">♪</div>
                </div>
                <div className="now-playing-info">
                    <span className="now-playing-label">Viewing</span>
                    <h1 className="now-playing-title">{song.title}</h1>
                </div>
            </div>

            {/* Lyrics Container */}
            <div className="lyrics-container static-lyrics">
                <div className="lyrics-inner">
                    {song.lyrics.split("\n").map((line, i) => (
                        <p
                            key={i}
                            className={`lyrics-line ${line.trim() === "" ? "lyrics-break" : ""
                                }`}
                        >
                            {line || "\u00A0"}
                        </p>
                    ))}
                </div>
            </div>

            {/* Footer hint */}
            <footer className="home-footer">
                <p className="empty-subtitle">Enjoy the jam!</p>
            </footer>
        </main>
    );
}
