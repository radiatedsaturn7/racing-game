# Low-Poly OutRun Arcade

A playable, low-poly WebGL arcade racer inspired by OutRun. Race against the clock, hit checkpoints, and choose left/right forks to reach five destinations (A–E).

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## Controls

### Gamepad (Xbox / Backbone)
- RT: Accelerate
- LT: Brake/Reverse
- Left Stick: Steering
- A: Handbrake
- X: Shift Down (manual mode)
- B: Shift Up (manual mode)
- Y: Rewind (3-second rewind, 1 charge per stage)
- View/Back: Camera
- Menu/Start: Pause

### Keyboard
- W / Up: Accelerate
- S / Down: Brake/Reverse
- A/D or Left/Right: Steer
- Space: Handbrake
- Q/E: Shift Down/Up
- R: Rewind
- C: Camera
- Esc: Pause

You can remap keyboard bindings in Settings.

## Route branching

- The track is a 5-stage time attack.
- Each stage ends at a checkpoint that adds time.
- After each checkpoint (stages 1–4), a fork appears. Steer into the left or right lane to select the next route.
- The route graph has 15 segments (1 + 2 + 4 + 8). Multiple branches converge into 5 destination letters (A–E).

## Cars

- **M3 Coupe**: lighter, higher rotation response, drift-capable.
- **Kia Carnival**: heavier, understeer-prone, longer braking.

Tuning is saved per car in `localStorage`.

## Adding a new car

1. Add a spec entry in `src/data/cars.ts` with mass, wheelbase, ratios, and torque curve.
2. Optional: tune suspension and tire defaults for a unique feel.
3. Reload and the car appears in the select screen.

## Adding a new route

1. Edit `src/tracks/RouteGraph.ts` and add/update `ROUTE_GRAPH` nodes.
2. Each node defines segment length, curvature, slope, width, scenery, and terrain.
3. Use `left`/`right` to create forks and set `destination` on stage 5 nodes.

## Physics notes

The vehicle model mixes arcade tuning with simplified real-car dynamics:
- Torque curve + gear ratios
- Friction circle approximation
- Weight transfer effects and drift assistance

See `src/physics/Vehicle.ts` for tuning parameters.
