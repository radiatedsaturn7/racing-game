import type { TerrainType } from "../data/terrains";
import { TERRAINS } from "../data/terrains";

export type TireCompound = "street" | "sport" | "semi";

export interface TireSetup {
  compound: TireCompound;
  pressureFrontPsi: number;
  pressureRearPsi: number;
}

export interface TireState {
  slipAngle: number;
  slipRatio: number;
  combinedSlip: number;
  gripFactor: number;
}

const COMPOUND_GRIP: Record<TireCompound, number> = {
  street: 0.95,
  sport: 1.05,
  semi: 1.15
};

const COMPOUND_WET_PENALTY: Record<TireCompound, number> = {
  street: 0.85,
  sport: 0.78,
  semi: 0.7
};

export function pressureGripFactor(psi: number): number {
  const delta = Math.min(6, Math.max(-6, psi - 33));
  return 1 - Math.abs(delta) * 0.012;
}

export function tireGripForTerrain(
  setup: TireSetup,
  terrain: TerrainType,
  isFront: boolean
): number {
  const base = TERRAINS[terrain].friction;
  const compoundGrip = COMPOUND_GRIP[setup.compound];
  const wetPenalty = terrain === "wet" ? COMPOUND_WET_PENALTY[setup.compound] : 1;
  const psi = isFront ? setup.pressureFrontPsi : setup.pressureRearPsi;
  return base * compoundGrip * wetPenalty * pressureGripFactor(psi);
}

export function frictionCircle(longitudinal: number, lateral: number): number {
  const slip = Math.min(1, Math.sqrt(longitudinal * longitudinal + lateral * lateral));
  return 1 - slip * 0.4;
}
