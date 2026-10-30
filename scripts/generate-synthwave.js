const fs = require('fs');
const path = require('path');

function createWavBuffer(sampleRate, durationSeconds, generateSample) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const dataByteLength = totalSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataByteLength);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataByteLength, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = generateSample(t, i, totalSamples, sampleRate);

    const clamp = (val) => Math.max(-1, Math.min(1, val));
    const intLeft = Math.floor(clamp(left) * 32767);
    const intRight = Math.floor(clamp(right) * 32767);

    buffer.writeInt16LE(intLeft, offset);
    buffer.writeInt16LE(intRight, offset + 2);
    offset += 4;
  }

  return buffer;
}

// Track 1: NEON DRIFT (120 BPM Synthwave Arp + Bass + Drums)
function generateNeonDrift(t, i, totalSamples, sampleRate) {
  const bpm = 120;
  const beat = (t * bpm) / 60;
  const sixteenth = beat * 4;

  // Chord progression: Cm -> Ab -> Bb -> Gm
  const bar = Math.floor(beat / 4) % 4;
  let rootFreq = 130.81; // C3
  let chordPitches = [130.81, 155.56, 196.0, 261.63]; // Cm
  if (bar === 1) chordPitches = [103.83, 130.81, 155.56, 207.65]; // Ab
  if (bar === 2) chordPitches = [116.54, 146.83, 174.61, 233.08]; // Bb
  if (bar === 3) chordPitches = [98.0, 116.54, 146.83, 196.0]; // Gm

  // 1. Kick drum (every quarter note: 0, 1, 2, 3)
  const beatFrac = beat % 1;
  let kick = 0;
  if (beatFrac < 0.25) {
    const kEnv = Math.exp(-beatFrac * 22);
    const kFreq = 45 + 130 * Math.exp(-beatFrac * 35);
    kick = Math.sin(2 * Math.PI * kFreq * beatFrac) * kEnv * 0.55;
  }

  // 2. Snare / Clapper on beats 1 and 3 (0-indexed: beat 1 and 3)
  const snareFrac = (beat + 1) % 2;
  let snare = 0;
  if (snareFrac < 0.22) {
    const sEnv = Math.exp(-snareFrac * 16);
    const noise = (Math.random() * 2 - 1) * sEnv * 0.28;
    const tone = Math.sin(2 * Math.PI * 180 * snareFrac) * sEnv * 0.15;
    snare = noise + tone;
  }

  // 3. Hi-hat on every 8th note offbeat
  const hatFrac = (beat * 2) % 1;
  let hat = 0;
  if (hatFrac < 0.08) {
    const hEnv = Math.exp(-hatFrac * 50);
    hat = (Math.random() * 2 - 1) * hEnv * 0.12;
  }

  // 4. Synthwave rolling bass (16th notes)
  const stepInBar = Math.floor(sixteenth) % 16;
  const sixteenthFrac = sixteenth % 1;
  const bEnv = Math.exp(-sixteenthFrac * 7);
  const bassFreq = chordPitches[0] * 0.5; // sub-octave
  const bass = (Math.sin(2 * Math.PI * bassFreq * t) +
                0.5 * Math.sin(4 * Math.PI * bassFreq * t)) * bEnv * 0.32;

  // 5. 16th Arpeggio Lead
  const arpIndex = Math.floor(sixteenth) % chordPitches.length;
  const arpFreq = chordPitches[arpIndex] * 2;
  const arpEnv = Math.exp(-sixteenthFrac * 9);
  const arp = Math.sin(2 * Math.PI * arpFreq * t) * arpEnv * 0.22;

  // 6. Warm Pad Chord
  let pad = 0;
  for (let p of chordPitches) {
    pad += Math.sin(2 * Math.PI * p * t * 1.002) + Math.sin(2 * Math.PI * p * t * 0.998);
  }
  pad *= 0.035;

  const mono = kick + snare + hat + bass + arp + pad;
  // Subtle stereo spread
  const left = mono + arp * 0.08 - pad * 0.03;
  const right = mono - arp * 0.08 + pad * 0.03;

  return [left, right];
}

// Track 2: MIDNIGHT PROTOCOL (110 BPM Darksynth / Cyberpunk Pulse)
function generateMidnightProtocol(t, i, totalSamples, sampleRate) {
  const bpm = 110;
  const beat = (t * bpm) / 60;
  const sixteenth = beat * 4;

  // D minor / F / C / A# progression
  const bar = Math.floor(beat / 4) % 4;
  let root = 146.83; // D3
  if (bar === 1) root = 174.61; // F3
  if (bar === 2) root = 130.81; // C3
  if (bar === 3) root = 116.54; // A#2

  // Kick
  const beatFrac = beat % 1;
  let kick = 0;
  if (beatFrac < 0.3) {
    const kEnv = Math.exp(-beatFrac * 18);
    const kFreq = 42 + 150 * Math.exp(-beatFrac * 40);
    kick = Math.sin(2 * Math.PI * kFreq * beatFrac) * kEnv * 0.6;
  }

  // Heavy Snare on beats 2 & 4
  const snareFrac = (beat + 1) % 2;
  let snare = 0;
  if (snareFrac < 0.28) {
    const sEnv = Math.exp(-snareFrac * 12);
    const noise = (Math.random() * 2 - 1) * sEnv * 0.32;
    const body = Math.sin(2 * Math.PI * 220 * snareFrac) * sEnv * 0.2;
    snare = noise + body;
  }

  // Sawtooth bass with filter sweep
  const sixteenthFrac = sixteenth % 1;
  const bEnv = Math.exp(-sixteenthFrac * 8);
  const sawBass = ((2 * (t * root % 1) - 1) + 0.5 * (2 * (t * root * 2 % 1) - 1)) * bEnv * 0.28;

  // Resonant lead stab
  const stabStep = Math.floor(sixteenth) % 16;
  let stab = 0;
  if (stabStep === 0 || stabStep === 6 || stabStep === 10 || stabStep === 14) {
    const sEnv2 = Math.exp(-sixteenthFrac * 10);
    const sFreq = root * 3;
    stab = Math.sin(2 * Math.PI * sFreq * t) * sEnv2 * 0.25;
  }

  // Cyber bell shimmer
  const bell = Math.sin(2 * Math.PI * 880 * t) * Math.sin(2 * Math.PI * 1320 * t) * 0.05;

  const left = kick + snare + sawBass * 0.9 + stab * 1.1 + bell;
  const right = kick + snare + sawBass * 1.1 + stab * 0.9 - bell;

  return [left * 0.9, right * 0.9];
}

// Track 3: CRYSTALLINE GRID (100 BPM Chillwave Ambient Shimmer)
function generateCrystallineGrid(t, i, totalSamples, sampleRate) {
  const bpm = 100;
  const beat = (t * bpm) / 60;

  // Am -> F -> C -> G
  const bar = Math.floor(beat / 4) % 4;
  let chord = [220.0, 261.63, 329.63, 392.0]; // Am7
  if (bar === 1) chord = [174.61, 220.0, 261.63, 329.63]; // Fmaj7
  if (bar === 2) chord = [130.81, 164.81, 196.0, 246.94]; // Cmaj7
  if (bar === 3) chord = [196.0, 246.94, 293.66, 349.23]; // G7

  // Soft deep kick on beats 0 and 2.5
  const b0 = beat % 2;
  let kick = 0;
  if (b0 < 0.3) {
    const kEnv = Math.exp(-b0 * 15);
    kick = Math.sin(2 * Math.PI * 50 * b0) * kEnv * 0.45;
  }

  // Ambient lush chords
  let padL = 0;
  let padR = 0;
  chord.forEach((freq, idx) => {
    const lfo = Math.sin(2 * Math.PI * 0.2 * t + idx);
    padL += Math.sin(2 * Math.PI * freq * (1 + lfo * 0.005) * t);
    padR += Math.sin(2 * Math.PI * freq * (1 - lfo * 0.005) * t);
  });
  padL *= 0.07;
  padR *= 0.07;

  // Crystalline bell arpeggio
  const eighth = beat * 2;
  const eIdx = Math.floor(eighth) % chord.length;
  const eFrac = eighth % 1;
  const bellEnv = Math.exp(-eFrac * 6);
  const bellFreq = chord[eIdx] * 4;
  const bell = Math.sin(2 * Math.PI * bellFreq * t) * bellEnv * 0.16;

  // Sub bass
  const sub = Math.sin(2 * Math.PI * (chord[0] * 0.5) * t) * 0.3;

  return [kick + padL + bell * 0.8 + sub, kick + padR + bell * 1.2 + sub];
}

console.log('Generating synthwave sample audio files...');

const sampleRate = 44100;
const durationSeconds = 30; // 30 seconds seamless loop

const tracks = [
  { name: 'neon-drift.wav', gen: generateNeonDrift },
  { name: 'midnight-protocol.wav', gen: generateMidnightProtocol },
  { name: 'crystalline-grid.wav', gen: generateCrystallineGrid },
];

const audioDir = path.join(__dirname, '..', 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

for (const t of tracks) {
  const filePath = path.join(audioDir, t.name);
  console.log(`Writing ${t.name}...`);
  const buf = createWavBuffer(sampleRate, durationSeconds, t.gen);
  fs.writeFileSync(filePath, buf);
  console.log(`Done! ${t.name} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
}

console.log('All sample audio files generated successfully.');

