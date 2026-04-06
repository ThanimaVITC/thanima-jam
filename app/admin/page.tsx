"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, set, get } from "firebase/database";
import Link from "next/link";
import songsData from "@/songs.json";

const ADMIN_PASSWORD = "thanima2026";

interface Song {
    title: string;
    lyrics: string;
}

interface AppState {
    currentSong: Song | null;
    queue: Song[];
}

interface PollData {
    options: string[];
    counts: number[];
    totalVotes: number;
    active: boolean;
}

export default function AdminPage() {
    const [authed, setAuthed] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined" && sessionStorage.getItem("admin_auth") === "true") {
            setAuthed(true);
        }
    }, []);

    function handleLogin() {
        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem("admin_auth", "true");
            setAuthed(true);
            setError("");
        } else {
            setError("Wrong password");
        }
    }

    if (!authed) {
        return (
            <main className="page">
                <div className="login-card">
                    <h2 className="login-title">Admin Access</h2>
                    <p className="login-subtitle">Enter the password to continue</p>
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        className="admin-input"
                        autoFocus
                    />
                    {error && <p className="admin-warning">{error}</p>}
                    <button onClick={handleLogin} className="btn-primary login-btn">
                        Enter
                    </button>
                </div>
            </main>
        );
    }

    return <AdminPanel />;
}

function AdminPanel() {
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [localQueue, setLocalQueue] = useState<Song[]>([]);
    const [pollData, setPollData] = useState<PollData | null>(null);
    const [pollSelections, setPollSelections] = useState<string[]>([]);
    const [isPollMinimized, setIsPollMinimized] = useState(false);

    const safeArray = useCallback(<T,>(val: any): T[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.values(val) as T[];
        return [];
    }, []);

    useEffect(() => {
        const stateRef = ref(db, "state");
        const pollRef = ref(db, "poll");

        const unsubs = [
            onValue(stateRef, (snapshot) => {
                const data = snapshot.val();
                if (data && typeof data === 'object') {
                    setCurrentSong(data.currentSong || null);
                    setLocalQueue(safeArray<Song>(data.queue));
                } else if (data === null) {
                    setCurrentSong(null);
                    setLocalQueue([]);
                }
            }),
            onValue(pollRef, (snapshot) => {
                const data = snapshot.val();
                setPollData(data && typeof data === 'object' ? data : null);
            })
        ];

        return () => unsubs.forEach(u => u());
    }, []);

    const updateState = useCallback(async (updates: Partial<AppState>) => {
        const stateRef = ref(db, "state");
        const snapshot = await get(stateRef);
        const currentState = snapshot.val() || { currentSong: null, queue: [] };
        await set(stateRef, { ...currentState, ...updates });
    }, []);

    const allSongs: Song[] = safeArray<Song>(songsData);
    const availableSongs = allSongs.filter((song) => {
        const queue = safeArray<Song>(localQueue);
        const inQueue = queue.some((q) => q.title === song.title);
        const isCurrent = currentSong?.title === song.title;
        return !inQueue && !isCurrent;
    });

    async function handleNextSong() {
        const newQueue = [...localQueue];
        const next = newQueue.shift() || null;
        await updateState({ currentSong: next, queue: newQueue });
    }

    async function handleAddToQueue(song: Song) {
        await updateState({ queue: [...localQueue, song] });
    }

    async function handleRemoveFromQueue(index: number) {
        const newQueue = localQueue.filter((_, i) => i !== index);
        await updateState({ queue: newQueue });
    }

    async function handleMoveUp(index: number) {
        if (index === 0) return;
        const q = [...localQueue];
        [q[index - 1], q[index]] = [q[index], q[index - 1]];
        await updateState({ queue: q });
    }

    async function handleMoveDown(index: number) {
        if (!localQueue || index >= localQueue.length - 1) return;
        const q = [...localQueue];
        [q[index], q[index + 1]] = [q[index + 1], q[index]];
        await updateState({ queue: q });
    }

    // Poll helpers
    function togglePollSelection(title: string) {
        setPollSelections((p) => {
            const prev = safeArray<string>(p);
            return prev.includes(title)
                ? prev.filter((t) => t !== title)
                : prev.length < 4
                    ? [...prev, title]
                    : prev;
        });
    }

    async function handleCreatePoll() {
        if (pollSelections.length < 2) return;
        const options = pollSelections;
        const pollRef = ref(db, "poll");
        await set(pollRef, {
            options,
            counts: new Array(options.length).fill(0),
            totalVotes: 0,
            active: true
        });
        setPollSelections([]);
    }

    async function handleEndPoll() {
        if (!pollData || !pollData.active) return;

        // Tally results and find winner
        const counts = Array.isArray(pollData.counts) ? pollData.counts : [];
        const maxVotes = counts.length > 0 ? Math.max(...counts) : 0;
        const winnerIdx = counts.indexOf(maxVotes);
        const winnerTitle = (pollData.options || [])[winnerIdx];
        const winnerSong = allSongs.find(s => s.title === winnerTitle);

        if (winnerSong) {
            const alreadyInQueue = localQueue.some(s => s.title === winnerSong.title);
            if (!alreadyInQueue) {
                await updateState({ queue: [...localQueue, winnerSong] });
            }
        }

        const pollRef = ref(db, "poll");
        await set(pollRef, { ...pollData, active: false });
    }

    async function handleClearPoll() {
        await set(ref(db, "poll"), null);
    }

    const countsArray = pollData ? safeArray<number>(pollData.counts) : [];
    const maxVote = countsArray.length > 0 ? Math.max(...countsArray, 1) : 1;

    return (
        <main className="page">
            <header className="app-header">
                <h2 className="app-title">Admin Panel</h2>
                <div className="admin-header-links">
                    <Link href="/library" className="admin-back-link">Library</Link>
                    <span className="link-divider">/</span>
                    <Link href="/" className="admin-back-link">Live Session</Link>
                </div>
            </header>

            <div className="admin-scroll-container">
                {/* Now Playing */}
                <div className="admin-card">
                    <div className="admin-card-header">
                        <span className="admin-card-label">Now Playing</span>
                        {currentSong && <span className="admin-status-node">Live</span>}
                    </div>
                    <p className="admin-now-playing-title">
                        {currentSong?.title || "Nothing playing"}
                    </p>
                    {currentSong?.lyrics ? (
                        <p className="admin-now-playing-lyrics">
                            {currentSong.lyrics.split("\n")[0]}…
                        </p>
                    ) : (
                        <p className="admin-empty">Queue up a song to start the session.</p>
                    )}
                    <button
                        onClick={handleNextSong}
                        className="btn-primary"
                        style={{ width: "100%", marginTop: "1rem" }}
                    >
                        {safeArray(localQueue).length > 0 ? "Next Song →" : "Clear & End Session"}
                    </button>
                </div>

                {/* Poll Management */}
                <div className="admin-card">
                    <div className="admin-card-header" onClick={() => setIsPollMinimized(!isPollMinimized)} style={{ cursor: "pointer" }}>
                        <span className="admin-card-label">
                            {pollData ? `Poll ${pollData.active ? "(Live)" : "(Ended)"}` : "Create Poll"}
                        </span>
                        <button className="minimize-toggle">
                            {isPollMinimized ? "Expand +" : "Minimize −"}
                        </button>
                    </div>

                    {!isPollMinimized && (
                        <div className="admin-card-content">
                            {pollData ? (
                                <>
                                    <div className="poll-results">
                                        {pollData.options?.map((title: string, i: number) => (
                                            <div key={i} className="poll-result-row">
                                                <div className="poll-result-info">
                                                    <span className="poll-result-title">{title}</span>
                                                    <span className="poll-result-count">{pollData.counts?.[i] || 0}</span>
                                                </div>
                                                <div className="poll-bar-track">
                                                    <div
                                                        className={`poll-bar-fill ${!pollData.active && pollData.counts?.[i] === Math.max(...(pollData.counts || [0])) ? "poll-bar-winner" : ""}`}
                                                        style={{ width: `${((pollData.counts?.[i] || 0) / maxVote) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="admin-empty" style={{ fontSize: "0.75rem" }}>
                                        {pollData.totalVotes} vote{pollData.totalVotes !== 1 ? "s" : ""} total
                                    </p>
                                    <div className="poll-actions">
                                        {pollData.active ? (
                                            <button onClick={handleEndPoll} className="btn-primary">
                                                End Poll & Add Winner
                                            </button>
                                        ) : (
                                            <button onClick={handleClearPoll} className="btn-secondary">
                                                Clear Poll
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="admin-empty">
                                        Select 2–4 songs, then create poll ({safeArray(pollSelections).length}/4 selected)
                                    </p>
                                    <ul className="queue-list" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                        {safeArray<Song>(allSongs).map((song: Song) => {
                                            const selected = safeArray(pollSelections).includes(song.title);
                                            return (
                                                <li
                                                    key={song.title}
                                                    className={`queue-row library-row ${selected ? "poll-selected" : ""}`}
                                                    onClick={() => togglePollSelection(song.title)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <div className={`poll-checkbox ${selected ? "poll-checkbox-on" : ""}`}>
                                                        {selected ? "✓" : ""}
                                                    </div>
                                                    <span className="queue-name">{song.title}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <button
                                        onClick={handleCreatePoll}
                                        disabled={safeArray(pollSelections).length < 2}
                                        className="btn-primary"
                                        style={{ width: "100%", marginTop: "1rem" }}
                                    >
                                        Create Poll
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Queue */}
                <div className="admin-card">
                    <span className="admin-card-label">Queue ({safeArray(localQueue).length})</span>
                    {safeArray(localQueue).length === 0 ? (
                        <p className="admin-empty">No songs in queue</p>
                    ) : (
                        <ul className="queue-list">
                            {safeArray<Song>(localQueue).map((song: Song, i: number) => (
                                <li key={`${song.title}-${i}`} className="queue-row">
                                    <span className="queue-index">{i + 1}</span>
                                    <div className="queue-thumb">♪</div>
                                    <span className="queue-name">{song.title}</span>
                                    <div className="admin-row-actions">
                                        <button onClick={() => handleMoveUp(i)} disabled={i === 0} className="admin-action-btn" title="Move up">↑</button>
                                        <button onClick={() => handleMoveDown(i)} disabled={i >= safeArray(localQueue).length - 1} className="admin-action-btn" title="Move down">↓</button>
                                        <button onClick={() => handleRemoveFromQueue(i)} className="admin-remove-btn">✕</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Song Library */}
                {safeArray(availableSongs).length > 0 && (
                    <div className="admin-card">
                        <span className="admin-card-label">
                            Song Library ({safeArray(availableSongs).length} available)
                        </span>
                        <ul className="queue-list">
                            {safeArray<Song>(availableSongs).map((song: Song) => (
                                <li key={song.title} className="queue-row library-row">
                                    <div className="queue-thumb">♪</div>
                                    <span className="queue-name">{song.title}</span>
                                    <button onClick={() => handleAddToQueue(song)} className="admin-add-btn">+ Add</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </main>
    );
}
