"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import songsData from "@/songs.json";

interface Song {
    title: string;
    lyrics: string;
}

const allSongs: Song[] = songsData;

export default function HomePage() {
    const [search, setSearch] = useState("");

    const filteredSongs = useMemo(() => {
        return allSongs.filter((song) =>
            song.title.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    return (
        <main className="page">
            {/* Header */}
            <header className="app-header">
                <h1 className="app-title">Thanima Jam</h1>
                <Link href="/live" className="live-link-premium">
                    <span className="live-dot"></span>
                    GO TO LIVE SESSION ✨
                </Link>
            </header>

            <div className="admin-scroll-container">
                {/* Hero / Search */}
                <div className="hero-section">
                    <h2 className="hero-title">Song Library</h2>
                    <div className="search-wrapper">
                        <input
                            type="text"
                            placeholder="Search songs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Song List */}
                <div className="song-grid">
                    {filteredSongs.map((song, i) => (
                        <Link
                            key={i}
                            href={`/view/${encodeURIComponent(song.title)}`}
                            className="song-item-card"
                        >
                            <div className="song-item-thumb">♪</div>
                            <div className="song-item-info">
                                <p className="song-item-title">{song.title}</p>
                                <p className="song-item-subtitle">View lyrics</p>
                            </div>
                            <span className="song-item-arrow">→</span>
                        </Link>
                    ))}
                </div>
            </div>
        </main>
    );
}
