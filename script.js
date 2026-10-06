(() => {
  const cfg = window.ZENTARA_CONFIG;
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const rand = (n) => Math.floor(Math.random() * n);
  const between = (a, b) => a + Math.random() * (b - a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GLYPHS = "ΛΞΠΣΨΩ#%&@?/\\<>01▓▒░█";
  const glyph = () => GLYPHS[rand(GLYPHS.length)];

  // ── Target time ──────────────────────────────────
  // Testing: add ?t=15 to the URL to reveal in 15 seconds.
  const params = new URLSearchParams(location.search);
  let target = new Date(cfg.revealAt).getTime();
  if (params.has("t")) target = Date.now() + Number(params.get("t")) * 1000;

  // Use the server's clock if available so people can't skip ahead
  // by changing their phone's time.
  let clockOffset = 0;
  const now = () => Date.now() + clockOffset;
  if (!params.has("t")) {
    fetch(location.href, { method: "HEAD", cache: "no-store" })
      .then((r) => {
        const d = r.headers.get("Date");
        if (d) clockOffset = new Date(d).getTime() - Date.now();
      })
      .catch(() => {});
  }

  // ── Text that emerges letter by letter ───────────
  function emerge(el, text, { stagger = 90, delay = 0 } = {}) {
    el.textContent = "";
    el.setAttribute("aria-label", text);
    el.dataset.text = text;
    let i = 0;
    text.split(" ").forEach((w, wi) => {
      if (wi > 0) el.appendChild(document.createTextNode(" "));
      const word = document.createElement("span");
      word.className = "word";
      word.setAttribute("aria-hidden", "true");
      for (const ch of w) {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = ch;
        s.style.animationDelay = `${delay + i++ * stagger}ms`;
        word.appendChild(s);
      }
      el.appendChild(word);
    });
  }

  // Scrambled glyphs that resolve into the text
  function decode(el, text, speed = 38) {
    return new Promise((resolve) => {
      let frame = 0;
      const total = text.length * 2 + 10;
      const id = setInterval(() => {
        el.textContent = [...text]
          .map((ch, i) => (ch === " " ? " " : frame > i * 2 + 6 ? ch : glyph()))
          .join("");
        if (++frame > total) {
          clearInterval(id);
          el.textContent = text;
          resolve();
        }
      }, speed);
    });
  }

  const titleEl = $("title");
  $("tagline").textContent = cfg.tagline || "";
  emerge(titleEl, cfg.codename, { stagger: 110, delay: 700 });

  // Whispers decode in, then fade out
  const whisperEl = $("whisper");
  let wi = rand(cfg.whispers.length);
  let whisperOut;
  function nextWhisper() {
    whisperEl.classList.remove("out");
    decode(whisperEl, cfg.whispers[wi++ % cfg.whispers.length]);
    whisperOut = setTimeout(() => whisperEl.classList.add("out"), 5200);
  }
  let whisperTimer;
  const whisperStart = setTimeout(() => {
    nextWhisper();
    whisperTimer = setInterval(nextWhisper, 6800);
  }, 3800);

  // ── Countdown ────────────────────────────────────
  const els = { d: $("d"), h: $("h"), m: $("m"), s: $("s") };
  const finalEl = $("final");
  const pad = (n) => String(n).padStart(2, "0");
  let revealed = false;

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function setNum(el, val) {
    if (el.textContent === val) return;
    el.textContent = val;
    restartAnim(el, "change");
  }

  function tick() {
    const diff = target - now();
    if (diff <= 0) {
      reveal(now() - target > 5000);
      return;
    }
    const sec = Math.floor(diff / 1000);
    setNum(els.d, pad(Math.floor(sec / 86400)));
    setNum(els.h, pad(Math.floor((sec % 86400) / 3600)));
    setNum(els.m, pad(Math.floor((sec % 3600) / 60)));
    setNum(els.s, pad(sec % 60));

    const isFinal = sec < 10;
    body.classList.toggle("final", isFinal);
    if (isFinal && finalEl.textContent !== String(sec + 1)) {
      finalEl.textContent = sec + 1;
      restartAnim(finalEl, "beat");
    }

    // Last minute: alert once, and flash the tab title so it's seen from other tabs
    if (sec < 60) {
      lastMinuteAlert();
      document.title = sec % 2 ? `● 0:${pad(sec)}` : "LOOK NOW";
    }
  }

  // People who arrive inside the final minute are already watching; don't alert them
  let alerted = target - now() <= 60000;
  const countdownTimer = setInterval(tick, 200);
  tick();

  // ── Glitch engine ────────────────────────────────
  const tears = [...document.querySelectorAll(".tear")];
  const subEl = $("sub");
  const subliminals = cfg.subliminals || [];
  let flickerSeq = [];
  let flickerStart = 0;

  function flickerBeam(seq) {
    flickerSeq = seq;
    flickerStart = performance.now();
  }

  function setSlices(el) {
    const a = between(0, 70), b = between(0, 100 - a - 8);
    const c = between(0, 70), d = between(0, 100 - c - 8);
    el.style.setProperty("--c1a", a + "%");
    el.style.setProperty("--c1b", b + "%");
    el.style.setProperty("--c2a", c + "%");
    el.style.setProperty("--c2b", d + "%");
  }

  function corruptTitle(el) {
    const chars = [...el.querySelectorAll(".ch")];
    if (!chars.length) return () => {};
    const picked = [...new Set(Array.from({ length: 1 + rand(3) }, () => chars[rand(chars.length)]))];
    const saved = picked.map((c) => c.textContent);
    picked.forEach((c) => (c.textContent = glyph()));
    el.dataset.text = el.textContent;
    return () => {
      picked.forEach((c, i) => (c.textContent = saved[i]));
      el.dataset.text = el.getAttribute("aria-label");
    };
  }

  function corruptDigit() {
    const keys = ["d", "h", "m", "s"];
    const el = els[keys[rand(keys.length)]];
    const before = el.textContent;
    const fake = pad(rand(100));
    el.textContent = fake;
    return () => { if (el.textContent === fake) el.textContent = before; };
  }

  // ── TV static ────────────────────────────────────
  const staticEl = $("static");
  const sctx = staticEl.getContext("2d");
  let staticUntil = 0;
  let staticRunning = false;
  let staticClear;

  function sizeStatic() {
    staticEl.width = Math.ceil(innerWidth / 2);
    staticEl.height = Math.ceil(innerHeight / 2);
  }
  sizeStatic();
  addEventListener("resize", sizeStatic);

  // level = opacity; band = only cover a horizontal strip
  function staticBurst(ms, level = 0.6, band = false) {
    if (reduceMotion) return;
    staticUntil = Math.max(staticUntil, performance.now() + ms);
    staticEl.style.opacity = level;
    // Hide on a timer too: animation frames pause in background tabs and
    // would otherwise leave the static stuck on screen.
    clearTimeout(staticClear);
    staticClear = setTimeout(() => (staticEl.style.opacity = 0), staticUntil - performance.now());
    if (band) {
      const top = between(0, 75);
      staticEl.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - between(6, 30))}% 0)`;
    } else {
      staticEl.style.clipPath = "none";
    }
    if (!staticRunning) {
      staticRunning = true;
      requestAnimationFrame(drawStatic);
    }
  }

  function drawStatic(t) {
    if (t > staticUntil) {
      staticEl.style.opacity = 0;
      staticRunning = false;
      return;
    }
    const w = staticEl.width, h = staticEl.height;
    const img = sctx.createImageData(w, h);
    const buf = new Uint32Array(img.data.buffer);
    for (let i = 0; i < buf.length; i++) {
      const v = (Math.random() * 255) | 0;
      buf[i] = 0xff000000 | (v << 16) | (v << 8) | v;
    }
    sctx.putImageData(img, 0, 0);
    // rolling dark bands, like a detuned TV
    sctx.fillStyle = "rgba(0,0,0,0.45)";
    sctx.fillRect(0, (t * 0.35) % h, w, h * 0.14);
    sctx.fillRect(0, (t * 0.12 + h / 2) % h, w, h * 0.05);
    requestAnimationFrame(drawStatic);
  }

  // Tune in: the page opens on static that clears
  staticBurst(450, 0.9);
  setTimeout(() => staticBurst(350, 0.35), 450);

  function staticLoop() {
    if (revealed) return;
    const final = body.classList.contains("final");
    if (Math.random() < 0.5) staticBurst(between(120, 260), between(0.3, 0.6), true);
    else staticBurst(between(150, 500), between(0.35, 0.8));
    setTimeout(staticLoop, final ? between(800, 2000) : between(7000, 18000));
  }
  setTimeout(staticLoop, between(6000, 10000));

  async function glitchBurst(strong = false) {
    if (reduceMotion) return;
    const dur = strong ? between(380, 650) : between(120, 320);
    if (strong && !revealed) staticBurst(dur, 0.85);
    else if (!revealed && Math.random() < 0.3) staticBurst(dur, between(0.2, 0.5), true);
    const activeTitle = revealed ? $("reveal-headline") : titleEl;

    tears.forEach((t) => {
      const on = Math.random() < (strong ? 0.9 : 0.55);
      t.style.display = on ? "block" : "none";
      t.style.top = between(0, 100) + "%";
      t.style.height = between(2, strong ? 60 : 28) + "px";
      t.style.transform = `translateX(${between(-30, 30)}px)`;
      t.className = "tear " + ["inv", "cyan", "red", "inv"][rand(4)];
    });

    setSlices(activeTitle);
    const restoreTitle = corruptTitle(activeTitle);
    const restoreDigit = !revealed && Math.random() < 0.6 ? corruptDigit() : () => {};

    if (Math.random() < 0.5 || strong) {
      flickerBeam([0.15, 1, 0.05, 0.6, 0.1, 1]);
    }

    body.classList.add("glitch");
    if (strong) body.classList.add("glitch-strong");

    // Rarely, a hidden message flashes for a split second
    if (!revealed && subliminals.length && Math.random() < (strong ? 0.5 : 0.18)) {
      await wait(dur * 0.4);
      subEl.textContent = subliminals[rand(subliminals.length)];
      body.classList.add("sub");
      await wait(between(90, 160));
      body.classList.remove("sub");
      await wait(dur * 0.3);
    } else {
      await wait(dur);
    }

    body.classList.remove("glitch", "glitch-strong");
    tears.forEach((t) => (t.style.display = "none"));
    restoreTitle();
    restoreDigit();
  }

  function glitchLoop() {
    if (revealed) return;
    const final = body.classList.contains("final");
    glitchBurst(final && Math.random() < 0.4);
    // Standalone faulty-bulb flicker every so often
    if (Math.random() < 0.15) setTimeout(() => flickerBeam([0.3, 1, 0.2, 0.9, 0.05, 0.05, 1]), 1500);
    setTimeout(glitchLoop, final ? between(500, 1400) : between(2200, 6500));
  }
  setTimeout(glitchLoop, 4500);

  // ── Last-minute alert ────────────────────────────
  // Works only while the page is open (any tab). Vibration is Android-only;
  // system notifications need the visitor to have tapped "signal me".
  let swReg = null;
  const canNotify = "Notification" in window && "serviceWorker" in navigator;

  function registerSW() {
    return navigator.serviceWorker.register("sw.js").then((r) => (swReg = r)).catch(() => {});
  }

  function lastMinuteAlert() {
    if (alerted || revealed) return;
    alerted = true;
    $("alert-me").classList.add("gone");
    glitchBurst(true);
    if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 800]);
    if (canNotify && Notification.permission === "granted" && swReg) {
      swReg.showNotification(cfg.codename, {
        body: cfg.alertMessage || "One minute left.",
        tag: "zentara-final",
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 120, 300, 120, 800],
      });
    }
  }

  // Background tabs throttle the 200ms ticker, so also set a dedicated timer.
  // (Browsers cap setTimeout at ~24 days, so re-arm hourly until close.)
  function scheduleAlert() {
    const d = target - now() - 60000;
    if (d <= 0) return;
    setTimeout(d > 3600000 ? scheduleAlert : lastMinuteAlert, Math.min(d, 3600000));
  }
  scheduleAlert();

  const alertBtn = $("alert-me");
  if (canNotify && !alerted) {
    if (Notification.permission === "granted") registerSW();
    else if (Notification.permission === "default") alertBtn.classList.remove("hidden");
  }
  alertBtn.addEventListener("click", async () => {
    const p = await Notification.requestPermission();
    if (p === "granted") {
      await registerSW();
      alertBtn.textContent = "● you will be signalled";
    } else {
      alertBtn.textContent = "○ signal declined";
    }
    alertBtn.disabled = true;
    setTimeout(() => alertBtn.classList.add("gone"), 2200);
  });

  // ── Reveal: glitch, light floods in, then the video ──
  async function reveal(immediate = false) {
    if (revealed) return;
    clearInterval(countdownTimer);
    clearTimeout(whisperStart);
    clearTimeout(whisperOut);
    clearInterval(whisperTimer);

    const video = $("video");
    const unmute = $("unmute");

    // Video src is only attached now, not sitting in the page from the start
    video.src = cfg.videoSrc;
    if (cfg.videoPoster) video.poster = cfg.videoPoster;
    video.preload = "auto";

    if (!immediate) await glitchBurst(true);
    revealed = true;
    if (!immediate) {
      body.classList.add("flooding");
      await wait(2000);
    }

    body.classList.remove("final");
    $("stage-countdown").classList.add("hidden");
    const rv = $("stage-reveal");
    rv.classList.remove("hidden");
    rv.setAttribute("aria-hidden", "false");
    document.title = cfg.codename;
    emerge($("reveal-headline"), cfg.revealHeadline, { stagger: 60, delay: 400 });

    body.classList.add("revealed");
    body.classList.remove("flooding");
    setTimeout(() => glitchBurst(), 3200);

    staticEl.style.opacity = 0;

    // Try autoplay with sound; browsers often block that, so fall back to muted.
    // Never wait on play(): if it hasn't started shortly, offer a button.
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
    setTimeout(() => {
      if (video.paused) unmute.textContent = "Tap to play";
      if (video.paused || video.muted) unmute.classList.remove("hidden");
    }, 2500);
  }

  $("unmute").addEventListener("click", () => {
    const v = $("video");
    const wasPaused = v.paused;
    v.muted = false;
    if (!wasPaused) v.currentTime = 0;
    v.play().catch(() => {});
    $("unmute").classList.add("hidden");
  });

  // ── Spotlight: sways slowly, follows the finger/cursor ──
  const beamEl = document.querySelector(".beam");
  const root = document.documentElement;
  let beamAngle = 0;
  let targetAngle = 0;
  let pointerUntil = 0;
  let beamPower = 1;
  const BEAM_ORIGIN_Y = -0.06; // matches .beam { top: -6vh }

  function aimAt(e) {
    const ox = innerWidth / 2;
    const oy = BEAM_ORIGIN_Y * innerHeight;
    const a = Math.atan2(-(e.clientX - ox), e.clientY - oy);
    targetAngle = Math.max(-0.55, Math.min(0.55, a));
    pointerUntil = performance.now() + 3500;
  }
  if (!reduceMotion) {
    addEventListener("pointermove", aimAt, { passive: true });
    addEventListener("pointerdown", aimAt, { passive: true });
  }

  // ── Smoke: soft wisps, lit where the beam passes ─
  const canvas = $("smoke");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let puffs = [];
  let motes = [];

  function makeSprite() {
    const s = document.createElement("canvas");
    s.width = s.height = 256;
    const c = s.getContext("2d");
    for (let k = 0; k < 22; k++) {
      const r = 18 + Math.random() * 40;
      const x = 128 + (Math.random() - 0.5) * 140;
      const y = 128 + (Math.random() - 0.5) * 70;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,240,222,0.12)");
      g.addColorStop(1, "rgba(255,240,222,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    return s;
  }
  const sprites = [0, 1, 2, 3, 4].map(makeSprite);

  function populate() {
    const n = innerWidth < 600 ? 26 : 38;
    const base = Math.max(W, H);
    puffs = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: base * between(0.25, 0.6),
      vx: between(-0.08, 0.08) * dpr,
      vy: -between(0.02, 0.09) * dpr,
      sprite: sprites[rand(sprites.length)],
      phase: Math.random() * Math.PI * 2,
    }));
    motes = Array.from({ length: n * 3 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: between(0.4, 1.4) * dpr,
      vx: between(-0.06, 0.06) * dpr,
      vy: between(-0.06, 0.06) * dpr,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.width = innerWidth * dpr;
    H = canvas.height = innerHeight * dpr;
    if (!puffs.length) populate();
  }
  resize();
  addEventListener("resize", resize);

  // 0..1: how strongly the beam lights a point
  function light(x, y) {
    const a = Math.atan2(-(x - W / 2), y - BEAM_ORIGIN_Y * H);
    const v = Math.max(0, 1 - Math.abs(a - beamAngle) / 0.36);
    return v * v * (3 - 2 * v) * (1 - (y / H) * 0.5) * beamPower;
  }

  function wrap(p, margin) {
    if (p.x < -margin) p.x = W + margin;
    else if (p.x > W + margin) p.x = -margin;
    if (p.y < -margin) p.y = H + margin;
    else if (p.y > H + margin) p.y = -margin;
  }

  function frame(t) {
    if (!reduceMotion && t > pointerUntil) {
      targetAngle = Math.sin(t * 0.00023) * 0.2 + Math.sin(t * 0.00071) * 0.05;
    }
    beamAngle += (targetAngle - beamAngle) * 0.025;
    root.style.setProperty("--beam", beamAngle.toFixed(4) + "rad");

    // Beam power: faulty flicker, plus a heartbeat in the final seconds
    beamPower = 1;
    if (flickerSeq.length) {
      const idx = Math.floor((t - flickerStart) / 50);
      if (idx < flickerSeq.length) beamPower = flickerSeq[idx];
      else flickerSeq = [];
    }
    if (body.classList.contains("final")) {
      const frac = ((target - now()) % 1000) / 1000;
      beamPower *= 0.5 + 0.7 * frac * frac;
    }
    beamEl.style.opacity = Math.min(1, 0.9 * beamPower).toFixed(3);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    for (const p of puffs) {
      p.x += p.vx;
      p.y += p.vy;
      wrap(p, p.size / 2);
      const L = Math.min(1, light(p.x, p.y));
      ctx.globalAlpha = (0.05 + 0.22 * L) * (0.8 + 0.2 * Math.sin(t * 0.0004 + p.phase));
      ctx.drawImage(p.sprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    ctx.fillStyle = "#fff1de";
    for (const m of motes) {
      m.x += m.vx;
      m.y += m.vy;
      wrap(m, 4);
      const L = light(m.x, m.y);
      if (L < 0.02) continue;
      ctx.globalAlpha = Math.min(1, L) * (0.45 + 0.55 * Math.sin(t * 0.002 + m.tw));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
