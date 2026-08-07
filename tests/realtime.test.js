import test from "node:test";
import assert from "node:assert/strict";

import { applyRealtimeShot, createRealtimeController } from "../src/page-client.js";

class FakeTimers {
  constructor() {
    this.nextId = 1;
    this.timeouts = new Map();
    this.intervals = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.timeouts.set(id, { callback, delay });
    return id;
  }

  clearTimeout(id) {
    this.timeouts.delete(id);
  }

  setInterval(callback, delay) {
    const id = this.nextId++;
    this.intervals.set(id, { callback, delay });
    return id;
  }

  clearInterval(id) {
    this.intervals.delete(id);
  }

  runNextTimeout() {
    const next = this.timeouts.entries().next().value;
    assert.ok(next, "expected a scheduled timeout");
    const [id, timer] = next;
    this.timeouts.delete(id);
    timer.callback();
  }

  runIntervals() {
    for (const timer of [...this.intervals.values()]) timer.callback();
  }
}

class FakeSocket {
  constructor() {
    this.readyState = 0;
    this.sent = [];
    this.closeCount = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }

  open() {
    this.readyState = 1;
    this.onopen();
  }

  message(data) {
    this.onmessage({ data });
  }

  close() {
    this.closeCount += 1;
    this.readyState = 3;
  }

  remoteClose() {
    this.readyState = 3;
    this.onclose();
  }

  send(data) {
    if (this.readyState !== 1) throw new Error("socket_closed");
    this.sent.push(data);
  }
}

function createHarness() {
  const timers = new FakeTimers();
  const sockets = [];
  const statuses = [];
  const events = [];
  const messages = [];
  const refreshReasons = [];
  let refreshes = 0;
  const controller = createRealtimeController({
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    timers,
    random: () => 0.5,
    connectionTimeoutMs: 1_000,
    heartbeatIntervalMs: 2_000,
    pollIntervalMs: 3_000,
    setStatus: (text, state) => statuses.push({ text, state }),
    onEvent: ({ type }) => events.push(type),
    refresh: (reason) => { refreshes += 1; refreshReasons.push(reason); },
    onMessage: (event) => messages.push(event.data),
  });
  return {
    controller,
    messages,
    sockets,
    statuses,
    events,
    refreshReasons,
    timers,
    refreshes: () => refreshes,
  };
}

test("realtime controller falls back to polling when a socket stays connecting", () => {
  const harness = createHarness();
  harness.controller.start();

  assert.equal(harness.sockets.length, 1);
  assert.equal(harness.refreshes(), 1);
  assert.deepEqual(harness.statuses.at(-1), { text: "Syncing", state: "polling" });
  assert.deepEqual(harness.events.slice(0, 2), ["start", "connecting"]);

  harness.timers.runNextTimeout();

  assert.equal(harness.sockets[0].closeCount, 1);
  assert.deepEqual(harness.statuses.at(-1), { text: "Syncing", state: "polling" });
  assert.equal(harness.refreshes(), 1, "an active fallback timer prevents reconnect storms from querying again");

  harness.timers.runIntervals();
  assert.equal(harness.refreshes(), 2);

  harness.timers.runNextTimeout();
  assert.equal(harness.sockets.length, 2);
  assert.deepEqual(harness.statuses.at(-1), { text: "Syncing", state: "polling" });
  assert.ok(harness.events.includes("timeout"));
});

test("realtime controller stops polling once live and resumes it after disconnect", () => {
  const harness = createHarness();
  harness.controller.start();
  const socket = harness.sockets[0];

  socket.open();
  assert.deepEqual(harness.statuses.at(-1), { text: "Live", state: "live" });
  assert.equal(harness.timers.intervals.size, 1, "only the heartbeat remains while live");

  socket.message('{"id":"new-shot"}');
  assert.deepEqual(harness.messages, ['{"id":"new-shot"}']);

  socket.remoteClose();
  assert.deepEqual(harness.statuses.at(-1), { text: "Syncing", state: "polling" });
  assert.equal(harness.refreshes(), 2, "fallback refreshes immediately after a live connection drops");
  assert.equal(harness.timers.intervals.size, 1, "polling replaces the heartbeat");

  harness.controller.stop();
  assert.equal(harness.timers.intervals.size, 0);
  assert.equal(harness.timers.timeouts.size, 0);
});

test("hidden tabs never poll and reconcile once when visible again", () => {
  const timers = new FakeTimers();
  const sockets = [];
  const reasons = [];
  let visible = false;
  const controller = createRealtimeController({
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    timers,
    isVisible: () => visible,
    refreshOnStart: false,
    refresh: (reason) => reasons.push(reason),
  });

  controller.start();
  timers.runIntervals();
  controller.resume();
  assert.deepEqual(reasons, []);

  visible = true;
  controller.resume();
  assert.deepEqual(reasons, ["resume"]);
  assert.equal([...timers.intervals.values()][0].delay, 60_000);
  controller.stop();
});

test("applyRealtimeShot updates exact table and analysis totals without a fetch", () => {
  const state = {
    date: "2026-08-05",
    filter: "all",
    rows: [
      { id: "shot-2", created_at: Date.parse("2026-08-05T02:00:00Z"), shot_ms: 25_000 },
      { id: "shot-1", created_at: Date.parse("2026-08-05T01:00:00Z"), shot_ms: 24_000 },
    ],
    total: 2,
    page: 1,
    pagination: { page: 1, page_size: 5, page_count: 1 },
    daySummary: { total: 2, consistent: 2, consistency_percent: 100 },
    analysisRange: { start_date: "2026-08-05", end_date: "2026-08-05" },
    analysisWindow: { min_date: "2026-01-10", max_date: "2026-08-05" },
    analysisAllHistory: false,
    analysis: {
      total: 2,
      sum_ms: 49_000,
      average_ms: 24_500,
      consistent: 2,
      consistency_percent: 100,
      consistency_30d_percent: 100,
      recent_30d: { total: 2, consistent: 2 },
      buckets: { under20: 0, "20to25": 1, "25to28": 1, "28to30": 0, over30: 0 },
      daily: [{ date: "2026-08-05", count: 2, sum_ms: 49_000, average_ms: 24_500, consistent: 2, consistency_percent: 100 }],
      shot_points: [
        { id: "shot-1", created_at: Date.parse("2026-08-05T01:00:00Z"), shot_ms: 24_000 },
        { id: "shot-2", created_at: Date.parse("2026-08-05T02:00:00Z"), shot_ms: 25_000 },
      ],
    },
  };
  const message = {
    id: "shot-3",
    created_at: Date.parse("2026-08-05T03:00:00Z"),
    shot_ms: 26_000,
    brew_counter: 3,
    avg_ms: 25_000,
  };

  const result = applyRealtimeShot(state, message);

  assert.equal(result.applied, true);
  assert.equal(result.shotsChanged, true);
  assert.equal(result.analysisChanged, true);
  assert.equal(result.state.total, 3);
  assert.equal(result.state.rows[0].id, "shot-3");
  assert.deepEqual(result.state.daySummary, { total: 3, consistent: 3, consistency_percent: 100 });
  assert.equal(result.state.analysis.total, 3);
  assert.equal(result.state.analysis.sum_ms, 75_000);
  assert.equal(result.state.analysis.average_ms, 25_000);
  assert.equal(result.state.analysis.buckets["25to28"], 2);
  assert.deepEqual(result.state.analysis.recent_30d, { total: 3, consistent: 3 });
  assert.equal(result.state.analysis.daily[0].average_ms, 25_000);
  assert.equal(result.state.analysis.shot_points.at(-1).id, "shot-3");
  assert.equal(applyRealtimeShot(result.state, message).reason, "duplicate");
  assert.equal(state.total, 2, "the helper does not mutate its input state");
});
