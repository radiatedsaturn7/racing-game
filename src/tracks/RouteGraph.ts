import type { TerrainType } from "../data/terrains";

export interface RouteSegment {
  id: string;
  length: number;
  curvature: number;
  slope: number;
  width: number;
  scenery: number;
  terrain: TerrainType;
}

export interface RouteNode {
  id: string;
  stage: number;
  segment: RouteSegment;
  left?: string;
  right?: string;
  destination?: string;
}

export const ROUTE_GRAPH: Record<string, RouteNode> = {
  s1: {
    id: "s1",
    stage: 1,
    segment: {
      id: "s1",
      length: 900,
      curvature: 0.001,
      slope: 0.002,
      width: 10,
      scenery: 0.7,
      terrain: "asphalt"
    },
    left: "s2l",
    right: "s2r"
  },
  s2l: {
    id: "s2l",
    stage: 2,
    segment: {
      id: "s2l",
      length: 850,
      curvature: -0.0022,
      slope: 0.004,
      width: 9,
      scenery: 0.9,
      terrain: "wet"
    },
    left: "s3ll",
    right: "s3lr"
  },
  s2r: {
    id: "s2r",
    stage: 2,
    segment: {
      id: "s2r",
      length: 800,
      curvature: 0.0026,
      slope: -0.003,
      width: 9,
      scenery: 0.8,
      terrain: "dirt"
    },
    left: "s3rl",
    right: "s3rr"
  },
  s3ll: {
    id: "s3ll",
    stage: 3,
    segment: {
      id: "s3ll",
      length: 780,
      curvature: 0.0032,
      slope: 0.006,
      width: 8.5,
      scenery: 0.95,
      terrain: "wet"
    },
    left: "s4lll",
    right: "s4llr"
  },
  s3lr: {
    id: "s3lr",
    stage: 3,
    segment: {
      id: "s3lr",
      length: 760,
      curvature: -0.0034,
      slope: 0.001,
      width: 8.8,
      scenery: 0.85,
      terrain: "asphalt"
    },
    left: "s4lrl",
    right: "s4lrr"
  },
  s3rl: {
    id: "s3rl",
    stage: 3,
    segment: {
      id: "s3rl",
      length: 750,
      curvature: 0.003,
      slope: -0.004,
      width: 9,
      scenery: 0.7,
      terrain: "dirt"
    },
    left: "s4rll",
    right: "s4rlr"
  },
  s3rr: {
    id: "s3rr",
    stage: 3,
    segment: {
      id: "s3rr",
      length: 770,
      curvature: -0.0028,
      slope: 0.002,
      width: 9.2,
      scenery: 0.6,
      terrain: "sand"
    },
    left: "s4rrl",
    right: "s4rrr"
  },
  s4lll: {
    id: "s4lll",
    stage: 4,
    segment: {
      id: "s4lll",
      length: 720,
      curvature: 0.0035,
      slope: 0.006,
      width: 8,
      scenery: 1,
      terrain: "wet"
    },
    left: "s5llll",
    right: "s5lllr"
  },
  s4llr: {
    id: "s4llr",
    stage: 4,
    segment: {
      id: "s4llr",
      length: 710,
      curvature: -0.0036,
      slope: 0.004,
      width: 8.2,
      scenery: 0.9,
      terrain: "wet"
    },
    left: "s5llrl",
    right: "s5llrr"
  },
  s4lrl: {
    id: "s4lrl",
    stage: 4,
    segment: {
      id: "s4lrl",
      length: 700,
      curvature: 0.0032,
      slope: -0.003,
      width: 8.3,
      scenery: 0.8,
      terrain: "asphalt"
    },
    left: "s5lrll",
    right: "s5lrlr"
  },
  s4lrr: {
    id: "s4lrr",
    stage: 4,
    segment: {
      id: "s4lrr",
      length: 700,
      curvature: -0.0035,
      slope: -0.002,
      width: 8.4,
      scenery: 0.7,
      terrain: "asphalt"
    },
    left: "s5lrrl",
    right: "s5lrrr"
  },
  s4rll: {
    id: "s4rll",
    stage: 4,
    segment: {
      id: "s4rll",
      length: 690,
      curvature: 0.003,
      slope: -0.004,
      width: 8.6,
      scenery: 0.6,
      terrain: "dirt"
    },
    left: "s5rlll",
    right: "s5rllr"
  },
  s4rlr: {
    id: "s4rlr",
    stage: 4,
    segment: {
      id: "s4rlr",
      length: 680,
      curvature: -0.0032,
      slope: -0.003,
      width: 8.6,
      scenery: 0.6,
      terrain: "dirt"
    },
    left: "s5rlrl",
    right: "s5rlrr"
  },
  s4rrl: {
    id: "s4rrl",
    stage: 4,
    segment: {
      id: "s4rrl",
      length: 670,
      curvature: 0.0028,
      slope: 0.002,
      width: 8.8,
      scenery: 0.5,
      terrain: "sand"
    },
    left: "s5rrll",
    right: "s5rrlr"
  },
  s4rrr: {
    id: "s4rrr",
    stage: 4,
    segment: {
      id: "s4rrr",
      length: 660,
      curvature: -0.003,
      slope: 0.003,
      width: 8.8,
      scenery: 0.5,
      terrain: "sand"
    },
    left: "s5rrrl",
    right: "s5rrrr"
  }
};

const DESTINATIONS = ["A", "B", "C", "D", "E"] as const;

const stage5Nodes = [
  "s5llll",
  "s5lllr",
  "s5llrl",
  "s5llrr",
  "s5lrll",
  "s5lrlr",
  "s5lrrl",
  "s5lrrr",
  "s5rlll",
  "s5rllr",
  "s5rlrl",
  "s5rlrr",
  "s5rrll",
  "s5rrlr",
  "s5rrrl",
  "s5rrrr"
];

stage5Nodes.forEach((id, index) => {
  ROUTE_GRAPH[id] = {
    id,
    stage: 5,
    segment: {
      id,
      length: 650 - (index % 4) * 15,
      curvature: (index % 2 === 0 ? 1 : -1) * (0.0025 + (index % 3) * 0.0004),
      slope: ((index % 3) - 1) * 0.002,
      width: 8.2,
      scenery: 0.4,
      terrain: index % 2 === 0 ? "grass" : "asphalt"
    },
    destination: DESTINATIONS[index % DESTINATIONS.length]
  };
});

export interface RoutePath {
  nodes: RouteNode[];
  totalLength: number;
  destination: string;
}

export interface RouteSamples {
  points: { x: number; y: number; z: number }[];
  widths: number[];
  terrainTypes: TerrainType[];
  distances: number[];
}

export function buildRoutePath(startId: string): RoutePath {
  const nodes: RouteNode[] = [];
  let currentId: string | undefined = startId;
  let total = 0;
  let destination = "";
  while (currentId) {
    const node = ROUTE_GRAPH[currentId];
    nodes.push(node);
    total += node.segment.length;
    if (node.destination) {
      destination = node.destination;
      break;
    }
    currentId = node.left ?? node.right;
  }
  return { nodes, totalLength: total, destination };
}

export function nextNodeFromChoice(currentId: string, choice: "left" | "right"): string {
  const node = ROUTE_GRAPH[currentId];
  return choice === "left" ? node.left ?? currentId : node.right ?? currentId;
}

export function buildRouteSamples(nodes: RouteNode[]): RouteSamples {
  const points: { x: number; y: number; z: number }[] = [];
  const widths: number[] = [];
  const terrainTypes: TerrainType[] = [];
  const distances: number[] = [];

  let x = 0;
  let y = 0;
  let z = 0;
  let heading = 0;
  let total = 0;

  nodes.forEach((node) => {
    const steps = Math.floor(node.segment.length / 20);
    for (let i = 0; i < steps; i += 1) {
      heading += node.segment.curvature * 20;
      x += Math.sin(heading) * 20;
      z += Math.cos(heading) * 20;
      y += node.segment.slope * 20;
      total += 20;
      points.push({ x, y, z });
      widths.push(node.segment.width);
      terrainTypes.push(node.segment.terrain);
      distances.push(total);
    }
  });

  return { points, widths, terrainTypes, distances };
}
