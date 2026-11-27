import * as THREE from "three";
import { Input } from "./Input.js";
import { Collision } from "./Collision.js";
import { Island } from "../world/Island.js";
import { SpriteSet } from "../world/SpriteSet.js";
import { PLATE_H, PLATE_W, clampFollow, isoBasis, isPhoneLandscape, orthoSize } from "../world/iso.js";
import { isFlightAir, loadWalkMask } from "../world/biome.js";
import { LAYOUT, PLACEMENTS, collidersFromPlacements } from "../world/layout.js";
import { ASSETS, collectSources } from "../data/assets.js";
import { loadTextureSet, textureSizes } from "../world/textures.js";
import { GardenSystem } from "../systems/GardenSystem.js";
import { TvStudio } from "../systems/TvStudio.js";
import { ArcadeRoom } from "../systems/ArcadeRoom.js";
import { ArcadeHall } from "../ui/ArcadeHall.js";
import { MarketRoom } from "../ui/MarketRoom.js";
import { getCharacter } from "../data/characters.js";
import { LibraryRoom } from "../systems/LibraryRoom.js";
import { Pibo } from "../entities/Pibo.js";
import { Critter } from "../entities/Critter.js";
import { SpeechBubbles } from "../ui/SpeechBubbles.js";
import { CRITTERS } from "../data/critters.js";
import { getPlant } from "../data/plants.js";
import { PIBO_SCALE, SHOW_VILLAGE_FRIENDS } from "../config.js";

const ENTER_RANGE = 2.15;
// The painted pot sits in the lower part of its picture (the rest is empty).
// This is the center of the opaque pixels, as a fraction of the art height
// up from the feet, so the camera centers the pot and not the empty margin.
const POT_CENTER = 0.27;
// Exponential follow rate. Higher is tighter. A resize, the first frame,
// and a return from a room or a flight snap instead of easing.
const CAM_FOLLOW = 7;

/**
 * Isometric island. The camera angle stays fixed; it only slides to follow
 * Pibo. Props are images from the asset manifest. Studio, arcade, garden,
 * and the hidden friends keep their old jobs. Paria's eight little animals
 * stay near home. Walk up and talk with them in English. Pibo is the only pot.
 */
export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.clock = new THREE.Clock();
    this.started = false;
    this.basis = isoBasis(48);

    this._initRenderer();
    this._initScene();
    this.input = new Input();
    this.ui.attachInput(this.input);
    this._bindViewport();
    window.addEventListener("keydown", (e) => {
      if (!["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) return;
      this.started = true;
      this.ui.hideIntro();
    });

    this._focus = new THREE.Vector3(LAYOUT.start.x, 0.6, LAYOUT.start.z);
    this._isoOffset = this.basis.offset.clone();
    this._guideTip = new THREE.Vector3();
    this._guideNdc = new THREE.Vector3();
    this._wasFlying = false;
    this._viewW = PLATE_W;
    this._viewH = 18;
    this._phoneLandscape = false;
    this._camX = 0;
    this._camY = 0;

    this.ui.onGoToLighthouse = () => this._goToLighthouse();
    this.ui.onMapHere = () => this._playerMapPos();
    this.ui.onGoToArcade = () => this._goToArcade();
    this.ui.onGoToLibrary = () => this._goToLibrary();
    this.ui.onMapTravel = (placeId) => {
      if (placeId === "lighthouse") this._goToLighthouse();
      else if (placeId === "arcade") this._goToArcade();
      else if (placeId === "library") this._goToLibrary();
    };
  }

  async preload() {
    const sources = collectSources(ASSETS);
    const [textures] = await Promise.all([
      loadTextureSet(sources, textureSizes(ASSETS)),
      loadWalkMask(ASSETS.walkMask.src),
    ]);
    this.textures = textures;
    this._initWorld();
    this._initPlayer();
    this._initCamera();
  }

  _playerMapPos() {
    return { x: this.pibo.x, z: this.pibo.z };
  }

  _initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    const box = this._measureViewport();
    renderer.setPixelRatio(box.dpr);
    renderer.setSize(box.w, box.h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.sortObjects = true;
    this.renderer = renderer;
  }

  _initScene() {
    this.scene = new THREE.Scene();
  }

  _initWorld() {
    this.island = new Island(this.scene, this.textures);
    this.sprites = new SpriteSet(this.scene, this.textures);
    this.collision = new Collision(collidersFromPlacements(PLACEMENTS, ASSETS));

    // Garden beds are not in the concept painting, so they stay off the island.
    this.garden = new GardenSystem(this.scene, { isoQuat: this.basis.quaternion });
    this.garden.onBloom = (spot) => {
      const plant = getPlant(spot.plantId);
      this.ui.addGrown(plant);
      this.ui.toast(`Your ${plant.name} bloomed ${plant.emoji}`, 2400);
    };
    this.garden.onAllGrown = () => this._reward();

    this.studio = new TvStudio(null, { outdoorScreen: null });
    this.arcadeRoom = new ArcadeRoom(this.canvas);
    this.arcadeRoom.onPlay = (id) => this.ui.arcade?.hitPlay(id);
    this.arcadeRoom.onMove = (id, x, y, commit) => this.ui.arcade?.moveOnScreen(id, x, y, commit);
    this.ui.arcade.onScreen = (view) => this.arcadeRoom.show(view);
    this.ui.onArcadeLeave = () => this._leaveArcade();
    this.hall = new ArcadeHall({
      onClose: () => this._leaveArcade(),
      onBuild: (recipe) => this.multiplayer?.buildGame(recipe),
      onStart: () => this.multiplayer?.startGame(),
      getPlayers: () => this.multiplayer?.roomPlayers() || [],
    });
    this.market = new MarketRoom({
      onClose: () => this._leaveMarket(),
      getPlayer: () => {
        const me = this.multiplayer?.me;
        return { name: me?.name || "Pibo", thumb: getCharacter(me?.char || "pibo").thumb };
      },
      getFriendStalls: () => this.multiplayer?.friendStalls() || [],
      onStall: (stall) => this.multiplayer?.setStall(stall),
      onTrophy: () => this.ui.toast("New trophy in your mushroom house 🏆", 2600),
    });
    this.libraryRoom = new LibraryRoom();
    this.ui.onLibraryLeave = () => this._leaveLibrary();
    this.ui.onArtLeave = () => this._leaveArt();
    this.ui.onArtChange = (look, charId) => {
      if (charId === "pibo") this.pibo?.applyLook(look);
      else this.multiplayer?.setLook(look);
    };
    this.ui.onTrophyLeave = () => this._leaveTrophy();
    this.ui.onTrophyDecor = (decor) => this.multiplayer?.setDecor(decor);
    this.ui.onNpcClose = () => {
      this._talking?.setTalking(false);
      this._talking = null;
    };
  }

  _initPlayer() {
    const start = LAYOUT.start;
    this.pibo = new Pibo({
      textures: this.textures,
      basis: this.basis,
      x: start.x,
      z: start.z,
      scale: PIBO_SCALE,
    });
    this.scene.add(this.pibo.group);
    this.critters = CRITTERS.map((def) => new Critter({
      textures: this.textures,
      basis: this.basis,
      def,
    }));
    for (const critter of this.critters) this.scene.add(critter.group);

    this.friendsVisible = SHOW_VILLAGE_FRIENDS;
    this.companion = new Pibo({
      textures: this.textures,
      basis: this.basis,
      x: LAYOUT.companion.x,
      z: LAYOUT.companion.z,
      controllable: false,
      tint: 0x9ec8f8,
    });
    this.pino = new Pibo({
      textures: this.textures,
      basis: this.basis,
      x: LAYOUT.pino.x,
      z: LAYOUT.pino.z,
      controllable: false,
      scale: 0.62,
      tint: 0xfff6ea,
    });
    this.scene.add(this.companion.group);
    this.scene.add(this.pino.group);
    if (!this.friendsVisible) {
      this.companion.setVisible(false);
      this.pino.setVisible(false);
    }
    this.letterRead = false;
  }

  /**
   * The visible page, not the layout viewport. iOS Safari's address bar
   * changes visualViewport without a window resize, and for a frame after
   * rotation the layout size is still the old orientation. devicePixelRatio
   * is capped at 2, matching the buffer we can afford on a phone.
   */
  _measureViewport() {
    const vv = window.visualViewport;
    const w = vv?.width || window.innerWidth || this.canvas?.clientWidth || 1;
    const h = vv?.height || window.innerHeight || this.canvas?.clientHeight || 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return {
      w: Math.max(1, w),
      h: Math.max(1, h),
      dpr,
      top: vv?.offsetTop || 0,
      left: vv?.offsetLeft || 0,
    };
  }

  _sameViewport(box) {
    const prev = this._vp;
    if (!prev) return false;
    return Math.abs(prev.w - box.w) < 0.5
      && Math.abs(prev.h - box.h) < 0.5
      && Math.abs(prev.dpr - box.dpr) < 0.01
      && Math.abs(prev.top - box.top) < 0.5
      && Math.abs(prev.left - box.left) < 0.5;
  }

  _bindViewport() {
    const refresh = () => this._onResize();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", () => this._afterOrientation());
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    const vv = window.visualViewport;
    vv?.addEventListener("resize", refresh);
    vv?.addEventListener("scroll", refresh);
    this._watchPixelRatio();
  }

  _afterOrientation() {
    // iOS applies the new visual viewport and devicePixelRatio a frame
    // or two after orientationchange. The event itself still reports the
    // previous size, which would leave the camera on the old aspect.
    this._onResize();
    requestAnimationFrame(() => this._onResize());
    setTimeout(() => this._onResize(), 120);
    setTimeout(() => this._onResize(), 400);
  }

  _watchPixelRatio() {
    if (!window.matchMedia) return;
    const dpr = window.devicePixelRatio || 1;
    let media;
    try {
      media = window.matchMedia(`(resolution: ${dpr}dppx)`);
    } catch {
      return;
    }
    const onChange = () => {
      if (media.removeEventListener) media.removeEventListener("change", onChange);
      else media.removeListener?.(onChange);
      this._onResize();
      this._watchPixelRatio();
    };
    try {
      if (media.addEventListener) media.addEventListener("change", onChange);
      else media.addListener?.(onChange);
    } catch {
      // The per-frame visualViewport check still picks up a ratio change.
    }
  }

  _applyViewportBox(box) {
    const root = document.documentElement;
    root.style.setProperty("--app-width", `${box.w}px`);
    root.style.setProperty("--app-height", `${box.h}px`);
    root.style.setProperty("--app-top", `${box.top}px`);
    root.style.setProperty("--app-left", `${box.left}px`);
  }

  _initCamera() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 220);
    this._fitted = false;
    this._onResize();
  }

  /** Screen point on the pot, in the same plane the camera looks at. */
  _focusOnPibo() {
    const pibo = this.pibo;
    if (!pibo) return { x: 0, y: 0 };
    const height = (pibo.asset?.height || 2) * (pibo.charScale || 1);
    return { x: pibo.x, y: -pibo.z + height * POT_CENTER };
  }

  start() {
    this.animalBubbles = new SpeechBubbles({ camera: this.camera, canvas: this.canvas });
    this.ui.npc.onSpeak = (event) => this._onAnimalSpeak(event);
    this.renderer.setAnimationLoop(() => this._frame());
    this._maybeBootStudio();
  }

  _maybeBootStudio() {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.has("arcade")) {
        this._goToArcade();
        this._enterArcade();
        return;
      }
      if (q.has("library")) {
        this._goToLibrary();
        this._enterLibrary();
        return;
      }
      if (q.has("art")) {
        this._goToCottage();
        this._enterArt();
        return;
      }
      if (q.has("trophy")) {
        this._goToMushroom();
        this._enterTrophy();
        return;
      }
      if (q.has("market")) {
        this._goToMarket();
        this._enterMarket();
        return;
      }
      if (!q.has("studio") && !q.has("dock")) return;
      const pad = LAYOUT.lighthousePad;
      const face = this._faceToward(pad, LAYOUT.lighthouse);
      this.pibo.placeAt(pad.x, pad.z, face.x, face.z, this.collision);
      this.started = true;
      this.ui.hideIntro();
      this._frameCameraOnPibo();
      if (q.has("studio")) this._enterStudio();
    } catch {
      return;
    }
  }

  _frame() {
    // A fixed page often gets no resize when the iOS toolbar collapses.
    // Checking the visual viewport each frame is what keeps the frustum
    // on the pixels the player can actually see.
    const box = this._measureViewport();
    if (!this._sameViewport(box) || (this.camera && !this._fitted)) this._onResize();

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.multiplayer?.update(dt);
    this.animalBubbles?.update(dt);

    if (this.arcadeRoom.active) {
      this.arcadeRoom.update(dt);
      this.ui.arcade?.place(this.arcadeRoom.screenCssRect(this.canvas));
      this._handleArcadeInteraction();
      this.input.endFrame();
      this.renderer.render(this.arcadeRoom.scene, this.arcadeRoom.camera);
      return;
    }

    if (this.ui.isArtOpen) {
      this._handleArtInteraction();
      this.input.endFrame();
      return;
    }

    if (this.hall?.isOpen) {
      if (this.input.consume("Escape")) {
        if (!this.hall.builder.classList.contains("hidden")) this.hall.closeBuilder();
        else if (!this.hall.playing) this._leaveArcade();
      }
      this.input.endFrame();
      return;
    }

    if (this.ui.isTrophyOpen) {
      this._handleTrophyInteraction();
      this.input.endFrame();
      return;
    }

    if (this.market.isOpen) {
      if (this.input.consume("Escape") && !this.market.back()) this._leaveMarket();
      this.input.endFrame();
      return;
    }

    if (this.libraryRoom.active) {
      this.libraryRoom.update(dt);
      this._handleLibraryInteraction();
      this.input.endFrame();
      this.renderer.render(this.libraryRoom.scene, this.libraryRoom.camera);
      return;
    }

    if (this.studio.active) {
      this.studio.update(dt);
      this._handleStudioInteraction();
      this.input.endFrame();
      this.renderer.render(this.studio.scene, this.studio.camera);
      return;
    }

    const frozen = this.ui.isModalOpen || this.ui.isMapOpen || this.ui.isArcadeOpen || !!this.lobby?.isOpen;
    if (this.friendsVisible) {
      this.companion.update(dt, null, { frozen: true });
      this.pino.update(dt, null, { frozen: true });
    }

    this.pibo.update(dt, this.input, { frozen, collision: this.collision });
    if (!frozen) {
      for (const critter of this.critters) {
        critter.update(dt, this.collision, this.pibo, this.critters);
      }
      this._syncAnimalChatter();
    }

    if (!this.started && this.pibo.moving) {
      this.started = true;
      this.ui.hideIntro();
    }
    if (this.pibo.flying && !this._wasFlying) {
      this.ui.toast("Pibo takes off", 1400);
    }
    this._wasFlying = this.pibo.flying;

    this._updateCamera(dt);
    this._updateLighthouseGuide();
    this._handleInteraction();

    this.island.update(dt);
    this.sprites.update(dt);
    this.garden.update(dt);

    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  _updateCamera(dt = 0) {
    if (!this.camera) return;
    // Center on the pot on every viewport. The clamp is what keeps the
    // painting's edges from sliding in and showing blank around them.
    const focus = this._focusOnPibo();
    const target = clampFollow(focus.x, focus.y, this._viewW, this._viewH, PLATE_W, PLATE_H);
    const k = dt > 0 ? 1 - Math.exp(-dt * CAM_FOLLOW) : 1;
    this._camX += (target.x - this._camX) * k;
    this._camY += (target.y - this._camY) * k;
    this._camX = Math.min(target.limitX, Math.max(-target.limitX, this._camX));
    this._camY = Math.min(target.limitY, Math.max(-target.limitY, this._camY));
    this.camera.position.set(this._camX, this._camY, 40);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._camX, this._camY, 0);
  }

  _handleInteraction() {
    const ui = this.ui;

    if (this.pibo?.scriptedFlight) {
      ui.hidePrompt();
      return;
    }

    if (ui.isArcadeOpen) {
      ui.hidePrompt();
      if (this.input.consume("Escape")) ui.closeArcade();
      return;
    }

    if (ui.isMapOpen) {
      ui.hidePrompt();
      if (this.input.consume("Escape")) ui.closeMap();
      return;
    }

    if (ui.isNpcOpen) {
      ui.hidePrompt();
      if (this.input.consume("Escape")) ui.closeNpc();
      return;
    }

    if (ui.isModalOpen) {
      ui.hidePrompt();
      if (ui.isPanelOpen) {
        if (this.input.consume("Digit1", "Numpad1")) ui.pickByIndex(0);
        else if (this.input.consume("Digit2", "Numpad2")) ui.pickByIndex(1);
        else if (this.input.consume("Digit3", "Numpad3")) ui.pickByIndex(2);
        else if (this.input.consume("Escape")) ui.closePanel();
      } else if (this.input.consume("Escape", "KeyE", "Enter")) {
        ui.closeFact();
      }
      return;
    }

    const p = this.pibo.worldPosition();
    const tower = this.studio.getInteractable(p);
    if (tower) {
      ui.setPrompt(tower.label);
      if (this.input.consume("KeyE", "Enter")) this._enterStudio();
      return;
    }

    const cottage = this._near(p, LAYOUT.cottageDoor, 1.45)
      ? { label: "Art room" }
      : null;
    if (cottage) {
      ui.setPrompt(cottage.label);
      if (this.input.consume("KeyE", "Enter")) this._enterArt();
      return;
    }

    const mushroom = this._near(p, LAYOUT.mushroomDoor, 1.45);
    if (mushroom) {
      ui.setPrompt("My room");
      if (this.input.consume("KeyE", "Enter")) this._enterTrophy();
      return;
    }

    if (this._near(p, LAYOUT.marketDoor, 1.6)) {
      ui.setPrompt("Pibo Market");
      if (this.input.consume("KeyE", "Enter")) this._enterMarket();
      return;
    }

    const library = this._near(p, LAYOUT.libraryDoor, 1.45)
      ? { label: "Library" }
      : null;
    if (library) {
      ui.setPrompt(library.label);
      if (this.input.consume("KeyE", "Enter")) this._enterLibrary();
      return;
    }

    const arcade = this._near(p, LAYOUT.arcadeDoor, ENTER_RANGE)
      ? { label: "Enter arcade" }
      : null;
    if (arcade) {
      ui.setPrompt(arcade.label);
      if (this.input.consume("KeyE", "Enter")) this._enterArcade();
      return;
    }

    const critter = this._nearestCritter(p, 1.75);
    if (critter) {
      ui.setPrompt(`Talk to ${critter.name}`);
      if (this.input.consume("KeyE", "Enter")) this._openNpc(critter);
      return;
    }

    if (this.friendsVisible && Math.hypot(p.x - this.companion.x, p.z - this.companion.z) < 1.8) {
      ui.setPrompt("Talk");
      if (this.input.consume("KeyE", "Enter")) this._talkToCompanion();
      return;
    }

    const it = this.garden.getInteractable(p);
    if (!it) {
      ui.hidePrompt();
      return;
    }
    ui.setPrompt(it.label);
    if (it.disabled) return;
    if (this.input.consume("KeyE", "Enter")) {
      if (it.kind === "plant") {
        ui.openPlantPanel((plantId) => this.garden.plant(it.spot, plantId));
      } else if (it.kind === "inspect") {
        ui.showFact(this.garden.factFor(it.spot));
      }
    }
  }

  _near(p, spot, range) {
    return Math.hypot(p.x - spot.x, p.z - spot.z) < range;
  }

  _nearestCritter(p, range) {
    let best = null;
    let bestD = range;
    for (const critter of this.critters) {
      const dist = Math.hypot(p.x - critter.x, p.z - critter.z);
      if (dist < bestD) {
        best = critter;
        bestD = dist;
      }
    }
    return best;
  }

  _syncAnimalChatter() {
    const bubbles = this.animalBubbles;
    if (!bubbles) return;
    const talking = this._talking?.id;
    for (const critter of this.critters) {
      if (!critter.chatting || critter.id === talking) continue;
      bubbles.think(critter.id, () => bubbles.meshTop(critter.mesh, 0.5));
    }
  }

  _onAnimalSpeak(event) {
    const bubbles = this.animalBubbles;
    const id = event?.id;
    if (!bubbles || !id) return;
    const critter = this.critters?.find((c) => c.id === id);
    if (!critter) return;
    const anchor = () => bubbles.meshTop(critter.mesh, 0.5);
    if (event.phase === "typing") {
      bubbles.remove(id);
      bubbles.showDots(`talk:${id}`, anchor);
    } else if (event.phase === "text") {
      bubbles.showText(`talk:${id}`, event.text, anchor, { sticky: true });
    } else {
      bubbles.dismiss(`talk:${id}`);
    }
  }

  _openNpc(critter) {
    const p = this.pibo.worldPosition();
    critter.setTalking(true, this._faceToward(critter, p));
    this._talking = critter;
    this.ui.openNpc(critter);
  }

  _faceToward(from, to) {
    const x = to.x - from.x;
    const z = to.z - from.z;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }

  _talkToCompanion() {
    this.ui.showLetter({
      emoji: "💌",
      name: "",
      text: "I love you so much. I cannot wait to travel the world with you and beyond.\nMe + you + Pino always..",
      from: "— R",
      onClose: () => this._revealFamilyShip(),
    });
  }

  _revealFamilyShip() {
    if (this.letterRead) return;
    this.letterRead = true;
    this.ui.toast("They dream of a voyage together", 2800);
  }

  _handleArcadeInteraction() {
    if (this.input.consume("Escape")) this._leaveArcade();
  }

  _handleStudioInteraction() {
    if (this.ui.isIdeaOpen) {
      if (this.input.consume("Escape")) this.ui.closeIdeas();
      return;
    }
    const typing = this.ui.isStudioTyping;
    if (this.input.consume("Escape")) {
      this._leaveStudio();
      return;
    }
    if (!typing && this.input.consume("KeyE")) this._leaveStudio();
  }

  _enterStudio() {
    if (this.ui.isArtOpen) this._leaveArt("switch");
    if (this.ui.isTrophyOpen) this._leaveTrophy("switch");
    this.started = true;
    this.ui.hideIntro();
    this.ui.closeModals();
    this.ui.closeCollection();
    this.studio.enter();
    this.ui.openStudio({
      onGenerate: (prompt) => this._generateStudioClip(prompt),
      onLeave: () => this._leaveStudio(),
    });
    this.renderer.setClearColor(0x1c1730, 1);
    this.ui.toast("The lighthouse welcomes you ✨", 2400);
  }

  async _generateStudioClip(prompt) {
    this.ui.setStudioBusy(true);
    this.ui.setStudioStatus("Creating your show…");
    const clip = await this.studio.generate(prompt);
    if (!this.studio.active || !clip) {
      this.ui.setStudioBusy(false);
      return;
    }
    this.ui.setStudioBusy(false);
    if (clip.demo && clip.fallbackReason) {
      this.ui.setStudioStatus("Playing a demo show");
      this.ui.toast("Playing a toy demo on the screen ✨", 2400);
    } else if (clip.demo) {
      this.ui.setStudioStatus("Demo show playing on the screen");
      this.ui.toast("Your sentence is on the air ✨", 2200);
    } else {
      this.ui.setStudioStatus("On the air");
      this.ui.toast("Your show is on the screen ✨", 2200);
    }
  }

  _leaveStudio() {
    if (!this.studio.active) return;
    this.studio.leave();
    this.ui.closeStudio();
    this.renderer.setClearColor(0x000000, 0);
    this._frameCameraOnPibo();
    this.ui.toast("Back on your island", 2000);
  }

  _enterArcade() {
    if (this.ui.isIdeaOpen) this.ui.closeIdeas();
    if (this.studio.active) this._leaveStudio();
    if (this.libraryRoom.active) this._leaveLibrary("switch");
    if (this.ui.isArtOpen) this._leaveArt("switch");
    if (this.ui.isTrophyOpen) this._leaveTrophy("switch");
    if (this.hall?.isOpen) this._leaveArcade("switch");
    if (this.market?.isOpen) this._leaveMarket("switch");
    this.ui.closeModals();
    this.ui.closeCollection();
    this.ui.closeMap();
    this.started = true;
    this.ui.hideIntro();
    this.ui.hidePrompt();
    this.pibo.setVisible(false);
    this.hall.open();
    this.multiplayer?.enterHall();
    this.ui.toast("Build a game, then start it for everyone 🕹️", 2600);
  }

  _leaveArcade(reason = "exit") {
    if (!this.hall?.isOpen) return;
    this.multiplayer?.exitHall();
    this.hall.close();
    const pad = LAYOUT.arcadeDoor;
    const face = this._faceToward(pad, LAYOUT.arcade);
    this.pibo.setVisible(true);
    this.pibo.placeAt(pad.x, pad.z, face.x, face.z, this.collision);
    this._frameCameraOnPibo();
    if (reason === "exit") this.ui.toast("Back outside the arcade", 1600);
  }

  _goToArcade() {
    this._travelTo(LAYOUT.arcadeDoor, LAYOUT.arcade);
  }

  _goToLibrary() {
    this._travelTo(LAYOUT.libraryDoor, LAYOUT.library);
  }

  _goToCottage() {
    this._travelTo(LAYOUT.cottageDoor, { x: LAYOUT.cottageDoor.x, z: 0.2 });
  }

  _goToMushroom() {
    this._travelTo(LAYOUT.mushroomDoor, { x: LAYOUT.mushroomDoor.x, z: LAYOUT.mushroomDoor.z - 1.2 });
  }

  _handleArtInteraction() {
    if (this.input.consume("Escape")) this._leaveArt();
  }

  _handleTrophyInteraction() {
    if (this.input.consume("Escape")) this._leaveTrophy();
  }

  _enterArt() {
    if (this.ui.isIdeaOpen) this.ui.closeIdeas();
    if (this.studio.active) this._leaveStudio();
    if (this.libraryRoom.active) this._leaveLibrary("switch");
    if (this.ui.isTrophyOpen) this._leaveTrophy("switch");
    if (this.hall?.isOpen) this._leaveArcade("switch");
    if (this.market?.isOpen) this._leaveMarket("switch");
    this.ui.closeModals();
    this.ui.closeCollection();
    this.started = true;
    this.ui.hideIntro();
    this.pibo.setVisible(false);
    this.ui.openArt(this.pibo.facing);
    this.multiplayer?.enterArt();
  }

  _leaveArt(reason = "exit") {
    if (!this.ui.isArtOpen) return;
    this.multiplayer?.exitArt();
    this.ui.closeArt();
    const pad = LAYOUT.cottageDoor;
    const face = this._faceToward(pad, { x: pad.x, z: 0.2 });
    this.pibo.setVisible(true);
    this.pibo.placeAt(pad.x, pad.z, face.x, face.z, this.collision);
    this._frameCameraOnPibo();
  }

  /** The mushroom house is a personal room: yours, or the one you were invited to. */
  _enterTrophy(space) {
    if (this.ui.isIdeaOpen) this.ui.closeIdeas();
    if (this.studio.active) this._leaveStudio();
    if (this.libraryRoom.active) this._leaveLibrary("switch");
    if (this.ui.isArtOpen) this._leaveArt("switch");
    if (this.hall?.isOpen) this._leaveArcade("switch");
    if (this.market?.isOpen) this._leaveMarket("switch");
    this.ui.closeModals();
    this.ui.closeCollection();
    this.started = true;
    this.ui.hideIntro();
    this.pibo.setVisible(false);
    this.ui.openTrophy(this.multiplayer?.roomOwner(space) || { mine: true });
    this.multiplayer?.enterHome(space);
  }

  _leaveTrophy(reason = "exit") {
    if (!this.ui.isTrophyOpen) return;
    this.multiplayer?.exitHome();
    this.ui.closeTrophy();
    const pad = LAYOUT.mushroomDoor;
    const face = this._faceToward(pad, { x: pad.x, z: pad.z - 1.2 });
    this.pibo.setVisible(true);
    this.pibo.placeAt(pad.x, pad.z, face.x, face.z, this.collision);
    this._frameCameraOnPibo();
  }

  _goToMarket() {
    this._travelTo(LAYOUT.marketDoor, LAYOUT.market);
  }

  _enterMarket() {
    if (this.ui.isIdeaOpen) this.ui.closeIdeas();
    if (this.studio.active) this._leaveStudio();
    if (this.libraryRoom.active) this._leaveLibrary("switch");
    if (this.ui.isArtOpen) this._leaveArt("switch");
    if (this.ui.isTrophyOpen) this._leaveTrophy("switch");
    if (this.hall?.isOpen) this._leaveArcade("switch");
    this.ui.closeModals();
    this.ui.closeCollection();
    this.ui.closeMap();
    this.started = true;
    this.ui.hideIntro();
    this.ui.hidePrompt();
    this.pibo.setVisible(false);
    this.market.open();
  }

  _leaveMarket(reason = "exit") {
    if (!this.market?.isOpen) return;
    this.market.close();
    const pad = LAYOUT.marketDoor;
    const face = this._faceToward(pad, LAYOUT.market);
    this.pibo.setVisible(true);
    this.pibo.placeAt(pad.x, pad.z, face.x, face.z, this.collision);
    this._frameCameraOnPibo();
    if (reason === "exit") this.ui.toast("Back outside Pibo Market", 1600);
  }

  _handleLibraryInteraction() {
    if (this.input.consume("Escape")) this._leaveLibrary();
  }

  _enterLibrary() {
    if (this.ui.isIdeaOpen) this.ui.closeIdeas();
    if (this.studio.active) this._leaveStudio();
    if (this.ui.isArtOpen) this._leaveArt("switch");
    if (this.ui.isTrophyOpen) this._leaveTrophy("switch");
    if (this.hall?.isOpen) this._leaveArcade("switch");
    if (this.market?.isOpen) this._leaveMarket("switch");
    this.ui.closeModals();
    this.ui.closeCollection();
    this.started = true;
    this.ui.hideIntro();
    this.libraryRoom.enter();
    this.ui.openLibrary();
    this.renderer.setClearColor(0xf6efe2, 1);
    this.ui.toast("The library is quiet. Make a little story.", 2400);
  }

  _leaveLibrary(reason = "exit") {
    if (!this.libraryRoom.active && !this.ui.isLibraryOpen) return;
    this.libraryRoom.leave();
    this.ui.closeLibrary();
    this.renderer.setClearColor(0x000000, 0);
    this._frameCameraOnPibo();
    // Only a real exit (the Exit button or Escape) says so, and only briefly.
    // Closing the room to travel, or opening another place, stays quiet.
    if (reason === "exit") this.ui.toast("Back outside the library", 1400);
  }

  _goToLighthouse() {
    this._travelTo(LAYOUT.lighthousePad, LAYOUT.lighthouse);
  }

  _travelTo(pad, look) {
    if (this.ui.isIdeaOpen) this.ui.closeIdeas();
    if (this.studio.active) this._leaveStudio();
    if (this.libraryRoom?.active) this._leaveLibrary("switch");
    if (this.ui.isArtOpen) this._leaveArt("switch");
    if (this.ui.isTrophyOpen) this._leaveTrophy("switch");
    if (this.hall?.isOpen) this._leaveArcade("switch");
    if (this.market?.isOpen) this._leaveMarket("switch");
    this.ui.closeModals();
    this.ui.closeCollection();
    const face = this._faceToward(pad, look);
    this.pibo.setVisible(true);
    this.ui.hideIntro();
    this.started = true;
    const across = this._crossesAir(this.pibo.x, this.pibo.z, pad.x, pad.z);
    const far = Math.hypot(pad.x - this.pibo.x, pad.z - this.pibo.z) > 2.4;
    if (across || (far && across)) {
      this.pibo.flyTo(pad.x, pad.z, face, () => this._frameCameraOnPibo());
      this._frameCameraOnPibo();
      return;
    }
    this.pibo.placeAt(pad.x, pad.z, face.x, face.z, this.collision);
    this._frameCameraOnPibo();
  }

  _crossesAir(x0, z0, x1, z1) {
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isFlightAir(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0, 0, 0.15)) return true;
    }
    return false;
  }

  _updateLighthouseGuide() {
    // Travel buttons stay in the HUD. Nothing is drawn on the island.
    const indoors = this.studio.active || this.hall?.isOpen || this.market?.isOpen || this.libraryRoom.active || this.ui.isArtOpen || this.ui.isTrophyOpen;
    this.ui.setLighthouseGuide({ hidden: indoors });
  }

  _reward() {
    this.ui.toast("The whole garden is blooming ✨", 3000);
    setTimeout(() => {
      this.sprites.show("bridge");
      this.ui.toast("A little bridge appears by the water 🌉", 3000);
    }, 1600);
    setTimeout(() => {
      this.sprites.show("bloom");
      this.ui.toast("Something new is growing in the meadow 🌸", 3200);
    }, 3400);
  }

  _frameCameraOnPibo() {
    this._updateCamera();
  }

  _onResize() {
    const box = this._measureViewport();
    const unchanged = this._sameViewport(box);
    if (unchanged && this._fitted) return;
    this._vp = box;
    this._applyViewportBox(box);

    const { w, h, dpr } = box;
    const phone = isPhoneLandscape(w, h);
    const { viewW, viewH } = orthoSize(w, h);
    this._viewW = viewW;
    this._viewH = viewH;
    this._phoneLandscape = phone;
    document.documentElement.classList.toggle("phone-landscape", phone);
    if (phone) this.ui.useTouchControls();

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.studio?.resize(w, h);
    this.arcadeRoom?.resize(w, h);
    this.libraryRoom?.resize(w, h);
    this.ui.art?.layout();
    this.ui.trophy?.layout();
    this.market?.layout();

    if (!this.camera) return;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
    // Snap. Easing here would leave the old center outside the new window
    // for a few frames and show blank past the plate.
    this._updateCamera(0);
    this._fitted = true;
  }
}
