import { Avatar } from "../entities/Avatar.js";
import { getCharacter } from "../data/characters.js";
import { LAYOUT } from "../world/layout.js";
import { Net } from "./Net.js";

const SEND_EVERY = 0.1;
const HEARTBEAT = 1.0;

/**
 * Glue between the realtime channel and the island. Pibo's walker still owns
 * input, collision and flight; when you play an animal, his drawing is hidden
 * and your animal follows him. Everyone else is an Avatar eased toward the
 * last position they sent.
 */
export class Multiplayer {
  constructor(game, lobby) {
    this.game = game;
    this.lobby = lobby;
    this.remotes = new Map();
    this.local = null;
    this._sendT = 0;
    this._beatT = 0;
    this._last = "";

    lobby.onJoin = ({ world, me }) => this.start(world, me);
    lobby.onGoHome = () => this.goTo(`home:${this.me.id}`);
    lobby.onGoWorld = () => this.goTo("world");
    lobby.onInvite = (id) => {
      this.net?.invite(id);
      if (this.net?.space !== `home:${this.me.id}`) this.goTo(`home:${this.me.id}`);
      this.game.ui.toast("Invite sent. Waiting in your room 🏠", 2400);
    };
    lobby.onToast = (text) => this.game.ui.toast(text, 2200);
  }

  get space() {
    return this.net?.space || "world";
  }

  start(world, me) {
    this.me = me;
    this._useCharacter(me.char);
    this._spawn();
    this.game.started = true;
    this.game.ui.hideIntro?.();
    this.game.canvas.focus();

    const net = new Net({ world, me });
    this.net = net;
    net.onStatus = (status) => {
      if (status === "SUBSCRIBED") this.game.ui.toast(`Welcome to ${world} ✨`, 2200);
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") this.game.ui.toast("Offline for now. Still playable solo.", 2600);
    };
    net.onPeers = () => this._syncPeers();
    net.onMove = (p) => this._onMove(p);
    net.onHello = () => {
      this._last = "";
      this._beatT = HEARTBEAT;
    };
    net.onInvite = ({ name, space }) => {
      this.lobby.showInvite(name, () => this.goTo(space));
    };
    net.connect();
    this._refreshBar();
  }

  _useCharacter(charId) {
    const pibo = this.game.pibo;
    if (charId === "pibo") {
      pibo.mesh.visible = true;
      pibo.shadow.visible = true;
      return;
    }
    const def = getCharacter(charId).def;
    this.local = new Avatar({
      textures: this.game.textures,
      basis: this.game.basis,
      def,
      name: this.me.name,
      x: pibo.x,
      z: pibo.z,
    });
    this.game.scene.add(this.local.group);
    pibo.mesh.visible = false;
    pibo.shadow.visible = false;
  }

  _spawn() {
    const s = LAYOUT.start;
    const a = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 0.6;
    this.game.pibo.placeAt(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, 0, 1, this.game.collision);
    this.game._frameCameraOnPibo();
  }

  goTo(space) {
    if (!this.net || space === this.net.space) return;
    this.game._travelTo?.(LAYOUT.start, { x: LAYOUT.start.x, z: LAYOUT.start.z + 1 });
    this._spawn();
    this.net.setSpace(space);
    this._last = "";
    this._beatT = HEARTBEAT;
    const mine = space === `home:${this.me.id}`;
    const host = this.net.peers.get(space.replace(/^home:/, ""));
    if (space === "world") this.game.ui.toast("Back in the world 🌍", 1800);
    else if (mine) this.game.ui.toast("Your own room. Invite friends from the list 🏠", 2600);
    else this.game.ui.toast(`Visiting ${host?.name || "a friend"}'s room 🏠`, 2200);
    this._syncPeers();
  }

  _syncPeers() {
    const peers = this.net.peers;
    for (const [id, avatar] of this.remotes) {
      const p = peers.get(id);
      if (!p || p.space !== this.space || p.char !== avatar.charId) {
        this.game.scene.remove(avatar.group);
        this.remotes.delete(id);
      }
    }
    for (const p of peers.values()) {
      if (p.space !== this.space || this.remotes.has(p.id)) continue;
      const avatar = new Avatar({
        textures: this.game.textures,
        basis: this.game.basis,
        def: getCharacter(p.char).def,
        name: p.name,
        x: LAYOUT.start.x,
        z: LAYOUT.start.z,
      });
      avatar.charId = p.char;
      avatar.peerName = p.name;
      avatar.setVisible(false);
      this.game.scene.add(avatar.group);
      this.remotes.set(p.id, avatar);
    }
    for (const [id, avatar] of this.remotes) {
      const name = peers.get(id)?.name;
      if (name && name !== avatar.peerName) {
        avatar.peerName = name;
        avatar.setName(name);
      }
    }
    this._hideTakenCritters();
    this._refreshBar();
  }

  _onMove(p) {
    if (p.s !== this.space) return;
    const avatar = this.remotes.get(p.id);
    if (!avatar) return;
    const first = !avatar.seen;
    avatar.seen = true;
    avatar.setTarget(p);
    if (first) avatar.snap();
    avatar.setVisible(p.v !== 0);
  }

  _hideTakenCritters() {
    const taken = new Set([this.me.char]);
    for (const p of this.net.peers.values()) if (p.space === this.space) taken.add(p.char);
    const inRoom = this.space !== "world";
    for (const critter of this.game.critters) critter.group.visible = !inRoom && !taken.has(critter.id);
  }

  _refreshBar() {
    const peers = [...this.net.peers.values()];
    const here = peers.filter((p) => p.space === this.space).length + 1;
    const host = this.net.peers.get(this.space.replace(/^home:/, ""));
    this.lobby.setWhere({ space: this.space, count: here, hostName: host?.name });
    this.lobby.setPeople(peers, this.space);
  }

  update(dt) {
    if (!this.net) return;
    const pibo = this.game.pibo;
    if (this.local) {
      this.local.follow(dt, pibo);
      this.local.setVisible(pibo.group.visible);
    }
    for (const avatar of this.remotes.values()) avatar.drive(dt);

    this._sendT += dt;
    this._beatT += dt;
    if (this._sendT < SEND_EVERY) return;
    this._sendT = 0;
    const state = {
      x: round(pibo.x),
      z: round(pibo.z),
      fx: round(pibo.faceX),
      fz: round(pibo.faceZ),
      m: pibo.moving ? 1 : 0,
      f: pibo.flying ? 1 : 0,
      v: pibo.group.visible ? 1 : 0,
    };
    const key = JSON.stringify(state);
    if (key === this._last && this._beatT < HEARTBEAT) return;
    this._last = key;
    this._beatT = 0;
    this.net.sendMove(state);
  }
}

function round(n) {
  return Math.round(n * 100) / 100;
}
