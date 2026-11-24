/* ==========================================================================
   SPACE-TO-COMPUTE JOURNEY — COMPUTE & NETWORK BUILDERS (STAGES 06 – 11)
   Ground Station + Architectural Database Vault -> Sculpted GPU (64 SM Cores)
   -> Executing CPU Pipeline & Ring Bus -> Directional Binary-to-Electrical PCB
   -> Detailed PCIe NIC -> Core Router & Connected Mesh Topology.
   ========================================================================== */
(() => {
  'use strict';

  const root = (window.SpaceComputeJourney = window.SpaceComputeJourney || {});

  function buildBusTrace(THREE, parent, pts, lineMat, pulseMat, count, speed, offsetSeed = 0) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(36)), lineMat);
    parent.add(line);
    const pulses = [];
    const geo = new THREE.BoxGeometry(0.32, 0.06, 0.08);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, pulseMat);
      parent.add(m);
      pulses.push({ mesh: m, curve, offset: (i / count + offsetSeed) % 1, speed });
    }
    return pulses;
  }

  /* ==========================================================================
     STAGE 06: GROUND RECEIVER ARRAY -> OPTICAL SHAFT -> DATABASE VAULT
     ========================================================================== */
  function buildDatabaseStage(THREE, mats, anchors) {
    const g = new THREE.Group();
    const [gx, gy, gz] = anchors.groundStation;
    const [vx, vy, vz] = anchors.dbVault;

    // 1. Architectural Ground Receiver Station at (48, 23, 0)
    const rxGroup = new THREE.Group();
    rxGroup.position.set(gx, gy, gz);

    // Octagonal concrete/steel receiver plinth
    const plinthGeo = new THREE.CylinderGeometry(2.6, 3.1, 0.48, 8);
    const plinth = new THREE.Mesh(plinthGeo, mats.chassisDark);
    plinth.position.y = -0.3;
    mats.addEdges(plinth, plinthGeo, mats.edgeCyanDim, 20);
    rxGroup.add(plinth);

    // Precision Parabolic Collector Dish facing skyward toward incoming satellite signal
    const dishPts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      dishPts.push(new THREE.Vector2(t * 2.1, t * t * 0.72));
    }
    const dishGeo = new THREE.LatheGeometry(dishPts, 32);
    const dish = new THREE.Mesh(dishGeo, mats.hullSteel);
    dish.position.y = -0.05;
    dish.rotation.z = 0.24;
    mats.addEdges(dish, dishGeo, mats.edgeCyan, 24);
    rxGroup.add(dish);

    // Collector Focal Hub & Capture Shockwave Halo
    const rxHaloMat = new THREE.MeshBasicMaterial({
      color: 0xC6F135,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const rxHalo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 8, 40), rxHaloMat);
    rxHalo.rotation.x = Math.PI / 2;
    rxHalo.position.y = 0.72;
    rxGroup.add(rxHalo);
    g.add(rxGroup);

    // 2. Vertical Optical Fiber Conduit Shaft connecting Receiver (y=23) -> Database Vault (y=10)
    const shaftH = gy - vy;
    const shaftMidY = (gy + vy) * 0.5;
    const shaftGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.76, shaftH, 20, 1, true),
      mats.glassVault
    );
    shaftGlass.position.set(vx, shaftMidY, vz);
    g.add(shaftGlass);

    const shaftPulses = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sx = vx + Math.cos(a) * 0.44;
      const sz = vz + Math.sin(a) * 0.44;
      const strandPts = [new THREE.Vector3(sx, gy - 0.2, sz), new THREE.Vector3(sx, vy + 0.1, sz)];
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(strandPts), i % 2 === 0 ? mats.edgeCyan : mats.edgeLime));

      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.52, 0.08),
        i % 2 === 0 ? mats.glowCyan : mats.glowLime
      );
      g.add(shard);
      shaftPulses.push({ mesh: shard, x: sx, z: sz, phase: i / 6 });
    }

    // 3. Architectural Database Vault at (48, 10, 0) — Two-Tier Radial Glass Monolith Matrix
    const vault = new THREE.Group();
    vault.position.set(vx, vy, vz);

    // Architectural circular floor deck & illuminated concentric index rails
    const deckGeo = new THREE.CylinderGeometry(5.6, 5.9, 0.24, 32);
    const deck = new THREE.Mesh(deckGeo, mats.chassisDark);
    deck.position.y = -0.14;
    mats.addEdges(deck, deckGeo, mats.edgeCyanDim, 20);
    vault.add(deck);

    [2.1, 3.85, 5.2].forEach((rad, ri) => {
      const rMesh = new THREE.Mesh(
        new THREE.TorusGeometry(rad, 0.018, 6, 48),
        new THREE.MeshBasicMaterial({ color: ri === 1 ? 0xC6F135 : 0x38BDF8, transparent: true, opacity: ri === 1 ? 0.52 : 0.26 })
      );
      rMesh.rotation.x = Math.PI / 2;
      rMesh.position.y = 0.02;
      vault.add(rMesh);
    });

    // 36 Radial Smoked-Glass Storage Monolith Blades (Single InstancedMesh Draw Call!)
    const bladeCount = 36;
    const bladeGeo = new THREE.BoxGeometry(0.12, 1.95, 1.15);
    const bladeInst = new THREE.InstancedMesh(bladeGeo, mats.chassisMid, bladeCount);
    const bladeLedGeo = new THREE.BoxGeometry(0.14, 0.045, 1.16);
    const bladeLedInst = new THREE.InstancedMesh(bladeLedGeo, mats.glowCyan, bladeCount);
    const dummy = new THREE.Object3D();
    const bladeMeta = [];

    for (let i = 0; i < bladeCount; i++) {
      const tier = i < 16 ? 0 : 1;
      const slot = tier === 0 ? i : i - 16;
      const total = tier === 0 ? 16 : 20;
      const ang = (slot / total) * Math.PI * 2;
      const rad = tier === 0 ? 2.65 : 4.35;
      const hScale = tier === 0 ? 1.15 : 0.85;
      const bx = Math.cos(ang) * rad;
      const bz = Math.sin(ang) * rad;

      dummy.position.set(bx, hScale * 0.98, bz);
      dummy.rotation.set(0, -ang + Math.PI / 2, 0);
      dummy.scale.set(1, hScale, 1);
      dummy.updateMatrix();
      bladeInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(bx, hScale * 1.95, bz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bladeLedInst.setMatrixAt(i, dummy.matrix);

      bladeMeta.push({ bx, bz, ang, hScale, tier, phase: (slot / total) });
    }
    bladeInst.instanceMatrix.needsUpdate = true;
    bladeLedInst.instanceMatrix.needsUpdate = true;
    vault.add(bladeInst, bladeLedInst);

    // Central Illuminated Crystalline Index Core
    const coreCol = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.1, 8), mats.glassVault);
    coreCol.position.y = 1.55;
    mats.addEdges(coreCol, coreCol.geometry, mats.edgeCyan, 18);
    vault.add(coreCol);

    // Horizontal Data Indexing Shards radiating between Core & Monolith Bays
    const indexShards = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sh = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.05, 0.08),
        i % 3 === 0 ? mats.glowLime : mats.glowCyan
      );
      sh.rotation.y = -a;
      vault.add(sh);
      indexShards.push({ mesh: sh, ang: a, y: 0.55 + (i % 3) * 0.62, phase: i / 12 });
    }
    g.add(vault);

    // 4. High-Speed 6-Lane Optical Output Bus: Database Vault (x=53) -> GPU Input (x=68.8)
    const dbToGpuPulses = [];
    for (let lane = 0; lane < 6; lane++) {
      const zOff = -1.25 + lane * 0.5;
      const pts = [
        new THREE.Vector3(vx + 4.8, vy + 0.16, zOff * 0.6),
        new THREE.Vector3(vx + 9.5, vy + 0.16, zOff),
        new THREE.Vector3(anchors.gpuCenter[0] - 5.1, vy + 0.16, zOff)
      ];
      dbToGpuPulses.push(
        ...buildBusTrace(THREE, g, pts, lane % 2 === 0 ? mats.edgeCyan : mats.edgeLime, lane % 2 === 0 ? mats.glowCyan : mats.glowLime, 2, 0.42, lane * 0.13)
      );
    }

    return {
      group: g,
      rxHalo,
      rxHaloMat,
      shaftPulses,
      bladeLedInst,
      bladeMeta,
      indexShards,
      dbToGpuPulses,
      gy,
      vy
    };
  }

  /* ==========================================================================
     STAGE 07: SCULPTED 3D GPU HARDWARE + 64 INSTANCED SM CORES + HBM3 STACKS
     ========================================================================== */
  function buildGpuStage(THREE, mats, anchors) {
    const g = new THREE.Group();
    const [gx, gy, gz] = anchors.gpuCenter;
    g.position.set(gx, gy, gz);

    // Multi-Layer Matte-Black PCB with Procedural 45° Copper Micro-Trace Artwork
    const pcbW = 10.2, pcbH = 0.22, pcbD = 6.2;
    const pcb = mats.makeBox(g, pcbW, pcbH, pcbD, mats.pcbSubstrate, mats.edgeCyanDim, [0, 0, 0]);

    // Sculpted Anodized Aluminum Shroud Frame & Finned Vapor-Chamber Rails
    mats.makeBox(g, pcbW + 0.28, 0.34, 0.36, mats.heatsinkAlum, mats.edgeInk, [0, 0.16, -pcbD / 2 - 0.12]);
    mats.makeBox(g, pcbW + 0.28, 0.34, 0.36, mats.heatsinkAlum, mats.edgeInk, [0, 0.16, pcbD / 2 + 0.12]);
    for (let f = -9; f <= 9; f++) {
      mats.makeBox(g, 0.08, 0.38, 0.48, mats.chassisMid, null, [f * 0.5, 0.18, -pcbD / 2 - 0.16]);
    }

    // Gold PCIe x16 Edge Contact Finger Strip along front edge (Single InstancedMesh!)
    const pinCount = 28;
    const pinInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.06, 0.38), mats.goldFoil, pinCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < pinCount; i++) {
      dummy.position.set(-3.8 + i * 0.28, -0.06, pcbD / 2 + 0.36);
      dummy.updateMatrix();
      pinInst.setMatrixAt(i, dummy.matrix);
    }
    pinInst.instanceMatrix.needsUpdate = true;
    g.add(pinInst);

    // Central Precision Silicon Interposer Deck
    mats.makeBox(g, 5.4, 0.16, 4.4, mats.siliconDie, mats.edgeCyan, [0, 0.18, 0]);

    // 4 HBM3 High-Bandwidth Memory Stacks flanking the interposer (2 left, 2 right)
    const hbmNodes = [];
    [[-3.55, -1.15], [-3.55, 1.15], [3.55, -1.15], [3.55, 1.15]].forEach(([hx, hz]) => {
      const stack = new THREE.Group();
      stack.position.set(hx, 0.16, hz);
      for (let ly = 0; ly < 4; ly++) {
        mats.makeBox(stack, 1.18, 0.11, 1.55, ly % 2 === 0 ? mats.chassisMid : mats.chassisDark, ly === 3 ? mats.edgeCyan : mats.edgeDim, [0, ly * 0.13 + 0.06, 0]);
      }
      g.add(stack);
      hbmNodes.push(stack);
    });

    // Glowing L2 Cache Crossbar Channels dividing the 4 Graphics Processing Clusters (GPCs)
    const crossbarX = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.05, 0.18), mats.glowCyan);
    crossbarX.position.set(0, 0.29, 0);
    const crossbarZ = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 3.9), mats.glowCyan);
    crossbarZ.position.set(0, 0.29, 0);
    g.add(crossbarX, crossbarZ);

    // 64 Streaming Multiprocessor (SM) Cores arranged in 8x8 matrix (4 GPC Quadrants) — 1 InstancedMesh!
    const smGeo = new THREE.BoxGeometry(0.42, 0.18, 0.36);
    const smMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.26,
      metalness: 0.52,
      emissive: new THREE.Color(0x0A1C28),
      emissiveIntensity: 0.65
    });
    const smInst = new THREE.InstancedMesh(smGeo, smMat, 64);
    const smMeta = [];
    let idx = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const gapX = c >= 4 ? 0.32 : -0.32;
        const gapZ = r >= 4 ? 0.28 : -0.28;
        const sx = (c - 3.5) * 0.54 + gapX;
        const sz = (r - 3.5) * 0.44 + gapZ;
        smMeta.push({ idx, r, c, sx, sz });
        dummy.position.set(sx, 0.36, sz);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        smInst.setMatrixAt(idx, dummy.matrix);
        smInst.setColorAt(idx, new THREE.Color(0x16384C));
        idx++;
      }
    }
    smInst.instanceMatrix.needsUpdate = true;
    smInst.instanceColor.needsUpdate = true;
    g.add(smInst);

    // Sculpted 6-Lane Inter-Chip Circuit Bridge: GPU (x=79.1) -> CPU (x=97.6)
    const gpuToCpuGroup = new THREE.Group();
    const gpuToCpuPulses = [];
    for (let lane = 0; lane < 6; lane++) {
      const zOff = -1.35 + lane * 0.54;
      const kink = (lane - 2.5) * 0.16;
      const pts = [
        new THREE.Vector3(gx + 5.1, gy + 0.16, zOff),
        new THREE.Vector3(gx + 10.5, gy + 0.16, zOff),
        new THREE.Vector3(gx + 13.5, gy + 0.16, zOff + kink),
        new THREE.Vector3(anchors.cpuCenter[0] - 4.4, gy + 0.16, zOff + kink)
      ];
      gpuToCpuPulses.push(
        ...buildBusTrace(THREE, gpuToCpuGroup, pts, lane % 2 === 0 ? mats.edgeCyan : mats.edgeLime, lane % 2 === 0 ? mats.glowLime : mats.glowCyan, 2, 0.46, lane * 0.17)
      );
    }

    return {
      group: g,
      bridgeGroup: gpuToCpuGroup,
      smInst,
      smMeta,
      gpuToCpuPulses
    };
  }

  /* ==========================================================================
     STAGE 08: EXECUTING CPU ARCHITECTURE (CLOCK, 4-STAGE PIPELINE, RING BUS)
     ========================================================================== */
  function buildCpuStage(THREE, mats, anchors) {
    const g = new THREE.Group();
    const [cx, cy, cz] = anchors.cpuCenter;
    g.position.set(cx, cy, cz);

    // Precision LGA Socket Carrier & Multi-Layer Package Substrate
    mats.makeBox(g, 8.6, 0.26, 8.2, mats.chassisDark, mats.edgeLime, [0, 0, 0]);
    mats.makeBox(g, 7.6, 0.16, 7.2, mats.pcbSubstrate, mats.edgeInk, [0, 0.2, 0]);

    // Perimeter Gold LGA Contact Pad Matrix (InstancedMesh!)
    const padCoords = [];
    for (let i = -10; i <= 10; i++) {
      padCoords.push([i * 0.36, -3.82], [i * 0.36, 3.82]);
    }
    for (let j = -9; j <= 9; j++) {
      padCoords.push([-4.02, j * 0.36], [4.02, j * 0.36]);
    }
    const padInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.05, 0.18), mats.goldFoil, padCoords.length);
    const dummy = new THREE.Object3D();
    padCoords.forEach(([px, pz], i) => {
      dummy.position.set(px, 0.15, pz);
      dummy.updateMatrix();
      padInst.setMatrixAt(i, dummy.matrix);
    });
    padInst.instanceMatrix.needsUpdate = true;
    g.add(padInst);

    // 1. Central Clock & Control Hub
    const clockRingMat = new THREE.MeshBasicMaterial({ color: 0xC6F135, transparent: true, opacity: 0.9 });
    const clockRing = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.04, 10, 40), clockRingMat);
    clockRing.rotation.x = Math.PI / 2;
    clockRing.position.set(0, 0.42, 0);
    g.add(clockRing);
    mats.makeBox(g, 0.85, 0.28, 0.85, mats.siliconDie, mats.edgeInk, [0, 0.38, 0]);

    // 2. Shared L3 Ring Bus + 6 Deterministic Orbiting Execution Tokens
    const ringRadius = 2.05;
    const ringBus = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 0.045, 8, 56),
      new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.62 })
    );
    ringBus.rotation.x = Math.PI / 2;
    ringBus.position.y = 0.36;
    g.add(ringBus);

    const ringTokens = [];
    for (let i = 0; i < 6; i++) {
      const tok = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.12), i % 2 === 0 ? mats.glowLime : mats.glowCyan);
      g.add(tok);
      ringTokens.push({ mesh: tok, phase: (i / 6) * Math.PI * 2 });
    }

    // 3. 4-Stage Instruction Pipeline (FETCH -> DECODE -> EXECUTE -> WRITEBACK) along -Z side
    const pipelineStages = [];
    for (let s = 0; s < 4; s++) {
      const px = -2.25 + s * 1.5;
      const mat = new THREE.MeshStandardMaterial({ color: 0x16221A, roughness: 0.32, metalness: 0.55, emissive: new THREE.Color(0x08140C), emissiveIntensity: 0.5 });
      const edgeMat = mats.edgeLime.clone();
      const box = mats.makeBox(g, 1.12, 0.26, 0.92, mat, edgeMat, [px, 0.42, -2.55]);
      pipelineStages.push({ mesh: box, mat, edgeMat, idx: s });
    }

    // 4. 8 Multi-Core Execution Clusters arranged around the L3 Ring Bus
    const coreModules = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const mx = Math.cos(a) * 2.95;
      const mz = Math.sin(a) * 2.55;
      if (Math.abs(mz + 2.55) < 0.75) continue; // Keep clear of pipeline lane
      const mat = new THREE.MeshStandardMaterial({ color: 0x151D22, roughness: 0.34, metalness: 0.62 });
      const edgeMat = mats.edgeCyan.clone();
      const mod = mats.makeBox(g, 0.96, 0.32, 0.86, mat, edgeMat, [mx, 0.44, mz]);
      coreModules.push({ mesh: mod, mat, edgeMat, phase: i * 0.7 });
    }

    // 5. Conditional Branching Logic Pathways (active branch glows lime, inactive stays dark!)
    const branchPaths = [];
    [-1.4, -0.45, 0.45, 1.4].forEach((bz, bi) => {
      const mat = new THREE.LineBasicMaterial({ color: 0xC6F135, transparent: true, opacity: 0.2 });
      const pts = [
        new THREE.Vector3(0.8, 0.34, 0),
        new THREE.Vector3(2.1, 0.34, bz * 0.7),
        new THREE.Vector3(4.3, 0.22, bz)
      ];
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      branchPaths.push({ mat, idx: bi });
    });

    return {
      group: g,
      clockRing,
      ringRadius,
      ringTokens,
      pipelineStages,
      coreModules,
      branchPaths
    };
  }

  /* ==========================================================================
     STAGE 09: BINARY (0/1) -> ELECTRICAL PCB TRACE CORRIDOR (x = 106 -> 136)
     ========================================================================== */
  function buildBinaryCorridor(THREE, mats, anchors, isCompact) {
    const g = new THREE.Group();
    const startX = anchors.cpuCenter[0] + 4.3;
    const endX = anchors.nicCenter[0] - 3.9;
    const midX = (startX + endX) * 0.5;
    const len = endX - startX;
    const y0 = anchors.cpuCenter[1];

    // Sculpted Architectural PCB Corridor Deck
    mats.makeBox(g, len, 0.18, 5.2, mats.pcbSubstrate, mats.edgeDim, [midX, y0, 0]);

    // 6 Parallel Copper Trace Lanes with 45° Chamfer Jog + Vias + SMD Resistors
    const lanes = [];
    const laneCount = 6;
    for (let l = 0; l < laneCount; l++) {
      const zA = -1.65 + l * 0.66;
      const zB = -1.25 + l * 0.5;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(startX, y0 + 0.14, zA),
        new THREE.Vector3(startX + len * 0.34, y0 + 0.14, zA),
        new THREE.Vector3(startX + len * 0.46, y0 + 0.14, zB),
        new THREE.Vector3(endX, y0 + 0.14, zB)
      ]);
      const traceLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
        l % 2 === 0 ? mats.edgeLime : mats.edgeCyan
      );
      g.add(traceLine);
      lanes.push({ curve, zA, zB, isLime: l % 2 === 0 });

      // Plated gold via at jog point + miniature SMD impedance resistor
      const via = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), mats.goldFoil);
      via.position.set(startX + len * 0.34, y0 + 0.12, zA);
      g.add(via);
      mats.makeBox(g, 0.34, 0.12, 0.18, mats.chassisMid, mats.edgeAmber, [startX + len * 0.68, y0 + 0.16, zB]);
    }

    // Organized In-Lane 3D Binary Tiles (0 & 1) Morphing into Sleek Electrical Pulses!
    const perLane = isCompact ? 4 : 6;
    const dataTrains = [];
    const bitGeo = new THREE.PlaneGeometry(0.46, 0.46);
    const elecGeo = new THREE.BoxGeometry(0.68, 0.08, 0.12);
    const mat0L = new THREE.MeshBasicMaterial({ map: mats.textures.bit0Lime, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const mat1L = new THREE.MeshBasicMaterial({ map: mats.textures.bit1Lime, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const mat0C = new THREE.MeshBasicMaterial({ map: mats.textures.bit0Cyan, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const mat1C = new THREE.MeshBasicMaterial({ map: mats.textures.bit1Cyan, transparent: true, side: THREE.DoubleSide, depthWrite: false });

    lanes.forEach((lane, li) => {
      for (let k = 0; k < perLane; k++) {
        const isOne = (li + k) % 2 === 0;
        const bMat = lane.isLime ? (isOne ? mat1L : mat0L) : (isOne ? mat1C : mat0C);
        const bitMesh = new THREE.Mesh(bitGeo, bMat);
        bitMesh.rotation.x = -Math.PI * 0.22; // Tilted slightly upward for sharp readability in perspective
        const elecMesh = new THREE.Mesh(elecGeo, lane.isLime ? mats.glowLime : mats.glowAmber);
        g.add(bitMesh, elecMesh);
        dataTrains.push({
          bitMesh,
          elecMesh,
          curve: lane.curve,
          offset: (k / perLane + li * 0.09) % 1,
          speed: 0.30 + (li % 3) * 0.03
        });
      }
    });

    return { group: g, dataTrains };
  }

  /* ==========================================================================
     STAGE 10: DETAILED PCIe NETWORK INTERFACE CARD (NIC) + FIBER CONDUIT
     ========================================================================== */
  function buildNicStage(THREE, mats, anchors) {
    const g = new THREE.Group();
    const [nx, ny, nz] = anchors.nicCenter;
    g.position.set(nx, ny, nz);

    // Matte Dark-Emerald NIC PCB
    const w = 7.8, d = 4.9;
    mats.makeBox(g, w, 0.18, d, mats.pcbSubstrate, mats.edgeLime, [0, 0, 0]);

    // Gold PCIe x8 Connector Edge Fingers along front (+Z) edge
    const pinInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.05, 0.42), mats.goldFoil, 20);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 20; i++) {
      dummy.position.set(-2.6 + i * 0.24, -0.04, d / 2 + 0.22);
      dummy.updateMatrix();
      pinInst.setMatrixAt(i, dummy.matrix);
    }
    pinInst.instanceMatrix.needsUpdate = true;
    g.add(pinInst);

    // Metallic PCIe Rear Mounting Bracket on +X edge
    mats.makeBox(g, 0.14, 1.35, d + 0.55, mats.heatsinkAlum, mats.edgeInk, [w / 2 + 0.06, 0.48, 0]);

    // Central MAC/PHY Network Controller IC with 7-Fin Aluminum Heatsink
    mats.makeBox(g, 1.85, 0.16, 1.85, mats.chassisDark, mats.edgeCyan, [-0.55, 0.18, 0]);
    for (let fn = 0; fn < 7; fn++) {
      mats.makeBox(g, 1.72, 0.42, 0.08, mats.heatsinkAlum, fn === 0 || fn === 6 ? mats.edgeCyan : mats.edgeDim, [-0.55, 0.46, -0.72 + fn * 0.24]);
    }

    // Crystal Oscillator Can + Magnetics Isolation Transformer Block + SMD Array
    mats.makeBox(g, 0.52, 0.18, 0.34, mats.hullBright, mats.edgeInk, [-2.2, 0.18, -1.25]);
    mats.makeBox(g, 0.92, 0.46, 1.48, mats.chassisDark, mats.edgeAmber, [1.55, 0.32, 0]);
    for (let c = 0; c < 6; c++) {
      mats.makeBox(g, 0.18, 0.16, 0.18, mats.copper, null, [-2.2 + (c % 3) * 0.45, 0.16, 1.15 + Math.floor(c / 3) * 0.42]);
    }

    // Precision Metallic RJ45 / SFP+ Network Transceiver Port Cage + Blinking Activity LEDs
    mats.makeBox(g, 1.25, 0.88, 1.18, mats.hullSteel, mats.edgeInk, [3.22, 0.54, 0]);
    const ledLinkMat = new THREE.MeshBasicMaterial({ color: 0xC6F135 });
    const ledActMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
    const ledLink = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), ledLinkMat);
    ledLink.position.set(3.86, 0.84, -0.34);
    const ledAct = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), ledActMat);
    ledAct.position.set(3.86, 0.84, 0.34);
    g.add(ledLink, ledAct);

    // Braided Optical Fiber Patch Conduit curving smoothly from NIC Transceiver -> Core Router
    const fiberGroup = new THREE.Group();
    const fiberCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(nx + 3.9, ny + 0.52, nz),
      new THREE.Vector3(nx + 7.2, ny + 1.45, nz + 0.45),
      new THREE.Vector3(nx + 12.2, ny + 1.25, nz - 0.35),
      new THREE.Vector3(anchors.routerCenter[0] - 2.35, ny + 0.46, nz)
    ]);
    const fiberTube = new THREE.Mesh(
      new THREE.TubeGeometry(fiberCurve, 44, 0.085, 10, false),
      new THREE.MeshStandardMaterial({ color: 0x102838, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.72 })
    );
    fiberGroup.add(fiberTube);
    fiberGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fiberCurve.getPoints(48)), mats.edgeCyan));

    const fiberPulses = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), i % 2 === 0 ? mats.glowLime : mats.glowCyan);
      fiberGroup.add(p);
      fiberPulses.push({ mesh: p, curve: fiberCurve, offset: i / 5, speed: 0.56 });
    }

    return {
      group: g,
      fiberGroup,
      ledLinkMat,
      ledActMat,
      fiberPulses
    };
  }

  /* ==========================================================================
     STAGE 11: CORE ROUTER + CONNECTED INFRASTRUCTURE MESH + ORBITAL UPLINK
     ========================================================================== */
  function buildRouterStage(THREE, mats, anchors) {
    const g = new THREE.Group();
    const [rx, ry, rz] = anchors.routerCenter;
    g.position.set(rx, ry, rz);

    // Enterprise Core Router Beveled Chassis
    mats.makeBox(g, 4.8, 0.92, 3.15, mats.chassisDark, mats.edgeCyan, [0, 0.46, 0]);
    mats.makeBox(g, 4.45, 0.14, 2.8, mats.chassisMid, mats.edgeDim, [0, 0.98, 0]);

    // Front Panel Sweeping Telemetry LED Bar (8 Indicators)
    const frontLeds = [];
    for (let i = 0; i < 8; i++) {
      const lm = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xC6F135 : 0x38BDF8 });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.05), lm);
      led.position.set(-1.55 + i * 0.44, 0.46, 1.59);
      g.add(led);
      frontLeds.push({ mat: lm, idx: i });
    }

    // 4 Sculpted Blade / Dipole RF Antennas with Metallic Collars & Tip Emitters
    [-1.75, -0.58, 0.58, 1.75].forEach((ax, ai) => {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 12), mats.heatsinkAlum);
      collar.position.set(ax, 1.12, -0.92);
      g.add(collar);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 2.35, 10), mats.hullSteel);
      mast.position.set(ax, 2.34, -0.92);
      mats.addEdges(mast, mast.geometry, mats.edgeInk, 24);
      g.add(mast);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), ai % 2 === 0 ? mats.glowLime : mats.glowCyan);
      tip.position.set(ax, 3.55, -0.92);
      g.add(tip);
    });

    // Expanding Coherent RF Wavefront Rings
    const rfRings = [];
    for (let i = 0; i < 5; i++) {
      const rm = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.024, 8, 48),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x38BDF8 : 0xC6F135,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      rm.rotation.x = Math.PI / 2;
      rm.position.set(0, 3.5, -0.92);
      g.add(rm);
      rfRings.push(rm);
    }

    // Connected Infrastructure Mesh: 6 Architectural Peripheral Nodes + Curved Routing Arcs
    const meshNodeOffsets = [
      [-6.5, 2.2, -6.2],
      [7.2, 2.8, -5.8],
      [9.4, 0.6, 1.2],
      [6.4, -0.4, 6.2],
      [-5.2, 0.4, 6.6],
      [0.4, 3.6, -9.8]
    ];
    const meshPulses = [];
    meshNodeOffsets.forEach(([ox, oy, oz], ni) => {
      const node = new THREE.Group();
      node.position.set(ox, oy, oz);
      mats.makeBox(node, 0.95, 0.62, 0.95, mats.chassisMid, ni % 2 === 0 ? mats.edgeCyan : mats.edgeLime, [0, 0, 0]);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), ni % 2 === 0 ? mats.glowCyan : mats.glowLime);
      orb.position.y = 0.44;
      node.add(orb);
      g.add(node);

      const mid = new THREE.Vector3(ox * 0.5, Math.max(2.6, oy + 2.4), oz * 0.5);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.1, 0), mid, new THREE.Vector3(ox, oy + 0.35, oz)]);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)), ni % 2 === 0 ? mats.edgeCyanDim : mats.edgeLime));

      const pkt = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), ni % 2 === 0 ? mats.glowLime : mats.glowCyan);
      g.add(pkt);
      meshPulses.push({ mesh: pkt, curve, offset: ni / 6, speed: 0.34 });
    });

    // Realistic Ground Optical Telemetry Backbone Trunk (exits Router along floor grid -> feeds Launch Control!)
    const trunkPulses = [];
    [-0.42, 0, 0.42].forEach((tz, ti) => {
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.4, 0.08, tz),
        new THREE.Vector3(9.5, 0.06, tz * 0.85),
        new THREE.Vector3(22.0, 0.06, tz * 0.6)
      ]);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(trunkCurve.getPoints(36)), ti === 1 ? mats.edgeLime : mats.edgeCyanDim));
      for (let k = 0; k < 3; k++) {
        const pkt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.07), ti === 1 ? mats.glowLime : mats.glowCyan);
        g.add(pkt);
        trunkPulses.push({ mesh: pkt, curve: trunkCurve, offset: (k / 3 + ti * 0.14) % 1, speed: 0.48 + ti * 0.04 });
      }
    });

    return {
      group: g,
      frontLeds,
      rfRings,
      meshPulses,
      trunkPulses
    };
  }

  function buildComputeWorld(THREE, mats, isCompact) {
    const anchors = root.CONFIG.ANCHORS;
    const group = new THREE.Group();

    // Subtle Continuous Architectural Compute Floor Grid extending across x = 38 .. 176
    const floorGrid = new THREE.GridHelper(150, 75, 0x1A2428, 0x0C1113);
    floorGrid.position.set(106, anchors.dbVault[1] - 0.38, 0);
    group.add(floorGrid);

    const database = buildDatabaseStage(THREE, mats, anchors);
    const gpu = buildGpuStage(THREE, mats, anchors);
    const cpu = buildCpuStage(THREE, mats, anchors);
    const binary = buildBinaryCorridor(THREE, mats, anchors, isCompact);
    const nic = buildNicStage(THREE, mats, anchors);
    const router = buildRouterStage(THREE, mats, anchors);

    group.add(
      database.group,
      gpu.group,
      gpu.bridgeGroup,
      cpu.group,
      binary.group,
      nic.group,
      nic.fiberGroup,
      router.group
    );

    return {
      group,
      database,
      gpu,
      cpu,
      binary,
      nic,
      router
    };
  }

  root.buildComputeWorld = buildComputeWorld;
})();
