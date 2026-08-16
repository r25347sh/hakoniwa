/**
 * Temperament calculations
 * Equal / Pure Major / Pure Minor / Individual
 */

// Just intonation ratios for Major (relative to root)
const JUST_MAJOR = {
  0: 1/1, 1: 16/15, 2: 9/8, 3: 6/5, 4: 5/4,
  5: 4/3, 6: 45/32, 7: 3/2, 8: 8/5, 9: 5/3,
  10: 9/5, 11: 15/8
};

// Pure Minor (natural minor oriented)
const JUST_MINOR = {
  0: 1/1, 1: 16/15, 2: 9/8, 3: 6/5, 4: 5/4,
  5: 4/3, 6: 64/45, 7: 3/2, 8: 8/5, 9: 5/3,
  10: 9/5, 11: 15/8
};

export function midiToFreq(midiNote, refPitch = 440, temperament = 'equal', rootMidi = 60, individualCents = null) {
  const a4 = refPitch;

  if (temperament === 'equal') {
    return a4 * Math.pow(2, (midiNote - 69) / 12);
  }

  if (temperament === 'individual' && individualCents) {
    const base = a4 * Math.pow(2, (midiNote - 69) / 12);
    const pc = ((midiNote % 12) + 12) % 12;
    const cents = individualCents[pc] || 0;
    return base * Math.pow(2, cents / 1200);
  }

  // Pure Major / Pure Minor
  const ratios = temperament === 'pure-minor' ? JUST_MINOR : JUST_MAJOR;
  const rootClass = ((rootMidi % 12) + 12) % 12;
  const noteClass = ((midiNote % 12) + 12) % 12;
  const interval = (noteClass - rootClass + 12) % 12;
  const ratio = ratios[interval] ?? Math.pow(2, interval / 12);

  // Root frequency in equal, then scale by pure ratio
  const rootOctaveNote = midiNote - interval;
  const rootFreq = a4 * Math.pow(2, (rootOctaveNote - 69) / 12);
  return rootFreq * ratio;
}

export function detectRoot(activeMidiNotes) {
  if (!activeMidiNotes || activeMidiNotes.length === 0) return 60;
  const sorted = [...activeMidiNotes].sort((a, b) => a - b);
  return sorted[0];
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi) {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function pitchClassName(pc) {
  return NOTE_NAMES[((pc % 12) + 12) % 12];
}
