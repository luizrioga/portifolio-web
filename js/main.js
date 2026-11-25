(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;

  /* ==========================================================================
     0. MOTION CORE — SHARED UTILITIES (EASING, LOOPS, VIEWPORT GATING, THREE)
     ========================================================================== */
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const isLowSpec = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const capDPR = (max = 2) => Math.min(window.devicePixelRatio || 1, isLowSpec ? Math.min(max, 1.25) : Math.min(max, 1.75));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Shared scroll telemetry: smoothed velocity in px/ms (decays to 0 when idle)
  const ScrollState = { y: window.scrollY || 0, v: 0, t: performance.now() };
  window.addEventListener('scroll', () => {
    const now = performance.now();
    const y = window.scrollY || 0;
    const dt = Math.max(1, now - ScrollState.t);
    ScrollState.v = ScrollState.v * 0.55 + ((y - ScrollState.y) / dt) * 0.45;
    ScrollState.y = y;
    ScrollState.t = now;
  }, { passive: true });
  function readScrollVelocity() {
    return performance.now() - ScrollState.t > 140 ? 0 : ScrollState.v;
  }

  // rAF loop controller with clamped delta-time (ms). frame(dt, t) may call stop().
  function createLoop(frame) {
    let raf = null;
    let last = 0;
    let running = false;
    function tick(t) {
      const dt = last ? Math.min(64, t - last) : 16.7;
      last = t;
      raf = requestAnimationFrame(tick);
      frame(dt, t);
    }
    return {
      start() {
        if (running) return;
        running = true;
        last = 0;
        raf = requestAnimationFrame(tick);
      },
      stop() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      },
      get running() { return running; }
    };
  }

  // Global modal pause & background lock — freezes background 3D loops, blurs & locks background via inert
  let isAnyModalOpen = false;
  const modalPauseListeners = new Set();
  function setBackgroundPaused(paused) {
    if (isAnyModalOpen === paused) return;
    isAnyModalOpen = paused;
    document.documentElement.classList.toggle('is-modal-open', paused);
    document.body.classList.toggle('is-modal-open', paused);
    ['main-content', 'top-bar', 'telemetry-rail'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.inert = paused;
    });
    modalPauseListeners.forEach((fn) => { try { fn(); } catch {} });
  }

  // Viewport + tab + modal visibility gate. Returns a disposer.
  function bindVisibility(el, onChange, rootMargin = '0px') {
    let inView = false;
    const emit = () => onChange(inView && !document.hidden && !isAnyModalOpen);
    const io = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      emit();
    }, { rootMargin, threshold: 0 });
    io.observe(el);
    document.addEventListener('visibilitychange', emit);
    modalPauseListeners.add(emit);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', emit);
      modalPauseListeners.delete(emit);
    };
  }

  // WebGL capability probe (throwaway context, released immediately)
  const webglSupported = (() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch {
      return false;
    }
  })();

  // Lazy Three.js (native dynamic ES module import — CSP-safe, zero eval)
  const dynImport = (u) => import(u);
  const THREE_CDN = [
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js',
    'https://unpkg.com/three@0.160.0/build/three.module.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
  ];
  let threePromise = null;
  function loadThree() {
    if (threePromise) return threePromise;
    threePromise = (async () => {
      if (!dynImport || !webglSupported) throw new Error('WebGL/ESM unavailable');
      for (const url of THREE_CDN) {
        try {
          const mod = await dynImport(url);
          if (mod && mod.WebGLRenderer) return mod;
        } catch { /* try next mirror */ }
      }
      throw new Error('Three.js CDN unreachable');
    })();
    return threePromise;
  }

  // Swap a canvas for a pristine clone (a canvas that already owns a WebGL context can't give 2D)
  function freshCanvas(canvas) {
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    return fresh;
  }

  /* ==========================================================================
     1. HARDWARE SPECIMEN METADATA (CLEAN HIGH-RES STUDIO PHOTOS)
     ========================================================================== */
  const HARDWARE_SPECS = {
    bit1: {
      src: 'assets/bit-1.jpg?v=20261124a',
      alt: 'Protótipo Bit I do Projeto Íris com Arduino Uno e shield customizado em fenolite'
    },
    bit2: {
      src: 'assets/bit-2.jpg?v=20261124a',
      alt: 'Protótipo Bit II autônomo e portátil do Projeto Íris com duas baterias, sistema de carregamento e cabos reforçados'
    }
  };

  /* ==========================================================================
     2. CASES DOCUMENTADOS (FONTE ÚNICA DE VERDADE — 01 ÍRIS A 04 AGROBIT)
     ========================================================================== */
  const PROJECTS = [
    {
      id: 'iris',
      index: '01',
      accent: '#C6F135',
      isDemo: false,
      period: '2023 · IFMG / RIW',
      scope: 'Hardware Assistivo · Baixo Custo',
      roleShort: 'Líder Técnico · Bitmind',
      resultLabel: 'ENTREGA //',
      before: 'Protótipo inicial Bit I com processamento dedicado em Arduino Uno e shield em fenolite, mas ainda dependente de alimentação externa.',
      after: 'Protótipo Bit II portátil e autônomo, com duas baterias, carregamento embarcado e cabos reforçados — apresentado na final da V Olimpíada do IFMG e na Rio Innovation Week 2023.',
      metric: null,
      cardSummary: 'Óculos com sensores, caixa de processamento (Bit I → Bit II) e pulseiras vibratórias para locomoção urbana assistiva.',
      cardResult: 'Duas gerações funcionais (Bit I → Bit II) de dispositivo vestível assistivo de baixo custo, apresentadas na V Olimpíada do IFMG e na RIW 2023.',
      highlights: [
        { k: 'EVOLUÇÃO', v: 'Bit I → Bit II' },
        { k: 'EXPOSIÇÃO', v: 'Final da V Olimpíada de Inovação do IFMG · RIW 2023' },
        { k: 'CARGA HORÁRIA', v: '240h · Olimpíada IFMG' }
      ],
      name: 'Projeto Íris · Bitmind',
      shortTag: 'Hardware Assistivo',
      category: 'Hardware / Tecnologia Assistiva / Embarcados',
      summary: 'Dispositivo vestível de baixo custo para auxiliar pessoas com deficiência visual na locomoção urbana com feedback tátil.',
      problem: 'Obstáculos acima da linha da cintura e mudanças de ambiente exigem alertas táteis discretos e imediatos para apoio à mobilidade urbana.',
      built: 'Coordenei tecnicamente, junto à equipe Bitmind, o desenvolvimento do hardware embarcado e do firmware em Arduino — integrando sensores nos óculos, caixa de processamento dedicada (evoluída do Bit I para o Bit II portátil com duas baterias e carregamento embarcado) e pulseiras vibratórias.',
      role: 'Líder técnico da equipe Bitmind — coordenação técnica do hardware e firmware embarcado, além da apresentação para interessados e avaliadores.',
      stack: ['Hardware', 'Arduino / Embarcados', 'Ultrassônico', 'Feedback Háptico'],
      deliverables: [
        'Protótipo Bit I (REV.01): Arduino Uno + shield personalizado em fenolite com processamento dedicado',
        'Protótipo Bit II (REV.02): alimentação autônoma com 2 baterias, carregamento embarcado, cabos reforçados e maior portabilidade',
        'Pitch e apresentação na final da V Olimpíada de Inovação do IFMG',
        'Apresentação na Rio Innovation Week 2023 (estande e pitch)'
      ],
      learnings: [
        'Comunicação clara e empatia com quem usa pesam tanto quanto a eletrônica do protótipo.',
        'Evoluir do Bit I ao Bit II trouxe lições concretas de ergonomia, alimentação e portabilidade.',
        'Demonstrar o hardware ao vivo na RIW acelerou melhorias práticas de produto.'
      ]
    },
    {
      id: 'bigbag',
      index: '02',
      accent: '#38BDF8',
      isDemo: false,
      period: '2026 · ACTECH',
      scope: 'Web · Nuvem · IA · Automação',
      roleShort: 'Processo, Web & Automação',
      resultLabel: 'RESULTADO //',
      before: 'Apontamentos fragmentados dificultavam a rastreabilidade de lotes, o controle de estoque, o backlog e o repasse de informações da triagem.',
      after: 'Operação de triagem centralizada em ambiente web e nuvem, com distribuição semanal automatizada de estoque, backlog e chegadas aos interessados.',
      metric: null,
      cardSummary: 'Aplicação web, Firebase, Cloudflare R2 e Gemini API centralizando a rotina de triagem e relatórios semanais.',
      cardResult: 'Centralizou a triagem em nuvem e automatizou o envio semanal de estoque, backlog e chegadas para os interessados.',
      highlights: [
        { k: 'ARQUITETURA', v: '06 Camadas Integradas' },
        { k: 'NUVEM & IA', v: 'Firebase · R2 · Gemini API' },
        { k: 'ORQUESTRAÇÃO', v: 'Apps Script + Power Automate' }
      ],
      name: 'Triagem de Big Bags · Ecossistema Digital',
      shortTag: 'Web · Nuvem · IA',
      category: 'Web / Nuvem / IA / Automação de Processos',
      summary: 'Organização operacional em área e ecossistema digital na Actech conectando interface web, nuvem, IA e envio semanal.',
      problem: 'Registros fragmentados limitavam a rastreabilidade de lotes, o controle de estoque e atrasavam o repasse de informações da triagem.',
      built: 'Acompanhei a rotina diariamente em área, organizei o fluxo, escrevi o procedimento operacional, treinei o pessoal e construí aplicação web (HTML/CSS/JS) integrada a Firebase, Cloudflare R2, Gemini API, Google Apps Script e Power Automate.',
      role: 'Acompanhamento diário em área, organização do fluxo, redação do procedimento operacional, treinamento da equipe, mobilização de recursos e desenvolvimento web, nuvem e automação de relatórios.',
      stack: ['HTML / CSS / JS', 'Firebase', 'Cloudflare R2', 'Gemini API', 'Apps Script', 'Power Automate'],
      deliverables: [
        'Acompanhamento diário em área, organização do fluxo e estruturação da triagem',
        'Elaboração do procedimento operacional, treinamento de pessoal e mobilização de recursos',
        'Aplicação web para registros diários, controle de estoque, backlog e chegadas',
        'Centralização em nuvem (Firebase + Cloudflare R2)',
        'Relatórios assistidos por IA (Gemini API) e disparo semanal automatizado aos interessados'
      ],
      learnings: [
        'Organizar o fluxo físico, treinar a equipe e documentar o procedimento antes de codificar evita digitalizar gargalos.',
        'Serviços enxutos e especializados entregam robustez sem complexidade excessiva.',
        'Fechar o ciclo com envio semanal automático garante visibilidade contínua para todos os interessados.'
      ]
    },
    {
      id: 'fretefy',
      index: '03',
      accent: '#F59E0B',
      isDemo: false,
      period: '2026 · ACTECH',
      scope: 'ETL · Power Query · BI Logístico',
      roleShort: 'Modelagem ETL & 8 KPIs',
      resultLabel: 'RESULTADO //',
      before: 'Extrações brutas do Fretefy exigiam tratamento, atualizações e conferências manuais demoradas; 8 indicadores logísticos eram acompanhados apenas de forma empírica.',
      after: 'Pipeline ETL reutilizável em Power Query consolidando o TPV mensal em menos de 5 minutos e estruturando 8 KPIs logísticos em painéis.',
      metric: 'TPV mensal em < 5 min · 8 KPIs',
      cardSummary: 'Pipeline ETL em Power Query gerando o TPV mensal em menos de 5 minutos e estruturando 8 KPIs logísticos.',
      cardResult: 'Eliminou praticamente todo o processo manual, gerando o TPV mensal e 8 KPIs em menos de 5 minutos.',
      highlights: [
        { k: 'PIPELINE', v: 'Power Query ETL (4 Estágios)' },
        { k: 'KPI CENTRAL', v: 'TPV mensal em < 5 min' },
        { k: 'KPIS CALCULADOS', v: '08 Indicadores Logísticos' }
      ],
      name: 'Automação de Dados Fretefy',
      shortTag: 'ETL & BI Logístico',
      category: 'Análise de Dados / ETL / Logística',
      summary: 'Fluxo ETL em Excel e Power Query transformando extrações brutas do Fretefy em visões logísticas com 8 KPIs automatizados.',
      problem: 'As extrações brutas do Fretefy exigiam tratamento, atualizações e conferências manuais demoradas, sem um caminho simples de automação — e vários KPIs logísticos eram acompanhados apenas na base empírica.',
      built: 'Estruturei um pipeline ETL reutilizável em Excel e Power Query conectado a tabelas dinâmicas e dashboards para automatizar o fechamento do TPV mensal e consolidar 8 KPIs por histórico, dia da semana, turno, frota e capacidade.',
      role: 'Modelagem ETL no Power Query, automação do cálculo de TPV e estruturação de 8 KPIs e visões analíticas.',
      stack: ['Excel', 'Power Query', 'ETL', 'Tabelas Dinâmicas', '8 KPIs', 'Dashboards'],
      deliverables: [
        'Pipeline ETL reproduzível reduzindo tratamento, atualizações e conferências manuais',
        'Fechamento do TPV mensal (Tempo de Permanência de Veículos) em menos de 5 minutos',
        'Estruturação de 8 KPIs logísticos antes acompanhados apenas de forma empírica',
        'Painéis por histórico, turno, dia da semana, tipo de veículo e capacidade'
      ],
      learnings: [
        'A confiabilidade do indicador nasce na consistência da etapa de tratamento de dados.',
        'Transformar percepções empíricas do pátio em 8 KPIs estruturados revela gargalos invisíveis em médias gerais.',
        'Automatizar na ferramenta que a equipe já usa acelera o entendimento e a adoção na rotina.'
      ]
    },
    {
      id: 'agrobit',
      index: '04',
      accent: '#34D399',
      isDemo: false,
      period: '2026 · BITMINDOP',
      scope: 'AgTech · Geoespacial · APIs · Conceito IoT',
      roleShort: 'Co-desenvolvimento · APIs & ESP32',
      resultLabel: 'ENTREGA //',
      before: 'Consulta manual e dispersa em diferentes bases geográficas, climáticas e agronômicas atrasava a análise do terreno.',
      after: 'Plataforma web única integrando OpenStreetMap, NASA POWER, Embrapa e síntese via Gemini API, somada ao conceito de sensor de solo com ESP32/Arduino.',
      metric: null,
      cardSummary: 'Plataforma web integrando OpenStreetMap, NASA POWER, Embrapa, Gemini API e conceito de sensor ESP32/Arduino.',
      cardResult: 'Plataforma web unificando OpenStreetMap, NASA POWER, Embrapa e Gemini API, mais conceito de sensor de solo ESP32/Arduino.',
      highlights: [
        { k: 'INTEGRAÇÃO', v: 'OSM · NASA · Embrapa · IA' },
        { k: 'TECNOLOGIAS', v: 'HTML · CSS · JS · APIs' },
        { k: 'HARDWARE', v: 'Conceito ESP32 / Arduino' }
      ],
      name: 'AGROBIT · Bitmindop',
      shortTag: 'AgTech · Geo · IA',
      category: 'AgTech / Geoespacial / IA / Conceito IoT',
      summary: 'Plataforma web de apoio à decisão agrícola co-desenvolvida com a equipe Bitmindop reunindo APIs abertas, IA e conceito de sensor de solo.',
      problem: 'Consultar fontes geográficas, meteorológicas e agronômicas separadamente atrasava a leitura do terreno agrícola.',
      built: 'Co-desenvolvi com a equipe Bitmindop a plataforma web orquestrando OpenStreetMap, NASA POWER, Embrapa e Gemini API, além da concepção do sensor de solo com ESP32 e Arduino.',
      role: 'Co-desenvolvimento da arquitetura web, integração das APIs geoespaciais/climáticas e concepção do sensor de solo em ESP32/Arduino.',
      stack: ['HTML / CSS / JS', 'OpenStreetMap', 'NASA POWER', 'Embrapa', 'Gemini API', 'ESP32 / Arduino'],
      deliverables: [
        'Plataforma web de apoio à decisão agrícola (equipe Bitmindop)',
        'Integração OpenStreetMap + NASA POWER + Embrapa + Gemini API',
        'Conceito de protótipo de sensor de solo com ESP32 e Arduino'
      ],
      learnings: [
        'Normalizar APIs heterogêneas é essencial antes de aplicar síntese por IA.',
        'Unir dados de satélite a um conceito de telemetria local aumenta a utilidade prática em campo.'
      ]
    }
  ];

  /* ==========================================================================
     3. PRINCÍPIOS — 10 PENSADORES (CARROSSEL ORBITAL 3D RESTAURADO)
     ========================================================================== */
  const PRINCIPLES = [
    {
      index: '01',
      discipline: 'FÍSICA',
      theme: 'CURIOSIDADE',
      accent: '#38BDF8',
      quote: '“Eu não tenho talentos especiais, sou apenas apaixonadamente curioso.”',
      author: 'Albert Einstein',
      role: 'Físico Teórico · Relatividade',
      note: 'Curiosidade prática desmonta a caixa preta — do gargalo no pátio à arquitetura de uma nova API.'
    },
    {
      index: '02',
      discipline: 'ESTOICISMO',
      theme: 'AÇÃO',
      accent: '#F59E0B',
      quote: '“O impedimento à ação faz avançar a ação. O que está no caminho torna-se o caminho.”',
      author: 'Marco Aurélio',
      role: 'Filósofo Estoico · Meditações',
      note: 'Restrições de bancada, dados brutos e limitações de campo definem o desenho real da solução.'
    },
    {
      index: '03',
      discipline: 'ENGENHARIA',
      theme: 'EXPERIMENTAÇÃO',
      accent: '#C6F135',
      quote: '“No mínimo, estou comprometido a falhar de uma nova maneira.”',
      author: 'Elon Musk',
      role: 'Engenheiro-Chefe · SpaceX',
      note: 'Do Bit I ao Bit II e da planilha manual ao fluxo em nuvem: iterar cedo elimina falhas estruturais.'
    },
    {
      index: '04',
      discipline: 'FÍSICA',
      theme: 'COMPREENSÃO',
      accent: '#38BDF8',
      quote: '“O que eu não consigo criar, eu não compreendo.”',
      author: 'Richard Feynman',
      role: 'Físico · Eletrodinâmica Quântica',
      note: 'Construir o circuito, o ETL e a aplicação força entendimento real — muito além da teoria no papel.'
    },
    {
      index: '05',
      discipline: 'ESTOICISMO',
      theme: 'PREPARO',
      accent: '#F59E0B',
      quote: '“Sorte é o que acontece quando a preparação encontra a oportunidade.”',
      author: 'Sêneca',
      role: 'Filósofo Estoico · Cartas a Lucílio',
      note: 'Formação técnica, cronoanálise disciplinada e base sólida transformam demandas em entregas concretas.'
    },
    {
      index: '06',
      discipline: 'ENGENHARIA',
      theme: 'INFORMAÇÃO',
      accent: '#C6F135',
      quote: '“A informação é a resolução da incerteza.”',
      author: 'Claude Shannon',
      role: 'Engenheiro & Matemático · Teoria da Informação',
      note: 'Modelar dados de expedição e estruturar KPIs substitui achismo operacional por decisão objetiva.'
    },
    {
      index: '07',
      discipline: 'MATEMÁTICA',
      theme: 'RIGOR',
      accent: '#A78BFA',
      quote: '“Não é o conhecimento, mas o ato de aprender; não a posse, mas o ato de chegar lá, que concede a maior satisfação.”',
      author: 'Carl Friedrich Gauss',
      role: 'Matemático & Físico · Príncipe da Matemática',
      note: 'Dominar uma nova ferramenta, do microcontrolador à nuvem, nasce do gosto pelo processo de investigação.'
    },
    {
      index: '08',
      discipline: 'ESTOICISMO',
      theme: 'CONTROLE',
      accent: '#F59E0B',
      quote: '“Não são os eventos que perturbam as pessoas, mas os julgamentos que fazem sobre eles.”',
      author: 'Epicteto',
      role: 'Filósofo Estoico · Enquirídio',
      note: 'Sob pressão em palco, fábrica ou prazo apertado, clareza analítica supera reação impulsiva.'
    },
    {
      index: '09',
      discipline: 'ENGENHARIA',
      theme: 'VISÃO',
      accent: '#C6F135',
      quote: '“O presente é deles; o futuro, pelo qual realmente trabalhei, é meu.”',
      author: 'Nikola Tesla',
      role: 'Engenheiro Eletricista & Inventor',
      note: 'Investir hoje em engenharia, automação e sistemas sólidos constrói base técnica de longo prazo.'
    },
    {
      index: '10',
      discipline: 'MATEMÁTICA',
      theme: 'HORIZONTE',
      accent: '#A78BFA',
      quote: '“Só podemos ver um pouco do futuro, mas o suficiente para perceber que há muito a fazer.”',
      author: 'Alan Turing',
      role: 'Matemático & Pai da Computação',
      note: 'Cada solução construída revela o próximo nível de automação, dados e integração possível.'
    }
  ];

  /* ==========================================================================
     4. FERRAMENTAS & STACK (100% PT-BR + TERMOS TÉCNICOS CONSAGRADOS)
     ========================================================================== */
  const TOOLBOX_DATA = [
    {
      id: 'data',
      label: 'DADOS & ANÁLISE',
      code: 'MOD.01',
      tools: [
        { name: 'Excel', tier: 'core', projects: ['fretefy'], context: 'Modelagem analítica, cálculos automatizados e painéis operacionais na rotina industrial.' },
        { name: 'Power Query', tier: 'core', projects: ['fretefy'], context: 'Pipeline ETL reproduzível sobre bases logísticas do Fretefy.' },
        { name: 'Análise de dados', tier: 'core', projects: ['fretefy', 'bigbag', 'agrobit'], context: 'Leitura de padrões, gargalos operacionais e dados ambientais.' },
        { name: 'ETL', tier: 'project', projects: ['fretefy'], context: 'Limpeza e modelagem de dados brutos em bases confiáveis.' },
        { name: 'KPIs', tier: 'core', projects: ['fretefy', 'bigbag'], context: 'Estruturação de indicadores como TPV, estoque, backlog e eficiência.' },
        { name: 'Dashboards', tier: 'project', projects: ['fretefy'], context: 'Visões interativas por turno, dia da semana e tipo de veículo.' }
      ]
    },
    {
      id: 'dev',
      label: 'DESENVOLVIMENTO',
      code: 'MOD.02',
      tools: [
        { name: 'HTML', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Estrutura semântica para aplicações web operacionais.' },
        { name: 'CSS', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Interfaces responsivas orientadas à clareza de uso.' },
        { name: 'JavaScript', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Regras interativas, validações e consumo de APIs.' },
        { name: 'Aplicações web', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Interfaces web sob medida para centralizar rotinas reais.' },
        { name: 'Git & VS Code', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Versionamento e fluxo diário de desenvolvimento.' }
      ]
    },
    {
      id: 'cloud',
      label: 'NUVEM & INFRA',
      code: 'MOD.03',
      tools: [
        { name: 'Firebase', tier: 'core', projects: ['bigbag'], context: 'Centralização em nuvem dos registros da triagem de Big Bags.' },
        { name: 'Cloudflare R2', tier: 'project', projects: ['bigbag'], context: 'Armazenamento de objetos integrado ao fluxo digital da operação.' },
        { name: 'OSM & NASA POWER', tier: 'project', projects: ['agrobit'], context: 'Consumo de APIs geoespaciais e climáticas no AGROBIT.' }
      ]
    },
    {
      id: 'ai',
      label: 'IA APLICADA',
      code: 'MOD.04',
      tools: [
        { name: 'Gemini', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Síntese assistida de relatórios operacionais e recomendações técnicas.' },
        { name: 'APIs de IA', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Integração da Gemini API nos fluxos de Big Bags e AGROBIT.' },
        { name: 'Prototipação com IA', tier: 'core', projects: ['bigbag', 'agrobit'], context: 'Aceleração de protótipos com revisão técnica humana.' },
        { name: 'Engenharia de prompts', tier: 'project', projects: ['bigbag', 'agrobit'], context: 'Instruções estruturadas para síntese técnica e consistência documental.' }
      ]
    },
    {
      id: 'automation',
      label: 'AUTOMAÇÃO',
      code: 'MOD.05',
      tools: [
        { name: 'Apps Script', tier: 'project', projects: ['bigbag'], context: 'Automação de processamento e ponte entre serviços.' },
        { name: 'Power Automate', tier: 'project', projects: ['bigbag'], context: 'Orquestração e disparo semanal de relatórios.' },
        { name: 'Automação de fluxos', tier: 'core', projects: ['fretefy', 'bigbag'], context: 'Redução de etapas manuais da coleta ao envio de informações.' }
      ]
    },
    {
      id: 'eng',
      label: 'ENGENHARIA & HARDWARE',
      code: 'MOD.06',
      tools: [
        { name: 'Automação industrial', tier: 'core', projects: ['iris', 'bigbag'], context: 'Formação técnica no IFMG e graduação em Eng. de Controle e Automação (UFOP).' },
        { name: 'Arduino & ESP32', tier: 'core', projects: ['iris', 'agrobit'], context: 'Protótipos embarcados (Íris) e conceito de sensor de solo (AGROBIT).' },
        { name: 'Microeletrônica', tier: 'project', projects: ['iris'], context: 'Circuitos, regulação de tensão e evolução Bit I → Bit II.' },
        { name: 'Otimização de processos', tier: 'core', projects: ['fretefy', 'bigbag'], context: 'Mapeamento de gargalos e melhoria contínua industrial.' },
        { name: 'Cronoanálise & controles', tier: 'core', projects: ['fretefy', 'bigbag'], context: 'Medição de tempos, listas de verificação, Qualyteam e rastreabilidade.' }
      ]
    }
  ];

  /* ==========================================================================
     4b. CERTIFICAÇÕES (FONTE ÚNICA DE VERDADE — 3 DESTAQUES + ACERVO COMPLETO)
     ========================================================================== */
  const CERTIFICATES = [
    { code: 'CERT.01', featured: true, accent: '#C6F135', badge: 'IA & DADOS', year: '2026', title: 'Google AI Professional', sub: 'Coursera · 8 cursos', src: 'assets/certs/cert-01-google-ai.jpg' },
    { code: 'CERT.02', featured: true, accent: '#38BDF8', badge: 'ENGENHARIA & GEO', year: '2026', title: 'NASA Space Apps Challenge', sub: 'Desafio Global · NASA', src: 'assets/certs/cert-02-nasa-space-apps.jpg' },
    { code: 'CERT.03', featured: false, year: 'ACTECH', title: 'ACTECH Explica: IA em Foco', sub: 'Palestra · 2 h', src: 'assets/certs/cert-03-actech-ia.jpg' },
    { code: 'CERT.04', featured: false, year: '2025', title: 'Aprendizagem Profissional', sub: 'Rede Cidadã · 1.280 h', src: 'assets/certs/cert-04-jovem-aprendiz.jpg' },
    { code: 'CERT.05', featured: false, year: '2025', title: 'II Workshop de IA', sub: 'IFMG Ouro Preto · 4 h', src: 'assets/certs/cert-05-workshop-ia.jpg' },
    { code: 'CERT.06', featured: false, year: '2024', title: 'Técnico em Automação Industrial', sub: 'IFMG Ouro Preto · Diploma', src: 'assets/certs/cert-06-tecnico-automacao.jpg' },
    { code: 'CERT.07', featured: false, year: '2024', title: 'Encontro de Saberes', sub: 'UFOP · 2024', src: 'assets/certs/cert-07-encontro-saberes.jpg' },
    { code: 'CERT.08', featured: false, year: '2024', title: 'Oficina CustomGPTs', sub: 'IFMG Ouro Preto · 3 h', src: 'assets/certs/cert-08-customgpts.jpg' },
    { code: 'CERT.09', featured: false, year: '2024', title: 'Projetos de Automação', sub: 'IFMG Itabirito · Palestrante · 3 h', src: 'assets/certs/cert-09-automacao-itabirito.jpg' },
    { code: 'CERT.10', featured: true, accent: '#F59E0B', badge: 'MÉRITO ACADÊMICO', year: '2023', title: 'Estudante Destaque IFMG', sub: 'Reitoria IFMG · Mérito Acadêmico', src: 'assets/certs/cert-10-estudante-destaque.jpg' },
    { code: 'CERT.11', featured: false, year: '2023', title: 'V Olimpíada de Inovação', sub: 'IFMG · Bitmind · 240 h', src: 'assets/certs/cert-11-olimpiada-inovacao.jpg' },
    { code: 'CERT.12', featured: false, year: '2023', title: 'Rio Innovation Week', sub: 'Participação · 3ª ed.', src: 'assets/certs/cert-12-riw.jpg' },
    { code: 'CERT.13', featured: false, year: '2023', title: 'Oficina: Lixo Eletrônico', sub: 'IFMG OP · Ministrante · 2 h', src: 'assets/certs/cert-13-lixo-eletronico.jpg' },
    { code: 'CERT.14', featured: false, year: '2019', title: 'Menção Honrosa — OBMEP', sub: 'IMPA · MEC · 2019', src: 'assets/certs/cert-14-obmep-2019.jpg' },
    { code: 'CERT.15', featured: false, year: '2017', title: 'Menção Honrosa — OBMEP', sub: 'IMPA · 13ª OBMEP · 2017', src: 'assets/certs/cert-15-obmep-2017.jpg' }
  ];

  // Sincroniza todas as contagens de cases e certificações a partir dos arrays únicos
  (function syncDynamicCounts() {
    const projectTotal = PROJECTS.length;
    const projectPadded = String(projectTotal).padStart(2, '0');
    document.querySelectorAll('[data-projects-count]').forEach((el) => {
      if (el.hasAttribute('data-count-to')) {
        el.setAttribute('data-count-to', String(projectTotal));
      }
      el.textContent = projectPadded;
    });

    const certTotal = CERTIFICATES.length;
    const certPadded = String(certTotal).padStart(2, '0');
    document.querySelectorAll('[data-certs-count]').forEach((el) => {
      if (el.hasAttribute('data-count-to')) {
        el.setAttribute('data-count-to', String(certTotal));
      }
      el.textContent = certPadded;
    });
  })();

  /* ==========================================================================
     5. TOAST HELPER
     ========================================================================== */
  const toastEl = document.getElementById('system-toast');
  const toastText = document.getElementById('system-toast-text');
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl || !toastText) return;
    toastText.textContent = message;
    toastEl.classList.remove('opacity-0', 'translate-y-4');
    toastEl.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add('opacity-0', 'translate-y-4');
      toastEl.classList.remove('opacity-100', 'translate-y-0');
    }, 2600);
  }

  /* ==========================================================================
     6. STREAMLINED TOP BAR, MAGNETIC SLIDING NAV PILL & 3D REVEAL OBSERVER
     ========================================================================== */
  const topBarEl = document.getElementById('top-bar');
  const progressEl = document.getElementById('scroll-progress');
  const mobileModuleBadge = document.getElementById('mobile-module-badge');
  const navRailEl = document.getElementById('desktop-nav-rail');
  const navSliderEl = document.getElementById('nav-pill-slider');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[data-module]');
  let activeNavLinkEl = null;

  function moveNavSlider(targetLink, isHoverPreview = false) {
    if (!navSliderEl || !navRailEl) return;
    if (!targetLink) {
      navSliderEl.classList.remove('is-visible', 'is-hovering');
      return;
    }
    const railRect = navRailEl.getBoundingClientRect();
    const linkRect = targetLink.getBoundingClientRect();
    if (railRect.width === 0 || linkRect.width === 0) return;
    const x = linkRect.left - railRect.left;
    navSliderEl.style.width = `${linkRect.width.toFixed(1)}px`;
    navSliderEl.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    navSliderEl.classList.add('is-visible');
    navSliderEl.classList.toggle('is-hovering', isHoverPreview);
  }

  if (navRailEl && isFinePointer && canHover) {
    navLinks.forEach((link) => {
      link.addEventListener('pointerenter', () => moveNavSlider(link, link !== activeNavLinkEl));
    });
    navRailEl.addEventListener('pointerleave', () => moveNavSlider(activeNavLinkEl, false));
  }

  window.addEventListener('resize', () => {
    if (activeNavLinkEl) moveNavSlider(activeNavLinkEl, false);
  }, { passive: true });

  function updateScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
    if (progressEl) progressEl.style.width = `${ratio}%`;
    if (topBarEl) topBarEl.classList.toggle('is-scrolled', scrollTop > 24);
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  updateScrollProgress();

  const mobileNavLinks = document.querySelectorAll('[data-mobile-nav]');
  const MOBILE_BADGE_MAP = {
    intro: '00 · INÍCIO',
    thinking: '01 · SOBRE',
    works: '02 · PROJETOS',
    experience: '03 · ACTECH',
    academic: '04 · FORMAÇÃO',
    toolbox: '05 · STACK',
    principles: '06 · PRINCÍPIOS',
    outside: '07 · CAMPO',
    connect: '08 · CONTATO'
  };

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const modLabel = entry.target.getAttribute('data-module');
        const secId = entry.target.id;
        if (mobileModuleBadge) {
          mobileModuleBadge.textContent = MOBILE_BADGE_MAP[secId] || (modLabel ? modLabel.replace(' // ', ' · ') : '00');
        }
        activeNavLinkEl = null;
        navLinks.forEach((link) => {
          const isActive = link.getAttribute('data-nav') === secId;
          if (isActive) activeNavLinkEl = link;
          link.classList.toggle('text-limeTech', isActive);
          link.classList.toggle('text-muted', !isActive);
          if (isActive) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        mobileNavLinks.forEach((link) => {
          const isActive = link.getAttribute('data-mobile-nav') === secId;
          link.setAttribute('data-active', String(isActive));
          if (isActive) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        moveNavSlider(activeNavLinkEl, false);
      });
    },
    { rootMargin: '-32% 0px -56% 0px', threshold: 0 }
  );
  sections.forEach((sec) => sectionObserver.observe(sec));

  function observeReveals(root = document) {
    const els = root.querySelectorAll('.reveal:not(.is-visible)');
    if (prefersReducedMotion) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver(
      (entries, o) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            o.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );
    els.forEach((el) => obs.observe(el));
  }
  observeReveals();

  /* ==========================================================================
     6b. SPACEX MISSION METRICS COUNT-UP (VIEWPORT-TRIGGERED ONCE)
     ========================================================================== */
  (function initMissionMetrics() {
    const band = document.getElementById('mission-metrics');
    if (!band) return;
    const counters = Array.from(band.querySelectorAll('[data-count-to]'));
    if (!counters.length) return;

    function formatVal(n, pad, suffix) {
      const s = pad ? String(Math.round(n)).padStart(pad, '0') : String(Math.round(n));
      return s + (suffix || '');
    }

    if (prefersReducedMotion) {
      counters.forEach((el) => {
        el.textContent = formatVal(
          Number(el.getAttribute('data-count-to')),
          Number(el.getAttribute('data-count-pad')) || 0,
          el.getAttribute('data-count-suffix') || ''
        );
      });
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const duration = 900;

      function tick(now) {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = easeOutCubic(t);
        counters.forEach((el) => {
          const target = Number(el.getAttribute('data-count-to')) || 0;
          const pad = Number(el.getAttribute('data-count-pad')) || 0;
          const suffix = el.getAttribute('data-count-suffix') || '';
          el.textContent = formatVal(target * eased, pad, suffix);
        });
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, { threshold: 0.2 });

    io.observe(band);
  })();

  /* ==========================================================================
     7. MOBILE DRAWER (SMOOTH ANIMATED + ACCESSIBLE)
     ========================================================================== */
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const iconOpen = document.getElementById('icon-menu-open');
  const iconClose = document.getElementById('icon-menu-close');

  function setMobileMenu(open) {
    if (!mobileDrawer || !mobileMenuBtn) return;
    mobileMenuBtn.setAttribute('aria-expanded', String(open));
    mobileDrawer.setAttribute('data-open', String(open));
    mobileDrawer.setAttribute('aria-hidden', String(!open));
    if (iconOpen) iconOpen.classList.toggle('hidden', open);
    if (iconClose) iconClose.classList.toggle('hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      setMobileMenu(mobileMenuBtn.getAttribute('aria-expanded') !== 'true');
    });
  }
  document.querySelectorAll('.mobile-nav-link').forEach((l) => l.addEventListener('click', () => setMobileMenu(false)));

  /* ==========================================================================
     8. PORTRAIT FALLBACK SAFETY
     ========================================================================== */
  (function initPortraitFallback() {
    const img = document.getElementById('portrait-img');
    const placeholder = document.getElementById('portrait-placeholder');
    if (!img || !placeholder) return;
    img.addEventListener('error', () => {
      img.classList.add('hidden');
      placeholder.classList.remove('hidden');
    });
  })();

  /* ==========================================================================
     9. SPRING-DAMPED SPATIAL 3D TILT + DIRECTIONAL #C6F135 SHEEN (FINE POINTER)
        Critically-tuned spring (no snapping on enter/leave), hover lift in Z,
        lerped sheen, and CSS transform transitions suspended while engaged so
        .reveal / Tailwind transition-all never fight the per-frame transform.
     ========================================================================== */
  function bindSpatialTilt(root = document) {
    if (prefersReducedMotion || !isFinePointer || !canHover) return;
    const targets = root.querySelectorAll('.spatial-tilt:not([data-tilt-bound])');

    targets.forEach((el) => {
      el.setAttribute('data-tilt-bound', 'true');
      const maxDeg = Number(el.getAttribute('data-tilt-max')) || 5;
      const K = 0.075;   // stiffness
      const D = 0.24;    // damping
      const s = { rx: 0, ry: 0, vx: 0, vy: 0, lift: 0, vl: 0, shx: 50, shy: 50 };
      const tgt = { rx: 0, ry: 0, lift: 0, shx: 50, shy: 50 };
      let raf = null;
      let engaged = false;

      function engage() {
        if (engaged) return;
        engaged = true;
        el.style.transitionProperty = 'opacity, color, background-color, border-color, box-shadow';
        el.classList.add('is-tilting');
      }

      function release() {
        engaged = false;
        el.style.transform = '';
        el.style.transitionProperty = '';
        el.classList.remove('is-tilting');
      }

      function tick() {
        s.vx += (tgt.rx - s.rx) * K; s.vx *= 1 - D; s.rx += s.vx;
        s.vy += (tgt.ry - s.ry) * K; s.vy *= 1 - D; s.ry += s.vy;
        s.vl += (tgt.lift - s.lift) * K; s.vl *= 1 - D; s.lift += s.vl;
        s.shx = lerp(s.shx, tgt.shx, 0.18);
        s.shy = lerp(s.shy, tgt.shy, 0.18);

        el.style.transform =
          `perspective(1000px) rotateX(${s.rx.toFixed(3)}deg) rotateY(${s.ry.toFixed(3)}deg) translateZ(${s.lift.toFixed(2)}px)`;
        el.style.setProperty('--sheen-x', `${s.shx.toFixed(1)}%`);
        el.style.setProperty('--sheen-y', `${s.shy.toFixed(1)}%`);

        const settled =
          Math.abs(tgt.rx - s.rx) < 0.01 && Math.abs(tgt.ry - s.ry) < 0.01 &&
          Math.abs(s.vx) < 0.005 && Math.abs(s.vy) < 0.005 &&
          Math.abs(tgt.lift - s.lift) < 0.02 && Math.abs(s.vl) < 0.01;

        if (settled) {
          if (tgt.rx === 0 && tgt.ry === 0 && tgt.lift === 0) {
            s.rx = s.ry = s.vx = s.vy = s.lift = s.vl = 0;
            release();
          }
          raf = null; // idle until the pointer moves again
          return;
        }
        raf = requestAnimationFrame(tick);
      }

      function kick() {
        if (!raf) raf = requestAnimationFrame(tick);
      }

      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        engage();
        tgt.lift = 6;
        el.style.setProperty('--sheen-o', '1');
        kick();
      });

      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        engage();
        const r = el.getBoundingClientRect();
        const px = clamp((e.clientX - r.left) / r.width, 0, 1);
        const py = clamp((e.clientY - r.top) / r.height, 0, 1);
        tgt.rx = -(py - 0.5) * maxDeg * 2;
        tgt.ry = (px - 0.5) * maxDeg * 2;
        tgt.lift = 6;
        tgt.shx = px * 100;
        tgt.shy = py * 100;
        el.style.setProperty('--sheen-o', '1');
        kick();
      });

      el.addEventListener('pointerleave', () => {
        tgt.rx = 0;
        tgt.ry = 0;
        tgt.lift = 0;
        el.style.setProperty('--sheen-o', '0');
        kick();
      });
    });
  }
  bindSpatialTilt();

  /* ==========================================================================
     10. HERO 3D — MODULAR CONTINUOUS SPACE-TO-COMPUTE JOURNEY (js/journey/*)
         Single unified 11-stage Three.js WebGL cinema experience + 2D fallback.
     ========================================================================== */
  if (window.SpaceComputeJourney && typeof window.SpaceComputeJourney.init === 'function') {
    window.SpaceComputeJourney.init({
      loadThree,
      createLoop,
      bindVisibility,
      capDPR,
      freshCanvas,
      webglSupported,
      dynImport,
      prefersReducedMotion,
      isFinePointer
    });
  }

  /* ==========================================================================
     11. SECTION 06: TOPOGRAPHIC TERRAIN (OFF-WHITE #EAE8E1)
         11a. Enhanced Canvas 2D fallback (organic curves + damped scroll pitch)
     ========================================================================== */
  function initTopo2DFallback(canvas, wrap, section) {
    if (!canvas || !wrap || !section) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    wrap.classList.add('is-ready');

    let width = 0, height = 0;
    let dpr = capDPR(2);
    let targetScroll = 0.5;
    let smoothScroll = 0.5;

    function updateTopoScroll() {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      targetScroll = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
    }
    window.addEventListener('scroll', updateTopoScroll, { passive: true });
    updateTopoScroll();
    smoothScroll = targetScroll;

    // Smooth organic multi-octave ridge heightfield
    function sampleHeight(u, v, t) {
      const w1 = Math.sin(u * 4.4 + v * 2.6 + t * 0.85) * 46;
      const w2 = Math.cos(u * 8.6 - v * 4.2 - t * 0.55) * 23;
      const w3 = Math.sin((u * 3.1 - v * 5.2) + Math.cos(u * 2.4 + t * 0.4) * 1.4) * 26;
      const ridge = (1 - Math.abs(Math.sin(u * 2.9 + v * 3.5 + t * 0.35))) * 34;
      return (w1 + w2 + w3 + ridge) * (0.42 + v * 0.68);
    }

    function resize() {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(300, rect.width);
      height = Math.max(400, rect.height);
      dpr = capDPR(2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTopo(0, 16.7);
    }

    function drawTopo(time, dt) {
      ctx.clearRect(0, 0, width, height);
      const damp = 1 - Math.exp(-dt * 0.006);
      smoothScroll += (targetScroll - smoothScroll) * damp;

      const isSmall = width < 768;
      const rows = isSmall ? 16 : 24;
      const cols = isSmall ? 24 : 38;
      const t = prefersReducedMotion ? 0.6 : time * 0.00032;
      const pitch = 0.58 + (smoothScroll - 0.5) * 0.42;
      const focal = 580;
      const cx = width * 0.5;
      const cy = height * (0.64 - (smoothScroll - 0.5) * 0.08);
      const spanX = width * 1.44;
      const spanZ = 1040;

      const grid = [];
      for (let r = 0; r < rows; r++) {
        const rowPts = [];
        const rzNorm = r / (rows - 1);
        const z = 120 + rzNorm * spanZ;
        for (let c = 0; c < cols; c++) {
          const cxNorm = c / (cols - 1) - 0.5;
          const x = cxNorm * spanX;
          const elev = sampleHeight(cxNorm, rzNorm, t);
          const y = 148 - elev;

          const ry = y * Math.cos(pitch) - z * Math.sin(pitch) * 0.19;
          const rz = z + y * Math.sin(pitch) * 0.16;
          const sc = focal / Math.max(120, focal + rz);

          rowPts.push({
            sx: cx + x * sc,
            sy: cy + ry * sc,
            elev
          });
        }
        grid.push(rowPts);
      }

      // Organic smoothed contour curves via quadratic midpoints
      for (let r = 0; r < rows; r++) {
        const isIndex = r % 4 === 0;
        const depthFade = 1 - r / rows;
        const alpha = (isIndex ? 0.065 : 0.035) + depthFade * (isIndex ? 0.11 : 0.075);
        ctx.strokeStyle = `rgba(16, 18, 16, ${alpha.toFixed(3)})`;
        ctx.lineWidth = isIndex ? 1.25 : 0.85;
        ctx.beginPath();
        const row = grid[r];
        ctx.moveTo(row[0].sx, row[0].sy);
        for (let c = 1; c < cols - 1; c++) {
          const mx = (row[c].sx + row[c + 1].sx) * 0.5;
          const my = (row[c].sy + row[c + 1].sy) * 0.5;
          ctx.quadraticCurveTo(row[c].sx, row[c].sy, mx, my);
        }
        ctx.lineTo(row[cols - 1].sx, row[cols - 1].sy);
        ctx.stroke();
      }

      // Subtle longitudinal meridian gridlines
      ctx.lineWidth = 0.75;
      for (let c = 0; c < cols; c += 3) {
        ctx.strokeStyle = 'rgba(16, 18, 16, 0.042)';
        ctx.beginPath();
        ctx.moveTo(grid[0][c].sx, grid[0][c].sy);
        for (let r = 1; r < rows - 1; r++) {
          const mx = (grid[r][c].sx + grid[r + 1][c].sx) * 0.5;
          const my = (grid[r][c].sy + grid[r + 1][c].sy) * 0.5;
          ctx.quadraticCurveTo(grid[r][c].sx, grid[r][c].sy, mx, my);
        }
        ctx.lineTo(grid[rows - 1][c].sx, grid[rows - 1][c].sy);
        ctx.stroke();
      }
    }

    const loop = createLoop((dt, t) => drawTopo(t, dt));
    if (prefersReducedMotion) {
      drawTopo(0, 16.7);
    } else {
      bindVisibility(section, (visible) => {
        if (visible) {
          updateTopoScroll();
          loop.start();
        } else {
          loop.stop();
        }
      }, '60px');
    }

    new ResizeObserver(resize).observe(wrap);
    resize();
  }

  /* ==========================================================================
     11b. SECTION 06 — THREE.JS WEBGL ORGANIC TOPOGRAPHIC RELIEF TERRAIN
          Simplex/FBM ridged heightfield, screen-space antialiased organic
          contour lines (curvas de nível) + delicate wireframe mesh over #EAE8E1,
          real-time gentle elevation undulation, scroll-coupled camera tilt.
     ========================================================================== */
  const TOPO_VS = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElev;
    varying float vDepth;

    // 2D Simplex Noise (Ashima Arts)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float fbmTerrain(vec2 p, float t) {
      // Gentle domain warp for organic Serra do Espinhaço contours
      vec2 warp = vec2(
        snoise(p * 0.48 + vec2(t * 0.16, -t * 0.11)),
        snoise(p * 0.48 + vec2(-t * 0.12 + 4.2, t * 0.14 + 1.7))
      );
      vec2 q = p + warp * 0.42;

      float h = 0.0;
      float amp = 0.55;
      float freq = 1.0;
      for (int i = 0; i < 4; i++) {
        float n = snoise(q * freq + vec2(t * 0.08 * float(i + 1), -t * 0.05));
        float ridged = 1.0 - abs(n);
        h += mix(n * 0.5 + 0.5, ridged * ridged, 0.46) * amp;
        freq *= 2.04;
        amp *= 0.48;
      }
      return h;
    }

    void main() {
      vUv = uv;
      vec3 pos = position;
      vec2 p = pos.xz * 0.165;
      float elev = fbmTerrain(p, uTime);
      // Taper ridges smoothly near outer edges
      float edgeMask = smoothstep(0.0, 0.16, uv.x) * smoothstep(1.0, 0.84, uv.x)
                     * smoothstep(0.0, 0.14, uv.y) * smoothstep(1.0, 0.82, uv.y);
      pos.y += (elev - 0.52) * 3.15 * (0.35 + 0.65 * edgeMask);
      vElev = pos.y;
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `;

  const TOPO_FS = `
    uniform vec3 uInk;
    uniform vec3 uPaper;
    uniform vec2 uGridFreq;
    varying vec2 vUv;
    varying float vElev;
    varying float vDepth;

    float aaLine(float coord, float widthPx) {
      float f = abs(fract(coord - 0.5) - 0.5);
      float df = max(fwidth(coord), 1e-4);
      return 1.0 - smoothstep(0.0, df * widthPx, f);
    }

    void main() {
      // Organic elevation contour lines (fine + every 4th index contour)
      float minorContour = aaLine(vElev * 3.8, 1.05);
      float majorContour = aaLine(vElev * 0.95, 1.55);

      // Architectural topographic wireframe grid
      float gx = aaLine(vUv.x * uGridFreq.x, 0.9);
      float gy = aaLine(vUv.y * uGridFreq.y, 0.9);
      float wire = max(gx, gy);

      // Subtle atmospheric distance fade + soft archival margin vignette
      float depthFade = 1.0 - smoothstep(8.0, 26.0, vDepth);
      float edgeFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x)
                     * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);

      // Combine ink layers delicately over #EAE8E1
      float alpha = (wire * 0.068 + minorContour * 0.105 + majorContour * 0.175) * depthFade * edgeFade;
      // Subtle relief tint on higher ridges (still understated editorial ink)
      float ridgeTint = smoothstep(-0.2, 1.6, vElev) * 0.025 * depthFade * edgeFade;
      float finalAlpha = clamp(alpha + ridgeTint, 0.0, 0.34);

      if (finalAlpha < 0.004) discard;
      gl_FragColor = vec4(uInk, finalAlpha);
    }
  `;

  function initTopoWebGL(THREE, canvas, wrap, section) {
    const small = wrap.clientWidth < 768 || !isFinePointer;
    const lite = small || isLowSpec;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isLowSpec,
      alpha: true,
      powerPreference: isLowSpec ? 'default' : 'high-performance'
    });
    renderer.setClearColor(0xEAE8E1, 0);
    renderer.setPixelRatio(capDPR(isLowSpec ? 1.25 : small ? 1.5 : 1.75));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

    const segX = lite ? 48 : 88;
    const segZ = lite ? 34 : 58;
    const geo = new THREE.PlaneGeometry(24, 18, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const uniforms = {
      uTime: { value: prefersReducedMotion ? 1.2 : 0 },
      uInk: { value: new THREE.Color(0x101210) },
      uPaper: { value: new THREE.Color(0xEAE8E1) },
      uGridFreq: { value: new THREE.Vector2(lite ? 22 : 34, lite ? 16 : 24) }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: TOPO_VS,
      fragmentShader: TOPO_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      extensions: { derivatives: true }
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.position.set(0, -1.55, 0);
    scene.add(terrain);

    let targetScroll = 0.5;
    let smoothScroll = 0.5;
    const ptr = { x: 0, y: 0, sx: 0, sy: 0 };

    function updateScroll() {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      targetScroll = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
    }
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();
    smoothScroll = targetScroll;

    function layout() {
      const w = Math.max(300, wrap.clientWidth);
      const h = Math.max(400, wrap.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function applyCam(sp) {
      // Camera pitch, altitude & gentle lateral arc coupled to section scroll progress
      const pitchT = sp - 0.5;
      const camY = 6.2 - pitchT * 2.4 + ptr.sy * 0.45;
      const camZ = 10.6 + pitchT * 2.2;
      const camX = ptr.sx * 1.1 + pitchT * 0.9;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(ptr.sx * 0.25, -0.55 - pitchT * 0.85, -1.6);
    }

    function renderFrame(dt) {
      const k = 1 - Math.exp(-dt * 0.0055);
      smoothScroll += (targetScroll - smoothScroll) * k;
      ptr.sx += (ptr.x - ptr.sx) * k;
      ptr.sy += (ptr.y - ptr.sy) * k;
      if (!prefersReducedMotion) {
        uniforms.uTime.value += dt * 0.00028;
      }
      applyCam(smoothScroll);
      renderer.render(scene, camera);
    }

    if (isFinePointer && !prefersReducedMotion) {
      section.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = section.getBoundingClientRect();
        ptr.x = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
        ptr.y = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
      }, { passive: true });
      section.addEventListener('pointerleave', () => { ptr.x = 0; ptr.y = 0; });
    }

    layout();
    let topoAcc = 0;
    const topoStepMs = isLowSpec ? 32 : 0;
    const loop = createLoop((dt) => {
      if (topoStepMs) {
        topoAcc += dt;
        if (topoAcc < topoStepMs) return;
        const step = topoAcc;
        topoAcc = 0;
        renderFrame(step);
        return;
      }
      renderFrame(dt);
    });

    if (prefersReducedMotion) {
      applyCam(0.5);
      renderer.render(scene, camera);
    } else {
      bindVisibility(section, (visible) => {
        if (visible) {
          updateScroll();
          loop.start();
        } else {
          loop.stop();
        }
      }, '80px');
    }

    new ResizeObserver(() => {
      layout();
      if (prefersReducedMotion || !loop.running) {
        applyCam(smoothScroll);
        renderer.render(scene, camera);
      }
    }).observe(wrap);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      loop.stop();
    });

    requestAnimationFrame(() => wrap.classList.add('is-ready', 'is-webgl'));
  }

  /* ==========================================================================
     11c. TOPO DISPATCHER — WebGL first, Canvas 2D fallback
     ========================================================================== */
  (function initTopo3DCanvas() {
    const canvas = document.getElementById('topo-3d-canvas');
    const wrap = document.getElementById('topo-3d-wrap');
    const section = document.getElementById('outside');
    if (!canvas || !wrap || !section) return;

    let bootStarted = false;
    function bootTopo() {
      if (bootStarted) return;
      bootStarted = true;
      let settled = false;
      const fallback = (cv) => {
        if (settled) return;
        settled = true;
        initTopo2DFallback(cv || canvas, wrap, section);
      };
      if (!webglSupported || !dynImport) { fallback(); return; }

      const timeout = setTimeout(() => fallback(), 8000);
      loadThree()
        .then((THREE) => {
          if (settled) return;
          clearTimeout(timeout);
          settled = true;
          try {
            initTopoWebGL(THREE, canvas, wrap, section);
          } catch (err) {
            console.warn('[topo] WebGL init failed — Canvas 2D fallback.', err);
            settled = false;
            fallback(freshCanvas(canvas));
          }
        })
        .catch(() => {
          clearTimeout(timeout);
          fallback();
        });
    }

    // Lazy-init WebGL context only when user scrolls near section 06 (saves startup GPU/CPU on weak laptops & mobile)
    if ('IntersectionObserver' in window) {
      const bootIO = new IntersectionObserver((entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        bootTopo();
      }, { rootMargin: '450px 0px' });
      bootIO.observe(section);
    } else {
      bootTopo();
    }
  })();

  /* ==========================================================================
     12. HIGH-RESOLUTION HARDWARE SPECIMEN PHOTO STAGE (CLEAN STUDIO VIEW)
     ========================================================================== */
  function swapSpecimenImage(stageEl, imgEl, newSrc, newAlt) {
    if (!imgEl || !stageEl) return;
    if (stageEl._swapTimer) {
      clearTimeout(stageEl._swapTimer);
      stageEl._swapTimer = null;
    }
    const seq = (stageEl._swapSeq = (stageEl._swapSeq || 0) + 1);
    if (prefersReducedMotion || imgEl.getAttribute('src') === newSrc) {
      imgEl.src = newSrc;
      imgEl.alt = newAlt;
      imgEl.classList.remove('is-swapping');
      return;
    }

    imgEl.classList.add('is-swapping');
    stageEl._swapTimer = setTimeout(() => {
      if (stageEl._swapSeq !== seq) return;
      stageEl._swapTimer = null;
      imgEl.src = newSrc;
      imgEl.alt = newAlt;
      requestAnimationFrame(() => {
        if (stageEl._swapSeq !== seq) return;
        imgEl.classList.remove('is-swapping');
      });
    }, 150);
  }

  /* ==========================================================================
     12b. INTERACTIVE ACADEMIC RECORD (UFOP & IFMG EXPANDABLE MODULES)
     ========================================================================== */
  (function initAcademicRecord() {
    const root = document.getElementById('academic-record');
    if (!root) return;
    const cards = Array.from(root.querySelectorAll('[data-acad-card]'));

    function setCardState(card, expanded) {
      card.setAttribute('data-expanded', String(expanded));
      const btn = card.querySelector('[data-acad-toggle]');
      const lbl = card.querySelector('.acad-toggle-label');
      if (btn) btn.setAttribute('aria-expanded', String(expanded));
      if (lbl) lbl.textContent = expanded ? 'Recolher −' : 'Detalhes +';
    }

    cards.forEach((card) => {
      const btn = card.querySelector('[data-acad-toggle]');
      if (btn) {
        btn.addEventListener('click', () => {
          const next = card.getAttribute('data-expanded') !== 'true';
          setCardState(card, next);
        });
      }
    });

    // Acende os blocos do progresso curricular (4 concluídos + 5º em curso) ao entrar na viewport
    const semWrap = root.querySelector('.acad-semesters');
    if (semWrap) {
      if (prefersReducedMotion) {
        semWrap.classList.add('is-lit');
      } else {
        const io = new IntersectionObserver((entries, obs) => {
          if (!entries[0].isIntersecting) return;
          semWrap.classList.add('is-lit');
          obs.disconnect();
        }, { threshold: 0.25 });
        io.observe(semWrap);
      }
    }
  })();

  /* ==========================================================================
     13. GRADE DE PROJETOS (2x2 SEM CARROSSEL) + MODAL DE DOSSIÊ
     ========================================================================== */
  const projectsGrid = document.getElementById('projects-grid');
  const modalEl = document.getElementById('case-modal');
  const modalBody = document.getElementById('modal-scroll-body');
  const modalIdxEl = document.getElementById('modal-project-index');
  const modalCatEl = document.getElementById('modal-project-category');
  const modalPrevBtn = document.getElementById('modal-prev-btn');
  const modalNextBtn = document.getElementById('modal-next-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let currentProjectIndex = 0;
  let lastFocusedEl = null;

  const CASE_THEMES = {
    bigbag: {
      accent: '#38BDF8',
      border: 'rgba(56, 189, 248, 0.45)',
      glow: 'rgba(56, 189, 248, 0.20)',
      badgeBg: 'rgba(56, 189, 248, 0.10)'
    },
    fretefy: {
      accent: '#F59E0B',
      border: 'rgba(245, 158, 11, 0.45)',
      glow: 'rgba(245, 158, 11, 0.20)',
      badgeBg: 'rgba(245, 158, 11, 0.10)'
    },
    agrobit: {
      accent: '#34D399',
      border: 'rgba(52, 211, 153, 0.45)',
      glow: 'rgba(52, 211, 153, 0.20)',
      badgeBg: 'rgba(52, 211, 153, 0.10)'
    },
    iris: {
      accent: '#C6F135',
      border: 'rgba(198, 241, 53, 0.45)',
      glow: 'rgba(198, 241, 53, 0.20)',
      badgeBg: 'rgba(198, 241, 53, 0.09)'
    }
  };

  function getMobileThumb(project) {
    if (project.id === 'iris') {
      return `
        <div class="w-16 h-16 rounded-xl border border-limeTech/35 bg-[#EEEDE7] flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
          <img src="assets/bit-2.jpg?v=20261124a" alt="" loading="lazy" decoding="async" class="w-full h-full object-contain mix-blend-multiply select-none" />
        </div>`;
    }
    if (project.id === 'bigbag') {
      return `
        <div class="w-16 h-16 rounded-xl border border-[#38BDF8]/35 bg-[#07090B] shrink-0 overflow-hidden">
          <img src="assets/bigbag-app.png?v=20261124b" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover object-left-top" />
        </div>`;
    }
    if (project.id === 'fretefy') {
      return `
        <div class="w-16 h-16 rounded-xl border border-[#F59E0B]/40 bg-[#0B0907] shrink-0 overflow-hidden">
          <img src="assets/fretefy-panel.png?v=20261124b" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover object-top" />
        </div>`;
    }
    return `
      <div class="w-16 h-16 rounded-xl border border-[#34D399]/35 bg-carbon shrink-0 overflow-hidden">
        <img src="assets/agrobit-team.jpg" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover object-[50%_20%]" />
      </div>`;
  }

  const MOBILE_CASE_META = {
    iris: { title: 'Projeto Íris · Bitmind', meta: '2023 · Bit I → Bit II · IFMG / RIW', pill: 'Bit I → Bit II' },
    bigbag: { title: 'Triagem de Big Bags', meta: '2026 · Firebase, R2 & Gemini API', pill: '6 Camadas · Nuvem' },
    fretefy: { title: 'Automação Fretefy', meta: '2026 · 8 KPIs · TPV < 5 min', pill: 'Power Query · 8 KPIs' },
    agrobit: { title: 'AGROBIT · Bitmindop', meta: '2026 · OSM, NASA, Embrapa & ESP32', pill: 'Geo · IA · ESP32' }
  };

  if (projectsGrid) {
    projectsGrid.innerHTML = PROJECTS
      .map((p, realIdx) => {
        const th = CASE_THEMES[p.id] || {
          accent: '#C6F135',
          border: 'rgba(198, 241, 53, 0.45)',
          glow: 'rgba(198, 241, 53, 0.2)',
          badgeBg: 'rgba(198, 241, 53, 0.1)'
        };
        const mInfo = MOBILE_CASE_META[p.id] || { title: p.name, meta: p.period };
        return `
        <article
          class="project-card mission-case-card reveal rounded-xl p-3 min-h-[82px] flex flex-col justify-center cursor-pointer"
          style="--reveal-delay: ${realIdx * 55}ms; --case-accent: ${th.accent}; --case-accent-border: ${th.border}; --case-accent-glow: ${th.glow};"
          data-open-project="${realIdx}"
          tabindex="0"
          role="button"
          aria-label="Abrir dossiê ${p.name}"
        >
          <div class="flex items-center gap-3">
            ${getMobileThumb(p)}
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider">
                <span class="px-1.5 py-0.5 rounded font-semibold text-[#050606] leading-none shrink-0" style="background:${th.accent};">${p.index}</span>
                <span class="font-medium truncate" style="color:${th.accent};">${p.shortTag}</span>
              </div>
              <h3 class="font-display text-[15.5px] font-bold text-ink leading-tight truncate">${mInfo.title}</h3>
              <p class="font-mono text-[10.5px] text-ink/70 truncate">${mInfo.meta}</p>
            </div>
            <span class="w-9 h-9 rounded-lg bg-carbon border hairline-dark flex items-center justify-center shrink-0 font-mono text-xs font-semibold" style="color:${th.accent};" aria-hidden="true">↗</span>
          </div>
        </article>`;
      })
      .join('');

    observeReveals(projectsGrid);
  }

  /* Console Interativo de Cases (Desktop/Tablet >= 768px — sem rotação, com micro-labs vivos) */
  (function initDesktopCaseDeck() {
    const tabsWrap = document.getElementById('case-deck-tabs');
    const stageWrap = document.getElementById('case-deck-stage');
    if (!tabsWrap || !stageWrap) return;

    let activeIdx = 0;

    const BIGBAG_NODES = [
      { code: '01', name: 'Sistema Web', tag: 'HTML · CSS · JS', detail: 'Interface de chão de fábrica para registro diário de triagem, estoque, backlog e chegadas.', io: 'Operação → Registro estruturado' },
      { code: '02', name: 'Firebase', tag: 'Banco em Nuvem', detail: 'Sincronização em tempo real dos lotes triados, substituindo controles fragmentados.', io: 'Formulário → Base central' },
      { code: '03', name: 'Cloudflare R2', tag: 'Storage', detail: 'Armazenamento de evidências e anexos operacionais integrados diretamente aos registros.', io: 'Evidências → Armazenamento seguro' },
      { code: '04', name: 'Gemini API', tag: 'IA Aplicada', detail: 'Síntese automática dos dados de triagem em texto executivo pronto para leitura rápida.', io: 'Dados brutos → Resumo semanal' },
      { code: '05', name: 'Power Automate', tag: 'Automação', detail: 'Orquestração do disparo recorrente sem dependência de montagem manual de relatórios.', io: 'Gatilho → Fluxo automático' },
      { code: '06', name: 'Envio Semanal', tag: 'Visibilidade', detail: 'Distribuição semanal de estoque, backlog e chegadas para os interessados da empresa.', io: 'Indicadores → Equipe alinhada' }
    ];

    const FRETEFY_NODES = [
      { code: '01', name: 'Extração Fretefy', tag: 'Base Bruta', detail: 'Exportação das movimentações de carregamento e pátio diretamente do Fretefy sem retrabalho na origem.', io: 'Fretefy → Base bruta' },
      { code: '02', name: 'Power Query ETL', tag: 'Tratamento', detail: 'Pipeline reutilizável com limpeza, padronização de datas/horários e cálculo automático de intervalos operacionais.', io: 'Base bruta → Dados tratados' },
      { code: '03', name: 'Modelo & 8 KPIs', tag: 'Tabelas Dinâmicas', detail: 'Fechamento do TPV mensal em menos de 5 minutos e estruturação de 8 KPIs por turno, dia da semana, doca e frota.', io: 'Dados tratados → TPV & 8 KPIs' },
      { code: '04', name: 'Painel Operacional', tag: 'BI Logístico', detail: 'Visão analítica consolidada substituindo acompanhamento empírico por leitura objetiva de gargalos e capacidade.', io: 'Indicadores → Visibilidade em área' }
    ];

    const AGROBIT_SOURCES = [
      { code: '01', name: 'OpenStreetMap', tag: 'Geoespacial', detail: 'Delimitação interativa da propriedade no mapa com extração automática de latitude e longitude.' },
      { code: '02', name: 'NASA POWER', tag: 'Clima & Radiação', detail: 'Séries meteorológicas históricas e recentes integradas ao fluxo de análise da plataforma.' },
      { code: '03', name: 'Embrapa', tag: 'Base Agronômica', detail: 'Parâmetros agrícolas regionais contextualizando a leitura de solo e produtividade.' },
      { code: '04', name: 'Gemini + ESP32', tag: 'IA & Conceito IoT', detail: 'Síntese inteligente das fontes somada ao conceito de sensor de solo local com ESP32/Arduino.' }
    ];

    function renderTabs() {
      tabsWrap.innerHTML = PROJECTS.map((p, idx) => {
        const th = CASE_THEMES[p.id] || { accent: '#C6F135', border: 'rgba(198,241,53,0.45)', glow: 'rgba(198,241,53,0.2)' };
        const mInfo = MOBILE_CASE_META[p.id] || { title: p.name, pill: p.period };
        const isSel = idx === activeIdx;
        const year = (p.period || '').split(' · ')[0];
        return `
          <button
            type="button"
            role="tab"
            id="case-tab-${idx}"
            aria-selected="${isSel}"
            aria-controls="case-deck-stage"
            data-deck-idx="${idx}"
            class="case-deck-tab text-left rounded-2xl p-4 flex flex-col justify-between gap-2.5 cursor-pointer"
            style="--case-accent:${th.accent}; --case-accent-border:${th.border}; --case-accent-glow:${th.glow};"
          >
            <div class="flex items-center justify-between gap-2 font-mono text-[10px]">
              <div class="flex items-center gap-2 min-w-0">
                <span class="px-1.5 py-0.5 rounded font-semibold text-[#050606] leading-none shrink-0" style="background:${th.accent};">${p.index}</span>
                <span class="uppercase tracking-wider truncate" style="color:${th.accent};">${p.shortTag}</span>
              </div>
              <span class="inline-flex items-center gap-1.5 text-muted shrink-0">
                <span>${year}</span>
                <span class="w-1.5 h-1.5 rounded-full transition-opacity ${isSel ? 'opacity-100 acad-node-pulse' : 'opacity-20'}" style="background:${th.accent};"></span>
              </span>
            </div>
            <div class="space-y-0.5">
              <div class="font-display text-[15px] lg:text-base font-bold text-ink leading-snug truncate">${mInfo.title}</div>
              <div class="font-mono text-[10px] text-ink/65 truncate">${mInfo.pill}</div>
            </div>
          </button>`;
      }).join('');

      tabsWrap.querySelectorAll('[data-deck-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.getAttribute('data-deck-idx'));
          if (next === activeIdx) return;
          activeIdx = next;
          renderTabs();
          renderStage(true);
        });
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            activeIdx = (activeIdx + 1) % PROJECTS.length;
            renderTabs();
            renderStage(true);
            document.getElementById(`case-tab-${activeIdx}`)?.focus();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            activeIdx = (activeIdx - 1 + PROJECTS.length) % PROJECTS.length;
            renderTabs();
            renderStage(true);
            document.getElementById(`case-tab-${activeIdx}`)?.focus();
          }
        });
      });
    }

    function buildInteractiveLabHTML(p) {
      if (p.id === 'iris') {
        return `
          <div class="h-full flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
              <span class="text-limeTech flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-limeTech acad-node-pulse"></span>LABORATÓRIO HARDWARE · BIT I ↔ BIT II</span>
              <span id="deck-iris-spec-tag" class="text-muted">PORTÁTIL · 2 BATERIAS</span>
            </div>
            <div id="deck-iris-stage" data-current-bit="bit2" class="specimen-stage relative rounded-2xl border border-limeTech/35 flex-1 min-h-[330px] w-full flex items-center justify-center p-3 pb-12">
              <div class="spec-grid-overlay absolute inset-0"></div>
              <span class="pointer-events-none absolute top-2.5 left-2.5 w-3 h-3 reticle-tl"></span>
              <span class="pointer-events-none absolute top-2.5 right-2.5 w-3 h-3 reticle-tr"></span>
              <span class="pointer-events-none absolute bottom-2.5 left-2.5 w-3 h-3 reticle-bl"></span>
              <span class="pointer-events-none absolute bottom-2.5 right-2.5 w-3 h-3 reticle-br"></span>
              <div class="w-full h-full flex items-center justify-center">
                <img id="deck-iris-img" src="assets/bit-2.jpg?v=20261124a" alt="Protótipo Bit II do Projeto Íris" loading="lazy" decoding="async" class="specimen-img max-h-[320px] max-w-[92%] object-contain select-none" />
              </div>
              <div class="absolute bottom-2.5 left-3 z-20 inline-flex p-0.5 rounded-lg bg-carbon/95 border hairline-dark font-mono text-[10px]">
                <button type="button" data-deck-bit="bit1" class="px-2.5 py-1 rounded-md text-muted hover:text-ink transition-colors">Bit I · REV.01</button>
                <button type="button" data-deck-bit="bit2" class="px-2.5 py-1 rounded-md bg-limeTech text-inkDark font-semibold transition-colors">Bit II · REV.02</button>
              </div>
            </div>
            <div id="deck-iris-caption" class="px-3.5 py-2.5 rounded-xl bg-carbon border hairline-dark font-mono text-[10.5px] text-ink/85 flex items-center justify-between gap-2">
              <span>REV.02 · Autônomo com 2 baterias, carregamento embarcado e cabos reforçados</span>
              <span class="text-limeTech shrink-0">RIW 2023</span>
            </div>
          </div>`;
      }

      if (p.id === 'bigbag') {
        const first = BIGBAG_NODES[0];
        return `
          <div class="h-full flex flex-col justify-between gap-3.5 rounded-2xl bg-[#070A0D] border border-[#38BDF8]/30 p-4 lg:p-5">
            <div class="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
              <span class="text-[#38BDF8] flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#38BDF8] acad-node-pulse"></span>ECOSSISTEMA WEB · BIG BAGS</span>
              <div class="inline-flex p-0.5 rounded-lg bg-carbon border hairline-dark text-[9.5px]">
                <button type="button" data-deck-bb-view="ui" class="px-2.5 py-1 rounded bg-[#38BDF8] text-[#050606] font-semibold transition-colors">Interface</button>
                <button type="button" data-deck-bb-view="arch" class="px-2.5 py-1 rounded text-muted hover:text-ink transition-colors">Arquitetura (06)</button>
              </div>
            </div>

            <!-- Visão 1: Interface estilizada fiel ao sistema real -->
            <div id="deck-bb-panel-ui" class="flex-1 flex flex-col justify-between gap-3">
              <div class="relative rounded-xl overflow-hidden border border-[#38BDF8]/30 bg-[#070A0D] flex-1 min-h-[290px] flex items-center justify-center p-1.5 group/bb">
                <img src="assets/bigbag-app.png?v=20261124b" alt="Interface executiva do sistema de Triagem de Big Bags" loading="lazy" decoding="async" class="w-full h-full max-h-[345px] object-contain rounded-lg group-hover/bb:scale-[1.015] transition-transform duration-500" />
              </div>
              <div class="px-3.5 py-2.5 rounded-xl bg-carbon border hairline-dark font-mono text-[10px] text-ink/80 flex items-center justify-between gap-2">
                <span>Visão Executiva em tempo real · triagem, estoque e backlog</span>
                <span class="text-[#38BDF8] shrink-0">FIREBASE · R2 · IA</span>
              </div>
            </div>

            <!-- Visão 2: Arquitetura interativa de 6 camadas -->
            <div id="deck-bb-panel-arch" class="hidden flex-1 flex-col justify-between gap-3">
              <div class="relative h-[2px] w-full rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                <div class="mission-pipe-beam h-full w-1/2 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent"></div>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                ${BIGBAG_NODES.map((n, i) => `
                  <button type="button" data-deck-bb="${i}" data-active="${i === 0}" style="--node-accent:#38BDF8;" class="stage-node-btn text-left p-3 rounded-xl bg-[#0D1116] border border-white/10 space-y-1 cursor-pointer">
                    <div class="flex items-center justify-between font-mono text-[9.5px]">
                      <span class="text-[#38BDF8] font-semibold">${n.code}</span>
                      <span class="text-muted truncate">${n.tag}</span>
                    </div>
                    <div class="font-display text-xs font-bold text-ink leading-tight">${n.name}</div>
                  </button>`).join('')}
              </div>
              <div id="deck-bb-readout" class="p-3.5 rounded-xl bg-carbon border border-[#38BDF8]/30 space-y-1.5">
                <div class="flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span class="text-[#38BDF8] font-semibold">CAMADA ${first.code} // ${first.name.toUpperCase()}</span>
                  <span class="text-muted truncate">${first.io}</span>
                </div>
                <p class="text-xs text-ink/85 leading-relaxed">${first.detail}</p>
              </div>
            </div>
          </div>`;
      }

      if (p.id === 'fretefy') {
        const firstFr = FRETEFY_NODES[0];
        return `
          <div class="h-full flex flex-col justify-between gap-3.5 rounded-2xl bg-[#0B0907] border border-[#F59E0B]/30 p-4 lg:p-5">
            <div class="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
              <span class="text-[#F59E0B] flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#F59E0B] acad-node-pulse"></span>AUTOMAÇÃO ETL · FRETEFY</span>
              <div class="inline-flex p-0.5 rounded-lg bg-carbon border hairline-dark text-[9.5px]">
                <button type="button" data-deck-fr-view="ui" class="px-2.5 py-1 rounded bg-[#F59E0B] text-inkDark font-semibold transition-colors">Painel BI</button>
                <button type="button" data-deck-fr-view="arch" class="px-2.5 py-1 rounded text-muted hover:text-ink transition-colors">Arquitetura (04)</button>
              </div>
            </div>

            <!-- Visão 1: Painel estilizado fiel ao BI de carregamento -->
            <div id="deck-fr-panel-ui" class="flex-1 flex flex-col justify-between gap-3">
              <div class="relative rounded-xl overflow-hidden border border-[#F59E0B]/30 bg-[#090806] flex-1 min-h-[290px] flex items-center justify-center p-1.5 group/fr">
                <img src="assets/fretefy-panel.png?v=20261124b" alt="Painel operacional de carregamento gerado pelo pipeline ETL em Power Query" loading="lazy" decoding="async" class="w-full h-full max-h-[345px] object-contain rounded-lg group-hover/fr:scale-[1.015] transition-transform duration-500" />
              </div>
              <div class="px-3.5 py-2.5 rounded-xl bg-carbon border hairline-dark font-mono text-[10px] text-ink/80 flex items-center justify-between gap-2">
                <span>Painel de carregamento · 8 KPIs por dia, turno, doca e frota</span>
                <span class="text-limeTech font-semibold shrink-0">TPV &lt; 5 MIN</span>
              </div>
            </div>

            <!-- Visão 2: Arquitetura interativa de 4 etapas (mesmo padrão do case Big Bags) -->
            <div id="deck-fr-panel-arch" class="hidden flex-1 flex-col justify-between gap-3">
              <div class="relative h-[2px] w-full rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                <div class="mission-pipe-beam h-full w-1/2 bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent"></div>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                ${FRETEFY_NODES.map((n, i) => `
                  <button type="button" data-deck-fr="${i}" data-active="${i === 0}" style="--node-accent:#F59E0B;" class="stage-node-btn text-left p-3.5 rounded-xl bg-[#120F0A] border border-white/10 space-y-1.5 cursor-pointer">
                    <div class="flex items-center justify-between font-mono text-[9.5px]">
                      <span class="text-[#F59E0B] font-semibold">${n.code}</span>
                      <span class="text-muted truncate">${n.tag}</span>
                    </div>
                    <div class="font-display text-xs sm:text-[13px] font-bold text-ink leading-tight">${n.name}</div>
                  </button>`).join('')}
              </div>
              <div id="deck-fr-readout" class="p-3.5 rounded-xl bg-carbon border border-[#F59E0B]/30 space-y-1.5">
                <div class="flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span class="text-[#F59E0B] font-semibold">ETAPA ${firstFr.code} // ${firstFr.name.toUpperCase()}</span>
                  <span class="text-muted truncate">${firstFr.io}</span>
                </div>
                <p class="text-xs text-ink/85 leading-relaxed">${firstFr.detail}</p>
              </div>
            </div>
          </div>`;
      }

      const firstSrc = AGROBIT_SOURCES[0];
      return `
        <div class="h-full flex flex-col justify-between gap-3.5 rounded-2xl bg-[#070B09] border border-[#34D399]/30 p-4 lg:p-5">
          <div class="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
            <span class="text-[#34D399] flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#34D399] acad-node-pulse"></span>AGTECH · BITMINDOP</span>
            <div class="inline-flex p-0.5 rounded-lg bg-carbon border hairline-dark text-[9.5px]">
              <button type="button" data-deck-agro-view="ui" class="px-2.5 py-1 rounded bg-[#34D399] text-[#050606] font-semibold transition-colors">Equipe</button>
              <button type="button" data-deck-agro-view="arch" class="px-2.5 py-1 rounded text-muted hover:text-ink transition-colors">Arquitetura (04)</button>
            </div>
          </div>

          <!-- Visão 1: Foto da equipe preenchendo todo o quadro interno + legenda curta -->
          <div id="deck-agro-panel-ui" class="flex-1 flex flex-col justify-between gap-3">
            <div class="relative rounded-xl overflow-hidden border border-[#34D399]/30 bg-carbon flex-1 min-h-[320px] group/agro">
              <img src="assets/agrobit-team.jpg" alt="Equipe Bitmindop apresentando a plataforma AGROBIT" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-[50%_20%] contrast-[1.04] saturate-[1.08] group-hover/agro:scale-[1.02] transition-transform duration-500" />
            </div>
            <div class="px-3.5 py-2.5 rounded-xl bg-carbon border hairline-dark font-mono text-[10px] text-ink/80 flex items-center justify-between gap-2">
              <span>Plataforma web agrícola · mapa, clima, solo e IA com equipe Bitmindop</span>
              <span class="text-[#34D399] shrink-0">OSM · NASA · ESP32</span>
            </div>
          </div>

          <!-- Visão 2: Arquitetura interativa de 4 integrações (mesmo padrão de Big Bags e Fretefy) -->
          <div id="deck-agro-panel-arch" class="hidden flex-1 flex-col justify-between gap-3">
            <div class="relative h-[2px] w-full rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
              <div class="mission-pipe-beam h-full w-1/2 bg-gradient-to-r from-transparent via-[#34D399] to-transparent"></div>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              ${AGROBIT_SOURCES.map((s, i) => `
                <button type="button" data-deck-agro="${i}" data-active="${i === 0}" style="--node-accent:#34D399;" class="stage-node-btn text-left p-3.5 rounded-xl bg-[#0B120F] border border-white/10 space-y-1.5 cursor-pointer">
                  <div class="flex items-center justify-between font-mono text-[9.5px]">
                    <span class="text-[#34D399] font-semibold">${s.code}</span>
                    <span class="text-muted truncate">${s.tag}</span>
                  </div>
                  <div class="font-display text-xs sm:text-[13px] font-bold text-ink leading-tight">${s.name}</div>
                </button>`).join('')}
            </div>
            <div id="deck-agro-readout" class="p-3.5 rounded-xl bg-carbon border border-[#34D399]/30 space-y-1.5">
              <div class="font-mono text-[10px] text-[#34D399] font-semibold uppercase tracking-wider">FONTE ${firstSrc.code} // ${firstSrc.name.toUpperCase()}</div>
              <p class="text-xs text-ink/85 leading-relaxed">${firstSrc.detail}</p>
            </div>
          </div>
        </div>`;
    }

    function bindLabInteractions(p) {
      if (p.id === 'iris') {
        const st = document.getElementById('deck-iris-stage');
        const img = document.getElementById('deck-iris-img');
        const cap = document.getElementById('deck-iris-caption');
        const tag = document.getElementById('deck-iris-spec-tag');
        const btns = stageWrap.querySelectorAll('[data-deck-bit]');
        btns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-deck-bit');
            const spec = HARDWARE_SPECS[key];
            if (!spec || !st || !img) return;
            st.setAttribute('data-current-bit', key);
            swapSpecimenImage(st, img, spec.src, spec.alt);
            if (tag) tag.textContent = key === 'bit1' ? 'ALIMENTAÇÃO EXTERNA' : 'PORTÁTIL · 2 BATERIAS';
            if (cap) {
              cap.innerHTML = key === 'bit1'
                ? '<span>REV.01 · Processamento dedicado em Arduino Uno + shield em fenolite com alimentação externa</span><span class="text-limeTech shrink-0">IFMG OP</span>'
                : '<span>REV.02 · Autônomo com 2 baterias, carregamento embarcado e cabos reforçados</span><span class="text-limeTech shrink-0">RIW 2023</span>';
            }
            btns.forEach((b) => {
              const on = b.getAttribute('data-deck-bit') === key;
              b.className = on
                ? 'px-2.5 py-1 rounded-md bg-limeTech text-inkDark font-semibold transition-colors'
                : 'px-2.5 py-1 rounded-md text-muted hover:text-ink transition-colors';
            });
          });
        });
      } else if (p.id === 'bigbag') {
        const viewBtns = stageWrap.querySelectorAll('[data-deck-bb-view]');
        const uiPanel = document.getElementById('deck-bb-panel-ui');
        const archPanel = document.getElementById('deck-bb-panel-arch');
        viewBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const v = btn.getAttribute('data-deck-bb-view');
            if (uiPanel) uiPanel.classList.toggle('hidden', v !== 'ui');
            if (archPanel) {
              archPanel.classList.toggle('hidden', v !== 'arch');
              archPanel.classList.toggle('flex', v === 'arch');
            }
            viewBtns.forEach((b) => {
              const on = b === btn;
              b.className = on
                ? 'px-2.5 py-1 rounded bg-[#38BDF8] text-[#050606] font-semibold transition-colors'
                : 'px-2.5 py-1 rounded text-muted hover:text-ink transition-colors';
            });
          });
        });

        const btns = stageWrap.querySelectorAll('[data-deck-bb]');
        const readout = document.getElementById('deck-bb-readout');
        btns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const node = BIGBAG_NODES[Number(btn.getAttribute('data-deck-bb'))];
            if (!node || !readout) return;
            btns.forEach((b) => b.setAttribute('data-active', String(b === btn)));
            readout.innerHTML = `
              <div class="flex items-center justify-between font-mono text-[10px]">
                <span class="text-[#38BDF8] font-semibold">CAMADA ${node.code} // ${node.name.toUpperCase()}</span>
                <span class="text-muted">${node.io}</span>
              </div>
              <p class="text-xs text-ink/85 leading-relaxed">${node.detail}</p>`;
          });
        });
      } else if (p.id === 'fretefy') {
        const viewBtns = stageWrap.querySelectorAll('[data-deck-fr-view]');
        const uiPanel = document.getElementById('deck-fr-panel-ui');
        const archPanel = document.getElementById('deck-fr-panel-arch');
        viewBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const v = btn.getAttribute('data-deck-fr-view');
            if (uiPanel) uiPanel.classList.toggle('hidden', v !== 'ui');
            if (archPanel) {
              archPanel.classList.toggle('hidden', v !== 'arch');
              archPanel.classList.toggle('flex', v === 'arch');
            }
            viewBtns.forEach((b) => {
              const on = b === btn;
              b.className = on
                ? 'px-2.5 py-1 rounded bg-[#F59E0B] text-inkDark font-semibold transition-colors'
                : 'px-2.5 py-1 rounded text-muted hover:text-ink transition-colors';
            });
          });
        });

        const btns = stageWrap.querySelectorAll('[data-deck-fr]');
        const readout = document.getElementById('deck-fr-readout');
        btns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const node = FRETEFY_NODES[Number(btn.getAttribute('data-deck-fr'))];
            if (!node || !readout) return;
            btns.forEach((b) => b.setAttribute('data-active', String(b === btn)));
            readout.innerHTML = `
              <div class="flex items-center justify-between gap-2 font-mono text-[10px]">
                <span class="text-[#F59E0B] font-semibold">ETAPA ${node.code} // ${node.name.toUpperCase()}</span>
                <span class="text-muted truncate">${node.io}</span>
              </div>
              <p class="text-xs text-ink/85 leading-relaxed">${node.detail}</p>`;
          });
        });
      } else if (p.id === 'agrobit') {
        const viewBtns = stageWrap.querySelectorAll('[data-deck-agro-view]');
        const uiPanel = document.getElementById('deck-agro-panel-ui');
        const archPanel = document.getElementById('deck-agro-panel-arch');
        viewBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const v = btn.getAttribute('data-deck-agro-view');
            if (uiPanel) uiPanel.classList.toggle('hidden', v !== 'ui');
            if (archPanel) {
              archPanel.classList.toggle('hidden', v !== 'arch');
              archPanel.classList.toggle('flex', v === 'arch');
            }
            viewBtns.forEach((b) => {
              const on = b === btn;
              b.className = on
                ? 'px-2.5 py-1 rounded bg-[#34D399] text-[#050606] font-semibold transition-colors'
                : 'px-2.5 py-1 rounded text-muted hover:text-ink transition-colors';
            });
          });
        });

        const btns = stageWrap.querySelectorAll('[data-deck-agro]');
        const readout = document.getElementById('deck-agro-readout');
        btns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const src = AGROBIT_SOURCES[Number(btn.getAttribute('data-deck-agro'))];
            if (!src || !readout) return;
            btns.forEach((b) => b.setAttribute('data-active', String(b === btn)));
            readout.innerHTML = `
              <div class="font-mono text-[10px] text-[#34D399] font-semibold uppercase tracking-wider">FONTE ${src.code} // ${src.name.toUpperCase()}</div>
              <p class="text-xs text-ink/85 leading-relaxed">${src.detail}</p>`;
          });
        });
      }
    }

    function renderStage(animate = false) {
      const p = PROJECTS[activeIdx];
      const th = CASE_THEMES[p.id] || { accent: '#C6F135', border: 'rgba(198,241,53,0.45)', glow: 'rgba(198,241,53,0.16)', badgeBg: 'rgba(198,241,53,0.09)' };
      const totalPadded = String(PROJECTS.length).padStart(2, '0');
      stageWrap.style.setProperty('--stage-glow', th.glow);
      stageWrap.style.setProperty('--stage-border', th.border);

      stageWrap.innerHTML = `
        <div class="${animate && !prefersReducedMotion ? 'case-stage-enter ' : ''}grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 p-5 lg:p-7 items-stretch">
          <div class="lg:col-span-7 flex flex-col">
            ${buildInteractiveLabHTML(p)}
          </div>

          <div class="lg:col-span-5 flex flex-col justify-between gap-5">
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-3 font-mono text-[10.5px] uppercase tracking-widest">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="px-2 py-0.5 rounded font-semibold text-[#050606] shrink-0" style="background:${th.accent};">CASE ${p.index} / ${totalPadded}</span>
                  <span class="text-muted truncate">${p.period}</span>
                </div>
                <div class="inline-flex items-center gap-1.5 shrink-0">
                  <button type="button" id="deck-prev-btn" aria-label="Projeto anterior" class="w-9 h-9 rounded-lg bg-carbon border hairline-dark hover:border-limeTech text-ink hover:text-limeTech transition-colors inline-flex items-center justify-center">←</button>
                  <button type="button" id="deck-next-btn" aria-label="Próximo projeto" class="w-9 h-9 rounded-lg bg-carbon border hairline-dark hover:border-limeTech text-ink hover:text-limeTech transition-colors inline-flex items-center justify-center">→</button>
                </div>
              </div>

              <div class="space-y-1.5">
                <h3 class="font-display text-2xl lg:text-[2rem] font-extrabold text-ink tracking-tight leading-[1.06]">${p.name}</h3>
                <p class="text-sm text-ink/80 leading-relaxed">${p.summary}</p>
              </div>

              <!-- Fatos-chave em faixa contínua (sem 3 caixas separadas) -->
              <div class="grid grid-cols-3 divide-x divide-white/10 border-y hairline-dark py-3">
                ${(p.highlights || []).map((h, hi) => `
                  <div class="${hi === 0 ? 'pr-3' : hi === 2 ? 'pl-3' : 'px-3'} space-y-0.5 min-w-0">
                    <div class="font-mono text-[9px] uppercase tracking-wider text-muted truncate">${h.k}</div>
                    <div class="font-sans text-xs font-bold text-ink leading-snug">${h.v}</div>
                  </div>`).join('')}
              </div>

              <!-- Antes (discreto) → Depois / Resultado (destaque editorial) -->
              <div class="space-y-3">
                <div class="pl-3 border-l border-white/15 space-y-0.5">
                  <div class="font-mono text-[9px] uppercase tracking-widest text-muted">ANTES</div>
                  <p class="text-xs text-ink/72 leading-relaxed">${p.before}</p>
                </div>
                <div class="p-3 rounded-r-xl border-l-2 space-y-1" style="background:${th.badgeBg}; border-left-color:${th.accent};">
                  <div class="font-mono text-[9.5px] font-semibold uppercase tracking-widest" style="color:${th.accent};">DEPOIS // ${p.resultLabel.replace(' //', '')}</div>
                  <p class="text-xs text-ink/95 leading-relaxed">${p.after}</p>
                </div>
              </div>
            </div>

            <div class="pt-4 border-t hairline-dark space-y-3.5">
              <div class="flex flex-wrap gap-1.5 font-mono text-[10px] text-ink/80">
                ${p.stack.map((t) => `<span class="px-2 py-0.5 rounded bg-white/[0.05]">${t}</span>`).join('')}
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="font-mono text-[10px] uppercase tracking-wider text-muted">${p.roleShort}</span>
                <button
                  type="button"
                  data-open-project="${activeIdx}"
                  class="min-h-[42px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] font-semibold uppercase tracking-wider text-[#050606] transition-transform hover:-translate-y-0.5 cursor-pointer"
                  style="background:${th.accent};"
                >
                  <span>Abrir dossiê completo</span>
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </div>
        </div>`;

      bindLabInteractions(p);

      document.getElementById('deck-prev-btn')?.addEventListener('click', () => {
        activeIdx = (activeIdx - 1 + PROJECTS.length) % PROJECTS.length;
        renderTabs();
        renderStage(true);
      });
      document.getElementById('deck-next-btn')?.addEventListener('click', () => {
        activeIdx = (activeIdx + 1) % PROJECTS.length;
        renderTabs();
        renderStage(true);
      });
    }

    renderTabs();
    renderStage(false);
  })();

  /* ==========================================================================
     13b. EXPERIÊNCIA INDUSTRIAL — ACTECH (CONSOLE INTERATIVO + MOBILE 1 TELA)
     ========================================================================== */
  (function initActechExperience() {
    const spineEl = document.getElementById('actech-phase-spine');
    const deskStageEl = document.getElementById('actech-desktop-stage');
    const mobTabsEl = document.getElementById('actech-mobile-tabs');
    const mobStageEl = document.getElementById('actech-mobile-stage');
    if (!spineEl && !mobStageEl) return;

    const PHASES = [
      {
        id: 'estagio',
        code: 'FASE 02',
        status: 'ATUAL',
        period: 'FEV/2026 – ATUAL',
        mobLabel: 'Estágio · Atual',
        mobSub: 'Fev/2026–Atual',
        role: 'Estagiário de Embalagem & Expedição',
        area: 'Actech · Processos, Dados & Digitalização',
        accent: '#C6F135',
        border: 'rgba(198, 241, 53, 0.48)',
        glow: 'rgba(198, 241, 53, 0.14)',
        summary: 'Organizo rotinas em campo, automatizo o tratamento de dados logísticos e construo ferramentas web para reduzir conferências manuais e dar visibilidade à expedição.',
        spineDesc: 'Estruturação de 8 KPIs logísticos, app web de Big Bags em nuvem, procedimentos e treinamento em área.',
        spineChips: ['ETL & 8 KPIs', 'Web & Nuvem', 'Procedimentos'],
        frentes: [
          {
            num: '01',
            key: 'DADOS & KPIS',
            title: 'Bases de carregamento & 8 KPIs',
            detail: 'Estruturei bases de carregamento do Fretefy em Power Query, gerando o TPV mensal em menos de 5 minutos e consolidando 8 indicadores operacionais da expedição.',
            short: 'Bases de carregamento e 8 KPIs (TPV < 5 min).',
            tags: ['Excel', 'Power Query', 'ETL', 'TPV']
          },
          {
            num: '02',
            key: 'AUTOMAÇÃO',
            title: 'Fluxos automáticos & envios semanais',
            detail: 'Automatizei planilhas, tratamentos recorrentes e o disparo semanal de estoque, backlog e chegadas aos interessados para cortar trabalho manual repetitivo.',
            short: 'Planilhas automatizadas e envios semanais à equipe.',
            tags: ['Power Automate', 'Apps Script', 'Relatórios']
          },
          {
            num: '03',
            key: 'DIGITALIZAÇÃO',
            title: 'Sistema web de Triagem de Big Bags',
            detail: 'Construí aplicação web em nuvem (HTML/CSS/JS, Firebase, Cloudflare R2 e Gemini API) centralizando apontamentos diários, evidências e rastreabilidade da triagem.',
            short: 'App web em nuvem para a triagem de Big Bags.',
            tags: ['HTML/CSS/JS', 'Firebase', 'Cloudflare R2', 'Gemini API']
          },
          {
            num: '04',
            key: 'PROCESSOS',
            title: 'Rotina em área, padrões & treinamento',
            detail: 'Acompanhei a rotina diretamente em área, redigi procedimentos operacionais claros e apoiei o treinamento da equipe na adoção dos fluxos digitais.',
            short: 'Rotina em área, procedimentos e treinamento.',
            tags: ['Embalagem', 'Padronização', 'Treinamento']
          }
        ],
        projects: [
          {
            id: 'bigbag',
            index: '02',
            title: 'Triagem de Big Bags',
            sub: 'Web · Firebase · R2 · Gemini API',
            accent: '#38BDF8',
            img: 'assets/bigbag-app.png?v=20261124b'
          },
          {
            id: 'fretefy',
            index: '03',
            title: 'Automação Fretefy',
            sub: 'Power Query · TPV < 5 min · 8 KPIs',
            accent: '#F59E0B',
            img: 'assets/fretefy-panel.png?v=20261124b'
          }
        ]
      },
      {
        id: 'aprendiz',
        code: 'FASE 01',
        status: 'CONCLUÍDA',
        period: 'JUN/2024 – DEZ/2025',
        mobLabel: 'Aprendiz · Base',
        mobSub: 'Jun/2024–Dez/2025',
        role: 'Jovem Aprendiz',
        area: 'Actech · Operação & Processos Industriais',
        accent: '#F59E0B',
        border: 'rgba(245, 158, 11, 0.45)',
        glow: 'rgba(245, 158, 11, 0.13)',
        summary: 'Base prática no chão de fábrica: medi tempos em campo com cronoanálises, acompanhei estoque e checklists, padronizei documentos no Qualyteam e mapeei gargalos do fluxo.',
        spineDesc: 'Cronoanálises em campo, controle de estoque e checklists, Qualyteam e diagnóstico de gargalos.',
        spineChips: ['Cronoanálises', 'Qualyteam', 'Estoque & KPIs'],
        frentes: [
          {
            num: '01',
            key: 'MEDIÇÃO',
            title: 'Cronoanálises & indicadores em campo',
            detail: 'Medi tempos diretamente no chão de fábrica com cronoanálises e levantei KPIs de desempenho de operadores e equipamentos na rotina produtiva.',
            short: 'Cronoanálises e KPIs de operadores e equipamentos.',
            tags: ['Cronoanálise', 'KPIs', 'Chão de fábrica']
          },
          {
            num: '02',
            key: 'ESTOQUE',
            title: 'Estoque, embalagens & checklists',
            detail: 'Acompanhei controle de estoque, organização de embalagens e listas de verificação de carregamento no fluxo diário da planta.',
            short: 'Controle de estoque, embalagens e checklists.',
            tags: ['Estoque', 'Embalagens', 'Checklists']
          },
          {
            num: '03',
            key: 'QUALIDADE',
            title: 'Padronização documental no Qualyteam',
            detail: 'Padronizei procedimentos operacionais e apoiei a organização e controle de documentos da área dentro do sistema Qualyteam.',
            short: 'Procedimentos e controle documental no Qualyteam.',
            tags: ['Qualyteam', 'Procedimentos', 'Qualidade']
          },
          {
            num: '04',
            key: 'DIAGNÓSTICO',
            title: 'Mapeamento de gargalos & rastreabilidade',
            detail: 'Mapeei gargalos reais da rotina física e apoiei iniciativas iniciais de rastreabilidade e digitalização que prepararam a transição para a Fase 02.',
            short: 'Mapeamento de gargalos e base para digitalização.',
            tags: ['Diagnóstico', 'Rastreabilidade', 'Melhoria contínua']
          }
        ],
        projects: []
      }
    ];

    let activePhaseIdx = 0; // Fase 02 (Estágio · Atual) aberta por padrão
    let activeFrenteIdx = 0;

    function renderDesktopSpine() {
      if (!spineEl) return;
      const p2 = PHASES[0];
      const p1 = PHASES[1];

      const cardHTML = (ph, idx) => {
        const isSel = idx === activePhaseIdx;
        return `
          <button
            type="button"
            role="tab"
            id="actech-tab-${ph.id}"
            aria-selected="${isSel}"
            aria-controls="actech-desktop-stage"
            data-actech-phase="${idx}"
            class="actech-spine-btn w-full rounded-2xl p-4 lg:p-5 flex flex-col justify-between gap-3 cursor-pointer flex-1"
            style="--phase-accent:${ph.accent}; --phase-border:${ph.border}; --phase-glow:${ph.glow};"
          >
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
                <span class="inline-flex items-center gap-2 font-semibold" style="color:${ph.accent};">
                  <span class="w-2 h-2 rounded-full ${idx === 0 ? 'acad-node-pulse' : ''}" style="background:${ph.accent};"></span>
                  <span>${ph.code} · ${ph.period}</span>
                </span>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-semibold border" style="color:${ph.accent}; border-color:${ph.border}; background:${ph.glow};">
                  ${idx === 0 ? 'ATUAL' : 'CONCLUÍDA'}
                </span>
              </div>
              <div>
                <h3 class="font-display text-base lg:text-lg font-bold text-ink leading-snug">${ph.role}</h3>
                <div class="font-mono text-[10.5px] text-muted mt-0.5">${ph.area}</div>
              </div>
              <p class="text-xs text-ink/75 leading-relaxed pt-1">${ph.spineDesc}</p>
            </div>

            <div class="flex items-center justify-between gap-2 pt-2.5 border-t border-white/8">
              <div class="flex flex-wrap gap-1.5 font-mono text-[9.5px] text-ink/80">
                ${ph.spineChips.map((c) => `<span class="px-2 py-0.5 rounded bg-white/[0.05]">${c}</span>`).join('')}
              </div>
              <span class="font-mono text-xs shrink-0 transition-transform ${isSel ? 'translate-x-0.5' : 'opacity-45'}" style="color:${ph.accent};" aria-hidden="true">→</span>
            </div>
          </button>`;
      };

      spineEl.innerHTML = `
        ${cardHTML(p2, 0)}
        <div class="hidden lg:flex items-center gap-3 px-4 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted select-none" aria-hidden="true">
          <span class="h-[1px] flex-1 bg-gradient-to-r from-[#F59E0B]/40 via-limeTech/50 to-transparent"></span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-graphite border border-limeTech/30 text-limeTech font-semibold">
            <span>↑</span>
            <span>EVOLUÇÃO INTERNA · FEV/2026</span>
          </span>
          <span class="h-[1px] flex-1 bg-gradient-to-l from-[#F59E0B]/40 via-limeTech/50 to-transparent"></span>
        </div>
        ${cardHTML(p1, 1)}
      `;

      spineEl.querySelectorAll('[data-actech-phase]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.getAttribute('data-actech-phase'));
          if (next === activePhaseIdx) return;
          activePhaseIdx = next;
          activeFrenteIdx = 0;
          renderAll(true);
        });
      });
    }

    function renderDesktopStage(animate = false) {
      if (!deskStageEl) return;
      const ph = PHASES[activePhaseIdx];
      const f = ph.frentes[activeFrenteIdx] || ph.frentes[0];
      deskStageEl.style.setProperty('--phase-accent', ph.accent);
      deskStageEl.style.setProperty('--phase-border', ph.border);
      deskStageEl.style.setProperty('--phase-glow', ph.glow);

      const bottomBand = ph.projects.length
        ? `
          <div class="space-y-2.5 pt-4 border-t hairline-dark">
            <div class="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
              <span class="text-muted">PROJETOS DESTA FASE</span>
              <span class="text-limeTech/90">CLIQUE PARA ABRIR O DOSSIÊ</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${ph.projects.map((pr) => `
                <button
                  type="button"
                  data-open-project-by-id="${pr.id}"
                  class="actech-proj-card group text-left p-2.5 rounded-xl bg-carbon border hairline-dark hover:border-white/25 flex items-center gap-3 cursor-pointer"
                >
                  <div class="w-20 h-14 rounded-lg overflow-hidden border border-white/10 bg-[#070A0D] shrink-0">
                    <img src="${pr.img}" alt="Prévia ${pr.title}" loading="lazy" decoding="async" class="w-full h-full object-cover object-left-top group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div class="min-w-0 flex-1 space-y-0.5">
                    <div class="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider">
                      <span class="px-1.5 py-0.5 rounded font-semibold text-[#050606] leading-none" style="background:${pr.accent};">${pr.index}</span>
                      <span class="truncate font-semibold" style="color:${pr.accent};">DOSSIÊ ↗</span>
                    </div>
                    <div class="font-display text-sm font-bold text-ink truncate group-hover:text-limeTech transition-colors">${pr.title}</div>
                    <div class="font-mono text-[9.5px] text-muted truncate">${pr.sub}</div>
                  </div>
                </button>`).join('')}
            </div>
          </div>`
        : `
          <div class="pt-4 border-t hairline-dark">
            <div class="p-4 rounded-xl bg-carbon border border-[#F59E0B]/25 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1 min-w-0 flex-1">
                <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-[#F59E0B] font-semibold">PONTE PARA A FASE 02</div>
                <p class="text-xs text-ink/85 leading-relaxed">
                  O ciclo como Jovem Aprendiz medindo tempos, padronizando documentos no Qualyteam e observando gargalos em área deu a base para digitalizar a triagem e automatizar o ETL no estágio.
                </p>
              </div>
              <button
                type="button"
                id="actech-jump-phase2"
                class="px-3.5 py-2 rounded-lg bg-limeTech text-inkDark font-mono text-[10.5px] font-semibold uppercase tracking-wider hover:bg-[#d5ff4d] transition-colors shrink-0 cursor-pointer"
              >
                Ver Fase 02 →
              </button>
            </div>
          </div>`;

      deskStageEl.innerHTML = `
        <div class="${animate && !prefersReducedMotion ? 'actech-stage-enter ' : ''}p-5 lg:p-6 flex flex-col justify-between gap-4 h-full">
          <div class="space-y-4">
            <!-- Cabeçalho da Fase Ativa -->
            <div class="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b hairline-dark">
              <div class="space-y-1 min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]" style="color:${ph.accent};">
                  <span class="font-semibold">${ph.code} // ${ph.status}</span>
                  <span class="text-muted">· ${ph.period}</span>
                </div>
                <h3 class="font-display text-xl lg:text-[1.42rem] font-extrabold text-ink tracking-tight leading-snug">${ph.role}</h3>
              </div>
              <span class="font-mono text-[9.5px] uppercase tracking-wider px-2.5 py-1 rounded-lg bg-carbon border hairline-dark text-muted shrink-0">
                04 FRENTES CONCRETAS
              </span>
            </div>

            <p class="text-[13.5px] text-ink/85 leading-relaxed">${ph.summary}</p>

            <!-- Fluxo Interativo em 4 Etapas (Clique para inspecionar) -->
            <div class="space-y-2.5">
              <div class="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                <span>FLUXO DE ATUAÇÃO · SELECIONE UMA FRENTE</span>
                <span style="color:${ph.accent};" class="font-semibold">${f.num} / 04</span>
              </div>

              <div class="relative h-[2px] w-full rounded-full bg-white/8 overflow-hidden" aria-hidden="true">
                <div class="h-full transition-all duration-300" style="width:${((activeFrenteIdx + 1) / 4) * 100}%; background:${ph.accent};"></div>
              </div>

              <div class="grid grid-cols-4 gap-2">
                ${ph.frentes.map((item, idx) => `
                  <button
                    type="button"
                    data-actech-frente="${idx}"
                    data-active="${idx === activeFrenteIdx}"
                    class="actech-flow-node text-left p-2.5 rounded-xl space-y-1 cursor-pointer"
                  >
                    <div class="flex items-center justify-between font-mono text-[9.5px]">
                      <span class="font-semibold" style="color:${ph.accent};">${item.num}</span>
                      <span class="w-1.5 h-1.5 rounded-full ${idx === activeFrenteIdx ? 'opacity-100' : 'opacity-20'}" style="background:${ph.accent};"></span>
                    </div>
                    <div class="font-mono text-[10px] font-semibold text-ink truncate">${item.key}</div>
                  </button>`).join('')}
              </div>

              <!-- Leitura detalhada da frente selecionada -->
              <div id="actech-frente-readout" class="p-4 rounded-xl bg-carbon/90 border space-y-2.5" style="border-color:${ph.border};">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="font-display text-[15px] font-bold text-ink">${f.num} · ${f.title}</div>
                  <div class="flex flex-wrap gap-1.5 font-mono text-[9.5px]">
                    ${f.tags.map((t) => `<span class="px-2 py-0.5 rounded bg-white/[0.06] text-ink/85">${t}</span>`).join('')}
                  </div>
                </div>
                <p class="text-xs sm:text-[13px] text-ink/85 leading-relaxed">${f.detail}</p>
              </div>
            </div>
          </div>

          ${bottomBand}
        </div>
      `;

      deskStageEl.querySelectorAll('[data-actech-frente]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const nextF = Number(btn.getAttribute('data-actech-frente'));
          if (nextF === activeFrenteIdx) return;
          activeFrenteIdx = nextF;
          renderDesktopStage(false);
        });
      });

      document.getElementById('actech-jump-phase2')?.addEventListener('click', () => {
        activePhaseIdx = 0;
        activeFrenteIdx = 0;
        renderAll(true);
      });
    }

    function renderMobile() {
      if (!mobTabsEl || !mobStageEl) return;
      mobTabsEl.innerHTML = PHASES.map((ph, idx) => {
        const isSel = idx === activePhaseIdx;
        return `
          <button
            type="button"
            role="tab"
            aria-selected="${isSel}"
            data-actech-mob="${idx}"
            class="actech-mob-tab min-h-[48px] py-2 px-3 rounded-lg border border-transparent text-left flex flex-col justify-center gap-0.5 cursor-pointer"
            style="--phase-accent:${ph.accent}; --phase-border:${ph.border};"
          >
            <span class="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider" style="color:${isSel ? ph.accent : '#9EA59B'};">
              <span class="w-1.5 h-1.5 rounded-full" style="background:${isSel ? ph.accent : '#4D524B'};"></span>
              <span>${ph.mobLabel}</span>
            </span>
            <span class="font-mono text-[9px] text-muted pl-3">${ph.mobSub}</span>
          </button>`;
      }).join('');

      mobTabsEl.querySelectorAll('[data-actech-mob]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.getAttribute('data-actech-mob'));
          if (next === activePhaseIdx) return;
          activePhaseIdx = next;
          activeFrenteIdx = 0;
          renderAll(false);
        });
      });

      const ph = PHASES[activePhaseIdx];
      const mobFooter = ph.projects.length
        ? `
          <div class="grid grid-cols-2 gap-2 pt-2.5 border-t hairline-dark">
            ${ph.projects.map((pr) => `
              <button
                type="button"
                data-open-project-by-id="${pr.id}"
                class="p-2 rounded-xl bg-carbon border hairline-dark flex items-center gap-2 text-left cursor-pointer"
              >
                <img src="${pr.img}" alt="" loading="lazy" decoding="async" class="w-9 h-9 rounded-md object-cover object-left-top border border-white/10 shrink-0" />
                <div class="min-w-0">
                  <div class="font-mono text-[9px] font-semibold uppercase" style="color:${pr.accent};">${pr.index} · Abrir ↗</div>
                  <div class="font-display text-[11px] font-bold text-ink truncate">${pr.title.replace('Triagem de ', '').replace('Automação ', '')}</div>
                </div>
              </button>`).join('')}
          </div>`
        : `
          <div class="flex items-center justify-between gap-2 pt-2.5 border-t hairline-dark font-mono text-[9.5px] uppercase tracking-wider">
            <span class="text-muted">Qualyteam · Cronoanálises · KPIs</span>
            <span class="font-semibold shrink-0" style="color:${ph.accent};">CONCLUÍDA</span>
          </div>`;

      mobStageEl.innerHTML = `
        <article class="rounded-2xl bg-graphite border p-4 space-y-3" style="border-color:${ph.border};">
          <div class="flex items-start justify-between gap-2 pb-2.5 border-b hairline-dark">
            <div class="min-w-0">
              <div class="font-mono text-[9.5px] uppercase tracking-widest font-semibold" style="color:${ph.accent};">${ph.code} · ${ph.period}</div>
              <h3 class="font-display text-lg font-bold text-ink leading-snug mt-0.5">${ph.role}</h3>
            </div>
            <span class="px-2 py-0.5 rounded-full font-mono text-[9px] font-semibold shrink-0" style="color:${ph.accent}; background:${ph.glow}; border:1px solid ${ph.border};">
              ${activePhaseIdx === 0 ? 'ATUAL' : 'BASE'}
            </span>
          </div>

          <ul class="space-y-2">
            ${ph.frentes.map((item) => `
              <li class="flex items-start gap-2.5 text-[12.5px] text-ink/90 leading-snug">
                <span class="font-mono text-[10px] font-semibold pt-0.5 shrink-0" style="color:${ph.accent};">${item.num}</span>
                <span><strong class="text-ink font-semibold">${item.key}:</strong> ${item.short}</span>
              </li>`).join('')}
          </ul>

          ${mobFooter}
        </article>`;
    }

    function renderAll(animate = false) {
      renderDesktopSpine();
      renderDesktopStage(animate);
      renderMobile();
    }

    renderAll(false);
  })();

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-iris-card-bit]')) return;
    const byIdx = e.target.closest('[data-open-project]');
    if (byIdx) { openCaseModal(Number(byIdx.getAttribute('data-open-project'))); return; }
    const byId = e.target.closest('[data-open-project-by-id]');
    if (byId) {
      const found = PROJECTS.findIndex((p) => p.id === byId.getAttribute('data-open-project-by-id'));
      if (found >= 0) openCaseModal(found);
    }
  });
  if (projectsGrid) {
    projectsGrid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('[data-iris-card-bit]')) return;
      const card = e.target.closest('[data-open-project]');
      if (!card) return;
      e.preventDefault();
      openCaseModal(Number(card.getAttribute('data-open-project')));
    });
  }

  /* ==========================================================================
     14. MÓDULOS 3D INTERATIVOS NOS DOSSIÊS DE CASE
     ========================================================================== */

  let modalCleanups = [];
  function runModalCleanups() {
    modalCleanups.forEach((fn) => {
      try { fn(); } catch {}
    });
    modalCleanups = [];
  }

  // Torre arquitetural 3D + narrativa estruturada (Problema → O que construí → Resultado antes/depois)
  function buildIsometricWidgetHTML(widgetId, eyebrow, heading, project, rightExtra = '') {
    const accent = project.accent || '#C6F135';
    const resultTitle = project.resultLabel === 'RESULTADO //' ? '03 // RESULTADO (ANTES / DEPOIS)' : '03 // ENTREGA (ANTES / DEPOIS)';
    const metricBadge = project.metric
      ? `<div class="pt-1.5"><span class="inline-flex items-center px-2.5 py-1 rounded-md bg-graphite border hairline-dark font-mono text-[10px] font-semibold" style="color:${accent};">${project.metric}</span></div>`
      : '';
    return `
      <div class="rounded-2xl bg-graphite border hairline-dark p-4 sm:p-7 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b hairline-dark pb-4">
          <div>
            <div class="font-mono text-[10.5px] uppercase tracking-[0.14em] font-semibold" style="color:${accent};">${eyebrow}</div>
            <h4 class="font-display text-lg sm:text-xl font-bold text-ink mt-1">${heading}</h4>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${rightExtra}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <!-- Esquerda: Torre 3D interativa em camadas -->
          <div class="lg:col-span-6 flex">
            <div id="${widgetId}-iso-stage" class="iso-stage w-full">
              <div class="iso-stage__grid" aria-hidden="true"></div>
              <div class="iso-stage__hud">
                <div class="flex items-center gap-2">
                  <span id="${widgetId}-counter" class="px-2 py-0.5 rounded bg-carbon/90 border border-limeTech/40 font-mono text-[9.5px] font-semibold text-limeTech tabular-nums">01/04</span>
                  <span class="font-mono text-[9.5px] uppercase tracking-widest text-muted hidden sm:inline">FLUXO 3D · ARRASTE</span>
                </div>
                <div class="iso-live-pill" aria-hidden="true">
                  <span class="iso-live-dot acad-node-pulse"></span>
                  <span>Auto-Fluxo</span>
                </div>
              </div>

              <div id="${widgetId}-iso-stack" class="iso-stack" role="region" aria-label="${heading}"></div>

              <div id="${widgetId}-live-note" class="iso-stage__readout">
                <span class="text-limeTech font-semibold truncate">01</span>
                <span class="truncate">Carregando fluxo...</span>
              </div>

              <div class="iso-stage__progress" aria-hidden="true">
                <div id="${widgetId}-progress-bar" class="iso-stage__progress-fill"></div>
              </div>
            </div>
          </div>

          <!-- Direita: Narrativa Problema → O que construí → Resultado (Antes / Depois) -->
          <div class="lg:col-span-6 flex flex-col justify-between gap-3">
            <article class="dossier-narrative-card p-4 sm:p-5 rounded-xl bg-carbon border hairline-dark border-l-2 border-l-[#F59E0B]/85 space-y-1.5 flex-1 flex flex-col justify-center">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-[10px] uppercase tracking-widest text-[#F59E0B] font-semibold">01 // PROBLEMA</span>
                <svg class="w-3.5 h-3.5 text-[#F59E0B]/85 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.8L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0z" />
                </svg>
              </div>
              <p class="text-xs sm:text-[13.5px] text-ink/85 leading-relaxed">${project.problem}</p>
            </article>

            <article class="dossier-narrative-card p-4 sm:p-5 rounded-xl bg-carbon border hairline-dark border-l-2 border-l-[#38BDF8]/85 space-y-1.5 flex-1 flex flex-col justify-center">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-[10px] uppercase tracking-widest text-[#38BDF8] font-semibold">${project.id === 'iris' || project.id === 'agrobit' ? '02 // ATUAÇÃO NA SOLUÇÃO' : '02 // O QUE CONSTRUÍ'}</span>
                <svg class="w-3.5 h-3.5 text-[#38BDF8]/85 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l-4 3 4 3m8-6l4 3-4 3M14 5l-4 14" />
                </svg>
              </div>
              <p class="text-xs sm:text-[13.5px] text-ink/90 leading-relaxed">${project.built}</p>
            </article>

            <article class="dossier-narrative-card p-4 sm:p-5 rounded-xl bg-carbon border hairline-dark border-l-2 space-y-2.5 flex-1 flex flex-col justify-center" style="border-left-color:${accent};">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-[10px] uppercase tracking-widest font-semibold" style="color:${accent};">${resultTitle}</span>
                <svg class="w-3.5 h-3.5 shrink-0" style="color:${accent};" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs leading-relaxed">
                <div class="p-2.5 rounded-lg bg-graphite/80 border hairline-dark space-y-1">
                  <div class="font-mono text-[9.5px] uppercase tracking-wider text-muted">Antes</div>
                  <p class="text-ink/80">${project.before}</p>
                </div>
                <div class="p-2.5 rounded-lg bg-graphite/80 border space-y-1" style="border-color:color-mix(in srgb, ${accent} 38%, transparent);">
                  <div class="font-mono text-[9.5px] uppercase tracking-wider font-semibold" style="color:${accent};">Depois</div>
                  <p class="text-ink/95">${project.after}</p>
                </div>
              </div>
              ${metricBadge}
            </article>
          </div>
        </div>
      </div>
    `;
  }

  function bindIsometricWidget(widgetId, initialLayers, tagPrefix) {
    const stageEl = document.getElementById(`${widgetId}-iso-stage`);
    const stackEl = document.getElementById(`${widgetId}-iso-stack`);
    const gridEl = stageEl ? stageEl.querySelector('.iso-stage__grid') : null;
    const counterEl = document.getElementById(`${widgetId}-counter`);
    const liveNoteEl = document.getElementById(`${widgetId}-live-note`);
    const progressFill = document.getElementById(`${widgetId}-progress-bar`);
    if (!stageEl || !stackEl) return null;

    const AUTO_MS = 3200;
    let layers = initialLayers;
    let activeIdx = 0;
    let autoTimer = null;
    let plates = [];
    let spineTicks = [];
    let spineBeaconEl = null;
    let spineSyncEl = null;
    let suppressClickUntil = 0;

    function getStepMetrics() {
      const total = layers.length;
      const dense = total > 4;
      const stepY = dense ? 74 : 84;
      return { total, dense, stepY, spanH: (total - 1) * stepY };
    }

    function restartProgressBar() {
      if (!progressFill) return;
      progressFill.classList.remove('is-running');
      progressFill.style.animationDuration = `${AUTO_MS}ms`;
      if (prefersReducedMotion) return;
      void progressFill.offsetWidth;
      progressFill.classList.add('is-running');
    }

    function startAutoLoop() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
      if (prefersReducedMotion) return;
      restartProgressBar();
      autoTimer = setInterval(() => select(activeIdx + 1), AUTO_MS);
    }

    function buildPersistentNodes() {
      const { total, dense, stepY, spanH } = getStepMetrics();
      stageEl.setAttribute('data-dense', String(dense));

      const ticksHtml = layers
        .map((_, i) => `<span class="iso-spine__tick" data-tick-idx="${i}" style="top:${i * stepY}px;"></span>`)
        .join('');

      stackEl.innerHTML =
        `<div class="iso-spine" style="height:${spanH}px;" aria-hidden="true">` +
          `<div class="iso-spine__pulse"></div>` +
          ticksHtml +
          `<div class="iso-spine__sync"></div>` +
          `<div class="iso-spine__beacon"></div>` +
        `</div>` +
        layers
          .map(
            (l, i) => `
            <button
              type="button"
              data-iso-idx="${i}"
              data-active="false"
              class="iso-plate"
            >
              <span class="iso-plate__link" aria-hidden="true"></span>
              <span class="iso-plate__side iso-plate__side--bottom" aria-hidden="true"></span>
              <span class="iso-plate__side iso-plate__side--left" aria-hidden="true"></span>
              <span class="iso-plate__side iso-plate__side--right" aria-hidden="true"></span>
              <span class="iso-plate__specular" aria-hidden="true"></span>
              <div class="iso-plate__content">
                <div class="iso-plate__left">
                  <span class="iso-plate__badge">${l.code}</span>
                  <div class="iso-plate__titles">
                    <span class="iso-plate__name">${l.name}</span>
                    <span class="iso-plate__tech">${l.tech}</span>
                  </div>
                </div>
                <div class="iso-plate__right">
                  <span class="iso-plate__code">${tagPrefix}</span>
                  <span class="iso-plate__dot" aria-hidden="true"></span>
                </div>
              </div>
            </button>`
          )
          .join('');

      plates = Array.from(stackEl.querySelectorAll('.iso-plate'));
      spineTicks = Array.from(stackEl.querySelectorAll('.iso-spine__tick'));
      spineBeaconEl = stackEl.querySelector('.iso-spine__beacon');
      spineSyncEl = stackEl.querySelector('.iso-spine__sync');

      plates.forEach((pEl) => {
        pEl.addEventListener('click', (e) => {
          if (performance.now() < suppressClickUntil) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          select(Number(pEl.getAttribute('data-iso-idx')));
          startAutoLoop();
        });
      });

      if (counterEl) counterEl.textContent = `01/${String(total).padStart(2, '0')}`;
    }

    function select(idx) {
      activeIdx = (idx + layers.length) % layers.length;
      const { total, stepY } = getStepMetrics();
      const mid = (total - 1) / 2;

      plates.forEach((plate, i) => {
        const isAct = i === activeIdx;
        const baseY = (i - mid) * stepY;

        let tx = 0;
        let ty = baseY;
        let tz = 0;
        let sc = 0.975;
        let op = 0.84;

        if (isAct) {
          tx = 14;
          ty = baseY;
          tz = 18;
          sc = 1;
          op = 1;
        } else if (i < activeIdx) {
          ty = baseY - 5;
          tz = -4;
          op = 0.74;
        } else {
          ty = baseY + 5;
          tz = -4;
          op = 0.74;
        }

        plate.setAttribute('data-active', String(isAct));
        plate.style.setProperty('--plate-x', `${tx}px`);
        plate.style.setProperty('--plate-y', `${ty.toFixed(1)}px`);
        plate.style.setProperty('--plate-z', `${tz}px`);
        plate.style.setProperty('--plate-s', String(sc));
        plate.style.setProperty('--plate-op', String(op));
        plate.style.zIndex = String(isAct ? 30 : 10 + i);
      });

      const beaconY = activeIdx * stepY;
      spineTicks.forEach((tick, i) => {
        tick.classList.toggle('is-active', i === activeIdx);
        tick.classList.toggle('is-passed', i < activeIdx);
      });
      if (spineBeaconEl) {
        spineBeaconEl.style.transform = `translate3d(-50%, ${beaconY.toFixed(1)}px, 0)`;
      }
      if (spineSyncEl && !prefersReducedMotion) {
        spineSyncEl.style.setProperty('--sync-y', `${beaconY.toFixed(1)}px`);
        spineSyncEl.classList.remove('is-firing');
        void spineSyncEl.offsetWidth;
        spineSyncEl.classList.add('is-firing');
      }

      if (counterEl) {
        counterEl.textContent = `${String(activeIdx + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
      }

      const cur = layers[activeIdx];
      if (liveNoteEl && cur) {
        liveNoteEl.innerHTML = `
          <span class="text-limeTech font-semibold shrink-0">${tagPrefix} ${cur.code}</span>
          <span class="text-ink/85 truncate">${cur.io}</span>
        `;
      }

      restartProgressBar();
    }

    let orbitRaf = null;
    const cleanups = [];

    if (!prefersReducedMotion) {
      const getBasePose = () => {
        const compact = window.innerWidth <= 640;
        return { rx: compact ? 4 : 6, ry: compact ? -6 : -10 };
      };
      let pose = getBasePose();
      let dragRx = 0, dragRy = 0;
      let hoverRx = 0, hoverRy = 0;
      let velRx = 0, velRy = 0;
      let curRx = pose.rx, curRy = pose.ry;

      let pointerActive = false;
      let activePointerId = null;
      let didDrag = false;
      let startX = 0, startY = 0;
      let lastX = 0, lastY = 0;

      function applyOrbitTransform() {
        stackEl.style.transform = `rotateX(${curRx.toFixed(2)}deg) rotateY(${curRy.toFixed(2)}deg)`;
        if (gridEl) {
          gridEl.style.transform = `rotateX(${(62 + (curRx - pose.rx) * 0.4).toFixed(2)}deg) rotateZ(${(-14 + (curRy - pose.ry) * 0.35).toFixed(2)}deg) translateZ(-130px)`;
        }
        const specPos = clamp(50 + (curRy - pose.ry) * 1.6, 10, 90);
        stackEl.style.setProperty('--iso-spec-pos', `${specPos.toFixed(1)}%`);
      }

      function tickOrbit() {
        if (!pointerActive && (Math.abs(velRx) > 0.015 || Math.abs(velRy) > 0.015)) {
          dragRx = clamp(dragRx + velRx, -16 - pose.rx, 24 - pose.rx);
          dragRy = clamp(dragRy + velRy, -32 - pose.ry, 16 - pose.ry);
          velRx *= 0.88;
          velRy *= 0.88;
        }

        const tgtRx = clamp(pose.rx + dragRx + hoverRx, -16, 24);
        const tgtRy = clamp(pose.ry + dragRy + hoverRy, -32, 16);
        const factor = pointerActive ? 0.24 : 0.10;
        curRx += (tgtRx - curRx) * factor;
        curRy += (tgtRy - curRy) * factor;
        applyOrbitTransform();

        const moving =
          pointerActive ||
          Math.abs(tgtRx - curRx) > 0.02 ||
          Math.abs(tgtRy - curRy) > 0.02 ||
          Math.abs(velRx) > 0.015 ||
          Math.abs(velRy) > 0.015;

        if (moving) {
          orbitRaf = requestAnimationFrame(tickOrbit);
        } else {
          curRx = tgtRx;
          curRy = tgtRy;
          velRx = velRy = 0;
          applyOrbitTransform();
          orbitRaf = null;
        }
      }

      function kickOrbit() {
        if (!orbitRaf) orbitRaf = requestAnimationFrame(tickOrbit);
      }

      const onPointerDown = (e) => {
        if (e.button && e.button !== 0) return;
        pointerActive = true;
        activePointerId = e.pointerId;
        didDrag = false;
        startX = lastX = e.clientX;
        startY = lastY = e.clientY;
        velRx = velRy = 0;
      };

      const onPointerMove = (e) => {
        if (pointerActive && e.pointerId === activePointerId) {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;

          if (!didDrag && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
            didDrag = true;
            stageEl.classList.add('is-dragging');
            try { stageEl.setPointerCapture(e.pointerId); } catch {}
          }

          if (didDrag) {
            const dRy = dx * 0.25;
            const dRx = -dy * 0.20;
            dragRy = clamp(dragRy + dRy, -32 - pose.ry, 16 - pose.ry);
            dragRx = clamp(dragRx + dRx, -16 - pose.rx, 24 - pose.rx);
            velRy = dRy * 0.45;
            velRx = dRx * 0.45;
            kickOrbit();
          }
          return;
        }

        if (isFinePointer && canHover && e.pointerType === 'mouse' && !pointerActive && !isLowSpec) {
          if (!cachedRect) cachedRect = stageEl.getBoundingClientRect();
          const nx = clamp((e.clientX - cachedRect.left) / cachedRect.width - 0.5, -0.5, 0.5);
          const ny = clamp((e.clientY - cachedRect.top) / cachedRect.height - 0.5, -0.5, 0.5);
          hoverRx = -ny * 5;
          hoverRy = nx * 7;
          kickOrbit();
        }
      };

      let cachedRect = null;
      const onStageEnter = () => { cachedRect = stageEl.getBoundingClientRect(); };

      const finishDrag = (e) => {
        if (!pointerActive || (e && e.pointerId !== activePointerId)) return;
        pointerActive = false;
        activePointerId = null;
        if (didDrag) {
          suppressClickUntil = performance.now() + 240;
          stageEl.classList.remove('is-dragging');
          try { if (e && stageEl.hasPointerCapture(e.pointerId)) stageEl.releasePointerCapture(e.pointerId); } catch {}
          kickOrbit();
        }
      };

      const onStageLeave = () => {
        cachedRect = null;
        hoverRx = 0;
        hoverRy = 0;
        if (!pointerActive) kickOrbit();
      };

      const onDoubleClick = () => {
        dragRx = dragRy = velRx = velRy = 0;
        kickOrbit();
      };

      const onResize = () => {
        cachedRect = null;
        pose = getBasePose();
        kickOrbit();
      };

      const onWindowMove = (e) => { if (pointerActive) onPointerMove(e); };

      stageEl.addEventListener('pointerenter', onStageEnter, { passive: true });
      stageEl.addEventListener('pointerdown', onPointerDown);
      stageEl.addEventListener('pointermove', onPointerMove, { passive: true });
      stageEl.addEventListener('pointerleave', onStageLeave);
      stageEl.addEventListener('dblclick', onDoubleClick);
      window.addEventListener('pointermove', onWindowMove, { passive: true });
      window.addEventListener('pointerup', finishDrag);
      window.addEventListener('pointercancel', finishDrag);
      window.addEventListener('resize', onResize);

      cleanups.push(() => {
        stageEl.removeEventListener('pointerenter', onStageEnter);
        stageEl.removeEventListener('pointerdown', onPointerDown);
        stageEl.removeEventListener('pointermove', onPointerMove);
        stageEl.removeEventListener('pointerleave', onStageLeave);
        stageEl.removeEventListener('dblclick', onDoubleClick);
        window.removeEventListener('pointermove', onWindowMove);
        window.removeEventListener('pointerup', finishDrag);
        window.removeEventListener('pointercancel', finishDrag);
        window.removeEventListener('resize', onResize);
      });

      applyOrbitTransform();
    }

    modalCleanups.push(() => {
      if (autoTimer) clearInterval(autoTimer);
      if (orbitRaf) cancelAnimationFrame(orbitRaf);
      cleanups.forEach((fn) => { try { fn(); } catch {} });
    });

    buildPersistentNodes();
    select(0);
    startAutoLoop();

    return {
      updateLayers(newLayers, newPrefix) {
        layers = newLayers;
        const pfx = newPrefix || tagPrefix;
        plates.forEach((plate, i) => {
          const l = layers[i];
          if (!l) return;
          plate.querySelector('.iso-plate__badge').textContent = l.code;
          plate.querySelector('.iso-plate__code').textContent = pfx;
          plate.querySelector('.iso-plate__name').textContent = l.name;
          plate.querySelector('.iso-plate__tech').textContent = l.tech;
        });
        tagPrefix = pfx;
        select(activeIdx);
        startAutoLoop();
      }
    };
  }

  // PROJETO ÍRIS (ESTÁGIO DE PROTÓTIPOS BIT I ↔ BIT II + FOTO RIW + CAMADAS 3D)
  function buildIrisInteractiveHTML(project) {
    return `
      <div class="space-y-6">
        <div class="rounded-2xl bg-graphite border hairline-dark p-4 sm:p-7 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b hairline-dark pb-4">
            <div>
              <div class="font-mono text-[11px] text-limeTech uppercase tracking-widest">ESTÁGIO DE PROTÓTIPOS · BIT I ↔ BIT II</div>
              <h4 class="font-display text-lg sm:text-xl font-bold text-ink mt-1">Protótipos &amp; Rio Innovation Week 2023</h4>
            </div>
            <div class="inline-flex p-1 rounded-lg bg-carbon border hairline-dark font-mono text-xs">
              <button type="button" data-modal-bit="bit1" class="modal-bit-btn px-3 py-1.5 rounded-md text-muted hover:text-ink">Bit I · REV.01</button>
              <button type="button" data-modal-bit="bit2" class="modal-bit-btn px-3 py-1.5 rounded-md bg-limeTech text-inkDark font-semibold">Bit II · REV.02</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div class="lg:col-span-7 flex flex-col gap-3">
              <div id="modal-specimen-stage" data-spec-grid="true" data-current-bit="bit2" class="specimen-stage rounded-xl border border-black/20 aspect-[4/3] w-full flex items-center justify-center p-2.5 sm:p-3 cursor-default">
                <div class="specimen-tilt-layer relative w-full h-full flex items-center justify-center">
                  <div class="spec-grid-overlay specimen-layer-grid absolute inset-0"></div>
                  <div class="specimen-shadow" aria-hidden="true"></div>
                  <span class="pointer-events-none absolute top-2 left-2 w-3.5 h-3.5 reticle-tl specimen-layer-reticle"></span>
                  <span class="pointer-events-none absolute top-2 right-2 w-3.5 h-3.5 reticle-tr specimen-layer-reticle"></span>
                  <span class="pointer-events-none absolute bottom-2 left-2 w-3.5 h-3.5 reticle-bl specimen-layer-reticle"></span>
                  <span class="pointer-events-none absolute bottom-2 right-2 w-3.5 h-3.5 reticle-br specimen-layer-reticle"></span>
                  <div class="specimen-layer-proto relative w-full h-full flex items-center justify-center">
                    <img id="modal-specimen-img" src="assets/bit-2.jpg?v=20261124a" alt="Protótipo Bit II do Projeto Íris" class="specimen-img max-h-[94%] max-w-[94%] object-contain select-none" />
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <button type="button" data-modal-bit="bit1" data-modal-bit-card="bit1" data-active="false" class="bit-spec-card p-3 rounded-xl bg-carbon border hairline-dark hover:border-limeTech text-left flex items-center gap-3 transition-colors">
                  <img src="assets/bit-1.jpg?v=20261124a" alt="Protótipo Bit I" class="w-11 h-11 rounded-lg object-contain bg-[#F4F3EF] p-0.5 shrink-0" />
                  <div class="min-w-0">
                    <div class="font-mono text-[10px] text-limeTech">REV.01 · ALIM. EXTERNA</div>
                    <div class="font-display text-xs sm:text-sm font-bold text-ink truncate">Bit I · Arduino + Shield</div>
                  </div>
                </button>
                <button type="button" data-modal-bit="bit2" data-modal-bit-card="bit2" data-active="true" class="bit-spec-card p-3 rounded-xl bg-carbon border hairline-dark hover:border-limeTech text-left flex items-center gap-3 transition-colors">
                  <img src="assets/bit-2.jpg?v=20261124a" alt="Protótipo Bit II" class="w-11 h-11 rounded-lg object-contain bg-[#F4F3EF] p-0.5 shrink-0" />
                  <div class="min-w-0">
                    <div class="font-mono text-[10px] text-limeTech">REV.02 · AUTÔNOMO</div>
                    <div class="font-display text-xs sm:text-sm font-bold text-ink truncate">Bit II · Portátil</div>
                  </div>
                </button>
              </div>
            </div>

            <div class="lg:col-span-5 flex flex-col justify-between gap-4">
              <div class="editorial-photo-frame block w-full rounded-xl overflow-hidden border hairline-dark bg-carbon">
                <div class="relative aspect-[16/10] w-full overflow-hidden">
                  <img src="assets/bitmind-riw.jpg" alt="Equipe Bitmind na Rio Innovation Week 2023" class="editorial-photo-img w-full h-full object-cover" />
                </div>
                <div class="px-3.5 py-2.5 bg-carbon border-t hairline-dark font-mono text-[10px] text-muted flex justify-between">
                  <span>RIO INNOVATION WEEK 2023</span>
                  <span class="text-limeTech">PÍER MAUÁ · RJ</span>
                </div>
              </div>

              <div class="p-4 rounded-xl bg-carbon border hairline-dark space-y-2.5 flex-1">
                <div class="font-mono text-[10px] uppercase tracking-widest text-limeTech">EVOLUÇÃO BIT I → BIT II</div>
                <ul class="space-y-2.5 text-xs text-ink/85 leading-relaxed">
                  <li><strong class="text-ink">Bit I (REV.01):</strong> Arduino Uno com shield personalizado em fenolite e processamento dedicado, dependendo de alimentação externa para operar.</li>
                  <li><strong class="text-ink">Bit II (REV.02 · Autônomo):</strong> operação totalmente portátil com duas baterias e circuito de carregamento embarcado, além de maior rigidez nos cabos contra estresses mecânicos e estrutura mais compacta para uso diário.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        ${buildIsometricWidgetHTML('iris-arch', 'ARQUITETURA EMBARCADA · 04 CAMADAS', 'Sensoriamento → Processamento → Feedback Háptico', project)}
      </div>
    `;
  }

  function bindIrisInteractive() {
    const stage = document.getElementById('modal-specimen-stage');
    const img = document.getElementById('modal-specimen-img');
    const bitBtns = modalBody.querySelectorAll('[data-modal-bit]');

    if (stage && img) {
      stage.setAttribute('data-spec-grid', 'true');
      modalCleanups.push(() => {
        if (stage._swapTimer) {
          clearTimeout(stage._swapTimer);
          stage._swapTimer = null;
        }
      });

      function setModalBit(bitKey, animateSwap = true) {
        const s = HARDWARE_SPECS[bitKey];
        if (!s) return;
        const prevKey = stage.getAttribute('data-current-bit') || 'bit2';
        stage.setAttribute('data-current-bit', bitKey);

        if (animateSwap && prevKey !== bitKey) {
          swapSpecimenImage(stage, img, s.src, s.alt);
        } else {
          img.src = s.src;
          img.alt = s.alt;
        }

        modalBody.querySelectorAll('.modal-bit-btn').forEach((b) => {
          const active = b.getAttribute('data-modal-bit') === bitKey;
          b.className = active
            ? 'modal-bit-btn px-3 py-1.5 rounded-md bg-limeTech text-inkDark font-semibold'
            : 'modal-bit-btn px-3 py-1.5 rounded-md text-muted hover:text-ink';
        });

        modalBody.querySelectorAll('[data-modal-bit-card]').forEach((card) => {
          card.setAttribute('data-active', String(card.getAttribute('data-modal-bit-card') === bitKey));
        });
      }

      bitBtns.forEach((b) => b.addEventListener('click', () => setModalBit(b.getAttribute('data-modal-bit'), true)));
      setModalBit('bit2', false);
    }

    bindIsometricWidget('iris-arch', [
      { code: '01', name: 'Óculos & Sensores', tech: 'Detecção Frontal', desc: 'Sensores embarcados nos óculos captam obstáculos acima da linha da cintura em tempo real.', io: 'Ambiente urbano → Distância medida' },
      { code: '02', name: 'Unidade Bit I / II', tech: 'Hardware & Portabilidade', desc: 'Unidade de processamento embarcado com alimentação regulada e estrutura portátil.', io: 'Sinais dos sensores → Controle estável' },
      { code: '03', name: 'Lógica Embarcada', tech: 'Firmware / Arduino', desc: 'Interpretação das faixas de proximidade e acionamento proporcional sem obstruir a audição.', io: 'Leituras contínuas → Pulso direcional' },
      { code: '04', name: 'Pulseiras Hápticas', tech: 'Feedback Tátil', desc: 'Comunicação tátil intuitiva via vibração nas pulseiras para alertar sobre obstáculos.', io: 'Alerta tátil imediato para o usuário' }
    ], 'MÓDULO');
  }

  // BIG BAG TRIAGEM (INTERFACE + CAMADAS 3D)
  function buildBigBagInteractiveHTML(project) {
    return `
      <div class="space-y-5">
        <div class="rounded-2xl bg-graphite border border-[#38BDF8]/30 p-4 sm:p-5 space-y-3">
          <div class="flex items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-widest">
            <span class="text-[#38BDF8]">INTERFACE DA APLICAÇÃO // VISÃO EXECUTIVA</span>
            <span class="text-muted">WEB · FIREBASE · R2 · IA</span>
          </div>
          <div class="rounded-xl overflow-hidden border border-white/10 bg-[#070A0D]">
            <img src="assets/bigbag-app.png?v=20261124b" alt="Tela Visão Executiva do sistema web de Triagem de Big Bags" loading="lazy" decoding="async" class="w-full h-auto block" />
          </div>
        </div>
        ${buildIsometricWidgetHTML('bigbag', 'ECOSSISTEMA DIGITAL · 06 CAMADAS', 'Operação → Nuvem → IA → Distribuição semanal', project)}
      </div>`;
  }

  function bindBigBagInteractive() {
    bindIsometricWidget('bigbag', [
      { code: '01', name: 'Interface Web', tech: 'HTML · CSS · JS', desc: 'Registro diário da triagem de Big Bags, estoque, backlog e chegadas na rotina.', io: 'Operação → Dados estruturados' },
      { code: '02', name: 'Firebase', tech: 'Banco em Nuvem', desc: 'Centralização em nuvem dos apontamentos e saldos de estoque.', io: 'Sistema Web → Base unificada' },
      { code: '03', name: 'Cloudflare R2', tech: 'Armazenamento de Objetos', desc: 'Armazenamento em nuvem para arquivos e registros vinculados à operação.', io: 'Arquivos → Armazenamento integrado' },
      { code: '04', name: 'Gemini API', tech: 'IA Aplicada', desc: 'Síntese assistida dos registros consolidados em relatórios técnicos.', io: 'Base consolidada → Relatório IA' },
      { code: '05', name: 'Apps Script & Automate', tech: 'Orquestração', desc: 'Automação de processamento e gatilhos semanais sem trabalho manual.', io: 'Relatório + agenda → Disparo automático' },
      { code: '06', name: 'Distribuição Semanal', tech: 'Visibilidade', desc: 'Envio semanal de estoque, backlog e chegadas para os interessados da empresa.', io: 'Visibilidade semanal para a equipe' }
    ], 'CAMADA');
  }

  // FRETEFY (PAINEL + 3D ETL FLOW + 8 KPIS)
  function buildFretefyInteractiveHTML(project) {
    return `
      <div class="space-y-5">
        <div class="rounded-2xl bg-graphite border border-[#F59E0B]/30 p-4 sm:p-5 space-y-3">
          <div class="flex items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-widest">
            <span class="text-[#F59E0B]">PAINEL OPERACIONAL // CARREGAMENTO &amp; TPV</span>
            <span class="text-muted">EXCEL · POWER QUERY · 8 KPIS</span>
          </div>
          <div class="rounded-xl overflow-hidden border border-white/10 bg-[#090806]">
            <img src="assets/fretefy-panel.png?v=20261124b" alt="Painel de operações de carregamento automatizado em Excel e Power Query" loading="lazy" decoding="async" class="w-full h-auto block" />
          </div>
        </div>
        ${buildIsometricWidgetHTML('fretefy-etl', 'FRETEFY ETL · 04 ESTÁGIOS 3D', 'Pipeline Power Query → TPV & 8 KPIs', project)}

        <div class="rounded-2xl bg-graphite border border-[#F59E0B]/35 p-5 sm:p-6">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div class="lg:col-span-8 space-y-2">
              <div class="inline-flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#F59E0B] font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-[#F59E0B] acad-node-pulse"></span>
                <span>ALÉM DO TPV // DO EMPÍRICO AOS DADOS ESTRUTURADOS</span>
              </div>
              <h4 class="font-display text-lg sm:text-xl font-bold text-ink leading-snug">
                8 KPIs logísticos estruturados a partir da mesma base.
              </h4>
              <p class="text-xs sm:text-sm text-ink/85 leading-relaxed">
                Além de gerar o TPV mensal em menos de 5 minutos, a modelagem ETL trouxe dados estruturados para <strong class="text-ink font-semibold">8 indicadores operacionais</strong> que antes eram acompanhados apenas na base empírica — substituindo percepções soltas por leitura objetiva de desempenho, capacidade e gargalos.
              </p>
            </div>
            <div class="lg:col-span-4 grid grid-cols-2 gap-3">
              <div class="p-3.5 rounded-xl bg-carbon border border-[#F59E0B]/30 text-center space-y-1">
                <div class="font-sans text-2xl sm:text-3xl font-extrabold text-[#F59E0B] tabular-nums">08</div>
                <div class="font-mono text-[9.5px] uppercase tracking-widest text-muted">KPIs calculados</div>
              </div>
              <div class="p-3.5 rounded-xl bg-carbon border border-limeTech/30 text-center space-y-1">
                <div class="font-sans text-2xl sm:text-3xl font-extrabold text-limeTech tabular-nums">&lt;5m</div>
                <div class="font-mono text-[9.5px] uppercase tracking-widest text-muted">TPV mensal</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindFretefyInteractive() {
    bindIsometricWidget('fretefy-etl', [
      { code: '01', name: 'Ingestão Fretefy', tech: 'Power Query', desc: 'Importação estruturada das extrações logísticas em fluxo repetível.', io: 'Exportação Fretefy → Base pronta' },
      { code: '02', name: 'Pipeline ETL', tech: 'Transformação Auto', desc: 'Tipagem, limpeza temporal e classificação automática sem conferências manuais.', io: 'Atualização padronizada em 1 clique' },
      { code: '03', name: 'TPV & 8 KPIs', tech: 'Empírico → Dados', desc: 'Geração do TPV mensal em menos de 5 minutos e estruturação de 8 KPIs.', io: '8 KPIs confiáveis em < 5 min' },
      { code: '04', name: 'Dashboard BI', tech: 'Tabelas Dinâmicas', desc: 'Visões interativas por histórico, dia da semana, turno, frota e capacidade operacional.', io: 'Leitura objetiva de gargalos' }
    ], 'ETL');
  }

  // AGROBIT (CAMADAS 3D + FOTO DA EQUIPE NO RODAPÉ DO DOSSIÊ)
  function buildAgrobitInteractiveHTML(project) {
    return buildIsometricWidgetHTML('agrobit', 'INTEGRAÇÃO DE FONTES · BITMINDOP', 'Geoespacial + Clima + IA + Conceito IoT', project);
  }

  function buildAgrobitTeamPhotoHTML() {
    return `
      <div class="rounded-2xl bg-graphite border hairline-dark p-4 sm:p-6 space-y-3">
        <div class="flex items-center justify-between font-mono text-[11px]">
          <span class="text-limeTech uppercase tracking-widest">EQUIPE BITMINDOP · AGROBIT</span>
          <span class="text-muted">APRESENTAÇÃO DO PROJETO</span>
        </div>
        <div class="editorial-photo-frame block w-full rounded-xl overflow-hidden border hairline-dark bg-carbon">
          <div class="relative aspect-[16/10] w-full overflow-hidden">
            <img src="assets/agrobit-team.jpg" alt="Equipe Bitmindop apresentando o AGROBIT" style="object-position: 50% 28%;" class="editorial-photo-img w-full h-full object-cover" />
          </div>
          <div class="px-4 py-2.5 bg-carbon border-t hairline-dark font-mono text-[10px] text-muted flex justify-between">
            <span class="text-ink">EQUIPE BITMINDOP · AGROBIT</span>
            <span class="text-limeTech">OSM · NASA · EMBRAPA · ESP32</span>
          </div>
        </div>
      </div>
    `;
  }

  function bindAgrobitInteractive() {
    bindIsometricWidget('agrobit', [
      { code: '01', name: 'OpenStreetMap', tech: 'Geoespacial', desc: 'Seleção da área na interface web extraindo coordenadas do terreno.', io: 'Seleção no mapa → Lat / Lon' },
      { code: '02', name: 'NASA POWER', tech: 'API Climática', desc: 'Séries meteorológicas históricas e recentes integradas ao painel.', io: 'Lat/Lon → Clima e radiação' },
      { code: '03', name: 'Embrapa', tech: 'Base Agronômica', desc: 'Parâmetros agrícolas contextualizando o cenário produtivo local.', io: 'Região → Referência técnica' },
      { code: '04', name: 'Gemini API', tech: 'Síntese IA', desc: 'Interpretação integrada das fontes na interface web.', io: 'Multi-fontes → Recomendação clara' },
      { code: '05', name: 'ESP32 / Arduino', tech: 'Conceito IoT', desc: 'Conceito de sensor de solo local para calibrar dados de satélite.', io: 'Telemetria de solo em campo' },
      { code: '06', name: 'Decisão em Campo', tech: 'Plataforma Web', desc: 'Painel unificado de apoio à decisão construído pela equipe Bitmindop.', io: 'Leitura prática integrada' }
    ], 'FONTE');
  }

  function renderCaseModal(idx) {
    runModalCleanups();
    currentProjectIndex = (idx + PROJECTS.length) % PROJECTS.length;
    const p = PROJECTS[currentProjectIndex];
    const accent = p.accent || '#C6F135';
    const totalPadded = String(PROJECTS.length).padStart(2, '0');
    const prevIdx = (currentProjectIndex - 1 + PROJECTS.length) % PROJECTS.length;
    const nextIdx = (currentProjectIndex + 1) % PROJECTS.length;
    const prevProj = PROJECTS[prevIdx];
    const nextProj = PROJECTS[nextIdx];

    modalIdxEl.textContent = p.index;
    modalIdxEl.style.backgroundColor = accent;
    modalCatEl.textContent = `${p.period} · ${p.category}`;

    let interactiveBlock = '';
    if (p.id === 'iris') interactiveBlock = buildIrisInteractiveHTML(p);
    else if (p.id === 'bigbag') interactiveBlock = buildBigBagInteractiveHTML(p);
    else if (p.id === 'fretefy') interactiveBlock = buildFretefyInteractiveHTML(p);
    else interactiveBlock = buildAgrobitInteractiveHTML(p);

    const trailingMediaBlock = p.id === 'agrobit' ? buildAgrobitTeamPhotoHTML() : '';
    const highlightsHTML = (p.highlights || [])
      .map(
        (h) => `
          <div class="p-3.5 rounded-xl bg-carbon/90 border hairline-dark space-y-1">
            <div class="font-mono text-[9.5px] uppercase tracking-widest text-muted">${h.k}</div>
            <div class="font-sans text-sm sm:text-[15px] font-bold text-ink leading-snug tabular-nums">${h.v}</div>
          </div>`
      )
      .join('');
    const modalMetricChip = p.metric
      ? `<div class="mt-2 inline-flex items-center px-2.5 py-1 rounded-md bg-carbon/85 border hairline-dark font-mono text-[10px] font-semibold" style="color:${accent};">${p.metric}</div>`
      : '';

    modalBody.innerHTML = `
      <!-- Cabeçalho do dossiê -->
      <div class="relative rounded-2xl bg-graphite border hairline-dark overflow-hidden p-5 sm:p-7 space-y-5">
        <div class="absolute inset-x-0 top-0 h-[2px]" style="background:linear-gradient(90deg, ${accent} 0%, transparent 78%);" aria-hidden="true"></div>

        <div class="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em]">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded font-semibold text-[#050606]" style="background:${accent};">CASE ${p.index} / ${totalPadded}</span>
            <span style="color:${accent};">${p.scope}</span>
          </div>
          <span class="text-muted">${p.period}</span>
        </div>

        <div class="space-y-2.5">
          <h3 id="modal-project-title" class="font-display text-2xl sm:text-4xl lg:text-[2.85rem] font-extrabold text-ink tracking-tight leading-[1.04]">
            ${p.name}
          </h3>
          <p class="text-sm sm:text-base text-ink/85 max-w-3xl leading-relaxed">${p.summary}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${highlightsHTML}
        </div>

        <div class="p-3.5 sm:p-4 rounded-xl border space-y-1.5" style="background:color-mix(in srgb, ${accent} 10%, #0B0C0B); border-color:color-mix(in srgb, ${accent} 42%, transparent);">
          <div class="font-mono text-[10px] font-semibold uppercase tracking-widest" style="color:${accent};">${p.resultLabel}</div>
          <p class="text-xs sm:text-sm text-ink/90 leading-relaxed">${p.cardResult}</p>
          ${modalMetricChip}
        </div>

        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <span class="font-mono text-[9.5px] uppercase tracking-widest text-muted mr-1">TECNOLOGIAS:</span>
          ${p.stack.map((tech) => `<span class="px-2.5 py-1 rounded-md bg-carbon border hairline-dark font-mono text-[10.5px] text-ink/90">${tech}</span>`).join('')}
        </div>
      </div>

      <!-- Bloco interativo 3D + Problema → O que construí → Resultado (Antes / Depois) -->
      <div>${interactiveBlock}</div>

      <!-- Participação & entregas + Aprendizados -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div class="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-graphite border hairline-dark flex flex-col justify-between gap-4">
          <div class="space-y-3.5">
            <div class="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
              <span style="color:${accent};" class="font-semibold">04 // PARTICIPAÇÃO &amp; ENTREGAS</span>
              <span class="text-muted">${p.deliverables.length} ITENS</span>
            </div>
            <div class="p-3.5 rounded-xl bg-carbon border hairline-dark space-y-1">
              <div class="font-mono text-[9.5px] uppercase tracking-widest text-muted">ATUAÇÃO</div>
              <p class="text-xs sm:text-sm text-ink/90 leading-relaxed">${p.role}</p>
            </div>
            <ul class="space-y-2 text-xs sm:text-sm text-ink/85 pt-1">
              ${p.deliverables
                .map(
                  (d) => `
                  <li class="flex items-start gap-2.5 p-2.5 rounded-lg bg-carbon/65 border hairline-dark">
                    <span class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style="background:${accent};"></span>
                    <span class="leading-relaxed">${d}</span>
                  </li>`
                )
                .join('')}
            </ul>
          </div>
        </div>

        <div class="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-graphite border hairline-dark space-y-3.5">
          <div class="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
            <span style="color:${accent};" class="font-semibold">05 // APRENDIZADOS</span>
            <span class="text-muted">CAMPO → SISTEMAS</span>
          </div>
          <ul class="space-y-3">
            ${p.learnings
              .map(
                (l, li) => `
                <li class="p-4 rounded-xl bg-carbon border hairline-dark flex items-start gap-3.5">
                  <span class="w-7 h-7 rounded-lg bg-graphite border hairline-dark font-mono text-[11px] font-semibold flex items-center justify-center shrink-0" style="color:${accent};">0${li + 1}</span>
                  <span class="text-xs sm:text-sm text-ink/88 leading-relaxed pt-0.5">${l}</span>
                </li>`
              )
              .join('')}
          </ul>
        </div>
      </div>

      ${trailingMediaBlock}

      <!-- Navegação entre cases -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t hairline-dark">
        <button type="button" data-modal-jump="${prevIdx}" class="group text-left p-4 rounded-xl bg-graphite border hairline-dark hover:border-white/30 transition-all flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="font-mono text-[9.5px] uppercase tracking-widest text-muted">← CASE ANTERIOR · ${prevProj.index}</div>
            <div class="font-display text-sm sm:text-base font-bold text-ink group-hover:text-limeTech transition-colors truncate mt-0.5">${prevProj.name}</div>
          </div>
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${prevProj.accent || '#C6F135'};"></span>
        </button>
        <button type="button" data-modal-jump="${nextIdx}" class="group text-left sm:text-right p-4 rounded-xl bg-graphite border hairline-dark hover:border-white/30 transition-all flex items-center justify-between sm:flex-row-reverse gap-3">
          <div class="min-w-0">
            <div class="font-mono text-[9.5px] uppercase tracking-widest text-muted">PRÓXIMO CASE · ${nextProj.index} →</div>
            <div class="font-display text-sm sm:text-base font-bold text-ink group-hover:text-limeTech transition-colors truncate mt-0.5">${nextProj.name}</div>
          </div>
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${nextProj.accent || '#C6F135'};"></span>
        </button>
      </div>
    `;

    modalBody.querySelectorAll('[data-modal-jump]').forEach((btn) => {
      btn.addEventListener('click', () => renderCaseModal(Number(btn.getAttribute('data-modal-jump'))));
    });

    if (p.id === 'iris') bindIrisInteractive();
    else if (p.id === 'bigbag') bindBigBagInteractive();
    else if (p.id === 'fretefy') bindFretefyInteractive();
    else bindAgrobitInteractive();

    if (!prefersReducedMotion) {
      Array.from(modalBody.children).forEach((child, ci) => {
        child.classList.add('modal-block-enter');
        child.style.setProperty('--modal-delay', `${ci * 55}ms`);
      });
    }

    modalBody.scrollTop = 0;
    window.dispatchEvent(new CustomEvent('portfolio:case-opened', { detail: { id: p.id } }));
  }

  function openCaseModal(idx) {
    lastFocusedEl = document.activeElement;
    setBackgroundPaused(true);
    renderCaseModal(idx);
    modalEl.setAttribute('data-open', 'true');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modalCloseBtn.focus(), 50);
  }

  function closeCaseModal() {
    runModalCleanups();
    modalEl.setAttribute('data-open', 'false');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setBackgroundPaused(false);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
  }

  modalPrevBtn.addEventListener('click', () => renderCaseModal(currentProjectIndex - 1));
  modalNextBtn.addEventListener('click', () => renderCaseModal(currentProjectIndex + 1));
  modalCloseBtn.addEventListener('click', closeCaseModal);
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeCaseModal(); });

  document.addEventListener('keydown', (e) => {
    if (modalEl && modalEl.getAttribute('data-open') === 'true') {
      if (e.key === 'Escape') closeCaseModal();
      else if (e.key === 'ArrowRight') renderCaseModal(currentProjectIndex + 1);
      else if (e.key === 'ArrowLeft') renderCaseModal(currentProjectIndex - 1);
      return;
    }
    if (e.key === 'Escape' && mobileDrawer && mobileDrawer.getAttribute('data-open') === 'true') {
      setMobileMenu(false);
    }
  });

  /* ==========================================================================
     15. SYSTEM TOOLBOX — MODULAR ENGINEERING PATCHBAY (ICONS, RADAR & SYNERGY)
     ========================================================================== */
  const toolboxFiltersWrap = document.getElementById('toolbox-filters');
  const toolboxMatrixWrap = document.getElementById('toolbox-matrix');
  const toolboxMobDomains = document.getElementById('toolbox-mobile-domains');
  const toolboxMobStage = document.getElementById('toolbox-mobile-stage');
  const toolboxMobExpandBtn = document.getElementById('toolbox-mobile-expand-btn');
  const inspectorBody = document.getElementById('toolbox-inspector-body');
  const resetToolBtn = document.getElementById('toolbox-reset-btn');

  const TOOLBOX_META = {
    data: {
      sub: 'ETL, KPIs logísticos & visualização gerencial',
      short: 'DADOS',
      color: '#F59E0B',
      icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 19h16M7 16v-5m5 5V7m5 9v-8"/></svg>'
    },
    dev: {
      sub: 'Aplicações web operacionais & interfaces',
      short: 'DEV',
      color: '#38BDF8',
      icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 9l-4 3 4 3m8-6l4 3-4 3M14 5l-4 14"/></svg>'
    },
    cloud: {
      sub: 'Banco em nuvem, armazenamento R2 & APIs geoespaciais',
      short: 'NUVEM',
      color: '#60A5FA',
      icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.5 19h11a4 4 0 00.9-7.9A5.5 5.5 0 007.8 9.2 3.8 3.8 0 006.5 19z"/></svg>'
    },
    ai: {
      sub: 'Síntese técnica, Gemini API & fluxos assistidos',
      short: 'IA',
      color: '#A78BFA',
      icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z"/></svg>'
    },
    automation: {
      sub: 'Orquestração de fluxos & disparo periódico',
      short: 'AUTO',
      color: '#C6F135',
      icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/></svg>'
    },
    eng: {
      sub: 'Controle, embarcados, microeletrônica & chão de fábrica',
      short: 'ENG/HW',
      color: '#34D399',
      icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path stroke-linecap="round" d="M9 4v3m6-3v3M9 17v3m6-3v3M4 9h3m-3 6h3m10-6h3m-3 6h3"/></svg>'
    }
  };

  const ALL_TOOLS_FLAT = TOOLBOX_DATA.flatMap((c) =>
    c.tools.map((t) => ({ ...t, categoryId: c.id, categoryLabel: c.label, categoryCode: c.code }))
  );

  let activeCategory = 'all';
  let selectedTool = null;

  function findRelatedTools(tool) {
    if (!tool) return new Set();
    const set = new Set();
    ALL_TOOLS_FLAT.forEach((other) => {
      if (other.name === tool.name) return;
      if (other.projects.some((pid) => tool.projects.includes(pid))) set.add(other.name);
    });
    return set;
  }

  function buildDomainRadarSVG() {
    const cx = 110, cy = 98, maxR = 64;
    const maxTools = Math.max(...TOOLBOX_DATA.map((c) => c.tools.length));
    const n = TOOLBOX_DATA.length;
    const rings = [0.33, 0.66, 1].map((f) => {
      const pts = TOOLBOX_DATA.map((_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return `${(cx + Math.cos(a) * maxR * f).toFixed(1)},${(cy + Math.sin(a) * maxR * f).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    }).join('');

    const axes = TOOLBOX_DATA.map((_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * maxR).toFixed(1)}" y2="${(cy + Math.sin(a) * maxR).toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    }).join('');

    const dataPts = TOOLBOX_DATA.map((c, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const ratio = 0.42 + (c.tools.length / maxTools) * 0.58;
      return {
        x: cx + Math.cos(a) * maxR * ratio,
        y: cy + Math.sin(a) * maxR * ratio,
        lx: cx + Math.cos(a) * (maxR + 21),
        ly: cy + Math.sin(a) * (maxR + 18),
        cat: c
      };
    });

    const poly = dataPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const nodes = dataPts.map((p) => {
      const isAct = activeCategory === p.cat.id;
      const short = (TOOLBOX_META[p.cat.id] && TOOLBOX_META[p.cat.id].short) || p.cat.id;
      return `
        <g class="toolbox-radar-node cursor-pointer" data-radar-cat="${p.cat.id}">
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isAct ? 5 : 3.5}" fill="${isAct ? '#C6F135' : '#F3F4F0'}" stroke="#0B0C0B" stroke-width="1.5"/>
          <text x="${p.lx.toFixed(1)}" y="${(p.ly + 3).toFixed(1)}" text-anchor="middle" fill="${isAct ? '#C6F135' : '#9EA59B'}" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="${isAct ? '600' : '500'}">${short}</text>
        </g>`;
    }).join('');

    return `
      <div class="p-3 rounded-xl bg-carbon/65 border border-white/[0.07]">
        <div class="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-widest text-muted mb-1">
          <span>COBERTURA MULTIDISCIPLINAR</span>
          <span class="text-limeTech">CLIQUE NO EIXO</span>
        </div>
        <svg viewBox="0 0 220 196" class="w-full max-w-[230px] mx-auto block" role="img" aria-label="Radar de domínios técnicos">
          ${rings}
          ${axes}
          <polygon points="${poly}" fill="rgba(198,241,53,0.14)" stroke="#C6F135" stroke-width="1.5"/>
          ${nodes}
        </svg>
      </div>`;
  }

  function updateToolboxFilterStates() {
    toolboxFiltersWrap.querySelectorAll('[data-cat-filter]').forEach((b) => {
      const active = b.getAttribute('data-cat-filter') === activeCategory;
      b.setAttribute('aria-pressed', String(active));
      b.className = `toolbox-filter-btn min-h-[38px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-mono text-[11px] tracking-wider uppercase border ${
        active
          ? 'bg-limeTech text-inkDark border-limeTech font-semibold'
          : 'bg-graphite/70 text-muted border-white/10 hover:text-ink hover:border-white/30'
      }`;
    });
  }

  let mobileActiveCatId = TOOLBOX_DATA[0].id;
  let mobileShowAll = false;

  const MOBILE_CAT_LABELS = {
    data: 'Dados & Análise',
    dev: 'Desenvolvimento',
    cloud: 'Nuvem & Infra',
    ai: 'IA Aplicada',
    automation: 'Automação',
    eng: 'Eng. & Hardware'
  };

  function buildMobileDetailBlock(tool) {
    if (!tool) {
      return `
        <div class="pt-2.5 border-t border-white/[0.08] font-mono text-[10.5px] text-muted">
          Toque em uma ferramenta acima para ver contexto e cases vinculados.
        </div>`;
    }
    const linked = tool.projects
      .map((pid) => {
        const idx = PROJECTS.findIndex((p) => p.id === pid);
        return idx >= 0 ? { idx, project: PROJECTS[idx] } : null;
      })
      .filter(Boolean);
    const tierLabel = tool.tier === 'core' ? 'Uso recorrente' : 'Frente específica';

    return `
      <div id="toolbox-mobile-detail" class="pt-3 border-t border-white/10 space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 space-y-0.5">
            <div class="flex flex-wrap items-center gap-2 font-mono text-[9.5px] uppercase tracking-wider">
              <span class="font-semibold text-limeTech">${tool.name}</span>
              <span class="text-muted">· ${tierLabel}</span>
            </div>
            <p class="text-[12.5px] text-ink/85 leading-snug">${tool.context}</p>
          </div>
          <button type="button" data-mob-tool-clear aria-label="Fechar detalhes" class="min-w-[32px] min-h-[32px] rounded-lg bg-carbon border hairline-dark text-muted hover:text-ink inline-flex items-center justify-center shrink-0 font-mono text-xs">×</button>
        </div>
        ${linked.length ? `
          <div class="flex flex-wrap gap-1.5">
            ${linked.map(({ idx, project }) => `
              <button
                type="button"
                data-mobile-open-case="${idx}"
                class="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-carbon border border-limeTech/35 font-mono text-[10px] text-ink hover:border-limeTech"
              >
                <span class="text-limeTech font-semibold">${project.index}</span>
                <span>${project.name.split(' · ')[0]}</span>
                <span class="text-limeTech" aria-hidden="true">↗</span>
              </button>`).join('')}
          </div>` : ''}
      </div>`;
  }

  function renderMobileToolbox() {
    if (!toolboxMobDomains || !toolboxMobStage) return;

    toolboxMobDomains.innerHTML = TOOLBOX_DATA.map((cat) => {
      const meta = TOOLBOX_META[cat.id] || { color: '#C6F135', icon: '' };
      const isAct = !mobileShowAll && cat.id === mobileActiveCatId;
      const label = MOBILE_CAT_LABELS[cat.id] || cat.label;
      return `
        <button
          type="button"
          role="tab"
          aria-selected="${isAct}"
          data-mob-cat="${cat.id}"
          class="min-h-[44px] px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
            isAct
              ? 'bg-graphite text-ink'
              : 'bg-graphite/45 border-white/[0.08] text-muted hover:text-ink'
          }"
          style="${isAct ? `border-color:${meta.color}88; background: color-mix(in srgb, ${meta.color} 10%, #141614);` : ''}"
        >
          <span class="flex items-center gap-2 min-w-0">
            <span class="shrink-0" style="color:${meta.color};" aria-hidden="true">${meta.icon}</span>
            <span class="font-mono text-[10.5px] font-semibold truncate ${isAct ? 'text-ink' : 'text-ink/80'}">${label}</span>
          </span>
          <span class="font-mono text-[9.5px] tabular-nums shrink-0 ${isAct ? 'font-semibold' : 'opacity-65'}" style="${isAct ? `color:${meta.color};` : ''}">${String(cat.tools.length).padStart(2, '0')}</span>
        </button>`;
    }).join('');

    toolboxMobDomains.querySelectorAll('[data-mob-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextId = btn.getAttribute('data-mob-cat');
        mobileShowAll = false;
        mobileActiveCatId = nextId;
        if (selectedTool && selectedTool.categoryId !== nextId) selectedTool = null;
        if (toolboxMobExpandBtn) {
          toolboxMobExpandBtn.setAttribute('aria-expanded', 'false');
          toolboxMobExpandBtn.textContent = `Ver todas (${ALL_TOOLS_FLAT.length}) ↓`;
        }
        renderMobileToolbox();
      });
    });

    const catsToShow = mobileShowAll
      ? TOOLBOX_DATA
      : TOOLBOX_DATA.filter((c) => c.id === mobileActiveCatId);

    const cardsHtml = catsToShow.map((cat) => {
      const meta = TOOLBOX_META[cat.id] || { color: '#C6F135', sub: '', icon: '' };
      const uniqueProjects = new Set(cat.tools.flatMap((t) => t.projects)).size;
      const showInlineDetail = !mobileShowAll;
      const activeToolInCat = selectedTool && selectedTool.categoryId === cat.id ? selectedTool : null;

      return `
        <div
          class="rounded-xl bg-graphite/65 border border-white/[0.08] p-3.5 space-y-3"
          style="border-top: 2px solid ${meta.color}80;"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-mono text-[11px] font-semibold text-ink tracking-wider truncate">${cat.label}</div>
              <p class="text-[11px] text-muted truncate mt-0.5">${meta.sub}</p>
            </div>
            <span class="font-mono text-[9.5px] shrink-0" style="color:${meta.color};">${uniqueProjects} ${uniqueProjects === 1 ? 'CASE' : 'CASES'}</span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            ${cat.tools.map((tool) => {
              const isSel = Boolean(selectedTool && selectedTool.name === tool.name);
              const isCore = tool.tier === 'core';
              return `
                <button
                  type="button"
                  data-mob-tool-cat="${cat.id}"
                  data-mob-tool-name="${tool.name}"
                  data-selected="${isSel}"
                  class="tool-chip min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-carbon/90 border ${isCore ? 'border-white/15' : 'border-white/[0.08]'} font-mono text-[11px] text-ink"
                >
                  <span class="tool-chip__dot w-1.5 h-1.5 rounded-full shrink-0 ${isCore ? 'bg-limeTech' : 'bg-white/30'}" aria-hidden="true"></span>
                  <span>${tool.name}</span>
                </button>`;
            }).join('')}
          </div>

          ${showInlineDetail ? buildMobileDetailBlock(activeToolInCat) : ''}
        </div>`;
    }).join('');

    toolboxMobStage.innerHTML = mobileShowAll
      ? `${selectedTool ? `<div class="mb-3 rounded-xl bg-graphite border border-limeTech/35 px-3.5 pb-3.5">${buildMobileDetailBlock(selectedTool)}</div>` : ''}<div class="space-y-2.5">${cardsHtml}</div>`
      : cardsHtml;

    toolboxMobStage.querySelectorAll('[data-mob-tool-name]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = ALL_TOOLS_FLAT.find(
          (t) => t.categoryId === btn.getAttribute('data-mob-tool-cat') && t.name === btn.getAttribute('data-mob-tool-name')
        );
        if (!found) return;
        selectedTool = selectedTool && selectedTool.name === found.name ? null : found;
        if (selectedTool) renderInspectorTool(selectedTool);
        else renderInspectorDefault(false);
        syncToolboxChipStates();
        renderMobileToolbox();
      });
    });
    toolboxMobStage.querySelectorAll('[data-mob-tool-clear]').forEach((b) => {
      b.addEventListener('click', () => {
        selectedTool = null;
        renderInspectorDefault(false);
        syncToolboxChipStates();
        renderMobileToolbox();
      });
    });
    toolboxMobStage.querySelectorAll('[data-mobile-open-case]').forEach((b) => {
      b.addEventListener('click', () => openCaseModal(Number(b.getAttribute('data-mobile-open-case'))));
    });
  }

  if (toolboxMobExpandBtn) {
    toolboxMobExpandBtn.addEventListener('click', () => {
      mobileShowAll = !mobileShowAll;
      toolboxMobExpandBtn.setAttribute('aria-expanded', String(mobileShowAll));
      toolboxMobExpandBtn.textContent = mobileShowAll
        ? 'Compactar ↑'
        : `Ver todas (${ALL_TOOLS_FLAT.length}) ↓`;
      renderMobileToolbox();
    });
  }

  function selectToolboxCategory(nextCat) {
    if (nextCat === activeCategory) return;
    activeCategory = nextCat;
    updateToolboxFilterStates();
    renderToolboxMatrix(true);
    if (!selectedTool) renderInspectorDefault(false);
  }

  function renderToolboxFilters() {
    const totalTools = ALL_TOOLS_FLAT.length;
    const cats = [
      { id: 'all', label: 'TODOS', count: totalTools, icon: '' },
      ...TOOLBOX_DATA.map((c) => ({
        id: c.id,
        label: c.label,
        count: c.tools.length,
        icon: (TOOLBOX_META[c.id] && TOOLBOX_META[c.id].icon) || ''
      }))
    ];
    toolboxFiltersWrap.innerHTML = cats
      .map((c) => `
        <button type="button" data-cat-filter="${c.id}" aria-pressed="${c.id === activeCategory}">
          ${c.icon ? `<span class="opacity-80 shrink-0" aria-hidden="true">${c.icon}</span>` : ''}
          <span>${c.label}</span>
          <span class="toolbox-filter-count text-[9.5px] opacity-70 tabular-nums">[${String(c.count).padStart(2, '0')}]</span>
        </button>`)
      .join('');
    updateToolboxFilterStates();
    toolboxFiltersWrap.querySelectorAll('[data-cat-filter]').forEach((b) => {
      b.addEventListener('click', () => selectToolboxCategory(b.getAttribute('data-cat-filter')));
    });
  }

  function renderInspectorDefault(animate = false) {
    resetToolBtn.classList.add('hidden');
    const totalTools = ALL_TOOLS_FLAT.length;
    inspectorBody.innerHTML = `
      <div class="${animate && !prefersReducedMotion ? 'iso-detail-enter ' : ''}space-y-4">
        <div class="space-y-1">
          <div class="font-display text-lg font-bold text-ink">Mapa de Relações</div>
          <p class="text-xs text-muted leading-relaxed">Clique em qualquer ferramenta ao lado para inspecionar seu contexto, ver conexões e abrir os cases vinculados.</p>
        </div>
        <div class="hidden sm:block">
          ${buildDomainRadarSVG()}
        </div>
        <div class="grid grid-cols-3 divide-x divide-white/10 border-t hairline-dark pt-4 font-mono text-center">
          <div class="pr-2">
            <div class="font-display text-lg font-bold text-ink">06</div>
            <div class="text-[9.5px] text-muted uppercase">Domínios</div>
          </div>
          <div class="px-2">
            <div class="font-display text-lg font-bold text-ink">${totalTools}</div>
            <div class="text-[9.5px] text-muted uppercase">Ferramentas</div>
          </div>
          <div class="pl-2">
            <div class="font-display text-lg font-bold text-limeTech">${String(PROJECTS.length).padStart(2, '0')}</div>
            <div class="text-[9.5px] text-muted uppercase">Cases</div>
          </div>
        </div>
      </div>`;

    inspectorBody.querySelectorAll('[data-radar-cat]').forEach((node) => {
      node.addEventListener('click', () => {
        const catId = node.getAttribute('data-radar-cat');
        selectToolboxCategory(activeCategory === catId ? 'all' : catId);
      });
    });
  }

  function renderInspectorTool(tool) {
    resetToolBtn.classList.remove('hidden');
    const linked = tool.projects
      .map((pid) => {
        const idx = PROJECTS.findIndex((p) => p.id === pid);
        return idx >= 0 ? { idx, project: PROJECTS[idx] } : null;
      })
      .filter(Boolean);

    const relatedNames = Array.from(findRelatedTools(tool)).slice(0, 6);
    const meta = TOOLBOX_META[tool.categoryId] || { icon: '' };
    const totalPadded = String(PROJECTS.length).padStart(2, '0');
    const tierLabel = tool.tier === 'core' ? 'Uso recorrente' : 'Frente específica';

    inspectorBody.innerHTML = `
      <div class="${!prefersReducedMotion ? 'iso-detail-enter ' : ''}space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1 min-w-0">
            <div class="font-mono text-[10px] text-muted uppercase">${tool.categoryCode} · ${tool.categoryLabel}</div>
            <div class="font-display text-2xl font-bold text-limeTech leading-tight">${tool.name}</div>
          </div>
          <span class="w-9 h-9 rounded-lg bg-limeTech/10 text-limeTech flex items-center justify-center shrink-0" aria-hidden="true">${meta.icon}</span>
        </div>

        <p class="text-sm text-ink/90 leading-relaxed">${tool.context}</p>

        <div class="py-2.5 border-y hairline-dark flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
          <span class="inline-flex items-center gap-1.5 text-ink/80">
            <span class="w-1.5 h-1.5 rounded-full ${tool.tier === 'core' ? 'bg-limeTech' : 'bg-white/35'}"></span>
            <span>${tierLabel}</span>
          </span>
          <span class="text-limeTech font-semibold tabular-nums">${String(linked.length).padStart(2, '0')} / ${totalPadded} CASES</span>
        </div>

        ${relatedNames.length ? `
          <div class="space-y-2">
            <div class="font-mono text-[10px] uppercase tracking-widest text-muted">TRABALHA EM CONJUNTO COM</div>
            <div class="flex flex-wrap gap-1.5">
              ${relatedNames.map((rn) => `
                <button type="button" data-jump-tool="${rn}" class="min-h-[32px] px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-limeTech/15 text-[10.5px] font-mono text-ink/85 hover:text-limeTech transition-colors">
                  ${rn}
                </button>`).join('')}
            </div>
          </div>` : ''}

        <div class="pt-3 border-t hairline-dark space-y-2">
          <div class="font-mono text-[10px] uppercase tracking-widest text-muted">CASES VINCULADOS</div>
          ${linked.map(({ idx, project }) => `
            <button type="button" data-inspector-open-case="${idx}" class="w-full text-left p-3 rounded-xl bg-carbon border hairline-dark hover:border-limeTech transition-colors flex items-center justify-between gap-3 group">
              <div>
                <div class="font-mono text-[10px] text-limeTech">CASE ${project.index} · ${project.shortTag}</div>
                <div class="font-display text-sm font-bold text-ink group-hover:text-limeTech transition-colors">${project.name}</div>
              </div>
              <span class="font-mono text-xs text-muted group-hover:text-limeTech group-hover:translate-x-0.5 transition-all">↗</span>
            </button>`).join('')}
        </div>
      </div>`;

    inspectorBody.querySelectorAll('[data-inspector-open-case]').forEach((b) => {
      b.addEventListener('click', () => openCaseModal(Number(b.getAttribute('data-inspector-open-case'))));
    });
    inspectorBody.querySelectorAll('[data-jump-tool]').forEach((b) => {
      b.addEventListener('click', () => {
        const found = ALL_TOOLS_FLAT.find((t) => t.name === b.getAttribute('data-jump-tool'));
        if (!found) return;
        selectedTool = found;
        if (activeCategory !== 'all' && activeCategory !== found.categoryId) {
          activeCategory = 'all';
          updateToolboxFilterStates();
          renderToolboxMatrix(false);
        }
        renderInspectorTool(selectedTool);
        renderMobileToolbox();
        syncToolboxChipStates();
      });
    });
  }

  function syncToolboxChipStates() {
    const related = findRelatedTools(selectedTool);
    toolboxMatrixWrap.querySelectorAll('[data-tool-name]').forEach((btn) => {
      const name = btn.getAttribute('data-tool-name');
      const isSel = Boolean(selectedTool && selectedTool.name === name);
      const isRel = Boolean(selectedTool && !isSel && related.has(name));
      const isDimmed = Boolean(selectedTool && !isSel && !isRel);
      btn.setAttribute('data-selected', String(isSel));
      btn.setAttribute('data-related', String(isRel));
      btn.setAttribute('data-dimmed', String(isDimmed));
    });
    toolboxMatrixWrap.querySelectorAll('[data-module-card]').forEach((card) => {
      const catId = card.getAttribute('data-module-card');
      const hasSel = Boolean(selectedTool && selectedTool.categoryId === catId);
      card.setAttribute('data-module-active', String(hasSel));
    });
  }

  function renderToolboxMatrix(animate = false) {
    const visibleCats = activeCategory === 'all' ? TOOLBOX_DATA : TOOLBOX_DATA.filter((c) => c.id === activeCategory);
    const related = findRelatedTools(selectedTool);

    toolboxMatrixWrap.innerHTML = visibleCats
      .map((cat, idx) => {
        const meta = TOOLBOX_META[cat.id] || { sub: '', icon: '' };
        const hasSel = Boolean(selectedTool && selectedTool.categoryId === cat.id);
        const uniqueProjects = new Set(cat.tools.flatMap((t) => t.projects)).size;

        return `
        <div
          data-module-card="${cat.id}"
          data-module-active="${hasSel}"
          class="toolbox-module-card rounded-xl md:rounded-2xl bg-graphite/55 border border-white/[0.07] p-3.5 md:p-5 flex flex-col justify-between gap-3 md:gap-4 ${animate && !prefersReducedMotion ? 'filter-card-enter' : ''}"
          style="--filter-delay: ${idx * 45}ms; border-top: 2px solid ${meta.color || '#C6F135'}66;"
        >
          <div class="space-y-3 md:space-y-3.5">
            <div class="flex items-center md:items-start justify-between gap-2.5 md:gap-3 border-b border-white/[0.08] pb-2.5 md:pb-3">
              <div class="flex items-center md:items-start gap-2.5 md:gap-3 min-w-0">
                <span class="toolbox-mod-icon w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0" style="color:${meta.color || '#C6F135'}; background:${meta.color || '#C6F135'}16;" aria-hidden="true">
                  ${meta.icon}
                </span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 font-mono text-[10.5px] md:text-[11px]">
                    <span class="text-ink font-semibold tracking-wider truncate">${cat.label}</span>
                  </div>
                  <p class="hidden md:block text-[11px] text-muted mt-0.5 leading-snug">${meta.sub}</p>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0 font-mono">
                <span class="text-[9.5px] md:text-[10px] font-semibold" style="color:${meta.color || '#C6F135'};">${cat.code}</span>
                <span class="hidden md:block toolbox-mod-led w-1.5 h-1.5 rounded-full"></span>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              ${cat.tools.map((tool) => {
                const isSel = Boolean(selectedTool && selectedTool.name === tool.name);
                const isRel = Boolean(selectedTool && !isSel && related.has(tool.name));
                const isDimmed = Boolean(selectedTool && !isSel && !isRel);
                const isCore = tool.tier === 'core';
                return `
                  <button
                    type="button"
                    data-tool-cat="${cat.id}"
                    data-tool-name="${tool.name}"
                    data-selected="${isSel}"
                    data-related="${isRel}"
                    data-dimmed="${isDimmed}"
                    class="tool-chip min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon/90 border ${isCore ? 'border-white/15' : 'border-white/[0.08]'} font-mono text-[11px] md:text-xs text-ink hover:border-limeTech/70"
                  >
                    <span class="tool-chip__dot w-1.5 h-1.5 rounded-full shrink-0 ${isCore ? 'bg-limeTech' : 'bg-white/30'}" aria-hidden="true"></span>
                    <span>${tool.name}</span>
                    <span class="hidden md:inline tool-chip__count text-[9.5px] opacity-55 tabular-nums">·${tool.projects.length}</span>
                  </button>`;
              }).join('')}
            </div>
          </div>

          <div class="hidden md:flex pt-2.5 border-t border-white/[0.07] items-center justify-between font-mono text-[9.5px] text-muted uppercase tracking-wider">
            <span>${String(cat.tools.length).padStart(2, '0')} ITENS</span>
            <span class="text-ink/80">${uniqueProjects} ${uniqueProjects === 1 ? 'CASE' : 'CASES'}</span>
          </div>
        </div>`;
      })
      .join('');

    toolboxMatrixWrap.querySelectorAll('[data-tool-name]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = ALL_TOOLS_FLAT.find(
          (t) => t.categoryId === btn.getAttribute('data-tool-cat') && t.name === btn.getAttribute('data-tool-name')
        );
        if (!found) return;
        if (selectedTool && selectedTool.name === found.name) {
          selectedTool = null;
          renderInspectorDefault(true);
        } else {
          selectedTool = found;
          renderInspectorTool(selectedTool);
        }
        renderMobileToolbox();
        syncToolboxChipStates();
      });
    });
  }

  resetToolBtn.addEventListener('click', () => {
    selectedTool = null;
    renderInspectorDefault(true);
    renderMobileToolbox();
    syncToolboxChipStates();
  });

  renderToolboxFilters();
  renderInspectorDefault(false);
  renderToolboxMatrix(false);
  renderMobileToolbox();

  /* ==========================================================================
     17b. MATRIZ ACADÊMICA INTERATIVA (SEM BARRAS DE PROFICIÊNCIA)
     ========================================================================== */
  (function initDifferentialsMatrix() {
    const shell = document.getElementById('diff-matrix-shell');
    const grid = document.getElementById('diff-matrix-grid');
    const eyebrowEl = document.getElementById('diff-matrix-eyebrow');
    const tagEl = document.getElementById('diff-matrix-tag');
    const progressEl = document.getElementById('diff-matrix-progress');
    if (!shell || !grid) return;

    const modeBtns = Array.from(shell.querySelectorAll('[data-diff-mode]'));
    const MODE_ORDER = ['base', 'hard', 'soft'];
    const CYCLE_MS = 5500;

    const MODES = {
      base: {
        eyebrow: 'BASE // FORMAÇÃO & PRÁTICA',
        tag: 'TEORIA → PRÁTICA',
        items: [
          { cat: 'ENGENHARIA', title: 'Controle & Automação', sub: 'UFOP · Escola de Minas', color: '#C6F135' },
          { cat: 'TÉCNICO', title: 'Automação Industrial', sub: 'IFMG · CLP & Bancada', color: '#F59E0B' },
          { cat: 'INOVAÇÃO', title: 'Hardware, Web & IA', sub: 'Bitmind · RIW · AgTech', color: '#38BDF8' },
          { cat: 'OPERACIONAL', title: 'Indústria & Dados', sub: 'Actech · Expedição', color: '#A78BFA' }
        ]
      },
      hard: {
        eyebrow: 'COMPETÊNCIAS // TÉCNICAS',
        tag: 'FERRAMENTAS APLICADAS',
        items: [
          { cat: 'DADOS & ETL', title: 'Power Query & Excel', sub: 'TPV · 8 KPIs · Dashboards', color: '#F59E0B' },
          { cat: 'WEB & NUVEM', title: 'Web, Firebase & R2', sub: 'HTML · CSS · JS · APIs', color: '#38BDF8' },
          { cat: 'AUTOMAÇÃO & IA', title: 'Gemini & Automate', sub: 'Apps Script · Fluxos', color: '#C6F135' },
          { cat: 'HARDWARE', title: 'Arduino, ESP32 & CLP', sub: 'Sensores · Bancada', color: '#34D399' }
        ]
      },
      soft: {
        eyebrow: 'COMPETÊNCIAS // ATUAÇÃO',
        tag: 'ROTINA & EQUIPE',
        items: [
          { cat: 'EQUIPE', title: 'Trabalho em Equipe', sub: 'Bitmind · Bitmindop', color: '#C6F135' },
          { cat: 'COMUNICAÇÃO', title: 'Pitch & Procedimentos', sub: 'RIW · Treinamentos', color: '#38BDF8' },
          { cat: 'VISÃO DE PROCESSO', title: 'Ponta a Ponta', sub: 'Chão de fábrica → nuvem', color: '#F59E0B' },
          { cat: 'ORGANIZAÇÃO', title: 'Rotina & Padrão', sub: 'Qualyteam · Actech', color: '#A78BFA' }
        ]
      }
    };

    let currentIdx = 0;
    let elapsedMs = 0;
    let isPointerHover = false;
    let inView = false;
    let hasAnimatedEntrance = false;

    function syncProgressBar() {
      if (!progressEl) return;
      if (prefersReducedMotion) {
        progressEl.style.transform = 'scaleX(1)';
        return;
      }
      const ratio = clamp(elapsedMs / CYCLE_MS, 0, 1);
      progressEl.style.transform = `scaleX(${ratio.toFixed(4)})`;
    }

    function renderMode(modeKey, animate = true) {
      const data = MODES[modeKey];
      if (!data) return;
      currentIdx = MODE_ORDER.indexOf(modeKey);
      elapsedMs = 0;
      if (eyebrowEl) eyebrowEl.textContent = data.eyebrow;
      if (tagEl) tagEl.textContent = data.tag;

      modeBtns.forEach((btn) => {
        const active = btn.getAttribute('data-diff-mode') === modeKey;
        btn.setAttribute('data-active', String(active));
        btn.setAttribute('aria-selected', String(active));
      });

      grid.innerHTML = data.items
        .map(
          (item, idx) => `
          <div
            class="diff-tile ${animate && !prefersReducedMotion ? 'is-entering ' : ''}h-full min-h-[96px] flex flex-col justify-between gap-2 p-3 rounded-lg bg-carbon border hairline-dark"
            style="border-top:2px solid ${item.color}; --diff-delay:${idx * 55}ms;"
          >
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-1 font-mono text-[9px] uppercase tracking-wider" style="color:${item.color};">
                <span class="truncate font-semibold">${item.cat}</span>
                <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${item.color};"></span>
              </div>
              <div class="font-display text-[12.5px] font-bold text-ink leading-snug">${item.title}</div>
            </div>
            <div class="font-mono text-[9.5px] text-muted truncate">${item.sub}</div>
          </div>`
        )
        .join('');

      syncProgressBar();
    }

    const cycleLoop = createLoop((dt) => {
      if (prefersReducedMotion || !inView || document.hidden || isPointerHover) return;
      elapsedMs += dt;
      if (elapsedMs >= CYCLE_MS) {
        const nextMode = MODE_ORDER[(currentIdx + 1) % MODE_ORDER.length];
        renderMode(nextMode, true);
      } else {
        syncProgressBar();
      }
    });

    modeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e.detail > 0) btn.blur();
        isPointerHover = false;
        renderMode(btn.getAttribute('data-diff-mode'), true);
        if (!prefersReducedMotion && inView && !cycleLoop.running) cycleLoop.start();
      });
    });

    if (isFinePointer && canHover) {
      shell.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') isPointerHover = true;
      });
      shell.addEventListener('pointerleave', () => {
        isPointerHover = false;
      });
    }

    bindVisibility(shell, (visible) => {
      inView = visible;
      if (visible) {
        isPointerHover = false;
        elapsedMs = 0;
        if (!hasAnimatedEntrance) {
          hasAnimatedEntrance = true;
          renderMode(MODE_ORDER[currentIdx], true);
        } else {
          syncProgressBar();
        }
        if (!prefersReducedMotion) cycleLoop.start();
      } else {
        cycleLoop.stop();
      }
    }, '0px');

    renderMode('base', false);
  })();

  /* ==========================================================================
     18. PRINCÍPIOS — CARROSSEL ORBITAL 3D RESTAURADO (10 PENSADORES)
     ========================================================================== */
  (function initPrinciplesCarousel() {
    const wrap = document.getElementById('principles-orbit-wrap');
    const stage = document.getElementById('principles-wheel-stage');
    const authorRail = document.getElementById('principles-author-rail');
    const compassRing = document.getElementById('principles-compass-ring');
    const liveCounter = document.getElementById('principles-live-counter');
    const progressFill = document.getElementById('principles-progress-fill');
    const prevBtn = document.getElementById('principles-prev-btn');
    const nextBtn = document.getElementById('principles-next-btn');
    if (!wrap || !stage || !PRINCIPLES.length) return;

    const total = PRINCIPLES.length;
    const AUTO_MS = 6000;
    let activeIdx = 0;
    let rotTurns = 0;
    let elapsedMs = 0;
    let isHoverPaused = false;
    let isKeyboardFocused = false;
    let inView = false;

    const isPaused = () => isHoverPaused || isKeyboardFocused;
    const syncPausedAttr = () => wrap.setAttribute('data-paused', String(isPaused()));

    function syncProgressBar() {
      if (!progressFill) return;
      if (prefersReducedMotion) {
        progressFill.style.transform = 'scaleX(1)';
        return;
      }
      const ratio = clamp(elapsedMs / AUTO_MS, 0, 1);
      progressFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
    }

    stage.innerHTML = PRINCIPLES.map(
      (item, idx) => `
        <article
          class="principle-slide"
          data-slide-idx="${idx}"
          data-pos="hidden"
          style="--p-accent:${item.accent};"
          aria-hidden="${idx !== 0}"
        >
          <div class="flex items-center justify-between gap-3 border-b hairline-dark pb-3.5 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.14em]">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${item.accent};"></span>
              <span class="font-semibold truncate" style="color:${item.accent};">${item.discipline} · ${item.theme}</span>
            </div>
            <span class="text-muted tabular-nums shrink-0">${item.index} / ${String(total).padStart(2, '0')}</span>
          </div>

          <blockquote class="space-y-4 my-auto">
            <p class="principle-quote-text text-ink">${item.quote}</p>
            <footer class="flex flex-wrap items-baseline justify-between gap-2 pt-1">
              <span class="font-mono text-xs sm:text-[13px] tracking-wider uppercase font-semibold" style="color:${item.accent};">
                — ${item.author}
              </span>
              <span class="font-mono text-[10px] text-muted uppercase tracking-wider">
                ${item.role}
              </span>
            </footer>
          </blockquote>

          <div class="pt-3.5 border-t hairline-dark grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline">
            <div class="sm:col-span-3 font-mono text-[9.5px] uppercase tracking-widest text-muted">
              NOTA // LR
            </div>
            <p class="sm:col-span-9 text-xs sm:text-[13.5px] text-ink/82 leading-relaxed">
              ${item.note}
            </p>
          </div>
        </article>`
    ).join('');

    if (authorRail) {
      authorRail.innerHTML = PRINCIPLES.map(
        (item, idx) => `
          <button
            type="button"
            role="tab"
            aria-selected="${idx === 0}"
            data-principle-pill="${idx}"
            data-active="${idx === 0}"
            style="--pill-accent:${item.accent};"
            class="principle-pill min-h-[38px] shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-graphite/70 border hairline-dark font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink"
          >
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${item.accent};"></span>
            <span>${item.author.split(' ').slice(-1)[0]}</span>
          </button>`
      ).join('');
    }

    const slides = Array.from(stage.querySelectorAll('[data-slide-idx]'));
    const pills = authorRail ? Array.from(authorRail.querySelectorAll('[data-principle-pill]')) : [];

    function updatePositions(nextIdx, dirHint = 0) {
      const prevIdx = activeIdx;
      const targetIdx = (nextIdx + total) % total;

      let delta = targetIdx - prevIdx;
      if (dirHint !== 0) {
        delta = dirHint;
      } else {
        if (delta > total / 2) delta -= total;
        if (delta < -total / 2) delta += total;
      }
      rotTurns += delta;
      activeIdx = targetIdx;
      elapsedMs = 0;

      const cur = PRINCIPLES[activeIdx];
      if (liveCounter) {
        liveCounter.textContent = `${cur.index} / ${String(total).padStart(2, '0')}`;
        liveCounter.style.color = cur.accent;
      }
      if (compassRing && !prefersReducedMotion) {
        compassRing.style.transform = `rotate(${(rotTurns * (360 / total)).toFixed(1)}deg)`;
      }
      if (progressFill) {
        progressFill.style.setProperty('--p-accent', cur.accent);
      }

      slides.forEach((slide, i) => {
        let rel = (i - activeIdx + total) % total;
        if (rel > total / 2) rel -= total;

        let pos = 'hidden';
        if (rel === 0) pos = 'center';
        else if (rel === -1) pos = 'left';
        else if (rel === 1) pos = 'right';
        else if (rel === -2) pos = 'far-left';
        else if (rel === 2) pos = 'far-right';

        slide.setAttribute('data-pos', pos);
        slide.setAttribute('aria-hidden', String(pos !== 'center'));
      });

      pills.forEach((pill, i) => {
        const isAct = i === activeIdx;
        pill.setAttribute('data-active', String(isAct));
        pill.setAttribute('aria-selected', String(isAct));
      });

      syncProgressBar();
    }

    // Relógio único sincronizado (barra GPU scaleX + troca de slide nunca dessincronizam nem travam)
    const cycleLoop = createLoop((dt) => {
      if (prefersReducedMotion || !inView || document.hidden || isPaused()) return;
      elapsedMs += dt;
      if (elapsedMs >= AUTO_MS) {
        updatePositions(activeIdx + 1, 1);
      } else {
        syncProgressBar();
      }
    });

    function step(dir) {
      updatePositions(activeIdx + dir, dir);
      if (!prefersReducedMotion && inView && !cycleLoop.running) cycleLoop.start();
    }

    slides.forEach((slide) => {
      slide.addEventListener('click', () => {
        const pos = slide.getAttribute('data-pos');
        if (pos === 'left') step(-1);
        else if (pos === 'right') step(1);
      });
    });

    pills.forEach((pill) => {
      pill.addEventListener('click', (e) => {
        if (e.detail > 0) pill.blur(); // Clique de mouse/toque não prende focusin
        isKeyboardFocused = false;
        syncPausedAttr();
        const idx = Number(pill.getAttribute('data-principle-pill'));
        if (idx === activeIdx) return;
        updatePositions(idx, 0);
        if (!prefersReducedMotion && inView && !cycleLoop.running) cycleLoop.start();
      });
    });

    if (prevBtn) prevBtn.addEventListener('click', (e) => { if (e.detail > 0) prevBtn.blur(); step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { if (e.detail > 0) nextBtn.blur(); step(1); });

    // Pausa com cursor do mouse mantida — mas nunca trava no toque ou após clique
    if (isFinePointer && canHover) {
      wrap.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        isHoverPaused = true;
        syncPausedAttr();
      });
      wrap.addEventListener('pointerleave', (e) => {
        if (e.pointerType !== 'mouse') return;
        isHoverPaused = false;
        syncPausedAttr();
      });
    }
    wrap.addEventListener('focusin', (e) => {
      if (e.target && e.target.matches && e.target.matches(':focus-visible')) {
        isKeyboardFocused = true;
        syncPausedAttr();
      }
    });
    wrap.addEventListener('focusout', (e) => {
      if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) {
        isKeyboardFocused = false;
        syncPausedAttr();
      }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    stage.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (!e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        step(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    bindVisibility(wrap, (visible) => {
      inView = visible;
      if (visible) {
        // Limpa estado preso ao chegar na seção (só pausa se o cursor realmente estiver sobre o bloco)
        isHoverPaused = Boolean(isFinePointer && canHover && wrap.matches(':hover'));
        isKeyboardFocused = false;
        syncPausedAttr();
        if (elapsedMs >= AUTO_MS * 0.92) elapsedMs = 0;
        syncProgressBar();
        if (!prefersReducedMotion) cycleLoop.start();
      } else {
        isHoverPaused = false;
        syncPausedAttr();
        cycleLoop.stop();
      }
    }, '80px');

    updatePositions(0, 0);
  })();

  /* ==========================================================================
     19. CENTRAL DE CONTATO — CÓPIA DE E-MAIL E RESUMO TÉCNICO DINÂMICO
     ========================================================================== */
  function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    } catch {
      return Promise.resolve(false);
    }
  }

  function triggerCopyEmail(labelEl, resetText = 'Copiar e-mail') {
    const email = 'contato@luizrioga.com';
    copyTextToClipboard(email).then((copied) => {
      if (copied) {
        if (labelEl) labelEl.textContent = 'Copiado ✓';
        showToast('contato@luizrioga.com copiado.');
        setTimeout(() => { if (labelEl) labelEl.textContent = resetText; }, 2200);
      } else {
        showToast('contato@luizrioga.com');
      }
    });
  }

  const copyEmailBtn = document.getElementById('copy-email-btn');
  const copyEmailLabel = document.getElementById('copy-email-label');
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', () => triggerCopyEmail(copyEmailLabel, 'Copiar e-mail'));
  }

  const mobileCopyEmailBtn = document.getElementById('mobile-copy-email-btn');
  if (mobileCopyEmailBtn) {
    mobileCopyEmailBtn.addEventListener('click', () => triggerCopyEmail(mobileCopyEmailBtn, 'Copiar e-mail'));
  }

  const copySummaryBtn = document.getElementById('copy-summary-btn');
  const copySummaryLabel = document.getElementById('copy-summary-label');
  if (copySummaryBtn) {
    const casesListText = PROJECTS
      .map((p) => `${p.index}) ${p.name}`)
      .join('; ');
    const RECRUITER_BRIEF = [
      'LUIZ RIOGA — Engenharia de Controle e Automação (UFOP · Escola de Minas — 4 de 10 períodos concluídos · 5º em curso) | Técnico em Automação Industrial (IFMG · Estudante Destaque 2023)',
      'Experiência: 2+ anos na Actech — Jovem Aprendiz (Jun/2024–Dez/2025) e Estagiário de Embalagem & Expedição (Fev/2026–atual).',
      `Cases documentados (${String(PROJECTS.length).padStart(2, '0')}): ${casesListText}.`,
      'Disponibilidade: aberto a novos projetos, estágios e propostas (remoto ou híbrido a partir de Ouro Preto/MG).',
      'Portfólio: https://luizrioga.com | Contato: contato@luizrioga.com | LinkedIn: https://www.linkedin.com/in/luiz-rioga/ | GitHub: https://github.com/luizrioga'
    ].join('\n');

    copySummaryBtn.addEventListener('click', () => {
      copyTextToClipboard(RECRUITER_BRIEF).then((copied) => {
        if (copied) {
          if (copySummaryLabel) copySummaryLabel.textContent = 'Resumo copiado ✓';
          showToast('Resumo técnico e contatos copiados.');
          setTimeout(() => { if (copySummaryLabel) copySummaryLabel.textContent = 'Copiar Resumo'; }, 2400);
        } else {
          showToast('contato@luizrioga.com');
        }
      });
    });
  }

  /* ==========================================================================
     20. GALERIA 3D ANIMADA DE CERTIFICADOS (DUAS LINHAS SEMPRE ATIVAS)
     ========================================================================== */
  (function initCertificatesCarousel3D() {
    const viewport = document.getElementById('certs-3d-viewport');
    const plane = document.getElementById('certs-3d-plane');
    const topTrack = document.getElementById('certs-track-top');
    const bottomTrack = document.getElementById('certs-track-bottom');
    const toggleBtn = document.getElementById('certs-play-toggle');
    const toggleLabel = document.getElementById('certs-play-label');
    const toggleDot = document.getElementById('certs-play-dot');
    if (!viewport || !plane || !topTrack || !bottomTrack) return;

    function buildCard(cert, isClone) {
      return `
        <article
          class="cert-card"
          ${isClone ? 'aria-hidden="true"' : ''}
        >
          <div class="cert-card__meta">
            <span class="cert-card__code">${cert.code}</span>
            <span class="cert-card__year">${cert.year}</span>
          </div>
          <div class="cert-card__thumb">
            <img src="${cert.src}" alt="Certificado ${cert.title}" loading="lazy" decoding="async" />
          </div>
          <div class="cert-card__body">
            <h4 class="cert-card__title">${cert.title}</h4>
            <p class="cert-card__sub">${cert.sub}</p>
          </div>
        </article>`;
    }

    function populateTrack(trackEl, list) {
      if (!list.length) return 0;
      if (prefersReducedMotion) {
        trackEl.innerHTML = list.map((c) => buildCard(c, false)).join('');
        return 0;
      }
      trackEl.innerHTML =
        list.map((c) => buildCard(c, false)).join('') +
        list.map((c) => buildCard(c, true)).join('') +
        list.map((c) => buildCard(c, true)).join('');
      return list.length;
    }

    let topHalfCount = 0;
    let botHalfCount = 0;

    function mountCertificates(allCerts) {
      if (!Array.isArray(allCerts) || !allCerts.length) return;
      const splitIdx = Math.ceil(allCerts.length / 2);
      const topList = allCerts.slice(0, splitIdx);
      const botList = allCerts.length > 1 ? allCerts.slice(splitIdx) : topList;
      topHalfCount = populateTrack(topTrack, topList);
      botHalfCount = populateTrack(bottomTrack, botList);
    }

    mountCertificates(CERTIFICATES);

    let userPaused = false;
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        userPaused = viewport.getAttribute('data-paused') !== 'true';
        viewport.setAttribute('data-paused', String(userPaused));
        toggleBtn.setAttribute('aria-pressed', String(userPaused));
        if (toggleLabel) toggleLabel.textContent = userPaused ? 'Retomar 3D' : 'Pausar 3D';
        if (toggleDot) {
          toggleDot.classList.toggle('bg-limeTech', !userPaused);
          toggleDot.classList.toggle('bg-muted', userPaused);
        }
      });
    }

    let activeCardEl = null;
    function setCardFocus(card) {
      if (activeCardEl === card) return;
      if (activeCardEl) activeCardEl.classList.remove('is-cert-active');
      activeCardEl = card;
      if (activeCardEl) {
        activeCardEl.classList.add('is-cert-active');
        viewport.classList.add('is-card-focused');
      } else {
        viewport.classList.remove('is-card-focused');
      }
    }

    if (isFinePointer && canHover) {
      viewport.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const card = e.target.closest('.cert-card');
        if (card) setCardFocus(card);
      });
      viewport.addEventListener('pointerout', (e) => {
        if (e.pointerType !== 'mouse') return;
        const related = e.relatedTarget;
        const nextCard = related && related.closest ? related.closest('.cert-card') : null;
        if (!nextCard || !viewport.contains(nextCard)) setCardFocus(null);
      });
    }
    viewport.addEventListener('focusin', (e) => {
      const card = e.target.closest('.cert-card');
      if (card) setCardFocus(card);
    });
    viewport.addEventListener('focusout', (e) => {
      const related = e.relatedTarget;
      const nextCard = related && related.closest ? related.closest('.cert-card') : null;
      if (!nextCard || !viewport.contains(nextCard)) setCardFocus(null);
    });

    if (prefersReducedMotion) return;

    viewport.classList.add('is-js-driven');
    const topRow = topTrack.parentElement;
    const botRow = bottomTrack.parentElement;

    let topPeriod = 1800;
    let botPeriod = 1500;
    let topX = 0;
    let botX = -botPeriod * 0.5;

    function measurePeriods() {
      const tFirst = topTrack.children[0];
      const tMid = topTrack.children[topHalfCount];
      if (tFirst && tMid) {
        const w = tMid.offsetLeft - tFirst.offsetLeft;
        if (w > 100) topPeriod = w;
      }
      const bFirst = bottomTrack.children[0];
      const bMid = bottomTrack.children[botHalfCount];
      if (bFirst && bMid) {
        const w = bMid.offsetLeft - bFirst.offsetLeft;
        if (w > 100) botPeriod = w;
      }
      topX = ((topX % topPeriod) - topPeriod) % topPeriod;
      botX = ((botX % botPeriod) - botPeriod) % botPeriod;
    }

    let topRowHovered = false;
    let botRowHovered = false;
    if (isFinePointer && canHover) {
      if (topRow) {
        topRow.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') topRowHovered = true; });
        topRow.addEventListener('pointerleave', () => { topRowHovered = false; });
      }
      if (botRow) {
        botRow.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') botRowHovered = true; });
        botRow.addEventListener('pointerleave', () => { botRowHovered = false; });
      }
    }

    const getPlaneBase = () => (window.innerWidth <= 768
      ? { rx: 5.5, ry: -6, rz: -1.4, sc: 1.02 }
      : { rx: 9, ry: -11, rz: -2.2, sc: 1.04 });
    let base = getPlaneBase();
    let ptrRx = 0, ptrRy = 0;
    let curRx = base.rx, curRy = base.ry;

    if (isFinePointer && canHover) {
      viewport.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const rect = viewport.getBoundingClientRect();
        const nx = clamp((e.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
        const ny = clamp((e.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
        ptrRx = -ny * 6.5;
        ptrRy = nx * 8;
      });
      viewport.addEventListener('pointerleave', () => {
        ptrRx = 0;
        ptrRy = 0;
      });
    }

    const BASE_TOP_SPEED = 34;
    const BASE_BOT_SPEED = 30;
    let scrollBoost = 0;
    let scrollLean = 0;
    let playMul = 1;
    let topHoverMul = 1;
    let botHoverMul = 1;

    const loop = createLoop((dt) => {
      const dtSec = dt / 1000;
      const vel = readScrollVelocity();

      const targetBoost = clamp(Math.abs(vel) * 2.15, 0, 3.8);
      const boostRate = targetBoost > scrollBoost ? 0.018 : 0.0042;
      scrollBoost += (targetBoost - scrollBoost) * (1 - Math.exp(-dt * boostRate));

      const targetLean = clamp(vel * 1.45, -2.4, 2.4);
      scrollLean += (targetLean - scrollLean) * (1 - Math.exp(-dt * 0.007));

      const brakeK = 1 - Math.exp(-dt * 0.009);
      playMul += ((userPaused ? 0 : 1) - playMul) * brakeK;
      topHoverMul += ((topRowHovered ? 0 : 1) - topHoverMul) * brakeK;
      botHoverMul += ((botRowHovered ? 0 : 1) - botHoverMul) * brakeK;

      const speedFactor = (1 + scrollBoost) * playMul;
      const topStep = BASE_TOP_SPEED * speedFactor * topHoverMul * dtSec;
      const botStep = BASE_BOT_SPEED * speedFactor * botHoverMul * dtSec;

      if (topStep > 0.001) {
        topX -= topStep;
        if (topX <= -topPeriod) topX += topPeriod;
        topTrack.style.transform = `translate3d(${topX.toFixed(2)}px, 0, 0)`;
      }
      if (botStep > 0.001) {
        botX += botStep;
        if (botX >= 0) botX -= botPeriod;
        bottomTrack.style.transform = `translate3d(${botX.toFixed(2)}px, 0, 0)`;
      }

      const tiltK = 1 - Math.exp(-dt * 0.0065);
      const tgtRx = base.rx + ptrRx + scrollLean;
      const tgtRy = base.ry + ptrRy;
      curRx += (tgtRx - curRx) * tiltK;
      curRy += (tgtRy - curRy) * tiltK;
      plane.style.transform = `rotateX(${curRx.toFixed(2)}deg) rotateY(${curRy.toFixed(2)}deg) rotateZ(${base.rz}deg) scale(${base.sc})`;
    });

    const onResize = () => {
      base = getPlaneBase();
      measurePeriods();
    };
    new ResizeObserver(onResize).observe(viewport);
    measurePeriods();
    topTrack.style.transform = `translate3d(${topX.toFixed(2)}px, 0, 0)`;
    bottomTrack.style.transform = `translate3d(${botX.toFixed(2)}px, 0, 0)`;

    bindVisibility(viewport, (visible) => (visible ? loop.start() : loop.stop()), '80px');
  })();

  /* ==========================================================================
     21. SEGREDOS INTERATIVOS & RECOMPENSA DE EXPLORAÇÃO (100% PT-BR)
     ========================================================================== */
  (function initExplorerEasterEggs() {
    const rewardBtn = document.getElementById('explorer-reward-btn');
    const pillLabel = document.getElementById('explorer-pill-label');
    const modal = document.getElementById('explorer-modal');
    const modalBody = document.getElementById('explorer-modal-body');
    const modalClose = document.getElementById('explorer-modal-close');
    const brandLink = document.getElementById('top-brand-link');
    const coordsBtn = document.getElementById('outside-coords-trigger');
    const hudChip = document.getElementById('blueprint-hud-chip');
    const hudReadout = document.getElementById('blueprint-hud-readout');
    const hudOffBtn = document.getElementById('blueprint-hud-off');
    if (!rewardBtn || !modal || !modalBody) return;

    const startTime = Date.now();
    const visitedSections = new Set(['intro']);
    const openedCases = new Set();
    const secrets = {
      blueprint: false,
      orbit: false,
      serra: false
    };
    let reachedEndOnce = false;
    let blueprintActive = false;

    function countSecrets() {
      return Object.values(secrets).filter(Boolean).length;
    }

    function updatePill() {
      const found = countSecrets();
      if (pillLabel) {
        pillLabel.textContent = found === 3
          ? 'ACESSO MÁXIMO · 3/3 ★'
          : `SINAL DECODIFICADO · ${found}/3`;
      }
      rewardBtn.classList.toggle('is-unlocked', reachedEndOnce || found > 0);
    }

    function launchOrbitalBurst(originX = window.innerWidth * 0.5, originY = window.innerHeight * 0.45) {
      if (prefersReducedMotion) return;
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:120;';
      const dpr = capDPR(2);
      c.width = Math.floor(window.innerWidth * dpr);
      c.height = Math.floor(window.innerHeight * dpr);
      document.body.appendChild(c);
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);

      const colors = ['#C6F135', '#38BDF8', '#F59E0B', '#F3F4F0'];
      const parts = Array.from({ length: 48 }, (_, i) => {
        const ang = (Math.PI * 2 * i) / 48 + (Math.random() - 0.5) * 0.25;
        const spd = 120 + Math.random() * 260;
        return {
          x: originX,
          y: originY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 45,
          size: 2 + Math.random() * 2.8,
          color: colors[i % colors.length],
          life: 0,
          max: 0.9 + Math.random() * 0.55
        };
      });

      let last = performance.now();
      function step(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        let alive = 0;
        parts.forEach((p) => {
          p.life += dt;
          if (p.life >= p.max) return;
          alive++;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 240 * dt;
          p.vx *= 0.98;
          const alpha = 1 - p.life / p.max;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        if (alive > 0) requestAnimationFrame(step);
        else c.remove();
      }
      requestAnimationFrame(step);
    }

    function updateBlueprintHudReadout() {
      if (!blueprintActive || !hudReadout) return;
      const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = Math.round((window.scrollY / docH) * 100);
      hudReadout.textContent = `MODO PLANTA · ${window.innerWidth}×${window.innerHeight} · ${pct}%`;
    }

    function setBlueprintMode(enabled) {
      blueprintActive = Boolean(enabled);
      document.body.classList.toggle('blueprint-mode', blueprintActive);
      if (hudChip) hudChip.classList.toggle('hidden', !blueprintActive);
      if (blueprintActive) {
        secrets.blueprint = true;
        updateBlueprintHudReadout();
        updatePill();
      }
    }

    window.addEventListener('scroll', updateBlueprintHudReadout, { passive: true });
    window.addEventListener('resize', updateBlueprintHudReadout, { passive: true });
    if (hudOffBtn) {
      hudOffBtn.addEventListener('click', () => {
        setBlueprintMode(false);
        showToast('Modo Planta desativado.');
      });
    }

    function unlockSecret(key, msg, burstX, burstY) {
      const isNew = !secrets[key];
      secrets[key] = true;
      updatePill();
      showToast(msg);
      launchOrbitalBurst(burstX, burstY);
      if (modal.getAttribute('data-open') === 'true') renderExplorerModal();
      return isNew;
    }

    const trackIds = ['intro', 'thinking', 'works', 'experience', 'academic', 'toolbox', 'principles', 'outside', 'connect'];
    if ('IntersectionObserver' in window) {
      const secObs = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const id = en.target.id;
          if (id) visitedSections.add(id);
          if (id === 'connect' && !reachedEndOnce) {
            reachedEndOnce = true;
            updatePill();
          }
        });
      }, { threshold: 0.25 });
      trackIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) secObs.observe(el);
      });
    }

    window.addEventListener('portfolio:case-opened', (e) => {
      if (e.detail && e.detail.id) openedCases.add(e.detail.id);
    });

    if (brandLink) {
      let tapCount = 0;
      let tapTimer = null;
      brandLink.addEventListener('click', (e) => {
        tapCount++;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { tapCount = 0; }, 1400);
        if (tapCount >= 5) {
          e.preventDefault();
          tapCount = 0;
          setBlueprintMode(!blueprintActive);
          unlockSecret(
            'blueprint',
            blueprintActive ? 'SEGREDO 1/3 · Modo Planta ativado!' : 'Modo Planta desativado.',
            120,
            40
          );
        }
      });
    }

    let keyBuf = '';
    const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIdx = 0;
    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key;
      if (k === konami[konamiIdx] || k.toLowerCase() === konami[konamiIdx]) {
        konamiIdx++;
        if (konamiIdx === konami.length) {
          konamiIdx = 0;
          unlockSecret('orbit', 'SEGREDO 2/3 · Transmissão orbital desbloqueada!');
          return;
        }
      } else {
        konamiIdx = k === konami[0] ? 1 : 0;
      }

      if (k.length === 1 && /[a-z]/i.test(k)) {
        keyBuf = (keyBuf + k.toLowerCase()).slice(-8);
        if (keyBuf.endsWith('orbit') || keyBuf.endsWith('iris')) {
          keyBuf = '';
          unlockSecret('orbit', 'SEGREDO 2/3 · Código Bitmind decodificado!');
        }
      }
    });

    if (coordsBtn) {
      coordsBtn.addEventListener('click', (e) => {
        const rect = coordsBtn.getBoundingClientRect();
        unlockSecret(
          'serra',
          'SEGREDO 3/3 · 20°23\'08"S 43°30\'13"W · Ouro Preto validado!',
          rect.left + rect.width * 0.5,
          rect.top
        );
      });
    }

    function formatElapsed() {
      const sec = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return `${m}:${s}`;
    }

    function renderExplorerModal() {
      const secCount = Math.min(8, Math.max(1, visitedSections.size - (visitedSections.has('intro') ? 1 : 0)));
      const found = countSecrets();
      const totalCasesPadded = String(PROJECTS.length).padStart(2, '0');
      const badgeTitle = found === 3
        ? 'Explorador Completo · Nível Máximo'
        : reachedEndOnce
          ? 'Leitura Completa · Fim da Jornada'
          : 'Explorador em Rota';

      const secretRows = [
        { ok: secrets.blueprint, code: 'SEG.01', title: 'Modo Planta (Grade Técnica)', hint: 'Clique 5× rápido em "LUIZ RIOGA" no topo.' },
        { ok: secrets.orbit, code: 'SEG.02', title: 'Transmissão Orbital', hint: 'Digite IRIS no teclado (ou use a sequência de setas).' },
        { ok: secrets.serra, code: 'SEG.03', title: 'Coordenadas da Serra', hint: 'Clique na altitude de Ouro Preto na seção 07.CAMPO.' }
      ];

      modalBody.innerHTML = `
        <div class="space-y-2">
          <div class="font-mono text-[10px] uppercase tracking-widest text-[#38BDF8]">OBRIGADO POR EXPLORAR COM ATENÇÃO</div>
          <h3 id="explorer-modal-title" class="font-display text-2xl sm:text-3xl font-extrabold text-ink leading-tight">${badgeTitle}</h3>
          <p class="text-xs sm:text-sm text-ink/80 leading-relaxed">
            Pouca gente rola até o rodapé e observa os detalhes de construção. Obrigado por explorar o portfólio até o final.
          </p>
        </div>

        <div class="grid grid-cols-3 gap-2.5 font-mono text-center">
          <div class="p-3 rounded-xl bg-graphite border hairline-dark">
            <div class="font-display text-xl font-bold text-limeTech tabular-nums">${String(secCount).padStart(2, '0')}/08</div>
            <div class="text-[9px] text-muted uppercase mt-0.5">Seções</div>
          </div>
          <div class="p-3 rounded-xl bg-graphite border hairline-dark">
            <div class="font-display text-xl font-bold text-[#38BDF8] tabular-nums">${String(openedCases.size).padStart(2, '0')}/${totalCasesPadded}</div>
            <div class="text-[9px] text-muted uppercase mt-0.5">Dossiês</div>
          </div>
          <div class="p-3 rounded-xl bg-graphite border hairline-dark">
            <div class="font-display text-xl font-bold text-[#F59E0B] tabular-nums">${formatElapsed()}</div>
            <div class="text-[9px] text-muted uppercase mt-0.5">Tempo</div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
            <span>SEGREDOS INTERATIVOS</span>
            <span class="text-limeTech font-semibold">${found} / 03 DESBLOQUEADOS</span>
          </div>
          <div class="space-y-2">
            ${secretRows.map((r) => `
              <div class="p-3 rounded-xl bg-graphite border ${r.ok ? 'border-limeTech/45' : 'hairline-dark'} flex items-start justify-between gap-3">
                <div class="space-y-0.5 min-w-0">
                  <div class="flex items-center gap-2 font-mono text-[10px]">
                    <span class="${r.ok ? 'text-limeTech' : 'text-muted'} font-semibold">${r.code}</span>
                    <span class="text-ink font-semibold">${r.title}</span>
                  </div>
                  <p class="text-[11px] text-muted leading-snug">${r.ok ? 'Desbloqueado nesta sessão ✓' : 'Pista: ' + r.hint}</p>
                </div>
                <span class="font-mono text-xs ${r.ok ? 'text-limeTech' : 'text-muted/50'} shrink-0">${r.ok ? '★' : '○'}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button id="explorer-toggle-blueprint" type="button" class="min-h-[42px] px-4 py-2 rounded-xl bg-limeTech text-inkDark font-mono text-[11px] font-semibold uppercase tracking-wider hover:bg-[#d5ff4d] transition-colors">
            ${blueprintActive ? 'Desativar Modo Planta' : 'Ativar Modo Planta ⚡'}
          </button>
          <button id="explorer-fire-burst" type="button" class="min-h-[42px] px-4 py-2 rounded-xl bg-graphite border hairline-dark hover:border-[#38BDF8] text-ink hover:text-[#38BDF8] font-mono text-[11px] uppercase tracking-wider transition-colors">
            Disparar Pulso Orbital ✨
          </button>
        </div>
      `;

      modalBody.querySelector('#explorer-toggle-blueprint')?.addEventListener('click', () => {
        setBlueprintMode(!blueprintActive);
        showToast(blueprintActive ? 'Modo Planta ativado!' : 'Modo Planta desativado.');
        renderExplorerModal();
      });
      modalBody.querySelector('#explorer-fire-burst')?.addEventListener('click', () => {
        launchOrbitalBurst();
        showToast('Pulso de telemetria disparado!');
      });
    }

    function openExplorerModal() {
      renderExplorerModal();
      setBackgroundPaused(true);
      modal.setAttribute('data-open', 'true');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      launchOrbitalBurst();
    }

    function closeExplorerModal() {
      modal.setAttribute('data-open', 'false');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      setBackgroundPaused(false);
    }

    rewardBtn.addEventListener('click', openExplorerModal);
    if (modalClose) modalClose.addEventListener('click', closeExplorerModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeExplorerModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.getAttribute('data-open') === 'true') closeExplorerModal();
    });
  })();
})();
