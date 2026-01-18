export type InputAction =
  | "throttle"
  | "brake"
  | "steer"
  | "handbrake"
  | "shiftUp"
  | "shiftDown"
  | "rewind"
  | "camera"
  | "pause";

export interface InputState {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: number;
  shiftUp: boolean;
  shiftDown: boolean;
  rewind: boolean;
  camera: boolean;
  pause: boolean;
}

export interface MappingConfig {
  keyboard: Record<InputAction, string[]>;
  gamepad: Record<InputAction, number | { axis: number; direction: 1 | -1 }>;
}

const DEFAULT_MAPPING: MappingConfig = {
  keyboard: {
    throttle: ["KeyW", "ArrowUp"],
    brake: ["KeyS", "ArrowDown"],
    steer: ["ArrowLeft", "KeyA", "ArrowRight", "KeyD"],
    handbrake: ["Space"],
    shiftDown: ["KeyQ"],
    shiftUp: ["KeyE"],
    rewind: ["KeyR"],
    camera: ["KeyC"],
    pause: ["Escape"]
  },
  gamepad: {
    throttle: 7,
    brake: 6,
    steer: { axis: 0, direction: 1 },
    handbrake: 0,
    shiftDown: 2,
    shiftUp: 1,
    rewind: 3,
    camera: 8,
    pause: 9
  }
};

export class InputManager {
  private keys = new Set<string>();
  private mapping: MappingConfig = JSON.parse(JSON.stringify(DEFAULT_MAPPING));
  private pressed = new Set<InputAction>();

  constructor() {
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });
  }

  getMapping(): MappingConfig {
    return this.mapping;
  }

  setMapping(mapping: MappingConfig): void {
    this.mapping = mapping;
  }

  resetMapping(): void {
    this.mapping = JSON.parse(JSON.stringify(DEFAULT_MAPPING));
  }

  getState(): InputState {
    const state: InputState = {
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: 0,
      shiftUp: false,
      shiftDown: false,
      rewind: false,
      camera: false,
      pause: false
    };

    state.throttle = this.isKeyDown(this.mapping.keyboard.throttle) ? 1 : 0;
    state.brake = this.isKeyDown(this.mapping.keyboard.brake) ? 1 : 0;

    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) {
      state.steer -= 1;
    }
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) {
      state.steer += 1;
    }
    state.handbrake = this.isKeyDown(this.mapping.keyboard.handbrake) ? 1 : 0;
    state.shiftDown = this.isKeyDown(this.mapping.keyboard.shiftDown);
    state.shiftUp = this.isKeyDown(this.mapping.keyboard.shiftUp);
    state.rewind = this.isKeyDown(this.mapping.keyboard.rewind);
    state.camera = this.isKeyDown(this.mapping.keyboard.camera);
    state.pause = this.isKeyDown(this.mapping.keyboard.pause);

    const padState = this.readGamepad();
    if (padState) {
      state.throttle = Math.max(state.throttle, padState.throttle);
      state.brake = Math.max(state.brake, padState.brake);
      state.steer = Math.abs(padState.steer) > Math.abs(state.steer) ? padState.steer : state.steer;
      state.handbrake = Math.max(state.handbrake, padState.handbrake);
      state.shiftUp = state.shiftUp || padState.shiftUp;
      state.shiftDown = state.shiftDown || padState.shiftDown;
      state.rewind = state.rewind || padState.rewind;
      state.camera = state.camera || padState.camera;
      state.pause = state.pause || padState.pause;
    }

    return state;
  }

  consume(action: InputAction): boolean {
    const state = this.getState();
    const active = Boolean(state[action as keyof InputState]);
    if (active && !this.pressed.has(action)) {
      this.pressed.add(action);
      return true;
    }
    if (!active) {
      this.pressed.delete(action);
    }
    return false;
  }

  private isKeyDown(keys: string[]): boolean {
    return keys.some((key) => this.keys.has(key));
  }

  private readGamepad(): InputState | null {
    const pads = navigator.getGamepads();
    if (!pads) return null;
    const pad = pads[0];
    if (!pad) return null;

    const throttleButton = pad.buttons[this.mapping.gamepad.throttle as number];
    const brakeButton = pad.buttons[this.mapping.gamepad.brake as number];
    const steerAxis = this.mapping.gamepad.steer as { axis: number; direction: 1 | -1 };

    return {
      throttle: throttleButton?.value ?? 0,
      brake: brakeButton?.value ?? 0,
      steer: (pad.axes[steerAxis.axis] ?? 0) * steerAxis.direction,
      handbrake: pad.buttons[this.mapping.gamepad.handbrake as number]?.value ?? 0,
      shiftUp: pad.buttons[this.mapping.gamepad.shiftUp as number]?.pressed ?? false,
      shiftDown: pad.buttons[this.mapping.gamepad.shiftDown as number]?.pressed ?? false,
      rewind: pad.buttons[this.mapping.gamepad.rewind as number]?.pressed ?? false,
      camera: pad.buttons[this.mapping.gamepad.camera as number]?.pressed ?? false,
      pause: pad.buttons[this.mapping.gamepad.pause as number]?.pressed ?? false
    };
  }
}
