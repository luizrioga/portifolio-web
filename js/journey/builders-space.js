/* ==========================================================================
   SPACE-TO-COMPUTE JOURNEY — SPACE & AEROSPACE BUILDERS (STAGES 01 – 05)
   Launch Pad, Mechazilla Truss, Super Heavy + Starship, Fresnel Earth,
   Multi-Panel Accordion Satellite + Constellation, Structured Downlink Carrier.
   ========================================================================== */
(() => {
  'use strict';

  const root = (window.SpaceComputeJourney = window.SpaceComputeJourney || {});

  function buildLatticeGridFin(THREE, mats) {
    const g = new THREE.Group();
    // Outer beveled titanium frame
    const framePts = [];
    const w = 0.34, h = 0.16, d = 0.34;
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const box = new THREE.BoxGeometry(w, h, d);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(box), mats.edgeInk);
    g.add(frame);
    // Internal waffle lattice ribs
    for (let i = -1; i <= 1; i++) {
      const o = i * 0.085;
      framePts.push(new THREE.Vector3(o, -hh, -hd), new THREE.Vector3(o, hh, -hd));
      framePts.push(new THREE.Vector3(o, -hh, hd), new THREE.Vector3(o, hh, hd));
      framePts.push(new THREE.Vector3(-hw, 0, o), new THREE.Vector3(hw, 0, o));
      framePts.push(new THREE.Vector3(o, 0, -hd), new THREE.Vector3(o, 0, hd));
    }
    const latticeGeo = new THREE.BufferGeometry().setFromPoints(framePts);
    g.add(new THREE.LineSegments(latticeGeo, mats.edgeLime));
    const core = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.35, d * 0.94), mats.chassisDark);
    g.add(core);
    return g;
  }

  function buildSuperHeavy(THREE, mats) {
    const g = new THREE.Group();
    const radius = 0.42;
    const bodyH = 4.35;

    // Brushed stainless-steel booster cylinder
    const bodyGeo = new THREE.CylinderGeometry(radius, radius * 1.02, bodyH, 24);
    const body = new THREE.Mesh(bodyGeo, mats.hullSteel);
    g.add(body);
    mats.addEdges(body, bodyGeo, mats.edgeDim, 28);

    // Subtle horizontal tank weld-seam rings
    [-1.4, -0.45, 0.5, 1.45].forEach((ry) => {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.006, 0.008, 6, 28), mats.hullBright);
      seam.rotation.x = Math.PI / 2;
      seam.position.y = ry;
      g.add(seam);
    });

    // Twin vertical external propellant raceways
    [-1, 1].forEach((side) => {
      mats.makeBox(g, 0.055, bodyH * 0.86, 0.075, mats.hullBright, mats.edgeDim, [side * (radius + 0.02), -0.05, 0]);
    });

    // Dark aft engine skirt shroud
    const skirtGeo = new THREE.CylinderGeometry(radius * 1.03, radius * 1.08, 0.46, 24);
    const skirt = new THREE.Mesh(skirtGeo, mats.heatshield);
    skirt.position.y = -bodyH / 2 - 0.14;
    mats.addEdges(skirt, skirtGeo, mats.edgeInk, 25);
    g.add(skirt);

    // 13 Visible Concentric Raptor Engine Bells (1 center + 4 inner + 8 outer)
    const bellGeo = new THREE.CylinderGeometry(0.042, 0.072, 0.22, 10, 1, true);
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0x262C30,
      roughness: 0.35,
      metalness: 0.85,
      side: THREE.DoubleSide
    });
    const bellPositions = [[0, 0]];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      bellPositions.push([Math.cos(a) * 0.14, Math.sin(a) * 0.14]);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      bellPositions.push([Math.cos(a) * 0.29, Math.sin(a) * 0.29]);
    }
    bellPositions.forEach(([bx, bz]) => {
      const bell = new THREE.Mesh(bellGeo, bellMat);
      bell.position.set(bx, -bodyH / 2 - 0.38, bz);
      g.add(bell);
    });

    // Hot-Staging Vented Interstage Ring (glows amber during stage separation)
    const interstage = new THREE.Group();
    interstage.position.y = bodyH / 2 + 0.17;
    const isGeo = new THREE.CylinderGeometry(radius * 1.01, radius * 1.01, 0.34, 24);
    const isMesh = new THREE.Mesh(isGeo, mats.chassisDark);
    mats.addEdges(isMesh, isGeo, mats.edgeAmber, 22);
    interstage.add(isMesh);

    const hotVentMat = new THREE.MeshBasicMaterial({
      color: 0xF59E0B,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    const ventRing = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, 0.14, 20, 1, true), hotVentMat);
    interstage.add(ventRing);
    g.add(interstage);

    // 4 Lattice Grid Fins
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = buildLatticeGridFin(THREE, mats);
      fin.position.set(Math.cos(a) * (radius + 0.2), bodyH / 2 - 0.36, Math.sin(a) * (radius + 0.2));
      fin.rotation.y = -a;
      g.add(fin);
    }

    // Multi-Layer Volumetric Methalox Raptor Plume (Outer Turbulent Shear Mantle + Inner Mach-Diamond Core + Sparks)
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = -bodyH / 2 - 0.42;

    const outerPlumeGeo = new THREE.ConeGeometry(0.68, 5.4, 28, 12, true);
    outerPlumeGeo.rotateX(Math.PI);
    outerPlumeGeo.translate(0, -2.7, 0);
    const outerPlumeMesh = new THREE.Mesh(outerPlumeGeo, mats.boosterPlumeShader);
    plumeGroup.add(outerPlumeMesh);

    const innerPlumeGeo = new THREE.ConeGeometry(0.36, 3.55, 22, 8, true);
    innerPlumeGeo.rotateX(Math.PI);
    innerPlumeGeo.translate(0, -1.78, 0);
    const innerPlumeMesh = new THREE.Mesh(innerPlumeGeo, mats.boosterCoreShader);
    plumeGroup.add(innerPlumeMesh);

    // Incandescent Nozzle Throat Cluster Disc
    const throatDiscMat = new THREE.MeshBasicMaterial({
      color: 0xFFF6D6,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const throatDisc = new THREE.Mesh(new THREE.CircleGeometry(0.38, 22), throatDiscMat);
    throatDisc.rotation.x = Math.PI / 2;
    throatDisc.position.y = -0.02;
    plumeGroup.add(throatDisc);

    // Supersonic Exhaust Spark Embers rushing downward from Raptor bells
    const sparkCount = 44;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkMeta = [];
    const sRand = root.CONFIG.math.mulberry32(7712);
    for (let i = 0; i < sparkCount; i++) {
      sparkMeta.push({
        ang: sRand() * Math.PI * 2,
        rad: 0.06 + sRand() * 0.42,
        speed: 1.4 + sRand() * 1.9,
        phase: sRand(),
        len: 2.6 + sRand() * 2.8
      });
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      map: mats.textures.glowTex,
      color: 0xFFDF9E,
      size: 0.22,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    plumeGroup.add(new THREE.Points(sparkGeo, sparkMat));

    const engineFlare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mats.textures.glowTex,
        color: 0xFFC65C,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    engineFlare.scale.set(3.4, 3.0, 1);
    engineFlare.position.y = -0.22;
    plumeGroup.add(engineFlare);
    g.add(plumeGroup);

    // Cold-gas RCS Attitude Jets (visible when Booster flips away after separation)
    const rcsMat = new THREE.MeshBasicMaterial({
      color: 0xD8F2FF,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const rcsJet = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.72, 10, 1, true), rcsMat);
    rcsJet.rotation.z = Math.PI / 2;
    rcsJet.position.set(radius + 0.36, bodyH / 2 - 0.22, 0);
    g.add(rcsJet);

    return {
      group: g,
      plumeGroup,
      engineFlare,
      throatDiscMat,
      sparkGeo,
      sparkPos,
      sparkMeta,
      sparkMat,
      hotVentMat,
      rcsMat,
      topY: bodyH / 2 + 0.34,
      bottomY: -bodyH / 2 - 0.42
    };
  }

  function buildStarship(THREE, mats) {
    const g = new THREE.Group();
    const r = 0.42;

    // Authentic Starship Ogive Profile via LatheGeometry (cylindrical tank + curved tapered nose)
    const profile = [];
    profile.push(new THREE.Vector2(r * 0.96, -1.55));
    profile.push(new THREE.Vector2(r, -1.48));
    profile.push(new THREE.Vector2(r, 0.48));
    for (let i = 1; i <= 14; i++) {
      const t = i / 14;
      const rad = r * Math.pow(Math.cos(t * Math.PI * 0.5), 0.74);
      const y = 0.48 + t * 1.48;
      profile.push(new THREE.Vector2(Math.max(0.015, rad), y));
    }
    const hullGeo = new THREE.LatheGeometry(profile, 28);
    const hull = new THREE.Mesh(hullGeo, mats.hullBright);
    mats.addEdges(hull, hullGeo, mats.edgeDim, 32);
    g.add(hull);

    // Ventral Dark Ceramic Heatshield Belly (windward half-cylinder overlay)
    const shieldGeo = new THREE.CylinderGeometry(r + 0.01, r + 0.01, 1.98, 16, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
    const shield = new THREE.Mesh(shieldGeo, mats.heatshield);
    shield.position.y = -0.5;
    g.add(shield);

    // Sculpted Forward & Aft Aerodynamic Flaps
    [-1, 1].forEach((side) => {
      // Aft flap (trapezoidal tapered fin)
      const aftShape = new THREE.Shape();
      aftShape.moveTo(0, -0.55);
      aftShape.lineTo(0.42 * side, -0.52);
      aftShape.lineTo(0.32 * side, 0.38);
      aftShape.lineTo(0, 0.56);
      aftShape.closePath();
      const aftGeo = new THREE.ExtrudeGeometry(aftShape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
      aftGeo.translate(0, 0, -0.022);
      const aft = new THREE.Mesh(aftGeo, mats.heatshield);
      aft.position.set(side * (r - 0.02), -0.92, 0);
      mats.addEdges(aft, aftGeo, mats.edgeInk, 24);
      g.add(aft);

      // Forward canard flap
      const fwdShape = new THREE.Shape();
      fwdShape.moveTo(0, -0.22);
      fwdShape.lineTo(0.28 * side, -0.18);
      fwdShape.lineTo(0.18 * side, 0.24);
      fwdShape.lineTo(0, 0.34);
      fwdShape.closePath();
      const fwdGeo = new THREE.ExtrudeGeometry(fwdShape, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
      fwdGeo.translate(0, 0, -0.018);
      const fwd = new THREE.Mesh(fwdGeo, mats.heatshield);
      fwd.position.set(side * (r * 0.72), 1.18, 0);
      mats.addEdges(fwd, fwdGeo, mats.edgeCyan, 24);
      g.add(fwd);
    });

    // Realistic Flush-Fitted Curved Cylindrical Twin Clamshell Payload Bay Doors (dorsal -X -> World +Y in LEO!)
    const baySpan = 0.56; // half-angle per curved door shell (~32 deg each, 64 deg total aperture)
    const bayLen = 0.96;
    const bayYCenter = 0.58;
    const hingeX = -r * Math.cos(baySpan);
    const hingeZ = r * Math.sin(baySpan);

    const doorShellMat = new THREE.MeshStandardMaterial({
      color: 0x8A9BA8,
      roughness: 0.22,
      metalness: 0.86,
      side: THREE.DoubleSide
    });

    // Positive-Z curved dorsal shell petal (hinged along +Z longitudinal seam)
    const bayPivotPos = new THREE.Group();
    bayPivotPos.position.set(hingeX, bayYCenter, hingeZ);
    const doorPosGeo = new THREE.CylinderGeometry(r + 0.008, r + 0.008, bayLen, 14, 1, true, -Math.PI * 0.5, baySpan);
    doorPosGeo.translate(-hingeX, 0, -hingeZ);
    const doorPosMesh = new THREE.Mesh(doorPosGeo, doorShellMat);
    mats.addEdges(doorPosMesh, doorPosGeo, mats.edgeInk, 24);
    bayPivotPos.add(doorPosMesh);
    g.add(bayPivotPos);

    // Negative-Z curved dorsal shell petal (hinged along -Z longitudinal seam)
    const bayPivotNeg = new THREE.Group();
    bayPivotNeg.position.set(hingeX, bayYCenter, -hingeZ);
    const doorNegGeo = new THREE.CylinderGeometry(r + 0.008, r + 0.008, bayLen, 14, 1, true, -Math.PI * 0.5 - baySpan, baySpan);
    doorNegGeo.translate(-hingeX, 0, hingeZ);
    const doorNegMesh = new THREE.Mesh(doorNegGeo, doorShellMat);
    mats.addEdges(doorNegMesh, doorNegGeo, mats.edgeInk, 24);
    bayPivotNeg.add(doorNegMesh);
    g.add(bayPivotNeg);

    // Recessed Dark Carbon Payload Bay Liner + Delicate Cold-White Internal Strip Lights (Zero clunky cyan box!)
    const bayLinerGeo = new THREE.CylinderGeometry(r - 0.014, r - 0.014, bayLen * 0.96, 12, 1, true, -Math.PI * 0.5 - baySpan * 0.94, baySpan * 1.88);
    const bayLiner = new THREE.Mesh(
      bayLinerGeo,
      new THREE.MeshStandardMaterial({ color: 0x0B0F12, roughness: 0.82, metalness: 0.22, side: THREE.DoubleSide })
    );
    bayLiner.position.y = bayYCenter;
    g.add(bayLiner);

    const bayLightMat = new THREE.MeshBasicMaterial({
      color: 0xD8F2FF,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    [-0.16, 0.16].forEach((rz) => {
      // Slim metallic dispenser rail + thin recessed interior LED light strip
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, bayLen * 0.82, 0.025), mats.heatsinkAlum);
      rail.position.set(-r * 0.88, bayYCenter, rz);
      g.add(rail);
      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.018, bayLen * 0.78, 0.016), bayLightMat);
      ledStrip.position.set(-r * 0.90, bayYCenter, rz * 1.15);
      g.add(ledStrip);
    });

    // 3 Raptor Vacuum Engine Bells
    const vacBellGeo = new THREE.CylinderGeometry(0.06, 0.13, 0.32, 14, 1, true);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const vb = new THREE.Mesh(vacBellGeo, mats.chassisMid);
      vb.position.set(Math.cos(a) * 0.16, -1.68, Math.sin(a) * 0.16);
      g.add(vb);
    }

    // Authentic Parabolic Bell-Expanded Methalox Vacuum Plume (LatheGeometry Chalice + Inner Bright Core)
    const vacPlumeGroup = new THREE.Group();
    vacPlumeGroup.position.y = -1.78;
    const vacPts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const rad = 0.20 + Math.pow(t, 0.62) * 0.72;
      vacPts.push(new THREE.Vector2(rad, -t * 3.85));
    }
    const vacGeo = new THREE.LatheGeometry(vacPts, 28);
    const vacMesh = new THREE.Mesh(vacGeo, mats.vacuumPlumeShader);
    vacPlumeGroup.add(vacMesh);

    const vacCorePts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const rad = 0.11 + Math.pow(t, 0.75) * 0.26;
      vacCorePts.push(new THREE.Vector2(rad, -t * 2.1));
    }
    const vacCoreMesh = new THREE.Mesh(new THREE.LatheGeometry(vacCorePts, 20), mats.vacuumPlumeShader);
    vacPlumeGroup.add(vacCoreMesh);

    const vacFlare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mats.textures.glowTex,
        color: 0x86D8FF,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    vacFlare.scale.set(1.75, 1.75, 1);
    vacFlare.position.y = -0.14;
    vacPlumeGroup.add(vacFlare);
    g.add(vacPlumeGroup);

    return {
      group: g,
      bayPivotPos,
      bayPivotNeg,
      bayLightMat,
      vacPlumeGroup,
      vacFlare
    };
  }

  function buildLaunchComplex(THREE, mats, isCompact) {
    const g = new THREE.Group();

    // Concrete Launch Apron + Precision Concentric Ground Rings
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.2, 0.18, 36), mats.padConcrete);
    apron.position.y = -0.12;
    g.add(apron);

    [1.8, 3.2, 5.2].forEach((rad, ri) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(rad - 0.02, rad + 0.02, 48),
        new THREE.MeshBasicMaterial({ color: ri === 0 ? 0xF59E0B : 0x38BDF8, transparent: true, opacity: ri === 0 ? 0.36 : 0.14, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      g.add(ring);
    });

    const padGrid = new THREE.GridHelper(22, 26, 0x1E292E, 0x0E1315);
    padGrid.position.y = -0.02;
    g.add(padGrid);

    // Orbital Launch Mount (Octagonal Collar + 6 Reinforced Angled Columns + Flame Trench Glow)
    const mountCollarGeo = new THREE.CylinderGeometry(1.18, 1.32, 0.42, 8);
    const mountCollar = new THREE.Mesh(mountCollarGeo, mats.towerSteel);
    mountCollar.position.y = 1.05;
    mats.addEdges(mountCollar, mountCollarGeo, mats.edgeInk, 20);
    g.add(mountCollar);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = mats.makeBox(g, 0.24, 1.24, 0.28, mats.towerSteel, mats.edgeDim, [Math.cos(a) * 1.18, 0.56, Math.sin(a) * 1.18]);
      leg.rotation.y = -a;
      leg.rotation.z = 0.16;
    }

    const trenchGlowMat = new THREE.MeshBasicMaterial({
      color: 0xF59E0B,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const trenchDisc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 28), trenchGlowMat);
    trenchDisc.rotation.x = -Math.PI / 2;
    trenchDisc.position.y = 0.03;
    g.add(trenchDisc);

    // 4 Perimeter Aviation Warning Beacons
    const beacons = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const post = mats.makeBox(g, 0.06, 0.42, 0.06, mats.towerSteel, null, [Math.cos(a) * 3.1, 0.21, Math.sin(a) * 3.1]);
      const bm = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), bm);
      orb.position.set(Math.cos(a) * 3.1, 0.46, Math.sin(a) * 3.1);
      g.add(orb);
      beacons.push({ mat: bm, phase: i * 0.75 });
    }

    // Mechazilla / Orbital Catch Tower with Full X-Braced Lattice Truss (Single LineSegments Draw Call!)
    const towerX = -2.35;
    const towerZ = -0.32;
    const towerW = 0.92;
    const towerH = 9.4;
    const levels = 12;
    const hw = towerW / 2;
    const trussPts = [];
    const corners = [
      [-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]
    ];
    // 4 vertical chords
    corners.forEach(([cx, cz]) => {
      trussPts.push(new THREE.Vector3(cx, 0, cz), new THREE.Vector3(cx, towerH, cz));
    });
    // Horizontal girts & X-bracing diagonals on all 4 faces
    for (let lv = 0; lv < levels; lv++) {
      const y0 = (lv / levels) * towerH;
      const y1 = ((lv + 1) / levels) * towerH;
      for (let f = 0; f < 4; f++) {
        const [ax, az] = corners[f];
        const [bx, bz] = corners[(f + 1) % 4];
        trussPts.push(new THREE.Vector3(ax, y1, az), new THREE.Vector3(bx, y1, bz));
        trussPts.push(new THREE.Vector3(ax, y0, az), new THREE.Vector3(bx, y1, bz));
        trussPts.push(new THREE.Vector3(bx, y0, bz), new THREE.Vector3(ax, y1, az));
      }
    }
    const towerGroup = new THREE.Group();
    towerGroup.position.set(towerX, 0, towerZ);
    const towerCore = new THREE.Mesh(new THREE.BoxGeometry(towerW * 0.82, towerH, towerW * 0.82), mats.chassisDark);
    towerCore.position.y = towerH / 2;
    towerGroup.add(towerCore);
    towerGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(trussPts), mats.edgeDim));

    // Tower Crown Aviation Warning Beacon (Clean aerospace beacon — zero sci-fi sky lightning!)
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
    const crownOrb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), crownMat);
    crownOrb.position.set(0, towerH + 0.14, 0);
    towerGroup.add(crownOrb);
    beacons.push({ mat: crownMat, phase: 0.2 });

    // Ground-Level Launch Control Optical Fiber Conduit (Real underground telemetry feed into Orbital Launch Mount!)
    const padFiberCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.5, 0.04, 1.35),
      new THREE.Vector3(-4.2, 0.04, 0.95),
      new THREE.Vector3(-2.35, 0.04, 0.35),
      new THREE.Vector3(-1.1, 0.04, 0.0)
    ]);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(padFiberCurve.getPoints(32)), mats.edgeCyanDim));
    const padFiberPulses = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.06), i % 2 === 0 ? mats.glowCyan : mats.glowLime);
      g.add(p);
      padFiberPulses.push({ mesh: p, curve: padFiberCurve, offset: i / 4, speed: 0.55 });
    }

    // Articulating Chopstick Catch Arms + Quick-Disconnect Umbilical Arm
    const armL = new THREE.Group();
    armL.position.set(hw, 5.55, -0.26);
    mats.makeBox(armL, 2.35, 0.16, 0.14, mats.chassisMid, mats.edgeLime, [1.15, 0, 0]);
    const armR = new THREE.Group();
    armR.position.set(hw, 5.55, 0.26);
    mats.makeBox(armR, 2.35, 0.16, 0.14, mats.chassisMid, mats.edgeLime, [1.15, 0, 0]);
    const qdArm = new THREE.Group();
    qdArm.position.set(hw, 7.15, 0.08);
    mats.makeBox(qdArm, 1.95, 0.1, 0.12, mats.chassisMid, mats.edgeCyan, [0.95, 0, 0]);
    towerGroup.add(armL, armR, qdArm);
    g.add(towerGroup);

    // Exhaust Shockwave Rings expanding from pad during ignition
    const shockRings = [];
    for (let i = 0; i < 3; i++) {
      const rm = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.032, 8, 42),
        new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      rm.rotation.x = Math.PI / 2;
      rm.position.y = 0.08;
      g.add(rm);
      shockRings.push(rm);
    }

    // Cryogenic Pre-Launch Venting Mist & Ignition Billowing Exhaust Cloud Pool (Single Points Draw Call!)
    const cloudCount = isCompact ? 64 : 130;
    const cloudPos = new Float32Array(cloudCount * 3);
    const cloudMeta = [];
    const rand = root.CONFIG.math.mulberry32(9901);
    for (let i = 0; i < cloudCount; i++) {
      const isCryo = i < Math.floor(cloudCount * 0.28);
      cloudMeta.push({
        isCryo,
        ang: rand() * Math.PI * 2,
        speed: 0.35 + rand() * 0.85,
        phase: rand(),
        spread: 0.7 + rand() * 1.4,
        yOff: isCryo ? 2.4 + rand() * 4.4 : 0.15 + rand() * 0.8
      });
    }
    const cloudGeo = new THREE.BufferGeometry();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
    const cloudMat = new THREE.PointsMaterial({
      map: mats.textures.cloudTex,
      color: 0xFFE6BE,
      size: isCompact ? 1.55 : 1.9,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const cloudPoints = new THREE.Points(cloudGeo, cloudMat);
    g.add(cloudPoints);

    return {
      group: g,
      armL,
      armR,
      qdArm,
      trenchGlowMat,
      beacons,
      shockRings,
      cloudGeo,
      cloudPos,
      cloudMeta,
      cloudMat,
      padFiberPulses
    };
  }

  function buildEarthSystem(THREE, mats, anchors) {
    const g = new THREE.Group();
    const [ex, ey, ez] = anchors.earthCenter;
    const R = anchors.earthRadius;
    g.position.set(ex, ey, ez);

    // Dark atmospheric planetary body
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 36), mats.earthDark);
    g.add(planet);

    // Crisp subtle scientific orbital latitude/longitude telemetry grid over planet
    const gridWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(R + 0.08, 28, 18)),
      new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.14 })
    );
    g.add(gridWire);

    // Custom GLSL Fresnel Atmospheric Cyan Limb Glow Shell
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.028, 48, 36), mats.atmosphereShader);
    g.add(atmo);

    // Thin Scientific LEO Orbital Trajectory Arcs surrounding the curved limb
    const orbitArcs = new THREE.Group();
    [R + 4.4, R + 6.0].forEach((orad, idx) => {
      const arcPts = [];
      for (let i = 0; i <= 72; i++) {
        const a = -0.68 + (i / 72) * 1.48;
        arcPts.push(new THREE.Vector3(Math.sin(a) * orad, Math.cos(a) * orad, 18.0 - idx * 2.2));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arcPts),
        new THREE.LineBasicMaterial({
          color: idx === 0 ? 0xC6F135 : 0x38BDF8,
          transparent: true,
          opacity: idx === 0 ? 0.36 : 0.24
        })
      );
      orbitArcs.add(line);
    });
    g.add(orbitArcs);

    return { group: g, planet, gridWire, orbitArcs };
  }

  // High-Craft Multi-Component Hero Satellite (Octagonal Bus, 6 Hinged Photovoltaic Panels, Gimbaled Parabolic Dish)
  function buildHeroSatellite(THREE, mats) {
    const g = new THREE.Group();

    // Chamfered Octagonal Avionics Bus
    const busGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.72, 8);
    busGeo.rotateZ(Math.PI / 2);
    const bus = new THREE.Mesh(busGeo, mats.chassisMid);
    mats.addEdges(bus, busGeo, mats.edgeInk, 18);
    g.add(bus);

    // Gold/Amber MLI Thermal Foil Endcap & Structural Collar
    const foilGeo = new THREE.CylinderGeometry(0.33, 0.35, 0.14, 8);
    foilGeo.rotateZ(Math.PI / 2);
    const foilL = new THREE.Mesh(foilGeo, mats.goldFoil);
    foilL.position.x = -0.34;
    const foilR = new THREE.Mesh(foilGeo, mats.goldFoil);
    foilR.position.x = 0.34;
    g.add(foilL, foilR);

    // Louvered Thermal Radiator Panels & Star-Tracker Optical Baffle
    mats.makeBox(g, 0.42, 0.05, 0.52, mats.chassisDark, mats.edgeCyanDim, [0, 0.38, 0]);
    const baffle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 10, 1, true), mats.hullBright);
    baffle.position.set(0.22, 0.42, 0.16);
    baffle.rotation.z = -0.35;
    g.add(baffle);

    // Multi-Panel Accordion-Folding Solar Array Wings (Yoke + 3 Hinged Panels per Wing!)
    function buildAccordionWing(side) {
      const rootPivot = new THREE.Group();
      rootPivot.position.set(0, 0, side * 0.38);

      // Structural deployment yoke boom
      mats.makeBox(rootPivot, 0.08, 0.06, 0.28, mats.hullBright, mats.edgeInk, [0, 0, side * 0.14]);

      const panels = [];
      let parentPivot = rootPivot;
      let offsetZ = side * 0.28;
      const panelLen = 0.74;
      const panelW = 0.46;

      for (let seg = 0; seg < 3; seg++) {
        const hinge = new THREE.Group();
        hinge.position.set(0, 0, offsetZ);
        const pGeo = new THREE.BoxGeometry(panelW, 0.022, panelLen);
        const pMesh = new THREE.Mesh(pGeo, mats.solarPanel);
        pMesh.position.set(0, 0, side * (panelLen * 0.5));
        mats.addEdges(pMesh, pGeo, mats.edgeCyan, 18);
        hinge.add(pMesh);

        // Articulated metallic hinge knuckle
        const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, panelW * 0.85, 8), mats.hullBright);
        knuckle.rotation.z = Math.PI / 2;
        hinge.add(knuckle);

        parentPivot.add(hinge);
        panels.push(hinge);
        parentPivot = hinge;
        offsetZ = side * panelLen;
      }
      return { rootPivot, panels };
    }

    const wingPos = buildAccordionWing(1);
    const wingNeg = buildAccordionWing(-1);
    g.add(wingPos.rootPivot, wingNeg.rootPivot);

    // Gimbaled High-Gain Parabolic Dish (LatheGeometry + 3-Strut Feedhorn Tripod + Ka-Band Emitter)
    const dishGimbal = new THREE.Group();
    dishGimbal.position.set(0.14, -0.38, 0);
    const dishPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      dishPts.push(new THREE.Vector2(t * 0.42, t * t * 0.16));
    }
    const dishGeo = new THREE.LatheGeometry(dishPts, 24);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x45525C,
      roughness: 0.26,
      metalness: 0.82,
      side: THREE.DoubleSide
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.rotation.x = Math.PI;
    mats.addEdges(dishMesh, dishGeo, mats.edgeCyan, 26);
    dishGimbal.add(dishMesh);

    // 3 Tripod Feedhorn Struts + Glowing Emitter Tip
    const emitterTipPos = new THREE.Vector3(0, -0.34, 0);
    const strutPts = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      strutPts.push(new THREE.Vector3(Math.cos(a) * 0.34, -0.1, Math.sin(a) * 0.34), emitterTipPos);
    }
    dishGimbal.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strutPts), mats.edgeInk));
    const emitterMat = new THREE.MeshBasicMaterial({ color: 0xC6F135 });
    const emitterOrb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), emitterMat);
    emitterOrb.position.copy(emitterTipPos);
    dishGimbal.add(emitterOrb);

    const emitterGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mats.textures.glowTex,
        color: 0xC6F135,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    emitterGlow.position.copy(emitterTipPos);
    emitterGlow.scale.set(0.75, 0.75, 1);
    dishGimbal.add(emitterGlow);
    g.add(dishGimbal);

    // Secondary Phased-Array Panel & Helical Whip Antenna
    mats.makeBox(g, 0.28, 0.04, 0.28, mats.chassisDark, mats.edgeLime, [-0.24, -0.38, 0]);
    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 0.45, 8), mats.hullBright);
    whip.position.set(-0.36, 0.24, -0.18);
    whip.rotation.z = 0.45;
    g.add(whip);

    // Expanding RF Transmission Rings at Dish Origin
    const txRings = [];
    for (let i = 0; i < 4; i++) {
      const rm = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.014, 8, 32),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xC6F135 : 0x38BDF8,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      rm.rotation.x = Math.PI / 2;
      rm.position.copy(emitterTipPos);
      dishGimbal.add(rm);
      txRings.push(rm);
    }

    return {
      group: g,
      wingPos,
      wingNeg,
      dishGimbal,
      emitterOrb,
      emitterGlow,
      txRings
    };
  }

  function buildConstellation(THREE, mats) {
    const g = new THREE.Group();
    const coords = [
      [29.5, 51.4, -10.5],
      [41.5, 49.8, -11.2],
      [33.0, 52.8, -15.0]
    ];
    const nodes = [];
    coords.forEach(([x, y, z]) => {
      const s = new THREE.Group();
      s.position.set(x, y, z);
      mats.makeBox(s, 0.36, 0.18, 0.22, mats.chassisMid, mats.edgeInk, [0, 0, 0]);
      mats.makeBox(s, 0.16, 0.02, 1.45, mats.solarPanel, mats.edgeCyanDim, [0, 0, 0]);
      g.add(s);
      nodes.push(s);
    });
    // Subtle inter-satellite laser links
    const linkPts = [
      new THREE.Vector3(...coords[0]), new THREE.Vector3(...coords[1]),
      new THREE.Vector3(...coords[0]), new THREE.Vector3(...coords[2]),
      new THREE.Vector3(...coords[2]), new THREE.Vector3(...coords[1])
    ];
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linkPts), mats.edgeCyanDim));
    return { group: g, nodes };
  }

  // Stage 05: Structured Electromagnetic Downlink Carrier + Dive Corridor
  function buildSignalCorridor(THREE, mats, anchors, isCompact) {
    const g = new THREE.Group();
    const [sx, sy, sz] = anchors.satDeployEnd;
    const [gx, gy, gz] = anchors.groundStation;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx + 0.2, sy - 0.7, sz),
      new THREE.Vector3(lerpNum(sx, gx, 0.32) + 1.0, lerpNum(sy, gy, 0.28), sz * 0.65),
      new THREE.Vector3(lerpNum(sx, gx, 0.68) + 0.5, lerpNum(sy, gy, 0.68), sz * 0.22),
      new THREE.Vector3(gx, gy + 0.45, gz)
    ]);

    // Delicate guiding electromagnetic waveguide line
    const guideMat = new THREE.LineBasicMaterial({
      color: 0x38BDF8,
      transparent: true,
      opacity: 0.28
    });
    const guideLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(72)), guideMat);
    g.add(guideLine);

    // Structured Multi-Layer Signal Carrier (Core + Bloom + Counter-Rotating Phase Rings + Trailing Phase Discs)
    const carrier = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 1), mats.glowWhite);
    carrier.add(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mats.textures.glowTex,
        color: 0xC6F135,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.scale.set(2.55, 2.55, 1);
    carrier.add(halo);

    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.026, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.94 })
    );
    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.02, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xC6F135, transparent: true, opacity: 0.78 })
    );
    ringB.rotation.x = Math.PI / 3;
    carrier.add(ringA, ringB);
    g.add(carrier);

    // Trailing Coherent Wavefront Rings following behind the carrier along the spline
    const trailRings = [];
    for (let i = 0; i < 6; i++) {
      const tr = new THREE.Mesh(
        new THREE.TorusGeometry(0.42 + i * 0.11, 0.022, 8, 32),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xC6F135 : 0x38BDF8,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      g.add(tr);
      trailRings.push(tr);
    }

    // Subtle Sparse Speed Filaments parallel to dive corridor (atmospheric depth cue)
    const filCount = isCompact ? 14 : 28;
    const rand = root.CONFIG.math.mulberry32(4412);
    const filPts = [];
    for (let i = 0; i < filCount; i++) {
      const t0 = 0.08 + rand() * 0.82;
      const p0 = curve.getPoint(t0);
      const tan = curve.getTangent(t0);
      const ang = rand() * Math.PI * 2;
      const rad = 1.6 + rand() * 3.8;
      const ox = Math.cos(ang) * rad;
      const oz = Math.sin(ang) * rad;
      const len = 1.4 + rand() * 2.2;
      filPts.push(
        new THREE.Vector3(p0.x + ox, p0.y, p0.z + oz),
        new THREE.Vector3(p0.x + ox + tan.x * len, p0.y + tan.y * len, p0.z + oz + tan.z * len)
      );
    }
    const filMat = new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.0 });
    const filaments = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(filPts), filMat);
    g.add(filaments);

    return {
      group: g,
      curve,
      guideMat,
      carrier,
      ringA,
      ringB,
      trailRings,
      filMat
    };
  }

  function lerpNum(a, b, t) {
    return a + (b - a) * t;
  }

  function buildSpaceWorld(THREE, mats, isCompact) {
    const anchors = root.CONFIG.ANCHORS;
    const group = new THREE.Group();

    const pad = buildLaunchComplex(THREE, mats, isCompact);
    const booster = buildSuperHeavy(THREE, mats);
    const starship = buildStarship(THREE, mats);
    const earth = buildEarthSystem(THREE, mats, anchors);
    const satellite = buildHeroSatellite(THREE, mats);
    const constellation = buildConstellation(THREE, mats);
    const signal = buildSignalCorridor(THREE, mats, anchors, isCompact);

    // Unified Rocket Stack Wrapper (Stage 01 combined, Stage 02 separates smoothly in world space!)
    const rocketAnchor = new THREE.Group();
    rocketAnchor.add(booster.group, starship.group);

    group.add(
      pad.group,
      rocketAnchor,
      earth.group,
      satellite.group,
      constellation.group,
      signal.group
    );

    return {
      group,
      pad,
      rocketAnchor,
      booster,
      starship,
      earth,
      satellite,
      constellation,
      signal
    };
  }

  root.buildSpaceWorld = buildSpaceWorld;
})();
