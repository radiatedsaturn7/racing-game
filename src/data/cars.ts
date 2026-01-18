import type { TireSetup } from "../physics/TireModel";

export interface CarSpec {
  id: string;
  name: string;
  description: string;
  massKg: number;
  wheelbaseM: number;
  trackWidthM: number;
  turningCircleM: number;
  enginePowerKw: number;
  torqueCurve: [number, number][];
  gearRatios: number[];
  finalDrive: number;
  wheelRadiusM: number;
  tireSetup: TireSetup;
  suspension: {
    rideHeight: number;
    springRate: number;
    damping: number;
    antiRoll: number;
  };
}

export const CARS: CarSpec[] = [
  {
    id: "m3",
    name: "M3 Coupe",
    description: "Front-engine sport coupe. Nimble, eager to rotate.",
    massKg: 1720,
    wheelbaseM: 2.731,
    trackWidthM: 1.55,
    turningCircleM: 11.0,
    enginePowerKw: 317,
    torqueCurve: [
      [1000, 240],
      [2000, 330],
      [3500, 410],
      [5500, 500],
      [7000, 430]
    ],
    gearRatios: [3.8, 2.4, 1.7, 1.3, 1.0, 0.86],
    finalDrive: 3.42,
    wheelRadiusM: 0.33,
    tireSetup: {
      compound: "sport",
      pressureFrontPsi: 34,
      pressureRearPsi: 33
    },
    suspension: {
      rideHeight: 0.12,
      springRate: 0.7,
      damping: 0.6,
      antiRoll: 0.6
    }
  },
  {
    id: "carnival",
    name: "Kia Carnival",
    description: "Heavy minivan. Smooth but understeers, longer braking.",
    massKg: 1985,
    wheelbaseM: 3.09,
    trackWidthM: 1.68,
    turningCircleM: 11.75,
    enginePowerKw: 216,
    torqueCurve: [
      [1000, 250],
      [2000, 320],
      [3500, 360],
      [5000, 380],
      [6000, 310]
    ],
    gearRatios: [3.6, 2.1, 1.5, 1.15, 0.85],
    finalDrive: 3.6,
    wheelRadiusM: 0.34,
    tireSetup: {
      compound: "street",
      pressureFrontPsi: 36,
      pressureRearPsi: 36
    },
    suspension: {
      rideHeight: 0.18,
      springRate: 0.5,
      damping: 0.5,
      antiRoll: 0.4
    }
  }
];
