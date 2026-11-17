#!/usr/bin/env node
// Auto-create reproducible *synthetic* WAV/MP3 fixtures only when they are
// absent. They are intentionally ignored by Git; a fresh clone must still
// pass `npm test` without requiring an undocumented manual setup step.
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root = new URL('../tests/fixtures/polyphony/', import.meta.url);
const files = [
  'four_note_chord', 'six_note_chord', 'eight_note_chord',
  'strong_harmonics', 'four_c4_repeats', 'e2_g2_a2_e2_bass',
  'melody_after_350ms_silence', 'heldout_staggered_six_instruments',
  'heldout_dense_chord'
];
const missing = files.flatMap(name => ['wav', 'mp3'].filter(ext =>
  !existsSync(new URL(`${name}.${ext}`, root))).map(ext => `${name}.${ext}`));
if (missing.length) {
  console.log(`Generating ${missing.length} missing synthetic audio fixtures...`);
  try {
    execFileSync(process.execPath, ['tests/create-polyphony-fixtures.mjs'], {
      cwd: new URL('../', import.meta.url), stdio: 'inherit', timeout: 120000
    });
  } catch (error) {
    console.error('Cannot generate test audio. Install FFmpeg with libmp3lame and try again.');
    process.exit(error.status || 1);
  }
}
const stillMissing = files.flatMap(name => ['wav','mp3'].filter(ext =>
  !existsSync(new URL(`${name}.${ext}`, root))).map(ext => `${name}.${ext}`));
if (stillMissing.length) {
  throw Error(`Missing generated test fixtures: ${stillMissing.join(', ')}`);
}
