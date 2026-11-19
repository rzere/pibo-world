import * as THREE from "three";
import { Input } from "./Input.js";
import { Collision } from "./Collision.js";
import { Island } from "../world/Island.js";
import { SpriteSet } from "../world/SpriteSet.js";
import { PLATE_H, PLATE_W, isoBasis, isPhoneLandscape, orthoSize } from "../world/iso.js";
import { isFlightAir, loadWalkMask } from "../world/biome.js";
import { LAYOUT, PLACEMENTS, collidersFromPlacements } from "../world/layout.js";
import { ASSETS, collectSources } from "../data/assets.js";
import { loadTextureSet, textureSizes } from "../world/textures.js";
import { GardenSystem } from "../systems/GardenSystem.js";
import { TvStudio } from "../systems/TvStudio.js";
import { ArcadeRoom } from "../systems/ArcadeRoom.js";
import { ArcadeHall } from "../ui/ArcadeHall.js";
import { LibraryRoom } from "../systems/LibraryRoom.js";
import { Pibo } from "../entities/Pibo.js";
import { Critter } from "../entities/Critter.js";
import { CRITTERS } from "../data/critters.js";
import { getPlant } from "../data/plants.js";
import { SHOW_VILLAGE_FRIENDS } from "../config.js";

const ENTER_RANGE = 2.15;

/**
 * Isometric island. The camera angle stays fixed; it only slides to follow
 * Pibo. Props are images from the asset manifest. Studio, arcade, garden,
 * and the hidden friends keep their old jobs. Paria's eight little animals hop
 * around the grass. Pibo is the only pot on the island.
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
    window.addEventListener("resize", () => this._onResize());
    window.visualViewport?.addEventListener("resize", () => this._onResize());
    window.visualViewport?.addEventListener("scroll", () => this._onResize());
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const { w, h } = this._viewport();
    renderer.setSize(w, h, false);
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
    this.libraryRoom = new LibraryRoom();
    this.ui.onLibraryLeave = () => this._leaveLibrary();
    this.ui.onArtLeave = () => this._leaveArt();
    this.ui.onArtChange = (look, charId) => {
      if (charId === "pibo") this.pibo?.applyLook(look);
      else this.multiplayer?.setLook(look);
    };
    this.ui.onTrophyLeave = () => this._leaveTrophy();
  }

  _initPlayer() {
    const start = LAYOUT.start;
    this.pibo = new Pibo({
      textures: this.textures,
      basis: this.basis,
      x: start.x,
      z: start.z,
      scale: 2 / 3,
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

  _viewport() {
    const vv = window.visualViewport;
    return {
      w: Math.round(vv?.width || window.innerWidth),
      h: Math.round(vv?.height || window.innerHeight),
    };
  }

  _initCamera() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 220);
    this._onResize();
  }

  start() {
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.multiplayer?.update(dt);

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
    // Keep the view inside the painting. A short window crops the top and
    // bottom evenly so the lighthouse stays on screen. Slide only on a
    // sideways phone, when the view is smaller than the picture.
    let x = 0;
    let y = 0;
    const pictureFits = this._viewW + 0.12 >= PLATE_W && this._viewH + 0.12 >= PLATE_H;
    if (this._phoneLandscape && this.pibo && !pictureFits) {
      const plateH = ASSETS.plate.height;
      const limitX = Math.max(0, (PLATE_W - this._viewW) / 2);
      const limitY = Math.max(0, (plateH - this._viewH) / 2);
      const focusY = -this.pibo.z + (this.pibo.asset?.height || 2) * (this.pibo.charScale || 1) * 0.35;
      x = Math.min(limitX, Math.max(-limitX, this.pibo.x));
      y = Math.min(limitY, Math.max(-limitY, focusY));
    }
    const k = dt > 0 ? 1 - Math.exp(-dt * 7) : 1;
    this._camX += (x - this._camX) * k;
    this._camY += (y - this._camY) * k;
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
      ui.setPrompt("Trophy room");
      if (this.input.consume("KeyE", "Enter")) this._enterTrophy();
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
    this.ui.setStudioStatus("Making your little show…");
    const clip = await this.studio.generate(prompt);
    if (!this.studio.active || !clip) {
      this.ui.setStudioBusy(false);
      return;
    }
    this.ui.setStudioBusy(false);
    if (clip.demo && clip.fallbackReason) {
      this.ui.setStudioStatus("Demo clip — hook a video API later");
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

  _enterTrophy() {
    if (this.ui.isIdeaOpen) this.ui.closeIdeas();
    if (this.studio.active) this._leaveStudio();
    if (this.libraryRoom.active) this._leaveLibrary("switch");
    if (this.ui.isArtOpen) this._leaveArt("switch");
    if (this.hall?.isOpen) this._leaveArcade("switch");
    this.ui.closeModals();
    this.ui.closeCollection();
    this.started = true;
    this.ui.hideIntro();
    this.pibo.setVisible(false);
    this.ui.openTrophy();
  }

  _leaveTrophy(reason = "exit") {
    if (!this.ui.isTrophyOpen) return;
    this.ui.closeTrophy();
    const pad = LAYOUT.mushroomDoor;
    const face = this._faceToward(pad, { x: pad.x, z: pad.z - 1.2 });
    this.pibo.setVisible(true);
    this.pibo.placeAt(pad.x, pad.z, face.x, face.z, this.collision);
    this._frameCameraOnPibo();
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
    const indoors = this.studio.active || this.hall?.isOpen || this.libraryRoom.active || this.ui.isArtOpen || this.ui.isTrophyOpen;
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
    const { w, h } = this._viewport();
    const phone = isPhoneLandscape(w, h);
    const { viewW, viewH } = orthoSize(w, h);
    this._viewW = viewW;
    this._viewH = viewH;
    this._phoneLandscape = phone;
    document.documentElement.classList.toggle("phone-landscape", phone);
    if (phone) this.ui.useTouchControls();
    if (!phone) {
      this._camX = 0;
      this._camY = 0;
    }
    if (!this.camera) return;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.studio?.resize(w, h);
    this.arcadeRoom?.resize(w, h);
    this.libraryRoom?.resize(w, h);
    this.ui.art?.layout();
    this.ui.trophy?.layout();
    this._updateCamera(0);
  }
}
