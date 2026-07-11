// Specter Badge Server — Vercel Serverless API
// Stores and serves badge selections for all Specter users

const fs = require("fs");
const path = require("path");

// In-memory store (resets on cold start, use Vercel KV for persistence)
// For now we use a simple JSON approach via Vercel's /tmp
const DATA_FILE = "/tmp/specter-badges.json";

function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        }
    } catch {}
    return {};
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data), "utf8");
    } catch {}
}

module.exports = async function handler(req, res) {
    // CORS headers so Discord client can call this
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const data = readData();

    // GET /api/badges?userId=123 — get badges for a user
    if (req.method === "GET") {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        return res.status(200).json({ userId, badges: data[userId] ?? [] });
    }

    // POST /api/badges — set badges for a user
    // Body: { userId: "123", badges: ["nitro", "boost"] }
    if (req.method === "POST") {
        const { userId, badges } = req.body;
        if (!userId || !Array.isArray(badges)) {
            return res.status(400).json({ error: "Missing userId or badges" });
        }
        data[userId] = badges;
        writeData(data);
        return res.status(200).json({ ok: true, userId, badges });
    }

    return res.status(405).json({ error: "Method not allowed" });
};
