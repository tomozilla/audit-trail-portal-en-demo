const A = require("./activity.js");
let fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(got) + " != " + JSON.stringify(want)); };
const shared = ["shared-desk@example.com"];
const log = [
  { id: 1, actor: "u1", actor_email: "shared-desk@example.com", action: "INSERT", request_id: 1, detail: { title: "Printer", status: "open" } },
  { id: 2, actor: "u1", actor_email: "shared-desk@example.com", action: "UPDATE", request_id: 1, detail: { from: "open", to: "in_progress" } },
  { id: 3, actor: "u2", actor_email: "staff-sato@example.com", action: "INSERT", request_id: 2, detail: { title: "Form", status: "open" } },
  { id: 4, actor: "u3", actor_email: "staff-tanaka@example.com", action: "UPDATE", request_id: 2, detail: { from: "open", to: "in_progress" } },
  { id: 5, actor: "u2", actor_email: "staff-sato@example.com", action: "UPDATE", request_id: 2, detail: { from: "in_progress", to: "done" } },
  { id: 6, actor: "u2", actor_email: "staff-sato@example.com", action: "UPDATE", request_id: 2, detail: { from: "done", to: "done" } },
  { id: 7, actor: null, actor_email: null, action: "DELETE", request_id: 3, detail: { title: "Old" } },
];
eq("insert sentence", A.describe(log[2], shared).text, 'staff-sato@example.com added request #2 "Form"');
eq("update sentence", A.describe(log[3], shared).text, "staff-tanaka@example.com moved request #2 from open to in_progress");
eq("no-op update is called out", A.describe(log[5], shared).text, "staff-sato@example.com touched request #2 without changing the status");
eq("delete sentence with unknown actor", A.describe(log[6], shared).text, 'someone who was not signed in deleted request #3 "Old"');
eq("shared account carries a warning", A.describe(log[0], shared).warning, "shared account: you cannot tell which person did this");
eq("named account has no warning", A.describe(log[2], shared).warning, "");
eq("user id without email", A.describe({ actor: "u9", actor_email: null, action: "INSERT", request_id: 1, detail: { title: "x" } }, shared).who, "unknown user");
const s = A.summarize(log, shared);
eq("summary: 7 entries, 4 actors", [s.total, s.actors], [7, 4]);
eq("summary: 2 shared actions, 3 untraceable (2 shared + 1 not signed in)", [s.sharedActions, s.untraceable], [2, 3]);
eq("summary per actor", s.byActor["staff-sato@example.com"], 3);
eq("empty log", A.summarize([], shared), { total: 0, actors: 0, byActor: {}, sharedActions: 0, untraceable: 0 });
eq("parseList trims and drops empties", A.parseList(" a@example.com, ,b@example.com "), ["a@example.com", "b@example.com"]);
eq("describe tolerates a missing detail", A.describe({ actor_email: "a", action: "UPDATE", request_id: 1 }, []).text.length > 0, true);
process.exit(fail ? 1 : 0);
