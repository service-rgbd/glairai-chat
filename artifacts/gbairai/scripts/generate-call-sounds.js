#!/usr/bin/env node
/**
 * Régénère les sonneries d'appel dans assets/sounds/.
 * Remplacez les WAV par vos propres fichiers si besoin (même noms).
 */
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "../assets/sounds");

function writeWav(file, samples, sampleRate = 44100) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, samples[i])), 44 + i * 2);
  }
  fs.writeFileSync(path.join(outDir, file), buffer);
}

function dualTone(sampleRate, t, f1, f2, volume = 0.18) {
  const a = Math.sin(2 * Math.PI * f1 * t) * (volume / 2) * 32767;
  const b = Math.sin(2 * Math.PI * f2 * t) * (volume / 2) * 32767;
  return a + b;
}

function renderPattern(sampleRate, durationSec, fn) {
  const total = Math.floor(sampleRate * durationSec);
  const out = new Int16Array(total);
  for (let i = 0; i < total; i++) out[i] = fn(i / sampleRate, i);
  return out;
}

fs.mkdirSync(outDir, { recursive: true });

writeWav(
  "incoming.wav",
  renderPattern(44100, 4.2, (t) => {
    const cycle = t % 4.2;
    const inBurst =
      cycle < 0.9 || (cycle >= 1.2 && cycle < 2.1) || (cycle >= 2.4 && cycle < 3.3);
    return inBurst ? dualTone(44100, t, 440, 480) : 0;
  }),
);

writeWav(
  "ringback.wav",
  renderPattern(44100, 6, (t) => {
    const cycle = t % 3;
    return cycle < 1.05 ? dualTone(44100, t, 425, 475, 0.16) : 0;
  }),
);

writeWav(
  "connect.wav",
  renderPattern(44100, 0.35, (t) => dualTone(44100, t, 880, 1175, 0.12 * Math.exp(-t * 8))),
);

writeWav(
  "end.wav",
  renderPattern(44100, 0.55, (t) => dualTone(44100, t, 350, 280, 0.14 * Math.exp(-t * 5))),
);

console.log("Sonneries régénérées dans", outDir);
