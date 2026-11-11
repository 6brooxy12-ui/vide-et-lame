let ctx: AudioContext | null = null;

function ac() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Short steel whoosh — unlocked on the first gesture. */
export function playWhoosh(fast: boolean) {
  const audio = ac();
  const now = audio.currentTime;
  const dur = fast ? 0.28 : 0.42;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(fast ? 220 : 140, now);
  osc.frequency.exponentialRampToValueAtTime(fast ? 70 : 48, now + dur);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(280, now + dur);
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);

  const noise = audio.createBufferSource();
  const buffer = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  noise.buffer = buffer;
  const ng = audio.createGain();
  ng.gain.setValueAtTime(0.05, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(ng);
  ng.connect(audio.destination);
  noise.start(now);
}
