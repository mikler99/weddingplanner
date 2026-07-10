// Minimal, dependency-free QR Code generator (byte mode) — enough to encode a
// URL into a scannable matrix we render as inline SVG. Ported from Nayuki's
// public-domain "QR Code generator" reference (MIT-compatible), trimmed to what
// we need: byte segments, automatic version, all masks + penalty scoring.

const MIN_VERSION = 1;
const MAX_VERSION = 40;

type Ecc = { ordinal: number; formatBits: number };
export const ECC = {
  LOW: { ordinal: 0, formatBits: 1 },
  MEDIUM: { ordinal: 1, formatBits: 0 },
  QUARTILE: { ordinal: 2, formatBits: 3 },
  HIGH: { ordinal: 3, formatBits: 2 },
} satisfies Record<string, Ecc>;

// --- Reed-Solomon over GF(2^8) ----------------------------------------------
function reedSolomonComputeDivisor(degree: number): number[] {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}
function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= reedSolomonMultiply(coef, factor)));
  }
  return result;
}
function reedSolomonMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

// --- Capacity / block tables ------------------------------------------------
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function getNumDataCodewords(ver: number, ecl: Ecc): number {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver]
  );
}

// --- Bit buffer / byte segment ----------------------------------------------
function appendBits(val: number, len: number, bb: number[]): void {
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
}
function toUtf8(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

// --- Public: build the module matrix ----------------------------------------
export function qrMatrix(text: string, ecl: Ecc = ECC.MEDIUM): boolean[][] {
  const bytes = toUtf8(text);

  // Pick the smallest version that fits a single byte segment.
  let version = MIN_VERSION;
  let dataUsedBits = 0;
  for (; ; version++) {
    if (version > MAX_VERSION) throw new Error("Data too long for QR");
    const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
    const ccBits = version < 10 ? 8 : 16; // byte-mode char-count bits
    const usedBits = 4 + ccBits + 8 * bytes.length;
    if (usedBits <= dataCapacityBits) { dataUsedBits = usedBits; break; }
  }

  const bb: number[] = [];
  appendBits(0x4, 4, bb); // byte mode
  appendBits(bytes.length, version < 10 ? 8 : 16, bb);
  for (const b of bytes) appendBits(b, 8, bb);
  void dataUsedBits;

  const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
  appendBits(0, (8 - (bb.length % 8)) % 8, bb);
  for (let pad = 0xec; bb.length < dataCapacityBits; pad ^= 0xec ^ 0x11) appendBits(pad, 8, bb);

  // Pack bits into codeword bytes.
  const dataCodewords: number[] = new Array(bb.length / 8).fill(0);
  bb.forEach((bit, i) => (dataCodewords[i >>> 3] |= bit << (7 - (i & 7))));

  const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);
  return renderMatrix(version, ecl, allCodewords);
}

function addEccAndInterleave(data: number[], version: number, ecl: Ecc): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const rsDiv = reedSolomonComputeDivisor(blockEccLen);
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = reedSolomonComputeRemainder(dat.slice(), rsDiv);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// --- Matrix rendering + masking ---------------------------------------------
function renderMatrix(version: number, ecl: Ecc, codewords: number[]): boolean[][] {
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFn = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; isFunction[y][x] = true; };

  // Timing patterns
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }

  // Finder patterns
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
    }
  };
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);

  // Alignment patterns
  const alignPos = alignmentPatternPositions(version);
  const numAlign = alignPos.length;
  for (let i = 0; i < numAlign; i++) for (let j = 0; j < numAlign; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0)) continue;
    const cx = alignPos[i], cy = alignPos[j];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  // Reserve format/version areas as function modules (values set later).
  reserveFormatInfo(size, setFn);
  if (version >= 7) reserveVersionInfo(size, setFn);

  // Place data with a chosen mask; try all 8, keep the lowest penalty.
  let best: { grid: boolean[][]; penalty: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const grid = modules.map((r) => r.slice());
    placeCodewords(grid, isFunction, codewords, size);
    applyMask(grid, isFunction, mask, size);
    drawFormatBits(grid, ecl, mask, size);
    if (version >= 7) drawVersionBits(grid, version, size);
    const penalty = penaltyScore(grid, size);
    if (!best || penalty < best.penalty) best = { grid, penalty };
  }
  return best!.grid;
}

function alignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function reserveFormatInfo(size: number, setFn: (x: number, y: number, d: boolean) => void): void {
  for (let i = 0; i <= 8; i++) { if (i !== 6) { setFn(8, i, false); setFn(i, 8, false); } }
  for (let i = 0; i < 8; i++) { setFn(size - 1 - i, 8, false); setFn(8, size - 1 - i, false); }
  setFn(8, size - 8, true); // dark module
}
function reserveVersionInfo(size: number, setFn: (x: number, y: number, d: boolean) => void): void {
  for (let i = 0; i < 18; i++) {
    const a = size - 11 + (i % 3), b = Math.floor(i / 3);
    setFn(a, b, false); setFn(b, a, false);
  }
}

function placeCodewords(grid: boolean[][], isFunction: boolean[][], data: number[], size: number): void {
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < data.length * 8) {
          grid[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

function applyMask(grid: boolean[][], isFunction: boolean[][], mask: number, size: number): void {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (isFunction[y][x]) continue;
    let invert = false;
    switch (mask) {
      case 0: invert = (x + y) % 2 === 0; break;
      case 1: invert = y % 2 === 0; break;
      case 2: invert = x % 3 === 0; break;
      case 3: invert = (x + y) % 3 === 0; break;
      case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
      case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
      case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
      case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
    }
    if (invert) grid[y][x] = !grid[y][x];
  }
}

function drawFormatBits(grid: boolean[][], ecl: Ecc, mask: number, size: number): void {
  const data = (ecl.formatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const get = (i: number) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) grid[i][8] = get(i);
  grid[7][8] = get(6); grid[8][8] = get(7); grid[8][7] = get(8);
  for (let i = 9; i < 15; i++) grid[8][14 - i] = get(i);
  for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = get(i);
  for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = get(i);
  grid[size - 8][8] = true;
}

function drawVersionBits(grid: boolean[][], version: number, size: number): void {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3), b = Math.floor(i / 3);
    grid[b][a] = bit; grid[a][b] = bit;
  }
}

function penaltyScore(grid: boolean[][], size: number): number {
  let result = 0;
  // Rows and columns of same colour
  for (let y = 0; y < size; y++) {
    let runColor = false, runLen = 0;
    for (let x = 0; x < size; x++) {
      if (grid[y][x] === runColor) { runLen++; if (runLen === 5) result += 3; else if (runLen > 5) result++; }
      else { runColor = grid[y][x]; runLen = 1; }
    }
  }
  for (let x = 0; x < size; x++) {
    let runColor = false, runLen = 0;
    for (let y = 0; y < size; y++) {
      if (grid[y][x] === runColor) { runLen++; if (runLen === 5) result += 3; else if (runLen > 5) result++; }
      else { runColor = grid[y][x]; runLen = 1; }
    }
  }
  // 2x2 blocks
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = grid[y][x];
    if (c === grid[y][x + 1] && c === grid[y + 1][x] && c === grid[y + 1][x + 1]) result += 3;
  }
  // Dark ratio
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (grid[y][x]) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * 10;
  return result;
}

// Build a compact SVG string for the matrix (dark modules only).
export function qrSvg(text: string, opts?: { margin?: number; dark?: string; light?: string }): string {
  const m = qrMatrix(text, ECC.MEDIUM);
  const size = m.length;
  const margin = opts?.margin ?? 4;
  const dim = size + margin * 2;
  let path = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) path += `M${x + margin},${y + margin}h1v1h-1z`;
  }
  const light = opts?.light ?? "#ffffff";
  const dark = opts?.dark ?? "#000000";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" width="100%" height="100%"><rect width="${dim}" height="${dim}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
