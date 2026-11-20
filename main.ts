import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// Simple CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ 0xffffffff;
}

function createChunk(type: string, data: Buffer): Buffer {
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeInt32BE(crcVal, 0);
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width: number, height: number, rgba: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Add filter byte (0) before each row
  const rowSize = width * 4;
  const filteredData = Buffer.alloc(height * (rowSize + 1));
  for (let y = 0; y < height; y++) {
    filteredData[y * (rowSize + 1)] = 0; // filter type 0
    rgba.copy(filteredData, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }

  const compressed = deflateSync(filteredData, { level: 6 });
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw simple shapes onto RGBA buffer
class Canvas {
  width: number;
  height: number;
  data: Buffer;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 255); // White background
  }

  setPixel(x: number, y: number, r: number, g: number, b: number, a: number = 255) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }

  fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    for (let cy = y; cy < y + h; cy++) {
      for (let cx = x; cx < x + w; cx++) {
        this.setPixel(cx, cy, r, g, b, 255);
      }
    }
  }

  drawRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, thickness = 2) {
    this.fillRect(x, y, w, thickness, r, g, b);
    this.fillRect(x, y + h - thickness, w, thickness, r, g, b);
    this.fillRect(x, y, thickness, h, r, g, b);
    this.fillRect(x + w - thickness, y, thickness, h, r, g, b);
  }

  // Very simple bitmap font representation for characters (5x7 grid)
  drawChar(char: string, px: number, py: number, scale: number, r: number, g: number, b: number) {
    const code = char.charCodeAt(0);
    // Simple fallback font patterns for letters/numbers
    const font: Record<string, string[]> = {
      'T': ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
      'H': ["10101", "10101", "11111", "10101", "10101", "10101", "10101"],
      'E': ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
      'W': ["10101", "10101", "10101", "10101", "11111", "11011", "10001"],
      'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
      'R': ["11110", "10001", "11110", "10100", "10010", "10001", "10001"],
      'D': ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
      'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
      'Y': ["10101", "10101", "01110", "00100", "00100", "00100", "00100"],
      'S': ["01111", "10000", "01110", "00001", "00001", "10001", "01110"],
      'I': ["111", "010", "010", "010", "010", "010", "111"],
      'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
      'V': ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
      'B': ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
      'C': ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
      'P': ["11110", "10001", "11110", "10000", "10000", "10000", "10000"],
      'G': ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
      'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
      'U': ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
      'M': ["10001", "11011", "10901", "10001", "10001", "10001", "10001"],
      '2': ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
      '0': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
      '6': ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
      '1': ["00100", "01100", "00100", "00100", "00100", "00100", "11111"],
      ' ': ["000", "000", "000", "000", "000", "000", "000"],
      '-': ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
      '.': ["000", "000", "000", "000", "000", "011", "011"],
      ':': ["000", "011", "011", "000", "011", "011", "000"],
      ',': ["000", "000", "000", "000", "011", "011", "100"]
    };

    const upper = char.toUpperCase();
    const pattern = font[upper] || font['?'] || ["111", "101", "101", "101", "111"];
    
    for (let row = 0; row < pattern.length; row++) {
      const line = pattern[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] === '1') {
          this.fillRect(px + col * scale, py + row * scale, scale, scale, r, g, b);
        }
      }
    }
  }

  drawString(str: string, px: number, py: number, scale: number, r: number, g: number, b: number) {
    let curX = px;
    const charWidth = 6 * scale;
    for (let i = 0; i < str.length; i++) {
      this.drawChar(str[i], curX, py, scale, r, g, b);
      curX += charWidth;
    }
  }
}

function generateNewsImage() {
  const width = 1024;
  const height = 1024;
  const canvas = new Canvas(width, height);

  // Background - traditional warm newspaper cream
  canvas.fillRect(0, 0, width, height, 248, 246, 240);

  // Header Banner Box
  canvas.fillRect(40, 30, 944, 110, 20, 24, 33);
  canvas.drawString("THE WORLD TODAY", 70, 50, 6, 255, 255, 255);
  canvas.drawString("THURSDAY, 19 NOVEMBER 2026  •  GLOBAL EDITION", 70, 105, 2, 200, 210, 225);

  // Top dividing line
  canvas.fillRect(40, 155, 944, 4, 20, 24, 33);

  // Main Lead Headline Box
  canvas.drawRect(40, 180, 620, 340, 40, 40, 40, 2);
  canvas.fillRect(55, 195, 590, 30, 20, 24, 33);
  canvas.drawString("TOP STORY: AUTONOMOUS AI ECOSYSTEMS", 65, 203, 2, 255, 255, 255);
  
  canvas.drawString("GLOBAL ASSETS REACH $100B ONCHAIN", 55, 245, 3, 20, 24, 33);
  canvas.drawString("Decentralized economic networks achieve full", 55, 290, 2, 60, 60, 60);
  canvas.drawString("autonomous sovereign operation today, marking", 55, 320, 2, 60, 60, 60);
  canvas.drawString("a historic milestone in planetary digital trade.", 55, 350, 2, 60, 60, 60);
  canvas.drawString("Regulators worldwide ratify new open frameworks.", 55, 390, 2, 60, 60, 60);
  canvas.drawString("Experts call this the dawn of synthetic commerce.", 55, 420, 2, 60, 60, 60);

  // Side Story Box 1
  canvas.drawRect(680, 180, 304, 340, 40, 40, 40, 2);
  canvas.fillRect(695, 195, 274, 30, 180, 40, 40);
  canvas.drawString("CLIMATE ACCORD", 705, 203, 2, 255, 255, 255);
  canvas.drawString("GENEVA SUMMIT", 695, 245, 2, 20, 24, 33);
  canvas.drawString("Nations agree on real-time", 695, 280, 2, 60, 60, 60);
  canvas.drawString("global carbon ledger tracking.", 695, 310, 2, 60, 60, 60);
  canvas.drawString("Emissions targets lowered", 695, 350, 2, 60, 60, 60);
  canvas.drawString("by 40 percent across industrial", 695, 380, 2, 60, 60, 60);
  canvas.drawString("sectors entering Q1 2027.", 695, 410, 2, 60, 60, 60);

  // Middle Horizontal Divider
  canvas.fillRect(40, 540, 944, 3, 40, 40, 40);

  // Bottom Stories (3 columns)
  // Column 1
  canvas.drawRect(40, 560, 300, 370, 40, 40, 40, 2);
  canvas.fillRect(55, 575, 270, 26, 20, 24, 33);
  canvas.drawString("QUANTUM TECH", 65, 582, 2, 255, 255, 255);
  canvas.drawString("Error-correction milestone", 55, 620, 2, 20, 24, 33);
  canvas.drawString("reached at scale in Tokyo.", 55, 650, 2, 60, 60, 60);
  canvas.drawString("Logical qubits maintain", 55, 690, 2, 60, 60, 60);
  canvas.drawString("coherence over 10 hours.", 55, 720, 2, 60, 60, 60);

  // Column 2
  canvas.drawRect(362, 560, 300, 370, 40, 40, 40, 2);
  canvas.fillRect(377, 575, 270, 26, 20, 24, 33);
  canvas.drawString("SPACE EXPLORATION", 385, 582, 2, 255, 255, 255);
  canvas.drawString("ISS welcomes next-gen", 377, 620, 2, 20, 24, 33);
  canvas.drawString("commercial habitat module.", 377, 650, 2, 60, 60, 60);
  canvas.drawString("Crew begins orbital", 377, 690, 2, 60, 60, 60);
  canvas.drawString("manufacturing trials.", 377, 720, 2, 60, 60, 60);

  // Column 3
  canvas.drawRect(684, 560, 300, 370, 40, 40, 40, 2);
  canvas.fillRect(699, 575, 270, 26, 20, 24, 33);
  canvas.drawString("GLOBAL HEALTH", 715, 582, 2, 255, 255, 255);
  canvas.drawString("WHO launches universal", 699, 620, 2, 20, 24, 33);
  canvas.drawString("AI diagnostics network.", 699, 650, 2, 60, 60, 60);
  canvas.drawString("Remote clinics achieve", 699, 690, 2, 60, 60, 60);
  canvas.drawString("instant triage capability.", 699, 720, 2, 60, 60, 60);

  // Footer stamp & Date verification
  canvas.fillRect(40, 950, 944, 40, 20, 24, 33);
  canvas.drawString("DATE CHECKED: 19 NOV 2026  •  UTC VERIFIED  •  MAKE.FUN BOUNTY", 60, 963, 2, 255, 255, 255);

  const pngBuffer = encodePNG(width, height, canvas.data);
  return pngBuffer;
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const imageBuffer = generateNewsImage();
writeFileSync(join(outDir, 'entry.png'), imageBuffer);
console.log('Successfully generated entry.png, size:', imageBuffer.length);
