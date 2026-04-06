"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, runTransaction } from "firebase/database";
import Link from "next/link";

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

export default function LyricsPage() {
  const [state, setState] = useState<AppState>({
    currentSong: null,
    queue: [],
  });
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [pollPopupOpen, setPollPopupOpen] = useState(false);
  const [isPollResultsHidden, setIsPollResultsHidden] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const [peekOpen, setPeekOpen] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);

  const ensureArray = <T,>(val: any): T[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') return Object.values(val) as T[];
    return [];
  };

  useEffect(() => {
    const stateRef = ref(db, "state");
    const pollRef = ref(db, "poll");

    const unsubs = [
      onValue(stateRef, (snapshot) => {
        const data = snapshot.val();
        if (data && typeof data === 'object') {
          setState((prev) => {
            const songChanged = data.currentSong?.title !== prev.currentSong?.title;
            if (songChanged) {
              setFadeKey((k) => k + 1);
            }
            return {
              currentSong: data.currentSong || null,
              queue: ensureArray<Song>(data.queue)
            };
          });
        }
      }),
      onValue(pollRef, (snapshot) => {
        const data = snapshot.val();
        const poll = data && typeof data === 'object' ? data : null;
        setPollData((prev) => {
          const isNewPoll = poll?.active && (!prev || !prev.active);
          if (isNewPoll) {
            setPollPopupOpen(true);
            setIsPollResultsHidden(false);
          }
          return poll;
        });

        if (!poll) {
          setUserVote(null);
          setPollPopupOpen(false);
          setIsPollResultsHidden(false);
        }
      })
    ];

    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    if (lyricsRef.current) {
      lyricsRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [fadeKey]);

  async function handleVote(index: number) {
    if (userVote !== null || !pollData?.active) return;
    setUserVote(index);

    const pollRef = ref(db, "poll");
    await runTransaction(pollRef, (currentPoll) => {
      if (currentPoll && currentPoll.active) {
        if (!currentPoll.counts) {
          currentPoll.counts = new Array((currentPoll.options || []).length).fill(0);
        }
        if (currentPoll.counts && typeof index === 'number') {
          currentPoll.counts[index] = (currentPoll.counts[index] || 0) + 1;
          currentPoll.totalVotes = (currentPoll.totalVotes || 0) + 1;
        }
      }
      return currentPoll;
    });
  }

  const { currentSong, queue: rawQueue } = state;
  const queue = ensureArray<Song>(rawQueue);
  const nextSong = queue.length > 0 ? queue[0] : null;
  const showResults = userVote !== null || (pollData && !pollData.active);
  const countsArray = pollData ? ensureArray<number>(pollData.counts) : [];
  const maxVote = countsArray.length > 0 ? Math.max(...countsArray, 1) : 1;

  return (
    <main className="page">
      {/* Header */}
      <header className="app-header">
        <Link href="/" className="admin-back-link">
          ← Library
        </Link>
        <h2 className="app-title">Live Session</h2>
      </header>

      {/* Now Playing & Lyrics Section */}
      <div className="now-playing-wrapper" key={fadeKey}>
        {currentSong ? (
          <>
            {/* Header portion */}
            <div className="now-playing-bar">
              <div className="album-art">
                <div className="album-art-icon">♪</div>
              </div>
              <div className="now-playing-info">
                <span className="now-playing-label">Now Playing</span>
                <h1 className="now-playing-title">{currentSong.title}</h1>
              </div>
              <div className="equalizer">
                <span className="eq-bar" />
                <span className="eq-bar" />
                <span className="eq-bar" />
                <span className="eq-bar" />
              </div>
            </div>

            {/* Lyrics portion */}
            <div ref={lyricsRef} className="lyrics-container">
              <div className="lyrics-inner">
                {currentSong.lyrics?.split("\n").map((line: string, i: number) => (
                  <p key={i} className={`lyrics-line ${line.trim() === "" ? "lyrics-break" : ""}`}>
                    {line || "\u00A0"}
                  </p>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-album">
              <div className="empty-icon">♪</div>
            </div>
            <p className="empty-title">Nothing playing</p>
            <p className="empty-subtitle">Waiting for a song to begin…</p>
          </div>
        )}
      </div>

      {/* Poll Overlay (Popup) */}
      {pollData && pollPopupOpen && (
        <div className="poll-overlay-backdrop">
          <div className="poll-overlay-content admin-card">
            <span className="admin-card-label">
              {userVote !== null ? "Vote Cast!" : "New Poll: Pick the next song"}
            </span>
            <div className="poll-options-live">
              {ensureArray<string>(pollData.options).map((option: string, i: number) => (
                <div
                  key={i}
                  className={`poll-option ${userVote === i ? "voted" : ""} ${!pollData.active ? "disabled" : ""}`}
                  onClick={() => handleVote(i)}
                >
                  <div className="poll-option-content">
                    <span className="poll-option-title">{option}</span>
                    {showResults && <span className="poll-option-percentage">{Math.round(((ensureArray<number>(pollData.counts)[i] || 0) / (pollData.totalVotes || 1)) * 100)}%</span>}
                  </div>
                  {showResults && (
                    <div className="poll-bar-track">
                      <div
                        className={`poll-bar-fill ${!pollData.active && ensureArray<number>(pollData.counts)[i] === Math.max(...ensureArray<number>(pollData.counts)) ? "winner" : ""}`}
                        style={{ width: `${((ensureArray<number>(pollData.counts)[i] || 0) / maxVote) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setPollPopupOpen(false)}
              className="btn-secondary poll-close-btn"
            >
              {userVote !== null ? "Continue to Lyrics" : "Minimize Poll"}
            </button>
          </div>
        </div>
      )}

      <footer className="live-session-footer">
        {/* Up Next — always visible */}
        <div
          className="next-song-card"
          onClick={() => nextSong && setPeekOpen((v) => !v)}
        >
          <div className="next-song-header">
            <div className="queue-thumb">♪</div>
            <div className="next-song-info">
              <span className="peek-label">Up Next</span>
              <p className="next-song-title">
                {nextSong ? nextSong.title : "No more songs"}
              </p>
            </div>
            {nextSong && (
              <span className={`peek-chevron ${peekOpen ? "peek-chevron-open" : ""}`}>
                ▼
              </span>
            )}
          </div>
          {peekOpen && nextSong && (
            <div className="next-song-lyrics">
              {nextSong.lyrics?.split("\n").map((line: string, i: number) => (
                <p key={i} className={`peek-lyrics-line ${line.trim() === "" ? "lyrics-break" : ""}`}>
                  {line || "\u00A0"}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* persistent Bottom Poll */}
        {pollData && !pollPopupOpen && (
          isPollResultsHidden ? (
            <button
              className="show-poll-btn"
              onClick={() => setIsPollResultsHidden(false)}
            >
              Show Poll Results
            </button>
          ) : (
            <div className="admin-card poll-card-live bottom-poll-card">
              <div className="admin-card-header">
                <span className="admin-card-label">
                  {pollData.active ? (userVote !== null ? "Vote Results" : "Live Poll") : "Poll Results"}
                </span>
                <button
                  className="minimize-toggle"
                  onClick={() => setIsPollResultsHidden(true)}
                >
                  Hide
                </button>
              </div>
              <div className="poll-options-live">
                {ensureArray<string>(pollData.options).map((option: string, i: number) => (
                  <div
                    key={i}
                    className={`poll-option ${userVote === i ? "voted" : ""} ${!pollData.active ? "disabled" : ""}`}
                    onClick={() => handleVote(i)}
                  >
                    <div className="poll-option-content">
                      <span className="poll-option-title">{option}</span>
                      {showResults && <span className="poll-option-percentage">{Math.round(((ensureArray<number>(pollData.counts)[i] || 0) / (pollData.totalVotes || 1)) * 100)}%</span>}
                    </div>
                    {showResults && (
                      <div className="poll-bar-track">
                        <div
                          className={`poll-bar-fill ${!pollData.active && ensureArray<number>(pollData.counts)[i] === Math.max(...ensureArray<number>(pollData.counts)) ? "winner" : ""}`}
                          style={{ width: `${((ensureArray<number>(pollData.counts)[i] || 0) / maxVote) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </footer>
    </main>
  );
}
