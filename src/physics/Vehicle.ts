import type { CarSpec } from "../data/cars";
import type { TerrainType } from "../data/terrains";
import { TERRAINS } from "../data/terrains";
import { frictionCircle, tireGripForTerrain, type TireState } from "./TireModel";

export interface VehicleInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: number;
}

export interface VehicleState {
  position: { x: number; z: number };
  velocity: { x: number; z: number };
  heading: number;
  yawRate: number;
  engineRpm: number;
  gear: number;
  wheelSpeed: number;
  speed: number;
  tireState: TireState;
}

export interface VehicleTuning {
  finalDrive: number;
  gearRatios: number[];
  brakeBias: number;
  brakeStrength: number;
  weightReduction: number;
  engineStage: number;
  suspension: {
    rideHeight: number;
    springRate: number;
    damping: number;
    antiRoll: number;
  };
  tireSetup: {
    compound: "street" | "sport" | "semi";
    pressureFrontPsi: number;
    pressureRearPsi: number;
  };
}

export class Vehicle {
  public state: VehicleState;
  public tuning: VehicleTuning;
  public manualMode = false;
  public driftAssist = 0.7;
  public tractionAssist = 0.6;
  public maxSteerAngle = 0.55;
  public handbrakeGripLoss = 0.55;
  public terrain: TerrainType = "asphalt";

  private car: CarSpec;
  private clutch = 0;
  private revLimiter = 7200;

  constructor(car: CarSpec, tuning: VehicleTuning) {
    this.car = car;
    this.tuning = tuning;
    this.state = {
      position: { x: 0, z: 0 },
      velocity: { x: 0, z: 0 },
      heading: 0,
      yawRate: 0,
      engineRpm: 1200,
      gear: 1,
      wheelSpeed: 0,
      speed: 0,
      tireState: {
        slipAngle: 0,
        slipRatio: 0,
        combinedSlip: 0,
        gripFactor: 1
      }
    };
  }

  reset(positionX = 0, positionZ = 0): void {
    this.state.position.x = positionX;
    this.state.position.z = positionZ;
    this.state.velocity.x = 0;
    this.state.velocity.z = 0;
    this.state.heading = 0;
    this.state.yawRate = 0;
    this.state.engineRpm = 1200;
    this.state.gear = 1;
    this.state.wheelSpeed = 0;
    this.state.speed = 0;
  }

  private torqueAtRpm(rpm: number): number {
    const curve = this.car.torqueCurve;
    if (rpm <= curve[0][0]) return curve[0][1];
    for (let i = 1; i < curve.length; i += 1) {
      const [r1, t1] = curve[i - 1];
      const [r2, t2] = curve[i];
      if (rpm <= r2) {
        const t = (rpm - r1) / (r2 - r1);
        return t1 + (t2 - t1) * t;
      }
    }
    return curve[curve.length - 1][1];
  }

  private updateAutomaticGear(): void {
    const rpm = this.state.engineRpm;
    const maxGear = this.tuning.gearRatios.length;
    if (rpm > 6500 && this.state.gear < maxGear) {
      this.state.gear += 1;
    } else if (rpm < 2200 && this.state.gear > 1) {
      this.state.gear -= 1;
    }
  }

  shiftUp(): void {
    if (!this.manualMode) return;
    const maxGear = this.tuning.gearRatios.length;
    if (this.state.gear < maxGear) {
      this.state.gear += 1;
      this.clutch = 0.2;
    }
  }

  shiftDown(): void {
    if (!this.manualMode) return;
    if (this.state.gear > 1) {
      this.state.gear -= 1;
      this.clutch = 0.2;
    }
  }

  update(dt: number, input: VehicleInput): void {
    const state = this.state;
    const totalMass = this.car.massKg * (1 - this.tuning.weightReduction * 0.08);
    const steerInput = Math.max(-1, Math.min(1, input.steer));
    const steerAngle = steerInput * this.maxSteerAngle;
    const speed = Math.hypot(state.velocity.x, state.velocity.z);

    const forwardX = Math.sin(state.heading);
    const forwardZ = Math.cos(state.heading);
    const sideX = Math.sin(state.heading + Math.PI / 2);
    const sideZ = Math.cos(state.heading + Math.PI / 2);

    const longitudinalSpeed = state.velocity.x * forwardX + state.velocity.z * forwardZ;
    const lateralSpeed = state.velocity.x * sideX + state.velocity.z * sideZ;

    const wheelRadius = this.car.wheelRadiusM;
    const gearRatio = this.tuning.gearRatios[state.gear - 1] ?? this.tuning.gearRatios[0];
    const driveRatio = gearRatio * this.tuning.finalDrive;
    const wheelRpm = Math.max(0, (longitudinalSpeed / (2 * Math.PI * wheelRadius)) * 60);
    state.wheelSpeed = wheelRpm;

    state.engineRpm = Math.max(1000, Math.min(this.revLimiter, wheelRpm * driveRatio + 1000));
    if (!this.manualMode) {
      this.updateAutomaticGear();
    }

    const engineTorque = this.torqueAtRpm(state.engineRpm) * (1 + this.tuning.engineStage * 0.12);
    const driveTorque = engineTorque * driveRatio * (1 - this.clutch);

    const throttleForce = (driveTorque / wheelRadius) * input.throttle;
    const brakeForce = this.tuning.brakeStrength * input.brake * 12000;
    const rolling = TERRAINS[this.terrain].rollingResistance * longitudinalSpeed * longitudinalSpeed * 0.5;

    const weightTransfer = {
      longitudinal: this.tuning.suspension.springRate * (throttleForce - brakeForce) * 0.00004,
      lateral: this.tuning.suspension.antiRoll * lateralSpeed * 0.002
    };

    const frontGrip = tireGripForTerrain(this.tuning.tireSetup, this.terrain, true) * (1 - weightTransfer.longitudinal + weightTransfer.lateral * 0.2);
    const rearGrip = tireGripForTerrain(this.tuning.tireSetup, this.terrain, false) * (1 + weightTransfer.longitudinal - weightTransfer.lateral * 0.2);

    const gripLoss = input.handbrake > 0 ? this.handbrakeGripLoss : 1;
    const rearGripAdjusted = rearGrip * gripLoss;

    const yawDesired = (longitudinalSpeed / (this.car.wheelbaseM + 0.2)) * Math.tan(steerAngle);
    const yawError = yawDesired - state.yawRate;
    const yawAccel = yawError * (2.2 - this.tuning.suspension.damping) * 3;

    const lateralForce = -lateralSpeed * 4 * rearGripAdjusted;
    const longitudinalForce = throttleForce - brakeForce - rolling;

    const slipAngle = Math.atan2(lateralSpeed, Math.abs(longitudinalSpeed) + 0.5);
    const slipRatio = (throttleForce - brakeForce) / Math.max(4000, totalMass * 3);

    const combinedSlip = Math.min(1, Math.abs(slipAngle) + Math.abs(slipRatio));
    const circle = frictionCircle(Math.abs(slipRatio), Math.abs(slipAngle));
    const gripFactor = circle * (rearGripAdjusted + frontGrip) * 0.5;

    const driftFactor = combinedSlip > 0.55 || input.handbrake > 0.2 ? 0.85 : 1;
    const yawClamp = 1 + (1 - this.driftAssist) * 1.2;

    state.yawRate += yawAccel * dt;
    state.yawRate = Math.max(-yawClamp, Math.min(yawClamp, state.yawRate));

    const accelLong = (longitudinalForce * gripFactor) / totalMass;
    const accelLat = (lateralForce * frontGrip * driftFactor) / totalMass;

    state.velocity.x += (forwardX * accelLong + sideX * accelLat) * dt;
    state.velocity.z += (forwardZ * accelLong + sideZ * accelLat) * dt;

    state.heading += state.yawRate * dt;

    const traction = 1 - this.tractionAssist * Math.max(0, combinedSlip - 0.4);
    state.velocity.x *= traction;
    state.velocity.z *= traction;

    state.position.x += state.velocity.x * dt;
    state.position.z += state.velocity.z * dt;

    state.speed = Math.hypot(state.velocity.x, state.velocity.z);

    this.clutch = Math.max(0, this.clutch - dt * 2);
    state.tireState = {
      slipAngle,
      slipRatio,
      combinedSlip,
      gripFactor
    };
  }
}
