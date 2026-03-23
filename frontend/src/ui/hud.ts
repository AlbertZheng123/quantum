import type { RunState } from "../game/types";

function formatTime(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function shortObjectiveText(state: RunState, objectiveText: string) {
  if (state.controller === "solace" && state.activePhase.objectiveTarget > 0) {
    return `${objectiveText} ${state.activePhase.objectiveProgress}/${state.activePhase.objectiveTarget}`;
  }
  return objectiveText;
}

export class Hud {
  private readonly root = document.createElement("div");

  private readonly shell = document.createElement("div");

  private readonly activePortrait = document.createElement("div");

  private readonly inactivePortrait = document.createElement("div");

  private readonly activeName = document.createElement("div");

  private readonly activeRole = document.createElement("div");

  private readonly speechText = document.createElement("div");

  private readonly inactiveName = document.createElement("div");

  private readonly inactiveState = document.createElement("div");

  private readonly goalFill = document.createElement("div");

  private readonly goalValue = document.createElement("div");

  private readonly chaosFill = document.createElement("div");

  private readonly chaosValue = document.createElement("div");

  private readonly adminButton = document.createElement("button");

  private readonly objectiveValue = document.createElement("div");

  private readonly timerValue = document.createElement("div");

  private readonly heartsWrap = document.createElement("div");

  private readonly phaseTimerBox = document.createElement("div");

  private readonly phaseTimerValue = document.createElement("div");

  private speechAnimationFrame = 0;

  private speechOverride: {
    speaker: "ruin" | "solace";
    line: string;
    startedAt: number;
    durationMs: number;
  } | null = null;

  constructor() {
    this.root.className = "hud-shell";
    this.shell.className = "retro-shell";
    this.root.append(this.shell);

    this.shell.innerHTML = `
      <div class="retro-topbar"></div>
      <section class="retro-header">
        <div class="retro-waiting">
          <div class="retro-portrait retro-portrait--inactive"></div>
          <div class="retro-waiting__name"></div>
          <div class="retro-waiting__state">WAITING</div>
        </div>
        <div class="retro-active">
          <div class="retro-active__name"></div>
          <div class="retro-active__role"></div>
          <div class="retro-portrait retro-portrait--active"></div>
        </div>
        <div class="retro-speech">
          <div class="retro-speech__text"></div>
        </div>
      </section>
      <section class="retro-combat">
        <div class="retro-meter retro-meter--goal">
          <div class="retro-meter__label">GOAL</div>
          <div class="retro-meter__track">
            <div class="retro-meter__fill retro-meter__fill--goal"></div>
          </div>
          <div class="retro-meter__value retro-meter__value--goal"></div>
        </div>
        <div class="retro-arena-frame">
          <div id="game-root"></div>
          <div class="retro-phase-timer">
            <div class="retro-phase-timer__value"></div>
          </div>
        </div>
        <div class="retro-meter retro-meter--chaos">
          <div class="retro-meter__label">CHAOS</div>
          <div class="retro-meter__track">
            <div class="retro-meter__fill retro-meter__fill--chaos"></div>
          </div>
          <div class="retro-meter__value retro-meter__value--chaos"></div>
        </div>
      </section>
      <footer class="retro-status">
        <button type="button" class="retro-status__item retro-status__item--round retro-status__admin"></button>
        <div class="retro-status__item retro-status__item--objective"></div>
        <div class="retro-status__item retro-status__item--hp">
          <span class="retro-status__label">HP</span>
          <div class="retro-status__hearts"></div>
        </div>
        <div class="retro-status__item retro-status__item--time"></div>
      </footer>
    `;

    this.activePortrait.className = "retro-portrait retro-portrait--active";
    this.inactivePortrait.className = "retro-portrait retro-portrait--inactive";
    this.activeName.className = "retro-active__name";
    this.activeRole.className = "retro-active__role";
    this.speechText.className = "retro-speech__text";
    this.inactiveName.className = "retro-waiting__name";
    this.inactiveState.className = "retro-waiting__state";
    this.goalFill.className = "retro-meter__fill retro-meter__fill--goal";
    this.goalValue.className = "retro-meter__value retro-meter__value--goal";
    this.chaosFill.className = "retro-meter__fill retro-meter__fill--chaos";
    this.chaosValue.className = "retro-meter__value retro-meter__value--chaos";
    this.adminButton.className = "retro-status__item retro-status__item--round retro-status__admin";
    this.objectiveValue.className = "retro-status__item retro-status__item--objective";
    this.timerValue.className = "retro-status__item retro-status__item--time";
    this.heartsWrap.className = "retro-status__hearts";
    this.phaseTimerBox.className = "retro-phase-timer";
    this.phaseTimerValue.className = "retro-phase-timer__value";

    this.shell.querySelector(".retro-portrait--active")!.replaceWith(this.activePortrait);
    this.shell.querySelector(".retro-portrait--inactive")!.replaceWith(this.inactivePortrait);
    this.shell.querySelector(".retro-active__name")!.replaceWith(this.activeName);
    this.shell.querySelector(".retro-active__role")!.replaceWith(this.activeRole);
    this.shell.querySelector(".retro-speech__text")!.replaceWith(this.speechText);
    this.shell.querySelector(".retro-waiting__name")!.replaceWith(this.inactiveName);
    this.shell.querySelector(".retro-waiting__state")!.replaceWith(this.inactiveState);
    this.shell.querySelector(".retro-meter__fill--goal")!.replaceWith(this.goalFill);
    this.shell.querySelector(".retro-meter__value--goal")!.replaceWith(this.goalValue);
    this.shell.querySelector(".retro-meter__fill--chaos")!.replaceWith(this.chaosFill);
    this.shell.querySelector(".retro-meter__value--chaos")!.replaceWith(this.chaosValue);
    this.shell.querySelector(".retro-status__item--round")!.replaceWith(this.adminButton);
    this.shell.querySelector(".retro-status__item--objective")!.replaceWith(this.objectiveValue);
    this.shell.querySelector(".retro-status__item--time")!.replaceWith(this.timerValue);
    this.shell.querySelector(".retro-status__hearts")!.replaceWith(this.heartsWrap);
    this.shell.querySelector(".retro-phase-timer")!.replaceWith(this.phaseTimerBox);
    this.phaseTimerBox.append(this.phaseTimerValue);
  }

  mount(parent: HTMLElement) {
    parent.append(this.root);
  }

  setAdminHandler(handler: (() => void) | null) {
    this.adminButton.onclick = handler;
  }

  setAdminEnabled(enabled: boolean) {
    this.adminButton.disabled = !enabled;
  }

  getGameRoot() {
    return this.root.querySelector<HTMLDivElement>("#game-root")!;
  }

  startSwapAnimation(previousController: "ruin" | "solace") {
    this.shell.dataset.swapFrom = previousController;
    this.shell.classList.add("retro-shell--swapping");
  }

  finishSwapAnimation(currentController: RunState["controller"]) {
    this.shell.classList.remove("retro-shell--swapping");
    this.shell.classList.add("retro-shell--swap-finish");
    this.shell.dataset.controller = currentController;
    window.setTimeout(() => {
      this.shell.classList.remove("retro-shell--swap-finish");
    }, 220);
  }

  playResultSpeech(speaker: "ruin" | "solace", line: string, durationMs = 3000) {
    this.speechOverride = {
      speaker,
      line: line.toUpperCase(),
      startedAt: performance.now(),
      durationMs,
    };
    this.activeName.textContent = speaker.toUpperCase();
    this.inactiveName.textContent = speaker === "ruin" ? "SOLACE" : "RUIN";
    this.activeRole.textContent = "IN CONTROL";
    this.inactiveState.textContent = "WAITING";
    window.cancelAnimationFrame(this.speechAnimationFrame);
    const tick = () => {
      if (!this.speechOverride) {
        return;
      }
      const now = performance.now();
      this.speechText.textContent = this.typeSpeechOverride(now);
      if (now - this.speechOverride.startedAt >= this.speechOverride.durationMs) {
        this.speechOverride = null;
        return;
      }
      this.speechAnimationFrame = window.requestAnimationFrame(tick);
    };
    this.speechAnimationFrame = window.requestAnimationFrame(tick);
  }

  update(state: RunState, objectiveText: string) {
    this.shell.dataset.controller = state.controller;
    this.shell.dataset.phaseTwo = state.phaseTwoActive ? "active" : "inactive";
    this.shell.dataset.phaseTwoTransition = state.phaseTwoTransition;
    this.shell.classList.toggle("retro-shell--phase-two-fade", state.phaseTwoTransition === "fade");
    this.shell.classList.toggle("retro-shell--phase-two-reveal", state.phaseTwoTransition === "reveal");
    this.shell.classList.toggle("retro-shell--phase-two-pause", state.phaseTwoTransition === "pause");
    this.shell.classList.toggle("retro-shell--phase-two-transform", state.phaseTwoTransition === "transform");
    this.shell.classList.toggle("retro-shell--phase-two-gap", state.phaseTwoTransition === "gap");
    this.shell.classList.toggle("retro-shell--phase-two-monologue", state.phaseTwoTransition === "monologue");

    const activeController = state.phaseTwoTransition !== "none"
      ? "RUIN"
      : state.controller === "swapping" ? "collapse" : state.controller.toUpperCase();
    const inactiveController = state.controller === "solace" ? "RUIN" : "SOLACE";
    const now = performance.now();
    if (this.speechOverride && now - this.speechOverride.startedAt >= this.speechOverride.durationMs) {
      this.speechOverride = null;
    }
    const overrideSpeaker = this.speechOverride?.speaker.toUpperCase();
    const displayedActive = overrideSpeaker ?? activeController;
    const displayedInactive = displayedActive === "RUIN" ? "SOLACE" : "RUIN";

    this.activeName.textContent = displayedActive;
    this.activeRole.textContent = state.controller === "swapping" ? "SWAP OCCURING" : "IN CONTROL";
    this.speechText.textContent = this.speechOverride
      ? this.typeSpeechOverride(now)
      : state.speechText.toUpperCase();
    this.inactiveName.textContent = this.speechOverride ? displayedInactive : inactiveController;
    this.inactiveState.textContent = "WAITING";

    this.goalFill.style.height = `${state.goal}%`;
    this.shell.style.setProperty("--goal-mobile", `${state.goal}%`);
    this.goalValue.textContent = `${state.goal}%`;
    this.chaosFill.style.height = `${state.chaos}%`;
    this.shell.style.setProperty("--chaos-mobile", `${state.chaos}%`);
    this.chaosValue.textContent = `${Math.round(state.chaos)}%`;

    this.adminButton.textContent = "ADMIN PANEL";
    this.adminButton.title = `Round ${state.roundId}`;
    this.objectiveValue.textContent = shortObjectiveText(state, objectiveText);
    this.timerValue.textContent = formatTime(state.overallTimeRemaining);

    const showPhaseTimer = Number.isFinite(state.activePhase.timeRemaining)
      && state.activePhase.timeRemaining > 0
      && state.controller !== "swapping"
      && state.phaseTwoTransition === "none"
      && !state.victory
      && !state.defeat;
    this.phaseTimerBox.classList.toggle("retro-phase-timer--visible", showPhaseTimer);
    if (showPhaseTimer) {
      const secondsLeft = Math.max(0, Math.ceil(state.activePhase.timeRemaining));
      this.phaseTimerValue.textContent = String(secondsLeft);
      this.phaseTimerBox.classList.toggle("retro-phase-timer--danger", secondsLeft <= 3);
    } else {
      this.phaseTimerValue.textContent = "";
      this.phaseTimerBox.classList.remove("retro-phase-timer--danger");
    }

    this.heartsWrap.replaceChildren(
      ...Array.from({ length: state.activePhase.maxHp }, (_, index) => {
        const heart = document.createElement("span");
        heart.className = index < state.activePhase.hp
          ? "retro-status__heart retro-status__heart--full"
          : "retro-status__heart retro-status__heart--empty";
        heart.textContent = "♥";
        return heart;
      }),
    );

    this.activePortrait.setAttribute("aria-label", `${displayedActive} portrait`);
    this.inactivePortrait.setAttribute("aria-label", `${this.inactiveName.textContent ?? "Inactive"} portrait`);
  }

  private typeSpeechOverride(now: number) {
    if (!this.speechOverride) return "";
    const elapsed = Math.max(0, now - this.speechOverride.startedAt);
    const ratio = Math.min(1, elapsed / this.speechOverride.durationMs);
    const chars = Math.max(1, Math.floor(this.speechOverride.line.length * ratio * 1.2));
    return this.speechOverride.line.slice(0, chars);
  }
}
