import * as THREE from "three";
import type { RouteSamples } from "../tracks/RouteGraph";
import { TERRAINS } from "../data/terrains";

export type CameraMode = "chase" | "hood";

export interface CarVisualState {
  position: { x: number; y: number; z: number };
  heading: number;
  speed: number;
  skidAmount: number;
  terrain: keyof typeof TERRAINS;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
}

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private carGroup: THREE.Group;
  private roadGroup: THREE.Group;
  private terrainGroup: THREE.Group;
  private skidLine: THREE.Line;
  private skidPositions: THREE.Vector3[] = [];
  private particleGeometry: THREE.BufferGeometry;
  private particlePoints: THREE.Points;
  private particles: Particle[] = [];
  private sceneryGroup: THREE.Group;
  private obstacleGroup: THREE.Group;
  private cameraMode: CameraMode = "chase";
  private clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x07111f, 40, 200);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    sun.position.set(20, 30, -20);
    this.scene.add(ambient, sun);

    this.roadGroup = new THREE.Group();
    this.terrainGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.obstacleGroup = new THREE.Group();
    this.scene.add(this.terrainGroup, this.roadGroup, this.sceneryGroup, this.obstacleGroup);

    this.carGroup = this.buildCarMesh();
    this.scene.add(this.carGroup);

    this.skidLine = this.buildSkidLine();
    this.scene.add(this.skidLine);

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    this.particlePoints = new THREE.Points(
      this.particleGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.4,
        transparent: true,
        opacity: 0.8
      })
    );
    this.scene.add(this.particlePoints);

    window.addEventListener("resize", () => this.onResize());
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  buildRoute(samples: RouteSamples): void {
    this.roadGroup.clear();
    this.terrainGroup.clear();
    this.sceneryGroup.clear();
    this.obstacleGroup.clear();

    const { points, widths, terrainTypes } = samples;
    const roadGeometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < points.length; i += 1) {
      const width = widths[i];
      const left = new THREE.Vector3(points[i].x - width, points[i].y, points[i].z);
      const right = new THREE.Vector3(points[i].x + width, points[i].y, points[i].z);
      vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);

      const terrainColor = new THREE.Color(0x2b2f37);
      colors.push(terrainColor.r, terrainColor.g, terrainColor.b, terrainColor.r, terrainColor.g, terrainColor.b);
    }

    const indices: number[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    roadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    roadGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const roadMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.1
    });

    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    this.roadGroup.add(roadMesh);

    const terrainGeometry = new THREE.BufferGeometry();
    const terrainVertices: number[] = [];
    const terrainColors: number[] = [];

    for (let i = 0; i < points.length; i += 1) {
      const width = widths[i];
      const terrainWidth = width + 18;
      const left = new THREE.Vector3(points[i].x - terrainWidth, points[i].y - 0.1, points[i].z);
      const right = new THREE.Vector3(points[i].x + terrainWidth, points[i].y - 0.1, points[i].z);
      terrainVertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
      const terrainColor = new THREE.Color(TERRAINS[terrainTypes[i]].dustColor);
      terrainColors.push(
        terrainColor.r,
        terrainColor.g,
        terrainColor.b,
        terrainColor.r,
        terrainColor.g,
        terrainColor.b
      );
    }

    const terrainIndices: number[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      terrainIndices.push(a, b, c, b, d, c);
    }

    terrainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(terrainVertices, 3));
    terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(terrainColors, 3));
    terrainGeometry.setIndex(terrainIndices);
    terrainGeometry.computeVertexNormals();

    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1
    });
    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    this.terrainGroup.add(terrainMesh);

    this.spawnScenery(points.map((point) => new THREE.Vector3(point.x, point.y, point.z)), widths, terrainTypes);
  }

  setObstacles(positions: { x: number; y: number; z: number }[]): void {
    this.obstacleGroup.clear();
    const material = new THREE.MeshStandardMaterial({ color: 0x2f7cff, roughness: 0.6 });
    positions.forEach((pos) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 3), material);
      mesh.position.set(pos.x, pos.y + 0.4, pos.z);
      this.obstacleGroup.add(mesh);
    });
  }

  updateCar(state: CarVisualState): void {
    this.carGroup.position.set(state.position.x, state.position.y, state.position.z);
    this.carGroup.rotation.y = state.heading;

    if (state.skidAmount > 0.35) {
      this.skidPositions.push(new THREE.Vector3(state.position.x, state.position.y + 0.02, state.position.z));
      if (this.skidPositions.length > 120) {
        this.skidPositions.shift();
      }
    }

    this.updateSkidLine();
    this.updateParticles(state);
    this.updateCamera(state);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(state: CarVisualState): void {
    const speedFactor = Math.min(1, state.speed / 60);
    this.camera.fov = 58 + speedFactor * 12;
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === "chase") {
      const offset = new THREE.Vector3(0, 4 + speedFactor * 1.2, -10 - speedFactor * 6);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.heading);
      this.camera.position.lerp(
        new THREE.Vector3(state.position.x, state.position.y, state.position.z).add(offset),
        0.1
      );
      this.camera.lookAt(state.position.x, state.position.y + 1.5, state.position.z + 6);
    } else {
      const offset = new THREE.Vector3(0, 1.3, 2.2);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.heading);
      this.camera.position.lerp(
        new THREE.Vector3(state.position.x, state.position.y, state.position.z).add(offset),
        0.2
      );
      this.camera.lookAt(state.position.x + Math.sin(state.heading) * 12, 1.2, state.position.z + Math.cos(state.heading) * 12);
    }
  }

  private buildCarMesh(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.4 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3.8), bodyMat);
    body.position.y = 0.4;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.6), cabinMat);
    cabin.position.set(0, 0.8, -0.1);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.3, 10);
    const wheelPositions = [
      [0.75, 0.25, 1.3],
      [-0.75, 0.25, 1.3],
      [0.75, 0.25, -1.3],
      [-0.75, 0.25, -1.3]
    ];
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      group.add(wheel);
    });

    group.add(body, cabin);
    return group;
  }

  private buildSkidLine(): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    const material = new THREE.LineBasicMaterial({ color: 0x1f1f1f });
    return new THREE.Line(geometry, material);
  }

  private updateSkidLine(): void {
    const positions = this.skidPositions.flatMap((p) => [p.x, p.y, p.z]);
    this.skidLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.skidLine.geometry.computeBoundingSphere();
  }

  private updateParticles(state: CarVisualState): void {
    const now = this.clock.getDelta();
    const spawnCount = Math.floor(state.skidAmount * 4);
    for (let i = 0; i < spawnCount; i += 1) {
      const particle: Particle = {
        position: new THREE.Vector3(state.position.x, state.position.y + 0.2, state.position.z),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.6, (Math.random() - 0.5) * 1.2),
        life: 1
      };
      this.particles.push(particle);
    }

    this.particles.forEach((particle) => {
      particle.life -= now * 0.8;
      particle.position.add(particle.velocity.clone().multiplyScalar(now));
    });
    this.particles = this.particles.filter((p) => p.life > 0);

    const positions = this.particles.flatMap((p) => [p.position.x, p.position.y, p.position.z]);
    this.particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const terrainColor = new THREE.Color(TERRAINS[state.terrain].dustColor);
    (this.particlePoints.material as THREE.PointsMaterial).color = terrainColor;
  }

  private spawnScenery(points: THREE.Vector3[], widths: number[], terrainTypes: (keyof typeof TERRAINS)[]): void {
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2c7a3d });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3b2a });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6c6c72 });
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffd166 });

    for (let i = 20; i < points.length; i += 8) {
      const point = points[i];
      const width = widths[i];
      const offset = width + 4 + Math.random() * 6;
      const side = Math.random() > 0.5 ? 1 : -1;
      const pos = new THREE.Vector3(point.x + offset * side, point.y, point.z);

      if (terrainTypes[i] === "sand") {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), rockMat);
        rock.position.copy(pos);
        rock.position.y += 0.6;
        this.sceneryGroup.add(rock);
      } else {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6), trunkMat);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 6), treeMat);
        trunk.position.copy(pos);
        trunk.position.y += 0.6;
        crown.position.copy(pos);
        crown.position.y += 2.2;
        this.sceneryGroup.add(trunk, crown);
      }

      if (i % 24 === 0) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.2), signMat);
        sign.position.set(point.x + (width + 2) * -side, point.y + 1.2, point.z);
        this.sceneryGroup.add(sign);
      }
    }
  }

  private onResize(): void {
    const { innerWidth, innerHeight } = window;
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
