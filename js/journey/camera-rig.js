/* ==========================================================================
   SPACE-TO-COMPUTE JOURNEY — CINEMATOGRAPHIC CAMERA RIG
   Keyed C1-continuous Catmull-Rom dolly + target spline, dynamic FOV,
   harmonic launch rumble, subtle banking roll & SpaceX asymmetric lens shift.
   ========================================================================== */
(() => {
  'use strict';

  const root = (window.SpaceComputeJourney = window.SpaceComputeJourney || {});

  // 1D Catmull-Rom cubic evaluation with boundary clamping (C1-smooth velocity)
  function catmull1D(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  function createCameraRig(THREE, config) {
    const { clamp, lerp, smoothstep } = config.math;
    const track = config.CAMERA_TRACK;
    const n = track.length;

    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.12, 340);
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    const curPos = new THREE.Vector3();
    const curLook = new THREE.Vector3();
    const offsetVec = new THREE.Vector3();

    let curFov = 36;
    let curRoll = 0;
    let initialized = false;

    const view = { w: 1, h: 1, fx: 0.72, fy: 0.40, sectionH: 1 };

    function sampleTrack(u, outPos, outLook) {
      const cu = clamp(u, 0, 1);
      // Locate segment [i, i+1] containing cu
      let i = 0;
      while (i < n - 2 && cu > track[i + 1].u) i++;
      const k0 = track[Math.max(0, i - 1)];
      const k1 = track[i];
      const k2 = track[Math.min(n - 1, i + 1)];
      const k3 = track[Math.min(n - 1, i + 2)];

      const span = Math.max(0.0001, k2.u - k1.u);
      const t = clamp((cu - k1.u) / span, 0, 1);

      outPos.set(
        catmull1D(k0.pos[0], k1.pos[0], k2.pos[0], k3.pos[0], t),
        catmull1D(k0.pos[1], k1.pos[1], k2.pos[1], k3.pos[1], t),
        catmull1D(k0.pos[2], k1.pos[2], k2.pos[2], k3.pos[2], t)
      );
      outLook.set(
        catmull1D(k0.look[0], k1.look[0], k2.look[0], k3.look[0], t),
        catmull1D(k0.look[1], k1.look[1], k2.look[1], k3.look[1], t),
        catmull1D(k0.look[2], k1.look[2], k2.look[2], k3.look[2], t)
      );

      // Smooth Hermite FOV & Roll
      const ts = t * t * (3 - 2 * t);
      return {
        fov: lerp(k1.fov, k2.fov, ts),
        roll: lerp(k1.roll || 0, k2.roll || 0, ts)
      };
    }

    function setViewport(w, h, sectionH) {
      view.w = Math.max(1, w);
      view.h = Math.max(1, h);
      view.sectionH = Math.max(1, sectionH || h);
      camera.aspect = view.w / view.h;

      const isMobile = view.w < 768;
      const isTablet = !isMobile && view.w < 1024;
      view.fx = isMobile ? 0.50 : isTablet ? 0.65 : 0.72;
      view.fy = isMobile ? 0.312 : isTablet ? 0.34 : 0.395;
      camera.updateProjectionMatrix();
    }

    function update(u, dt, clockSec, pointer, scrollCur, instant = false, trackTarget = null, trackWeight = 0) {
      const { fov, roll } = sampleTrack(u, desiredPos, desiredLook);

      // Smoothly lock camera look target onto dynamic traveling subject (e.g. Stage 05 RF Signal Carrier!)
      if (trackTarget && trackWeight > 0.001) {
        desiredLook.lerp(trackTarget, clamp(trackWeight, 0, 1));
      }

      // Aspect-aware distance breathing room (keeps narrow mobile viewports bold yet cleanly uncropped)
      const aspect = view.w / Math.max(1, view.h);
      const distMul = aspect < 0.85
        ? clamp(1.12 / Math.max(0.46, aspect), 1.46, 1.98)
        : (view.w < 1024 ? 1.2 : 1.0);

      offsetVec.subVectors(desiredPos, desiredLook).multiplyScalar(distMul);
      desiredPos.copy(desiredLook).add(offsetVec);

      // Gentle fine-pointer cinematic parallax (never breaks composition)
      const parScale = view.w < 768 ? 0.25 : 0.65;
      desiredPos.x += pointer.sx * parScale;
      desiredPos.y -= pointer.sy * parScale * 0.55;

      // Physical low-frequency harmonic camera rumble during T-0 Rocket Ignition (u: 0.032 -> 0.088)
      const rumbleEnv = smoothstep(0.030, 0.044, u) * (1 - smoothstep(0.068, 0.095, u));
      if (rumbleEnv > 0.001 && !instant) {
        const amp = rumbleEnv * 0.095;
        desiredPos.x += (Math.sin(clockSec * 47.0) * 0.6 + Math.cos(clockSec * 73.0) * 0.4) * amp;
        desiredPos.y += (Math.cos(clockSec * 53.0) * 0.65 + Math.sin(clockSec * 89.0) * 0.35) * amp;
      }

      if (!initialized || instant) {
        curPos.copy(desiredPos);
        curLook.copy(desiredLook);
        curFov = fov;
        curRoll = roll;
        initialized = true;
      } else {
        const damp = 1 - Math.exp(-dt * 0.0085);
        curPos.lerp(desiredPos, damp);
        curLook.lerp(desiredLook, damp);
        curFov = lerp(curFov, fov, damp);
        curRoll = lerp(curRoll, roll, damp);
      }

      camera.fov = curFov;
      camera.position.copy(curPos);
      camera.lookAt(curLook);
      if (Math.abs(curRoll) > 0.0002) {
        camera.rotateZ(curRoll);
      }

      // SpaceX asymmetric optical lens shift (protects left headline & bottom-right card)
      const fx = lerp(view.fx, 0.5, scrollCur * 0.45);
      const fyShift = -(view.fy - 0.5) * view.h + scrollCur * view.h * 0.05;
      camera.setViewOffset(view.w, view.h, -(fx - 0.5) * view.w, fyShift, view.w, view.h);
      camera.updateProjectionMatrix();

      return { pos: curPos, look: curLook };
    }

    return {
      camera,
      setViewport,
      update
    };
  }

  root.createCameraRig = createCameraRig;
})();
