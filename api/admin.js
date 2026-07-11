const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_USER = "admin";
const ADMIN_PASS = "65467567657";
const PRIVILEGED_BADGES = new Set(["specter_dev", "specter_founder", "staff"]);

async function redisGet(key) {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
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
    const res = await fetch(`${REDIS_URL}/keys/${encodeURIComponent(pattern)}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
    const data = await res.json();
    return data.result ?? [];
}
async function redisGetInt(key) {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
    const data = await res.json();
    return data.result ? parseInt(data.result) : 0;
}

function checkAuth(req) {
    const auth = req.headers.authorization ?? "";
    if (!auth.startsWith("Basic ")) return false;
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const [user, ...rest] = decoded.split(":");
    return user === ADMIN_USER && rest.join(":") === ADMIN_PASS;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Specter Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d12;color:#fff;font-family:'Segoe UI',Arial,sans-serif;min-height:100vh;padding:32px 24px}
header{display:flex;align-items:center;gap:12px;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.08)}
header h1{font-size:24px;font-weight:800;background:linear-gradient(135deg,#fff,#a5b4fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ghost{font-size:28px;display:inline-block;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.stats{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap}
.stat-card{background:rgba(88,101,242,0.1);border:1px solid rgba(88,101,242,0.25);border-radius:10px;padding:16px 24px;min-width:140px}
.stat-card .val{font-size:28px;font-weight:800;color:#7c86ff}
.stat-card .lbl{font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px}
.section{margin-bottom:32px}
.section h2{font-size:13px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
.grant-form{display:flex;gap:10px;flex-wrap:wrap;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px}
input,select{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:7px;color:#fff;padding:9px 12px;font-size:13px;outline:none;transition:border-color .15s}
input:focus,select:focus{border-color:rgba(88,101,242,.6)}
input{flex:1;min-width:180px}
select option{background:#1a1a2e}
button{padding:9px 18px;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:700;transition:all .12s ease}
button:hover{transform:translateY(-1px);filter:brightness(1.15)}
button:active{transform:scale(.97)}
.btn-primary{background:linear-gradient(135deg,#5865f2,#4752c4);color:#fff;box-shadow:0 3px 10px rgba(88,101,242,.4)}
.btn-danger{background:rgba(237,66,69,.2);border:1px solid rgba(237,66,69,.4);color:#ed4245}
.btn-small{padding:5px 12px;font-size:12px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.06em;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;vertical-align:middle}
tr:hover td{background:rgba(255,255,255,.02)}
.badge-pill{display:inline-flex;align-items:center;gap:5px;background:rgba(88,101,242,.15);border:1px solid rgba(88,101,242,.3);border-radius:20px;padding:3px 8px;font-size:11px;margin:2px}
.remove-btn{cursor:pointer;color:rgba(255,255,255,.4);font-size:12px;background:none;border:none;padding:0;line-height:1;transition:color .15s}
.remove-btn:hover{color:#ed4245;transform:none;filter:none}
.user-id{font-family:monospace;font-size:12px;color:rgba(255,255,255,.5)}
.empty{text-align:center;padding:40px;color:rgba(255,255,255,.25);font-size:14px}
.toast{position:fixed;bottom:24px;right:24px;background:#23a55a;color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;transform:translateY(80px);transition:transform .25s ease;z-index:999}
.toast.show{transform:translateY(0)}
.toast.error{background:#ed4245}
</style>
</head>
<body>
<header>
  <span class="ghost">👻</span>
  <div><h1>Specter Admin</h1><div style="font-size:12px;color:rgba(255,255,255,.35);margin-top:2px">Badge management panel</div></div>
</header>
<div class="stats">
  <div class="stat-card"><div class="val" id="stat-users">—</div><div class="lbl">Total Users</div></div>
  <div class="stat-card"><div class="val" id="stat-priv">—</div><div class="lbl">Privileged Users</div></div>
</div>
<div class="section">
  <h2>Grant Privileged Badge</h2>
  <div class="grant-form">
    <input id="grant-userid" placeholder="Discord User ID" />
    <select id="grant-badge">
      <option value="specter_dev">Specter Developer</option>
      <option value="specter_founder">Specter Founder</option>
      <option value="staff">Discord Staff</option>
    </select>
    <button class="btn-primary" onclick="grantBadge()">Grant Badge</button>
  </div>
</div>
<div class="section">
  <h2>All Users</h2>
  <div id="users-table"><div class="empty">Loading…</div></div>
</div>
<div class="toast" id="toast"></div>
<script>
const CREDS = btoa("admin:65467567657");
const H = {"Authorization":"Basic "+CREDS,"Content-Type":"application/json"};

function toast(msg, err=false) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast show" + (err ? " error" : "");
  setTimeout(() => t.className = "toast", 2500);
}

async function api(action, body={}) {
  const res = await fetch("/api/admin?action=" + action, {
    method: "POST", headers: H, body: JSON.stringify(body)
  });
  return res.json();
}

async function load() {
  const data = await api("users");
  if (!data.users) { document.getElementById("users-table").innerHTML = '<div class="empty">Failed to load</div>'; return; }
  document.getElementById("stat-users").textContent = data.totalUsers ?? data.users.length;
  document.getElementById("stat-priv").textContent = data.users.filter(u => u.badges.some(b => ["specter_dev","specter_founder","staff"].includes(b))).length;
  if (!data.users.length) { document.getElementById("users-table").innerHTML = '<div class="empty">No users yet</div>'; return; }
  let html = '<table><thead><tr><th>User ID</th><th>Badges</th><th>Actions</th></tr></thead><tbody>';
  for (const u of data.users) {
    const pills = u.badges.map(b =>
      '<span class="badge-pill">' + b + '<button class="remove-btn" onclick="revoke(\'' + u.userId + '\',\'' + b + '\')">✕</button></span>'
    ).join("") || '<span style="color:rgba(255,255,255,.25);font-size:12px">No badges</span>';
    html += '<tr><td><span class="user-id">' + u.userId + '</span></td><td>' + pills + '</td><td><button class="btn-danger btn-small" onclick="clearUser(\'' + u.userId + '\')">Clear All</button></td></tr>';
  }
  html += '</tbody></table>';
  document.getElementById("users-table").innerHTML = html;
}

async function grantBadge() {
  const userId = document.getElementById("grant-userid").value.trim();
  const badge = document.getElementById("grant-badge").value;
  if (!userId) { toast("Enter a User ID", true); return; }
  const data = await api("grant", { userId, badge });
  if (data.ok) { toast("Badge granted! ✓"); load(); } else toast("Failed: " + (data.error || "unknown"), true);
}

async function revoke(userId, badge) {
  const data = await api("revoke", { userId, badge });
  if (data.ok) { toast("Badge revoked"); load(); } else toast("Failed", true);
}

async function clearUser(userId) {
  if (!confirm("Clear all badges for " + userId + "?")) return;
  const data = await api("clearuser", { userId });
  if (data.ok) { toast("User cleared"); load(); } else toast("Failed", true);
}

load();
</script>
</body>
</html>`;

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    if (!checkAuth(req)) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Specter Admin"');
        if (req.method === "GET" && !req.query.action) return res.status(401).send("Unauthorized");
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Serve HTML panel
    if (req.method === "GET" && !req.query.action) {
        res.setHeader("Content-Type", "text/html");
        return res.status(200).send(HTML);
    }

    // All admin actions via POST now (avoids DELETE body parsing issues)
    if (req.method === "POST") {
        const action = req.query.action;
        const body = req.body ?? {};

        if (action === "users") {
            const keys = await redisKeys("specter:*");
            const userKeys = keys.filter(k => !k.includes(":stats:") && !k.includes(":totalUsers"));
            const users = [];
            for (const key of userKeys) {
                const userId = key.replace("specter:", "");
                const badges = await redisGet(key) ?? [];
                users.push({ userId, badges });
            }
            const totalUsers = await redisGetInt("specter:totalUsers");
            return res.status(200).json({ users, totalUsers });
        }

        if (action === "grant") {
            const { userId, badge } = body;
            if (!userId || !badge) return res.status(400).json({ error: "Missing fields" });
            if (!PRIVILEGED_BADGES.has(badge)) return res.status(400).json({ error: "Not a privileged badge" });
            const badges = await redisGet(`specter:${userId}`) ?? [];
            if (!badges.includes(badge)) { badges.push(badge); await redisSet(`specter:${userId}`, badges); }
            return res.status(200).json({ ok: true, userId, badges });
        }

        if (action === "revoke") {
            const { userId, badge } = body;
            if (!userId || !badge) return res.status(400).json({ error: "Missing fields" });
            const badges = (await redisGet(`specter:${userId}`) ?? []).filter(b => b !== badge);
            await redisSet(`specter:${userId}`, badges);
            return res.status(200).json({ ok: true, userId, badges });
        }

        if (action === "clearuser") {
            const { userId } = body;
            if (!userId) return res.status(400).json({ error: "Missing userId" });
            await redisSet(`specter:${userId}`, []);
            return res.status(200).json({ ok: true, userId, badges: [] });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
};
