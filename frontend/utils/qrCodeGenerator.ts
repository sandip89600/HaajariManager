/**
 * Pure TypeScript QR Code (Model 2) Generator & Deep-link Payload Handler
 * Generates standards-compliant QR boolean matrix without external native dependencies.
 */

// Error correction levels: L=1, M=0, Q=3, H=2
export const QRErrorCorrectLevel = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
} as const;

export type QRErrorCorrectLevel =
  (typeof QRErrorCorrectLevel)[keyof typeof QRErrorCorrectLevel];

// Galois Field (256) & Polynomial tables for Reed-Solomon Error Correction
const QRMath = {
  EXP_TABLE: new Array(256),
  LOG_TABLE: new Array(256),

  glog(n: number) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return QRMath.LOG_TABLE[n];
  },

  gexp(n: number) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return QRMath.EXP_TABLE[n];
  },
};

for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
for (let i = 8; i < 256; i++) {
  QRMath.EXP_TABLE[i] =
    QRMath.EXP_TABLE[i - 4] ^
    QRMath.EXP_TABLE[i - 5] ^
    QRMath.EXP_TABLE[i - 6] ^
    QRMath.EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i++) {
  QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
}

class QRPolynomial {
  num: number[];
  constructor(num: number[], shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[offset + i];
    for (let i = num.length - offset; i < this.num.length; i++) this.num[i] = 0;
  }

  get(index: number) {
    return this.num[index];
  }

  getLength() {
    return this.num.length;
  }

  multiply(e: QRPolynomial) {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= QRMath.gexp(
          QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)),
        );
      }
    }
    return new QRPolynomial(num);
  }

  mod(e: QRPolynomial): QRPolynomial {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = new Array(this.getLength());
    for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num).mod(e);
  }
}

// RS Block Table by version & EC Level M
const RS_BLOCK_TABLE: number[][][] = [
  // Version 1-10 [totalCount, dataCount]
  [[1, 26, 19]], // V1-L: 19 data, 7 ec
  [[1, 44, 34]], // V2-L: 34 data, 10 ec
  [[1, 70, 55]], // V3-L: 55 data, 15 ec
  [[1, 100, 80]], // V4-L: 80 data, 20 ec
  [[1, 134, 108]], // V5-L: 108 data, 26 ec
  [[2, 86, 68]], // V6-L: 136 data
  [[2, 98, 78]], // V7-L: 156 data
  [[2, 121, 97]], // V8-L: 194 data
  [[2, 146, 116]], // V9-L: 232 data
  [[2, 174, 139]], // V10-L: 278 data
];

class QR8bitByte {
  mode = 4; // 8-bit byte mode
  data: string;
  parsedData: number[];

  constructor(data: string) {
    this.data = data;
    this.parsedData = [];
    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i);
      if (code > 0xff) {
        // UTF-8 encode
        this.parsedData.push(0xe0 | ((code >> 12) & 0x0f));
        this.parsedData.push(0x80 | ((code >> 6) & 0x3f));
        this.parsedData.push(0x80 | (code & 0x3f));
      } else {
        this.parsedData.push(code);
      }
    }
  }

  getLength() {
    return this.parsedData.length;
  }

  write(buffer: QRBitBuffer) {
    for (let i = 0; i < this.parsedData.length; i++) {
      buffer.put(this.parsedData[i], 8);
    }
  }
}

class QRBitBuffer {
  buffer: number[] = [];
  length = 0;

  get(index: number) {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  }

  put(num: number, length: number) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> this.length % 8;
    this.length++;
  }
}

function getErrorCorrectPolynomial(errorCorrectLength: number) {
  let a = new QRPolynomial([1], 0);
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
  }
  return a;
}

export class QRCodeModel {
  typeNumber: number;
  errorCorrectLevel: number;
  modules: (boolean | null)[][] = [];
  moduleCount = 0;
  dataList: QR8bitByte[] = [];

  constructor(typeNumber = 4, errorCorrectLevel = QRErrorCorrectLevel.L) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
  }

  addData(data: string) {
    this.dataList.push(new QR8bitByte(data));
  }

  isDark(row: number, col: number): boolean {
    if (
      row < 0 ||
      this.moduleCount <= row ||
      col < 0 ||
      this.moduleCount <= col
    ) {
      return false;
    }
    return !!this.modules[row][col];
  }

  getModuleCount() {
    return this.moduleCount;
  }

  make() {
    // Auto-select type number if needed
    let totalLen = 0;
    for (const d of this.dataList) totalLen += d.getLength();

    for (let t = 1; t <= 10; t++) {
      const capacity = RS_BLOCK_TABLE[t - 1][0][2];
      if (totalLen + 3 <= capacity) {
        this.typeNumber = t;
        break;
      }
    }

    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount).fill(null);
    }

    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(false, 0);
    this.mapData(this.createData(), 0);
  }

  private setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }

  private setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }

  private setupPositionAdjustPattern() {
    if (this.typeNumber < 2) return;
    const pos = this.typeNumber * 4 + 10;
    const pattern = [6, pos];
    for (let i = 0; i < pattern.length; i++) {
      for (let j = 0; j < pattern.length; j++) {
        const row = pattern[i];
        const col = pattern[j];
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (
              Math.abs(r) === 2 ||
              Math.abs(c) === 2 ||
              (r === 0 && c === 0)
            ) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }

  private setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (this.errorCorrectLevel << 3) | maskPattern;
    let bits = data << 10;
    while (QRCodeModel.getBCHTypeInfo(bits) >= 0) {
      bits ^= 0x537 << QRCodeModel.getBCHTypeInfo(bits);
    }
    const info = ((data << 10) | bits) ^ 0x5412;

    for (let i = 0; i < 15; i++) {
      const mod = !test && ((info >> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;

      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = !test;
  }

  private static getBCHTypeInfo(data: number) {
    let d = data >> 10;
    let bit = 0;
    while (d > 0) {
      bit++;
      d >>= 1;
    }
    return bit - 1;
  }

  private mapData(data: number[], maskPattern: number) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            const mask = (row + (col - c)) % 2 === 0;
            if (mask) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }

  private createData(): number[] {
    const buffer = new QRBitBuffer();
    for (const d of this.dataList) {
      buffer.put(d.mode, 4);
      buffer.put(d.getLength(), 8);
      d.write(buffer);
    }
    const rsBlock = RS_BLOCK_TABLE[this.typeNumber - 1][0];
    const totalDataCount = rsBlock[2];

    if (buffer.length + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.length % 8 !== 0) {
      buffer.putBit(false);
    }
    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }

    const dataBytes: number[] = [];
    for (let i = 0; i < totalDataCount; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        if (buffer.get(i * 8 + j)) b |= 0x80 >>> j;
      }
      dataBytes.push(b);
    }

    // Reed Solomon Error Correction
    const totalCount = rsBlock[1];
    const ecCount = totalCount - totalDataCount;
    const rsPoly = getErrorCorrectPolynomial(ecCount);
    const rawPoly = new QRPolynomial(dataBytes, rsPoly.getLength() - 1);
    const modPoly = rawPoly.mod(rsPoly);

    const ecBytes: number[] = new Array(rsPoly.getLength() - 1);
    for (let i = 0; i < ecBytes.length; i++) {
      const modIndex = i + modPoly.getLength() - ecBytes.length;
      ecBytes[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }

    return [...dataBytes, ...ecBytes];
  }
}

/**
 * Generate 2D boolean grid for text
 */
export function generateQrMatrix(text: string): boolean[][] {
  const qr = new QRCodeModel(4, QRErrorCorrectLevel.L);
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let r = 0; r < count; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < count; c++) {
      row.push(qr.isDark(r, c));
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Creates standard opaque deep link for QR Code
 * Format: haajari://connect?id=<uniqueId>&role=<role>&name=<name>
 */
export function buildConnectPayload(
  uniqueId: string,
  role: string,
  name?: string,
): string {
  const params = new URLSearchParams();
  params.set("id", (uniqueId || "").trim().toUpperCase());
  params.set("role", (role || "worker").trim().toLowerCase());
  if (name) params.set("name", name.trim());
  return `haajari://connect?${params.toString()}`;
}

/**
 * Parses scanned QR code payload or raw unique ID string
 */
export function parseConnectPayload(payload: string): {
  uniqueId: string;
  role?: string;
  name?: string;
} | null {
  if (!payload || typeof payload !== "string") return null;
  const trimmed = payload.trim();

  // 1. Check deep link format
  if (
    trimmed.startsWith("haajari://connect?") ||
    trimmed.startsWith("haajari://connect")
  ) {
    try {
      const urlParts = trimmed.split("?");
      if (urlParts.length > 1) {
        const queryParams = new URLSearchParams(urlParts[1]);
        const id = queryParams.get("id");
        if (id) {
          return {
            uniqueId: id.trim().toUpperCase(),
            role: queryParams.get("role") || undefined,
            name: queryParams.get("name") || undefined,
          };
        }
      }
    } catch {}
  }

  // 2. Direct Unique ID format (e.g. "HJR-W-1049" or alphanumeric)
  const cleanId = trimmed.replace(/^#/, "").toUpperCase();
  if (cleanId.length >= 3) {
    return { uniqueId: cleanId };
  }

  return null;
}
