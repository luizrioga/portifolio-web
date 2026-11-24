/* ==========================================================================
   SPACE-TO-COMPUTE JOURNEY — CONTINUOUS CANVAS 2D FALLBACK (NON-WEBGL)
   Graceful fallback preserving all 11 chapters and smooth seeking when WebGL
   or Three.js CDN is unavailable.
   ========================================================================== */
(() => {
  'use strict';

  const root = (window.SpaceComputeJourney = window.SpaceComputeJourney || {});

  function initFallback2D(canvas, wrap, uiCtrl, helpers) {
    const config = root.CONFIG;
    const { clamp, lerp, smoothstep, easeInOutQuint, mulberry32 } = config.math;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    wrap.classList.add('is-ready');
    let width = 0;
    let height = 0;
    let dpr = helpers.capDPR(2);
    let u = helpers.prefersReducedMotion ? 0.055 : 0.0;
    let playing = !helpers.prefersReducedMotion;
    let seek = null;

    const rand = mulberry32(202611);
    const stars = Array.from({ length: 90 }, () => ({
      x: rand(),
      y: rand(),
      r: 0.6 + rand() * 1.4,
      a: 0.15 + rand() * 0.45,
      tw: rand() * Math.PI * 2
    }));

    function drawFrame(dt) {
      if (seek) {
        seek.elapsed += dt * 0.001;
        const t = clamp(seek.elapsed / seek.dur, 0, 1);
        u = lerp(seek.from, seek.to, easeInOutQuint(t));
        if (t >= 1) {
          u = seek.to;
          seek = null;
        }
      } else if (playing && !helpers.prefersReducedMotion) {
        u = (u + (dt * 0.001) / config.CYCLE_SEC) % 1;
      }

      const stage = config.getStageForU(u);
      const localT = clamp((u - stage.uStart) / Math.max(0.001, stage.uEnd - stage.uStart), 0, 1);
      uiCtrl.sync(stage, localT, u);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#050606';
      ctx.fillRect(0, 0, width, height);

      // Subtle continuous starfield drifting smoothly with journey u
      stars.forEach((s) => {
        const sx = ((s.x - u * 0.6) % 1 + 1) % 1 * width;
        const sy = ((s.y + u * 0.25) % 1 + 1) % 1 * height;
        ctx.fillStyle = `rgba(243,244,240,${(s.a * (0.65 + 0.35 * Math.sin(u * 40 + s.tw))).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      const isSmall = width < 768;
      const cx = isSmall ? width * 0.5 : width * 0.72;
      const cy = isSmall ? height * 0.22 : height * 0.42;
      const r = Math.min(width, height) * (isSmall ? 0.14 : 0.22);

      // Continuous flowing orbital-to-circuit spline backdrop
      ctx.save();
      ctx.strokeStyle = 'rgba(56,189,248,0.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const x = cx + (t - 0.5) * r * 3.4;
        const y = cy + Math.sin(t * Math.PI * 2 - u * 18) * r * 0.55;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Stage focal emblem rendered smoothly with stage accent
      ctx.strokeStyle = stage.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.45 + 0.12 * Math.sin(localT * Math.PI)), 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(243,244,240,0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.78, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u);
      ctx.stroke();
      ctx.restore();
    }

    function resize() {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(300, rect.width);
      height = Math.max(440, rect.height);
      dpr = helpers.capDPR(width < 768 ? 1.5 : 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(0);
    }

    const loop = helpers.createLoop((dt) => drawFrame(dt));

    uiCtrl.onSelectStage((idx) => {
      const st = config.STAGES[clamp(idx, 0, config.STAGES.length - 1)];
      if (!st) return;
      if (helpers.prefersReducedMotion) {
        u = st.focusU;
        drawFrame(0);
      } else {
        seek = { from: u, to: st.focusU, elapsed: 0, dur: 1.1 };
        if (!loop.running) loop.start();
      }
    });

    uiCtrl.onTogglePlay(() => {
      playing = !playing;
      uiCtrl.setPlaying(playing);
      if (playing && !loop.running) loop.start();
    });

    window.__HERO_MISSION__ = {
      setU(val) {
        seek = null;
        u = clamp(val, 0, 0.9999);
        drawFrame(0);
      },
      seekTo(idx, instant = false) {
        const st = config.STAGES[clamp(idx, 0, config.STAGES.length - 1)];
        if (!st) return;
        if (instant) {
          seek = null;
          u = st.focusU;
          drawFrame(0);
        } else {
          seek = { from: u, to: st.focusU, elapsed: 0, dur: 1.1 };
        }
      },
      getState() {
        const st = config.getStageForU(u);
        return { engine: '2d', stageIdx: st.idx, u, stageId: st.id };
      }
    };

    if (helpers.prefersReducedMotion) {
      drawFrame(0);
    } else {
      helpers.bindVisibility(wrap, (vis) => (vis ? loop.start() : loop.stop()), '80px');
    }
    new ResizeObserver(resize).observe(wrap);
    resize();
  }

  root.initFallback2D = initFallback2D;
})();
