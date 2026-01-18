import type { CarSpec } from "../data/cars";
import { CARS } from "../data/cars";
import type { TerrainType } from "../data/terrains";
import { Renderer } from "../render/Renderer";
import { InputManager } from "../input/InputManager";
import { Hud } from "../ui/Hud";
import { Vehicle } from "../physics/Vehicle";
import {
  ROUTE_GRAPH,
  buildRoutePath,
  buildRouteSamples,
  nextNodeFromChoice,
  type RouteNode,
  type RouteSamples
} from "../tracks/RouteGraph";

export type GameState =
  | "start"
  | "select"
  | "garage"
  | "countdown"
  | "race"
  | "checkpoint"
  | "fork"
  | "finish"
  | "results"
  | "pause";

interface StageProgress {
  node: RouteNode;
  distance: number;
}

interface RewindSnapshot {
  timestamp: number;
  positionX: number;
  positionZ: number;
  heading: number;
  velocityX: number;
  velocityZ: number;
  yawRate: number;
  gear: number;
  engineRpm: number;
  stageDistance: number;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private skidGain: GainNode | null = null;

  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = "sawtooth";
      this.engineGain.gain.value = 0.02;
      this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
      const skidNoise = this.ctx.createBufferSource();
      skidNoise.buffer = this.createNoiseBuffer();
      skidNoise.loop = true;
      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.value = 0;
      skidNoise.connect(this.skidGain).connect(this.ctx.destination);
      skidNoise.start();
    }
  }

  update(engineRpm: number, skid: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.skidGain) return;
    const freq = 80 + (engineRpm / 7000) * 320;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    this.engineGain.gain.setTargetAtTime(0.015 + (engineRpm / 7000) * 0.02, this.ctx.currentTime, 0.05);
    this.skidGain.gain.setTargetAtTime(Math.min(0.08, skid * 0.15), this.ctx.currentTime, 0.05);
  }

  playBeep(frequency: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = frequency;
    osc.connect(gain).connect(this.ctx.destination);
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playChime(): void {
    if (!this.ctx) return;
    [440, 660, 880].forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + index * 0.08);
      osc.stop(this.ctx.currentTime + index * 0.2);
    });
  }

  private createNoiseBuffer(): AudioBuffer {
    const buffer = this.ctx?.createBuffer(1, 44100, 44100);
    if (!buffer) {
      throw new Error("Audio unavailable");
    }
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    return buffer;
  }
}

export class Game {
  private renderer: Renderer;
  private input: InputManager;
  private hud: Hud;
  private overlay: HTMLElement;
  private car: CarSpec = CARS[0];
  private vehicle: Vehicle;
  private state: GameState = "start";
  private stageProgress: StageProgress;
  private routeSamples: RouteSamples | null = null;
  private currentNodeId = "s1";
  private timer = 55;
  private stageTimerBonus = 25;
  private lastFrame = performance.now();
  private countdown = 3;
  private checkpointMessageTimer = 0;
  private forkChoice: "left" | "right" | null = null;
  private forkDistance = 0;
  private destination = "A";
  private rewindBuffer: RewindSnapshot[] = [];
  private rewindCharge = 1;
  private isPaused = false;
  private cameraModeIndex = 0;
  private audio = new AudioManager();
  private obstacles: { distance: number; lateral: number; hit: boolean }[] = [];

  constructor(renderer: Renderer, input: InputManager, hud: Hud, overlay: HTMLElement) {
    this.renderer = renderer;
    this.input = input;
    this.hud = hud;
    this.overlay = overlay;
    this.vehicle = new Vehicle(this.car, this.loadTuning(this.car));
    this.stageProgress = { node: ROUTE_GRAPH.s1, distance: 0 };
    this.resetRoute();
    this.renderOverlay();
  }

  start(): void {
    requestAnimationFrame((time) => this.loop(time));
  }

  private resetRoute(): void {
    const path = buildRoutePath(this.currentNodeId);
    this.destination = path.destination;
    this.routeSamples = buildRouteSamples(path.nodes);
    this.renderer.buildRoute(this.routeSamples);
    this.stageProgress = { node: ROUTE_GRAPH[this.currentNodeId], distance: 0 };
    this.createObstacles();
    this.updateObstacleVisuals();
  }

  private createObstacles(): void {
    this.obstacles = [];
    if (!this.routeSamples) return;
    for (let i = 600; i < this.routeSamples.distances[this.routeSamples.distances.length - 1]; i += 500) {
      this.obstacles.push({
        distance: i,
        lateral: (Math.random() - 0.5) * 5,
        hit: false
      });
    }
  }

  private updateObstacleVisuals(): void {
    if (!this.routeSamples) return;
    const positions = this.obstacles.map((obs) => {
      const sample = this.getSampleAtDistance(obs.distance);
      if (!sample) return { x: 0, y: 0, z: 0 };
      const nextSample = this.getSampleAtDistance(obs.distance + 20) ?? sample;
      const heading = Math.atan2(nextSample.point.x - sample.point.x, nextSample.point.z - sample.point.z);
      const right = { x: Math.cos(heading), z: -Math.sin(heading) };
      return {
        x: sample.point.x + right.x * obs.lateral,
        y: sample.point.y + 0.2,
        z: sample.point.z + right.z * obs.lateral
      };
    });
    this.renderer.setObstacles(positions);
  }

  private loop(time: number): void {
    const dt = Math.min(0.05, (time - this.lastFrame) / 1000);
    this.lastFrame = time;

    this.update(dt);
    this.renderer.render();

    requestAnimationFrame((next) => this.loop(next));
  }

  private update(dt: number): void {
    if (this.state === "start") return;

    const inputState = this.input.getState();

    if (this.input.consume("pause")) {
      this.togglePause();
    }

    if (this.isPaused) {
      return;
    }

    if (this.state === "countdown") {
      this.countdown -= dt;
      if (Math.abs(this.countdown - 2) < 0.02) {
        this.audio.playBeep(440);
      }
      if (Math.abs(this.countdown - 1) < 0.02) {
        this.audio.playBeep(440);
      }
      if (this.countdown <= 0) {
        this.audio.playBeep(880);
        this.state = "race";
      }
    }

    if (this.state === "race" || this.state === "checkpoint" || this.state === "fork") {
      const steer = inputState.steer;
      this.vehicle.update(dt, {
        throttle: inputState.throttle,
        brake: inputState.brake,
        steer,
        handbrake: inputState.handbrake
      });

      if (inputState.shiftUp && this.input.consume("shiftUp")) {
        this.vehicle.shiftUp();
      }
      if (inputState.shiftDown && this.input.consume("shiftDown")) {
        this.vehicle.shiftDown();
      }

      if (this.input.consume("camera")) {
        this.cycleCamera();
      }

      if (this.input.consume("rewind")) {
        this.tryRewind();
      }

      this.updateProgress(dt);
      this.audio.update(this.vehicle.state.engineRpm, this.vehicle.state.tireState.combinedSlip);
    }

    if (this.state === "finish") {
      this.checkpointMessageTimer -= dt;
      if (this.checkpointMessageTimer <= 0) {
        this.state = "results";
        this.renderOverlay();
      }
    }

    this.updateHud();
  }

  private updateProgress(dt: number): void {
    if (!this.routeSamples) return;

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this.state = "results";
      this.renderOverlay();
      return;
    }

    const stageLength = this.stageProgress.node.segment.length;
    const forwardSpeed = this.vehicle.state.velocity.z;
    this.stageProgress.distance = Math.max(0, this.stageProgress.distance + forwardSpeed * dt);

    const roadSample = this.getSampleAtDistance(this.stageProgress.distance);
    const roadWidth = roadSample?.width ?? 8;
    const terrain = roadSample?.terrain ?? "asphalt";
    this.vehicle.terrain = terrain;

    if (Math.abs(this.vehicle.state.position.x) > roadWidth) {
      this.vehicle.state.position.x = Math.sign(this.vehicle.state.position.x) * roadWidth;
      this.vehicle.state.velocity.x *= 0.4;
      this.vehicle.state.velocity.z *= 0.6;
      this.timer = Math.max(0, this.timer - 1.5);
    }

    this.obstacles.forEach((obs) => {
      if (obs.hit) return;
      if (Math.abs(this.stageProgress.distance - obs.distance) < 8 && Math.abs(this.vehicle.state.position.x - obs.lateral) < 2) {
        obs.hit = true;
        this.vehicle.state.velocity.z *= 0.4;
        this.timer = Math.max(0, this.timer - 2);
      }
    });

    this.recordRewindSnapshot();

    if (this.stageProgress.distance >= stageLength && this.state === "race") {
      if (this.stageProgress.node.destination) {
        this.state = "finish";
        this.checkpointMessageTimer = 3;
        this.renderOverlay();
        return;
      }
      this.state = "checkpoint";
      this.checkpointMessageTimer = 2.5;
      this.timer += this.stageTimerBonus;
      this.audio.playChime();
      this.renderOverlay();
    }

    if (this.state === "checkpoint") {
      this.checkpointMessageTimer -= dt;
      if (this.checkpointMessageTimer <= 0) {
        this.state = "fork";
        this.forkDistance = 140;
        this.forkChoice = null;
        this.renderOverlay();
      }
    }

    if (this.state === "fork") {
      this.forkDistance -= this.vehicle.state.speed * dt;
      if (this.vehicle.state.position.x < -1.2) {
        this.forkChoice = "left";
      } else if (this.vehicle.state.position.x > 1.2) {
        this.forkChoice = "right";
      }
      if (this.forkDistance <= 0 && this.forkChoice) {
        this.advanceStage(this.forkChoice);
      }
    }

    if (this.state === "race" || this.state === "fork" || this.state === "checkpoint") {
      this.updateCarWorldTransform();
    }
  }

  private updateCarWorldTransform(): void {
    if (!this.routeSamples) return;
    const sample = this.getSampleAtDistance(this.stageProgress.distance);
    if (!sample) return;

    const nextSample = this.getSampleAtDistance(this.stageProgress.distance + 20) ?? sample;
    const heading = Math.atan2(nextSample.point.x - sample.point.x, nextSample.point.z - sample.point.z);
    const lateral = this.vehicle.state.position.x;
    const right = { x: Math.cos(heading), z: -Math.sin(heading) };

    const worldX = sample.point.x + right.x * lateral;
    const worldZ = sample.point.z + right.z * lateral;
    const worldY = sample.point.y + 0.3;

    this.renderer.updateCar({
      position: { x: worldX, y: worldY, z: worldZ },
      heading: heading + this.vehicle.state.heading,
      speed: this.vehicle.state.speed,
      skidAmount: this.vehicle.state.tireState.combinedSlip,
      terrain: sample.terrain
    });
  }

  private getSampleAtDistance(distance: number): { point: { x: number; y: number; z: number }; width: number; terrain: TerrainType } | null {
    if (!this.routeSamples) return null;
    const index = this.routeSamples.distances.findIndex((d) => d >= distance);
    const idx = index === -1 ? this.routeSamples.distances.length - 1 : index;
    return {
      point: this.routeSamples.points[idx],
      width: this.routeSamples.widths[idx],
      terrain: this.routeSamples.terrainTypes[idx]
    };
  }

  private advanceStage(choice: "left" | "right"): void {
    const nextId = nextNodeFromChoice(this.stageProgress.node.id, choice);
    const nextNode = ROUTE_GRAPH[nextId];
    if (nextNode.destination) {
      this.state = "finish";
      this.checkpointMessageTimer = 3;
      this.renderOverlay();
      return;
    }

    this.currentNodeId = nextId;
    this.stageProgress = { node: nextNode, distance: 0 };
    this.vehicle.reset(0, 0);
    this.resetRoute();
    this.rewindCharge = 1;
    this.state = "race";
  }

  private recordRewindSnapshot(): void {
    const now = performance.now();
    this.rewindBuffer.push({
      timestamp: now,
      positionX: this.vehicle.state.position.x,
      positionZ: this.vehicle.state.position.z,
      heading: this.vehicle.state.heading,
      velocityX: this.vehicle.state.velocity.x,
      velocityZ: this.vehicle.state.velocity.z,
      yawRate: this.vehicle.state.yawRate,
      gear: this.vehicle.state.gear,
      engineRpm: this.vehicle.state.engineRpm,
      stageDistance: this.stageProgress.distance
    });

    this.rewindBuffer = this.rewindBuffer.filter((snap) => now - snap.timestamp < 3000);
  }

  private tryRewind(): void {
    if (this.rewindCharge <= 0 || this.rewindBuffer.length === 0) return;
    const snapshot = this.rewindBuffer[0];
    this.vehicle.state.position.x = snapshot.positionX;
    this.vehicle.state.position.z = snapshot.positionZ;
    this.vehicle.state.heading = snapshot.heading;
    this.vehicle.state.velocity.x = snapshot.velocityX;
    this.vehicle.state.velocity.z = snapshot.velocityZ;
    this.vehicle.state.yawRate = snapshot.yawRate;
    this.vehicle.state.gear = snapshot.gear;
    this.vehicle.state.engineRpm = snapshot.engineRpm;
    this.stageProgress.distance = snapshot.stageDistance;
    this.rewindCharge -= 1;
    this.rewindBuffer = [];
  }

  private cycleCamera(): void {
    this.cameraModeIndex = (this.cameraModeIndex + 1) % 2;
    this.renderer.setCameraMode(this.cameraModeIndex === 0 ? "chase" : "hood");
  }

  private updateHud(): void {
    const forkDistance = this.state === "fork" ? this.forkDistance : undefined;
    const forkSide = this.forkChoice ?? null;
    const message =
      this.state === "countdown"
        ? `${Math.ceil(this.countdown)}`
        : this.state === "checkpoint"
          ? "CHECKPOINT!"
          : this.state === "finish"
            ? "FINISH"
            : "";

    this.hud.update({
      speed: this.vehicle.state.speed,
      gear: this.vehicle.state.gear,
      timer: this.timer,
      stage: this.stageProgress.node.stage,
      destination: this.destination,
      forkDistance,
      forkSide,
      message
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.state = "pause";
    } else {
      if (this.state === "pause") {
        this.state = "race";
      }
    }
    this.renderOverlay();
  }

  private renderOverlay(): void {
    this.overlay.innerHTML = "";
    if (this.state === "start") {
      this.overlay.innerHTML = `
        <div class="overlay-panel">
          <h1>Low-Poly OutRun</h1>
          <p>Checkpoint time attack with branching routes and sharp turns.</p>
          <div class="overlay-grid">
            <button class="overlay-button" id="start-btn">Start</button>
            <button class="overlay-button secondary" id="settings-btn">Settings</button>
          </div>
        </div>
      `;
      this.overlay.style.display = "flex";
      const startBtn = document.querySelector("#start-btn") as HTMLButtonElement;
      const settingsBtn = document.querySelector("#settings-btn") as HTMLButtonElement;
      startBtn.onclick = () => {
        this.audio.resume();
        this.state = "select";
        this.renderOverlay();
      };
      settingsBtn.onclick = () => {
        this.audio.resume();
        this.showSettings();
      };
      return;
    }

    if (this.state === "select") {
      this.overlay.style.display = "flex";
      this.overlay.innerHTML = `
        <div class="overlay-panel">
          <h2>Select Car</h2>
          <div class="overlay-grid" id="car-list"></div>
          <div class="overlay-grid">
            <button class="overlay-button secondary" id="back-btn">Back</button>
          </div>
        </div>
      `;
      const list = this.overlay.querySelector("#car-list") as HTMLElement;
      CARS.forEach((car) => {
        const button = document.createElement("button");
        button.className = "overlay-button";
        button.textContent = car.name;
        button.onclick = () => {
          this.car = car;
          this.vehicle = new Vehicle(car, this.loadTuning(car));
          this.state = "garage";
          this.renderOverlay();
        };
        list.appendChild(button);
      });
      const backBtn = this.overlay.querySelector("#back-btn") as HTMLButtonElement;
      backBtn.onclick = () => {
        this.state = "start";
        this.renderOverlay();
      };
      return;
    }

    if (this.state === "garage") {
      this.overlay.style.display = "flex";
      const tuning = this.vehicle.tuning;
      this.overlay.innerHTML = `
        <div class="overlay-panel">
          <h2>Garage - ${this.car.name}</h2>
          <div class="settings-list">
            <div class="settings-row">
              <span>Manual Gearbox</span>
              <select id="manual-mode">
                <option value="off">Auto</option>
                <option value="on">Manual</option>
              </select>
            </div>
            <div class="settings-row">
              <span>Tire Compound</span>
              <select id="tire-compound">
                <option value="street">Street</option>
                <option value="sport">Sport</option>
                <option value="semi">Semi-slick</option>
              </select>
            </div>
            <div class="settings-row">
              <span>Pressure Front (psi)</span>
              <input type="range" min="28" max="38" step="1" id="pressure-front" />
            </div>
            <div class="settings-row">
              <span>Pressure Rear (psi)</span>
              <input type="range" min="28" max="38" step="1" id="pressure-rear" />
            </div>
            <div class="settings-row">
              <span>Final Drive</span>
              <input type="range" min="2.8" max="4.5" step="0.05" id="final-drive" />
            </div>
            <div class="settings-row">
              <span>Brake Bias (front)</span>
              <input type="range" min="0.5" max="0.7" step="0.02" id="brake-bias" />
            </div>
            <div class="settings-row">
              <span>Brake Strength</span>
              <input type="range" min="0.8" max="1.3" step="0.05" id="brake-strength" />
            </div>
            <div class="settings-row">
              <span>Weight Reduction</span>
              <input type="range" min="0" max="3" step="1" id="weight-reduction" />
            </div>
            <div class="settings-row">
              <span>Engine Stage</span>
              <input type="range" min="0" max="3" step="1" id="engine-stage" />
            </div>
          </div>
          <div class="overlay-grid">
            <button class="overlay-button" id="race-btn">Start Race</button>
            <button class="overlay-button secondary" id="back-btn">Back</button>
          </div>
        </div>
      `;

      (this.overlay.querySelector("#manual-mode") as HTMLSelectElement).value = this.vehicle.manualMode ? "on" : "off";
      (this.overlay.querySelector("#tire-compound") as HTMLSelectElement).value = tuning.tireSetup.compound;
      (this.overlay.querySelector("#pressure-front") as HTMLInputElement).value = tuning.tireSetup.pressureFrontPsi.toString();
      (this.overlay.querySelector("#pressure-rear") as HTMLInputElement).value = tuning.tireSetup.pressureRearPsi.toString();
      (this.overlay.querySelector("#final-drive") as HTMLInputElement).value = tuning.finalDrive.toString();
      (this.overlay.querySelector("#brake-bias") as HTMLInputElement).value = tuning.brakeBias.toString();
      (this.overlay.querySelector("#brake-strength") as HTMLInputElement).value = tuning.brakeStrength.toString();
      (this.overlay.querySelector("#weight-reduction") as HTMLInputElement).value = tuning.weightReduction.toString();
      (this.overlay.querySelector("#engine-stage") as HTMLInputElement).value = tuning.engineStage.toString();

      const updateTuning = () => {
        this.vehicle.manualMode = (this.overlay.querySelector("#manual-mode") as HTMLSelectElement).value === "on";
        this.vehicle.tuning.tireSetup.compound = (this.overlay.querySelector("#tire-compound") as HTMLSelectElement).value as
          | "street"
          | "sport"
          | "semi";
        this.vehicle.tuning.tireSetup.pressureFrontPsi = Number(
          (this.overlay.querySelector("#pressure-front") as HTMLInputElement).value
        );
        this.vehicle.tuning.tireSetup.pressureRearPsi = Number(
          (this.overlay.querySelector("#pressure-rear") as HTMLInputElement).value
        );
        this.vehicle.tuning.finalDrive = Number((this.overlay.querySelector("#final-drive") as HTMLInputElement).value);
        this.vehicle.tuning.brakeBias = Number((this.overlay.querySelector("#brake-bias") as HTMLInputElement).value);
        this.vehicle.tuning.brakeStrength = Number(
          (this.overlay.querySelector("#brake-strength") as HTMLInputElement).value
        );
        this.vehicle.tuning.weightReduction = Number(
          (this.overlay.querySelector("#weight-reduction") as HTMLInputElement).value
        );
        this.vehicle.tuning.engineStage = Number((this.overlay.querySelector("#engine-stage") as HTMLInputElement).value);
      };

      this.overlay.querySelectorAll("select, input").forEach((el) => {
        el.addEventListener("change", updateTuning);
      });

      const raceBtn = this.overlay.querySelector("#race-btn") as HTMLButtonElement;
      raceBtn.onclick = () => {
        updateTuning();
        this.saveTuning(this.car, this.vehicle.tuning);
        this.startRace();
      };

      const backBtn = this.overlay.querySelector("#back-btn") as HTMLButtonElement;
      backBtn.onclick = () => {
        this.state = "select";
        this.renderOverlay();
      };
      return;
    }

    if (this.state === "checkpoint") {
      this.overlay.style.display = "none";
      return;
    }

    if (this.state === "fork") {
      this.overlay.style.display = "flex";
      this.overlay.innerHTML = `
        <div class="overlay-panel">
          <h2>Fork Incoming</h2>
          <p>Steer into the left or right lane before the split. Choose your route!</p>
        </div>
      `;
      return;
    }

    if (this.state === "finish") {
      this.overlay.style.display = "flex";
      this.overlay.innerHTML = `
        <div class="overlay-panel">
          <h2>Finish</h2>
          <p>Destination ${this.destination}</p>
        </div>
      `;
      return;
    }

    if (this.state === "results") {
      this.overlay.style.display = "flex";
      this.overlay.innerHTML = `
        <div class="overlay-panel">
          <h2>Results</h2>
          <p>Destination ${this.destination}</p>
          <p>Time Remaining: ${this.timer.toFixed(1)}s</p>
          <div class="overlay-grid">
            <button class="overlay-button" id="restart-btn">Restart</button>
            <button class="overlay-button secondary" id="car-btn">Change Car</button>
          </div>
        </div>
      `;
      (this.overlay.querySelector("#restart-btn") as HTMLButtonElement).onclick = () => {
        this.startRace();
      };
      (this.overlay.querySelector("#car-btn") as HTMLButtonElement).onclick = () => {
        this.state = "select";
        this.renderOverlay();
      };
      return;
    }

    if (this.state === "pause") {
      this.overlay.style.display = "flex";
      this.overlay.innerHTML = `
        <div class="overlay-panel">
          <h2>Paused</h2>
          <div class="overlay-grid">
            <button class="overlay-button" id="resume-btn">Resume</button>
            <button class="overlay-button secondary" id="quit-btn">Quit</button>
          </div>
        </div>
      `;
      (this.overlay.querySelector("#resume-btn") as HTMLButtonElement).onclick = () => {
        this.togglePause();
      };
      (this.overlay.querySelector("#quit-btn") as HTMLButtonElement).onclick = () => {
        this.state = "start";
        this.isPaused = false;
        this.renderOverlay();
      };
      return;
    }

    this.overlay.style.display = "none";
  }

  private startRace(): void {
    this.state = "countdown";
    this.countdown = 3;
    this.timer = 55;
    this.rewindCharge = 1;
    this.rewindBuffer = [];
    this.currentNodeId = "s1";
    this.vehicle.reset(0, 0);
    this.resetRoute();
    this.overlay.style.display = "none";
  }

  private showSettings(): void {
    this.overlay.style.display = "flex";
    const mapping = this.input.getMapping();
    this.overlay.innerHTML = `
      <div class="overlay-panel">
        <h2>Settings</h2>
        <p>Remap controls (keyboard). Gamepad uses standard layout by default.</p>
        <div class="settings-list">
          ${Object.entries(mapping.keyboard)
            .map(
              ([action, keys]) => `
            <div class="settings-row">
              <span>${action}</span>
              <input type="text" data-action="${action}" value="${keys.join(", ")}" />
            </div>
          `
            )
            .join("")}
        </div>
        <div class="overlay-grid">
          <button class="overlay-button" id="save-settings">Save</button>
          <button class="overlay-button secondary" id="back-settings">Back</button>
        </div>
      </div>
    `;

    const saveBtn = this.overlay.querySelector("#save-settings") as HTMLButtonElement;
    saveBtn.onclick = () => {
      const inputs = this.overlay.querySelectorAll("input[data-action]");
      inputs.forEach((input) => {
        const el = input as HTMLInputElement;
        const action = el.dataset.action as keyof typeof mapping.keyboard;
        mapping.keyboard[action] = el.value.split(",").map((key) => key.trim());
      });
      this.input.setMapping(mapping);
      this.state = "start";
      this.renderOverlay();
    };

    const backBtn = this.overlay.querySelector("#back-settings") as HTMLButtonElement;
    backBtn.onclick = () => {
      this.state = "start";
      this.renderOverlay();
    };
  }

  private loadTuning(car: CarSpec) {
    const saved = localStorage.getItem(`tuning-${car.id}`);
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      finalDrive: car.finalDrive,
      gearRatios: car.gearRatios,
      brakeBias: 0.6,
      brakeStrength: 1,
      weightReduction: 0,
      engineStage: 0,
      suspension: { ...car.suspension },
      tireSetup: { ...car.tireSetup }
    };
  }

  private saveTuning(car: CarSpec, tuning: Vehicle["tuning"]): void {
    localStorage.setItem(`tuning-${car.id}`, JSON.stringify(tuning));
  }
}
