import * as THREE from "three";
import { Input } from "./Input.js";
import { tangentToward } from "./SphereMath.js";
import { Planet } from "../world/Planet.js";
import { Environment } from "../world/Environment.js";
import { Props } from "../world/Props.js";
import { Ambient } from "../world/Ambient.js";
import { GardenSystem } from "../systems/GardenSystem.js";
import { Pibo } from "../entities/Pibo.js";
import { LAYOUT, dirOf } from "../world/layout.js";
import { getPlant } from "../data/plants.js";
import { UI } from "../ui/UI.js";

/**
 * Top-level orchestrator. Owns the renderer, the planet and its systems, the
 * player, and the update loop, and mediates the tiny interaction contract
 * between Pibo, the garden, and the UI. Deliberately small: each subsystem is
 * self-contained so future planets, entities, and systems slot in here.
 */
export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.clock = new THREE.Clock();
    this.started = false;

    this._initRenderer();
    this._initScene();
    this._initWorld();
    this._initPlayer();
    this._initCamera();

    this.input = new Input();
    this.ui.attachInput(this.input);
    window.addEventListener("resize", () => this._onResize());

    this._camUp = this.pibo.dir.clone();
    this._camForward = this.pibo.forward.clone();
    this._camTarget = this.pibo.worldPosition();
  }

  _initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearAlpha(0); // let the CSS sky show through
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.env = new Environment(this.scene, 10);
  }

  _initWorld() {
    this.planet = new Planet({ radius: 10 });
    this.scene.add(this.planet.group);

    this.props = new Props(this.planet).build();

    this.garden = new GardenSystem(this.planet).build();
    this.garden.onBloom = (spot) => {
      const plant = getPlant(spot.plantId);
      this.ui.addGrown(plant);
      this.ui.toast(`Your ${plant.name} bloomed ${plant.emoji}`, 2400);
    };
    this.garden.onAllGrown = () => this._reward();

    this.ambient = new Ambient(this.scene, 10);
  }

  _initPlayer() {
    const start = dirOf(LAYOUT.start);
    const forward = tangentToward(start, dirOf(LAYOUT.garden[1]));
    this.pibo = new Pibo(this.planet, start, forward);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      34,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.camHeight = 9.5;
    this.camBack = 13.5;
    // seed a sensible starting pose
    const p = this.pibo.worldPosition();
    this.camera.position.copy(p)
      .add(this.pibo.dir.clone().multiplyScalar(this.camHeight))
      .add(this.pibo.forward.clone().multiplyScalar(-this.camBack));
    this.camera.up.copy(this.pibo.dir);
    this.camera.lookAt(p);
  }

  start() {
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    const frozen = this.ui.isModalOpen;
    this.pibo.update(dt, this.input, { frozen });

    if (!this.started && this.pibo.moving) {
      this.started = true;
      this.ui.hideIntro();
    }

    this._updateCamera(dt);
    this._handleInteraction();

    this.env.update(dt);
    this.props.update(dt);
    this.garden.update(dt);
    this.ambient.update(dt);

    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  _updateCamera(dt) {
    const k = 1 - Math.exp(-6 * dt); // smoothing factor
    const p = this.pibo.worldPosition();

    // smooth the basis so turning doesn't whip the camera around
    this._camUp.lerp(this.pibo.dir, k).normalize();
    this._camForward.lerp(this.pibo.forward, k * 0.6).normalize();

    const desired = p.clone()
      .add(this._camUp.clone().multiplyScalar(this.camHeight))
      .add(this._camForward.clone().multiplyScalar(-this.camBack));

    this.camera.position.lerp(desired, k);
    this.camera.up.copy(this._camUp);

    // look a touch ahead of and above Pibo
    const lookAt = p.clone()
      .add(this._camUp.clone().multiplyScalar(1.6))
      .add(this._camForward.clone().multiplyScalar(1.4));
    this._camTarget.lerp(lookAt, k);
    this.camera.lookAt(this._camTarget);
  }

  _handleInteraction() {
    const ui = this.ui;

    // While a panel/fact is open, route only modal keys.
    if (ui.isModalOpen) {
      ui.hidePrompt();
      if (ui.isPanelOpen) {
        if (this.input.consume("Digit1", "Numpad1")) ui.pickByIndex(0);
        else if (this.input.consume("Digit2", "Numpad2")) ui.pickByIndex(1);
        else if (this.input.consume("Digit3", "Numpad3")) ui.pickByIndex(2);
        else if (this.input.consume("Escape")) ui.closePanel();
      } else {
        if (this.input.consume("Escape", "KeyE", "Enter")) ui.closeFact();
      }
      return;
    }

    const p = this.pibo.worldPosition();
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
        const plant = this.garden.factFor(it.spot);
        ui.showFact(plant);
      }
    }
  }

  _reward() {
    const ui = this.ui;
    ui.toast("The whole garden is blooming ✨", 3000);
    this.props.setObservatoryLit(true);
    setTimeout(() => {
      this.props.revealBridge();
      ui.toast("A little bridge appears by the water 🌉", 3000);
    }, 1600);
    setTimeout(() => {
      this.props.revealBloom();
      ui.toast("Something new is growing in the meadow 🌸", 3200);
    }, 3400);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
