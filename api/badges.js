// Specter Badge Server — Vercel + Upstash Redis

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Privileged user IDs — only these can save privileged badges
const PRIVILEGED_USERS = new Set(["925410689491808317"]);
const PRIVILEGED_BADGES = new Set(["specter_dev", "specter_founder", "staff"]);

// Current badge hashes — update these when Discord changes CDN
const BADGE_HASHES = {
    nitro:           "5b154df19c53dce2af92c9b61e6be5e2",
    boost:           "ec92202290b48d0879b7413d2dde3bab",
    hype_bravery:    "8a88d63823d8a71cd5e390baa45efa02",
    hype_brilliance: "011940fd013da3f7fb926e4a1cd2e618",
    hype_balance:    "3aa41de486fa12454c3761e8e223442e",
    hype_events:     "bf01d1073931f921909045f3a39fd264",
    early_supporter: "7060786766c9c840eb3019e725d2b358",
    bug_hunter_1:    "2717692c7dca7289b35297368a940dd0",
    bug_hunter_2:    "848f79194d4be5ff5f81505cbd0ce1e6",
    verified_dev:    "6df5892e0f35b051f8b61eace34f4967",
    moderator:       "fee1624003e2fee35cb398e125dc479b",
    active_dev:      "6bdc42827a38498929a4920da12695d9",
    partner:         "3f9748e53446a137a052f3454e2de41e",
    legacy_username: "6de6d34650760ba5551a79732e98ed60",
    staff:           "7s44lsn", // imgur
    specter_dev:     "JVDuQGy", // imgur
    specter_founder: "OnbOD1W", // imgur
};

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

async function redisIncr(key) {
    await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
}

async function redisDecr(key) {
    await fetch(`${REDIS_URL}/decr/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
}

async function redisGetInt(key) {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await res.json();
    return data.result ? parseInt(data.result) : 0;
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    // GET /api/badges?userId=123 — get badges for a user
    // GET /api/badges?stats=1 — get badge stats
    // GET /api/badges?hashes=1 — get current badge hashes
    if (req.method === "GET") {
        // Return badge hashes
        if (req.query.hashes) {
            return res.status(200).json({ hashes: BADGE_HASHES });
        }

        // Return badge stats
        if (req.query.stats) {
            const stats = {};
            for (const id of Object.keys(BADGE_HASHES)) {
                stats[id] = await redisGetInt(`specter:stats:${id}`);
            }
            return res.status(200).json({ stats });
        }

        // Return badges for a user
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const badges = await redisGet(`specter:${userId}`) ?? [];
        return res.status(200).json({ userId, badges });
    }

    // POST /api/badges — { userId, badges }
    if (req.method === "POST") {
        const { userId, badges } = req.body;
        if (!userId || !Array.isArray(badges)) {
            return res.status(400).json({ error: "Missing userId or badges" });
        }

        // Verify badges — strip privileged ones if user isn't allowed
        const isPrivileged = PRIVILEGED_USERS.has(userId);
        const verified = badges.filter(id => {
            if (PRIVILEGED_BADGES.has(id) && !isPrivileged) return false;
            if (!BADGE_HASHES[id]) return false; // unknown badge
            return true;
        });

        // Update stats — decrement old badges, increment new ones
        const oldBadges = await redisGet(`specter:${userId}`) ?? [];
        for (const id of oldBadges) {
            if (!verified.includes(id)) await redisDecr(`specter:stats:${id}`);
        }
        for (const id of verified) {
            if (!oldBadges.includes(id)) await redisIncr(`specter:stats:${id}`);
        }

        await redisSet(`specter:${userId}`, verified);
        return res.status(200).json({ ok: true, userId, badges: verified });
    }

    return res.status(405).json({ error: "Method not allowed" });
};
