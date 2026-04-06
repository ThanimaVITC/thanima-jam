"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/lib/socket";
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

    const pendingEmit = useRef(false);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        function onState(newState: { currentSong: Song | null; queue: Song[] }) {
            setCurrentSong(newState.currentSong);
            if (!pendingEmit.current) {
                setLocalQueue(newState.queue);
            }
            pendingEmit.current = false;
        }
        function onPoll(data: PollData | null) {
            setPollData(data);
        }
        function requestState() {
            socket.emit("get_state");
        }

        socket.on("state", onState);
        socket.on("poll", onPoll);
        socket.on("connect", requestState);
        if (socket.connected) requestState();

        return () => {
            socket.off("state", onState);
            socket.off("poll", onPoll);
            socket.off("connect", requestState);
        };
    }, []);

    const emitQueue = useCallback((newQueue: Song[]) => {
        pendingEmit.current = true;
        setLocalQueue(newQueue);
        socket.emit("update_queue", newQueue);
    }, []);

    const allSongs: Song[] = songsData;
    const availableSongs = allSongs.filter((song) => {
        const inQueue = localQueue.some((q) => q.title === song.title);
        const isCurrent = currentSong?.title === song.title;
        return !inQueue && !isCurrent;
    });

    function handleNextSong() { socket.emit("next_song"); }
    function handleAddToQueue(song: Song) { emitQueue([...localQueue, song]); }
    function handleRemoveFromQueue(index: number) { emitQueue(localQueue.filter((_, i) => i !== index)); }
    function handleMoveUp(index: number) {
        if (index === 0) return;
        const q = [...localQueue];
        [q[index - 1], q[index]] = [q[index], q[index - 1]];
        emitQueue(q);
    }
    function handleMoveDown(index: number) {
        if (index >= localQueue.length - 1) return;
        const q = [...localQueue];
        [q[index], q[index + 1]] = [q[index + 1], q[index]];
        emitQueue(q);
    }

    // Poll helpers
    function togglePollSelection(title: string) {
        setPollSelections((prev) =>
            prev.includes(title)
                ? prev.filter((t) => t !== title)
                : prev.length < 4
                    ? [...prev, title]
                    : prev
        );
    }

    function handleCreatePoll() {
        if (pollSelections.length < 2) return;
        console.log("[ADMIN] Creating poll with:", pollSelections);
        socket.emit("create_poll", pollSelections);
        setPollSelections([]);
    }

    function handleEndPoll() { socket.emit("end_poll"); }
    function handleClearPoll() { socket.emit("clear_poll"); }

    const maxVote = pollData ? Math.max(...pollData.counts, 1) : 1;

    return (
        <main className="page">
            <header className="app-header">
                <h2 className="app-title">Admin Panel</h2>
                <div className="admin-header-links">
                    <Link href="/" className="admin-back-link">Library</Link>
                    <span className="link-divider">/</span>
                    <Link href="/live" className="admin-back-link">Live Session</Link>
                </div>
            </header>

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
                    {localQueue.length > 0 ? "Next Song →" : "Clear & End Session"}
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
                                    {pollData.options.map((title, i) => (
                                        <div key={i} className="poll-result-row">
                                            <div className="poll-result-info">
                                                <span className="poll-result-title">{title}</span>
                                                <span className="poll-result-count">{pollData.counts[i]}</span>
                                            </div>
                                            <div className="poll-bar-track">
                                                <div
                                                    className={`poll-bar-fill ${!pollData.active && pollData.counts[i] === Math.max(...pollData.counts) ? "poll-bar-winner" : ""}`}
                                                    style={{ width: `${(pollData.counts[i] / maxVote) * 100}%` }}
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
                                    Select 2–4 songs, then create poll ({pollSelections.length}/4 selected)
                                </p>
                                <ul className="queue-list" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                    {allSongs.map((song) => {
                                        const selected = pollSelections.includes(song.title);
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
                                    disabled={pollSelections.length < 2}
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
                <span className="admin-card-label">Queue ({localQueue.length})</span>
                {localQueue.length === 0 ? (
                    <p className="admin-empty">No songs in queue</p>
                ) : (
                    <ul className="queue-list">
                        {localQueue.map((song, i) => (
                            <li key={`${song.title}-${i}`} className="queue-row">
                                <span className="queue-index">{i + 1}</span>
                                <div className="queue-thumb">♪</div>
                                <span className="queue-name">{song.title}</span>
                                <div className="admin-row-actions">
                                    <button onClick={() => handleMoveUp(i)} disabled={i === 0} className="admin-action-btn" title="Move up">↑</button>
                                    <button onClick={() => handleMoveDown(i)} disabled={i >= localQueue.length - 1} className="admin-action-btn" title="Move down">↓</button>
                                    <button onClick={() => handleRemoveFromQueue(i)} className="admin-remove-btn">✕</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Song Library */}
            {availableSongs.length > 0 && (
                <div className="admin-card">
                    <span className="admin-card-label">
                        Song Library ({availableSongs.length} available)
                    </span>
                    <ul className="queue-list">
                        {availableSongs.map((song) => (
                            <li key={song.title} className="queue-row library-row">
                                <div className="queue-thumb">♪</div>
                                <span className="queue-name">{song.title}</span>
                                <button onClick={() => handleAddToQueue(song)} className="admin-add-btn">+ Add</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </main>
    );
}
