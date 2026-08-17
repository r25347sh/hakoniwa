(() => {
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  let ctx = null;
  let droneOsc = null;
  let droneGain = null;
  let droneOn = false;
  let micOn = false;
  let hold = false;
  let heldCents = 0;
  let targetMidi = 69;
  let refHz = 440;
  let analyser = null;
  let micStream = null;
  let raf = 0;

  const $ = id => document.getElementById(id);

  function midiToFreq(m) {
    return refHz * Math.pow(2, (m - 69) / 12);
  }
  function freqToMidi(f) {
    return 69 + 12 * Math.log2(f / refHz);
  }
  function noteName(m) {
    const n = Math.round(m);
    return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
  }

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function updateTargetUI() {
    $('target-note').textContent = noteName(targetMidi);
    $('target-freq').textContent = midiToFreq(targetMidi).toFixed(1) + ' Hz';
    $('semi').textContent = targetMidi - 69;
  }

  function setNeedle(cents) {
    const clamped = Math.max(-50, Math.min(50, cents));
    const pct = 50 + (clamped / 50) * 50;
    $('needle').style.left = pct + '%';
    const el = $('cents');
    el.textContent = (cents >= 0 ? '+' : '') + cents.toFixed(1) + ' cent';
    el.style.color = Math.abs(cents) < 5 ? 'var(--good)' : Math.abs(cents) < 15 ? 'var(--warn)' : 'var(--bad)';
  }

  function startDrone() {
    ensureCtx();
    stopDrone();
    droneOsc = ctx.createOscillator();
    droneGain = ctx.createGain();
    droneOsc.type = $('wave').value;
    droneOsc.frequency.value = midiToFreq(targetMidi);
    droneGain.gain.value = 0.15;
    droneOsc.connect(droneGain);
    droneGain.connect(ctx.destination);
    droneOsc.start();
    droneOn = true;
    $('btn-drone').classList.add('active');
    $('status').textContent = 'DRONE';
  }

  function stopDrone() {
    if (droneOsc) {
      try { droneOsc.stop(); } catch (_) {}
      droneOsc.disconnect();
      droneOsc = null;
    }
    if (droneGain) { droneGain.disconnect(); droneGain = null; }
    droneOn = false;
    $('btn-drone').classList.remove('active');
  }

  // Simple autocorrelation pitch detection
  function detectPitch(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    const buf2 = buf.slice(r1, r2);
    const c = new Float32Array(buf2.length).fill(0);
    for (let i = 0; i < buf2.length; i++) {
      for (let j = 0; j < buf2.length - i; j++) c[i] += buf2[j] * buf2[j + i];
    }
    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < buf2.length; i++) {
      if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    let T0 = maxpos;
    const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    return sampleRate / T0;
  }

  function micLoop() {
    if (!micOn || !analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    const freq = detectPitch(buf, ctx.sampleRate);
    if (freq > 50 && freq < 2000) {
      const midi = freqToMidi(freq);
      const targetF = midiToFreq(targetMidi);
      const cents = 1200 * Math.log2(freq / targetF);
      if (!hold) {
        heldCents = cents;
        $('input-note').textContent = noteName(midi);
        $('input-freq').textContent = freq.toFixed(1) + ' Hz';
        setNeedle(cents);
      }
    } else if (!hold) {
      $('input-note').textContent = '—';
      $('input-freq').textContent = '— Hz';
    }
    raf = requestAnimationFrame(micLoop);
  }

  async function toggleMic() {
    if (micOn) {
      micOn = false;
      cancelAnimationFrame(raf);
      micStream?.getTracks().forEach(t => t.stop());
      micStream = null;
      $('btn-mic').classList.remove('active');
      $('btn-mic').textContent = '🎤 MIC ON';
      $('status').textContent = droneOn ? 'DRONE' : 'READY';
      return;
    }
    try {
      ensureCtx();
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      const src = ctx.createMediaStreamSource(micStream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      micOn = true;
      $('btn-mic').classList.add('active');
      $('btn-mic').textContent = '🎤 MIC OFF';
      $('status').textContent = 'LISTENING';
      micLoop();
    } catch {
      $('status').textContent = 'MIC DENY';
    }
  }

  // Bind
  $('btn-drone').onclick = () => {
    if (droneOn) { stopDrone(); $('status').textContent = micOn ? 'LISTENING' : 'READY'; }
    else startDrone();
  };
  $('btn-mic').onclick = toggleMic;
  $('btn-hold').onclick = e => {
    hold = !hold;
    e.currentTarget.classList.toggle('active', hold);
    if (hold) setNeedle(heldCents);
  };
  $('ref').oninput = e => {
    refHz = e.target.value / 10;
    $('ref-val').textContent = refHz.toFixed(1);
    updateTargetUI();
    if (droneOn && droneOsc) droneOsc.frequency.value = midiToFreq(targetMidi);
  };
  $('btn-down').onclick = () => { targetMidi--; updateTargetUI(); if (droneOn && droneOsc) droneOsc.frequency.value = midiToFreq(targetMidi); };
  $('btn-up').onclick = () => { targetMidi++; updateTargetUI(); if (droneOn && droneOsc) droneOsc.frequency.value = midiToFreq(targetMidi); };
  $('btn-oct-down').onclick = () => { targetMidi -= 12; updateTargetUI(); if (droneOn && droneOsc) droneOsc.frequency.value = midiToFreq(targetMidi); };
  $('btn-oct-up').onclick = () => { targetMidi += 12; updateTargetUI(); if (droneOn && droneOsc) droneOsc.frequency.value = midiToFreq(targetMidi); };
  $('btn-ref').onclick = () => { targetMidi = 60; updateTargetUI(); if (droneOn && droneOsc) droneOsc.frequency.value = midiToFreq(targetMidi); };
  $('btn-a').onclick = $('btn-concert').onclick = () => { targetMidi = 69; updateTargetUI(); if (droneOn && droneOsc) droneOsc.frequency.value = midiToFreq(targetMidi); };
  $('wave').onchange = () => { if (droneOn) startDrone(); };

  updateTargetUI();
  setNeedle(0);
})();
