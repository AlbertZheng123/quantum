# Quantum Entropy Bossfight

Single-page bossfight game built to demonstrate quantum entropy through role swaps between `Ruin` and `Solace`.

## Stack

- Frontend: `TypeScript + HTML Canvas + Vite`
- Backend: `FastAPI`
- Entropy bootstrap: CURBy-backed by default via the official latest complete round endpoint, deterministic fallback only if the live fetch fails

## Current Slice

- Backend session bootstrap API
- Deterministic session seed generation
- HUD with:
  - vertical Goal meter
  - active/inactive portraits
  - speech bubble
  - Chaos bar
  - Phase HP
  - Objective
  - overall timer
  - CURBy round/source indicator
- First gameplay loop hooks:
  - `ruin_orbs`
  - `ruin_beams`
  - `solace_nodes`
  - `solace_shards`

## Run Locally

### Backend

```bash
cd backend
../.venv/bin/uvicorn app.main:app --reload
```

Optional override:

```bash
export CURBY_RANDOMNESS_URL="https://random.colorado.edu/api/curbyq/round/latest/result"
```

By default, the backend uses CURBy's official `latest/result` endpoint. If the live fetch fails, it falls back to a deterministic local seed and reports that in the session payload.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`.

## Build

```bash
cd frontend
npm run build
```

When the frontend is built, FastAPI will serve `frontend/dist` from `/`.
