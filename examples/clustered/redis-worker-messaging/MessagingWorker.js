const { Worker } = require('../../../dist');

/**
 * Demonstrates the worker-to-worker messaging API introduced on top of the
 * existing SDK: `this.request(key)` for broadcast and
 * `this.directRequest(obnizId, key)` for targeting a single Worker.
 *
 * Each Worker keeps a local `tick` counter that increments every second.
 * Every MESSAGING_INTERVAL_MS, one Worker fans out a broadcast asking every
 * peer for its current tick, then sends a direct follow-up to one of them
 * asking for a greeting. Both responses are logged.
 *
 * To keep the console readable when there are multiple Workers, the
 * messaging loop is driven from `onLoop()` instead of a free-running
 * interval, and each Worker jitters its first fire time based on its
 * obnizId so the logs don't collide.
 */

const MESSAGING_INTERVAL_MS = 15 * 1000;

class MessagingWorker extends Worker {
  constructor(...args) {
    super(...args);
    this.tick = 0;
    // Deterministic per-obnizId jitter in [0, MESSAGING_INTERVAL_MS).
    // This staggers logs from different Workers in the same process.
    this._nextMessagingAt =
      Date.now() + hashJitter(this.deviceInfo.id, MESSAGING_INTERVAL_MS);
  }

  /**
   * Handle a request from another Worker (or from `App.request()` /
   * `App.directRequest()` on the Master). The `key` tells us what to reply
   * with; keep the protocol simple and string-only.
   */
  async onRequest(key) {
    switch (key) {
      case 'tick':
        return String(this.tick);
      case 'hello':
        return `hello from ${this.deviceInfo.id}`;
      default:
        return `unknown-key:${key}`;
    }
  }

  async onObnizConnect(obniz) {
    console.log(`[${this.deviceInfo.id}] obniz connected`);
  }

  /**
   * The SDK calls onLoop approximately once per second. We use it both
   * to advance the local state (`tick`) and to drive periodic messaging
   * to the other Workers without managing a separate timer.
   */
  async onLoop() {
    this.tick += 1;

    if (Date.now() < this._nextMessagingAt) return;
    this._nextMessagingAt = Date.now() + MESSAGING_INTERVAL_MS;

    try {
      await this._runMessagingDemo();
    } catch (e) {
      console.error(`[${this.deviceInfo.id}] messaging demo failed`, e);
    }
  }

  async _runMessagingDemo() {
    // --- 1. BROADCAST -----------------------------------------------------
    // Ask every reachable Worker (across every Slave instance in the
    // cluster, including this Worker's own Slave) for its current tick.
    // `this.request()` resolves as soon as every Slave has replied, or
    // falls back to the timeout if one is unreachable.
    console.log(`[${this.deviceInfo.id}] --> broadcast request('tick')`);
    const broadcast = await this.request('tick', 5000);
    console.log(
      `[${this.deviceInfo.id}] <-- broadcast response:`,
      broadcast
    );

    // --- 2. DIRECT --------------------------------------------------------
    // Pick a peer that isn't us and send a direct request. If we are the
    // only Worker in the cluster there is no one to talk to, so skip.
    const peerIds = Object.keys(broadcast).filter(
      (id) => id !== this.deviceInfo.id
    );
    if (peerIds.length === 0) {
      console.log(
        `[${this.deviceInfo.id}] (no peers to direct-message yet)`
      );
      return;
    }
    const targetId = peerIds[Math.floor(Math.random() * peerIds.length)];
    console.log(
      `[${this.deviceInfo.id}] --> directRequest('${targetId}', 'hello')`
    );
    const direct = await this.directRequest(targetId, 'hello', 5000);
    console.log(`[${this.deviceInfo.id}] <-- direct response:`, direct);
  }
}

/**
 * Cheap deterministic hash → [0, max). Used only to stagger log output.
 */
function hashJitter(seed, max) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % max;
}

module.exports = { MessagingWorker };
