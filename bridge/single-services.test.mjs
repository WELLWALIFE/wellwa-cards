// node --test bridge/single-services.test.mjs
// Single services in the bridge's jobs: a service bought alone runs until its paid end + 7 grace days; anything unreadable
// (no migration 0101, a bad id, an error) means "not running", so the old plan check stays as it was.
import test from "node:test";
import assert from "node:assert/strict";
import { serviceRunning, serviceUntil, SERVICE_GRACE_MS } from "./single-services.mjs";

const ID = "11111111-2222-3333-4444-555555555555";
const NOW = Date.parse("2026-11-28T10:00:00Z");
const rowWith = (col, v) => async (path) => (path.includes(`select=${col}`) ? [{ [col]: v }] : []);

test("a paid service runs to its end plus the 7 grace days", async () => {
  const end = "2026-12-28T10:00:00Z";
  assert.equal(await serviceRunning(rowWith("svc_crm_until", end), ID, "crm", NOW), true);
  assert.equal(await serviceUntil(rowWith("svc_crm_until", end), ID, "crm", NOW), new Date(Date.parse(end) + SERVICE_GRACE_MS).toISOString());
  // ended 3 days ago: still inside the grace
  assert.equal(await serviceRunning(rowWith("svc_posters_until", "2026-11-25T10:00:00Z"), ID, "posters", NOW), true);
  // ended 8 days ago: over
  assert.equal(await serviceRunning(rowWith("svc_posters_until", "2026-11-20T09:00:00Z"), ID, "posters", NOW), false);
  assert.equal(await serviceUntil(rowWith("svc_posters_until", "2026-11-20T09:00:00Z"), ID, "posters", NOW), null);
});

test("nothing readable means not running", async () => {
  assert.equal(await serviceRunning(async () => ({ message: "column profiles.svc_crm_until does not exist" }), ID, "crm", NOW), false);
  assert.equal(await serviceRunning(async () => { throw new Error("network"); }, ID, "crm", NOW), false);
  assert.equal(await serviceRunning(rowWith("svc_crm_until", null), ID, "crm", NOW), false);
  assert.equal(await serviceRunning(rowWith("svc_crm_until", "2027-01-01T00:00:00Z"), "not-an-id", "crm", NOW), false);
  assert.equal(await serviceRunning(rowWith("svc_crm_until", "2027-01-01T00:00:00Z"), ID, "broadcast", NOW), false, "broadcasts are never a single service");
});
