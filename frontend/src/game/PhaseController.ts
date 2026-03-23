import { QuantumBitStream } from "./QuantumBitStream";
import type {
  ChaosTileConfig,
  Controller,
  CrossBlasterVolleyConfig,
  EndgameModifier,
  LatticeFrameConfig,
  OrbConfig,
  PhasePattern,
  PhaseState,
  PhaseType,
  ShardWaveConfig,
  ShieldArrowConfig,
  TrapZoneConfig,
} from "./types";

const PHASE_HP = 3;
const OLD_ARENA_X = 20;
const OLD_ARENA_WIDTH = 760;
const NEW_ARENA_X = 20;
const NEW_ARENA_WIDTH = 410;
const X_SCALE = NEW_ARENA_WIDTH / OLD_ARENA_WIDTH;
const BEAM_LANE_CENTERS = [170, 300, 430, 560, 690].map(scaleArenaX);
const BLASTER_X_LANES = [120, 250, 400, 550, 680].map(scaleArenaX);
const BLASTER_Y_LANES = [80, 160, 225, 290, 370];
const LATTICE_COLS = 5;
const LATTICE_ROWS = 4;

function scaleArenaX(value: number) {
  return NEW_ARENA_X + (value - OLD_ARENA_X) * X_SCALE;
}

function scaleSize(value: number) {
  return Math.max(12, value * X_SCALE);
}

function scaleTrapLayout(traps: TrapZoneConfig[]) {
  return traps.map((trap) => ({
    x: scaleArenaX(trap.x),
    y: trap.y,
    size: scaleSize(trap.size),
  }));
}

function scalePoints<T extends { x: number; y: number }>(points: T[]) {
  return points.map((point) => ({
    ...point,
    x: scaleArenaX(point.x),
  }));
}

const RUIN_TRAPS: TrapZoneConfig[][] = [
  [
    { x: 120, y: 120, size: 34 },
    { x: 680, y: 150, size: 34 },
    { x: 180, y: 340, size: 34 },
  ],
  [
    { x: 640, y: 118, size: 34 },
    { x: 676, y: 300, size: 34 },
    { x: 492, y: 338, size: 34 },
  ],
  [
    { x: 210, y: 362, size: 34 },
    { x: 382, y: 360, size: 34 },
    { x: 560, y: 358, size: 34 },
  ],
  [
    { x: 124, y: 108, size: 34 },
    { x: 674, y: 108, size: 34 },
    { x: 674, y: 336, size: 34 },
  ],
];

const SOLACE_TRAPS: TrapZoneConfig[][] = [
  [
    { x: 116, y: 102, size: 34 },
    { x: 684, y: 144, size: 34 },
    { x: 174, y: 332, size: 34 },
  ],
  [
    { x: 248, y: 188, size: 34 },
    { x: 642, y: 210, size: 34 },
    { x: 642, y: 332, size: 34 },
  ],
  [
    { x: 400, y: 204, size: 34 },
    { x: 298, y: 318, size: 34 },
    { x: 506, y: 318, size: 34 },
  ],
  [
    { x: 156, y: 150, size: 34 },
    { x: 400, y: 250, size: 34 },
    { x: 642, y: 150, size: 34 },
  ],
];

const NODE_LAYOUTS = [
  [
    { x: 180, y: 140 },
    { x: 620, y: 140 },
    { x: 260, y: 340 },
    { x: 570, y: 340 },
  ],
  [
    { x: 210, y: 126 },
    { x: 396, y: 114 },
    { x: 602, y: 152 },
    { x: 400, y: 334 },
  ],
  [
    { x: 182, y: 112 },
    { x: 230, y: 312 },
    { x: 554, y: 128 },
    { x: 602, y: 324 },
  ],
  [
    { x: 400, y: 104 },
    { x: 226, y: 228 },
    { x: 574, y: 230 },
    { x: 400, y: 346 },
  ],
  [
    { x: 330, y: 170 },
    { x: 470, y: 170 },
    { x: 316, y: 298 },
    { x: 484, y: 298 },
  ],
  [
    { x: 154, y: 132 },
    { x: 640, y: 132 },
    { x: 154, y: 330 },
    { x: 640, y: 330 },
  ],
  [
    { x: 250, y: 260 },
    { x: 560, y: 258 },
    { x: 176, y: 346 },
    { x: 632, y: 348 },
  ],
  [
    { x: 248, y: 108 },
    { x: 560, y: 106 },
    { x: 176, y: 194 },
    { x: 632, y: 196 },
  ],
];

const NODE_ORDERS = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
  [1, 0, 2, 3],
  [1, 2, 0, 3],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
  [2, 1, 3, 0],
  [2, 3, 1, 0],
  [3, 0, 2, 1],
  [3, 1, 0, 2],
  [3, 2, 0, 1],
  [0, 2, 3, 1],
  [1, 3, 2, 0],
  [2, 0, 1, 3],
  [3, 1, 2, 0],
];

const ENDGAME_MODIFIERS: EndgameModifier[] = [
  "stable_solace_end",
  "stable_ruin_end",
  "rapid_oscillation",
  "delayed_collapse",
  "violent_surge",
  "ritual_lock",
  "fracture_storm",
  "mirror_break",
];

function rotateArray<T>(values: T[], amount: number) {
  const offset = ((amount % values.length) + values.length) % values.length;
  return values.slice(offset).concat(values.slice(0, offset));
}

function mirrorCellIndex(index: number, cols: number, rows: number, mirrorX: boolean, mirrorY: boolean) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const nextCol = mirrorX ? cols - col - 1 : col;
  const nextRow = mirrorY ? rows - row - 1 : row;
  return nextRow * cols + nextCol;
}

function transformCells(
  cells: number[],
  cols: number,
  rows: number,
  mirrorX: boolean,
  mirrorY: boolean,
) {
  return cells.map((cell) => mirrorCellIndex(cell, cols, rows, mirrorX, mirrorY));
}

export class PhaseController {
  constructor(private readonly stream: QuantumBitStream) {}

  readStartingController() {
    return this.stream.readBit("forward") === 0 ? "ruin" : "solace";
  }

  readEndgameModifier() {
    return ENDGAME_MODIFIERS[this.stream.readInt(3, "forward")];
  }

  nextShardWave(pattern: Extract<PhasePattern, { type: "solace_shards" | "quantum_rain" }>): ShardWaveConfig {
    const { lanePositions, templateIndex, warningBaseMs, goodSpeedBase } = pattern.shardPattern;
    const greenCount = this.stream.readBit("forward") === 0 ? 1 : 2;
    const greenIndexes = new Set(this.stream.readDistinctLanes(greenCount, lanePositions.length, "forward"));
    const laneKinds = lanePositions.map((_, index) => (greenIndexes.has(index) ? "good" : "bad") as const);
    const sharedSpeedVariance = [-8, 10, 22, 38][this.stream.readInt(2, "forward")];
    const warningVariance = [-110, -60, 0, 80][this.stream.readInt(2, "forward")];
    const laneOrdering = this.getLaneOrdering(templateIndex, lanePositions.length);
    const sharedWarningMs = Math.max(650, warningBaseMs + warningVariance);

    const lanes = lanePositions
      .map((_, index) => index)
      .sort((left, right) => laneOrdering.indexOf(left) - laneOrdering.indexOf(right))
      .map((laneIndex) => {
        const kind = laneKinds[laneIndex];
        return {
          x: lanePositions[laneIndex],
          kind,
          fallSpeed: goodSpeedBase + sharedSpeedVariance,
          warningMs: sharedWarningMs,
        };
      });

    return { lanes };
  }

  nextShardTrapLayout(): TrapZoneConfig[] {
    const shardTrapPresets: TrapZoneConfig[][] = [
      [
        { x: scaleArenaX(160), y: 132, size: scaleSize(34) },
        { x: scaleArenaX(400), y: 218, size: scaleSize(34) },
        { x: scaleArenaX(640), y: 304, size: scaleSize(34) },
      ],
      [
        { x: scaleArenaX(236), y: 110, size: scaleSize(34) },
        { x: scaleArenaX(400), y: 298, size: scaleSize(34) },
        { x: scaleArenaX(564), y: 168, size: scaleSize(34) },
      ],
      [
        { x: scaleArenaX(126), y: 222, size: scaleSize(34) },
        { x: scaleArenaX(400), y: 122, size: scaleSize(34) },
        { x: scaleArenaX(674), y: 264, size: scaleSize(34) },
      ],
      [
        { x: scaleArenaX(206), y: 170, size: scaleSize(34) },
        { x: scaleArenaX(400), y: 320, size: scaleSize(34) },
        { x: scaleArenaX(594), y: 170, size: scaleSize(34) },
      ],
      [
        { x: scaleArenaX(176), y: 322, size: scaleSize(34) },
        { x: scaleArenaX(344), y: 136, size: scaleSize(34) },
        { x: scaleArenaX(622), y: 234, size: scaleSize(34) },
      ],
      [
        { x: scaleArenaX(142), y: 146, size: scaleSize(34) },
        { x: scaleArenaX(510), y: 126, size: scaleSize(34) },
        { x: scaleArenaX(468), y: 324, size: scaleSize(34) },
      ],
      [
        { x: scaleArenaX(252), y: 252, size: scaleSize(34) },
        { x: scaleArenaX(400), y: 108, size: scaleSize(34) },
        { x: scaleArenaX(548), y: 252, size: scaleSize(34) },
      ],
      [
        { x: scaleArenaX(196), y: 118, size: scaleSize(34) },
        { x: scaleArenaX(606), y: 142, size: scaleSize(34) },
        { x: scaleArenaX(362), y: 326, size: scaleSize(34) },
      ],
    ];

    return shardTrapPresets[this.stream.readInt(3, "forward")].map((trap) => ({ ...trap }));
  }

  buildPhase(controller: Controller, phaseTwoActive = false): PhaseState {
    const type = controller === "ruin"
      ? this.stream.readChoice<PhaseType>(["quantum_lattice", "cross_blasters", "shield_parry"], "forward")
      : this.stream.readChoice<PhaseType>(["quantum_rain", "resonance_constellation"], "forward");

    const pattern = this.buildPattern(type, phaseTwoActive);
    const timeRemaining = type === "quantum_rain"
      ? Number.POSITIVE_INFINITY
      : type === "resonance_constellation"
        ? 15
        : 12;
    const objectiveTarget = type === "resonance_constellation"
      ? pattern.type === "resonance_constellation" ? pattern.resonance.targets.length : 0
      : (type === "resonance_tiles") ? 4 : type === "quantum_rain" ? 6 : 0;

    return {
      type,
      hp: PHASE_HP,
      maxHp: PHASE_HP,
      timeRemaining,
      objectiveProgress: 0,
      objectiveTarget,
      pattern,
    };
  }

  buildSpecificPhase(type: PhaseType, phaseTwoActive = false): PhaseState {
    const pattern = this.buildPattern(type, phaseTwoActive);
    const timeRemaining = type === "quantum_rain"
      ? Number.POSITIVE_INFINITY
      : type === "resonance_constellation"
        ? 15
        : 12;
    const objectiveTarget = type === "resonance_constellation"
      ? pattern.type === "resonance_constellation" ? pattern.resonance.targets.length : 0
      : (type === "resonance_tiles") ? 4 : type === "quantum_rain" ? 6 : 0;

    return {
      type,
      hp: PHASE_HP,
      maxHp: PHASE_HP,
      timeRemaining,
      objectiveProgress: 0,
      objectiveTarget,
      pattern,
    };
  }

  getObjectiveText(phase: PhaseState) {
    switch (phase.type) {
      case "quantum_lattice":
        return "Stay inside the safe cells as the lattice collapses";
      case "orbit_constellation":
        return "Survive the rotating constellation and its crossing paths";
      case "cross_blasters":
        return "Read the four blasters and step out of their crossfire";
      case "collapse_corridor":
        return "Stay inside the safe corridor as the walls collapse";
      case "shield_parry":
        return "Hold the shield toward incoming red arrows. Let cyan arrows hit you for chaos.";
      case "quantum_rain":
        return `Catch ${phase.objectiveTarget} green shards`;
      case "resonance_tiles":
        return `Step on ${phase.objectiveTarget} resonance tiles in order`;
      case "resonance_constellation":
        return `Trace ${phase.objectiveTarget} constellation nodes in 15 seconds`;
      case "ruin_orbs":
        return "Legacy lattice pattern";
      case "ruin_beams":
        return "Legacy corridor pattern";
      case "solace_nodes":
        return `Legacy constellation nodes`;
      case "solace_shards":
        return `Legacy shard rain`;
      default:
        return "Hold on";
    }
  }

  private buildPattern(type: PhaseType, phaseTwoActive = false): PhasePattern {
    switch (type) {
      case "quantum_lattice":
        return this.buildQuantumLattice(phaseTwoActive);
      case "orbit_constellation":
        return this.buildOrbitConstellation();
      case "cross_blasters":
        return this.buildCrossBlasters(phaseTwoActive);
      case "collapse_corridor":
        return this.buildCollapseCorridor();
      case "shield_parry":
        return this.buildShieldParry(phaseTwoActive);
      case "quantum_rain":
        return this.buildQuantumRain();
      case "resonance_tiles":
        return this.buildResonanceTiles();
      case "resonance_constellation":
        return this.buildResonanceConstellation();
      case "ruin_orbs":
        return this.buildRuinOrbs();
      case "ruin_beams":
        return this.buildRuinBeams();
      case "solace_nodes":
        return this.buildSolaceNodes();
      case "solace_shards":
        return this.buildSolaceShards();
      default:
        return this.buildQuantumRain();
    }
  }

  private buildQuantumLattice(phaseTwoActive = false): PhasePattern {
    const legacy = this.buildRuinOrbs();
    const frames = legacy.lattice.frames.map((frame) => ({
      ...frame,
      warningCells: this.pickLatticeChaosCells(frame.warningCells, frame.activeCells),
      durationMs: phaseTwoActive ? 1300 : 2000,
    }));
    return {
      type: "quantum_lattice",
      templateName: legacy.templateName,
      traps: [],
      lattice: {
        ...legacy.lattice,
        frames,
      },
    };
  }

  private buildOrbitConstellation(): PhasePattern {
    const family = this.stream.readInt(3, "forward");
    const motionProfile = this.stream.readInt(2, "forward");
    const speedProfile = this.stream.readInt(2, "forward");
    const radiusProfile = this.stream.readInt(2, "forward");
    const trapLayout = this.stream.readInt(2, "forward");
    const clockwise = this.stream.readBit("forward") === 1 ? 1 : -1;
    const connectLines = this.stream.readBit("forward") === 1;

    const radiusBase = [96, 116, 134, 152][radiusProfile];
    const speedBase = [0.6, 0.82, 1.06, 1.3][speedProfile] * clockwise;
    const pulseMs = [1800, 1500, 1240, 980][speedProfile];
    const motionModes = ["pulse", "spiral", "staggered", "breathing"] as const;
    const families = [
      { name: "Square Ring", count: 4 },
      { name: "Triangle Orbit", count: 3 },
      { name: "Broken Pentagon", count: 5 },
      { name: "Twin Pair", count: 4 },
      { name: "Cross Halo", count: 4 },
      { name: "Wide Star", count: 5 },
      { name: "Mirror Arc", count: 4 },
      { name: "Fracture Bloom", count: 6 },
    ];
    const chosen = families[family];
    const stars = Array.from({ length: chosen.count }, (_, index) => ({
      angle: (Math.PI * 2 * index) / chosen.count + this.stream.readInt(3, "forward") * 0.09,
      angularVelocity: speedBase + (index % 2 === 0 ? 0.12 : -0.08),
      radius: radiusBase + (index % 3) * 14,
      size: 13 + (index % 2) * 4,
      phaseOffset: (Math.PI * 2 * index) / chosen.count,
      radiusBias: [-12, -4, 4, 12][this.stream.readInt(2, "forward")],
    }));
    const maxRadius = radiusBase + 26;
    const minRadius = Math.max(34, radiusBase - [48, 58, 66, 74][radiusProfile]);
    const motionName = {
      pulse: "Pulse Collapse",
      spiral: "Spiral Collapse",
      staggered: "Staggered Collapse",
      breathing: "Breathing Ring",
    }[motionModes[motionProfile]];

    return {
      type: "orbit_constellation",
      templateName: `${motionName} - ${chosen.name}`,
      traps: scaleTrapLayout(RUIN_TRAPS[trapLayout]),
      constellation: {
        centerX: scaleArenaX(400),
        centerY: 225,
        stars,
        connectLines,
        motionMode: motionModes[motionProfile],
        pulseMs,
        minRadius,
        maxRadius,
      },
    };
  }

  private buildCrossBlasters(phaseTwoActive = false): PhasePattern {
    const trapLayout = this.stream.readInt(2, "forward");
    const warningProfile = this.stream.readInt(2, "forward");
    const fireProfile = this.stream.readInt(2, "forward");
    const thicknessProfile = this.stream.readInt(2, "forward");
    const volleyCount = (phaseTwoActive ? 6 : 5) + this.stream.readInt(2, "forward");
    const volleys: CrossBlasterVolleyConfig[] = [];

    for (let index = 0; index < volleyCount; index += 1) {
      const verticalLanes = this.stream.readDistinctLanes(phaseTwoActive ? 3 : 2, BLASTER_X_LANES.length, "forward");
      const horizontalLanes = this.stream.readDistinctLanes(phaseTwoActive ? 3 : 2, BLASTER_Y_LANES.length, "forward");
      volleys.push({
        verticalLanes,
        verticalAnchors: Array.from({ length: verticalLanes.length }, () => (this.stream.readBit("forward") === 0 ? "top" : "bottom")),
        horizontalLanes,
        horizontalAnchors: Array.from({ length: horizontalLanes.length }, () => (this.stream.readBit("forward") === 0 ? "left" : "right")),
      });
    }

    return {
      type: "cross_blasters",
      templateName: "Cross Blasters",
      traps: scaleTrapLayout(RUIN_TRAPS[trapLayout]),
      blasters: {
        xLaneCenters: BLASTER_X_LANES,
        yLaneCenters: BLASTER_Y_LANES,
        volleys,
        warningMs: phaseTwoActive ? [1900, 1780, 1700, 1620][warningProfile] : [1000, 920, 820, 760][warningProfile],
        fireMs: [260, 320, 360, 420][fireProfile],
        beamThickness: scaleSize(phaseTwoActive ? [58, 72, 86, 100][thicknessProfile] : [40, 54, 68, 86][thicknessProfile]),
      },
    };
  }

  private buildCollapseCorridor(): PhasePattern {
    const legacy = this.buildRuinBeams();
    return {
      type: "collapse_corridor",
      templateName: legacy.templateName.replace("Quantum Gates", "Collapse Corridor"),
      traps: legacy.traps,
      corridor: legacy.beams,
    };
  }

  private buildShieldParry(phaseTwoActive = false): PhasePattern {
    const trapLayout = this.stream.readInt(2, "forward");
    const speedProfile = this.stream.readInt(2, "forward");
    const spawnProfile = this.stream.readInt(2, "forward");
    const arrowCount = 12 + this.stream.readInt(2, "forward");
    const baseSpeed = [165, 198, 232, 270][speedProfile];
    const arrows: ShieldArrowConfig[] = [];
    if (phaseTwoActive) {
      const volleyCount = 6 + this.stream.readInt(2, "forward");
      for (let index = 0; index < volleyCount; index += 1) {
        arrows.push({
          direction: this.stream.readChoice(["up", "down", "left", "right"] as const, "forward"),
          kind: this.stream.readBit("forward") === 0 ? "red" : "cyan",
          speed: baseSpeed + this.stream.readChoice([-6, 12, 24, 40], "forward"),
          delayAfterMs: 1000,
        });
        arrows.push({
          direction: this.stream.readChoice(["up", "down", "left", "right"] as const, "forward"),
          kind: this.stream.readBit("forward") === 0 ? "red" : "cyan",
          speed: baseSpeed + this.stream.readChoice([-6, 12, 24, 40], "forward"),
          delayAfterMs: this.stream.readChoice([460, 560, 660, 760], "forward"),
        });
      }
    } else {
      for (let index = 0; index < arrowCount; index += 1) {
        arrows.push({
          direction: this.stream.readChoice(["up", "down", "left", "right"] as const, "forward"),
          kind: this.stream.readBit("forward") === 0 ? "red" : "cyan",
          speed: baseSpeed + this.stream.readChoice([-18, -6, 12, 24], "forward"),
        });
      }
    }

    return {
      type: "shield_parry",
      templateName: phaseTwoActive ? "Quantum Shield - Fracture Volley" : "Quantum Shield",
      traps: scaleTrapLayout(RUIN_TRAPS[trapLayout]),
      parry: {
        arrows,
        spawnDelayMs: [500, 420, 350, 280][spawnProfile],
        shieldSize: 28,
      },
    };
  }

  private buildQuantumRain(): PhasePattern {
    const legacy = this.buildSolaceShards();
    return {
      type: "quantum_rain",
      templateName: legacy.templateName,
      traps: legacy.traps,
      shardPattern: legacy.shardPattern,
    };
  }

  private buildResonanceTiles(): PhasePattern {
    const trapLayout = this.stream.readInt(2, "forward");
    const layoutIndex = this.stream.readInt(3, "forward");
    const orderIndex = this.stream.readInt(4, "forward");
    const wispProfile = this.stream.readInt(2, "forward");
    const tileLayouts = [
      [{ x: 200, y: 118 }, { x: 400, y: 118 }, { x: 600, y: 118 }, { x: 300, y: 300 }, { x: 500, y: 300 }],
      [{ x: 180, y: 160 }, { x: 310, y: 118 }, { x: 490, y: 118 }, { x: 620, y: 160 }, { x: 400, y: 312 }],
      [{ x: 240, y: 108 }, { x: 560, y: 108 }, { x: 180, y: 280 }, { x: 400, y: 225 }, { x: 620, y: 280 }],
      [{ x: 220, y: 225 }, { x: 400, y: 118 }, { x: 580, y: 225 }, { x: 320, y: 332 }, { x: 480, y: 332 }],
      [{ x: 180, y: 118 }, { x: 620, y: 118 }, { x: 180, y: 332 }, { x: 620, y: 332 }, { x: 400, y: 225 }],
      [{ x: 250, y: 136 }, { x: 400, y: 136 }, { x: 550, y: 136 }, { x: 325, y: 320 }, { x: 475, y: 320 }],
      [{ x: 210, y: 140 }, { x: 590, y: 140 }, { x: 320, y: 225 }, { x: 480, y: 225 }, { x: 400, y: 332 }],
      [{ x: 400, y: 96 }, { x: 240, y: 205 }, { x: 560, y: 205 }, { x: 320, y: 332 }, { x: 480, y: 332 }],
    ];
    const orders = [
      [0, 1, 4, 3],
      [2, 1, 4, 3],
      [4, 0, 3, 2],
      [1, 2, 4, 0],
      [0, 4, 1, 2],
      [3, 4, 1, 0],
      [2, 4, 3, 1],
      [1, 0, 4, 2],
      [4, 2, 1, 0],
      [3, 0, 4, 2],
      [2, 3, 4, 1],
      [0, 2, 4, 1],
      [4, 1, 3, 0],
      [1, 4, 2, 0],
      [2, 0, 4, 3],
      [3, 1, 4, 2],
    ];
    const hazardSets = [
      [
        { x: 124, y: 154, radius: 14, vx: 108, vy: 32 },
        { x: 684, y: 298, radius: 14, vx: -104, vy: -26 },
      ],
      [
        { x: 108, y: 228, radius: 15, vx: 124, vy: 0 },
        { x: 694, y: 178, radius: 15, vx: -120, vy: 0 },
      ],
      [
        { x: 190, y: 100, radius: 13, vx: 72, vy: 84 },
        { x: 610, y: 350, radius: 13, vx: -74, vy: -88 },
      ],
      [
        { x: 100, y: 104, radius: 13, vx: 120, vy: 56 },
        { x: 700, y: 104, radius: 13, vx: -120, vy: 58 },
        { x: 400, y: 350, radius: 13, vx: 0, vy: -118 },
      ],
    ];

    return {
      type: "resonance_tiles",
      templateName: "Resonance Tiles",
      traps: scaleTrapLayout(SOLACE_TRAPS[trapLayout]),
      tiles: {
        targets: orders[orderIndex].map((tileIndex, index) => {
          const tile = tileLayouts[layoutIndex][tileIndex];
          return {
            x: scaleArenaX(tile.x),
            y: tile.y,
            size: scaleSize(46),
            index,
          };
        }),
        hazards: hazardSets[wispProfile],
      },
    };
  }

  private buildResonanceConstellation(): PhasePattern {
    const pulseProfile = this.stream.readInt(2, "forward");
    const hazardSpeedProfile = this.stream.readInt(2, "forward");
    const hazardCount = 5 + this.stream.readInt(2, "forward");
    const offsetPoints = (points: { x: number; y: number }[], dx: number, dy: number) =>
      points.map((point) => ({ x: point.x + dx, y: point.y + dy }));

    const starSix = scalePoints([
      { x: 400, y: 84 },
      { x: 524, y: 154 },
      { x: 524, y: 306 },
      { x: 400, y: 366 },
      { x: 276, y: 306 },
      { x: 276, y: 154 },
    ]);
    const squareFour = scalePoints([
      { x: 258, y: 98 },
      { x: 542, y: 98 },
      { x: 542, y: 352 },
      { x: 258, y: 352 },
    ]);
    const zigzagSeven = scalePoints([
      { x: 160, y: 116 },
      { x: 272, y: 172 },
      { x: 214, y: 252 },
      { x: 390, y: 188 },
      { x: 470, y: 278 },
      { x: 594, y: 202 },
      { x: 660, y: 320 },
    ]);
    const circleThree = scalePoints([
      { x: 400, y: 100 },
      { x: 286, y: 302 },
      { x: 514, y: 302 },
    ]);
    const pentagonFive = scalePoints([
      { x: 400, y: 84 },
      { x: 544, y: 186 },
      { x: 488, y: 346 },
      { x: 312, y: 346 },
      { x: 256, y: 186 },
    ]);
    const twinArcsSix = scalePoints([
      { x: 220, y: 150 },
      { x: 314, y: 94 },
      { x: 400, y: 132 },
      { x: 486, y: 94 },
      { x: 580, y: 150 },
      { x: 548, y: 324 },
    ]);
    const diamondWebEight = scalePoints([
      { x: 400, y: 74 },
      { x: 552, y: 150 },
      { x: 624, y: 238 },
      { x: 552, y: 326 },
      { x: 400, y: 382 },
      { x: 248, y: 326 },
      { x: 176, y: 238 },
      { x: 248, y: 150 },
    ]);
    const brokenLadderEight = scalePoints([
      { x: 182, y: 106 },
      { x: 312, y: 154 },
      { x: 272, y: 242 },
      { x: 418, y: 184 },
      { x: 510, y: 278 },
      { x: 636, y: 222 },
      { x: 590, y: 336 },
      { x: 710, y: 292 },
    ]);

    const constellationFamilies = [
      { name: "Six Point Star", groups: [starSix] },
      { name: "Square Frame + Circle Ring", groups: [offsetPoints(squareFour, -70, 0), offsetPoints(circleThree, 122, 8)] },
      { name: "Seven Zigzag", groups: [zigzagSeven] },
      { name: "Triangle Ring + Pentagon Seal", groups: [offsetPoints(circleThree, -118, 10), offsetPoints(pentagonFive, 92, 0)] },
      { name: "Pentagon Seal + Square Frame", groups: [offsetPoints(pentagonFive, -94, 0), offsetPoints(squareFour, 124, 0)] },
      { name: "Twin Arcs", groups: [twinArcsSix] },
      { name: "Diamond Web", groups: [diamondWebEight] },
      { name: "Broken Ladder", groups: [brokenLadderEight] },
      { name: "Six Point Star + Square Frame", groups: [offsetPoints(starSix, -94, 0), offsetPoints(squareFour, 132, 0)] },
    ] as const;

    const chosenFamily = this.stream.readChoice(constellationFamilies, "forward");
    const reverseObjectiveOrder = this.stream.readBit("forward") === 1;
    const targets = [];
    let objectiveIndex = 0;
    chosenFamily.groups.forEach((groupPositions, group) => {
      const positions = reverseObjectiveOrder ? [...groupPositions].reverse() : groupPositions;
      positions.forEach((node) => {
        targets.push({
          x: node.x,
          y: node.y,
          size: scaleSize(44),
          index: objectiveIndex,
          group,
        });
        objectiveIndex += 1;
      });
    });

    const speedBase = [92, 122, 156, 196][hazardSpeedProfile];
    const hazardPositions = [
      { x: scaleArenaX(120), y: 110 },
      { x: scaleArenaX(220), y: 80 },
      { x: scaleArenaX(400), y: 92 },
      { x: scaleArenaX(580), y: 84 },
      { x: scaleArenaX(680), y: 122 },
      { x: scaleArenaX(120), y: 340 },
      { x: scaleArenaX(220), y: 360 },
      { x: scaleArenaX(400), y: 350 },
      { x: scaleArenaX(580), y: 362 },
      { x: scaleArenaX(680), y: 332 },
      { x: scaleArenaX(92), y: 220 },
      { x: scaleArenaX(708), y: 226 },
    ];
    const hazards: OrbConfig[] = [];
    for (let index = 0; index < hazardCount; index += 1) {
      const position = this.stream.readChoice(hazardPositions, "forward");
      const angle = (Math.PI / 4) * this.stream.readInt(3, "forward");
      const speed = speedBase + this.stream.readChoice([-16, 6, 22, 52], "forward");
      hazards.push({
        x: position.x,
        y: position.y,
        radius: scaleSize(11 + (index % 2)),
        vx: Math.cos(angle) * speed * X_SCALE,
        vy: Math.sin(angle) * speed,
      });
    }

    return {
      type: "resonance_constellation",
      templateName: chosenFamily.name,
      traps: [],
      resonance: {
        targets,
        hazards,
        chaosTiles: [],
        stars: {
          centerX: scaleArenaX(400),
          centerY: 225,
          stars: [],
          connectLines: false,
          motionMode: "pulse",
          pulseMs: 1400,
          minRadius: 0,
          maxRadius: 0,
        },
        pulseMs: [980, 760, 620, 480][pulseProfile],
      },
    };
  }

  private buildRuinOrbs(): PhasePattern {
    const template = this.stream.readInt(3, "forward");
    const tempoProfile = this.stream.readInt(2, "forward");
    const trapLayout = this.stream.readInt(2, "forward");
    const mirrorX = this.stream.readBit("forward") === 1;
    const mirrorY = this.stream.readBit("forward") === 1;
    const reverseOrder = this.stream.readBit("forward") === 1;
    const durationBase = [1500, 1260, 1040, 860][tempoProfile];
    const templateData: { name: string; frames: number[][] }[] = [
      { name: "Side Sweep", frames: [[0, 1, 5, 6, 10, 11, 15, 16], [1, 2, 6, 7, 11, 12, 16, 17], [2, 3, 7, 8, 12, 13, 17, 18], [3, 4, 8, 9, 13, 14, 18, 19]] },
      { name: "Top Cascade", frames: [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19]] },
      { name: "Checker Pulse", frames: [[0, 2, 4, 6, 8, 10, 12, 14, 16, 18], [1, 3, 5, 7, 9, 11, 13, 15, 17, 19], [0, 1, 5, 6, 12, 13, 17, 18], [2, 3, 8, 9, 10, 11, 15, 16]] },
      { name: "Center Crush", frames: [[0, 4, 5, 9, 10, 14, 15, 19], [1, 3, 6, 8, 11, 13, 16, 18], [2, 7, 12, 17], [1, 2, 3, 6, 7, 8, 11, 12, 13, 16, 17, 18]] },
      { name: "Corner Fold", frames: [[0, 1, 5, 6, 13, 14, 18, 19], [2, 3, 7, 8, 11, 12, 16, 17], [0, 4, 9, 10, 15, 19], [1, 2, 7, 12, 17, 18]] },
      { name: "Diamond Ring", frames: [[2, 6, 8, 10, 14, 16, 18], [1, 7, 11, 13, 17], [0, 4, 5, 9, 15, 19], [2, 6, 12, 18]] },
      { name: "Broken Cross", frames: [[2, 7, 12, 17], [10, 11, 12, 13, 14], [0, 6, 8, 16, 18], [4, 6, 8, 16, 18]] },
      { name: "Serpent Path", frames: [[0, 1, 2, 8, 14, 15, 16], [3, 4, 8, 12, 16, 17, 18], [1, 6, 7, 13, 14, 19], [0, 5, 6, 12, 13, 18, 19]] },
    ];

    const chosen = templateData[template];
    const orderedFrames = reverseOrder ? [...chosen.frames].reverse() : chosen.frames;
    const frames: LatticeFrameConfig[] = orderedFrames.map((activeCells, index) => ({
      activeCells: transformCells(activeCells, LATTICE_COLS, LATTICE_ROWS, mirrorX, mirrorY),
      warningCells: transformCells(
        orderedFrames[(index + 1) % orderedFrames.length],
        LATTICE_COLS,
        LATTICE_ROWS,
        mirrorX,
        mirrorY,
      ),
      durationMs: durationBase + [0, 80, -60, 120][this.stream.readInt(2, "forward")],
    }));

    return {
      type: "ruin_orbs",
      templateName: `Quantum Lattice - ${chosen.name}`,
      traps: RUIN_TRAPS[trapLayout],
      lattice: {
        cols: LATTICE_COLS,
        rows: LATTICE_ROWS,
        cellWidth: 152,
        cellHeight: 102.5,
        frames,
      },
    };
  }

  private buildRuinBeams(): PhasePattern {
    const template = this.stream.readInt(3, "forward");
    const sequencePattern = this.stream.readInt(3, "forward");
    const warningProfile = this.stream.readInt(2, "forward");
    const trapLayout = this.stream.readInt(2, "forward");
    const sequenceOffset = this.stream.readInt(2, "forward");

    const sequenceTable = [
      [[0, 4], [1, 3], [2], [0, 2, 4], [1, 3], [2]],
      [[2], [0, 4], [1, 3], [0, 1, 4], [2], [3]],
      [[0, 1], [3, 4], [1, 2], [2, 3], [0, 2, 4], [1, 3]],
      [[4], [3, 4], [2, 3], [1, 2], [0, 1], [0, 2, 4]],
      [[1, 3], [0, 4], [2], [1, 2, 3], [0, 4], [2]],
      [[0, 2, 4], [1, 3], [0, 1], [3, 4], [2], [0, 4]],
      [[0], [2, 4], [1, 3], [0, 2], [3, 4], [1]],
      [[2, 3], [0, 1], [4], [1, 4], [0, 2], [3]],
    ];
    const templateNames = [
      "Outside Crush",
      "Zipper Gates",
      "Split Corridor",
      "Descending Lock",
      "Mirror Squeeze",
      "Broken Hall",
      "Pivot Corridor",
      "Fracture Sweep",
    ];
    const widths = [88, 78, 102, 74, 92, 108, 82, 96];
    const warnings = [900, 760, 660, 560];
    const fires = [260, 300, 340, 280, 300, 360, 270, 320];

    return {
      type: "ruin_beams",
      templateName: `Quantum Gates - ${templateNames[template]}`,
      traps: scaleTrapLayout(RUIN_TRAPS[trapLayout]),
      beams: {
        laneCenters: BEAM_LANE_CENTERS,
        laneSequence: rotateArray(sequenceTable[sequencePattern], sequenceOffset),
        laneWidth: scaleSize(widths[template] + (warningProfile === 2 ? 12 : 0) - (warningProfile === 1 ? 8 : 0)),
        warningMs: warnings[warningProfile],
        fireMs: fires[template],
        label: templateNames[template],
      },
    };
  }

  private buildSolaceNodes(): PhasePattern {
    const layoutIndex = this.stream.readInt(3, "forward");
    const orderIndex = this.stream.readInt(4, "forward");
    const wispProfile = this.stream.readInt(3, "forward");
    const trapLayout = this.stream.readInt(2, "forward");

    const wisps: OrbConfig[][] = [
      [
        { x: 160, y: 210, radius: 14, vx: 96, vy: 34 },
        { x: 654, y: 250, radius: 14, vx: -94, vy: -28 },
      ],
      [
        { x: 104, y: 144, radius: 14, vx: 128, vy: 0 },
        { x: 706, y: 310, radius: 14, vx: -124, vy: 0 },
      ],
      [
        { x: 138, y: 124, radius: 14, vx: 110, vy: 56 },
        { x: 676, y: 340, radius: 14, vx: -108, vy: -58 },
      ],
      [
        { x: 120, y: 246, radius: 16, vx: 136, vy: 24 },
        { x: 694, y: 160, radius: 16, vx: -132, vy: 30 },
      ],
      [
        { x: 96, y: 112, radius: 13, vx: 122, vy: 42 },
        { x: 702, y: 112, radius: 13, vx: -122, vy: 46 },
        { x: 402, y: 344, radius: 13, vx: 0, vy: -108 },
      ],
      [
        { x: 120, y: 196, radius: 15, vx: 132, vy: 0 },
        { x: 694, y: 252, radius: 15, vx: -136, vy: 0 },
        { x: 404, y: 96, radius: 13, vx: 0, vy: 122 },
      ],
      [
        { x: 166, y: 96, radius: 14, vx: 86, vy: 72 },
        { x: 634, y: 96, radius: 14, vx: -84, vy: 70 },
        { x: 166, y: 350, radius: 14, vx: 82, vy: -74 },
      ],
      [
        { x: 704, y: 350, radius: 14, vx: -92, vy: -70 },
        { x: 404, y: 90, radius: 16, vx: 0, vy: 136 },
        { x: 104, y: 228, radius: 13, vx: 126, vy: 18 },
      ],
    ];

    return {
      type: "solace_nodes",
      templateName: "Constellation Trace",
      traps: scaleTrapLayout(SOLACE_TRAPS[trapLayout]),
      nodes: {
        positions: scalePoints(NODE_LAYOUTS[layoutIndex]),
        order: NODE_ORDERS[orderIndex],
        wisps: wisps[wispProfile],
      },
    };
  }

  private buildSolaceShards(): PhasePattern {
    const templateIndex = this.stream.readInt(3, "forward");
    const sharedSpeedProfile = this.stream.readInt(2, "forward");
    const waveSpacingProfile = this.stream.readInt(2, "forward");
    const trapLayout = this.stream.readInt(2, "forward");
    const laneSets = [
      [96, 214, 332, 450, 568, 704],
      [108, 226, 322, 440, 558, 692],
      [88, 206, 324, 442, 560, 708],
      [118, 236, 334, 432, 550, 668],
      [100, 200, 320, 448, 576, 696],
      [124, 232, 340, 448, 556, 664],
      [92, 214, 336, 458, 580, 702],
      [112, 222, 332, 442, 552, 682],
    ];
    const lanePositions = laneSets[templateIndex].map(scaleArenaX);
    const warningMs = [920, 980, 1060, 880][waveSpacingProfile];
    const sharedSpeeds = [360, 390, 420, 450];
    const waveSpacing = [2200, 1900, 1700, 1500][waveSpacingProfile];
    return {
      type: "solace_shards",
      templateName: "Quantum Rain",
      traps: scaleTrapLayout(SOLACE_TRAPS[trapLayout]),
      shardPattern: {
        lanePositions,
        templateIndex,
        waveSpacingMs: waveSpacing,
        warningBaseMs: warningMs,
        goodSpeedBase: sharedSpeeds[sharedSpeedProfile],
        badSpeedBase: sharedSpeeds[sharedSpeedProfile],
      },
    };
  }

  private getLaneOrdering(templateIndex: number, laneCount: number) {
    if (laneCount === 6) {
      const orderings = [
        [0, 1, 2, 3, 4, 5],
        [5, 4, 3, 2, 1, 0],
        [2, 3, 1, 4, 0, 5],
        [3, 2, 4, 1, 5, 0],
        [1, 0, 2, 3, 5, 4],
        [4, 5, 3, 2, 0, 1],
        [0, 2, 4, 1, 3, 5],
        [5, 3, 1, 4, 2, 0],
      ];
      return orderings[templateIndex];
    }
    const orderings = [
      [0, 1, 2, 3, 4],
      [4, 3, 2, 1, 0],
      [2, 1, 3, 0, 4],
      [2, 3, 1, 4, 0],
      [1, 0, 2, 4, 3],
      [3, 4, 2, 0, 1],
      [0, 2, 4, 1, 3],
      [4, 2, 0, 3, 1],
    ];
    return orderings[templateIndex].slice(0, laneCount);
  }

  private getShardStagger(staggerMode: number, orderIndex: number, laneIndex: number, laneCount: number) {
    switch (staggerMode) {
      case 0:
        return 0;
      case 1:
        return orderIndex * 120;
      case 2:
        return (laneCount - laneIndex - 1) * 110;
      case 3:
        return laneIndex % 2 === 0 ? 0 : 180;
      default:
        return 0;
    }
  }

  private buildChaosTiles(count: number, size: number): ChaosTileConfig[] {
    const columns = [150, 275, 400, 525, 650];
    const rows = [110, 180, 250, 320];
    const used = new Set<string>();
    const tiles: ChaosTileConfig[] = [];
    while (tiles.length < count) {
      const x = this.stream.readChoice(columns, "forward");
      const y = this.stream.readChoice(rows, "forward");
      const key = `${x}:${y}`;
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      tiles.push({ x, y, size });
    }
    return tiles;
  }

  private pickLatticeChaosCells(preferredCells: number[], activeCells: number[]) {
    const pool = [...preferredCells];
    const remaining = Array.from({ length: LATTICE_COLS * LATTICE_ROWS }, (_, index) => index).filter(
      (index) => !activeCells.includes(index) && !pool.includes(index),
    );
    while (pool.length < 3 && remaining.length > 0) {
      const candidate = this.stream.readChoice(remaining, "forward");
      pool.push(candidate);
      remaining.splice(remaining.indexOf(candidate), 1);
    }
    const selected = new Set<number>();
    while (selected.size < 3 && pool.length > selected.size) {
      const options = pool.filter((value) => !selected.has(value));
      selected.add(this.stream.readChoice(options, "forward"));
    }
    return [...selected];
  }
}
