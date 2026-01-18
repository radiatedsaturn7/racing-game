export interface HudData {
  speed: number;
  gear: number;
  timer: number;
  stage: number;
  destination: string;
  forkDistance?: number;
  forkSide?: "left" | "right" | null;
  message?: string;
}

export class Hud {
  private hud: HTMLElement;
  private messageEl: HTMLElement;

  constructor(hud: HTMLElement) {
    this.hud = hud;
    this.hud.innerHTML = `
      <div class="hud-row">
        <div class="hud-pill" id="hud-speed"></div>
        <div class="hud-pill" id="hud-gear"></div>
        <div class="hud-pill" id="hud-timer"></div>
        <div class="hud-pill" id="hud-stage"></div>
        <div class="hud-pill" id="hud-destination"></div>
      </div>
      <div class="hud-row" id="hud-fork"></div>
      <div class="center-message" id="hud-message"></div>
    `;

    this.messageEl = this.hud.querySelector("#hud-message") as HTMLElement;
  }

  update(data: HudData): void {
    const speed = this.hud.querySelector("#hud-speed") as HTMLElement;
    const gear = this.hud.querySelector("#hud-gear") as HTMLElement;
    const timer = this.hud.querySelector("#hud-timer") as HTMLElement;
    const stage = this.hud.querySelector("#hud-stage") as HTMLElement;
    const destination = this.hud.querySelector("#hud-destination") as HTMLElement;
    const fork = this.hud.querySelector("#hud-fork") as HTMLElement;

    speed.textContent = `Speed ${(data.speed * 3.6).toFixed(0)} km/h`;
    gear.textContent = `Gear ${data.gear}`;
    timer.textContent = `Time ${data.timer.toFixed(1)}s`;
    stage.textContent = `Stage ${data.stage}/5`;
    destination.textContent = `Destination ${data.destination}`;

    if (data.forkDistance !== undefined && data.forkDistance > 0) {
      fork.innerHTML = `
        <div class="hud-pill">Fork ${data.forkSide?.toUpperCase() ?? "?"}</div>
        <div class="hud-pill">${data.forkDistance.toFixed(0)}m</div>
      `;
    } else {
      fork.innerHTML = "";
    }

    this.messageEl.textContent = data.message ?? "";
  }

  showMessage(message: string): void {
    this.messageEl.textContent = message;
  }
}
