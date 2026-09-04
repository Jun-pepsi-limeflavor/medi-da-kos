import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./esm-alias-loader.mjs", import.meta.url);
const { projectConversationRollup } = await import("../src/lib/repo/conversations.ts");

test("conversation rollup ordering prioritizes overdue, then oldest unanswered, then unassigned, then recent activity", async () => {
  const now = "2026-08-29T12:00:00.000Z";

  const overdue = projectConversationRollup("conv-1", {
    workflowState: "active",
    dueAt: "2026-08-29T10:00:00.000Z", // overdue
    lastActivityAt: "2026-08-29T11:00:00.000Z",
    identityIds: ["email:a@test.com"],
    unansweredThreadCount: 1,
    threadCount: 1,
    ownerEmail: "owner@test.com",
    counterpartyLabel: "Overdue Client",
  });

  const oldestUnanswered = projectConversationRollup("conv-2", {
    workflowState: "active",
    dueAt: "2026-08-30T10:00:00.000Z", // not overdue
    oldestUnansweredAt: "2026-08-29T08:00:00.000Z", // waiting longer
    lastActivityAt: "2026-08-29T11:30:00.000Z",
    identityIds: ["email:b@test.com"],
    unansweredThreadCount: 1,
    threadCount: 1,
    ownerEmail: "owner@test.com",
    counterpartyLabel: "Oldest Waiting Client",
  });

  const unassigned = projectConversationRollup("conv-3", {
    workflowState: "active",
    lastActivityAt: "2026-08-29T11:45:00.000Z",
    identityIds: ["email:c@test.com"],
    unansweredThreadCount: 0,
    threadCount: 1,
    // ownerEmail is omitted -> unassigned
    counterpartyLabel: "Unassigned Client",
  });

  const recentAssigned = projectConversationRollup("conv-4", {
    workflowState: "active",
    lastActivityAt: "2026-08-29T11:50:00.000Z",
    identityIds: ["email:d@test.com"],
    unansweredThreadCount: 0,
    threadCount: 1,
    ownerEmail: "owner@test.com",
    counterpartyLabel: "Recent Client",
  });

  const list = [recentAssigned, unassigned, oldestUnanswered, overdue];

  const compare = (a: typeof overdue, b: typeof overdue) => {
    const isOverdue = (c: typeof overdue) => c.workflowState !== "done" && !!c.dueAt && c.dueAt < now;
    const unanswered = (c: typeof overdue) => c.oldestUnansweredAt ?? "\uffff";

    return (
      Number(isOverdue(b)) - Number(isOverdue(a)) ||
      unanswered(a).localeCompare(unanswered(b)) ||
      Number(!b.ownerEmail) - Number(!a.ownerEmail) ||
      b.lastActivityAt.localeCompare(a.lastActivityAt)
    );
  };

  list.sort(compare);

  assert.equal(list[0].id, "conv-1", "Overdue item should be first");
  assert.equal(list[1].id, "conv-2", "Oldest unanswered item should be second");
  assert.equal(list[2].id, "conv-3", "Unassigned item should be third");
  assert.equal(list[3].id, "conv-4", "Recent assigned item should be fourth");
});

test("unassigned conversation preserves null owner and renders safely in rollup", () => {
  const rollup = projectConversationRollup("conv-unassigned", {
    workflowState: "active",
    lastActivityAt: "2026-08-29T10:00:00.000Z",
    identityIds: ["email:anon@test.com"],
    unansweredThreadCount: 0,
    threadCount: 1,
    counterpartyLabel: "Anon",
  });

  assert.equal(rollup.ownerEmail, undefined);
  assert.equal(rollup.counterpartyLabel, "Anon");
});

test("customer work does not fetch review candidates and has a fixed three-panel loading shell", () => {
  const page = readFileSync("src/app/admin/(dash)/inbox/page.tsx", "utf8");
  const customerWork = page.slice(page.indexOf('if (queue === "customer-work")'), page.indexOf("} else {"));
  assert.doesNotMatch(customerWork, /listBuyers\(\)|listSuppliers\(\)/);

  const loading = readFileSync("src/app/admin/(dash)/inbox/loading.tsx", "utf8");
  assert.match(loading, /h-\[calc\(100vh-7rem\)\]/);
  assert.match(loading, /w-80/);
  assert.match(loading, /w-\[440px\]/);
});

test("customer-work streams detail panels behind a Suspense fallback after queue data resolves", () => {
  const page = readFileSync("src/app/admin/(dash)/inbox/page.tsx", "utf8");
  const workspace = readFileSync("src/app/admin/(dash)/inbox/InboxWorkspace.tsx", "utf8");
  assert.match(page, /conversationDetailPromise = getConversationDetail\([^)]*\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(page, /conversationDetail = await getConversationDetail/);
  assert.match(workspace, /<Suspense fallback=\{<DetailPanelsFallback/);
  assert.match(workspace, /detailPromise=\{detailPromise\}/);
});
