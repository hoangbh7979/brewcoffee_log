import test from "node:test";
import assert from "node:assert/strict";

import { createRealtimeController } from "../src/page-client.js";

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
    refresh: () => { refreshes += 1; },
    onMessage: (event) => messages.push(event.data),
  });
  return {
    controller,
    messages,
    sockets,
    statuses,
    events,
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
