import { ChaosController } from "./ChaosController";
import { PhaseController } from "./PhaseController";
import { QuantumBitStream } from "./QuantumBitStream";
import type { Controller, RunState, RunUpdateReason, SessionBootstrap } from "./types";

const GOAL_REWARD = 20;
const GOAL_PENALTY = 10;
const OVERALL_TIME_SECONDS = 12 * 60;
const SWAP_DURATION_MS = 1000;
const PHASE_TWO_GOAL_FLOOR = 40;
const PHASE_TWO_FADE_MS = 1000;
const PHASE_TWO_REVEAL_MS = 1000;
const PHASE_TWO_PAUSE_MS = 2000;
const PHASE_TWO_TRANSFORM_MS = 2000;
const PHASE_TWO_LINE_MS = 1500;
const PHASE_TWO_LINE_GAP_MS = 1000;
const PHASE_TWO_LINES = [
  "My attacks will become harder to survive now",
  "You really think you've defeated me huh?",
  "I won't die to a weakling like you!",
  "Let CHAOS rule the world!",
  "Die now!",
] as const;

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

  private phaseTwoLineIndex = 0;

  private phaseTwoStageRemainingMs = 0;

  private phaseTwoGoalStart = 100;

  private tutorialMode = false;

  private tutorialPaused = false;

  constructor(bootstrap: SessionBootstrap) {
    super();
    this.quantumStream = new QuantumBitStream(bootstrap.entropyBytes);
    this.chaosController = new ChaosController(this.quantumStream);
    this.phaseController = new PhaseController(this.quantumStream);

    const startingController = this.phaseController.readStartingController();
    const endgameModifier = this.phaseController.readEndgameModifier();
    const openingPhase = this.phaseController.buildPhase(startingController, false);
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
      phaseTwoActive: false,
      phaseTwoTransition: "none",
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

    if (this.tutorialMode) {
      if (this.tutorialPaused) {
        return;
      }
      if (Number.isFinite(this.state.activePhase.timeRemaining)) {
        this.state.activePhase.timeRemaining = Math.max(0, this.state.activePhase.timeRemaining - deltaMs / 1000);
      }
      this.emit("tick");
      return;
    }

    if (this.state.phaseTwoTransition !== "none") {
      this.updatePhaseTwoTransition(deltaMs);
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
        this.state.activePhase = this.phaseController.buildPhase(nextController, this.state.phaseTwoActive);
        this.state.statusText = `${this.titleCase(nextController)} seized control`;
        this.state.speechText =
          nextController === "ruin"
            ? "The fracture is mine again. Let us see how much progress you lose."
            : "My turn. Focus on the objective before the chaos spikes again.";
        this.state.waitingText =
          nextController === "ruin"
            ? "I can still finish the seal if you hold on."
            : "You cannot hold the body forever.";
        this.chaosController.reset(this.state.phaseTwoActive);
        this.emit("swap_complete");
      }
      return;
    }

    this.state.overallTimeRemaining = Math.max(0, this.state.overallTimeRemaining - deltaMs / 1000);
    if (Number.isFinite(this.state.activePhase.timeRemaining)) {
      this.state.activePhase.timeRemaining = Math.max(0, this.state.activePhase.timeRemaining - deltaMs / 1000);
    }
    this.state.chaos = this.chaosController.update(deltaMs, this.state.chaos, this.state.phaseTwoActive);

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
        if (!this.state.phaseTwoActive) {
          this.startPhaseTwoTransition();
        } else {
          this.state.victory = true;
          this.emit("game_over");
        }
        return;
      }
      this.state.activePhase = this.phaseController.buildPhase(this.state.controller as "ruin" | "solace", this.state.phaseTwoActive);
      this.state.chaos = this.chaosController.nextResetValue();
      this.chaosController.reset(this.state.phaseTwoActive);
      this.emit("phase_success");
      return;
    }

    if (this.state.activePhase.hp <= 0) {
      this.state.goal = Math.max(0, this.state.goal - GOAL_PENALTY);
      if (this.state.controller === "ruin") {
        this.state.statusText = "Ruin phase failed";
        this.state.speechText = "Your progress cracks before me.";
      } else {
        this.state.statusText = "Solace phase failed";
        this.state.speechText = "We lost that window. Be ready for the next.";
      }
      this.state.activePhase = this.phaseController.buildPhase(this.state.controller as "ruin" | "solace", this.state.phaseTwoActive);
      this.state.chaos = this.chaosController.nextResetValue();
      this.chaosController.reset(this.state.phaseTwoActive);
      this.emit("phase_failure");
      return;
    }

    if (Number.isFinite(this.state.activePhase.timeRemaining) && this.state.activePhase.timeRemaining <= 0) {
      if (this.state.controller === "solace") {
        this.state.goal = Math.max(0, this.state.goal - GOAL_PENALTY);
        this.state.statusText = "Solace phase timed out";
        this.state.speechText = "Not enough. We need another opening.";
      } else {
        this.state.statusText = "Ruin phase survived";
        this.state.speechText = "Still alive? Then keep running.";
      }
      this.state.activePhase = this.phaseController.buildPhase(this.state.controller as "ruin" | "solace", this.state.phaseTwoActive);
      this.state.chaos = this.chaosController.nextResetValue();
      this.chaosController.reset(this.state.phaseTwoActive);
      this.emit("phase_start");
      return;
    }

    this.emit("tick");
  }

  applyPhaseDamage(amount: number) {
    if (this.tutorialMode) {
      this.emit("tick");
      return;
    }
    this.state.activePhase.hp = Math.max(0, this.state.activePhase.hp - amount);
    this.emit("tick");
  }

  applyChaosTrap() {
    if (this.tutorialMode) {
      this.state.chaos = Math.min(100, this.state.chaos + 12);
      this.emit("tick");
      return;
    }
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
      if (!this.state.phaseTwoActive) {
        this.startPhaseTwoTransition();
      } else {
        this.state.victory = true;
        this.state.statusText = "Ritual complete";
        this.emit("game_over");
      }
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

  nextShardTrapLayout() {
    if (this.state.activePhase.pattern.type !== "solace_shards" && this.state.activePhase.pattern.type !== "quantum_rain") {
      return null;
    }
    return this.phaseController.nextShardTrapLayout();
  }

  readQuantumChoice<T>(choices: T[]): T {
    return this.quantumStream.readChoice(choices, "forward");
  }

  readQuantumIndex(length: number) {
    return this.quantumStream.readChoice(Array.from({ length }, (_, index) => index), "forward");
  }

  setTutorialMode(enabled: boolean) {
    this.tutorialMode = enabled;
    this.tutorialPaused = false;
    this.emit("tick");
  }

  setTutorialPaused(paused: boolean) {
    this.tutorialPaused = paused;
    this.emit("tick");
  }

  forcePhase(type: import("./types").PhaseType, controller: "ruin" | "solace", options?: {
    phaseTwoActive?: boolean;
    timeRemaining?: number;
  }) {
    this.state.controller = controller;
    this.state.phaseTwoActive = options?.phaseTwoActive ?? false;
    this.state.phaseTwoTransition = "none";
    this.state.activePhase = this.phaseController.buildSpecificPhase(type, this.state.phaseTwoActive);
    if (options?.timeRemaining !== undefined) {
      this.state.activePhase.timeRemaining = options.timeRemaining;
    }
    this.state.activePhase.hp = this.state.activePhase.maxHp;
    this.chaosController.reset(this.state.phaseTwoActive);
    this.emit("tick");
  }

  setPresentationState(patch: Partial<Pick<RunState, "controller" | "goal" | "chaos" | "speechText" | "waitingText" | "statusText" | "overallTimeRemaining">>) {
    Object.assign(this.state, patch);
    this.emit("tick");
  }

  notify() {
    this.emit("tick");
  }

  skipToPhaseTwo() {
    if (this.tutorialMode || this.state.victory || this.state.defeat) {
      return;
    }
    this.state.phaseTwoTransition = "none";
    this.state.phaseTwoActive = true;
    this.state.endgameActive = true;
    this.state.controller = "ruin";
    this.state.goal = PHASE_TWO_GOAL_FLOOR;
    this.state.chaos = 50;
    this.state.activePhase = this.phaseController.buildPhase("ruin", true);
    this.state.statusText = "Chaos phase awakened";
    this.state.speechText = "Die now!";
    this.state.waitingText = "I will take the body back. Stay alive.";
    this.chaosController.reset(true);
    this.emit("phase_two_complete");
  }

  skipToEnding() {
    if (this.tutorialMode || this.state.victory || this.state.defeat) {
      return;
    }
    this.state.phaseTwoTransition = "none";
    this.state.phaseTwoActive = true;
    this.state.endgameActive = true;
    this.state.goal = 100;
    this.state.victory = true;
    this.state.statusText = "Ritual complete";
    this.emit("game_over");
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

  private startPhaseTwoTransition() {
    this.state.phaseTwoTransition = "fade";
    this.state.controller = "ruin";
    this.state.speechText = "";
    this.state.waitingText = "";
    this.state.statusText = "Ruin refuses to fall";
    this.phaseTwoLineIndex = 0;
    this.phaseTwoStageRemainingMs = PHASE_TWO_FADE_MS;
    this.emit("tick");
  }

  private updatePhaseTwoTransition(deltaMs: number) {
    if (this.state.phaseTwoTransition === "fade") {
      this.phaseTwoStageRemainingMs -= deltaMs;
      if (this.phaseTwoStageRemainingMs > 0) {
        this.emit("tick");
        return;
      }

      this.state.phaseTwoTransition = "reveal";
      this.phaseTwoStageRemainingMs = PHASE_TWO_REVEAL_MS;
      this.emit("tick");
      return;
    }

    if (this.state.phaseTwoTransition === "reveal") {
      this.phaseTwoStageRemainingMs -= deltaMs;
      if (this.phaseTwoStageRemainingMs > 0) {
        this.emit("tick");
        return;
      }

      this.state.phaseTwoTransition = "pause";
      this.phaseTwoStageRemainingMs = PHASE_TWO_PAUSE_MS;
      this.emit("tick");
      return;
    }

    if (this.state.phaseTwoTransition === "pause") {
      this.phaseTwoStageRemainingMs -= deltaMs;
      if (this.phaseTwoStageRemainingMs > 0) {
        this.emit("tick");
        return;
      }

      this.state.phaseTwoTransition = "transform";
      this.state.speechText = "";
      this.phaseTwoGoalStart = this.state.goal;
      this.phaseTwoStageRemainingMs = PHASE_TWO_TRANSFORM_MS;
      this.emit("phase_two_start");
      return;
    }

    if (this.state.phaseTwoTransition === "transform") {
      this.phaseTwoStageRemainingMs = Math.max(0, this.phaseTwoStageRemainingMs - deltaMs);
      const ratio = 1 - (this.phaseTwoStageRemainingMs / PHASE_TWO_TRANSFORM_MS);
      this.state.goal = Math.round(this.phaseTwoGoalStart - ((this.phaseTwoGoalStart - PHASE_TWO_GOAL_FLOOR) * ratio));
      if (this.phaseTwoStageRemainingMs <= 0) {
        this.state.goal = PHASE_TWO_GOAL_FLOOR;
        this.state.phaseTwoActive = true;
        this.state.chaos = 50;
        this.state.phaseTwoTransition = "monologue";
        this.phaseTwoLineIndex = 0;
        this.state.speechText = PHASE_TWO_LINES[0];
        this.phaseTwoStageRemainingMs = PHASE_TWO_LINE_MS;
        this.emit("phase_two_line");
        return;
      }
      this.emit("tick");
      return;
    }

    if (this.state.phaseTwoTransition === "monologue") {
      this.phaseTwoStageRemainingMs -= deltaMs;
      if (this.phaseTwoStageRemainingMs > 0) {
        this.emit("tick");
        return;
      }

      this.state.phaseTwoTransition = "gap";
      this.phaseTwoStageRemainingMs = PHASE_TWO_LINE_GAP_MS;
      this.emit("tick");
      return;
    }

    if (this.state.phaseTwoTransition === "gap") {
      this.phaseTwoStageRemainingMs -= deltaMs;
      if (this.phaseTwoStageRemainingMs > 0) {
        this.emit("tick");
        return;
      }

      if (this.phaseTwoLineIndex < PHASE_TWO_LINES.length - 1) {
        this.phaseTwoLineIndex += 1;
        this.state.phaseTwoTransition = "monologue";
        this.state.speechText = PHASE_TWO_LINES[this.phaseTwoLineIndex];
        this.phaseTwoStageRemainingMs = PHASE_TWO_LINE_MS;
        this.emit("phase_two_line");
        return;
      }

      if (this.phaseTwoLineIndex >= PHASE_TWO_LINES.length - 1) {
        this.state.phaseTwoTransition = "none";
        this.state.controller = "ruin";
        this.state.activePhase = this.phaseController.buildPhase("ruin", true);
        this.state.chaos = this.chaosController.nextResetValue();
        this.state.statusText = "Chaos phase awakened";
        this.state.speechText = "Die now!";
        this.state.waitingText = "I will take the body back. Stay alive.";
        this.chaosController.reset(true);
        this.emit("phase_two_complete");
        return;
      }
    }
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
