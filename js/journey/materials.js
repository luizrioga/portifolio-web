/* ==========================================================================
   SPACE-TO-COMPUTE JOURNEY — PBR MATERIALS, PROCEDURAL TEXTURES & GLSL SHADERS
   ========================================================================== */
(() => {
  'use strict';

  const root = (window.SpaceComputeJourney = window.SpaceComputeJourney || {});

  function createSolarPanelTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 512, 256);
    bg.addColorStop(0, '#071B2C');
    bg.addColorStop(0.5, '#0D2E48');
    bg.addColorStop(1, '#061624');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 256);

    // Individual photovoltaic cells with chamfered corners
    g.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    g.lineWidth = 2;
    const cols = 8;
    const rows = 4;
    const cw = 512 / cols;
    const ch = 256 / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cw + 3;
        const y = r * ch + 3;
        g.strokeRect(x, y, cw - 6, ch - 6);
        // Fine silver micro-fingers inside each cell
        g.strokeStyle = 'rgba(180, 225, 255, 0.16)';
        g.lineWidth = 1;
        for (let f = 1; f < 4; f++) {
          g.beginPath();
          g.moveTo(x + 2, y + (ch - 6) * (f / 4));
          g.lineTo(x + cw - 8, y + (ch - 6) * (f / 4));
          g.stroke();
        }
        g.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        g.lineWidth = 2;
      }
    }
    // Horizontal silver collector busbars
    g.fillStyle = 'rgba(220, 240, 255, 0.45)';
    for (let r = 1; r < rows; r++) {
      g.fillRect(0, r * ch - 1.5, 512, 3);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function createPcbTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#0A1010';
    g.fillRect(0, 0, 512, 512);

    // Subtle ground-plane hatch grid
    g.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    g.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }

    // 45-degree routed copper / cyan differential trace buses
    for (let lane = 0; lane < 18; lane++) {
      const y0 = 22 + lane * 27;
      const kinkX = 110 + ((lane * 53) % 240);
      const kinkDy = (lane % 2 === 0 ? 1 : -1) * 26;
      g.strokeStyle = lane % 3 === 0 ? 'rgba(198, 241, 53, 0.24)' : 'rgba(56, 189, 248, 0.22)';
      g.lineWidth = lane % 4 === 0 ? 2.6 : 1.6;
      g.beginPath();
      g.moveTo(0, y0);
      g.lineTo(kinkX, y0);
      g.lineTo(kinkX + Math.abs(kinkDy), y0 + kinkDy);
      g.lineTo(512, y0 + kinkDy);
      g.stroke();

      // Gold plated through-hole vias
      g.fillStyle = '#D4A039';
      g.beginPath();
      g.arc(kinkX, y0, 3.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#050606';
      g.beginPath();
      g.arc(kinkX, y0, 1.4, 0, Math.PI * 2);
      g.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function createCloudSpriteTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0.0, 'rgba(255, 250, 236, 0.92)');
    grad.addColorStop(0.32, 'rgba(220, 232, 242, 0.48)');
    grad.addColorStop(0.68, 'rgba(120, 148, 168, 0.14)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function createGlowTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.22, 'rgba(255, 255, 255, 0.65)');
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function createBinaryTileTexture(THREE, charStr, hex) {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 96, 96);
    g.fillStyle = 'rgba(7, 10, 11, 0.85)';
    g.strokeStyle = hex;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(10, 10, 76, 76, 12);
    g.fill();
    g.stroke();
    g.font = '700 54px "JetBrains Mono", Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = hex;
    g.fillText(charStr, 48, 50);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // Custom GLSL Fresnel Atmospheric Limb Glow (SpaceX Documentary Cyan Horizon)
  function createAtmosphereMaterial(THREE) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColorInner: { value: new THREE.Color(0x38BDF8) },
        uColorOuter: { value: new THREE.Color(0xC6F135) },
        uIntensity: { value: 1.35 },
        uOpacity: { value: 1.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        uniform float uIntensity;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vec3 V = normalize(vViewPos);
          float ndv = clamp(abs(dot(normalize(vNormal), V)), 0.0, 1.0);
          float fresnel = pow(1.0 - ndv, 3.2);
          float rimBand = smoothstep(0.05, 0.95, fresnel);
          vec3 col = mix(uColorInner, uColorOuter, pow(fresnel, 3.5) * 0.25);
          gl_FragColor = vec4(col * uIntensity, rimBand * 0.88 * uOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false
    });
  }

  // Custom GLSL Realistic Multi-Layer Sea-Level Methalox Raptor Plume (Turbulent Advection + Mach Diamonds)
  function createSeaLevelPlumeMaterial(THREE, isCore = false) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPower: { value: 1.0 },
        uIsCore: { value: isCore ? 1.0 : 0.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uIsCore;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec3 p = position;
          // Subtle supersonic acoustic flutter along outer shear mantle (0 at nozzle throat, gentle down tail)
          float tailDist = clamp(vUv.y, 0.0, 1.0);
          float flutter = (1.0 - uIsCore * 0.65) * tailDist * 0.045;
          p.x += sin(p.y * 6.5 - uTime * 42.0 + p.z * 4.0) * flutter;
          p.z += cos(p.y * 5.8 - uTime * 39.0 + p.x * 4.0) * flutter;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPower;
        uniform float uIsCore;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float s = 0.0;
          float a = 0.52;
          for (int i = 0; i < 3; i++) {
            s += a * vnoise(p);
            p *= 2.08;
            a *= 0.48;
          }
          return s;
        }

        void main() {
          // On inverted ConeGeometry: vUv.y = 0 at nozzle exit -> 1 at far tail
          float dist = clamp(vUv.y, 0.0, 1.0);
          float axial = 1.0 - dist;
          float ndv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
          float edgeSoft = pow(ndv, mix(1.45, 0.95, uIsCore));

          // High-speed supersonic shear turbulence scrolling rapidly away from nozzles
          float flow = fbm(vec2(vUv.x * 6.0, dist * 7.5 - uTime * 19.0));
          float fine = vnoise(vec2(vUv.x * 14.0, dist * 16.0 - uTime * 34.0));
          float turb = mix(0.76, 1.18, flow * 0.72 + fine * 0.28);

          // Crisp repeating Mach Shock Diamonds concentrated along core near upper plume
          float diamondWave = pow(max(0.0, sin(dist * 34.0 - uTime * 24.0) * 0.5 + 0.5), 4.0);
          float shockMask = smoothstep(0.04, 0.14, dist) * (1.0 - smoothstep(0.45, 0.85, dist));
          float shockDiamond = diamondWave * shockMask * mix(0.38, 1.05, uIsCore);

          // Physical Methalox color temperature ramp: blue-white throat -> incandescent gold -> warm amber-orange tail
          vec3 colThroat = vec3(0.88, 0.95, 1.00);
          vec3 colGold   = vec3(1.00, 0.84, 0.48);
          vec3 colAmber  = vec3(0.96, 0.50, 0.12);
          vec3 colTail   = vec3(0.75, 0.22, 0.04);

          vec3 col = mix(colTail, colAmber, smoothstep(0.08, 0.48, axial));
          col = mix(col, colGold, smoothstep(0.42, 0.82, axial + shockDiamond * 0.32));
          col = mix(col, colThroat, smoothstep(0.76, 0.99, axial + shockDiamond * 0.42 + uIsCore * 0.18));

          float throatRamp = smoothstep(0.0, 0.04, dist);
          float tailFade = pow(smoothstep(0.0, 0.94, axial), mix(1.22, 0.95, uIsCore));
          float flicker = 0.94 + 0.06 * sin(uTime * 68.0 + dist * 18.0);
          float density = throatRamp * tailFade * (0.22 + 0.78 * edgeSoft) * turb * flicker * (1.0 + shockDiamond * 0.95);

          float intensity = mix(1.78, 2.45, uIsCore) * clamp(uPower, 0.0, 1.35);
          gl_FragColor = vec4(col * intensity, clamp(density * clamp(uPower, 0.0, 1.3), 0.0, 0.98));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  // Custom GLSL Realistic Starship Vacuum Raptor Expansion Plume (Wide Translucent Methalox Bell)
  function createVacuumPlumeMaterial(THREE) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPower: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPower;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          // LatheGeometry vacuum chalice: vUv.y = 0 at nozzle throat -> 1 at wide expanded end
          float dist = clamp(vUv.y, 0.0, 1.0);
          float axial = 1.0 - dist;
          float ndv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
          // Vacuum plumes show delicate limb brightening + silky radial falloff
          float coreGlow = pow(ndv, 1.35);
          float shearRim = pow(1.0 - ndv, 2.2) * ndv * 2.1;
          float ripple = 0.88 + 0.12 * sin(dist * 26.0 - uTime * 28.0);
          float micro = 0.92 + 0.08 * sin(vUv.x * 18.0 + dist * 12.0 - uTime * 16.0);

          vec3 colCore  = vec3(0.94, 0.98, 1.00);
          vec3 colBlue  = vec3(0.32, 0.78, 1.00);
          vec3 colViolet = vec3(0.42, 0.46, 0.95);

          vec3 col = mix(colViolet, colBlue, smoothstep(0.10, 0.65, axial));
          col = mix(col, colCore, smoothstep(0.62, 0.99, axial) * (0.45 + 0.55 * coreGlow));

          float fade = smoothstep(0.0, 0.05, dist) * pow(smoothstep(0.0, 0.96, axial), 1.65);
          float alpha = fade * (coreGlow * 0.72 + shearRim * 0.34) * ripple * micro * clamp(uPower, 0.0, 1.25);
          gl_FragColor = vec4(col * 1.55, clamp(alpha, 0.0, 0.86));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function createMaterials(THREE) {
    const solarPanelTex = createSolarPanelTexture(THREE);
    const pcbTraceTex = createPcbTexture(THREE);
    const cloudTex = createCloudSpriteTexture(THREE);
    const glowTex = createGlowTexture(THREE);

    const mats = {
      // Textures
      textures: {
        solarPanelTex,
        pcbTraceTex,
        cloudTex,
        glowTex,
        bit0Lime: createBinaryTileTexture(THREE, '0', '#C6F135'),
        bit1Lime: createBinaryTileTexture(THREE, '1', '#C6F135'),
        bit0Cyan: createBinaryTileTexture(THREE, '0', '#38BDF8'),
        bit1Cyan: createBinaryTileTexture(THREE, '1', '#38BDF8')
      },

      // Aerospace Metallic & Thermal PBR Materials
      hullSteel: new THREE.MeshStandardMaterial({
        color: 0x52606B,
        roughness: 0.26,
        metalness: 0.80
      }),
      hullBright: new THREE.MeshStandardMaterial({
        color: 0x7E8F9D,
        roughness: 0.22,
        metalness: 0.84
      }),
      heatshield: new THREE.MeshStandardMaterial({
        color: 0x151A1E,
        roughness: 0.72,
        metalness: 0.28
      }),
      towerSteel: new THREE.MeshStandardMaterial({
        color: 0x242C32,
        roughness: 0.48,
        metalness: 0.62
      }),
      padConcrete: new THREE.MeshStandardMaterial({
        color: 0x161B1E,
        roughness: 0.85,
        metalness: 0.14
      }),
      goldFoil: new THREE.MeshStandardMaterial({
        color: 0xDDA840,
        roughness: 0.26,
        metalness: 0.86
      }),
      solarPanel: new THREE.MeshStandardMaterial({
        map: solarPanelTex,
        color: 0xC8EAFF,
        roughness: 0.22,
        metalness: 0.52,
        emissive: new THREE.Color(0x0E3858),
        emissiveIntensity: 0.68
      }),

      // Architectural Compute & Hardware PBR Materials
      chassisDark: new THREE.MeshStandardMaterial({
        color: 0x181F23,
        roughness: 0.40,
        metalness: 0.56
      }),
      chassisMid: new THREE.MeshStandardMaterial({
        color: 0x29343C,
        roughness: 0.34,
        metalness: 0.68
      }),
      heatsinkAlum: new THREE.MeshStandardMaterial({
        color: 0x54636E,
        roughness: 0.26,
        metalness: 0.84
      }),
      copper: new THREE.MeshStandardMaterial({
        color: 0xC68342,
        roughness: 0.32,
        metalness: 0.86
      }),
      pcbSubstrate: new THREE.MeshStandardMaterial({
        map: pcbTraceTex,
        color: 0xD8E8E4,
        roughness: 0.52,
        metalness: 0.28,
        emissive: new THREE.Color(0x061618),
        emissiveIntensity: 0.45
      }),
      siliconDie: new THREE.MeshStandardMaterial({
        color: 0x14222D,
        roughness: 0.18,
        metalness: 0.78,
        emissive: new THREE.Color(0x0A2232),
        emissiveIntensity: 0.4
      }),
      glassVault: new THREE.MeshPhysicalMaterial({
        color: 0x0D1A22,
        roughness: 0.18,
        metalness: 0.15,
        transparent: true,
        opacity: 0.74
      }),
      earthDark: new THREE.MeshStandardMaterial({
        color: 0x08131E,
        roughness: 0.82,
        metalness: 0.18,
        emissive: new THREE.Color(0x041220),
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 1.0
      }),

      // Precision Technical Edge Lines
      edgeInk: new THREE.LineBasicMaterial({ color: 0xF3F4F0, transparent: true, opacity: 0.48 }),
      edgeDim: new THREE.LineBasicMaterial({ color: 0xF3F4F0, transparent: true, opacity: 0.2 }),
      edgeCyan: new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.76 }),
      edgeCyanDim: new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.3 }),
      edgeLime: new THREE.LineBasicMaterial({ color: 0xC6F135, transparent: true, opacity: 0.84 }),
      edgeAmber: new THREE.LineBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.86 }),

      // Emissive Signals
      glowLime: new THREE.MeshBasicMaterial({ color: 0xC6F135 }),
      glowCyan: new THREE.MeshBasicMaterial({ color: 0x38BDF8 }),
      glowAmber: new THREE.MeshBasicMaterial({ color: 0xF59E0B }),
      glowWhite: new THREE.MeshBasicMaterial({ color: 0xF8FAFC }),

      // Shaders
      atmosphereShader: createAtmosphereMaterial(THREE),
      boosterPlumeShader: createSeaLevelPlumeMaterial(THREE, false),
      boosterCoreShader: createSeaLevelPlumeMaterial(THREE, true),
      vacuumPlumeShader: createVacuumPlumeMaterial(THREE)
    };

    mats.addEdges = (mesh, geo, edgeMat, threshold = 22) => {
      const seg = new THREE.LineSegments(new THREE.EdgesGeometry(geo, threshold), edgeMat);
      mesh.add(seg);
      return seg;
    };

    mats.makeBox = (parent, bw, bh, bd, mat, edgeMat, pos, threshold = 22) => {
      const geo = new THREE.BoxGeometry(bw, bh, bd);
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (edgeMat) mats.addEdges(m, geo, edgeMat, threshold);
      if (parent) parent.add(m);
      return m;
    };

    return mats;
  }

  root.createMaterials = createMaterials;
})();
