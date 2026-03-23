import { ArenaCanvas } from "./game/ArenaCanvas";
import { RunController } from "./game/RunController";
import type { PhaseType, SessionBootstrap } from "./game/types";
import { Hud } from "./ui/hud";
import "./styles/main.css";

const PLAYER_NAME_KEY = "quantum.playerName";
const INTRO_COMPLETED_KEY = "quantum.introCompleted";
const PHASE_ONE_MUSIC_ID = "wbO3p7_Mf30";
const PHASE_TWO_MUSIC_ID = "CANW8s9Lt4g";

function formatTypingDuration(line: string) {
  return Math.max(1300, Math.min(2800, line.length * 44));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

class MusicManager {
  private readonly frame = document.createElement("iframe");

  private currentTrack: "phase1" | "phase2" | null = null;

  constructor() {
    this.frame.className = "music-frame";
    this.frame.allow = "autoplay";
    this.frame.title = "Battle music";
    this.frame.tabIndex = -1;
    document.body.append(this.frame);
  }

  playPhaseOne() {
    this.play("phase1", PHASE_ONE_MUSIC_ID);
  }

  playPhaseTwo() {
    this.play("phase2", PHASE_TWO_MUSIC_ID);
  }

  private play(track: "phase1" | "phase2", videoId: string) {
    if (this.currentTrack === track) {
      return;
    }
    this.currentTrack = track;
    this.frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0`;
  }
}

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

class ExperienceOverlay {
  private readonly root = document.createElement("div");

  private readonly cover = document.createElement("div");

  private readonly panel = document.createElement("div");

  private readonly card = document.createElement("div");

  private readonly title = document.createElement("div");

  private readonly copy = document.createElement("div");

  private readonly form = document.createElement("div");

  private readonly focus = document.createElement("div");

  private readonly burst = document.createElement("div");

  constructor(private readonly shell: HTMLElement) {
    this.root.className = "experience-overlay";
    this.cover.className = "experience-overlay__cover";
    this.panel.className = "experience-overlay__panel";
    this.card.className = "experience-overlay__card";
    this.title.className = "experience-overlay__title";
    this.copy.className = "experience-overlay__copy";
    this.form.className = "experience-overlay__form";
    this.focus.className = "experience-overlay__focus";
    this.burst.className = "experience-overlay__burst";
    this.burst.innerHTML = `<div class="experience-overlay__burst-portrait"></div>`;

    this.card.append(this.title, this.copy, this.form);
    this.panel.append(this.card);
    this.root.append(this.cover, this.panel, this.focus, this.burst);
    this.shell.append(this.root);
  }

  setCoverVisible(visible: boolean) {
    this.root.classList.toggle("experience-overlay--cover-visible", visible);
  }

  hidePanel() {
    this.root.classList.remove("experience-overlay--panel-visible");
    this.card.classList.remove("experience-overlay__card--victory");
    this.card.classList.remove("experience-overlay__card--explanation");
    this.form.replaceChildren();
  }

  showMessage(title: string, copy = "") {
    this.card.classList.remove("experience-overlay__card--victory");
    this.card.classList.remove("experience-overlay__card--explanation");
    this.title.textContent = title;
    this.copy.textContent = copy;
    this.form.className = "experience-overlay__form";
    this.form.replaceChildren();
    this.root.classList.add("experience-overlay--panel-visible");
    this.setCoverVisible(true);
  }

  showVictoryTitle(title: string) {
    this.title.textContent = title;
    this.copy.textContent = "Click the button below if you want to learn how the game uses CURBY's Quantum Entropy!";
    this.form.className = "experience-overlay__actions";
    this.form.replaceChildren();
    const explain = document.createElement("button");
    explain.className = "experience-overlay__button experience-overlay__button--victory";
    explain.textContent = "Quantum Explanation";
    explain.addEventListener("click", () => {
      this.showQuantumExplanation();
    });
    this.form.append(explain);
    this.card.classList.add("experience-overlay__card--victory");
    this.root.classList.add("experience-overlay--panel-visible");
    this.setCoverVisible(true);
  }

  showQuantumExplanation() {
    this.card.classList.remove("experience-overlay__card--victory");
    this.card.classList.add("experience-overlay__card--explanation");
    this.title.textContent = "How CURBY Quantum Entropy Drives The Game";
    this.copy.textContent = "Each section below shows a part of the game and how it uses CURBY's quantum output to shape attacks, swaps, and missions.";
    this.form.className = "experience-overlay__explanation";
    this.form.replaceChildren();

    const sections = [
      {
        title: "Quantum Bitstream",
        kind: "seed",
        body: "When a run begins, the frontend receives CURBY's randomness bytes and turns them into a forward and reverse bitstream. Those bits drive the encounter structure instead of ordinary local randomness.",
      },
      {
        title: "Chaos Meter",
        kind: "chaos",
        body: "The Chaos meter uses the reversed quantum stream. CURBY-derived bits decide whether Chaos rises or falls and by how much, which is what triggers swaps.",
      },
      {
        title: "Quantum Lattice",
        kind: "lattice",
        body: "The lattice attack uses quantum bits to choose which tile family appears, how it mirrors, how quickly it resolves, and where the cyan chaos tiles appear.",
      },
      {
        title: "Cross Blasters",
        kind: "blasters",
        body: "The blaster phase uses quantum bits to decide how many volleys appear, which lanes fire, where the cannons anchor, and how wide or delayed the blasts become.",
      },
      {
        title: "Shield Parry",
        kind: "shield",
        body: "Each shield arrow uses quantum output to decide its direction, color, and speed. In the harder Ruin phase, CURBY also shapes how the volleys are grouped.",
      },
      {
        title: "Quantum Rain",
        kind: "rain",
        body: "Every shard wave consumes fresh quantum bits to decide whether there are one or two green shards, which lanes are safe, the shared fall speed, and the cyan tile preset.",
      },
      {
        title: "Resonance Constellation",
        kind: "constellation",
        body: "The constellation missions choose from preset shapes like stars, squares, zigzags, and pentagons. CURBY decides which family appears, the node order, and the red orb hazards.",
      },
      {
        title: "Phase Two Ruin",
        kind: "phase2",
        body: "When Ruin survives the first sealing, the same quantum foundation powers a harsher second phase: stronger Chaos swings, denser attacks, and harder Ruin patterns.",
      },
    ] as const;

    for (const section of sections) {
      const card = document.createElement("section");
      card.className = "experience-overlay__section";

      const preview = this.buildExplanationPreview(section.kind);

      const content = document.createElement("div");
      content.className = "experience-overlay__section-copy";

      const heading = document.createElement("h3");
      heading.className = "experience-overlay__section-title";
      heading.textContent = section.title;

      const body = document.createElement("p");
      body.className = "experience-overlay__section-body";
      body.textContent = section.body;

      content.append(heading, body);
      card.append(preview, content);
      this.form.append(card);
    }

    const back = document.createElement("button");
    back.className = "experience-overlay__button";
    back.textContent = "Back";
    back.addEventListener("click", () => {
      this.showVictoryTitle("YOU WON!");
    });
    this.form.append(back);

    this.root.classList.add("experience-overlay--panel-visible");
    this.setCoverVisible(true);
  }

  private buildExplanationPreview(kind: "seed" | "chaos" | "lattice" | "blasters" | "shield" | "rain" | "constellation" | "phase2") {
    const canvas = document.createElement("canvas");
    canvas.className = "experience-overlay__preview";
    canvas.width = 220;
    canvas.height = 170;
    const context = canvas.getContext("2d");
    if (!context) {
      return canvas;
    }

    this.drawPreviewBackground(context, canvas.width, canvas.height);

    switch (kind) {
      case "seed":
        this.drawSeedPreview(context, canvas.width, canvas.height);
        break;
      case "chaos":
        this.drawChaosPreview(context, canvas.width, canvas.height);
        break;
      case "lattice":
        this.drawLatticePreview(context, canvas.width, canvas.height);
        break;
      case "blasters":
        this.drawBlasterPreview(context, canvas.width, canvas.height);
        break;
      case "shield":
        this.drawShieldPreview(context, canvas.width, canvas.height);
        break;
      case "rain":
        this.drawRainPreview(context, canvas.width, canvas.height);
        break;
      case "constellation":
        this.drawConstellationPreview(context, canvas.width, canvas.height);
        break;
      case "phase2":
        this.drawPhaseTwoPreview(context, canvas.width, canvas.height);
        break;
      default:
        break;
    }

    return canvas;
  }

  private drawPreviewBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#f5f5f5";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    ctx.imageSmoothingEnabled = false;
  }

  private drawArena(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.fillStyle = "#02050d";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#2a2f3b";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);
  }

  private drawSeedPreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const bits = "101101001011011100101110100111001011";
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.fillText("CURBY BITS", 16, 24);
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.fillStyle = "#8ee3ff";
    ctx.fillText(bits.slice(0, 18), 16, 58);
    ctx.fillText(bits.slice(18), 16, 78);
    ctx.strokeStyle = "#82f7ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 104);
    ctx.lineTo(204, 104);
    ctx.stroke();
    ctx.fillStyle = "#00ff66";
    ctx.fillRect(16, 112, 88, 16);
    ctx.fillStyle = "#1f4cff";
    ctx.fillRect(116, 112, 88, 16);
    ctx.fillStyle = "#000";
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillText("FORWARD", 22, 124);
    ctx.fillText("REVERSE", 121, 124);
    ctx.fillStyle = "#d6d9e2";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText("Same CURBY round => same bitstream", 16, 152);
  }

  private drawChaosPreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const meterX = 24;
    const meterY = 18;
    const meterW = 34;
    const meterH = 130;
    ctx.strokeStyle = "#f5f5f5";
    ctx.lineWidth = 4;
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = "#ed2491";
    ctx.fillRect(meterX + 4, meterY + 44, meterW - 8, meterH - 48);
    ctx.strokeStyle = "#82f7ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(86, 44);
    ctx.lineTo(118, 26);
    ctx.lineTo(150, 44);
    ctx.stroke();
    ctx.strokeStyle = "#ff4858";
    ctx.beginPath();
    ctx.moveTo(86, 122);
    ctx.lineTo(118, 142);
    ctx.lineTo(150, 122);
    ctx.stroke();
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.fillText("+5 to +10", 82, 72);
    ctx.fillText("-5 to -10", 82, 112);
    ctx.fillStyle = "#d6d9e2";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText("Reverse CURBY bits", 82, 148);
  }

  private drawLatticePreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const arenaSize = 132;
    const arenaX = 44;
    const arenaY = 20;
    this.drawArena(ctx, arenaX, arenaY, arenaSize);
    const cols = 5;
    const rows = 4;
    const cellW = 22;
    const cellH = 28;
    const padding = 4;
    const redCells = new Set(["1,0", "0,2", "4,1", "2,3"]);
    const greenCells = new Set(["0,0", "4,3", "2,1"]);
    const cyanCells = new Set(["2,0", "1,3", "3,2"]);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const key = `${col},${row}`;
        let fill = "#141b26";
        if (redCells.has(key)) fill = "#e63b4a";
        if (greenCells.has(key)) fill = "#16a34a";
        if (cyanCells.has(key)) fill = "#82f7ff";
        const x = arenaX + 8 + col * (cellW + padding);
        const y = arenaY + 8 + row * (cellH + padding);
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cellW, cellH);
      }
    }
  }

  private drawBlasterPreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const arenaSize = 132;
    const arenaX = 44;
    const arenaY = 20;
    this.drawArena(ctx, arenaX, arenaY, arenaSize);
    ctx.fillStyle = "#737b89";
    ctx.fillRect(arenaX + 26, arenaY, 4, arenaSize);
    ctx.fillRect(arenaX + 92, arenaY, 4, arenaSize);
    ctx.fillRect(arenaX, arenaY + 38, arenaSize, 4);
    ctx.fillRect(arenaX, arenaY + 98, arenaSize, 4);
    ctx.fillStyle = "#ff3b4d";
    ctx.fillRect(arenaX + 24, arenaY, 8, arenaSize);
    ctx.fillRect(arenaX + 90, arenaY, 8, arenaSize);
    ctx.fillRect(arenaX, arenaY + 36, arenaSize, 8);
    ctx.fillRect(arenaX, arenaY + 96, arenaSize, 8);
    ctx.fillStyle = "#1c2430";
    ctx.fillRect(arenaX + 22, arenaY - 6, 12, 10);
    ctx.fillRect(arenaX + 88, arenaY + arenaSize - 4, 12, 10);
    ctx.fillRect(arenaX - 6, arenaY + 34, 10, 12);
    ctx.fillRect(arenaX + arenaSize - 4, arenaY + 94, 10, 12);
  }

  private drawShieldPreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const arenaSize = 132;
    const arenaX = 44;
    const arenaY = 20;
    this.drawArena(ctx, arenaX, arenaY, arenaSize);
    const centerX = arenaX + arenaSize / 2;
    const centerY = arenaY + arenaSize / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#ff3347";
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.strokeStyle = "#ffe59b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(centerX - 22, centerY - 16);
    ctx.lineTo(centerX - 22, centerY + 16);
    ctx.stroke();
    this.drawArrow(ctx, centerX, arenaY + 18, 0, 1, "#ff4858");
    this.drawArrow(ctx, arenaX + 18, centerY, 1, 0, "#82f7ff");
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    color: string,
  ) {
    ctx.fillStyle = color;
    const shaftLength = 28;
    const shaftWidth = 6;
    if (dirY !== 0) {
      ctx.fillRect(x - shaftWidth / 2, y, shaftWidth, shaftLength);
      ctx.beginPath();
      ctx.moveTo(x, y + shaftLength + 10);
      ctx.lineTo(x - 10, y + shaftLength - 2);
      ctx.lineTo(x + 10, y + shaftLength - 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x, y - shaftWidth / 2, shaftLength, shaftWidth);
      ctx.beginPath();
      ctx.moveTo(x + shaftLength + 10, y);
      ctx.lineTo(x + shaftLength - 2, y - 10);
      ctx.lineTo(x + shaftLength - 2, y + 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawRainPreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const arenaSize = 132;
    const arenaX = 44;
    const arenaY = 20;
    this.drawArena(ctx, arenaX, arenaY, arenaSize);
    const laneXs = [14, 34, 54, 74, 94, 114].map((offset) => arenaX + offset);
    const shardY = [26, 42, 24, 38, 30, 20].map((offset) => arenaY + offset);
    laneXs.forEach((laneX, index) => {
      if (index === 1 || index === 4) {
        ctx.fillStyle = "#00ff66";
        ctx.beginPath();
        ctx.arc(laneX, shardY[index], 9, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.fillStyle = "#ff4858";
      ctx.beginPath();
      ctx.moveTo(laneX, shardY[index] + 12);
      ctx.lineTo(laneX - 10, shardY[index] - 10);
      ctx.lineTo(laneX + 10, shardY[index] - 10);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = "#82f7ff";
    ctx.fillRect(arenaX + 14, arenaY + 100, 18, 18);
    ctx.fillRect(arenaX + 56, arenaY + 112, 18, 18);
    ctx.fillRect(arenaX + 98, arenaY + 104, 18, 18);
  }

  private drawConstellationPreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const arenaSize = 132;
    const arenaX = 44;
    const arenaY = 20;
    this.drawArena(ctx, arenaX, arenaY, arenaSize);
    const points = [
      { x: arenaX + 66, y: arenaY + 16 },
      { x: arenaX + 84, y: arenaY + 50 },
      { x: arenaX + 116, y: arenaY + 52 },
      { x: arenaX + 92, y: arenaY + 76 },
      { x: arenaX + 102, y: arenaY + 112 },
      { x: arenaX + 66, y: arenaY + 92 },
      { x: arenaX + 30, y: arenaY + 112 },
      { x: arenaX + 40, y: arenaY + 76 },
      { x: arenaX + 16, y: arenaY + 52 },
      { x: arenaX + 48, y: arenaY + 50 },
    ];
    ctx.strokeStyle = "#82f7ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.stroke();
    points.forEach((point, index) => {
      ctx.fillStyle = index < 5 ? "#ffe45b" : "#f5f5f5";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0f131a";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    const hazardOrbs = [
      { x: arenaX + 28, y: arenaY + 34 },
      { x: arenaX + 110, y: arenaY + 100 },
      { x: arenaX + 92, y: arenaY + 24 },
    ];
    hazardOrbs.forEach((orb) => {
      ctx.fillStyle = "#ff3b4d";
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private drawPhaseTwoPreview(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const arenaSize = 132;
    const arenaX = 44;
    const arenaY = 20;
    this.drawArena(ctx, arenaX, arenaY, arenaSize);
    ctx.strokeStyle = "#244cff";
    ctx.lineWidth = 3;
    ctx.strokeRect(arenaX - 2, arenaY - 2, arenaSize + 4, arenaSize + 4);
    [22, 60, 98].forEach((offset) => {
      ctx.fillStyle = "#8ee3ff";
      ctx.fillRect(arenaX + offset, arenaY, 8, arenaSize);
      ctx.fillRect(arenaX, arenaY + offset, arenaSize, 8);
    });
    ctx.fillStyle = "#1f4cff";
    ctx.fillRect(12, 18, 16, 130);
    ctx.strokeStyle = "#f5f5f5";
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 18, 16, 130);
    ctx.fillStyle = "#8ee3ff";
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillText("P2", 12, 162);
  }

  async promptForName(existing = "") {
    this.form.className = "experience-overlay__form";
    this.title.textContent = "What should I call you?";
    this.copy.textContent = "";
    this.form.replaceChildren();

    const input = document.createElement("input");
    input.className = "experience-overlay__input";
    input.type = "text";
    input.maxLength = 18;
    input.value = existing;

    const submit = document.createElement("button");
    submit.className = "experience-overlay__button";
    submit.type = "button";
    submit.textContent = "Submit";

    this.form.append(input, submit);
    this.root.classList.add("experience-overlay--panel-visible");
    this.setCoverVisible(true);

    return new Promise<string>((resolve) => {
      const complete = () => {
        const value = input.value.trim() || "Hero";
        this.hidePanel();
        resolve(value);
      };

      submit.addEventListener("click", complete, { once: true });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          complete();
        }
      });
      window.setTimeout(() => input.focus(), 50);
    });
  }

  async promptForStartChoice(playerName: string) {
    this.title.textContent = `Welcome back, ${playerName.toUpperCase()}`;
    this.copy.textContent = "Choose whether to jump straight into the fight or replay Solace's briefing.";
    this.form.className = "experience-overlay__actions";
    this.form.replaceChildren();

    const start = document.createElement("button");
    start.className = "experience-overlay__button";
    start.textContent = "Start";

    const replay = document.createElement("button");
    replay.className = "experience-overlay__button";
    replay.textContent = "Replay Intro";

    this.form.append(start, replay);
    this.root.classList.add("experience-overlay--panel-visible");
    this.setCoverVisible(true);

    return new Promise<"start" | "replay">((resolve) => {
      start.addEventListener("click", () => {
        this.hidePanel();
        resolve("start");
      }, { once: true });
      replay.addEventListener("click", () => {
        this.hidePanel();
        resolve("replay");
      }, { once: true });
    });
  }

  async promptForAdminAction() {
    this.title.textContent = "Admin Panel";
    this.copy.textContent = "Choose where to jump in the live fight.";
    this.form.className = "experience-overlay__actions";
    this.form.replaceChildren();

    const phaseTwo = document.createElement("button");
    phaseTwo.className = "experience-overlay__button";
    phaseTwo.textContent = "Skip to phase 2";

    const ending = document.createElement("button");
    ending.className = "experience-overlay__button";
    ending.textContent = "Skip to ending";

    const cancel = document.createElement("button");
    cancel.className = "experience-overlay__button";
    cancel.textContent = "Cancel";

    this.form.append(phaseTwo, ending, cancel);
    this.root.classList.add("experience-overlay--panel-visible");
    this.setCoverVisible(true);

    return new Promise<"phase2" | "ending" | "cancel">((resolve) => {
      phaseTwo.addEventListener("click", () => {
        this.hidePanel();
        this.setCoverVisible(false);
        resolve("phase2");
      }, { once: true });
      ending.addEventListener("click", () => {
        this.hidePanel();
        this.setCoverVisible(false);
        resolve("ending");
      }, { once: true });
      cancel.addEventListener("click", () => {
        this.hidePanel();
        this.setCoverVisible(false);
        resolve("cancel");
      }, { once: true });
    });
  }

  focusTargets(targets: (Element | null | undefined)[], padding = 18) {
    const validTargets = targets.filter((target): target is Element => Boolean(target));
    if (validTargets.length === 0) {
      this.clearFocus();
      return;
    }

    const shellRect = this.shell.getBoundingClientRect();
    const rects = validTargets.map((target) => target.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left)) - shellRect.left - padding;
    const top = Math.min(...rects.map((rect) => rect.top)) - shellRect.top - padding;
    const right = Math.max(...rects.map((rect) => rect.right)) - shellRect.left + padding;
    const bottom = Math.max(...rects.map((rect) => rect.bottom)) - shellRect.top + padding;

    this.focus.style.left = `${Math.max(8, left)}px`;
    this.focus.style.top = `${Math.max(8, top)}px`;
    this.focus.style.width = `${Math.min(shellRect.width - 16, right - left)}px`;
    this.focus.style.height = `${Math.min(shellRect.height - 16, bottom - top)}px`;
    this.root.classList.add("experience-overlay--focus-visible");
    this.setCoverVisible(true);
  }

  clearFocus() {
    this.root.classList.remove("experience-overlay--focus-visible");
  }

  async burstRuin() {
    this.root.classList.add("experience-overlay--burst");
    const retroShell = this.shell.querySelector(".retro-shell");
    retroShell?.classList.add("retro-shell--intro-shake");
    await sleep(750);
    retroShell?.classList.remove("retro-shell--intro-shake");
    this.root.classList.remove("experience-overlay--burst");
  }

  hideAll() {
    this.hidePanel();
    this.clearFocus();
    this.setCoverVisible(false);
    this.root.classList.remove("experience-overlay--burst");
  }
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
    app.innerHTML = `<main class="page-shell page-shell--hidden"></main>`;

    const shell = app.querySelector(".page-shell") as HTMLElement;
    const hud = new Hud();
    hud.mount(shell);
    const overlay = new ExperienceOverlay(shell);
    const music = new MusicManager();
    hud.setAdminEnabled(false);

    let activeArena: ArenaCanvas | null = null;
    let detachListener: (() => void) | null = null;
    let activeRunController: RunController | null = null;
    let liveAdminEnabled = false;

    const cleanupController = () => {
      detachListener?.();
      detachListener = null;
      activeArena?.destroy();
      activeArena = null;
      activeRunController = null;
    };

    const bindController = (
      runController: RunController,
      options: { tutorial?: boolean; onTutorialDamage?: (() => void) | null } = {},
    ) => {
      cleanupController();
      const arena = new ArenaCanvas(runController, hud.getGameRoot());
      arena.setTutorialMode(options.tutorial === true, options.onTutorialDamage ?? null);
      arena.start();
      activeArena = arena;
      activeRunController = runController;

      let victoryEndingStarted = false;
      detachListener = runController.addListener(({ reason, state, previousController }) => {
        hud.update(state, runController.getObjectiveText());
        if (reason === "swap_complete") {
          arena.syncPhase(state.activePhase.type);
        }
        if ((reason === "phase_two_start" || reason === "phase_two_line") && state.speechText) {
          hud.playResultSpeech("ruin", state.speechText, 1500);
        }
        if (reason === "phase_two_start") {
          music.playPhaseTwo();
        }
        if (reason === "phase_two_complete") {
          if (state.phaseTwoActive) {
            music.playPhaseTwo();
          }
          arena.syncPhase(state.activePhase.type);
        }
        if (reason === "phase_success") {
          hud.playResultSpeech(
            state.controller as "ruin" | "solace",
            stageResultDialogue("passed", state.controller as "ruin" | "solace"),
          );
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
          hud.playResultSpeech(
            state.controller as "ruin" | "solace",
            stageResultDialogue("failed", state.controller as "ruin" | "solace"),
          );
          arena.startResultInterstitial(
            "failed",
            state.controller as "ruin" | "solace",
            stageResultDialogue("failed", state.controller as "ruin" | "solace"),
            state.activePhase.type,
          );
          arena.showRunEvent("phase_failure", {
            controller: state.controller as "ruin" | "solace",
            goalDelta: 10,
          });
        }
        if (reason === "phase_start") {
          const outcome = state.controller === "ruin" ? "passed" : "failed";
          hud.playResultSpeech(
            state.controller as "ruin" | "solace",
            stageResultDialogue(outcome, state.controller as "ruin" | "solace"),
          );
          arena.startResultInterstitial(
            outcome,
            state.controller as "ruin" | "solace",
            stageResultDialogue(outcome, state.controller as "ruin" | "solace"),
            state.activePhase.type,
          );
        }
        if (reason === "swap_start") {
          hud.startSwapAnimation(previousController);
          arena.showRunEvent("swap_start");
        }
        if (reason === "swap_complete") {
          hud.finishSwapAnimation(state.controller);
          arena.flashSwap(state.controller as "ruin" | "solace");
          arena.showRunEvent("swap_complete", { controller: state.controller as "ruin" | "solace" });
        }
        if (reason === "game_over") {
          liveAdminEnabled = false;
          hud.setAdminEnabled(false);
          if (state.victory) {
            if (victoryEndingStarted) {
              return;
            }
            victoryEndingStarted = true;
            void (async () => {
              arena.setPaused(true);
              overlay.clearFocus();
              const retroShell = shell.querySelector(".retro-shell");
              retroShell?.classList.add("retro-shell--cinematic");
              overlay.setCoverVisible(true);
              runController.setPresentationState({
                controller: "ruin",
                speechText: "",
                waitingText: "",
                statusText: "Ritual complete",
              });
              await sleep(900);
              overlay.setCoverVisible(false);
              retroShell?.classList.add("retro-shell--victory-ruin-shake");
              await sleep(6000);
              retroShell?.classList.remove("retro-shell--victory-ruin-shake");
              retroShell?.classList.add("retro-shell--victory-ruin-split");
              await sleep(3000);
              await waitForSpeech(runController, "ruin", "I guess this is it huh?", [], 3000, false);
              await waitForSpeech(runController, "ruin", "I'll get you next time. When quantum entropy is on my side.", [], 3000, false);
              overlay.setCoverVisible(true);
              await sleep(700);
              const playerName = localStorage.getItem(PLAYER_NAME_KEY) || "Hero";
              retroShell?.classList.remove("retro-shell--victory-ruin-split");
              runController.setPresentationState({
                controller: "solace",
                speechText: "",
                waitingText: "",
                statusText: "The world is safe",
              });
              overlay.setCoverVisible(false);
              await waitForSpeech(runController, "solace", `Great job ${playerName}, that was awesome!`, [], 3000, false);
              await waitForSpeech(runController, "solace", "The world is saved thanks to you!", [], 3000, false);
              await waitForSpeech(runController, "solace", "Well, I wish I could stay here to thank you but I've got other matters to attend to now!", [], 3000, false);
              await waitForSpeech(runController, "solace", `Thanks ${playerName}, you will be remembered forever.`, [], 3000, false);
              overlay.setCoverVisible(true);
              await sleep(900);
              overlay.showVictoryTitle("YOU WON!");
              arena.destroy();
            })();
            return;
          }
          arena.showRunEvent("defeat");
          arena.destroy();
        }
      });

      hud.update(runController.state, runController.getObjectiveText());
      return { runController, arena };
    };

      const waitForSpeech = async (
        runController: RunController,
        speaker: "ruin" | "solace",
        line: string,
        focusSelectors: string[] = [],
        postDelayMs = 3000,
        useFocus = true,
      ) => {
        runController.setPresentationState({ controller: speaker });
        if (useFocus) {
          const focusTargets = [
            ...focusSelectors.map((selector) => shell.querySelector(selector)),
            shell.querySelector(".retro-active"),
            shell.querySelector(".retro-speech"),
          ];
          overlay.focusTargets(focusTargets);
        } else {
          overlay.clearFocus();
        }
        const duration = formatTypingDuration(line);
        hud.playResultSpeech(speaker, line, duration);
        await sleep(duration + postDelayMs);
      };

    const startLiveGame = () => {
      shell.classList.remove("page-shell--hidden");
      overlay.hideAll();
      const liveRun = new RunController(bootstrap);
      bindController(liveRun);
      liveAdminEnabled = true;
      hud.setAdminEnabled(true);
      music.playPhaseOne();
    };

    const runTutorial = async (playerName: string) => {
      shell.classList.remove("page-shell--hidden");
      liveAdminEnabled = false;
      hud.setAdminEnabled(false);
      let damageExplained = false;
      let tutorialRunRef: RunController;
      let tutorialArenaRef: ArenaCanvas;
      let tutorialInterruption: Promise<void> | null = null;
      let resolveTutorialInterruption: (() => void) | null = null;

      const waitForTutorialWindow = async (durationMs: number) => {
        let elapsed = 0;
        const tickMs = 100;
        while (elapsed < durationMs) {
          if (tutorialInterruption) {
            await tutorialInterruption;
            continue;
          }
          await sleep(tickMs);
          if (!tutorialInterruption) {
            elapsed += tickMs;
          }
        }
      };

      const explainDamage = async () => {
        if (damageExplained || tutorialInterruption) {
          return;
        }
        damageExplained = true;
        tutorialInterruption = new Promise<void>((resolve) => {
          resolveTutorialInterruption = resolve;
        });
        tutorialArenaRef.setPaused(true);
        tutorialRunRef.setTutorialPaused(true);
        await waitForSpeech(
          tutorialRunRef,
          "solace",
          "That red flash means Ruin hit you! In the real fight, you would lose one heart.",
          [".retro-status__item--hp"],
        );
        await waitForSpeech(
          tutorialRunRef,
          "solace",
          "Lose all 3 hearts and you lose 10% of your Goal meter.",
          [".retro-status__item--hp", ".retro-meter--goal"],
        );
        tutorialRunRef.setTutorialPaused(false);
        tutorialArenaRef.setPaused(false);
        resolveTutorialInterruption?.();
        resolveTutorialInterruption = null;
        tutorialInterruption = null;
      };

      const bound = bindController(new RunController(bootstrap), {
        tutorial: true,
        onTutorialDamage: () => {
          void explainDamage();
        },
      });
      tutorialRunRef = bound.runController;
      tutorialArenaRef = bound.arena;
      tutorialRunRef.setTutorialMode(true);
      tutorialRunRef.setPresentationState({
        controller: "solace",
        goal: 0,
        chaos: 50,
        overallTimeRemaining: 12 * 60,
        statusText: "Tutorial sequence",
        speechText: "",
        waitingText: "",
      });
      tutorialRunRef.setTutorialPaused(true);
      tutorialArenaRef.setPaused(true);

      overlay.setCoverVisible(true);
      overlay.focusTargets([shell.querySelector(".retro-active"), shell.querySelector(".retro-speech")], 24);

      await waitForSpeech(
        tutorialRunRef,
        "solace",
        `${playerName}, please help! There is no time to explain, we must stop my brother Ruin!`,
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "Ruin wants to open a gate of CHAOS into this world! But you have the power to close the gate! Follow my instructions!",
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "You can use WASD or arrow keys to move your character around.",
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "Ruin has 3 attack patterns. Let me show you below.",
        [".retro-arena-frame"],
      );

      const demoPhase = async (
        type: PhaseType,
        controller: "ruin" | "solace",
        lines: string[],
        durationMs: number,
        leadInMs = 0,
      ) => {
        tutorialRunRef.forcePhase(type, controller, { timeRemaining: Number.POSITIVE_INFINITY });
        tutorialArenaRef.syncPhase(type);
        tutorialArenaRef.setTutorialLeadIn(leadInMs);
        tutorialRunRef.setTutorialPaused(true);
        tutorialArenaRef.setPaused(true);
        for (const line of lines) {
          await waitForSpeech(tutorialRunRef, "solace", line, [".retro-arena-frame"]);
        }
        await waitForSpeech(tutorialRunRef, "solace", "Try it out now!", [".retro-arena-frame"]);
        tutorialRunRef.setTutorialPaused(false);
        tutorialArenaRef.setPaused(false);
        overlay.focusTargets([shell.querySelector(".retro-arena-frame"), shell.querySelector(".retro-active"), shell.querySelector(".retro-speech")], 24);
        await waitForTutorialWindow(durationMs);
        if (tutorialInterruption) {
          await tutorialInterruption;
        }
        tutorialRunRef.setTutorialPaused(true);
        tutorialArenaRef.setPaused(true);
      };

      await demoPhase(
        "quantum_lattice",
        "ruin",
        [
          "For this attack, Ruin will heat up tiles.",
          "Avoid the red heating tiles!",
          "Stand on green tiles to be safe, and cyan ones to increase your chaos!",
          "Ruin's attacks are completely random, powered by quantum entropy that changes from the CURBy beacon.",
          "His attack order, patterns, and timings are all determined by quantum randomness.",
        ],
        6400,
      );

      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "Your chaos bar will swap Ruin and I around when it is full.",
        [".retro-meter--chaos"],
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "The chaos meter will randomly go up and down, based on CURBy's quantum randomness.",
        [".retro-meter--chaos"],
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "When you swap to me, a mission will appear and you must finish it!",
        [".retro-status__item--objective"],
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "Finishing missions will gain goal meter progress, allowing us to close the CHAOS portal!",
        [".retro-meter--goal", ".retro-status__item--objective"],
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "Reach 100% to SAVE THE WORLD FROM CHAOS!",
        [".retro-meter--goal"],
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "When you swap to Ruin, your goal is to avoid dying.",
        [".retro-status__item--hp"],
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "You have 3 lives below. If you lose all 3 lives, you will lose 10% goal meter.",
        [".retro-status__item--hp", ".retro-meter--goal"],
      );
      await waitForSpeech(
        tutorialRunRef,
        "solace",
        "Let me show you the next attacks!",
        [".retro-arena-frame"],
      );

      await demoPhase(
        "cross_blasters",
        "ruin",
        [
          "These blasters show their aim lines before they fire.",
          "Read the warning and move before the crossfire locks in!",
        ],
        6200,
        2000,
      );

      await demoPhase(
        "shield_parry",
        "ruin",
        [
          "Here, Ruin pins you in place.",
          "Block the red arrows with your shield, and let cyan arrows through to raise chaos!",
        ],
        7000,
      );

      await demoPhase(
        "quantum_rain",
        "solace",
        [
          "When I take over, I will give you missions like this one.",
          "Catch the green shards and avoid the red spikes before Ruin returns!",
          "These small cyan tiles will increase CHAOS if you touch them.",
          "It is best if you try NOT to touch cyan tiles when Solace is in control, because you don't want to swap back to RUIN.",
          "But you want to touch cyan tiles when Ruin is in control, in order to swap back to SOLACE.",
        ],
        6200,
      );

      await demoPhase(
        "resonance_constellation",
        "solace",
        [
          "The last one is a constellation minigame.",
          "Trace the glowing constellation nodes in order.",
          "And make sure to avoid touching the red orbs that will damage you!",
          "These missions raise the Goal meter and bring us closer to closing the gate!",
        ],
        6200,
      );

      await waitForSpeech(tutorialRunRef, "solace", "And that's all, got it!");
      overlay.clearFocus();
      await overlay.burstRuin();
      await waitForSpeech(tutorialRunRef, "ruin", "I've finally found you Solace.");
      await waitForSpeech(tutorialRunRef, "ruin", "I shall defeat you and turn the world into CHAOS!");
      await waitForSpeech(tutorialRunRef, "solace", `${playerName}, save the world!`);

      overlay.clearFocus();
      overlay.setCoverVisible(true);
      await sleep(700);
      cleanupController();
      localStorage.setItem(INTRO_COMPLETED_KEY, "true");

      shell.classList.remove("page-shell--hidden");
      const liveBound = bindController(new RunController(bootstrap), { tutorial: true });
      liveBound.runController.setTutorialMode(true);
      liveBound.runController.setTutorialPaused(true);
      liveBound.arena.setPaused(true);
      const arenaFrame = shell.querySelector(".retro-arena-frame");
      arenaFrame?.classList.add("retro-arena-frame--intro-expand");
      overlay.setCoverVisible(false);
      await sleep(900);
      arenaFrame?.classList.remove("retro-arena-frame--intro-expand");
      await sleep(2000);
      liveBound.runController.setPresentationState({ controller: "ruin" });
      hud.playResultSpeech("ruin", "Time to die!", formatTypingDuration("Time to die!"));
      await sleep(formatTypingDuration("Time to die!") + 2000);
      music.playPhaseOne();
      liveBound.runController.setTutorialPaused(false);
      liveBound.runController.setTutorialMode(false);
      liveBound.arena.setTutorialMode(false, null);
      liveBound.arena.setPaused(false);
      liveAdminEnabled = true;
      hud.setAdminEnabled(true);
    };

    hud.setAdminHandler(() => {
      if (!liveAdminEnabled || !activeRunController) {
        return;
      }
      void (async () => {
        const choice = await overlay.promptForAdminAction();
        if (choice === "phase2") {
          activeRunController?.skipToPhaseTwo();
        } else if (choice === "ending") {
          music.playPhaseTwo();
          activeRunController?.skipToEnding();
        }
      })();
    });

    const storedName = localStorage.getItem(PLAYER_NAME_KEY);
    const introCompleted = localStorage.getItem(INTRO_COMPLETED_KEY) === "true";

    let playerName = storedName?.trim() ?? "";
    if (!playerName) {
      playerName = await overlay.promptForName();
      localStorage.setItem(PLAYER_NAME_KEY, playerName);
      await runTutorial(playerName);
      return;
    }

    if (introCompleted) {
      const choice = await overlay.promptForStartChoice(playerName);
      if (choice === "start") {
        startLiveGame();
      } else {
        await runTutorial(playerName);
      }
      return;
    }

    await runTutorial(playerName);
  } catch (error) {
    app.innerHTML = `<div class="error-state">Unable to start the session: ${String(error)}</div>`;
  }
}

void start();
