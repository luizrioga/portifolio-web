/* ==========================================================================
   SPACE-TO-COMPUTE JOURNEY — CINEMATOGRAPHIC ORCHESTRATOR ENGINE
   Unifies Space (Stages 01-05) & Compute/Network (Stages 06-11) into one
   continuous, uninterrupted Three.js WebGL single-take experience.
   ========================================================================== */
(() => {
  'use strict';

  const root = (window.SpaceComputeJourney = window.SpaceComputeJourney || {});

  // Lightweight mission UI controller (HUD bar intentionally omitted for clean SpaceX editorial hero)
  function createMissionUI() {
    const selectListeners = [];
    const playListeners = [];
    return {
      sync() {},
      setPlaying() {},
      onSelectStage(fn) { selectListeners.push(fn); },
      onTogglePlay(fn) { playListeners.push(fn); }
    };
  }

  function initWebGL(THREE, canvas, wrap, uiCtrl, helpers) {
    const config = root.CONFIG;
    const { clamp, lerp, smoothstep, smootherstep, remap, easeInOutCubic, easeOutQuart, easeInOutQuint, mulberry32 } = config.math;
    const section = document.getElementById('intro') || wrap.parentElement;
    const isCompact = wrap.clientWidth < 768 || !helpers.isFinePointer;

    const isLowSpec = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;

    // 1. High-Craft Film-Tone-Mapped WebGL Renderer (adaptive for entry-level laptops)
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isLowSpec,
      alpha: false,
      powerPreference: isLowSpec ? 'default' : 'high-performance'
    });
    renderer.setClearColor(0x050606, 1);
    renderer.setPixelRatio(helpers.capDPR(isLowSpec ? 1.25 : isCompact ? 1.5 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(0x050606, 0.014);
    scene.fog = fog;

    // 2. Dynamic 4-Light Cinema Rig (tracks focal theater, shifts mood smoothly per stage)
    const hemiLight = new THREE.HemisphereLight(0x98C8E8, 0x161D20, 0.98);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xF8FAFC, 2.45);
    keyLight.position.set(16, 22, 18);
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x38BDF8, 1.55);
    rimLight.position.set(-14, 12, -10);
    scene.add(rimLight);
    scene.add(rimLight.target);

    const accentPoint = new THREE.PointLight(0xF59E0B, 2.8, 38, 1.4);
    scene.add(accentPoint);

    // 3. Deep Starfield Dome spanning the entire unified Space-to-Compute universe
    const rand = mulberry32(202699);
    const starCount = isCompact || isLowSpec ? 320 : 680;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = -30 + rand() * 235;
      starPos[i * 3 + 1] = -8 + rand() * 95;
      starPos[i * 3 + 2] = -46 + rand() * 64;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starField = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xE8EEF2, size: isCompact ? 0.22 : 0.26, transparent: true, opacity: 0.62, depthWrite: false })
    );
    scene.add(starField);

    // 4. Build Single Continuous 3D Universe (Materials + Space World + Compute World + Camera Rig)
    const mats = root.createMaterials(THREE);
    const space = root.buildSpaceWorld(THREE, mats, isCompact);
    const compute = root.buildComputeWorld(THREE, mats, isCompact);
    scene.add(space.group, compute.group);

    const rig = root.createCameraRig(THREE, config);
    const camera = rig.camera;

    // Reusable scratch vectors/objects (zero per-frame GC allocation!)
    const tmpColorA = new THREE.Color();
    const tmpColorB = new THREE.Color();
    const tmpColorC = new THREE.Color();
    const tmpDummy = new THREE.Object3D();
    const tmpVec = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 0, 1);

    // Subtle loop-boundary breath overlay (ensures u=1.0 -> 0.0 feels like a deliberate cinematic inhale)
    const veilOverlay = document.getElementById('hero-loop-veil');

    // Timeline & Interaction State
    let u = helpers.prefersReducedMotion ? config.STAGES[0].focusU : 0.0;
    let clockSec = 0;
    let playing = !helpers.prefersReducedMotion;
    let seek = null; // { from, to, elapsed, dur }
    let scrollCur = 0;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

    function layout() {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      renderer.setSize(w, h, false);
      rig.setViewport(w, h, Math.max(1, section.offsetHeight));
    }

    /* ========================================================================
       CONTINUOUS 11-STAGE CHOREOGRAPHY EVALUATOR (ZERO HARD CUTS)
       ======================================================================== */
    function evaluateWorld(uNow, dt, instantCam = false) {
      const st = config.getStageForU(uNow);
      const localT = clamp((uNow - st.uStart) / Math.max(0.0001, st.uEnd - st.uStart), 0, 1);
      uiCtrl.sync(st, localT, uNow);

      // Update animated GLSL shaders time
      mats.boosterPlumeShader.uniforms.uTime.value = clockSec;
      mats.boosterCoreShader.uniforms.uTime.value = clockSec;
      mats.vacuumPlumeShader.uniforms.uTime.value = clockSec;

      /* ---------- STAGES 01 – 03: GROUND TELEMETRY -> LAUNCH -> HOT-STAGING -> ORBIT ---------- */
      // 1a. Ground-Level Optical Telemetry Feed into Launch Mount + Aviation Beacons
      space.pad.padFiberPulses.forEach((fp) => {
        const t = (clockSec * fp.speed + fp.offset) % 1;
        fp.curve.getPointAt(t, fp.mesh.position);
      });
      space.pad.beacons.forEach((b) => {
        const pulse = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(clockSec * 4.5 + b.phase), 3);
        b.mat.color.setRGB(0.96 * pulse, 0.58 * pulse, 0.06 * pulse);
      });
      const armRetract = smootherstep(0.018, 0.044, uNow);
      space.pad.armL.rotation.y = armRetract * 0.42;
      space.pad.armR.rotation.y = -armRetract * 0.42;
      space.pad.qdArm.rotation.y = -smootherstep(0.014, 0.038, uNow) * 0.68;

      // 1b. Ignition Warm-up & Heavy Gravitational Liftoff Curve
      const ignPower = smootherstep(0.022, 0.048, uNow) * (1 - smootherstep(0.142, 0.168, uNow));
      const padGlow = ignPower * (1 - smoothstep(0.055, 0.105, uNow));
      space.pad.trenchGlowMat.opacity = 0.06 + padGlow * 0.84;

      // Shockwave rings radiating across launch pad during T-0 ignition
      space.pad.shockRings.forEach((rm, ri) => {
        const ru = (clockSec * 0.95 + ri / 3) % 1;
        rm.scale.setScalar(0.9 + ru * 4.4);
        rm.material.opacity = (1 - ru) * padGlow * 0.68;
      });

      // Cryogenic venting mist (pre-launch) & billowing ignition exhaust clouds
      const cloudPos = space.pad.cloudPos;
      space.pad.cloudMeta.forEach((cm, ci) => {
        if (cm.isCryo) {
          const cy = (clockSec * 0.25 * cm.speed + cm.phase) % 1;
          const cryoVis = 1 - smoothstep(0.045, 0.075, uNow);
          cloudPos[ci * 3] = Math.cos(cm.ang) * (0.48 + cy * 1.45) + cy * 1.6;
          cloudPos[ci * 3 + 1] = cryoVis > 0.02 ? cm.yOff + cy * 0.75 : -50;
          cloudPos[ci * 3 + 2] = Math.sin(cm.ang) * (0.48 + cy * 1.15);
        } else {
          const ex = (clockSec * 0.75 * cm.speed + cm.phase) % 1;
          if (padGlow > 0.02) {
            const rad = 0.65 + ex * 5.8 * cm.spread;
            cloudPos[ci * 3] = Math.cos(cm.ang) * rad;
            cloudPos[ci * 3 + 1] = cm.yOff + ex * 1.65;
            cloudPos[ci * 3 + 2] = Math.sin(cm.ang) * rad;
          } else {
            cloudPos[ci * 3 + 1] = -50;
          }
        }
      });
      space.pad.cloudGeo.attributes.position.needsUpdate = true;
      space.pad.cloudMat.opacity = clamp(0.24 * (1 - smoothstep(0.045, 0.08, uNow)) + padGlow * 0.56, 0, 0.72);

      // 1d. Rocket Trajectory (Heavy ascent -> Gravity turn -> Hot-staging separation -> Orbital insertion!)
      const ascentT = remap(uNow, 0.036, 0.155, 0, 1);
      const ascentCurve = Math.pow(ascentT, 2.25); // Massive realistic gravity-defying acceleration!
      const sepT = smootherstep(0.155, 0.235, uNow);
      const orbitT = smootherstep(0.220, 0.302, uNow);

      // Combined ascent baseline position of rocket anchor
      const baseX = lerp(0.0, 3.6, Math.pow(ascentT, 1.9));
      const baseY = 3.55 + ascentCurve * 24.4;
      const baseZ = lerp(0.0, -0.8, ascentT);
      const stackPitch = -smootherstep(0.068, 0.155, uNow) * 0.44;
      space.rocketAnchor.position.set(baseX, baseY, baseZ);
      space.rocketAnchor.rotation.set(0, 0, 0);

      // Super Heavy Booster: stays attached through u=0.155, then separates & flips gracefully back-left!
      const bLocalX = -sepT * 5.2 - orbitT * 7.5;
      const bLocalY = -sepT * 4.4 - orbitT * 5.0;
      const bLocalZ = -sepT * 1.8;
      space.booster.group.position.set(bLocalX, bLocalY, bLocalZ);
      space.booster.group.rotation.z = stackPitch + sepT * 1.35 + orbitT * 0.6;

      // Booster Multi-Layer Methalox Plume + Supersonic Sparks + Hot-Stage Interstage Ring Glow
      const boosterPower = clamp(ignPower * 1.18, 0, 1.28);
      mats.boosterPlumeShader.uniforms.uPower.value = boosterPower;
      mats.boosterCoreShader.uniforms.uPower.value = boosterPower;
      space.booster.plumeGroup.visible = boosterPower > 0.015;
      space.booster.plumeGroup.scale.set(1, 0.42 + boosterPower * 0.92, 1);
      space.booster.engineFlare.material.opacity = boosterPower * 0.88;
      space.booster.throatDiscMat.opacity = boosterPower * 0.92;
      space.booster.sparkMat.opacity = boosterPower * 0.78;
      if (space.booster.plumeGroup.visible) {
        const sp = space.booster.sparkPos;
        space.booster.sparkMeta.forEach((sm, si) => {
          const st = (clockSec * sm.speed + sm.phase) % 1;
          const spread = sm.rad * (0.65 + st * 1.65);
          sp[si * 3] = Math.cos(sm.ang + st * 0.8) * spread;
          sp[si * 3 + 1] = -st * sm.len;
          sp[si * 3 + 2] = Math.sin(sm.ang + st * 0.8) * spread;
        });
        space.booster.sparkGeo.attributes.position.needsUpdate = true;
      }

      // Hot-staging interstage ring ignites bright amber right around separation
      const hotRingGlow = smoothstep(0.138, 0.158, uNow) * (1 - smoothstep(0.185, 0.225, uNow));
      space.booster.hotVentMat.opacity = 0.2 + hotRingGlow * 0.8;
      // Cold-gas RCS flip puff on booster during flip-back maneuver
      space.booster.rcsMat.opacity = smoothstep(0.168, 0.188, uNow) * (1 - smoothstep(0.215, 0.245, uNow)) * 0.72;

      // Starship Upper Stage: rides atop Booster then coasts horizontally along LEO while deploying satellite!
      const stackedOffsetX = -Math.sin(stackPitch) * 4.05;
      const stackedOffsetY = Math.cos(stackPitch) * 4.05;
      const postSepX = lerp(stackedOffsetX, 25.0 - baseX, smootherstep(0.155, 0.302, uNow))
        + smoothstep(0.302, 0.345, uNow) * 1.2
        - smoothstep(0.350, 0.405, uNow) * 1.8;
      const postSepY = lerp(stackedOffsetY, 48.2 - baseY, smootherstep(0.155, 0.302, uNow))
        - smoothstep(0.345, 0.405, uNow) * 1.4;
      const postSepZ = lerp(0, -4.4, smootherstep(0.155, 0.302, uNow))
        - smoothstep(0.350, 0.405, uNow) * 0.4;
      space.starship.group.position.set(postSepX, postSepY, postSepZ);
      // Pitch smoothly from stackPitch (-0.44) -> horizontal LEO (-Math.PI / 2)
      space.starship.group.rotation.z = lerp(stackPitch, -Math.PI * 0.5, smootherstep(0.155, 0.278, uNow));

      // Starship Raptor Vacuum Expansion Plume (ignites during hot-staging, cuts off cleanly at MECO!)
      const vacPower = smootherstep(0.148, 0.168, uNow) * (1 - smootherstep(0.242, 0.274, uNow));
      mats.vacuumPlumeShader.uniforms.uPower.value = vacPower;
      space.starship.vacPlumeGroup.visible = vacPower > 0.015;
      space.starship.vacPlumeGroup.scale.set(0.75 + vacPower * 0.3, 0.4 + vacPower * 0.85, 0.75 + vacPower * 0.3);
      space.starship.vacFlare.material.opacity = vacPower * 0.82;

      // Starship Realistic Curved Twin Clamshell Payload Bay Doors open symmetrically outward along dorsal spine!
      const bayOpen = smootherstep(0.276, 0.306, uNow);
      space.starship.bayPivotPos.rotation.y = bayOpen * 1.45;
      space.starship.bayPivotNeg.rotation.y = -bayOpen * 1.45;
      space.starship.bayLightMat.opacity = bayOpen * 0.52;

      // Earth organic atmospheric emergence (invisible at ground launch & underground silicon, luminous in stratosphere/orbit!)
      const earthFade = smootherstep(0.088, 0.165, uNow) * (1 - smootherstep(0.500, 0.562, uNow));
      space.earth.group.visible = earthFade > 0.005;
      if (space.earth.group.visible) {
        mats.earthDark.opacity = earthFade;
        mats.atmosphereShader.uniforms.uOpacity.value = earthFade;
        space.earth.gridWire.material.opacity = 0.14 * earthFade;
        space.earth.orbitArcs.children.forEach((ln, li) => {
          ln.material.opacity = (li === 0 ? 0.36 : 0.24) * earthFade;
        });
        space.earth.planet.rotation.y = uNow * 0.42;
        space.earth.gridWire.rotation.y = uNow * 0.42;
      }

      /* ---------- STAGE 04: 3-BEAT SATELLITE DEPLOYMENT (OPEN BAY -> FOLDED EXIT -> UNFOLD!) ---------- */
      // Exact world coordinates of Starship's open dorsal payload bay (local +Y -> world +X, local -X -> world +Y)
      const bayWorldX = baseX + postSepX + 0.58;
      const bayWorldY = baseY + postSepY + 0.34;
      const bayWorldZ = baseZ + postSepZ;

      const clearX = 30.8;
      const clearY = 50.0;
      const clearZ = -5.4;
      const [satEndX, satEndY, satEndZ] = config.ANCHORS.satDeployEnd;

      // Beat 1 (u: 0.286 -> 0.308): Stowed & 100% folded visibly inside Starship's illuminated dorsal bay
      // Beat 2 (u: 0.308 -> 0.356): Slow, graceful zero-G vertical lift + gentle forward glide OUT of hull!
      // Beat 3 (u: 0.356 -> 0.405): Clear of Starship -> accordion solar panels unfold sequentially & dish locks!
      const ejectT = smootherstep(0.308, 0.356, uNow);
      const ejectX = Math.pow(ejectT, 1.45); // Lifts UPWARD first out of the bay, then glides forward!
      const settleT = smootherstep(0.356, 0.405, uNow);
      const liftArcY = Math.sin(ejectT * Math.PI * 0.8) * 1.15 * (1 - settleT);

      const satX = lerp(lerp(bayWorldX, clearX, ejectX), satEndX, settleT);
      const satY = lerp(lerp(bayWorldY - 0.08, clearY, ejectT), satEndY, settleT) + liftArcY + Math.sin(clockSec * 1.1) * 0.03 * settleT;
      const satZ = lerp(lerp(bayWorldZ, clearZ, ejectT), satEndZ, settleT);

      space.satellite.group.visible = uNow >= 0.284;
      space.satellite.group.position.set(satX, satY, satZ);

      // Compact scale inside Starship bay (0.50) growing smoothly to hero orbital scale (1.0) as it exits
      const satScale = lerp(0.50, 1.0, smootherstep(0.310, 0.358, uNow));
      space.satellite.group.scale.setScalar(satScale);

      // Attitude stabilization from bay rail pitch -> stabilized Earth-facing nadir attitude
      space.satellite.group.rotation.set(
        lerp(0.16, 0.08, smootherstep(0.320, 0.395, uNow)),
        lerp(-0.38, -0.18, smootherstep(0.320, 0.395, uNow)) + Math.sin(clockSec * 0.6) * 0.03 * settleT,
        lerp(0.20, 0.0, smootherstep(0.325, 0.380, uNow))
      );

      // Strictly LOCKED FOLDED until u = 0.356 (completely clear of Starship!), THEN sequential Accordion Unfold!
      const uWing1 = smootherstep(0.356, 0.378, uNow);
      const uWing2 = smootherstep(0.368, 0.390, uNow);
      const uWing3 = smootherstep(0.380, 0.402, uNow);
      space.satellite.wingPos.rootPivot.position.z = lerp(0.24, 0.38, uWing1);
      space.satellite.wingNeg.rootPivot.position.z = -lerp(0.24, 0.38, uWing1);

      const foldAngles = [
        (1 - uWing1) * (Math.PI * 0.50),
        (1 - uWing2) * (Math.PI * 0.92),
        (1 - uWing3) * (Math.PI * 0.92)
      ];
      space.satellite.wingPos.panels.forEach((hinge, hi) => {
        const sign = hi % 2 === 0 ? 1 : -1;
        hinge.rotation.x = foldAngles[hi] * sign;
      });
      space.satellite.wingNeg.panels.forEach((hinge, hi) => {
        const sign = hi % 2 === 0 ? -1 : 1;
        hinge.rotation.x = foldAngles[hi] * sign;
      });

      // Parabolic Dish Gimbal deploys & locks onto Earth's Ground Station AFTER wings open
      const dishLock = smootherstep(0.384, 0.408, uNow);
      space.satellite.dishGimbal.rotation.z = lerp(-0.58, 0.42, dishLock);
      space.satellite.dishGimbal.rotation.x = lerp(0.38, 0.14, dishLock);

      // Constellation companion satellites gentle orbital drift
      space.constellation.nodes.forEach((nd, ni) => {
        nd.rotation.y = clockSec * 0.25 + ni;
        nd.position.y += Math.sin(clockSec * 0.8 + ni * 1.9) * 0.0008;
      });

      /* ---------- STAGE 05: SIGNAL TRANSMISSION & SUBJECTIVE DIVE ---------- */
      const txCharge = smootherstep(0.392, 0.415, uNow) * (1 - smootherstep(0.475, 0.51, uNow));
      space.satellite.emitterGlow.material.opacity = txCharge * 0.95;
      space.satellite.txRings.forEach((rm, ri) => {
        const ru = (clockSec * 1.45 + ri / 4) % 1;
        rm.scale.setScalar(0.5 + ru * 3.8);
        rm.position.y = -0.34 - ru * 1.1;
        rm.material.opacity = (1 - ru) * txCharge * 0.82;
      });

      const sigT = smootherstep(0.410, 0.495, uNow);
      const sigActive = uNow >= 0.404 && uNow <= 0.515;
      space.signal.carrier.visible = sigActive;
      space.signal.guideMat.opacity = 0.08 + smoothstep(0.40, 0.43, uNow) * 0.34 * (1 - smoothstep(0.51, 0.56, uNow));
      space.signal.filMat.opacity = smoothstep(0.420, 0.445, uNow) * (1 - smoothstep(0.475, 0.500, uNow)) * 0.42;

      if (sigActive) {
        space.signal.curve.getPointAt(clamp(sigT, 0, 1), tmpVec);
        space.signal.carrier.position.copy(tmpVec);
        space.signal.ringA.rotation.z = clockSec * 4.2;
        space.signal.ringA.rotation.x = clockSec * 2.1;
        space.signal.ringB.rotation.y = -clockSec * 3.4;

        space.signal.trailRings.forEach((tr, ti) => {
          const tt = sigT - (ti + 1) * 0.022;
          if (tt > 0.01 && tt < 0.99) {
            tr.visible = true;
            space.signal.curve.getPointAt(tt, tr.position);
            space.signal.curve.getTangentAt(tt, tmpTan);
            tr.quaternion.setFromUnitVectors(upAxis, tmpTan.normalize());
            tr.material.opacity = (1 - ti / 6) * 0.65 * smoothstep(0.0, 0.08, sigT);
          } else {
            tr.visible = false;
          }
        });
      } else {
        space.signal.trailRings.forEach((tr) => { tr.visible = false; });
      }

      /* ---------- STAGE 06: GROUND RECEIVER & ARCHITECTURAL DATABASE VAULT ---------- */
      const rxImpact = Math.sin(clamp((uNow - 0.488) / 0.045, 0, 1) * Math.PI);
      compute.database.rxHalo.scale.setScalar(1.0 + rxImpact * 1.45 + Math.sin(clockSec * 4.0) * 0.06);
      compute.database.rxHaloMat.opacity = 0.35 + rxImpact * 0.65;

      // Optical Shaft descending data shards
      compute.database.shaftPulses.forEach((sp) => {
        const py = (clockSec * 0.65 + sp.phase) % 1;
        sp.mesh.position.set(sp.x, lerp(compute.database.gy - 0.3, compute.database.vy + 0.3, py), sp.z);
      });

      // Database Vault radial indexing shards & monolith LED waves
      compute.database.indexShards.forEach((sh) => {
        const p = (clockSec * 0.72 + sh.phase) % 1;
        const rad = lerp(0.75, 4.3, p);
        sh.mesh.position.set(Math.cos(sh.ang) * rad, sh.y, Math.sin(sh.ang) * rad);
      });
      compute.database.bladeMeta.forEach((bm, bi) => {
        const wave = 0.5 + 0.5 * Math.sin(clockSec * 3.2 - bm.ang * 2.0 - bm.tier * 1.4);
        tmpColorA.setHex(0x164E63).lerp(tmpColorB.setHex(wave > 0.72 ? 0xC6F135 : 0x38BDF8), wave);
        compute.database.bladeLedInst.setColorAt(bi, tmpColorA);
      });
      if (compute.database.bladeLedInst.instanceColor) {
        compute.database.bladeLedInst.instanceColor.needsUpdate = true;
      }

      // Database -> GPU Optical Bus Pulses
      compute.database.dbToGpuPulses.forEach((p) => {
        const t = (clockSec * p.speed + p.offset) % 1;
        p.curve.getPointAt(t, p.mesh.position);
      });

      /* ---------- STAGE 07: SCULPTED GPU PARALLEL COMPUTE (64 INSTANCED SM CORES) ---------- */
      const gpuNear = uNow > 0.54 && uNow < 0.73;
      if (gpuNear || instantCam) {
        compute.gpu.smMeta.forEach((sm) => {
          // Deterministic tensor wave sweeping across the 4 GPC quadrants from L2 crossbars
          const distFromCross = Math.min(Math.abs(sm.c - 3.5), Math.abs(sm.r - 3.5));
          const wave = Math.sin(clockSec * 4.2 - distFromCross * 1.05 - (sm.r + sm.c) * 0.32);
          const hot = smoothstep(0.15, 0.92, wave);
          tmpDummy.position.set(sm.sx, 0.36 + hot * 0.11, sm.sz);
          tmpDummy.rotation.set(0, 0, 0);
          tmpDummy.scale.set(1, 1 + hot * 0.45, 1);
          tmpDummy.updateMatrix();
          compute.gpu.smInst.setMatrixAt(sm.idx, tmpDummy.matrix);

          tmpColorA.setHex(0x132E3F).lerp(tmpColorB.setHex(0x38BDF8), smoothstep(-0.2, 0.55, wave));
          tmpColorA.lerp(tmpColorC.setHex(0xC6F135), smoothstep(0.58, 0.95, wave));
          compute.gpu.smInst.setColorAt(sm.idx, tmpColorA);
        });
        compute.gpu.smInst.instanceMatrix.needsUpdate = true;
        compute.gpu.smInst.instanceColor.needsUpdate = true;
      }
      compute.gpu.gpuToCpuPulses.forEach((p) => {
        const t = (clockSec * p.speed + p.offset) % 1;
        p.curve.getPointAt(t, p.mesh.position);
      });

      /* ---------- STAGE 08: EXECUTING CPU PIPELINE, RING BUS & CONDITIONAL BRANCHES ---------- */
      const clockPulse = 0.5 + 0.5 * Math.sin(clockSec * 6.0);
      compute.cpu.clockRing.scale.setScalar(0.92 + clockPulse * 0.14);

      // L3 Ring Bus deterministic orbiting tokens
      compute.cpu.ringTokens.forEach((rt) => {
        const ang = clockSec * 1.45 + rt.phase;
        rt.mesh.position.set(Math.cos(ang) * compute.cpu.ringRadius, 0.40, Math.sin(ang) * compute.cpu.ringRadius);
        rt.mesh.rotation.y = -ang;
      });

      // 4-Stage Stepped Instruction Pipeline (FETCH -> DECODE -> EXECUTE -> WRITEBACK)
      const activePipe = Math.floor(clockSec * 2.6) % 4;
      compute.cpu.pipelineStages.forEach((ps) => {
        const isAct = ps.idx === activePipe;
        ps.mesh.position.y = 0.42 + (isAct ? 0.08 : 0);
        ps.edgeMat.color.setHex(isAct ? 0xC6F135 : 0x38BDF8);
        ps.edgeMat.opacity = isAct ? 1.0 : 0.35;
        ps.mat.emissive.setHex(isAct ? 0x2B4208 : 0x061014);
      });

      // Surrounding Multi-Core Execution Clusters synchronized to clock
      compute.cpu.coreModules.forEach((cm) => {
        const w = 0.5 + 0.5 * Math.sin(clockSec * 3.6 + cm.phase);
        cm.edgeMat.color.setHex(w > 0.72 ? 0xC6F135 : 0x38BDF8);
        cm.edgeMat.opacity = 0.25 + w * 0.72;
      });

      // Conditional Branching Logic (only selected branch lights lime; others stay dark!)
      const activeBranch = Math.floor(clockSec * 1.4) % compute.cpu.branchPaths.length;
      compute.cpu.branchPaths.forEach((bp) => {
        bp.mat.opacity = bp.idx === activeBranch ? 0.95 : 0.12;
      });

      /* ---------- STAGE 09: DIRECTIONAL BINARY (0/1) MORPHING INTO ELECTRICAL PULSES ---------- */
      compute.binary.dataTrains.forEach((dtItem) => {
        const t = (clockSec * dtItem.speed + dtItem.offset) % 1;
        dtItem.curve.getPointAt(t, tmpVec);
        // First half: crisp directional 0/1 binary glyphs; Second half: smoothly morphs into electrical pulse!
        const morph = smoothstep(0.42, 0.66, t);
        const bitScale = (1 - morph) * smoothstep(0.0, 0.08, t);
        dtItem.bitMesh.visible = bitScale > 0.04;
        if (dtItem.bitMesh.visible) {
          dtItem.bitMesh.position.set(tmpVec.x, tmpVec.y + 0.26, tmpVec.z);
          dtItem.bitMesh.scale.setScalar(bitScale);
        }
        const elecScale = morph * (1 - smoothstep(0.94, 1.0, t));
        dtItem.elecMesh.visible = elecScale > 0.04;
        if (dtItem.elecMesh.visible) {
          dtItem.elecMesh.position.set(tmpVec.x, tmpVec.y + 0.05, tmpVec.z);
          dtItem.elecMesh.scale.set(0.45 + elecScale * 0.9, 1, 1);
        }
      });

      /* ---------- STAGE 10: PCIe NIC CONTROLLER & OPTICAL FIBER PATCH ---------- */
      compute.nic.ledLinkMat.color.setHex(Math.sin(clockSec * 12.0) > -0.3 ? 0xC6F135 : 0x263814);
      compute.nic.ledActMat.color.setHex(Math.sin(clockSec * 29.0) > 0.1 ? 0xF59E0B : 0x2A1A08);
      compute.nic.fiberPulses.forEach((fp) => {
        const t = (clockSec * fp.speed + fp.offset) % 1;
        fp.curve.getPointAt(t, fp.mesh.position);
      });

      /* ---------- STAGE 11: CORE ROUTER, CONNECTED MESH & ORBITAL UPLINK ---------- */
      const sweepLed = Math.floor(clockSec * 7.5) % compute.router.frontLeds.length;
      compute.router.frontLeds.forEach((fl) => {
        const d = Math.abs(fl.idx - sweepLed);
        fl.mat.color.setHex(d === 0 ? 0xC6F135 : d === 1 ? 0x38BDF8 : 0x1A2830);
      });
      compute.router.rfRings.forEach((rm, ri) => {
        const ru = (clockSec * 0.65 + ri / 5) % 1;
        rm.scale.setScalar(0.55 + ru * 5.2);
        rm.position.y = 3.5 + ru * 2.4;
        rm.material.opacity = (1 - ru) * 0.72;
      });
      compute.router.meshPulses.forEach((mp) => {
        const t = (clockSec * mp.speed + mp.offset) % 1;
        mp.curve.getPointAt(t, mp.mesh.position);
      });
      compute.router.trunkPulses.forEach((tp) => {
        const t = (clockSec * tp.speed + tp.offset) % 1;
        tp.curve.getPointAt(t, tp.mesh.position);
      });

      /* ---------- CAMERA RIG + DYNAMIC LIGHTING / ATMOSPHERE MOOD ---------- */
      // During Stage 05 Signal Dive, smoothly lock camera tracking onto the live RF Carrier!
      const sigTrackW = smoothstep(0.412, 0.430, uNow) * (1 - smoothstep(0.478, 0.494, uNow));
      const camState = rig.update(
        uNow,
        dt,
        clockSec,
        pointer,
        scrollCur,
        instantCam,
        sigActive ? space.signal.carrier.position : null,
        sigTrackW * 0.85
      );

      // Keep lights anchored smoothly around the active camera theater for consistent cinema rim lighting
      keyLight.position.set(camState.look.x + 14, camState.look.y + 18, camState.look.z + 16);
      keyLight.target.position.copy(camState.look);
      rimLight.position.set(camState.look.x - 16, camState.look.y + 9, camState.look.z - 12);
      rimLight.target.position.copy(camState.look);

      // Dynamic focal Accent Point Light follows the protagonist energy source!
      accentPoint.position.set(camState.look.x, camState.look.y + 2.2, camState.look.z + 3.2);
      accentPoint.color.setHex(st.accentHex);
      accentPoint.intensity = st.idx === 0 ? (1.2 + ignPower * 4.5) : (st.idx === 4 ? 3.8 : 2.8);

      // Smooth Fog density & atmosphere transition from Pad -> Deep Space -> Dark Silicon Hall
      const nextSt = config.STAGES[Math.min(config.STAGES.length - 1, st.idx + 1)];
      const moodBlend = smoothstep(0.75, 1.0, localT);
      fog.density = lerp(st.fogDensity, nextSt.fogDensity, moodBlend);
      tmpColorA.setHex(st.skyHex).lerp(tmpColorB.setHex(nextSt.skyHex), moodBlend);
      renderer.setClearColor(tmpColorA, 1);
      fog.color.copy(tmpColorA);

      // Silky nocturnal dissolve ONLY at the exact ground-fiber-to-launch-pad seam (0.985 -> 0.015)
      if (veilOverlay) {
        const seamFade = Math.max(smootherstep(0.984, 1.0, uNow), 1 - smootherstep(0.0, 0.016, uNow));
        veilOverlay.style.opacity = (seamFade * 0.94).toFixed(3);
      }

      renderer.render(scene, camera);
    }

    function stepFrame(dt) {
      const k = 1 - Math.exp(-dt * 0.006);
      if (!helpers.prefersReducedMotion) clockSec += dt * 0.001;

      if (!helpers.isFinePointer && !helpers.prefersReducedMotion) {
        pointer.x = Math.sin(clockSec * 0.35) * 0.3;
        pointer.y = Math.cos(clockSec * 0.28) * 0.14;
      }
      pointer.sx += (pointer.x - pointer.sx) * k;
      pointer.sy += (pointer.y - pointer.sy) * k;

      const targetScroll = clamp((window.scrollY || 0) / Math.max(1, section.offsetHeight), 0, 1);
      scrollCur += (targetScroll - scrollCur) * k;

      // Smooth quintic camera fly-through when user selects any stage (ZERO teleport!)
      if (seek) {
        seek.elapsed += dt * 0.001;
        const t = clamp(seek.elapsed / seek.dur, 0, 1);
        u = lerp(seek.from, seek.to, easeInOutQuint(t));
        if (t >= 1) {
          u = seek.to;
          seek = null;
        }
      } else if (playing && !helpers.prefersReducedMotion) {
        u = (u + (dt * 0.001) / config.CYCLE_SEC) % 1.0;
      }

      evaluateWorld(u, dt, false);
    }

    layout();
    let frameAcc = 0;
    const minFrameMs = isLowSpec ? 27 : 0;
    const loop = helpers.createLoop((dt) => {
      if (minFrameMs) {
        frameAcc += dt;
        if (frameAcc < minFrameMs) return;
        const step = frameAcc;
        frameAcc = 0;
        stepFrame(step);
        return;
      }
      stepFrame(dt);
    });

    // Smooth animated stage navigation (never hard-cuts on user click!)
    uiCtrl.onSelectStage((idx) => {
      const target = config.STAGES[clamp(idx, 0, config.STAGES.length - 1)];
      if (!target) return;
      if (helpers.prefersReducedMotion) {
        seek = null;
        u = target.focusU;
        evaluateWorld(u, 16.7, true);
        return;
      }
      const dist = Math.abs(target.focusU - u);
      const dur = clamp(0.85 + dist * 2.1, 0.85, 2.15);
      seek = { from: u, to: target.focusU, elapsed: 0, dur };
      if (!loop.running) loop.start();
    });

    uiCtrl.onTogglePlay(() => {
      playing = !playing;
      uiCtrl.setPlaying(playing);
      if (playing && !loop.running) loop.start();
    });

    // Clean inspection/testing handle
    window.__HERO_MISSION__ = {
      setPlaying(val) {
        playing = Boolean(val);
        if (playing && !loop.running) loop.start();
      },
      setU(val, instant = true) {
        seek = null;
        u = clamp(val, 0, 0.9999);
        clockSec = u * config.CYCLE_SEC;
        evaluateWorld(u, 16.7, instant);
      },
      seekTo(idx, instant = false) {
        const target = config.STAGES[clamp(idx, 0, config.STAGES.length - 1)];
        if (!target) return;
        if (instant) {
          seek = null;
          u = target.focusU;
          clockSec = u * config.CYCLE_SEC;
          evaluateWorld(u, 16.7, true);
        } else {
          const dist = Math.abs(target.focusU - u);
          seek = { from: u, to: target.focusU, elapsed: 0, dur: clamp(0.85 + dist * 2.1, 0.85, 2.15) };
        }
      },
      getState() {
        const st = config.getStageForU(u);
        return {
          engine: 'webgl',
          u,
          stageIdx: st.idx,
          stageId: st.id,
          stageCode: st.code,
          seeking: Boolean(seek),
          playing
        };
      }
    };

    if (helpers.isFinePointer && !helpers.prefersReducedMotion) {
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || !loop.running) return;
        pointer.x = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
        pointer.y = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      }, { passive: true });
    }

    evaluateWorld(u, 16.7, true);
    wrap.classList.add('is-ready');

    if (!helpers.prefersReducedMotion) {
      helpers.bindVisibility(wrap, (vis) => (vis ? loop.start() : loop.stop()), '80px');
    }

    let resizeRaf = 0;
    new ResizeObserver(() => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        layout();
        evaluateWorld(u, 0, true);
      });
    }).observe(wrap);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      loop.stop();
    });
  }

  function init(helpers) {
    const canvas = document.getElementById('topology-canvas');
    const wrap = document.getElementById('hero-canvas-wrap');
    if (!canvas || !wrap || !root.CONFIG) return;

    const uiCtrl = createMissionUI(root.CONFIG);
    uiCtrl.setPlaying(!helpers.prefersReducedMotion);

    let settled = false;
    const fallback = (cv) => {
      if (settled) return;
      settled = true;
      root.initFallback2D(cv || canvas, wrap, uiCtrl, helpers);
    };

    if (!helpers.webglSupported || !helpers.dynImport) {
      fallback();
      return;
    }

    const timeout = setTimeout(() => fallback(), 8000);
    helpers.loadThree()
      .then((THREE) => {
        if (settled) return;
        clearTimeout(timeout);
        settled = true;
        try {
          initWebGL(THREE, canvas, wrap, uiCtrl, helpers);
        } catch (err) {
          console.warn('[journey-3d] WebGL failed — Canvas 2D fallback.', err);
          settled = false;
          fallback(helpers.freshCanvas(canvas));
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        fallback();
      });
  }

  root.init = init;
})();
