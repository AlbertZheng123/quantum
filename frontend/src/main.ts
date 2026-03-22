import { ArenaCanvas } from "./game/ArenaCanvas";
import { RunController } from "./game/RunController";
import type { SessionBootstrap } from "./game/types";
import { Hud } from "./ui/hud";
import "./styles/main.css";

function stageResultDialogue(
  outcome: "passed" | "failed",
  speaker: "ruin" | "solace",
) {
  if (speaker === "solace") {
    return outcome === "passed"
      ? "Good. Hold that rhythm. The seal is starting to answer us."
      : "We lost that opening, but the ritual is not over yet.";
  }
  return outcome === "passed"
    ? "You endured that one. Let us see how long your luck survives."
    : "Another fracture. Your progress weakens so easily.";
}

function mapBootstrap(payload: Record<string, unknown>): SessionBootstrap {
  return {
    sessionId: String(payload.session_id),
    roundId: String(payload.round_id),
    entropySource: payload.entropy_source === "curby" ? "curby" : "fallback",
    entropyWarning: payload.entropy_warning ? String(payload.entropy_warning) : null,
    entropyBytes: String(payload.entropy_bytes),
    startedAt: String(payload.started_at),
  };
}

async function start() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = `<div class="loading-state">Fetching quantum entropy and starting the ritual...</div>`;

  try {
    const response = await fetch("/api/session/start", { method: "POST" });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Session bootstrap failed with ${response.status}${errorBody ? `: ${errorBody}` : ""}`);
    }

    const bootstrap = mapBootstrap((await response.json()) as Record<string, unknown>);
    const runController = new RunController(bootstrap);

    app.innerHTML = `<main class="page-shell"></main>`;

    const hud = new Hud();
    const shell = app.querySelector(".page-shell") as HTMLElement;
    hud.mount(shell);

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    const arena = new ArenaCanvas(runController, hud.getGameRoot());
    arena.start();

    runController.addListener(({ reason, state, previousController }) => {
      hud.update(state, runController.getObjectiveText());
      if (reason === "swap_complete") {
        arena.syncPhase(state.activePhase.type);
      }
      if (reason === "phase_success") {
        arena.startResultInterstitial(
          "passed",
          state.controller as "ruin" | "solace",
          stageResultDialogue("passed", state.controller as "ruin" | "solace"),
          state.activePhase.type,
        );
        arena.showRunEvent("phase_success", {
          controller: state.controller as "ruin" | "solace",
          goalDelta: state.controller === "solace" ? 20 : 0,
        });
      }
      if (reason === "phase_failure") {
        arena.startResultInterstitial(
          "failed",
          state.controller as "ruin" | "solace",
          stageResultDialogue("failed", state.controller as "ruin" | "solace"),
          state.activePhase.type,
        );
        arena.showRunEvent("phase_failure", {
          controller: state.controller as "ruin" | "solace",
          goalDelta: state.controller === "ruin" ? 10 : 0,
        });
      }
      if (reason === "phase_start") {
        const outcome = state.controller === "ruin" ? "passed" : "failed";
        arena.startResultInterstitial(
          outcome,
          state.controller as "ruin" | "solace",
          stageResultDialogue(outcome, state.controller as "ruin" | "solace"),
          state.activePhase.type,
        );
      }
      if (reason === "swap_start") {
        hud.startSwapAnimation(previousController);
        arena.flashSwap();
        arena.showRunEvent("swap_start");
      }
      if (reason === "swap_complete") {
        hud.finishSwapAnimation(state.controller);
        arena.showRunEvent("swap_complete", { controller: state.controller as "ruin" | "solace" });
      }
      if (reason === "game_over") {
        if (state.victory) {
          state.statusText = "Ritual complete";
        }
        arena.showRunEvent(state.victory ? "victory" : "defeat");
        arena.destroy();
      }
    });

    hud.update(runController.state, runController.getObjectiveText());
  } catch (error) {
    app.innerHTML = `<div class="error-state">Unable to start the session: ${String(error)}</div>`;
  }
}

void start();
