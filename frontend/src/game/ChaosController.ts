import { QuantumBitStream } from "./QuantumBitStream";

const PHASE_ONE_DELAY_MS = 2000;
const PHASE_TWO_DELTA_MAP = [-20, -18, -16, -14, -12, -10, -8, 8, 10, 12, 14, 16, 18, 20, 20, -20];

export class ChaosController {
  private timerMs = 0;

  private nextTickMs = 4000;

  private phaseTwoActive = false;

  constructor(private readonly stream: QuantumBitStream) {}

  reset(phaseTwoActive = this.phaseTwoActive) {
    this.phaseTwoActive = phaseTwoActive;
    this.timerMs = 0;
    this.nextTickMs = this.phaseTwoActive ? 1000 : PHASE_ONE_DELAY_MS;
  }

  update(deltaMs: number, currentChaos: number, phaseTwoActive = this.phaseTwoActive) {
    if (phaseTwoActive !== this.phaseTwoActive) {
      this.reset(phaseTwoActive);
    }
    this.timerMs += deltaMs;
    if (this.timerMs < this.nextTickMs) {
      return currentChaos;
    }

    this.timerMs = 0;
    const delta = this.phaseTwoActive ? this.nextPhaseTwoDelta() : this.nextDelta();
    this.nextTickMs = this.phaseTwoActive ? 1000 : PHASE_ONE_DELAY_MS;
    return Math.max(0, Math.min(100, currentChaos + delta));
  }

  applyTrapPenalty(_controller: "ruin" | "solace" | "swapping", currentChaos: number) {
    return Math.min(100, currentChaos + (this.phaseTwoActive ? 20 : 12));
  }

  nextResetValue() {
    return 50;
  }

  private nextDelta() {
    const sign = this.stream.readBit("reverse") === 0 ? -1 : 1;
    const magnitude = [5, 6, 7, 8, 9, 10, 10, 9][this.stream.readInt(3, "reverse")];
    return sign * magnitude;
  }

  private nextPhaseTwoDelta() {
    return PHASE_TWO_DELTA_MAP[this.stream.readInt(4, "reverse")];
  }
}
