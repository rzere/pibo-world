import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ggokzjnskrztjbsqqfcu.supabase.co";
// Publishable key: safe in the browser. Realtime broadcast and presence only.
const SUPABASE_KEY = "sb_publishable_N4ioii-m8dXtyX4DaNzDDA_Vpf0GemO";

let client = null;
function supabase() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 30 } },
    });
  }
  return client;
}

/**
 * One realtime channel per world (the word pair). Presence says who is here
 * and which space they stand in: the shared world, or someone's own room.
 * Broadcast carries movement and invites. Nothing is stored.
 */
export class Net {
  constructor({ world, me }) {
    this.world = world;
    this.me = { ...me };
    this.space = "world";
    this.peers = new Map();
    this.status = "idle";
    this.onPeers = null;
    this.onMove = null;
    this.onInvite = null;
    this.onChat = null;
    this.onStatus = null;
    this.channel = null;
  }

  connect() {
    const channel = supabase().channel(`pibo:w:${this.world}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this.me.id },
      },
    });
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => this._syncPeers());
    channel.on("broadcast", { event: "move" }, ({ payload }) => {
      if (!payload || payload.id === this.me.id) return;
      this.onMove?.(payload);
    });
    channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      if (!payload || payload.id === this.me.id || typeof payload.text !== "string") return;
      this.onChat?.(payload);
    });
    channel.on("broadcast", { event: "invite" }, ({ payload }) => {
      if (payload?.to !== this.me.id) return;
      this.onInvite?.(payload);
    });
    channel.on("broadcast", { event: "hello" }, ({ payload }) => {
      if (payload?.id !== this.me.id) this.onHello?.(payload);
    });
    channel.on("broadcast", { event: "arcade" }, ({ payload }) => {
      if (payload?.id !== this.me.id && payload?.s === this.space) this.onArcade?.(payload);
    });

    channel.subscribe((status) => {
      this._setStatus(status);
      if (status === "SUBSCRIBED") {
        this._track();
        this.send("hello", { id: this.me.id });
      }
    });
  }

  _setStatus(status) {
    this.status = status;
    this.onStatus?.(status);
  }

  _track() {
    if (this.status !== "SUBSCRIBED") return;
    this.channel.track({
      id: this.me.id,
      name: this.me.name,
      char: this.me.char,
      look: this.me.look || null,
      room: this.me.room || null,
      stall: this.me.stall || null,
      space: this.space,
      at: Date.now(),
    });
  }

  _syncPeers() {
    const state = this.channel.presenceState();
    const next = new Map();
    for (const [key, metas] of Object.entries(state)) {
      if (key === this.me.id) continue;
      const meta = metas[metas.length - 1];
      if (meta) next.set(key, { id: key, name: meta.name, char: meta.char, look: meta.look || null, room: meta.room || null, stall: meta.stall || null, space: meta.space });
    }
    this.peers = next;
    this.onPeers?.(next);
  }

  setSpace(space) {
    this.space = space;
    this._track();
  }

  setProfile({ name, char, look, room, stall }) {
    if (room) this.me.room = room;
    if (stall) this.me.stall = stall;
    if (name) this.me.name = name;
    if (char) this.me.char = char;
    if (look) this.me.look = look;
    this._track();
  }

  send(event, payload) {
    if (this.status !== "SUBSCRIBED") return;
    this.channel.send({ type: "broadcast", event, payload });
  }

  sendMove(state) {
    this.send("move", { id: this.me.id, s: this.space, ...state });
  }

  sendChat(text) {
    this.send("chat", { id: this.me.id, s: this.space, name: this.me.name, text });
  }

  invite(to) {
    this.send("invite", {
      to,
      from: this.me.id,
      name: this.me.name,
      space: `home:${this.me.id}`,
    });
  }

  leave() {
    if (this.channel) supabase().removeChannel(this.channel);
    this.channel = null;
  }
}

const ADJ = ["sunny", "mossy", "fizzy", "sleepy", "brave", "tiny", "cozy", "lucky", "misty", "rosy", "jolly", "minty", "breezy", "silly", "golden", "velvet"];
const NOUN = ["otter", "pebble", "teapot", "comet", "mango", "lantern", "meadow", "muffin", "acorn", "puffin", "island", "cloud", "pickle", "button", "garden", "harbor"];

export function randomWorldName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const b = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a}-${b}`;
}

export function cleanWorldName(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
