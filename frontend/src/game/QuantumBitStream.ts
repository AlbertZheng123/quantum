type Direction = "forward" | "reverse";

function decodeEntropyBytes(encoded: string) {
  const normalized = encoded.trim();
  if (!normalized) {
    throw new Error("Entropy bytes are empty.");
  }

  if (/^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) {
    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < normalized.length; index += 2) {
      bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
    }
    return bytes;
  }

  const padded = normalized.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBits(bytes: Uint8Array) {
  const bits: number[] = [];
  for (const value of bytes) {
    for (let shift = 7; shift >= 0; shift -= 1) {
      bits.push((value >> shift) & 1);
    }
  }
  return bits;
}

export class QuantumBitStream {
  private readonly forwardBits: number[];

  private readonly reverseBits: number[];

  private forwardCursor = 0;

  private reverseCursor = 0;

  constructor(encoded: string) {
    const bits = bytesToBits(decodeEntropyBytes(encoded));
    this.forwardBits = bits;
    this.reverseBits = [...bits].reverse();
  }

  readBit(direction: Direction) {
    return this.readInt(1, direction);
  }

  readInt(count: number, direction: Direction = "forward") {
    if (count <= 0) {
      return 0;
    }

    const source = direction === "forward" ? this.forwardBits : this.reverseBits;
    let cursor = direction === "forward" ? this.forwardCursor : this.reverseCursor;
    let value = 0;

    for (let offset = 0; offset < count; offset += 1) {
      value = (value << 1) | source[cursor % source.length];
      cursor += 1;
    }

    if (direction === "forward") {
      this.forwardCursor = cursor;
    } else {
      this.reverseCursor = cursor;
    }

    return value;
  }

  readChoice<T>(choices: T[], direction: Direction = "forward") {
    if (choices.length === 0) {
      throw new Error("Choices must not be empty.");
    }
    const bitsNeeded = Math.max(1, Math.ceil(Math.log2(choices.length)));
    while (true) {
      const index = this.readInt(bitsNeeded, direction);
      if (index < choices.length) {
        return choices[index];
      }
    }
  }

  readDistinctLanes(count: number, laneCount: number, direction: Direction = "forward") {
    const lanes = new Set<number>();
    while (lanes.size < count) {
      const lane = this.readChoice(Array.from({ length: laneCount }, (_, index) => index), direction);
      lanes.add(lane);
    }
    return [...lanes];
  }
}
