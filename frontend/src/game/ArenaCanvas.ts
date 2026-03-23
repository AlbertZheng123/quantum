import { RunController } from "./RunController";
import type { CrossBlasterVolleyConfig, PhaseType, ShardWaveConfig, ShieldArrowConfig } from "./types";

type TrapZone = { x: number; y: number; size: number; consumed?: boolean };
type OrbHazard = { x: number; y: number; radius: number; vx: number; vy: number };
type NodeTarget = { x: number; y: number; radius: number; index: number; group?: number };
type LatticeFrame = { activeCells: number[]; warningCells: number[]; durationMs: number };
type LatticeResolution = { activeCells: number[]; warningCells: number[] };
type ChaosTile = { x: number; y: number; size: number };
type IncomingArrow = ShieldArrowConfig & { x: number; y: number; active: boolean };
type OrbitStar = {
  angle: number;
  angularVelocity: number;
  radius: number;
  size: number;
  x: number;
  y: number;
  phaseOffset: number;
  radiusBias: number;
  currentRadius: number;
  currentSize: number;
};
type FallingShard = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "good" | "bad";
  state: "warning" | "falling";
  warningMs: number;
  fallSpeed: number;
  resolved?: boolean;
};

type LegendEntry = {
  color: string;
  label: string;
};

const ARENA = { x: 20, y: 20, width: 410, height: 410 };
const ARENA_CENTER_X = ARENA.x + ARENA.width / 2;
const ARENA_CENTER_Y = ARENA.y + ARENA.height / 2;

export class ArenaCanvas {
  private readonly runController: RunController;

  private readonly canvas: HTMLCanvasElement;

  private readonly ctx: CanvasRenderingContext2D;

  private animationFrame = 0;

  private lastTime = 0;

  private readonly pressedKeys = new Set<string>();

  private player = { x: ARENA_CENTER_X, y: ARENA_CENTER_Y, size: 18 };

  private trapZones: TrapZone[] = [];

  private orbHazards: OrbHazard[] = [];

  private nodeTargets: NodeTarget[] = [];

  private chaosTiles: ChaosTile[] = [];

  private shardTargets: FallingShard[] = [];

  private latticeFrames: LatticeFrame[] = [];

  private activeLatticeFrameIndex = 0;

  private latticeFrameTimerMs = 0;

  private latticeNeedsResolution = false;

  private pendingLatticeResolution: LatticeResolution | null = null;

  private orbitStars: OrbitStar[] = [];

  private orbitCenter = { x: 400, y: 225 };

  private orbitConnectLines = false;

  private orbitMotionMode: "pulse" | "spiral" | "staggered" | "breathing" = "pulse";

  private orbitPulseMs = 1500;

  private orbitMinRadius = 48;

  private orbitMaxRadius = 132;

  private orbitTimerMs = 0;

  private beamLanes: { x: number; width: number }[] = [];

  private crossBlasterVolleys: CrossBlasterVolleyConfig[] = [];

  private crossBlasterThickness = 32;

  private beamState: "warning" | "firing" = "warning";

  private beamStateTimerMs = 0;

  private activeBeamStepIndex = 0;

  private damageCooldownMs = 0;

  private damageFlashMs = 0;

  private shardWaveCooldownMs = 0;

  private resonancePulseMs = 1200;

  private resonancePulseTimerMs = 0;

  private shieldDirection: "up" | "down" | "left" | "right" = "up";

  private shieldSpawnDelayMs = 520;

  private shieldSpawnTimerMs = 0;

  private shieldNextDelayMs = 520;

  private shieldSize = 28;

  private shieldQueue: ShieldArrowConfig[] = [];

  private activeShieldArrow: IncomingArrow | null = null;

  private phaseTitle = "";

  private phaseHint = "";

  private flashOpacity = 0;

  private flashColor: "white" | "ruin" | "solace" = "white";

  private phaseBannerText = "";

  private phaseBannerMs = 0;

  private eventBannerText = "";

  private eventBannerTone: "neutral" | "success" | "failure" | "warning" = "neutral";

  private eventBannerMs = 0;

  private resultInterstitialMs = 0;

  private resultInterstitialTotalMs = 3000;

  private resultInterstitialOutcome: "passed" | "failed" = "passed";

  private resultInterstitialSpeaker = "SOLACE";

  private resultInterstitialLine = "";

  private resultInterstitialTyped = "";

  private resultInterstitialNextPhase: PhaseType | null = null;

  private tutorialMode = false;

  private tutorialPaused = false;

  private tutorialDamageCallback: (() => void) | null = null;

  private tutorialLeadInMs = 0;

  constructor(runController: RunController, parent: HTMLElement) {
    this.runController = runController;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 450;
    this.canvas.height = 450;
    this.canvas.className = "arena-canvas";
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context is not available.");
    }
    this.ctx = context;
    parent.replaceChildren(this.canvas);
    parent.parentElement?.classList.add("arena-panel--live");
    this.bindEvents();
    this.syncPhase(this.runController.state.activePhase.type);
  }

  start() {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const delta = now - this.lastTime;
      this.lastTime = now;
      this.update(delta);
      this.render();
      this.animationFrame = window.requestAnimationFrame(loop);
    };
    this.animationFrame = window.requestAnimationFrame(loop);
  }

  destroy() {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  setTutorialMode(enabled: boolean, onDamage?: (() => void) | null) {
    this.tutorialMode = enabled;
    this.tutorialDamageCallback = onDamage ?? null;
  }

  setPaused(paused: boolean) {
    this.tutorialPaused = paused;
  }

  setTutorialLeadIn(ms: number) {
    this.tutorialLeadInMs = ms;
  }

  syncPhase(type: PhaseType) {
    const phase = this.runController.state.activePhase;
    this.trapZones = [];
    this.orbHazards = [];
    this.nodeTargets = [];
    this.chaosTiles = [];
    this.shardTargets = [];
    this.latticeFrames = [];
    this.activeLatticeFrameIndex = 0;
    this.latticeFrameTimerMs = 0;
    this.latticeNeedsResolution = false;
    this.pendingLatticeResolution = null;
    this.orbitStars = [];
    this.orbitConnectLines = false;
    this.orbitMotionMode = "pulse";
    this.orbitPulseMs = 1500;
    this.orbitMinRadius = 48;
    this.orbitMaxRadius = 132;
    this.orbitTimerMs = 0;
    this.beamLanes = [];
    this.crossBlasterVolleys = [];
    this.crossBlasterThickness = 32;
    this.beamState = "warning";
    this.beamStateTimerMs = 0;
    this.activeBeamStepIndex = 0;
    this.damageCooldownMs = 0;
    this.shardWaveCooldownMs = 0;
    this.resonancePulseMs = 1200;
    this.resonancePulseTimerMs = 0;
    this.shieldDirection = "up";
    this.shieldSpawnDelayMs = 520;
    this.shieldSpawnTimerMs = 0;
    this.shieldNextDelayMs = 520;
    this.shieldSize = 28;
    this.shieldQueue = [];
    this.activeShieldArrow = null;
    this.player.x = ARENA_CENTER_X;
    this.player.y = ARENA_CENTER_Y;
    this.phaseTitle = phase.pattern.templateName.toUpperCase();
    this.phaseHint = this.phaseHintFor(type);
    this.phaseBannerText = this.phaseBannerFor(type);
    this.phaseBannerMs = 1600;

    switch (phase.pattern.type) {
      case "quantum_lattice":
      case "ruin_orbs":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.latticeFrames = phase.pattern.lattice.frames.map((frame) => ({ ...frame }));
        break;
      case "orbit_constellation":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.orbitCenter = { x: phase.pattern.constellation.centerX, y: phase.pattern.constellation.centerY };
        this.orbitConnectLines = phase.pattern.constellation.connectLines;
        this.orbitMotionMode = phase.pattern.constellation.motionMode;
        this.orbitPulseMs = phase.pattern.constellation.pulseMs;
        this.orbitMinRadius = phase.pattern.constellation.minRadius;
        this.orbitMaxRadius = phase.pattern.constellation.maxRadius;
        this.orbitStars = phase.pattern.constellation.stars.map((star) => ({
          ...star,
          phaseOffset: star.phaseOffset ?? 0,
          radiusBias: star.radiusBias ?? 0,
          currentRadius: star.radius,
          currentSize: star.size,
          x: this.orbitCenter.x + Math.cos(star.angle) * star.radius,
          y: this.orbitCenter.y + Math.sin(star.angle) * star.radius,
        }));
        break;
      case "cross_blasters":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.crossBlasterVolleys = phase.pattern.blasters.volleys;
        this.crossBlasterThickness = phase.pattern.blasters.beamThickness;
        break;
      case "shield_parry":
        this.trapZones = [];
        this.shieldSpawnDelayMs = phase.pattern.parry.spawnDelayMs;
        this.shieldNextDelayMs = phase.pattern.parry.spawnDelayMs;
        this.shieldSize = phase.pattern.parry.shieldSize;
        this.shieldQueue = [...phase.pattern.parry.arrows];
        this.shieldSpawnTimerMs = 0;
        break;
      case "collapse_corridor":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.beamLanes = phase.pattern.corridor.laneCenters.map((x) => ({ x, width: phase.pattern.corridor.laneWidth }));
        break;
      case "ruin_beams":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.beamLanes = phase.pattern.beams.laneCenters.map((x) => ({ x, width: phase.pattern.beams.laneWidth }));
        break;
      case "resonance_tiles":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.nodeTargets = phase.pattern.tiles.targets.map((tile) => ({
          x: tile.x,
          y: tile.y,
          radius: tile.size / 2,
          index: tile.index,
        }));
        this.orbHazards = phase.pattern.tiles.hazards.map((orb) => ({ ...orb }));
        break;
      case "resonance_constellation":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.nodeTargets = phase.pattern.resonance.targets.map((tile) => ({
          x: tile.x,
          y: tile.y,
          radius: tile.size / 2,
          index: tile.index,
          group: tile.group,
        }));
        this.chaosTiles = phase.pattern.resonance.chaosTiles.map((tile) => ({ ...tile }));
        this.orbHazards = phase.pattern.resonance.hazards.map((orb) => ({ ...orb }));
        this.resonancePulseMs = phase.pattern.resonance.pulseMs;
        this.resonancePulseTimerMs = 0;
        break;
      case "solace_nodes":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.nodeTargets = phase.pattern.nodes.order.map((positionIndex, orderIndex) => ({
          x: phase.pattern.nodes.positions[positionIndex].x,
          y: phase.pattern.nodes.positions[positionIndex].y,
          radius: 18,
          index: orderIndex,
        }));
        this.orbHazards = phase.pattern.nodes.wisps.map((orb) => ({ ...orb }));
        break;
      case "quantum_rain":
      case "solace_shards":
        this.trapZones = phase.pattern.traps.map((trap) => ({ ...trap }));
        this.spawnNextShardWave();
        break;
      default:
        break;
    }
  }

  flashSwap(targetController: "ruin" | "solace") {
    this.flashColor = targetController;
    this.flashOpacity = 0.9;
  }

  startResultInterstitial(
    outcome: "passed" | "failed",
    speaker: "ruin" | "solace",
    line: string,
    nextPhaseType: PhaseType,
  ) {
    this.resultInterstitialOutcome = outcome;
    this.resultInterstitialSpeaker = speaker.toUpperCase();
    this.resultInterstitialLine = line;
    this.resultInterstitialTyped = "";
    this.resultInterstitialNextPhase = nextPhaseType;
    this.resultInterstitialMs = this.resultInterstitialTotalMs;
  }

  showRunEvent(
    kind:
      | "phase_success"
      | "phase_failure"
      | "swap_start"
      | "swap_complete"
      | "victory"
      | "defeat",
    context?: { controller?: "ruin" | "solace"; goalDelta?: number },
  ) {
    switch (kind) {
      case "phase_success":
        this.eventBannerText =
          context?.controller === "solace"
            ? `SOLACE COMPLETE  +${context.goalDelta ?? 20} GOAL`
            : "RUIN ENDURED";
        this.eventBannerTone = "success";
        this.flashOpacity = 0.55;
        break;
      case "phase_failure":
        this.eventBannerText =
          context?.controller === "ruin"
            ? `RUIN WON THIS ROUND  -${context.goalDelta ?? 10} GOAL`
            : "SOLACE WINDOW LOST";
        this.eventBannerTone = "failure";
        this.flashOpacity = 0.65;
        break;
      case "swap_start":
        this.eventBannerText = "QUANTUM COLLAPSE";
        this.eventBannerTone = "warning";
        break;
      case "swap_complete":
        this.eventBannerText =
          context?.controller === "solace" ? "SOLACE TOOK CONTROL" : "RUIN TOOK CONTROL";
        this.eventBannerTone = "neutral";
        break;
      case "victory":
        this.eventBannerText = "GOAL METER FILLED";
        this.eventBannerTone = "success";
        break;
      case "defeat":
        this.eventBannerText = "RITUAL WINDOW CLOSED";
        this.eventBannerTone = "failure";
        break;
      default:
        this.eventBannerText = "";
        this.eventBannerTone = "neutral";
        break;
    }

    this.eventBannerMs = 1500;
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.key.toLowerCase());

    if (event.repeat) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case "j":
        this.takeDamage();
        break;
      case "k":
        if (this.runController.state.activePhase.objectiveTarget > 0) {
          this.runController.collectObjective(1);
        } else {
          this.runController.debugAddGoal(10);
        }
        break;
      case "l":
        this.runController.applyChaosTrap();
        break;
      case "i":
        this.runController.debugForceSwap();
        break;
      default:
        break;
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.key.toLowerCase());
  };

  private bindEvents() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private update(deltaMs: number) {
    if (this.tutorialPaused) {
      this.flashOpacity = Math.max(0, this.flashOpacity - deltaMs / 500);
      this.damageFlashMs = Math.max(0, this.damageFlashMs - deltaMs);
      return;
    }

    if (this.resultInterstitialMs > 0) {
      this.resultInterstitialMs = Math.max(0, this.resultInterstitialMs - deltaMs);
      const charsToShow = Math.min(
        this.resultInterstitialLine.length,
        Math.floor(((this.resultInterstitialTotalMs - this.resultInterstitialMs) / 1000) * 44),
      );
      this.resultInterstitialTyped = this.resultInterstitialLine.slice(0, charsToShow);
      if (this.resultInterstitialMs <= 0 && this.resultInterstitialNextPhase) {
        this.syncPhase(this.resultInterstitialNextPhase);
        this.resultInterstitialNextPhase = null;
      }
      return;
    }

    this.runController.update(deltaMs);
    this.damageCooldownMs = Math.max(0, this.damageCooldownMs - deltaMs);
    this.damageFlashMs = Math.max(0, this.damageFlashMs - deltaMs);
    this.flashOpacity = Math.max(0, this.flashOpacity - deltaMs / 500);
    this.phaseBannerMs = Math.max(0, this.phaseBannerMs - deltaMs);
    this.eventBannerMs = Math.max(0, this.eventBannerMs - deltaMs);

    if (this.runController.state.phaseTwoTransition !== "none") {
      return;
    }

    this.handleMovement(deltaMs / 1000);

    if (this.runController.state.controller === "swapping") {
      return;
    }

    this.updatePhaseObjects(deltaMs);
    this.checkCollisions();
  }

  private handleMovement(deltaSeconds: number) {
    if (this.runController.state.activePhase.type === "shield_parry") {
      if (this.pressedKeys.has("arrowleft") || this.pressedKeys.has("a")) this.shieldDirection = "left";
      if (this.pressedKeys.has("arrowright") || this.pressedKeys.has("d")) this.shieldDirection = "right";
      if (this.pressedKeys.has("arrowup") || this.pressedKeys.has("w")) this.shieldDirection = "up";
      if (this.pressedKeys.has("arrowdown") || this.pressedKeys.has("s")) this.shieldDirection = "down";
      this.player.x = ARENA_CENTER_X;
      this.player.y = ARENA_CENTER_Y;
      return;
    }

    const speed = this.runController.state.controller === "swapping" ? 0 : 210;
    let dx = 0;
    let dy = 0;

    if (this.pressedKeys.has("arrowleft") || this.pressedKeys.has("a")) dx -= 1;
    if (this.pressedKeys.has("arrowright") || this.pressedKeys.has("d")) dx += 1;
    if (this.pressedKeys.has("arrowup") || this.pressedKeys.has("w")) dy -= 1;
    if (this.pressedKeys.has("arrowdown") || this.pressedKeys.has("s")) dy += 1;

    const magnitude = Math.hypot(dx, dy) || 1;
    this.player.x = Math.min(
      ARENA.x + ARENA.width - this.player.size / 2,
      Math.max(ARENA.x + this.player.size / 2, this.player.x + (dx / magnitude) * speed * deltaSeconds),
    );
    this.player.y = Math.min(
      ARENA.y + ARENA.height - this.player.size / 2,
      Math.max(ARENA.y + this.player.size / 2, this.player.y + (dy / magnitude) * speed * deltaSeconds),
    );
  }

  private updatePhaseObjects(deltaMs: number) {
    if (this.tutorialLeadInMs > 0) {
      this.tutorialLeadInMs = Math.max(0, this.tutorialLeadInMs - deltaMs);
      return;
    }

    const phaseType = this.runController.state.activePhase.type;

    if (phaseType === "quantum_lattice" || phaseType === "ruin_orbs") {
      const frame = this.latticeFrames[this.activeLatticeFrameIndex];
      if (frame) {
        this.latticeFrameTimerMs += deltaMs;
        if (this.latticeFrameTimerMs >= frame.durationMs) {
          this.latticeFrameTimerMs = 0;
          this.pendingLatticeResolution = {
            activeCells: [...frame.activeCells],
            warningCells: [...frame.warningCells],
          };
          this.activeLatticeFrameIndex = (this.activeLatticeFrameIndex + 1) % this.latticeFrames.length;
          this.latticeNeedsResolution = true;
        }
      }
    }

    if (phaseType === "orbit_constellation") {
      this.orbitTimerMs += deltaMs;
      const cycle = this.orbitPulseMs > 0 ? (this.orbitTimerMs % this.orbitPulseMs) / this.orbitPulseMs : 0;
      for (const star of this.orbitStars) {
        star.angle += star.angularVelocity * (deltaMs / 1000);
        const radius = this.resolveOrbitRadius(star, cycle);
        star.currentRadius = radius;
        star.currentSize = this.resolveOrbitSize(star, radius, cycle);
        star.x = this.orbitCenter.x + Math.cos(star.angle) * radius;
        star.y = this.orbitCenter.y + Math.sin(star.angle) * radius;
      }
    }

    for (const orb of this.orbHazards) {
      orb.x += orb.vx * (deltaMs / 1000);
      orb.y += orb.vy * (deltaMs / 1000);
      if (orb.x <= ARENA.x + orb.radius || orb.x >= ARENA.x + ARENA.width - orb.radius) orb.vx *= -1;
      if (orb.y <= ARENA.y + orb.radius || orb.y >= ARENA.y + ARENA.height - orb.radius) orb.vy *= -1;
    }

    if (phaseType === "ruin_beams" && this.beamLanes.length > 0) {
      const beamPattern = this.runController.state.activePhase.pattern.type === "ruin_beams"
        ? this.runController.state.activePhase.pattern.beams
        : null;
      this.beamStateTimerMs += deltaMs;
      if (beamPattern && this.beamState === "warning" && this.beamStateTimerMs >= beamPattern.warningMs) {
        this.beamState = "firing";
        this.beamStateTimerMs = 0;
      } else if (beamPattern && this.beamState === "firing" && this.beamStateTimerMs >= beamPattern.fireMs) {
        this.beamState = "warning";
        this.beamStateTimerMs = 0;
        this.activeBeamStepIndex = (this.activeBeamStepIndex + 1) % beamPattern.laneSequence.length;
      }
    }

    if (phaseType === "cross_blasters" && this.crossBlasterVolleys.length > 0) {
      const blasterPattern = this.runController.state.activePhase.pattern.type === "cross_blasters"
        ? this.runController.state.activePhase.pattern.blasters
        : null;
      this.beamStateTimerMs += deltaMs;
      if (blasterPattern && this.beamState === "warning" && this.beamStateTimerMs >= blasterPattern.warningMs) {
        this.beamState = "firing";
        this.beamStateTimerMs = 0;
      } else if (blasterPattern && this.beamState === "firing" && this.beamStateTimerMs >= blasterPattern.fireMs) {
        this.beamState = "warning";
        this.beamStateTimerMs = 0;
        this.activeBeamStepIndex = (this.activeBeamStepIndex + 1) % this.crossBlasterVolleys.length;
      }
    }

    if (phaseType === "collapse_corridor" && this.beamLanes.length > 0) {
      const corridorPattern = this.runController.state.activePhase.pattern.type === "collapse_corridor"
        ? this.runController.state.activePhase.pattern.corridor
        : null;
      this.beamStateTimerMs += deltaMs;
      if (corridorPattern && this.beamState === "warning" && this.beamStateTimerMs >= corridorPattern.warningMs) {
        this.beamState = "firing";
        this.beamStateTimerMs = 0;
      } else if (corridorPattern && this.beamState === "firing" && this.beamStateTimerMs >= corridorPattern.fireMs) {
        this.beamState = "warning";
        this.beamStateTimerMs = 0;
        this.activeBeamStepIndex = (this.activeBeamStepIndex + 1) % corridorPattern.laneSequence.length;
      }
    }

    if (phaseType === "shield_parry") {
      if (!this.activeShieldArrow && this.shieldQueue.length > 0) {
        this.shieldSpawnTimerMs += deltaMs;
        if (this.shieldSpawnTimerMs >= this.shieldNextDelayMs) {
          this.shieldSpawnTimerMs = 0;
          const nextArrow = this.shieldQueue.shift()!;
          this.activeShieldArrow = this.spawnShieldArrow(nextArrow);
          this.shieldNextDelayMs = nextArrow.delayAfterMs ?? this.shieldSpawnDelayMs;
        }
      }
      if (this.activeShieldArrow) {
        this.advanceShieldArrow(this.activeShieldArrow, deltaMs);
      }
    }

    for (const shard of this.shardTargets) {
      if (shard.resolved) continue;
      if (shard.state === "warning") {
        shard.warningMs -= deltaMs;
        if (shard.warningMs <= 0) {
          shard.state = "falling";
        }
      } else {
        shard.y += shard.fallSpeed * (deltaMs / 1000);
        if (shard.y > ARENA.y + ARENA.height + 30) {
          shard.resolved = true;
        }
      }
    }
    this.shardTargets = this.shardTargets.filter((shard) => !shard.resolved);

    if (phaseType === "quantum_rain" || phaseType === "solace_shards") {
      const shardPattern =
        this.runController.state.activePhase.pattern.type === "quantum_rain" ||
        this.runController.state.activePhase.pattern.type === "solace_shards"
          ? this.runController.state.activePhase.pattern
          : null;
      this.shardWaveCooldownMs -= deltaMs;
      if (
        shardPattern &&
        this.shardWaveCooldownMs <= 0 &&
        this.runController.state.activePhase.objectiveProgress < this.runController.state.activePhase.objectiveTarget
      ) {
        this.spawnNextShardWave();
      }
    }

    if (phaseType === "resonance_constellation" && this.chaosTiles.length > 0) {
      this.resonancePulseTimerMs += deltaMs;
      if (this.resonancePulseTimerMs >= this.resonancePulseMs) {
        this.resonancePulseTimerMs = 0;
        const onChaosTile = this.chaosTiles.some((tile) =>
          this.rectIntersectsPlayer(tile.x - tile.size / 2, tile.y - tile.size / 2, tile.size, tile.size),
        );
        if (onChaosTile) {
          this.runController.applyChaosTrap();
        } else if (this.damageCooldownMs <= 0) {
          this.takeDamage();
          this.damageCooldownMs = 280;
        }
      }
    }
  }

  private checkCollisions() {
    const phaseType = this.runController.state.activePhase.type;
    const allowTrapCollision = phaseType !== "quantum_lattice" && phaseType !== "ruin_orbs";

    if (allowTrapCollision) {
      for (const trap of this.trapZones) {
        if (!trap.consumed && this.rectIntersectsPlayer(trap.x - trap.size / 2, trap.y - trap.size / 2, trap.size, trap.size)) {
          trap.consumed = true;
          this.runController.applyChaosTrap();
          this.relocateTrapZone(trap);
        }
      }
    }

    if (this.runController.state.activePhase.type === "quantum_lattice" || this.runController.state.activePhase.type === "ruin_orbs") {
      const resolution = this.pendingLatticeResolution;
      if (resolution && this.latticeNeedsResolution && this.damageCooldownMs <= 0) {
        const playerCell = this.playerCellIndex();
        if (resolution.activeCells.includes(playerCell)) {
          this.takeDamage();
          this.damageCooldownMs = 360;
        } else if (resolution.warningCells.includes(playerCell)) {
          this.runController.applyChaosTrap();
          this.reseedVisibleLatticeChaosCell();
        }
        this.latticeNeedsResolution = false;
        this.pendingLatticeResolution = null;
      } else if (resolution && this.latticeNeedsResolution) {
        this.latticeNeedsResolution = false;
        this.pendingLatticeResolution = null;
      }
    }

    if (this.runController.state.activePhase.type === "orbit_constellation" && this.damageCooldownMs <= 0) {
      for (const star of this.orbitStars) {
        if (this.circleIntersectsPlayer(star.x, star.y, star.currentSize)) {
          this.takeDamage();
          this.damageCooldownMs = 360;
          break;
        }
      }
    }

    for (const orb of this.orbHazards) {
      if (this.damageCooldownMs <= 0 && this.circleIntersectsPlayer(orb.x, orb.y, orb.radius)) {
        this.takeDamage();
        this.damageCooldownMs = 420;
        orb.vx *= -1;
        orb.vy *= -1;
      }
    }

    if (this.runController.state.activePhase.type === "ruin_beams" && this.beamState === "firing" && this.damageCooldownMs <= 0) {
      const beamPattern = this.runController.state.activePhase.pattern.type === "ruin_beams"
        ? this.runController.state.activePhase.pattern.beams
        : null;
      const laneIndexes = beamPattern ? beamPattern.laneSequence[this.activeBeamStepIndex] : [this.activeBeamStepIndex];
      for (const laneIndex of laneIndexes) {
        const lane = this.beamLanes[laneIndex];
        if (lane && this.rectIntersectsPlayer(lane.x - lane.width / 2, ARENA.y, lane.width, ARENA.height)) {
          this.takeDamage();
          this.damageCooldownMs = 420;
          break;
        }
      }
    }

    if (this.runController.state.activePhase.type === "collapse_corridor" && this.beamState === "firing" && this.damageCooldownMs <= 0) {
      const corridorPattern = this.runController.state.activePhase.pattern.type === "collapse_corridor"
        ? this.runController.state.activePhase.pattern.corridor
        : null;
      const activeIndexes = corridorPattern ? corridorPattern.laneSequence[this.activeBeamStepIndex] : [];
      const safeIndexes = Array.from({ length: this.beamLanes.length }, (_, index) => index).filter((index) => !activeIndexes.includes(index));
      const insideSafeLane = safeIndexes.some((laneIndex) => {
        const lane = this.beamLanes[laneIndex];
        return lane ? this.rectIntersectsPlayer(lane.x - lane.width / 2, ARENA.y, lane.width, ARENA.height) : false;
      });
      if (!insideSafeLane) {
        this.takeDamage();
        this.damageCooldownMs = 420;
      }
    }

    if (this.runController.state.activePhase.type === "cross_blasters" && this.beamState === "firing" && this.damageCooldownMs <= 0) {
      const pattern = this.runController.state.activePhase.pattern.type === "cross_blasters"
        ? this.runController.state.activePhase.pattern.blasters
        : null;
      const volley = this.crossBlasterVolleys[this.activeBeamStepIndex];
      if (pattern && volley) {
        for (const laneIndex of volley.verticalLanes) {
          const x = pattern.xLaneCenters[laneIndex];
          if (this.rectIntersectsPlayer(x - pattern.beamThickness / 2, ARENA.y, pattern.beamThickness, ARENA.height)) {
            this.takeDamage();
            this.damageCooldownMs = 420;
            return;
          }
        }
        for (const laneIndex of volley.horizontalLanes) {
          const y = pattern.yLaneCenters[laneIndex];
          if (this.rectIntersectsPlayer(ARENA.x, y - pattern.beamThickness / 2, ARENA.width, pattern.beamThickness)) {
            this.takeDamage();
            this.damageCooldownMs = 420;
            return;
          }
        }
      }
    }

    if (this.runController.state.activePhase.type === "shield_parry" && this.activeShieldArrow) {
      const arrow = this.activeShieldArrow;
      const reachedPlayer = Math.hypot(arrow.x - this.player.x, arrow.y - this.player.y) <= 22;
      if (reachedPlayer) {
        const blocked = this.shieldBlocksArrow(arrow);
        if (arrow.kind === "red") {
          if (!blocked && this.damageCooldownMs <= 0) {
            this.takeDamage();
            this.damageCooldownMs = 320;
          }
        } else if (!blocked) {
          this.runController.applyChaosTrap();
        }
        this.activeShieldArrow = null;
      }
    }

    for (const node of this.nodeTargets) {
      const expected = this.runController.state.activePhase.objectiveProgress;
      const hitsTarget = this.runController.state.activePhase.type === "resonance_tiles" || this.runController.state.activePhase.type === "resonance_constellation"
        ? this.rectIntersectsPlayer(node.x - node.radius, node.y - node.radius, node.radius * 2, node.radius * 2)
        : this.circleIntersectsPlayer(node.x, node.y, node.radius);
      if (node.index === expected && hitsTarget) {
        this.runController.collectObjective(1);
      }
    }

    for (const shard of this.shardTargets) {
      if (shard.resolved || !this.rectIntersectsPlayer(shard.x - shard.width / 2, shard.y - shard.height / 2, shard.width, shard.height)) {
        continue;
      }
      shard.resolved = true;
      if (shard.kind === "good") {
        this.runController.collectObjective(1);
      } else if (this.damageCooldownMs <= 0) {
        this.takeDamage();
        this.damageCooldownMs = 320;
      }
    }
  }

  private rectIntersectsPlayer(x: number, y: number, width: number, height: number) {
    const half = this.player.size / 2;
    return !(
      this.player.x + half < x ||
      this.player.x - half > x + width ||
      this.player.y + half < y ||
      this.player.y - half > y + height
    );
  }

  private circleIntersectsPlayer(x: number, y: number, radius: number) {
    const dx = this.player.x - x;
    const dy = this.player.y - y;
    const distance = Math.hypot(dx, dy);
    return distance <= radius + this.player.size / 2;
  }

  private wrapCenteredText(text: string, centerX: number, startY: number, maxWidth: number, lineHeight: number) {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (this.ctx.measureText(nextLine).width <= maxWidth) {
        currentLine = nextLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);

    lines.forEach((line, index) => {
      this.ctx.fillText(line, centerX, startY + index * lineHeight);
    });
  }

  private takeDamage() {
    this.damageFlashMs = 130;
    if (this.tutorialMode) {
      this.tutorialDamageCallback?.();
      return;
    }
    this.runController.applyPhaseDamage(1);
  }

  private spawnShardWave(wave: ShardWaveConfig) {
    for (const lane of wave.lanes) {
      this.shardTargets.push({
        x: lane.x,
        y: 52,
        width: 44,
        height: 60,
        kind: lane.kind,
        state: "warning",
        warningMs: lane.warningMs,
        fallSpeed: lane.fallSpeed,
      });
    }
  }

  private spawnNextShardWave() {
    const wave = this.runController.nextShardWave();
    const trapLayout = this.runController.nextShardTrapLayout();
    const pattern =
      this.runController.state.activePhase.pattern.type === "quantum_rain" ||
      this.runController.state.activePhase.pattern.type === "solace_shards"
        ? this.runController.state.activePhase.pattern
        : null;
    if (!wave || !pattern) {
      return;
    }
    if (trapLayout) {
      this.trapZones = trapLayout.map((trap) => ({ ...trap }));
    }
    this.spawnShardWave(wave);
    this.shardWaveCooldownMs = pattern.shardPattern.waveSpacingMs;
  }

  private resolveOrbitRadius(star: OrbitStar, cycle: number) {
    const min = this.orbitMinRadius + star.radiusBias;
    const max = this.orbitMaxRadius + star.radiusBias;
    switch (this.orbitMotionMode) {
      case "pulse": {
        const wave = (1 - Math.cos((cycle * Math.PI * 2) + star.phaseOffset)) / 2;
        return max - (max - min) * wave;
      }
      case "spiral": {
        const wave = cycle;
        return max - (max - min) * wave;
      }
      case "staggered": {
        const wave = (1 - Math.cos((cycle * Math.PI * 2) + star.phaseOffset)) / 2;
        const sharpened = Math.pow(wave, 1.6);
        return max - (max - min) * sharpened;
      }
      case "breathing":
      default: {
        const wave = (Math.sin((cycle * Math.PI * 2) + star.phaseOffset) + 1) / 2;
        return min + (max - min) * wave;
      }
    }
  }

  private resolveOrbitSize(star: OrbitStar, radius: number, cycle: number) {
    const normalized =
      this.orbitMaxRadius === this.orbitMinRadius
        ? 0
        : 1 - ((radius - this.orbitMinRadius) / (this.orbitMaxRadius - this.orbitMinRadius));
    const pressure = Math.max(0, Math.min(1, normalized));
    const extra = this.orbitMotionMode === "spiral" ? Math.sin(cycle * Math.PI * 2) * 0.8 : 0;
    return star.size + pressure * 4 + extra;
  }

  private relocateTrapZone(trap: TrapZone) {
    const anchorXs = [66, 116, 166, 216, 266, 316, 366];
    const anchorYs = [66, 126, 186, 246, 306, 366];
    const candidates = anchorXs.flatMap((x) =>
      anchorYs.map((y) => ({ x: ARENA.x + x, y: ARENA.y + y })),
    ).filter(({ x, y }) =>
      !this.trapZones.some((other) => {
        if (other === trap) {
          return false;
        }
        const minDistance = (other.size + trap.size) / 2 + 18;
        return Math.hypot(other.x - x, other.y - y) < minDistance;
      }),
    );

    const nextAnchor = candidates.length > 0
      ? this.runController.readQuantumChoice(candidates)
      : { x: trap.x, y: trap.y };

    trap.x = nextAnchor.x;
    trap.y = nextAnchor.y;
    trap.consumed = false;
  }

  private spawnShieldArrow(config: ShieldArrowConfig): IncomingArrow {
    switch (config.direction) {
      case "up":
        return { ...config, x: this.player.x, y: ARENA.y + 18, active: true };
      case "down":
        return { ...config, x: this.player.x, y: ARENA.y + ARENA.height - 18, active: true };
      case "left":
        return { ...config, x: ARENA.x + 18, y: this.player.y, active: true };
      case "right":
      default:
        return { ...config, x: ARENA.x + ARENA.width - 18, y: this.player.y, active: true };
    }
  }

  private advanceShieldArrow(arrow: IncomingArrow, deltaMs: number) {
    const distance = arrow.speed * (deltaMs / 1000);
    if (arrow.direction === "up") {
      arrow.y += distance;
    } else if (arrow.direction === "down") {
      arrow.y -= distance;
    } else if (arrow.direction === "left") {
      arrow.x += distance;
    } else {
      arrow.x -= distance;
    }
  }

  private shieldBlocksArrow(arrow: IncomingArrow) {
    return this.shieldDirection === arrow.direction;
  }

  private reseedVisibleLatticeChaosCell() {
    const frame = this.latticeFrames[this.activeLatticeFrameIndex];
    if (!frame || frame.warningCells.length === 0) {
      return;
    }
    const occupied = new Set<number>([...frame.activeCells, ...frame.warningCells]);
    const candidates = Array.from({ length: 20 }, (_, index) => index).filter((index) => !occupied.has(index));
    if (candidates.length === 0) {
      return;
    }
    const replaceIndex = this.runController.readQuantumIndex(frame.warningCells.length);
    const nextCell = this.runController.readQuantumChoice(candidates);
    frame.warningCells[replaceIndex] = nextCell;
  }

  private phaseHintFor(type: PhaseType) {
    switch (type) {
      case "quantum_lattice":
        return "Deep green cells are safe. Deep red cells are deadly.";
      case "orbit_constellation":
        return "The constellation collapses inward, then blooms back out. Avoid the stars and links.";
      case "cross_blasters":
        return "Four blasters appear, show their aim lines, then fire one second later.";
      case "shield_parry":
        return "Hold the shield toward red arrows. Let cyan arrows reach you to spike chaos.";
      case "collapse_corridor":
        return "Green corridors are safe. Red walls collapse inward each cycle.";
      case "quantum_rain":
        return "Catch green shards, dodge deep red shards, and avoid chaos squares.";
      case "resonance_tiles":
        return "Step on the glowing tiles in order while crimson motes sweep the arena.";
      case "resonance_constellation":
        return "Trace the pulsing constellations in order before the 15-second ritual window closes.";
      case "ruin_orbs":
        return "Move between safe cells before the lattice locks in.";
      case "ruin_beams":
        return "The glowing gate columns are closing. Find the corridor before they fire.";
      case "solace_nodes":
        return "Trace the constellation in order. Crimson comets still deal damage.";
      case "solace_shards":
        return "Catch green shards, dodge red shards. Pink squares spike chaos.";
      default:
        return "Survive the collapse.";
    }
  }

  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.resultInterstitialMs > 0) {
      const countdown = this.resultInterstitialMs <= 400 ? 0 : Math.ceil(this.resultInterstitialMs / 1000);
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.textAlign = "center";
      this.ctx.fillStyle = this.resultInterstitialOutcome === "passed" ? "#00FF66" : "#FF3B4D";
      this.ctx.font = '22px "Press Start 2P", monospace';
      this.ctx.fillText(
        this.resultInterstitialOutcome === "passed" ? "Passed stage!" : "Failed stage!",
        this.canvas.width / 2,
        154,
      );
      this.ctx.fillStyle = "#FFF1AD";
      this.ctx.font = '22px "Press Start 2P", monospace';
      this.ctx.fillText(String(countdown), this.canvas.width / 2, 274);
      this.ctx.font = '9px "Press Start 2P", monospace';
      this.ctx.fillStyle = "#C1CAD9";
      this.ctx.fillText("NEXT MINIGAME SOON", this.canvas.width / 2, 324);
      this.ctx.textAlign = "left";
      return;
    }

    if (this.runController.state.controller === "swapping") {
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = "#F6F2F7";
      this.ctx.font = '16px "Press Start 2P", monospace';
      this.ctx.textAlign = "center";
      this.ctx.fillText("SWAP OCCURING!", this.canvas.width / 2, this.canvas.height / 2 - 18);
      this.ctx.font = '8px "Press Start 2P", monospace';
      this.ctx.fillStyle = "#C8BED1";
      this.ctx.fillText("REALITY IS REASSIGNING CONTROL", this.canvas.width / 2, this.canvas.height / 2 + 20);
      this.ctx.textAlign = "left";
      return;
    }

    if (this.runController.state.phaseTwoTransition !== "none") {
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = "#F4F4F4";
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    this.drawTrapZones();
    this.drawLattice();
    this.drawBeamLanes();
    this.drawOrbs();
    this.drawNodes();
    this.drawShards();
    this.drawPlayer();
    this.drawEndOverlay();

    if (this.flashOpacity > 0) {
      const alpha = this.flashOpacity * 0.28;
      this.ctx.fillStyle =
        this.flashColor === "solace"
          ? `rgba(130, 247, 255, ${alpha})`
          : this.flashColor === "ruin"
            ? `rgba(255, 54, 54, ${alpha})`
            : `rgba(255,255,255,${alpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (this.damageFlashMs > 0) {
      this.ctx.fillStyle = `rgba(255, 30, 30, ${Math.min(0.38, this.damageFlashMs / 200)})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private drawPlayer() {
    const half = this.player.size / 2;
    this.ctx.shadowColor = "rgba(255,255,255,0.6)";
    this.ctx.shadowBlur = 16;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(this.player.x - half, this.player.y - half, this.player.size, this.player.size);
    this.ctx.shadowBlur = 0;

    if (this.runController.state.activePhase.type === "shield_parry") {
      this.ctx.strokeStyle = "#ffe59b";
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      if (this.shieldDirection === "up") {
        this.ctx.moveTo(this.player.x - this.shieldSize / 2, this.player.y - 18);
        this.ctx.lineTo(this.player.x + this.shieldSize / 2, this.player.y - 18);
      } else if (this.shieldDirection === "down") {
        this.ctx.moveTo(this.player.x - this.shieldSize / 2, this.player.y + 18);
        this.ctx.lineTo(this.player.x + this.shieldSize / 2, this.player.y + 18);
      } else if (this.shieldDirection === "left") {
        this.ctx.moveTo(this.player.x - 18, this.player.y - this.shieldSize / 2);
        this.ctx.lineTo(this.player.x - 18, this.player.y + this.shieldSize / 2);
      } else {
        this.ctx.moveTo(this.player.x + 18, this.player.y - this.shieldSize / 2);
        this.ctx.lineTo(this.player.x + 18, this.player.y + this.shieldSize / 2);
      }
      this.ctx.stroke();
    }
  }

  private drawTrapZones() {
    if (
      this.runController.state.activePhase.type === "quantum_lattice" ||
      this.runController.state.activePhase.type === "ruin_orbs"
    ) {
      return;
    }
    for (const trap of this.trapZones) {
      this.ctx.globalAlpha = trap.consumed ? 0.28 : 0.72;
      this.ctx.fillStyle = "#82F7FF";
      this.ctx.fillRect(trap.x - trap.size / 2, trap.y - trap.size / 2, trap.size, trap.size);
      this.ctx.strokeStyle = "#DFFFFF";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(trap.x - trap.size / 2, trap.y - trap.size / 2, trap.size, trap.size);
    }
    this.ctx.globalAlpha = 1;
  }

  private drawLattice() {
    if (
      this.runController.state.activePhase.pattern.type !== "quantum_lattice" &&
      this.runController.state.activePhase.pattern.type !== "ruin_orbs"
    ) {
      return;
    }

    const lattice = this.runController.state.activePhase.pattern.lattice;
    const frame = this.latticeFrames[this.activeLatticeFrameIndex];
    if (!frame) {
      return;
    }

    const arenaWidth = ARENA.width / lattice.cols;
    const arenaHeight = ARENA.height / lattice.rows;
    const progress = frame.durationMs > 0 ? Math.min(1, this.latticeFrameTimerMs / frame.durationMs) : 1;
    const phaseTwo = this.runController.state.phaseTwoActive;

    for (let index = 0; index < lattice.cols * lattice.rows; index += 1) {
      const col = index % lattice.cols;
      const row = Math.floor(index / lattice.cols);
      const x = ARENA.x + col * arenaWidth;
      const y = ARENA.y + row * arenaHeight;
      const isActive = frame.activeCells.includes(index);
      const isWarning = frame.warningCells.includes(index) && !isActive;
      const heat = Math.min(1, progress);

      this.ctx.fillStyle = isActive
        ? phaseTwo
          ? `rgba(${Math.round(124 + heat * 131)}, ${Math.round(0 + heat * 22)}, ${Math.round(6 + heat * 10)}, ${0.72 + heat * 0.22})`
          : `rgba(${Math.round(82 + heat * 173)}, ${Math.round(4 + heat * 34)}, ${Math.round(12 + heat * 18)}, ${0.56 + heat * 0.28})`
        : isWarning
          ? "rgba(130,247,255,0.22)"
          : "rgba(11,93,30,0.42)";
      this.ctx.fillRect(x + 4, y + 4, arenaWidth - 8, arenaHeight - 8);
      this.ctx.strokeStyle = isActive
        ? phaseTwo
          ? `rgb(${Math.round(224 + heat * 31)}, ${Math.round(38 + heat * 40)}, ${Math.round(44 + heat * 30)})`
          : `rgb(${Math.round(168 + heat * 87)}, ${Math.round(74 + heat * 95)}, ${Math.round(82 + heat * 70)})`
        : isWarning ? "#82F7FF" : "#00FF88";
      this.ctx.lineWidth = isActive ? 2.5 : 1.5;
      this.ctx.strokeRect(x + 4, y + 4, arenaWidth - 8, arenaHeight - 8);
    }
  }

  private drawBeamLanes() {
    if (this.runController.state.activePhase.type === "cross_blasters") {
      this.drawCrossBlasters();
      return;
    }

    if (this.runController.state.activePhase.type === "shield_parry") {
      this.drawShieldParry();
      return;
    }

    if (this.runController.state.activePhase.type === "collapse_corridor") {
      const corridorPattern = this.runController.state.activePhase.pattern.type === "collapse_corridor"
        ? this.runController.state.activePhase.pattern.corridor
        : null;
      const activeIndexes = corridorPattern ? corridorPattern.laneSequence[this.activeBeamStepIndex] : [];
      this.beamLanes.forEach((lane, index) => {
        const isUnsafe = activeIndexes.includes(index);
        this.ctx.fillStyle = isUnsafe
          ? this.beamState === "warning"
            ? "rgba(255,194,207,0.18)"
            : "rgba(163,0,0,0.42)"
          : "rgba(11,93,30,0.24)";
        this.ctx.fillRect(lane.x - lane.width / 2, ARENA.y, lane.width, ARENA.height);
        this.ctx.strokeStyle = isUnsafe ? "rgba(255,188,201,0.45)" : "rgba(0,255,136,0.4)";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(lane.x - lane.width / 2, ARENA.y, lane.width, ARENA.height);
      });
      return;
    }

    if (this.beamLanes.length === 0) return;
    const beamPattern = this.runController.state.activePhase.pattern.type === "ruin_beams"
      ? this.runController.state.activePhase.pattern.beams
      : null;
    const activeIndexes = beamPattern ? beamPattern.laneSequence[this.activeBeamStepIndex] : [this.activeBeamStepIndex];
    this.beamLanes.forEach((lane, index) => {
      const isActive = activeIndexes.includes(index);
      if (!isActive) {
        this.ctx.fillStyle = "rgba(255,142,162,0.08)";
        this.ctx.fillRect(lane.x - lane.width / 2, ARENA.y, lane.width, ARENA.height);
        return;
      }
      this.ctx.fillStyle =
        this.beamState === "warning" ? "rgba(255,194,207,0.16)" : "rgba(255,117,144,0.5)";
      this.ctx.fillRect(lane.x - lane.width / 2, ARENA.y, lane.width, ARENA.height);
      if (this.beamState === "warning") {
        const progress = Math.min(1, this.beamStateTimerMs / (beamPattern?.warningMs ?? 650));
        this.ctx.fillStyle = "rgba(255, 240, 245, 0.92)";
        this.ctx.fillRect(lane.x - lane.width / 2, ARENA.y + ARENA.height + 6, lane.width * progress, 5);
      }
      this.ctx.fillStyle = this.beamState === "warning" ? "#ffdbe2" : "#fff2f5";
      this.ctx.font = '12px "JetBrains Mono", monospace';
      this.ctx.fillText(this.beamState === "warning" ? "SHIFT" : "LOCK", lane.x - 18, ARENA.y + 18);
    });
  }

  private drawCrossBlasters() {
    const pattern = this.runController.state.activePhase.pattern.type === "cross_blasters"
      ? this.runController.state.activePhase.pattern.blasters
      : null;
    const volley = this.crossBlasterVolleys[this.activeBeamStepIndex];
    if (!pattern || !volley) {
      return;
    }

    for (let index = 0; index < volley.verticalLanes.length; index += 1) {
      const x = pattern.xLaneCenters[volley.verticalLanes[index]];
      const anchor = volley.verticalAnchors[index];
      const y = anchor === "top" ? ARENA.y - 6 : ARENA.y + ARENA.height - 40;
      this.ctx.fillStyle = this.beamState === "warning" ? "rgba(255,221,231,0.85)" : "#FF7C97";
      this.ctx.fillRect(x - 24, y, 48, 36);
      if (this.beamState === "warning") {
        this.ctx.fillStyle = "rgba(182, 191, 206, 0.16)";
        this.ctx.fillRect(x - pattern.beamThickness / 2, ARENA.y, pattern.beamThickness, ARENA.height);
        this.ctx.strokeStyle = "rgba(216, 224, 238, 0.34)";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x - pattern.beamThickness / 2, ARENA.y, pattern.beamThickness, ARENA.height);
      }
      if (this.beamState === "firing") {
        this.ctx.fillStyle = "rgba(255,124,151,0.5)";
        this.ctx.fillRect(x - pattern.beamThickness / 2, ARENA.y, pattern.beamThickness, ARENA.height);
      }
    }

    for (let index = 0; index < volley.horizontalLanes.length; index += 1) {
      const y = pattern.yLaneCenters[volley.horizontalLanes[index]];
      const anchor = volley.horizontalAnchors[index];
      const x = anchor === "left" ? ARENA.x - 6 : ARENA.x + ARENA.width - 40;
      this.ctx.fillStyle = this.beamState === "warning" ? "rgba(255,221,231,0.85)" : "#FF7C97";
      this.ctx.fillRect(x, y - 24, 36, 48);
      if (this.beamState === "warning") {
        this.ctx.fillStyle = "rgba(182, 191, 206, 0.16)";
        this.ctx.fillRect(ARENA.x, y - pattern.beamThickness / 2, ARENA.width, pattern.beamThickness);
        this.ctx.strokeStyle = "rgba(216, 224, 238, 0.34)";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(ARENA.x, y - pattern.beamThickness / 2, ARENA.width, pattern.beamThickness);
      }
      if (this.beamState === "firing") {
        this.ctx.fillStyle = "rgba(255,124,151,0.5)";
        this.ctx.fillRect(ARENA.x, y - pattern.beamThickness / 2, ARENA.width, pattern.beamThickness);
      }
    }
  }

  private drawShieldParry() {
    if (this.activeShieldArrow) {
      const arrow = this.activeShieldArrow;
      const color = arrow.kind === "red" ? "#A30000" : "#82F7FF";
      this.ctx.strokeStyle = color;
      this.ctx.fillStyle = color;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      if (arrow.direction === "up" || arrow.direction === "down") {
        this.ctx.moveTo(arrow.x, arrow.y);
        this.ctx.lineTo(arrow.x, arrow.y + (arrow.direction === "up" ? -26 : 26));
      } else {
        this.ctx.moveTo(arrow.x, arrow.y);
        this.ctx.lineTo(arrow.x + (arrow.direction === "left" ? -26 : 26), arrow.y);
      }
      this.ctx.stroke();
      this.ctx.beginPath();
      if (arrow.direction === "up") {
        this.ctx.moveTo(arrow.x - 7, arrow.y - 10);
        this.ctx.lineTo(arrow.x, arrow.y);
        this.ctx.lineTo(arrow.x + 7, arrow.y - 10);
      } else if (arrow.direction === "down") {
        this.ctx.moveTo(arrow.x - 7, arrow.y + 10);
        this.ctx.lineTo(arrow.x, arrow.y);
        this.ctx.lineTo(arrow.x + 7, arrow.y + 10);
      } else if (arrow.direction === "left") {
        this.ctx.moveTo(arrow.x - 10, arrow.y - 7);
        this.ctx.lineTo(arrow.x, arrow.y);
        this.ctx.lineTo(arrow.x - 10, arrow.y + 7);
      } else {
        this.ctx.moveTo(arrow.x + 10, arrow.y - 7);
        this.ctx.lineTo(arrow.x, arrow.y);
        this.ctx.lineTo(arrow.x + 10, arrow.y + 7);
      }
      this.ctx.stroke();
    }
  }

  private drawOrbs() {
    if (this.runController.state.activePhase.type === "orbit_constellation") {
      if (this.orbitConnectLines && this.orbitStars.length > 1) {
        this.ctx.strokeStyle = "rgba(255, 158, 174, 0.45)";
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(this.orbitStars[0].x, this.orbitStars[0].y);
        for (const star of this.orbitStars.slice(1)) {
          this.ctx.lineTo(star.x, star.y);
        }
        this.ctx.closePath();
        this.ctx.stroke();
      }
      for (const star of this.orbitStars) {
        this.ctx.beginPath();
        this.ctx.shadowColor = "rgba(199, 17, 59, 0.65)";
        this.ctx.shadowBlur = 24;
        this.ctx.fillStyle = "#8f082b";
        this.ctx.arc(star.x, star.y, star.currentSize, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = "#ff9fb2";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
      return;
    }

    const shouldRenderHazards =
      this.runController.state.activePhase.type === "solace_nodes" ||
      this.runController.state.activePhase.type === "resonance_tiles" ||
      this.runController.state.activePhase.type === "resonance_constellation";
    if (!shouldRenderHazards) {
      return;
    }

    for (const orb of this.orbHazards) {
      this.ctx.beginPath();
      this.ctx.shadowColor = "rgba(234, 54, 54, 0.48)";
      this.ctx.shadowBlur = 16;
      this.ctx.fillStyle = "#A30000";
      this.ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "#ffd0d0";
      this.ctx.stroke();
    }
  }

  private drawNodes() {
    const phaseType = this.runController.state.activePhase.type;
    if (phaseType !== "solace_nodes" && phaseType !== "resonance_tiles" && phaseType !== "resonance_constellation") {
      return;
    }

    const progress = this.runController.state.activePhase.objectiveProgress;
    const nextNode = this.nodeTargets.find((node) => node.index === progress);
    const resonancePulseMs = this.runController.state.activePhase.pattern.type === "resonance_constellation"
      ? this.runController.state.activePhase.pattern.resonance.pulseMs
      : 1060;
    const pulseCycleMs = phaseType === "resonance_constellation" ? resonancePulseMs : 1060;
    const pulse = 1 + Math.sin((performance.now() / pulseCycleMs) * Math.PI * 2) * 0.1;

    if (phaseType === "resonance_tiles") {
      for (const tile of this.chaosTiles) {
        this.ctx.fillStyle = "rgba(130,247,255,0.22)";
        this.ctx.fillRect(tile.x - tile.size / 2, tile.y - tile.size / 2, tile.size, tile.size);
        this.ctx.strokeStyle = "#82F7FF";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(tile.x - tile.size / 2, tile.y - tile.size / 2, tile.size, tile.size);
      }
      if (nextNode) {
        this.ctx.strokeStyle = "rgba(145, 255, 205, 0.4)";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 8]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.x, this.player.y);
        this.ctx.lineTo(nextNode.x, nextNode.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
      for (const node of this.nodeTargets) {
        const x = node.x - node.radius;
        const y = node.y - node.radius;
        const size = node.radius * 2;
        this.ctx.fillStyle = node.index < progress ? "#fff4a8" : node.index === progress ? "#0B5D1E" : "rgba(11,93,30,0.26)";
        this.ctx.fillRect(x, y, size, size);
        this.ctx.strokeStyle = node.index === progress ? "#00FF88" : "#cfffe4";
        this.ctx.lineWidth = node.index === progress ? 3 : 2;
        this.ctx.strokeRect(
          node.index === progress ? x - (pulse - 1) * 6 : x,
          node.index === progress ? y - (pulse - 1) * 6 : y,
          node.index === progress ? size + (pulse - 1) * 12 : size,
          node.index === progress ? size + (pulse - 1) * 12 : size,
        );
      }
      return;
    }

    if (phaseType === "resonance_constellation") {
      for (const tile of this.chaosTiles) {
        this.ctx.fillStyle = "rgba(130,247,255,0.22)";
        this.ctx.fillRect(tile.x - tile.size / 2, tile.y - tile.size / 2, tile.size, tile.size);
        this.ctx.strokeStyle = "#82F7FF";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(tile.x - tile.size / 2, tile.y - tile.size / 2, tile.size, tile.size);
      }

      const grouped = new Map<number, NodeTarget[]>();
      for (const node of this.nodeTargets) {
        const key = node.group ?? 0;
        const list = grouped.get(key) ?? [];
        list.push(node);
        grouped.set(key, list);
      }

      for (const nodes of grouped.values()) {
        if (nodes.length < 2) continue;
        this.ctx.strokeStyle = "rgba(145, 255, 205, 0.22)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(nodes[0].x, nodes[0].y);
        for (const node of nodes.slice(1)) {
          this.ctx.lineTo(node.x, node.y);
        }
        this.ctx.stroke();
      }
    }

    if (nextNode) {
      this.ctx.strokeStyle = "rgba(74, 222, 128, 0.45)";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([8, 8]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.x, this.player.y);
      this.ctx.lineTo(nextNode.x, nextNode.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.beginPath();
      this.ctx.strokeStyle = "rgba(145, 255, 205, 0.45)";
      this.ctx.lineWidth = 3;
      this.ctx.arc(nextNode.x, nextNode.y, nextNode.radius * (1.55 * pulse), 0, Math.PI * 2);
      this.ctx.stroke();
    }

    for (const node of this.nodeTargets) {
      this.ctx.beginPath();
      if (node.index < progress) {
        this.ctx.fillStyle = "#fff4a8";
      } else if (node.index === progress) {
        this.ctx.shadowColor = "rgba(85, 240, 176, 0.6)";
        this.ctx.shadowBlur = 22;
        this.ctx.fillStyle = "#0f6b49";
      } else {
        this.ctx.fillStyle = "rgba(15,107,73,0.42)";
      }
      this.ctx.arc(node.x, node.y, node.index === progress ? node.radius * pulse : node.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = "#f0fff5";
      this.ctx.lineWidth = node.index === progress ? 3 : 2;
      this.ctx.stroke();
      this.ctx.fillStyle = node.index < progress ? "#281f08" : "#f0fff5";
      this.ctx.font = 'bold 14px "JetBrains Mono", monospace';
      this.ctx.fillText(String(node.index + 1), node.x - 4, node.y + 5);
    }
  }

  private drawShards() {
    for (const shard of this.shardTargets) {
      const x = shard.x - shard.width / 2;
      const y = shard.y - shard.height / 2;
      if (shard.state === "warning") {
        this.ctx.fillStyle = shard.kind === "good" ? "rgba(0,255,0,0.28)" : "rgba(163,0,0,0.3)";
        this.ctx.strokeStyle = shard.kind === "good" ? "rgba(0,255,0,0.45)" : "rgba(163,0,0,0.5)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(shard.x, y - 18);
        this.ctx.lineTo(shard.x, ARENA.y + ARENA.height - 8);
        this.ctx.stroke();
      }
      this.ctx.lineWidth = 3;
      if (shard.kind === "good") {
        this.ctx.beginPath();
        this.ctx.fillStyle = shard.state === "warning" ? "rgba(0,255,0,0.32)" : "#00FF00";
        this.ctx.arc(shard.x, shard.y, shard.width / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = "#C8FFC8";
        this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.fillStyle = shard.state === "warning" ? "rgba(163,0,0,0.35)" : "#A30000";
        this.ctx.moveTo(shard.x, y + shard.height);
        this.ctx.lineTo(x, y);
        this.ctx.lineTo(x + shard.width, y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.strokeStyle = "#FFB3B3";
        this.ctx.stroke();
      }
    }
  }

  private drawArenaLegend() {
    const entries = this.legendEntriesForPhase(this.runController.state.activePhase.type);
    const legendX = 556;
    const legendY = 34;
    const legendWidth = Math.max(210, 20 + entries.length * 68);
    this.ctx.fillStyle = "rgba(13, 17, 28, 0.82)";
    this.ctx.fillRect(legendX, legendY, legendWidth, 48);
    this.ctx.strokeStyle = "rgba(183, 201, 240, 0.16)";
    this.ctx.strokeRect(legendX, legendY, legendWidth, 48);

    entries.forEach((entry, index) => {
      this.drawLegendSwatch(legendX + 12 + index * 70, legendY + 14, entry.color);
    });

    this.ctx.fillStyle = "#dfe7ff";
    this.ctx.font = '11px "JetBrains Mono", monospace';
    entries.forEach((entry, index) => {
      this.ctx.fillText(entry.label, legendX + 8 + index * 70, legendY + 40);
    });
  }

  private drawLegendSwatch(x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, 18, 18);
    this.ctx.strokeStyle = "rgba(255,255,255,0.35)";
    this.ctx.strokeRect(x, y, 18, 18);
  }

  private drawObjectiveChip() {
    const phase = this.runController.state.activePhase;
    const label = phase.objectiveTarget > 0
      ? `${phase.objectiveProgress}/${phase.objectiveTarget}`
      : Number.isFinite(phase.timeRemaining)
        ? `${Math.ceil(phase.timeRemaining)}s`
        : "LIVE";
    this.ctx.fillStyle = "rgba(13, 17, 28, 0.88)";
    this.ctx.fillRect(680, 88, 86, 32);
    this.ctx.strokeStyle = "rgba(183, 201, 240, 0.18)";
    this.ctx.strokeRect(680, 88, 86, 32);
    this.ctx.fillStyle = "#fff5c4";
    this.ctx.font = 'bold 16px "JetBrains Mono", monospace';
    this.ctx.fillText(label, 698, 109);
  }

  private drawChaosWarning() {
    const { chaos, controller } = this.runController.state;
    if (chaos < 72) {
      return;
    }

    const width = 188;
    const x = 36;
    const y = 84;
    const ratio = Math.min(1, (chaos - 72) / 28);
    const glow = controller === "solace" ? "rgba(255, 105, 180, 0.24)" : "rgba(0, 255, 170, 0.2)";
    this.ctx.fillStyle = `rgba(14, 18, 30, ${0.72 + ratio * 0.18})`;
    this.ctx.fillRect(x, y, width, 34);
    this.ctx.strokeStyle = glow;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, 34);
    this.ctx.fillStyle = chaos >= 92 ? "#fff0b3" : "#dfe7ff";
    this.ctx.font = 'bold 13px "JetBrains Mono", monospace';
    this.ctx.fillText(chaos >= 92 ? "SWAP IMMINENT" : "ENTROPY SURGING", x + 16, y + 22);
  }

  private drawPhaseBanner() {
    if (this.phaseBannerMs <= 0) return;
    const alpha = Math.min(1, this.phaseBannerMs / 500);
    this.ctx.fillStyle = `rgba(9, 12, 20, ${0.68 * alpha})`;
    this.ctx.fillRect(190, 178, 420, 74);
    this.ctx.strokeStyle = `rgba(233, 240, 255, ${0.22 * alpha})`;
    this.ctx.strokeRect(190, 178, 420, 74);
    this.ctx.fillStyle = `rgba(255, 244, 168, ${alpha})`;
    this.ctx.font = 'bold 18px "JetBrains Mono", monospace';
    this.ctx.fillText(this.phaseBannerText, 218, 220);
  }

  private drawEventBanner() {
    if (this.eventBannerMs <= 0 || !this.eventBannerText) {
      return;
    }

    const alpha = Math.min(1, this.eventBannerMs / 350);
    const palette =
      this.eventBannerTone === "success"
        ? { fill: `rgba(8, 44, 24, ${0.88 * alpha})`, stroke: `rgba(0, 255, 153, ${0.55 * alpha})`, text: `rgba(200, 255, 220, ${alpha})` }
        : this.eventBannerTone === "failure"
          ? { fill: `rgba(56, 10, 24, ${0.88 * alpha})`, stroke: `rgba(255, 116, 146, ${0.55 * alpha})`, text: `rgba(255, 219, 227, ${alpha})` }
          : this.eventBannerTone === "warning"
            ? { fill: `rgba(28, 20, 56, ${0.88 * alpha})`, stroke: `rgba(196, 177, 255, ${0.55 * alpha})`, text: `rgba(242, 238, 255, ${alpha})` }
            : { fill: `rgba(14, 20, 36, ${0.82 * alpha})`, stroke: `rgba(181, 203, 255, ${0.4 * alpha})`, text: `rgba(231, 239, 255, ${alpha})` };

    this.ctx.fillStyle = palette.fill;
    this.ctx.fillRect(232, 388, 336, 34);
    this.ctx.strokeStyle = palette.stroke;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(232, 388, 336, 34);
    this.ctx.fillStyle = palette.text;
    this.ctx.font = 'bold 14px "JetBrains Mono", monospace';
    this.ctx.fillText(this.eventBannerText, 252, 410);
  }

  private drawEndOverlay() {
    if (!this.runController.state.victory && !this.runController.state.defeat) {
      return;
    }
    this.ctx.fillStyle = "rgba(5, 7, 13, 0.82)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.runController.state.victory ? "#00FF99" : "#FF8FA3";
    this.ctx.textAlign = "center";
    this.ctx.font = '16px "Press Start 2P", monospace';
    this.ctx.fillText(
      this.runController.state.victory ? "RITUAL COMPLETE" : "TIME EXPIRED",
      this.canvas.width / 2,
      188,
    );
    this.ctx.fillStyle = "#f2f6ff";
    this.ctx.font = '8px "Press Start 2P", monospace';
    this.wrapCenteredText(
      this.runController.state.victory
        ? "Quantum entropy carried you across the final threshold."
        : "The goal meter never reached 100 before the collapse closed.",
      this.canvas.width / 2,
      236,
      320,
      18,
    );
    this.ctx.textAlign = "left";
  }

  private phaseBannerFor(type: PhaseType) {
    switch (type) {
      case "quantum_lattice":
        return "RUIN PHASE - QUANTUM LATTICE";
      case "orbit_constellation":
        return "RUIN PHASE - CONSTELLATION COLLAPSE";
      case "cross_blasters":
        return "RUIN PHASE - CROSS BLASTERS";
      case "shield_parry":
        return "RUIN PHASE - QUANTUM SHIELD";
      case "collapse_corridor":
        return "RUIN PHASE - COLLAPSE CORRIDOR";
      case "quantum_rain":
        return "SOLACE PHASE - QUANTUM RAIN";
      case "resonance_tiles":
        return "SOLACE PHASE - RESONANCE TILES";
      case "resonance_constellation":
        return "SOLACE PHASE - RESONANCE CONSTELLATION";
      case "ruin_orbs":
        return "RUIN PHASE - RIDE THE LATTICE";
      case "ruin_beams":
        return "RUIN PHASE - FIND THE CORRIDOR";
      case "solace_nodes":
        return "SOLACE PHASE - TRACE THE CONSTELLATION";
      case "solace_shards":
        return "SOLACE PHASE - CATCH GREEN SHARDS";
      default:
        return "PHASE START";
    }
  }

  private legendEntriesForPhase(type: PhaseType): LegendEntry[] {
    switch (type) {
      case "quantum_lattice":
        return [
          { color: "#A30000", label: "HARM" },
          { color: "#0B5D1E", label: "SAFE" },
          { color: "#82F7FF", label: "CHAOS+" },
        ];
      case "orbit_constellation":
        return [
          { color: "#A30000", label: "STAR" },
          { color: "#FF9FB2", label: "LINK" },
          { color: "#82F7FF", label: "CHAOS+" },
        ];
      case "cross_blasters":
        return [
          { color: "#d8e0ee", label: "AIM" },
          { color: "#FF7C97", label: "BLAST" },
          { color: "#82F7FF", label: "CHAOS+" },
        ];
      case "shield_parry":
        return [
          { color: "#A30000", label: "BLOCK" },
          { color: "#82F7FF", label: "TAKE" },
          { color: "#ffe59b", label: "SHIELD" },
        ];
      case "collapse_corridor":
        return [
          { color: "#0B5D1E", label: "SAFE" },
          { color: "#A30000", label: "CRUSH" },
          { color: "#82F7FF", label: "CHAOS+" },
        ];
      case "quantum_rain":
        return [
          { color: "#00FF00", label: "GOOD" },
          { color: "#A30000", label: "HARM" },
          { color: "#82F7FF", label: "CHAOS" },
        ];
      case "resonance_tiles":
        return [
          { color: "#0B5D1E", label: "TRACE" },
          { color: "#A30000", label: "HARM" },
          { color: "#82F7FF", label: "CHAOS" },
        ];
      case "resonance_constellation":
        return [
          { color: "#0B5D1E", label: "TRACE" },
          { color: "#A30000", label: "ORB" },
          { color: "#fff4a8", label: "DONE" },
        ];
      case "ruin_orbs":
        return [
          { color: "#A30000", label: "HARM" },
          { color: "#ffbdc8", label: "NEXT" },
          { color: "#82F7FF", label: "CHAOS+" },
        ];
      case "ruin_beams":
        return [
          { color: "#ff7c97", label: "BEAM" },
          { color: "#ffdbe2", label: "GATE" },
          { color: "#82F7FF", label: "CHAOS+" },
        ];
      case "solace_nodes":
        return [
          { color: "#00FF99", label: "TRACE" },
          { color: "#A30000", label: "HARM" },
          { color: "#82F7FF", label: "CHAOS" },
        ];
      case "solace_shards":
        return [
          { color: "#00FF00", label: "GOOD" },
          { color: "#A30000", label: "HARM" },
          { color: "#82F7FF", label: "CHAOS" },
        ];
      default:
        return [
          { color: "#ffffff", label: "YOU" },
          { color: "#A30000", label: "HARM" },
          { color: "#82F7FF", label: "CHAOS" },
        ];
    }
  }

  private playerCellIndex() {
    const lattice =
      this.runController.state.activePhase.pattern.type === "quantum_lattice" ||
      this.runController.state.activePhase.pattern.type === "ruin_orbs"
        ? this.runController.state.activePhase.pattern.lattice
        : null;
    if (!lattice) {
      return -1;
    }

    const col = Math.max(0, Math.min(lattice.cols - 1, Math.floor((this.player.x - ARENA.x) / (ARENA.width / lattice.cols))));
    const row = Math.max(0, Math.min(lattice.rows - 1, Math.floor((this.player.y - ARENA.y) / (ARENA.height / lattice.rows))));
    return row * lattice.cols + col;
  }
}
