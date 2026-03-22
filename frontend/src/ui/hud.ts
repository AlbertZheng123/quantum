import type { RunState } from "../game/types";

function formatTime(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export class Hud {
  private readonly root = document.createElement("div");

  private readonly bossPanel: HTMLElement;

  private readonly activePortrait: HTMLElement;

  private readonly inactivePortrait: HTMLElement;

  private readonly goalFill = document.createElement("div");

  private readonly goalValue = document.createElement("div");

  private readonly goalHint = document.createElement("div");

  private readonly activeName = document.createElement("div");

  private readonly activeRole = document.createElement("div");

  private readonly speechText = document.createElement("div");

  private readonly inactiveName = document.createElement("div");

  private readonly inactiveSpeech = document.createElement("div");

  private readonly chaosFill = document.createElement("div");

  private readonly objectiveText = document.createElement("div");

  private readonly timerValue = document.createElement("div");

  private readonly roundValue = document.createElement("div");

  private readonly statusValue = document.createElement("div");

  private readonly entropyValue = document.createElement("div");

  private readonly entropyWarning = document.createElement("div");

  private readonly chaosValue = document.createElement("div");

  private readonly hpValue = document.createElement("div");

  private readonly hpHearts = document.createElement("div");

  constructor() {
    this.root.className = "hud-shell";
    this.root.innerHTML = `
      <aside class="goal-panel">
        <div class="goal-panel__label">Goal</div>
      </aside>
      <section class="boss-panel">
        <div class="boss-panel__active">
          <div class="portrait portrait--active"></div>
          <div class="boss-panel__copy">
            <div class="boss-panel__title-row">
              <div class="boss-panel__title"></div>
              <div class="boss-panel__role"></div>
            </div>
            <div class="speech-bubble">
              <div class="speech-bubble__tail"></div>
              <div class="speech-bubble__text"></div>
            </div>
            <div class="boss-panel__meta">
              <div class="boss-panel__round"></div>
              <div class="boss-panel__entropy"></div>
            </div>
          </div>
        </div>
        <div class="boss-panel__inactive">
          <div class="portrait portrait--inactive"></div>
          <div class="boss-panel__inactive-name"></div>
          <div class="boss-panel__inactive-text"></div>
        </div>
      </section>
      <section class="arena-panel">
        <div id="game-root"></div>
        <div class="arena-panel__label">Minigame Area</div>
      </section>
      <section class="bottom-panel">
        <div class="bottom-panel__objective">
          <div class="bottom-panel__heading">Objective</div>
        </div>
        <div class="bottom-panel__meter-group">
          <div class="meter">
            <div class="meter__topline">
              <div class="meter__label">Chaos</div>
              <div class="meter__value meter__value--chaos"></div>
            </div>
            <div class="meter__track meter__track--chaos"></div>
            <div class="meter__caption">Quantum entropy keeps driving this bar toward a swap.</div>
          </div>
          <div class="meter">
            <div class="meter__topline">
              <div class="meter__label">Hearts</div>
              <div class="meter__value meter__value--hp"></div>
            </div>
            <div class="meter__hearts"></div>
            <div class="meter__caption">Each hit removes one heart. Hearts reset to 3 every phase.</div>
          </div>
        </div>
        <div class="bottom-panel__status">
          <div class="bottom-panel__heading">Time</div>
        </div>
      </section>
    `;

    this.bossPanel = this.root.querySelector(".boss-panel") as HTMLElement;
    this.activePortrait = this.root.querySelector(".portrait--active") as HTMLElement;
    this.inactivePortrait = this.root.querySelector(".portrait--inactive") as HTMLElement;

    this.goalFill.className = "goal-panel__fill";
    this.goalValue.className = "goal-panel__value";
    this.goalHint.className = "goal-panel__hint";
    this.goalHint.textContent = "Fill to 100";
    this.root.querySelector(".goal-panel")!.append(this.goalFill, this.goalValue, this.goalHint);

    this.activeName.className = "boss-panel__title";
    this.activeRole.className = "boss-panel__role";
    this.speechText.className = "speech-bubble__text";
    this.inactiveName.className = "boss-panel__inactive-name";
    this.inactiveSpeech.className = "boss-panel__inactive-text";
    this.chaosFill.className = "meter__fill meter__fill--chaos";
    this.objectiveText.className = "bottom-panel__objective-text";
    this.timerValue.className = "bottom-panel__time";
    this.roundValue.className = "boss-panel__round";
    this.statusValue.className = "bottom-panel__status-text";
    this.entropyValue.className = "boss-panel__entropy";
    this.entropyWarning.className = "boss-panel__warning";
    this.chaosValue.className = "meter__value meter__value--chaos";
    this.hpValue.className = "meter__value meter__value--hp";
    this.hpHearts.className = "meter__hearts";

    this.root.querySelector(".boss-panel__title-row")!.replaceChildren(this.activeName, this.activeRole);
    this.root.querySelector(".speech-bubble")!.replaceChildren(
      this.root.querySelector(".speech-bubble__tail")!,
      this.speechText,
    );
    this.root.querySelector(".boss-panel__inactive")!.replaceChildren(
      this.root.querySelector(".portrait--inactive")!,
      this.inactiveName,
      this.inactiveSpeech,
    );
    this.root.querySelector(".meter__track--chaos")!.append(this.chaosFill);
    this.root.querySelector(".bottom-panel__objective")!.append(this.objectiveText);
    this.root.querySelector(".bottom-panel__status")!.append(this.timerValue, this.statusValue);
    this.root.querySelector(".meter__value--chaos")!.replaceWith(this.chaosValue);
    this.root.querySelector(".meter__value--hp")!.replaceWith(this.hpValue);
    this.root.querySelector(".meter__hearts")!.replaceWith(this.hpHearts);
    this.root.querySelector(".boss-panel__meta")!.replaceChildren(this.roundValue, this.entropyValue, this.entropyWarning);
  }

  mount(parent: HTMLElement) {
    parent.append(this.root);
  }

  getGameRoot() {
    return this.root.querySelector<HTMLDivElement>("#game-root")!;
  }

  startSwapAnimation(previousController: "ruin" | "solace") {
    this.bossPanel.dataset.swapFrom = previousController;
    this.bossPanel.classList.remove("boss-panel--swap-finish");
    this.bossPanel.classList.add("boss-panel--swapping");
  }

  finishSwapAnimation(currentController: RunState["controller"]) {
    this.bossPanel.classList.remove("boss-panel--swapping");
    this.bossPanel.classList.add("boss-panel--swap-finish");
    this.bossPanel.dataset.controller = currentController;
    window.setTimeout(() => {
      this.bossPanel.classList.remove("boss-panel--swap-finish");
    }, 220);
  }

  update(state: RunState, objectiveText: string) {
    const goalPercent = `${state.goal}%`;
    this.goalFill.style.height = goalPercent;
    this.goalValue.textContent = `${state.goal} / 100`;
    this.activeName.textContent = state.controller === "swapping" ? "COLLAPSE" : state.controller.toUpperCase();
    this.activeRole.textContent =
      state.controller === "swapping" ? "quantum swap in progress" : "currently in control";
    this.speechText.textContent = state.speechText;
    const inactiveName = state.controller === "solace" ? "RUIN" : "SOLACE";
    this.inactiveName.textContent = inactiveName;
    this.inactiveSpeech.textContent = state.waitingText;
    this.chaosFill.style.width = `${state.chaos}%`;
    this.chaosValue.textContent = `${Math.round(state.chaos)} / 100`;
    this.hpValue.textContent = `${Math.round(state.activePhase.hp)} / ${state.activePhase.maxHp}`;
    this.hpHearts.replaceChildren(...Array.from({ length: state.activePhase.maxHp }, (_, index) => {
      const heart = document.createElement("span");
      heart.className = index < state.activePhase.hp ? "meter__heart meter__heart--full" : "meter__heart meter__heart--empty";
      heart.textContent = "♥";
      return heart;
    }));
    this.objectiveText.textContent =
      state.controller === "solace" && state.activePhase.objectiveTarget > 0
        ? `${objectiveText} (${state.activePhase.objectiveProgress}/${state.activePhase.objectiveTarget})`
        : objectiveText;
    this.timerValue.textContent = formatTime(state.overallTimeRemaining);
    this.statusValue.textContent = state.statusText;
    this.roundValue.textContent = `Round ${state.roundId}`;
    this.entropyValue.textContent =
      state.entropySource === "curby"
        ? "Live quantum entropy"
        : "Fallback seeded run";
    this.entropyWarning.textContent =
      state.entropySource === "curby"
        ? "Swaps and patterns are being derived from the latest beacon round."
        : "Using the local deterministic seed because the live CURBy round could not be reached.";
    if (state.controller !== "swapping") {
      this.bossPanel.dataset.controller = state.controller;
    }
    this.activePortrait.setAttribute("aria-label", `${this.activeName.textContent ?? "Active"} portrait`);
    this.inactivePortrait.setAttribute("aria-label", `${this.inactiveName.textContent ?? "Inactive"} portrait`);
  }
}
