/* ==========================================================================
   SPACE-TO-COMPUTE JOURNEY — CONFIG, TIMELINE, EASINGS & CAMERA SPLINE
   Single continuous 11-stage narrative (u ∈ [0, 1]) in one unified 3D world.
   ========================================================================== */
(() => {
  'use strict';

  const root = (window.SpaceComputeJourney = window.SpaceComputeJourney || {});

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const smootherstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const remap = (x, a0, a1, b0 = 0, b1 = 1) => b0 + clamp((x - a0) / (a1 - a0), 0, 1) * (b1 - b0);
  const easeInCubic = (t) => t * t * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOutQuint = (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Total uninterrupted cinema loop duration (seconds)
  const CYCLE_SEC = 58.0;

  // All 11 continuous chapters mapped across normalized journey progress u ∈ [0, 1]
  const STAGES = [
    {
      idx: 0,
      code: '01',
      id: 'launch',
      short: 'LAUNCH',
      label: 'IGNIÇÃO & DECOLAGEM · SUPER HEAVY',
      uStart: 0.000,
      uEnd: 0.145,
      focusU: 0.055,
      color: '#F59E0B',
      fogDensity: 0.014,
      skyHex: 0x06080A,
      accentHex: 0xF59E0B
    },
    {
      idx: 1,
      code: '02',
      id: 'separation',
      short: 'STAGE',
      label: 'SEPARAÇÃO DE ESTÁGIOS · HOT-STAGING',
      uStart: 0.145,
      uEnd: 0.225,
      focusU: 0.185,
      color: '#38BDF8',
      fogDensity: 0.008,
      skyHex: 0x040609,
      accentHex: 0x38BDF8
    },
    {
      idx: 2,
      code: '03',
      id: 'orbit',
      short: 'ORBIT',
      label: 'INSERÇÃO ORBITAL · LEO TERRESTRE',
      uStart: 0.225,
      uEnd: 0.305,
      focusU: 0.268,
      color: '#38BDF8',
      fogDensity: 0.0045,
      skyHex: 0x030508,
      accentHex: 0x38BDF8
    },
    {
      idx: 3,
      code: '04',
      id: 'deploy',
      short: 'DEPLOY',
      label: 'IMPLANTAÇÃO DE SATÉLITE & PAINÉIS',
      uStart: 0.305,
      uEnd: 0.405,
      focusU: 0.362,
      color: '#38BDF8',
      fogDensity: 0.004,
      skyHex: 0x030508,
      accentHex: 0x38BDF8
    },
    {
      idx: 4,
      code: '05',
      id: 'signal',
      short: 'SIGNAL',
      label: 'TRANSMISSÃO DE SINAL · DOWNLINK RF',
      uStart: 0.405,
      uEnd: 0.490,
      focusU: 0.448,
      color: '#C6F135',
      fogDensity: 0.006,
      skyHex: 0x04070B,
      accentHex: 0xC6F135
    },
    {
      idx: 5,
      code: '06',
      id: 'database',
      short: 'DATA',
      label: 'RECEPÇÃO TERRESTRE & DATABASE VAULT',
      uStart: 0.490,
      uEnd: 0.575,
      focusU: 0.540,
      color: '#38BDF8',
      fogDensity: 0.015,
      skyHex: 0x050708,
      accentHex: 0x38BDF8
    },
    {
      idx: 6,
      code: '07',
      id: 'gpu',
      short: 'GPU',
      label: 'ARQUITETURA GPU · PROCESSAMENTO PARALELO',
      uStart: 0.575,
      uEnd: 0.670,
      focusU: 0.628,
      color: '#38BDF8',
      fogDensity: 0.017,
      skyHex: 0x050708,
      accentHex: 0x38BDF8
    },
    {
      idx: 7,
      code: '08',
      id: 'cpu',
      short: 'CPU',
      label: 'ARQUITETURA CPU · PIPELINE & LÓGICA',
      uStart: 0.670,
      uEnd: 0.755,
      focusU: 0.715,
      color: '#C6F135',
      fogDensity: 0.017,
      skyHex: 0x050707,
      accentHex: 0xC6F135
    },
    {
      idx: 8,
      code: '09',
      id: 'binary',
      short: 'BINARY',
      label: 'FLUXO BINÁRIO (0/1) & TRILHAS ELÉTRICAS',
      uStart: 0.755,
      uEnd: 0.830,
      focusU: 0.794,
      color: '#C6F135',
      fogDensity: 0.018,
      skyHex: 0x050606,
      accentHex: 0xC6F135
    },
    {
      idx: 9,
      code: '10',
      id: 'nic',
      short: 'NIC',
      label: 'PLACA DE REDE · PHY / MAC & TRANSCEIVER',
      uStart: 0.830,
      uEnd: 0.905,
      focusU: 0.870,
      color: '#C6F135',
      fogDensity: 0.016,
      skyHex: 0x050607,
      accentHex: 0xC6F135
    },
    {
      idx: 10,
      code: '11',
      id: 'router',
      short: 'ROUTER',
      label: 'ROTEADOR CORE & REDE INTERCONECTADA',
      uStart: 0.905,
      uEnd: 1.000,
      focusU: 0.955,
      color: '#38BDF8',
      fogDensity: 0.012,
      skyHex: 0x040608,
      accentHex: 0x38BDF8
    }
  ];

  // Key spatial anchor coordinates in the single unified 3D universe
  const ANCHORS = {
    pad: [0, 0, 0],
    stagingPoint: [4.5, 29.5, -1.0],
    orbitApex: [22.0, 48.0, -5.0],
    earthCenter: [24.0, 12.0, -34.0],
    earthRadius: 32.0,
    satDeployEnd: [35.0, 49.0, -5.5],
    groundStation: [48.0, 23.0, 0.0],
    dbVault: [48.0, 10.0, 0.0],
    gpuCenter: [74.0, 10.0, 0.0],
    cpuCenter: [102.0, 10.0, 0.0],
    binaryMid: [122.0, 10.0, 0.0],
    nicCenter: [140.0, 10.0, 0.0],
    routerCenter: [160.0, 10.0, 0.0]
  };

  /* --------------------------------------------------------------------------
     MASTER CONTINUOUS CAMERA CHOREOGRAPHY TRACK (35 DIRECTED KEYFRAMES)
     Every single keyframe connects spatially to the next without cuts.
     { u, pos: [x,y,z], look: [x,y,z], fov, roll }
     -------------------------------------------------------------------------- */
  const CAMERA_TRACK = [
    // --- STAGE 01: PRE-LAUNCH GROUND TELEMETRY APPROACH -> FULL LAUNCH / ASCENT ---
    { u: 0.000, pos: [7.8, 3.4, 18.6], look: [-0.8, 4.1, 0.0], fov: 36, roll: 0.00 },
    { u: 0.022, pos: [6.0, 4.5, 17.6], look: [-0.5, 4.6, 0.0], fov: 35, roll: 0.00 },
    { u: 0.042, pos: [5.6, 5.1, 17.4], look: [-0.3, 4.7, 0.0], fov: 35, roll: 0.00 },
    { u: 0.068, pos: [6.8, 6.2, 18.0], look: [-0.1, 4.1, 0.0], fov: 37, roll: -0.015 },
    { u: 0.105, pos: [8.0, 12.2, 16.0], look: [1.0, 10.2, -0.3], fov: 39, roll: -0.03 },
    { u: 0.145, pos: [10.6, 26.8, 14.2], look: [3.6, 26.2, -0.8], fov: 38, roll: -0.04 },

    // --- STAGE 02: SEPARATION / STAGING (both Starship vacuum plume & flipping Booster visible) ---
    { u: 0.180, pos: [12.4, 34.4, 14.2], look: [5.2, 32.8, -1.4], fov: 37, roll: -0.03 },
    { u: 0.225, pos: [16.0, 42.4, 12.6], look: [12.0, 42.2, -3.2], fov: 36, roll: -0.02 },

    // --- STAGE 03: ORBITAL INSERTION (Earth Fresnel horizon rises heroically below Starship) ---
    { u: 0.265, pos: [23.2, 49.6, 10.6], look: [21.6, 47.4, -5.0], fov: 37, roll: 0.01 },
    { u: 0.304, pos: [26.8, 50.4, 6.6], look: [25.6, 48.7, -5.2], fov: 34, roll: 0.01 },

    // --- STAGE 04: SATELLITE RISES FOLDED OUT OF BAY -> CLEARANCE -> ACCORDION PANEL UNFOLD ---
    { u: 0.332, pos: [28.6, 51.2, 6.4], look: [27.0, 49.6, -5.25], fov: 34, roll: 0.008 },
    { u: 0.358, pos: [32.4, 51.4, 5.2], look: [30.6, 49.8, -5.4], fov: 33, roll: 0.005 },
    { u: 0.384, pos: [37.0, 50.9, 3.8], look: [34.4, 49.1, -5.5], fov: 32, roll: 0.00 },
    { u: 0.405, pos: [38.8, 49.2, 1.4], look: [35.4, 48.4, -5.4], fov: 32, roll: 0.015 },

    // --- STAGE 05: SIGNAL TRANSMISSION (subjective pursuit dive locked onto glowing RF carrier!) ---
    { u: 0.432, pos: [38.2, 46.2, 3.2], look: [40.2, 41.8, -3.6], fov: 40, roll: 0.045 },
    { u: 0.462, pos: [41.8, 37.8, 5.6], look: [44.2, 32.8, -1.6], fov: 43, roll: 0.035 },
    { u: 0.490, pos: [46.5, 29.8, 8.6], look: [48.0, 23.2, 0.0], fov: 39, roll: 0.015 },

    // --- STAGE 06: DATA ARRIVAL / ARCHITECTURAL DATABASE VAULT (full circular glass vault!) ---
    { u: 0.518, pos: [51.2, 22.8, 10.8], look: [48.0, 15.8, 0.0], fov: 37, roll: 0.00 },
    { u: 0.548, pos: [53.2, 17.8, 13.4], look: [48.2, 11.2, 0.0], fov: 36, roll: 0.00 },
    { u: 0.575, pos: [60.2, 16.0, 11.2], look: [62.5, 10.2, 0.0], fov: 35, roll: 0.00 },

    // --- STAGE 07: GPU / PARALLEL COMPUTE (full sculpted GPU: aluminum frame, PCIe, HBM3, 64 SMs!) ---
    { u: 0.605, pos: [70.2, 16.8, 11.8], look: [73.6, 10.2, 0.0], fov: 35, roll: -0.015 },
    { u: 0.638, pos: [76.2, 16.4, 11.2], look: [74.0, 10.2, 0.0], fov: 34, roll: 0.00 },
    { u: 0.670, pos: [86.8, 16.2, 11.2], look: [89.5, 10.2, 0.0], fov: 35, roll: 0.01 },

    // --- STAGE 08: CPU / EXECUTION ARCHITECTURE (full LGA socket, Pipeline, L3 Ring Bus, Branches!) ---
    { u: 0.702, pos: [99.2, 17.2, 11.6], look: [101.8, 10.2, 0.0], fov: 34, roll: 0.00 },
    { u: 0.735, pos: [105.0, 16.8, 11.2], look: [102.2, 10.2, 0.0], fov: 34, roll: -0.01 },
    { u: 0.755, pos: [112.2, 14.2, 8.2], look: [116.5, 10.1, 0.0], fov: 35, roll: 0.00 },

    // --- STAGE 09: BINARY / ELECTRICAL PCB CONDUIT (macro tracking along 6 copper trace lanes) ---
    { u: 0.792, pos: [120.4, 13.8, 7.6], look: [123.6, 10.1, 0.0], fov: 36, roll: 0.015 },
    { u: 0.830, pos: [132.4, 14.8, 8.8], look: [138.2, 10.2, 0.0], fov: 35, roll: 0.01 },

    // --- STAGE 10: NETWORK INTERFACE / NIC (full PCIe card: gold teeth, 7-fin heatsink, RJ45 + fiber!) ---
    { u: 0.868, pos: [143.2, 16.0, 11.4], look: [141.0, 10.3, 0.0], fov: 35, roll: 0.00 },
    { u: 0.905, pos: [150.4, 15.2, 9.6], look: [154.8, 10.5, 0.0], fov: 35, roll: -0.01 },

    // --- STAGE 11: ROUTER / CONNECTED MESH -> GROUND FIBER BACKBONE GLIDE -> PAD LOOP ---
    { u: 0.942, pos: [163.2, 16.2, 12.8], look: [160.2, 11.4, -0.2], fov: 36, roll: 0.00 },
    { u: 0.972, pos: [169.4, 14.2, 10.6], look: [167.0, 10.6, 0.0], fov: 36, roll: 0.00 },
    { u: 1.000, pos: [176.2, 12.6, 9.2], look: [179.0, 10.2, 0.0], fov: 36, roll: 0.00 }
  ];

  function getStageForU(u) {
    const cu = clamp(u, 0, 0.99999);
    for (let i = 0; i < STAGES.length; i++) {
      if (cu >= STAGES[i].uStart && cu < STAGES[i].uEnd) return STAGES[i];
    }
    return STAGES[STAGES.length - 1];
  }

  root.CONFIG = {
    CYCLE_SEC,
    STAGES,
    ANCHORS,
    CAMERA_TRACK,
    getStageForU,
    math: {
      clamp,
      lerp,
      smoothstep,
      smootherstep,
      remap,
      easeInCubic,
      easeOutCubic,
      easeInOutCubic,
      easeOutQuart,
      easeInOutQuint,
      mulberry32
    }
  };
})();
