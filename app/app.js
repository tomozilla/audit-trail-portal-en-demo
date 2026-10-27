// Support portal: sign in as yourself, change requests, read the activity log. Every call goes through RLS.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let sb = null;
let busy = false; // blocks double clicks while a request is in flight

function setMsg(id, text, kind) { $(id).innerHTML = text ? `<div class="msg ${kind || ""}">${esc(text)}</div>` : ""; }

async function refresh() {
  const [reqs, log] = await Promise.all([
    sb.from("support_requests").select("id,title,status,updated_by,updated_at").order("id"),
    sb.from("activity_log").select("id,at,actor,actor_email,action,request_id,detail").order("id", { ascending: false }).limit(30),
  ]);
  if (reqs.error || log.error) { setMsg("req-msg", (reqs.error || log.error).message, "err"); return; }
  $("requests").innerHTML = reqs.data.map((r) => `<li><b>#${r.id}</b> ${esc(r.title)} <select data-id="${r.id}">${["open", "in_progress", "done"].map((s) => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select></li>`).join("") || "<li>No requests yet.</li>";
  document.querySelectorAll("select[data-id]").forEach((s) => s.addEventListener("change", () => change(s.dataset.id, s.value)));
  const shared = APP_CONFIG.sharedAccounts || [];
  const sum = Activity.summarize(log.data, shared);
  $("summary").innerHTML = `<span>${sum.total} entries</span><span>${sum.actors} people/accounts</span>` + (sum.untraceable ? `<span class="warn" style="display:inline">${sum.untraceable} you cannot trace to a person</span>` : "");
  $("log").innerHTML = log.data.map((e) => { const d = Activity.describe(e, shared); return `<li>${esc(d.text)}${d.warning ? `<span class="warn">${esc(d.warning)}</span>` : ""}</li>`; }).join("") || "<li>Nothing yet.</li>";
}

async function guard(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } finally { busy = false; }
}

const change = (id, status) => guard(async () => {
  const { data, error } = await sb.from("support_requests").update({ status }).eq("id", id).select();
  if (error) setMsg("req-msg", error.message, "err");
  else if (!data.length) setMsg("req-msg", "Nothing changed (the row may not exist, or you may not be allowed to change it).", "err"); // a silent no-op is not a success
  else setMsg("req-msg", "");
  await refresh();
});

const add = () => guard(async () => {
  const title = $("title").value.trim();
  if (!title) { setMsg("req-msg", "Type a title first.", "err"); return; }
  const { error } = await sb.from("support_requests").insert({ title });
  if (error) setMsg("req-msg", error.message, "err"); else { $("title").value = ""; setMsg("req-msg", ""); }
  await refresh();
});

async function showSignedIn(user) {
  $("login-card").hidden = true; $("who-card").hidden = false; $("work").hidden = false;
  $("me").textContent = user.email;
  await refresh();
}

async function init() {
  if (!window.APP_CONFIG || !/^https:\/\//.test(APP_CONFIG.url || "") || (APP_CONFIG.url || "").includes("<")) {
    $("banner").innerHTML = `<div class="msg err">config.js is missing or still has placeholders. Copy config.example.js to config.js and fill it in.</div>`; return;
  }
  sb = window.supabase.createClient(APP_CONFIG.url, APP_CONFIG.publishableKey);
  $("foot").textContent = "Demo only: the log is written by a database trigger, and the page can only read it. A signed-in user can still change any request: add finer rules before real use.";
  $("signin").addEventListener("click", () => guard(async () => {
    setMsg("login-msg", "");
    const { data, error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) { setMsg("login-msg", error.message, "err"); return; }
    $("password").value = "";
    await showSignedIn(data.user);
  }));
  $("signout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
  $("add").addEventListener("click", add);
  const { data } = await sb.auth.getSession();
  if (data.session) await showSignedIn(data.session.user);
}
init();
