import { ChaosController } from "./ChaosController";
import { PhaseController } from "./PhaseController";
import { QuantumBitStream } from "./QuantumBitStream";
import type { Controller, RunState, RunUpdateReason, SessionBootstrap } from "./types";

const GOAL_REWARD = 20;
const GOAL_PENALTY = 10;
const OVERALL_TIME_SECONDS = 12 * 60;
const SWAP_DURATION_MS = 1000;

type RunUpdateDetail = {
  reason: RunUpdateReason;
  state: RunState;
  previousController: "ruin" | "solace";
};

export class RunController extends EventTarget {
  readonly state: RunState;

  private readonly quantumStream: QuantumBitStream;

  private readonly chaosController: ChaosController;

  private readonly phaseController: PhaseController;

  private swapRemainingMs = 0;

  private previousController: "ruin" | "solace";

  constructor(bootstrap: SessionBootstrap) {
    super();
    this.quantumStream = new QuantumBitStream(bootstrap.entropyBytes);
    this.chaosController = new ChaosController(this.quantumStream);
    this.phaseController = new PhaseController(this.quantumStream);

    const startingController = this.phaseController.readStartingController();
    const endgameModifier = this.phaseController.readEndgameModifier();
    const openingPhase = this.phaseController.buildPhase(startingController);
    this.previousController = startingController;

    this.state = {
      roundId: bootstrap.roundId,
      entropySource: bootstrap.entropySource,
      entropyWarning: bootstrap.entropyWarning,
      entropyBytes: bootstrap.entropyBytes,
      controller: startingController,
      goal: 0,
      chaos: 50,
      overallTimeRemaining: OVERALL_TIME_SECONDS,
      activePhase: openingPhase,
      statusText: "Session seeded from quantum entropy",
      speechText: startingController === "ruin"
        ? "Keep moving. Solace cannot save you if you stand still."
        : "Stay with me. The ritual can still be sealed.",
      waitingText: startingController === "ruin"
        ? "I can still finish the seal if you hold on."
        : "Every second you linger makes my return worse.",
      victory: false,
      defeat: false,
      endgameModifier,
      endgameActive: false,
    };
    this.chaosController.reset();
  }

  addListener(listener: (detail: RunUpdateDetail) => void) {
    const handler = (event: Event) => {
      listener((event as CustomEvent<RunUpdateDetail>).detail);
    };
    this.addEventListener("update", handler);
    return () => this.removeEventListener("update", handler);
  }

  update(deltaMs: number) {
    if (this.state.victory || this.state.defeat) {
      return;
    }

    if (!this.state.endgameActive && (this.state.goal >= 80 || this.state.overallTimeRemaining <= 120)) {
      this.state.endgameActive = true;
      this.state.statusText = `Endgame collapse: ${this.formatEndgameModifier(this.state.endgameModifier)}`;
      this.emit("endgame_start");
    }

    if (this.state.controller === "swapping") {
      this.swapRemainingMs -= deltaMs;
      if (this.swapRemainingMs <= 0) {
        const nextController = this.previousController === "ruin" ? "solace" : "ruin";
        this.state.controller = nextController;
        this.state.chaos = this.chaosController.nextResetValue();
        this.state.activePhase = this.phaseController.buildPhase(nextController);
        this.state.statusText = `${this.titleCase(nextController)} seized control`;
        this.state.speechText =
          nextController === "ruin"
            ? "The fracture is mine again. Let us see how much progress you lose."
            : "My turn. Focus on the objective before the chaos spikes again.";
        this.state.waitingText =
          nextController === "ruin"
            ? "I can still finish the seal if you hold on."
            : "You cannot hold the body forever.";
        this.chaosController.reset();
        this.emit("swap_complete");
      }
      return;
    }

    this.state.overallTimeRemaining = Math.max(0, this.state.overallTimeRemaining - deltaMs / 1000);
    if (Number.isFinite(this.state.activePhase.timeRemaining)) {
      this.state.activePhase.timeRemaining = Math.max(0, this.state.activePhase.timeRemaining - deltaMs / 1000);
    }
    this.state.chaos = this.chaosController.update(deltaMs, this.state.chaos);

    if (this.state.chaos >= 100) {
      this.startSwap();
      return;
    }

    if (this.state.overallTimeRemaining <= 0) {
      this.state.defeat = this.state.goal < 100;
      this.state.victory = this.state.goal >= 100;
      this.state.statusText = this.state.victory ? "Ritual complete" : "Time expired";
      this.emit("game_over");
      return;
    }

    if (this.isObjectivePhase() && this.state.activePhase.objectiveProgress >= this.state.activePhase.objectiveTarget) {
      this.state.goal = Math.min(100, this.state.goal + GOAL_REWARD);
      this.state.statusText = "Solace phase completed";
      this.state.speechText = "Good. The seal is taking hold.";
      if (this.state.goal >= 100) {
        this.state.victory = true;
        this.emit("game_over");
        return;
      }
      this.state.activePhase = this.phaseController.buildPhase(this.state.controller as "ruin" | "solace");
      this.state.chaos = this.chaosController.nextResetValue();
      this.chaosController.reset();
      this.emit("phase_success");
      return;
    }

    if (this.state.activePhase.hp <= 0) {
      if (this.state.controller === "ruin") {
        this.state.goal = Math.max(0, this.state.goal - GOAL_PENALTY);
        this.state.statusText = "Ruin phase failed";
        this.state.speechText = "Your progress cracks before me.";
      } else {
        this.state.statusText = "Solace phase failed";
        this.state.speechText = "We lost that window. Be ready for the next.";
      }
      this.state.activePhase = this.phaseController.buildPhase(this.state.controller as "ruin" | "solace");
      this.state.chaos = this.chaosController.nextResetValue();
      this.chaosController.reset();
      this.emit("phase_failure");
      return;
    }

    if (Number.isFinite(this.state.activePhase.timeRemaining) && this.state.activePhase.timeRemaining <= 0) {
      if (this.state.controller === "solace") {
        this.state.statusText = "Solace phase timed out";
        this.state.speechText = "Not enough. We need another opening.";
      } else {
        this.state.statusText = "Ruin phase survived";
        this.state.speechText = "Still alive? Then keep running.";
      }
      this.state.activePhase = this.phaseController.buildPhase(this.state.controller as "ruin" | "solace");
      this.state.chaos = this.chaosController.nextResetValue();
      this.chaosController.reset();
      this.emit("phase_start");
      return;
    }

    this.emit("tick");
  }

  applyPhaseDamage(amount: number) {
    this.state.activePhase.hp = Math.max(0, this.state.activePhase.hp - amount);
    this.emit("tick");
  }

  applyChaosTrap() {
    this.state.chaos = this.chaosController.applyTrapPenalty(this.state.controller, this.state.chaos);
    this.emit("tick");
  }

  collectObjective(amount = 1) {
    this.state.activePhase.objectiveProgress = Math.min(
      this.state.activePhase.objectiveTarget,
      this.state.activePhase.objectiveProgress + amount,
    );
    this.emit("tick");
  }

  debugAddGoal(amount: number) {
    this.state.goal = Math.min(100, this.state.goal + amount);
    if (this.state.goal >= 100) {
      this.state.victory = true;
      this.state.statusText = "Ritual complete";
      this.emit("game_over");
      return;
    }
    this.emit("tick");
  }

  debugForceSwap() {
    this.state.chaos = 100;
    this.startSwap();
  }

  getObjectiveText() {
    return this.phaseController.getObjectiveText(this.state.activePhase);
  }

  nextShardWave() {
    if (this.state.activePhase.pattern.type !== "solace_shards" && this.state.activePhase.pattern.type !== "quantum_rain") {
      return null;
    }
    return this.phaseController.nextShardWave(
      this.state.activePhase.pattern as Extract<typeof this.state.activePhase.pattern, { type: "solace_shards" | "quantum_rain" }>,
    );
  }

  private startSwap() {
    if (this.state.controller === "swapping") {
      return;
    }
    this.previousController = this.state.controller as "ruin" | "solace";
    this.state.controller = "swapping";
    this.swapRemainingMs = SWAP_DURATION_MS;
    this.state.statusText = "Quantum collapse event";
    this.state.speechText =
      this.previousController === "ruin"
        ? "No. Do not let Solace take the body."
        : "Hold steady. I can take the body from here.";
    this.emit("swap_start");
  }

  private emit(reason: RunUpdateReason) {
    this.dispatchEvent(
      new CustomEvent<RunUpdateDetail>("update", {
        detail: {
          reason,
          state: { ...this.state, activePhase: { ...this.state.activePhase } },
          previousController: this.previousController,
        },
      }),
    );
  }

  private titleCase(value: string) {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
  }

  private formatEndgameModifier(modifier: RunState["endgameModifier"]) {
    return modifier.replaceAll("_", " ");
  }

  private isObjectivePhase() {
    return this.state.controller === "solace" && this.state.activePhase.objectiveTarget > 0;
  }
}
