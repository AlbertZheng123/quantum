# Quantum Entropy Bossfight

`quantum` is a single-page bossfight game built around CURBY quantum randomness. The game uses CURBY's latest round output as the root entropy source for the encounter, then turns that output into a live forward/reverse bitstream that drives the fight.

This README documents the live codepath and the current gameplay systems. It is intentionally specific about bit usage so the repo reflects what the game is actually doing now.

## Stack

- Frontend: `TypeScript`, DOM UI, HTML canvas, `Vite`
- Backend: `FastAPI`
- Quantum source: CURBY latest complete round result endpoint

## Live Entropy Flow

### 1. Backend fetches CURBY output

The backend requests CURBY's latest complete result and extracts the round id plus randomness bytes.

Relevant files:
- [backend/app/services/curby_service.py](/Users/albertzheng/Documents/quantum/backend/app/services/curby_service.py)
- [backend/app/services/session_service.py](/Users/albertzheng/Documents/quantum/backend/app/services/session_service.py)

Live behavior:
- default endpoint: `https://random.colorado.edu/api/curbyq/round/latest/result`
- the backend returns:
  - `round_id`
  - `entropy_source`
  - `entropy_warning`
  - `entropy_bytes`
- `entropy_bytes` are sent straight to the frontend
- there is no longer any extra backend session-mixing layer

That means:
- if CURBY stays on the same round
- and the player restarts the game
- the same raw quantum output is reused
- so the opening controller and early phase sequence will be the same

### 2. Frontend decodes CURBY bytes into bits

Relevant file:
- [frontend/src/game/QuantumBitStream.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/QuantumBitStream.ts)

The frontend:
- decodes the CURBY randomness bytes
- converts them into a bit array
- keeps:
  - a `forwardBits` stream
  - a `reverseBits` stream

The game then consumes:
- `forwardBits` for fight structure, phase generation, and minigame patterns
- `reverseBits` for Chaos meter behavior

Important implementation note:
- the bitstream currently wraps with modulo
- it is not a finite one-pass tape yet
- this is intentional for the current version

## High-Level Entropy Model

### Forward stream

Used for:
- starting controller
- endgame modifier
- minigame family selection
- minigame parameter selection
- live Quantum Rain wave generation
- shard chaos-tile preset selection
- some runtime repositioning/reseeding

### Reverse stream

Used for:
- Chaos meter updates only

## What Is Quantum-Driven

The important gameplay randomness is quantum-driven:
- opening controller
- phase order
- Chaos meter movement
- Ruin tile layouts
- Ruin blaster volleys
- Ruin shield arrows
- Solace shard lane roles
- Solace shard chaos-tile presets
- Solace constellation family selection
- Solace red hazard orb counts, spawn positions, directions, and speeds
- phase-two Chaos volatility

What is not quantum-driven:
- player movement
- text typing speed
- screen shake
- UI animation timing
- music
- tutorial pacing
- admin panel actions

## Current Active Minigame Pool

### Ruin
- `quantum_lattice`
- `cross_blasters`
- `shield_parry`

### Solace
- `quantum_rain`
- `resonance_constellation`

The codebase still contains older legacy builders, but those are not the active live phase pool.

## Exact Quantum Usage

## Global Run Setup

Relevant files:
- [frontend/src/game/RunController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/RunController.ts)
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

### Starting controller

Source:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

Logic:
- `1 forward bit`
- `0 => ruin`
- `1 => solace`

### Endgame modifier

Source:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

Logic:
- `3 forward bits`
- selects one of 8 endgame modifier labels

### Phase family selection

Source:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

Ruin phase selection:
- `readChoice(["quantum_lattice", "cross_blasters", "shield_parry"])`
- needs `2 forward bits` with rejection if out of range

Solace phase selection:
- `readChoice(["quantum_rain", "resonance_constellation"])`
- needs `1 forward bit`

## Chaos Meter

Relevant file:
- [frontend/src/game/ChaosController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/ChaosController.ts)

The Chaos meter uses the reverse quantum stream.

### Phase 1 Chaos

Update cadence:
- every `2000ms`

Bits per update:
- `1 reverse bit` for sign
- `3 reverse bits` for magnitude

Magnitude table:
- `000 => 5`
- `001 => 6`
- `010 => 7`
- `011 => 8`
- `100 => 9`
- `101 => 10`
- `110 => 10`
- `111 => 9`

So each phase-1 Chaos tick is:
- `-5` to `-10`
- or `+5` to `+10`

### Phase 2 Chaos

Update cadence:
- every `1000ms`

Bits per update:
- `4 reverse bits`

Delta table:
- `0000 => -20`
- `0001 => -18`
- `0010 => -16`
- `0011 => -14`
- `0100 => -12`
- `0101 => -10`
- `0110 => -8`
- `0111 => +8`
- `1000 => +10`
- `1001 => +12`
- `1010 => +14`
- `1011 => +16`
- `1100 => +18`
- `1101 => +20`
- `1110 => +20`
- `1111 => -20`

### Chaos trap gain

When the player touches a cyan Chaos tile:
- phase 1: `+12`
- phase 2: `+20`

Chaos reset:
- every new minigame starts at `50`
- swaps also reset to `50`

## Quantum Lattice

Relevant file:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

`quantum_lattice` is built from the older lattice family builder, then remaps warning cells into cyan Chaos cells.

### Bits used at phase build

- `3 forward bits` => lattice template family
- `2 forward bits` => tempo profile
- `2 forward bits` => trap layout
- `1 forward bit` => mirror X
- `1 forward bit` => mirror Y
- `1 forward bit` => reverse frame order
- `2 forward bits per frame` => duration variation

### Lattice families

The current families are:
- Side Sweep
- Top Cascade
- Checker Pulse
- Center Crush
- Corner Fold
- Diamond Ring
- Broken Cross
- Serpent Path

### What the bits control

Quantum entropy determines:
- which lattice family is chosen
- whether the pattern mirrors horizontally
- whether the pattern mirrors vertically
- whether the frame order reverses
- frame duration variation
- which cells are red, green, or cyan in each iteration

### Runtime quantum usage

Lattice cyan cells also use the forward stream at runtime for reseeding:
- which visible cyan slot gets replaced
- which candidate cell replaces it

## Cross Blasters

Relevant file:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

### Bits used at phase build

- `2 forward bits` => trap layout
- `2 forward bits` => warning profile
- `2 forward bits` => fire duration profile
- `2 forward bits` => beam thickness profile
- `2 forward bits` => volley count offset

Then for every volley:
- `readDistinctLanes(...)` chooses vertical lanes
- `readDistinctLanes(...)` chooses horizontal lanes
- `1 forward bit per vertical cannon` => `top` or `bottom`
- `1 forward bit per horizontal cannon` => `left` or `right`

### Phase 1 cross blasters

Per volley:
- `2 vertical`
- `2 horizontal`

Warning table:
- `1000`
- `920`
- `820`
- `760`

Thickness table:
- `40`
- `54`
- `68`
- `86`

Volley count:
- `5 + readInt(2)`
- total range: `5..8`

### Phase 2 cross blasters

Per volley:
- `3 vertical`
- `3 horizontal`

Warning table:
- `1900`
- `1780`
- `1700`
- `1620`

Thickness table:
- `58`
- `72`
- `86`
- `100`

Volley count:
- `6 + readInt(2)`
- total range: `6..9`

### What the bits control

Quantum entropy determines:
- how many volleys the phase has
- which lanes each volley targets
- which side each cannon anchors from
- the warning duration
- the active beam duration
- beam thickness

## Shield Parry

Relevant file:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

### Shared phase bits

- `2 forward bits` => trap layout
- `2 forward bits` => speed profile
- `2 forward bits` => spawn profile

Base speed table:
- `165`
- `198`
- `232`
- `270`

Spawn delay table:
- `500`
- `420`
- `350`
- `280`

### Phase 1 shield

Extra bits:
- `2 forward bits` => arrow count offset
- arrow count = `12 + readInt(2)` => `12..15`

For each arrow:
- `2 forward bits via readChoice` => direction
- `1 forward bit` => `red` or `cyan`
- `2 forward bits via readChoice([-18, -6, 12, 24])` => speed variation

### Phase 2 shield

Extra bits:
- `2 forward bits` => volley count offset
- volley count = `6 + readInt(2)` => `6..9`

Each volley currently creates 2 arrows:

Arrow 1:
- direction from `readChoice(["up", "down", "left", "right"])`
- `1 forward bit` => color
- `2 forward bits via readChoice([-6, 12, 24, 40])` => speed variation
- fixed `delayAfterMs = 1000`

Arrow 2:
- direction from `readChoice(["up", "down", "left", "right"])`
- `1 forward bit` => color
- `2 forward bits via readChoice([-6, 12, 24, 40])` => speed variation
- `2 forward bits via readChoice([460, 560, 660, 760])` => short pause after the pair

### What the bits control

Quantum entropy determines:
- how many arrows or paired volleys the phase has
- arrow direction
- arrow color
- arrow speed
- the pause structure in phase 2

## Quantum Rain

Relevant file:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

This phase uses a quantum-built base pattern and then consumes fresh forward bits for every live wave.

### Phase-level bits

- `3 forward bits` => lane set template
- `2 forward bits` => shared speed profile
- `2 forward bits` => wave spacing profile
- `2 forward bits` => trap layout

Lane template count:
- `8`

Shared speed table:
- `360`
- `390`
- `420`
- `450`

Wave spacing table:
- `2200`
- `1900`
- `1700`
- `1500`

Warning base table:
- `920`
- `980`
- `1060`
- `880`

### Per-wave bits

Every new wave consumes fresh forward bits:

- `1 forward bit` => number of green shards
  - `0 => 1 green`
  - `1 => 2 green`
- distinct lane picks for the green shard lanes
- `2 forward bits` => shared speed variance
  - `-8`
  - `+10`
  - `+22`
  - `+38`
- `2 forward bits` => warning variance
  - `-110`
  - `-60`
  - `0`
  - `+80`

The phase then applies one shared fall speed to the whole wave.

### Per-wave cyan-tile preset

Every wave also consumes:
- `3 forward bits`
- selects one of `8` cyan Chaos tile presets

### What the bits control

Quantum entropy determines:
- which lane geometry family the phase uses
- how fast the wave family is
- whether a wave has 1 or 2 green shards
- which exact lanes are green
- the shared fall speed for that wave
- the warning timing for that wave
- which cyan-tile layout appears for that wave

## Resonance Constellation

Relevant file:
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)

### Phase-level bits

- `2 forward bits` => pulse profile
- `2 forward bits` => hazard speed profile
- `2 forward bits` => hazard count offset

Pulse table:
- `980`
- `760`
- `620`
- `480`

Hazard base speed table:
- `92`
- `122`
- `156`
- `196`

Hazard count:
- `5 + readInt(2)` => `5..8`

### Constellation family selection

The game uses hardcoded fair/readable families and quantum entropy chooses between them.

Current family table:
- Six Point Star
- Square Frame + Circle Ring
- Seven Zigzag
- Triangle Ring + Pentagon Seal
- Pentagon Seal + Square Frame
- Twin Arcs
- Diamond Web
- Broken Ladder
- Six Point Star + Square Frame

Selection:
- `readChoice(constellationFamilies, "forward")`

### Order bits

- `1 forward bit`
- `0 => normal node order`
- `1 => reverse node order`

### Hazard bits

For each red hazard orb:
- spawn position from a 12-position preset table
- `3 forward bits` => launch angle in 45-degree steps
- speed variation from `readChoice([-16, 6, 22, 52])`

### What the bits control

Quantum entropy determines:
- which constellation family appears
- whether the target order is forward or reversed
- how many red hazard orbs spawn
- where they spawn
- which direction they launch
- how fast they move

## Phase Two Transition

Relevant file:
- [frontend/src/game/RunController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/RunController.ts)

The phase-two transition itself is scripted presentation, but phase two still uses the same quantum foundation:
- Goal drops from `100` to `40`
- Chaos becomes more volatile
- the next active phase is forced to Ruin
- the active Ruin minigames use their phase-two variants

Phase two keeps using:
- forward bits for phase generation
- reverse bits for Chaos updates

## Why Presets Are Hardcoded

Not every attack shape is drawn directly from raw bits.

The game deliberately uses:
- hardcoded preset families for readability and fairness
- quantum bits to choose among those families and parameterize them

That is why:
- blaster lane centers are preset
- lattice families are preset
- constellation families are preset

The quantum entropy still decides:
- which preset appears
- how it is mirrored or ordered
- timing and hazard structure
- lane or position selection inside the phase

## Why Repeated Restarts Can Look The Same

Because the backend returns the raw CURBY round bytes directly, restarting the game on the same round will reuse the same quantum bitstream.

That means:
- same CURBY round
- same opening controller
- same early phase order
- same early pattern decisions

This is current intended behavior for the project.

## Files That Matter Most

Frontend entropy + gameplay:
- [frontend/src/game/QuantumBitStream.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/QuantumBitStream.ts)
- [frontend/src/game/ChaosController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/ChaosController.ts)
- [frontend/src/game/PhaseController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/PhaseController.ts)
- [frontend/src/game/RunController.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/RunController.ts)
- [frontend/src/game/ArenaCanvas.ts](/Users/albertzheng/Documents/quantum/frontend/src/game/ArenaCanvas.ts)

Backend session bootstrap:
- [backend/app/services/curby_service.py](/Users/albertzheng/Documents/quantum/backend/app/services/curby_service.py)
- [backend/app/services/session_service.py](/Users/albertzheng/Documents/quantum/backend/app/services/session_service.py)

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

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```
