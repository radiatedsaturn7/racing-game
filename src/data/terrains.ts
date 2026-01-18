export type TerrainType = "asphalt" | "wet" | "dirt" | "sand" | "grass";

export interface TerrainInfo {
  id: TerrainType;
  label: string;
  friction: number;
  rollingResistance: number;
  dustColor: number;
}

export const TERRAINS: Record<TerrainType, TerrainInfo> = {
  asphalt: {
    id: "asphalt",
    label: "Asphalt",
    friction: 1.0,
    rollingResistance: 0.018,
    dustColor: 0x1b1b1b
  },
  wet: {
    id: "wet",
    label: "Wet Asphalt",
    friction: 0.78,
    rollingResistance: 0.022,
    dustColor: 0x222f3a
  },
  dirt: {
    id: "dirt",
    label: "Dirt",
    friction: 0.7,
    rollingResistance: 0.03,
    dustColor: 0x7a4b2a
  },
  sand: {
    id: "sand",
    label: "Sand",
    friction: 0.6,
    rollingResistance: 0.04,
    dustColor: 0xb08a5a
  },
  grass: {
    id: "grass",
    label: "Grass",
    friction: 0.65,
    rollingResistance: 0.035,
    dustColor: 0x2f5f2c
  }
};
