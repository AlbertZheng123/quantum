export type Controller = "ruin" | "solace" | "swapping";
export type EntropySource = "curby" | "fallback";
export type PhaseType =
  | "ruin_orbs"
  | "ruin_beams"
  | "solace_nodes"
  | "solace_shards"
  | "quantum_lattice"
  | "orbit_constellation"
  | "cross_blasters"
  | "collapse_corridor"
  | "shield_parry"
  | "quantum_rain"
  | "resonance_tiles"
  | "resonance_constellation"
  | "seal_alignment"
  | "light_routing";
export type EndgameModifier =
  | "stable_solace_end"
  | "stable_ruin_end"
  | "rapid_oscillation"
  | "delayed_collapse"
  | "violent_surge"
  | "ritual_lock"
  | "fracture_storm"
  | "mirror_break";

export interface SessionBootstrap {
  sessionId: string;
  roundId: string;
  entropySource: EntropySource;
  entropyWarning: string | null;
  entropyBytes: string;
  startedAt: string;
}

export interface TrapZoneConfig {
  x: number;
  y: number;
  size: number;
}

export interface LatticeFrameConfig {
  activeCells: number[];
  warningCells: number[];
  durationMs: number;
}

export interface LatticeConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  frames: LatticeFrameConfig[];
}

export interface OrbConfig {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}

export interface OrbitStarConfig {
  angle: number;
  angularVelocity: number;
  radius: number;
  size: number;
  phaseOffset?: number;
  radiusBias?: number;
}

export interface BeamConfig {
  laneCenters: number[];
  laneSequence: number[][];
  laneWidth: number;
  warningMs: number;
  fireMs: number;
  label: string;
}

export interface NodeLayoutConfig {
  positions: { x: number; y: number }[];
  order: number[];
  wisps: OrbConfig[];
}

export interface ResonanceTileConfig {
  x: number;
  y: number;
  size: number;
  index: number;
  group?: number;
}

export interface ChaosTileConfig {
  x: number;
  y: number;
  size: number;
}

export interface CrossBlasterVolleyConfig {
  verticalLanes: number[];
  verticalAnchors: ("top" | "bottom")[];
  horizontalLanes: number[];
  horizontalAnchors: ("left" | "right")[];
}

export interface CrossBlasterConfig {
  xLaneCenters: number[];
  yLaneCenters: number[];
  volleys: CrossBlasterVolleyConfig[];
  warningMs: number;
  fireMs: number;
  beamThickness: number;
}

export interface ShieldArrowConfig {
  direction: "up" | "down" | "left" | "right";
  kind: "red" | "cyan";
  speed: number;
}

export interface ShieldParryConfig {
  arrows: ShieldArrowConfig[];
  spawnDelayMs: number;
  shieldSize: number;
}

export interface OrbitConstellationConfig {
  centerX: number;
  centerY: number;
  stars: OrbitStarConfig[];
  connectLines: boolean;
  motionMode: "pulse" | "spiral" | "staggered" | "breathing";
  pulseMs: number;
  minRadius: number;
  maxRadius: number;
}

export interface ShardLaneConfig {
  x: number;
  kind: "good" | "bad";
  fallSpeed: number;
  warningMs: number;
}

export interface ShardWaveConfig {
  lanes: ShardLaneConfig[];
}

export interface ShardPatternConfig {
  lanePositions: number[];
  templateIndex: number;
  waveSpacingMs: number;
  warningBaseMs: number;
  goodSpeedBase: number;
  badSpeedBase: number;
}

export type PhasePattern =
  | {
      type: "ruin_orbs";
      templateName: string;
      traps: TrapZoneConfig[];
      lattice: LatticeConfig;
    }
  | {
      type: "ruin_beams";
      templateName: string;
      traps: TrapZoneConfig[];
      beams: BeamConfig;
    }
  | {
      type: "solace_nodes";
      templateName: string;
      traps: TrapZoneConfig[];
      nodes: NodeLayoutConfig;
    }
  | {
      type: "solace_shards";
      templateName: string;
      traps: TrapZoneConfig[];
      shardPattern: ShardPatternConfig;
    }
  | {
      type: "quantum_lattice";
      templateName: string;
      traps: TrapZoneConfig[];
      lattice: LatticeConfig;
    }
  | {
      type: "orbit_constellation";
      templateName: string;
      traps: TrapZoneConfig[];
      constellation: OrbitConstellationConfig;
    }
  | {
      type: "cross_blasters";
      templateName: string;
      traps: TrapZoneConfig[];
      blasters: CrossBlasterConfig;
    }
  | {
      type: "collapse_corridor";
      templateName: string;
      traps: TrapZoneConfig[];
      corridor: BeamConfig;
    }
  | {
      type: "shield_parry";
      templateName: string;
      traps: TrapZoneConfig[];
      parry: ShieldParryConfig;
    }
  | {
      type: "quantum_rain";
      templateName: string;
      traps: TrapZoneConfig[];
      shardPattern: ShardPatternConfig;
    }
  | {
      type: "resonance_tiles";
      templateName: string;
      traps: TrapZoneConfig[];
      tiles: {
        targets: ResonanceTileConfig[];
        hazards: OrbConfig[];
      };
    }
  | {
      type: "resonance_constellation";
      templateName: string;
      traps: TrapZoneConfig[];
      resonance: {
        targets: ResonanceTileConfig[];
        hazards: OrbConfig[];
        chaosTiles: ChaosTileConfig[];
        stars: OrbitConstellationConfig;
        pulseMs: number;
      };
    };

export interface PhaseState {
  type: PhaseType;
  hp: number;
  maxHp: number;
  timeRemaining: number;
  objectiveProgress: number;
  objectiveTarget: number;
  pattern: PhasePattern;
}

export interface RunState {
  roundId: string;
  entropySource: EntropySource;
  entropyWarning: string | null;
  entropyBytes: string;
  controller: Controller;
  goal: number;
  chaos: number;
  overallTimeRemaining: number;
  activePhase: PhaseState;
  statusText: string;
  speechText: string;
  waitingText: string;
  victory: boolean;
  defeat: boolean;
  endgameModifier: EndgameModifier;
  endgameActive: boolean;
}

export type RunUpdateReason =
  | "bootstrap"
  | "tick"
  | "phase_start"
  | "phase_success"
  | "phase_failure"
  | "swap_start"
  | "swap_complete"
  | "endgame_start"
  | "game_over";
