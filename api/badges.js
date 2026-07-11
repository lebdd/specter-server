// Specter Badge Server — Vercel + Upstash Redis

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
    const res = await fetch(`${REDIS_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
}

async function redisSet(key, value) {
    await fetch(`${REDIS_URL}/set/${key}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: JSON.stringify(value) })
    });
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    // GET /api/badges?userId=123
    if (req.method === "GET") {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const badges = await redisGet(`specter:${userId}`) ?? [];
        return res.status(200).json({ userId, badges });
    }

    // POST /api/badges — { userId, badges }
    if (req.method === "POST") {
        const { userId, badges } = req.body;
        if (!userId || !Array.isArray(badges)) return res.status(400).json({ error: "Missing userId or badges" });
        await redisSet(`specter:${userId}`, badges);
        return res.status(200).json({ ok: true, userId, badges });
    }

    return res.status(405).json({ error: "Method not allowed" });
};
