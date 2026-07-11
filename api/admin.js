// Specter Admin API

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const ADMIN_USER = "admin";
const ADMIN_PASS = "65467567657";

const PRIVILEGED_BADGES = new Set(["specter_dev", "specter_founder", "staff"]);

async function redisGet(key) {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
}

async function redisSet(key, value) {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: JSON.stringify(value) })
    });
}

async function redisKeys(pattern) {
    const res = await fetch(`${REDIS_URL}/keys/${encodeURIComponent(pattern)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await res.json();
    return data.result ?? [];
}

async function redisGetInt(key) {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await res.json();
    return data.result ? parseInt(data.result) : 0;
}

function checkAuth(req) {
    const auth = req.headers.authorization ?? "";
    if (!auth.startsWith("Basic ")) return false;
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const [user, pass] = decoded.split(":");
    return user === ADMIN_USER && pass === ADMIN_PASS;
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    if (!checkAuth(req)) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Specter Admin"');
        return res.status(401).json({ error: "Unauthorized" });
    }

    // GET /api/admin?action=users — list all users and their badges
    if (req.method === "GET" && req.query.action === "users") {
        const keys = await redisKeys("specter:*");
        const userKeys = keys.filter(k => !k.includes("stats") && !k.includes("totalUsers"));
        const users = [];
        for (const key of userKeys) {
            const userId = key.replace("specter:", "");
            const badges = await redisGet(key) ?? [];
            users.push({ userId, badges });
        }
        const totalUsers = await redisGetInt("specter:totalUsers");
        return res.status(200).json({ users, totalUsers });
    }

    // POST /api/admin?action=grant — grant a privileged badge to a user
    // Body: { userId, badge }
    if (req.method === "POST" && req.query.action === "grant") {
        const { userId, badge } = req.body;
        if (!userId || !badge) return res.status(400).json({ error: "Missing userId or badge" });
        if (!PRIVILEGED_BADGES.has(badge)) return res.status(400).json({ error: "Not a privileged badge" });
        const badges = await redisGet(`specter:${userId}`) ?? [];
        if (!badges.includes(badge)) {
            badges.push(badge);
            await redisSet(`specter:${userId}`, badges);
        }
        return res.status(200).json({ ok: true, userId, badges });
    }

    // DELETE /api/admin?action=revoke — revoke a badge from a user
    // Body: { userId, badge }
    if (req.method === "DELETE" && req.query.action === "revoke") {
        const { userId, badge } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const badges = (await redisGet(`specter:${userId}`) ?? []).filter(b => badge ? b !== badge : false);
        await redisSet(`specter:${userId}`, badge ? badges : []);
        return res.status(200).json({ ok: true, userId, badges });
    }

    // DELETE /api/admin?action=clearuser — clear all badges for a user
    if (req.method === "DELETE" && req.query.action === "clearuser") {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        await redisSet(`specter:${userId}`, []);
        return res.status(200).json({ ok: true, userId, badges: [] });
    }

    return res.status(405).json({ error: "Method not allowed" });
};
