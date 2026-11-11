# Vide & Lame

First-person sword swing in an empty world. Mouse look, left click to strike.

The swing is a reconstructed animation, not extracted Chivalry 2 data. Timings follow the public longsword slash phases: windup 0.225s, release 0.475s, recovery 0.8s. During windup, mouse movement biases the arc.

## Requirements

- Node.js 22

## Run

```bash
npm install
npm run dev
```

The dev server listens on `0.0.0.0:8080`.

## Checks

```bash
npm run typecheck
npm run build
```

## Notes

- Viewmodel, gauntlet, and sword are procedural geometry (three.js / React Three Fiber).
- On-screen labels are French. Source comments and this document are English.
A static copy for GitHub Pages lives in `docs/` (`index.html` + `game.js`). It does not need the TanStack server.
