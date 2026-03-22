import { QuantumBitStream } from "./QuantumBitStream";

const DELAY_MAP_MS = [3000, 3500, 4000, 5000];
const DELTA_MAP = [-7, -5, -3, 0, 2, 4, 8, 10];

export class ChaosController {
  private timerMs = 0;

  private nextTickMs = 4000;

  constructor(private readonly stream: QuantumBitStream) {}

  reset() {
    this.timerMs = 0;
    this.nextTickMs = this.nextDelay();
  }

  update(deltaMs: number, currentChaos: number) {
    this.timerMs += deltaMs;
    if (this.timerMs < this.nextTickMs) {
      return currentChaos;
    }

    this.timerMs = 0;
    const delta = this.nextDelta();
    this.nextTickMs = this.nextDelay();
    return Math.max(0, Math.min(100, currentChaos + delta));
  }

  applyTrapPenalty(_controller: "ruin" | "solace" | "swapping", currentChaos: number) {
    return Math.min(100, currentChaos + 12);
  }

  nextResetValue() {
    return 50;
  }

  private nextDelay() {
    return DELAY_MAP_MS[this.stream.readInt(2, "reverse")];
  }

  private nextDelta() {
    return DELTA_MAP[this.stream.readInt(3, "reverse")];
  }
}
