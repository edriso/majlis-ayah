/* A soft tone for a turn that passes on its own: a timed turn running out,
   or a seated reciter finishing. Nobody touched the screen, and whoever
   reads next may be looking at the page, not at it.

   Made with Web Audio rather than played on the recitations' element, so
   it never cuts a recitation short. Like that element, a phone lets it
   sound only once a tap has woken it, which `wakeChime()` does from the
   same taps that prime the player. */

let context: AudioContext | null = null;

export function wakeChime() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    // No Web Audio: the turn passes in silence, as it did before.
  }
}

/** Two low notes, a fourth apart, each fading as it rings. Silent if
    nothing has woken the sound yet. */
export function chime() {
  if (!context) return;
  if (context.state === 'running') ring(context);
  else
    context.resume().then(
      () => context && ring(context),
      () => {},
    );
}

function ring(audio: AudioContext) {
  const start = audio.currentTime + 0.02;
  [523.25, 698.46].forEach((frequency, i) => {
    const at = start + i * 0.16;
    const tone = audio.createOscillator();
    const level = audio.createGain();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(0.12, at + 0.02);
    level.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    tone.connect(level).connect(audio.destination);
    tone.start(at);
    tone.stop(at + 0.95);
  });
}
