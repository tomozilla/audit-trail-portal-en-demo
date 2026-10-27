// Pure logic for the portal's activity view (no DOM).
// Turns activity_log rows into sentences, and warns when "who" can't be told apart.
(function (root) {
  const WORDS = { INSERT: "added", UPDATE: "changed", DELETE: "deleted" };

  // sharedAccounts: emails that several people use together (listed by you in config.js)
  function describe(entry, sharedAccounts) {
    const who = entry.actor_email || (entry.actor ? "unknown user" : "someone who was not signed in");
    const shared = (sharedAccounts || []).includes(entry.actor_email);
    const d = entry.detail || {};
    let what;
    if (entry.action === "INSERT") what = `added request #${entry.request_id} "${d.title}"`;
    else if (entry.action === "DELETE") what = `deleted request #${entry.request_id} "${d.title}"`;
    else if (d.from === d.to) what = `touched request #${entry.request_id} without changing the status`;
    else what = `moved request #${entry.request_id} from ${d.from} to ${d.to}`;
    return { who, shared, text: `${who} ${what}`, warning: shared ? "shared account: you cannot tell which person did this" : "" };
  }

  function summarize(log, sharedAccounts) {
    const byActor = {};
    for (const e of log) {
      const k = e.actor_email || "(not signed in)";
      byActor[k] = (byActor[k] || 0) + 1;
    }
    const sharedActions = log.filter((e) => (sharedAccounts || []).includes(e.actor_email)).length;
    return { total: log.length, actors: Object.keys(byActor).length, byActor, sharedActions, untraceable: sharedActions + (byActor["(not signed in)"] || 0) };
  }

  function parseList(text) {
    return String(text || "").split(",").map((s) => s.trim()).filter(Boolean);
  }

  const api = { describe, summarize, parseList, WORDS };
  if (typeof module !== "undefined") module.exports = api; else root.Activity = api;
})(this);
