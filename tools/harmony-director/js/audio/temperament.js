/**
 * Temperament calculations
 * Equal temperament and Just (Pure) intonation based on root
 */

// Just intonation ratios relative to root (major scale oriented + common adjustments)
// Based on common wind band / ensemble pure tuning practice
const JUST_RATIOS = {
  0: 1 / 1,          // Unison
  1: 16 / 15,        // minor 2nd
  2: 9 / 8,          // major 2nd
  3: 6 / 5,          // minor 3rd
  4: 5 / 4,          // major 3rd
  5: 4 / 3,          // perfect 4th
  6: 45 / 32,        // tritone (or 7/5)
  7: 3 / 2,          // perfect 5th
  8: 8 / 5,          // minor 6th
  9: 5 / 3,          // major 6th
  10: 9 / 5,         // minor 7th
  11: 15 / 8         // major 7th
};

/**
 * Convert MIDI note number to frequency
 * @param {number} midiNote - MIDI note (60 = middle C)
 * @param {number} refPitch - A4 reference in Hz
 * @param {string} temperament - 'equal' | 'pure'
 * @param {number} rootMidi - root note MIDI number for pure temperament
 * @returns {number} frequency in Hz
 */
export function midiToFreq(midiNote, refPitch = 440, temperament = 'equal', rootMidi = 60) {
  if (temperament === 'equal') {
    return refPitch * Math.pow(2, (midiNote - 69) / 12);
  }

  // Pure (Just) intonation
  // Find interval from nearest root in the same octave region
  const rootClass = ((rootMidi % 12) + 12) % 12;
  const noteClass = ((midiNote % 12) + 12) % 12;
  let interval = (noteClass - rootClass + 12) % 12;

  const ratio = JUST_RATIOS[interval] ?? Math.pow(2, interval / 12);

  // Base frequency of the root at the correct octave
  const rootOctaveNote = midiNote - interval;
  // Use equal temperament for the root itself, then apply pure ratios
  const rootFreq = refPitch * Math.pow(2, (rootOctaveNote - 69) / 12);

  return rootFreq * ratio;
}

/**
 * Detect chord root from currently held notes (simple heuristic)
 * Prefer lowest note or strongest pure fifth relationship
 */
export function detectRoot(activeMidiNotes) {
  if (!activeMidiNotes || activeMidiNotes.length === 0) return 60; // default C4
  const sorted = [...activeMidiNotes].sort((a, b) => a - b);
  return sorted[0]; // simplest: lowest note as root
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi) {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}
