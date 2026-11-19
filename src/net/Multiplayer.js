import { Avatar } from "../entities/Avatar.js";
import { getCharacter } from "../data/characters.js";
import { cleanCritterLook, loadCritterLook } from "../entities/critterLook.js";
import { LAYOUT } from "../world/layout.js";
import { Net } from "./Net.js";

const SEND_EVERY = 0.1;
const HEARTBEAT = 1.0;
/** Art-room floor units per second (picture pixels / 100). */
const ART_SPEED = 2.4;

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
    this.me = { ...me, look: me.char === "pibo" ? null : loadCritterLook(me.char) };
    this._useCharacter(me.char);
    this._spawn();
    this.game.started = true;
    this.game.ui.hideIntro?.();
    this.game.canvas.focus();

    const net = new Net({ world, me: this.me });
    this.net = net;
    this._hideTakenCritters();
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
    this.game.ui.art?.setCharacter(charId);
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
    this.local.setLook(this.me.look);
    this.game.scene.add(this.local.group);
    pibo.mesh.visible = false;
    pibo.shadow.visible = false;
  }

  /** The art room changed the animal's hat or glasses. */
  setLook(look) {
    if (!this.me || this.me.char === "pibo") return;
    this.me.look = look;
    this.local?.setLook(look);
    this.net?.setProfile({ look });
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
        avatar.dispose();
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
      const p = peers.get(id);
      const name = p?.name;
      if (name && name !== avatar.peerName) {
        avatar.peerName = name;
        avatar.setName(name);
      }
      const look = p?.look && p.char !== "pibo" ? cleanCritterLook(p.look) : null;
      const lookKey = JSON.stringify(look);
      if (lookKey !== avatar.lookKey) {
        avatar.lookKey = lookKey;
        avatar.setLook(look);
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

  /**
   * The art room is its own space next to wherever you came from, so
   * everyone who walks in from the same world or room meets on its floor.
   */
  enterArt() {
    if (!this.net || this.art) return;
    this._artBase = this.space;
    const p = this.game.ui.art.spawnPoint();
    this.art = { x: p.x, y: p.y, fx: 0, fz: 1, moving: false };
    this.net.setSpace(`art:${this._artBase}`);
    this._last = "";
    this._beatT = HEARTBEAT;
    this._syncPeers();
  }

  exitArt() {
    if (!this.art) return;
    this.art = null;
    this.game.ui.art?.clearWalkers();
    if (!this.net) return;
    this.net.setSpace(this._artBase || "world");
    this._last = "";
    this._beatT = HEARTBEAT;
    this._syncPeers();
  }

  _updateArt(dt) {
    const a = this.art;
    const room = this.game.ui.art;
    const input = this.game.input;
    let dx = input.turn;
    let dy = -input.moveForward;
    const mag = Math.hypot(dx, dy);
    a.moving = mag > 0.08;
    if (a.moving) {
      dx /= mag;
      dy /= mag;
      const step = ART_SPEED * Math.min(1, mag) * dt;
      const next = room.moveOnFloor(a.x, a.y, dx * step, dy * step);
      a.x = next.x;
      a.y = next.y;
      a.fx = dx;
      a.fz = dy;
    }

    const walkers = [];
    if (this.local) {
      this.local.follow(dt, { x: a.x, z: a.y, faceX: a.fx, faceZ: a.fz, moving: a.moving, flying: false });
      walkers.push(walkerOf(this.local, "me", this.me.name, a.moving));
    } else {
      const pibo = this.game.pibo;
      pibo.faceX = a.fx;
      pibo.faceZ = a.fz;
      pibo.moving = a.moving;
      pibo._animate(dt);
      const view = pibo.facing;
      walkers.push({
        id: "me",
        name: this.me.name,
        image: pibo.material.map?.image,
        w: pibo.asset.width * pibo.charScale * (pibo._wide?.[view] || 1),
        h: pibo.asset.height * pibo.charScale * (pibo._grow?.[view] || 1),
        x: a.x,
        y: a.y,
        moving: a.moving,
      });
    }
    for (const [id, avatar] of this.remotes) {
      if (avatar.seen && avatar.group.visible) walkers.push(walkerOf(avatar, id, avatar.peerName, avatar.moving));
    }
    room.renderWalkers(walkers, dt);
  }

  update(dt) {
    if (!this.net) return;
    const pibo = this.game.pibo;
    for (const avatar of this.remotes.values()) avatar.drive(dt);
    if (this.art && this.game.ui.isArtOpen) {
      this._updateArt(dt);
    } else if (this.local) {
      this.local.follow(dt, pibo);
      this.local.setVisible(pibo.group.visible);
    }

    this._sendT += dt;
    this._beatT += dt;
    if (this._sendT < SEND_EVERY) return;
    this._sendT = 0;
    const a = this.art;
    const state = a
      ? { x: round(a.x), z: round(a.y), fx: round(a.fx), fz: round(a.fz), m: a.moving ? 1 : 0, f: 0, v: 1 }
      : {
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

function walkerOf(avatar, id, name, moving) {
  return {
    id,
    name,
    image: avatar.material.map?.image,
    w: avatar.width,
    h: avatar.height,
    x: avatar.x,
    y: avatar.z,
    moving,
  };
}
