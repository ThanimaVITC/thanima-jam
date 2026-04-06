const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Load master song list
const songsPath = path.join(__dirname, "songs.json");
const allSongs = JSON.parse(fs.readFileSync(songsPath, "utf-8"));
console.log(`[INFO] Loaded ${allSongs.length} songs from songs.json`);

// State persistence file
const statePath = path.join(__dirname, ".state.json");

function loadState() {
    try {
        if (fs.existsSync(statePath)) {
            const saved = JSON.parse(fs.readFileSync(statePath, "utf-8"));
            console.log("[INFO] Restored state from .state.json");
            return {
                currentSong: saved.currentSong || null,
                queue: saved.queue || [],
                allSongs: allSongs,
            };
        }
    } catch (err) {
        console.error("[WARN] Failed to load saved state:", err.message);
    }
    return {
        currentSong: null,
        queue: [...allSongs],
        allSongs: allSongs,
    };
}

function saveState() {
    try {
        fs.writeFileSync(
            statePath,
            JSON.stringify(
                { currentSong: state.currentSong, queue: state.queue },
                null,
                2
            )
        );
    } catch (err) {
        console.error("[WARN] Failed to save state:", err.message);
    }
}

// In-memory state
let state = loadState();

// Poll state (not persisted — polls are ephemeral)
// poll = { options: [{title, lyrics}], votes: {socketId: optionIndex}, active: true }
let poll = null;

function getPollData() {
    if (!poll) return null;
    // Tally votes per option
    const counts = new Array(poll.options.length).fill(0);
    for (const idx of Object.values(poll.votes)) {
        counts[idx]++;
    }
    return {
        options: poll.options.map((s) => s.title),
        counts: counts,
        totalVotes: Object.keys(poll.votes).length,
        active: poll.active,
    };
}

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        if (parsedUrl.pathname.startsWith("/socket.io")) {
            return;
        }
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer);

    function broadcastAll() {
        io.emit("state", state);
        io.emit("poll", getPollData());
    }

    io.on("connection", (socket) => {
        console.log(`[DEBUG] Client connected: ${socket.id}`);

        // Emit initial state + poll
        socket.emit("state", state);
        socket.emit("poll", getPollData());

        // Explicit state request
        socket.on("get_state", () => {
            socket.emit("state", state);
            socket.emit("poll", getPollData());
        });

        // ─── Queue management ─────────────────────────
        socket.on("next_song", () => {
            console.log(`[DEBUG] Received next_song from ${socket.id}`);
            // Shift from queue or clear current song if queue is empty
            state.currentSong = state.queue.shift() || null;
            console.log(`[DEBUG] Now playing: ${state.currentSong ? state.currentSong.title : "Nothing"}`);
            saveState();
            io.emit("state", state);
        });

        socket.on("update_queue", (newQueue) => {
            state.queue = newQueue;
            saveState();
            io.emit("state", state);
        });

        // ─── Poll management ──────────────────────────
        socket.on("create_poll", (songTitles) => {
            console.log(`[POLL] Request to create poll with: ${songTitles.join(", ")}`);

            // Reload songs to handle post-startup edits
            let currentAllSongs = allSongs;
            try {
                currentAllSongs = JSON.parse(fs.readFileSync(songsPath, "utf-8"));
            } catch (err) {
                console.error("[POLL] Failed to reload songs.json:", err.message);
            }

            const options = songTitles
                .map((t) => currentAllSongs.find((s) => s.title === t))
                .filter(Boolean);

            if (options.length < 2) {
                console.warn(`[POLL] Creation failed: Only ${options.length} valid songs found out of ${songTitles.length} requested.`);
                return;
            }

            poll = { options, votes: {}, active: true };
            console.log(
                `[POLL] Created successfully with ${options.length} options.`
            );
            io.emit("poll", getPollData());
        });

        socket.on("vote", (optionIndex) => {
            if (!poll || !poll.active) return;
            if (optionIndex < 0 || optionIndex >= poll.options.length) return;

            poll.votes[socket.id] = optionIndex;
            console.log(`[POLL] ${socket.id} voted for option ${optionIndex}`);
            io.emit("poll", getPollData());
        });

        socket.on("end_poll", () => {
            if (!poll || !poll.active) return;
            poll.active = false;

            // Find winner
            const counts = new Array(poll.options.length).fill(0);
            for (const idx of Object.values(poll.votes)) {
                counts[idx]++;
            }
            const maxVotes = Math.max(...counts);
            const winnerIdx = counts.indexOf(maxVotes);
            const winner = poll.options[winnerIdx];

            // Add winner to queue if not already there
            const alreadyInQueue = state.queue.some(
                (s) => s.title === winner.title
            );
            if (!alreadyInQueue) {
                state.queue.push(winner);
                saveState();
            }

            console.log(`[POLL] Ended. Winner: ${winner.title} (${maxVotes} votes)`);
            io.emit("poll", getPollData());
            io.emit("state", state);
        });

        socket.on("clear_poll", () => {
            poll = null;
            console.log("[POLL] Cleared");
            io.emit("poll", null);
        });

        socket.on("disconnect", () => {
            console.log(`[DEBUG] Client disconnected: ${socket.id}`);
        });
    });

    httpServer.listen(port, () => {
        console.log(`[INFO] Server listening at http://${hostname}:${port}`);
    });
});
