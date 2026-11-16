// =========================================================================
// ESTADO GLOBAL Y UTILIDADES
// =========================================================================
let activeTab = 'cpu';
let autoPlayTimer = null;
let simSpeed = 700;

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16'
];

function getStateBadge(state) {
  const map = {
    'Nuevo': 'bg-slate-700 text-slate-200 border-slate-600',
    'Listo': 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    'Ejecutando': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse',
    'Bloqueado': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'En espera de memoria': 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    'Imposible': 'bg-red-600/20 text-red-300 border-red-500/40',
    'Terminado': 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  };
  const cls = map[state] || 'bg-slate-700 text-slate-200';
  return `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}">${state}</span>`;
}

function logKernel(msg, type = 'info') {
  const box = document.getElementById('kernel-log');
  const color = type === 'err' ? 'text-rose-400' : type === 'ok' ? 'text-emerald-400' : type === 'warn' ? 'text-amber-400' : 'text-slate-300';
  const entry = document.createElement('div');
  entry.className = color;
  entry.textContent = `> ${msg}`;
  box.prepend(entry);
}

function clearKernelLog() {
  document.getElementById('kernel-log').innerHTML = '';
}

// =========================================================================
// ESCENARIOS PREDEFINIDOS POR MÓDULO
// =========================================================================
const SCENARIOS = {
  cpu: [
    {
      name: 'Escenario 1: Llegadas escalonadas (Clásico)',
      processes: [
        { pid: 1, name: 'P1', arrival: 0, burst: 6 },
        { pid: 2, name: 'P2', arrival: 1, burst: 3 },
        { pid: 3, name: 'P3', arrival: 2, burst: 8 },
        { pid: 4, name: 'P4', arrival: 3, burst: 2 }
      ]
    },
    {
      name: 'Escenario 2: Efecto Convoy (Ráfaga larga inicial)',
      processes: [
        { pid: 1, name: 'P1', arrival: 0, burst: 10 },
        { pid: 2, name: 'P2', arrival: 1, burst: 1 },
        { pid: 3, name: 'P3', arrival: 2, burst: 2 },
        { pid: 4, name: 'P4', arrival: 3, burst: 1 }
      ]
    }
  ],
  mem: [
    {
      name: 'Escenario 1: Fragmentación Externa (1024 KB)',
      total: 1024,
      requests: [
        { pid: 1, name: 'P1', arrival: 0, size: 300, duration: 4 },
        { pid: 2, name: 'P2', arrival: 1, size: 250, duration: 8 },
        { pid: 3, name: 'P3', arrival: 2, size: 350, duration: 3 },
        { pid: 4, name: 'P4', arrival: 5, size: 400, duration: 5 },
        { pid: 5, name: 'P5', arrival: 6, size: 200, duration: 4 }
      ]
    },
    {
      name: 'Escenario 2: Alta demanda y cola de espera (512 KB)',
      total: 512,
      requests: [
        { pid: 1, name: 'P1', arrival: 0, size: 200, duration: 5 },
        { pid: 2, name: 'P2', arrival: 1, size: 180, duration: 6 },
        { pid: 3, name: 'P3', arrival: 2, size: 160, duration: 4 },
        { pid: 4, name: 'P4', arrival: 3, size: 100, duration: 3 }
      ]
    }
  ],
  pag: [
    {
      name: 'Escenario 1: Localidad de referencia (4 marcos, TLB 2)',
      frames: 4,
      pageSize: 1024,
      tlbSize: 2,
      processes: [
        { pid: 1, name: 'P1', pages: 4 },
        { pid: 2, name: 'P2', pages: 3 }
      ],
      refs: [
        { pid: 1, addr: 120 },
        { pid: 1, addr: 1150 },
        { pid: 1, addr: 250 },
        { pid: 2, addr: 500 },
        { pid: 1, addr: 2100 },
        { pid: 2, addr: 1500 },
        { pid: 1, addr: 3200 },
        { pid: 1, addr: 300 }
      ]
    },
    {
      name: 'Escenario 2: Anomalía / Thrashing (3 marcos, TLB 2)',
      frames: 3,
      pageSize: 1024,
      tlbSize: 2,
      processes: [
        { pid: 1, name: 'P1', pages: 5 }
      ],
      refs: [
        { pid: 1, addr: 10 },
        { pid: 1, addr: 1030 },
        { pid: 1, addr: 2050 },
        { pid: 1, addr: 3080 },
        { pid: 1, addr: 20 },
        { pid: 1, addr: 1040 },
        { pid: 1, addr: 4100 }
      ]
    }
  ],
  seg: [
    {
      name: 'Escenario 1: Asignación y Violación de Límite (2048 B)',
      total: 2048,
      processes: [
        {
          pid: 1, name: 'P1',
          segments: [
            { id: 0, name: 'Código', limit: 400 },
            { id: 1, name: 'Datos', limit: 300 },
            { id: 2, name: 'Pila', limit: 200 }
          ]
        },
        {
          pid: 2, name: 'P2',
          segments: [
            { id: 0, name: 'Código', limit: 500 },
            { id: 1, name: 'Datos', limit: 350 }
          ]
        }
      ],
      accesses: [
        { pid: 1, seg: 0, offset: 150 },
        { pid: 1, seg: 1, offset: 299 },
        { pid: 1, seg: 1, offset: 310 },
        { pid: 2, seg: 0, offset: 420 },
        { pid: 2, seg: 2, offset: 50 }
      ]
    }
  ]
};

// =========================================================================
// NAVEGACIÓN ENTRE PESTAÑAS
// =========================================================================
function switchTab(tab) {
  stopAutoPlay();
  activeTab = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-indigo-600 text-white shadow';
    } else {
      btn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-slate-800 text-slate-300 hover:bg-slate-700';
    }
  });

  document.querySelectorAll('.module-section').forEach(sec => sec.classList.add('hidden'));
  document.getElementById(`mod-${tab}`).classList.remove('hidden');

  document.getElementById('cpu-proc-details').style.display = tab === 'cpu' ? 'block' : 'none';

  populateScenarioSelector();
  renderActiveModule();
}

function populateScenarioSelector() {
  const sel = document.getElementById('scenario-selector');
  sel.innerHTML = '';
  SCENARIOS[activeTab].forEach((sc, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = sc.name;
    sel.appendChild(opt);
  });
}

function loadSelectedScenario() {
  stopAutoPlay();
  const idx = parseInt(document.getElementById('scenario-selector').value) || 0;
  if (activeTab === 'cpu') initCPU(SCENARIOS.cpu[idx]);
  if (activeTab === 'mem') initMem(SCENARIOS.mem[idx]);
  if (activeTab === 'pag') initPag(SCENARIOS.pag[idx]);
  if (activeTab === 'seg') initSeg(SCENARIOS.seg[idx]);
}

function resetCurrentModule() {
  stopAutoPlay();
  if (activeTab === 'cpu') resetCPU(false);
  if (activeTab === 'mem') resetMem(false);
  if (activeTab === 'pag') resetPag(false);
  if (activeTab === 'seg') resetSeg(false);
}

function toggleAutoPlay() {
  if (autoPlayTimer) {
    stopAutoPlay();
  } else {
    document.getElementById('play-icon').textContent = '⏸️';
    document.getElementById('play-text').textContent = 'Pausar';
    autoPlayTimer = setInterval(() => {
      const done = stepSimulation();
      if (done) stopAutoPlay();
    }, simSpeed);
  }
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
  document.getElementById('play-icon').textContent = '▶️';
  document.getElementById('play-text').textContent = 'Automático';
}

function updateSpeed() {
  simSpeed = parseInt(document.getElementById('sim-speed').value);
  if (autoPlayTimer) {
    stopAutoPlay();
    toggleAutoPlay();
  }
}

function stepSimulation() {
  if (activeTab === 'cpu') return stepCPU();
  if (activeTab === 'mem') return stepMem();
  if (activeTab === 'pag') return stepPag();
  if (activeTab === 'seg') return stepSeg();
  return true;
}

function renderActiveModule() {
  if (activeTab === 'cpu') renderCPU();
  if (activeTab === 'mem') renderMem();
  if (activeTab === 'pag') renderPag();
  if (activeTab === 'seg') renderSeg();
}

// =========================================================================
// MÓDULO 1: PLANIFICACIÓN DE CPU
// =========================================================================
let cpuState = {};

function initCPU(scenario) {
  cpuState.baseProcesses = JSON.parse(JSON.stringify(scenario.processes));
  resetCPU(true);
}

function resetCPU(clearLog = true) {
  const algo = document.getElementById('cpu-algo').value;
  document.getElementById('cpu-quantum-wrap').classList.toggle('hidden', algo !== 'RR');

  cpuState.time = 0;
  cpuState.gantt = [];
  cpuState.readyQueue = [];
  cpuState.currentPid = null;
  cpuState.quantumCounter = 0;
  cpuState.busyTicks = 0;
  cpuState.processes = cpuState.baseProcesses.map((p, idx) => ({
    ...p,
    color: COLORS[idx % COLORS.length],
    remaining: p.burst,
    state: p.arrival === 0 ? 'Listo' : 'Nuevo',
    startTime: null,
    finishTime: null,
    waitingTime: 0,
    turnaroundTime: 0
  }));

  cpuState.processes.forEach(p => {
    if (p.arrival === 0) cpuState.readyQueue.push(p.pid);
  });

  if (clearLog) clearKernelLog();
  logKernel(`[CPU] Simulación reiniciada con política ${algo}.`);
  renderCPU();
}

function addCPUProcess() {
  const nameInput = document.getElementById('cpu-new-name');
  const arr = parseInt(document.getElementById('cpu-new-arr').value) || 0;
  const burst = Math.max(1, parseInt(document.getElementById('cpu-new-burst').value) || 1);
  const nextPid = cpuState.baseProcesses.length + 1;
  const name = nameInput.value.trim() || `P${nextPid}`;
  cpuState.baseProcesses.push({ pid: nextPid, name, arrival: arr, burst });
  nameInput.value = '';
  resetCPU(false);
}

function stepCPU() {
  const algo = document.getElementById('cpu-algo').value;
  const quantum = Math.max(1, parseInt(document.getElementById('cpu-quantum').value) || 2);

  if (cpuState.processes.every(p => p.state === 'Terminado')) {
    document.getElementById('cpu-status-msg').textContent = 'Simulación finalizada';
    return true;
  }

  if (cpuState.time > 0) {
    cpuState.processes.forEach(p => {
      if (p.arrival === cpuState.time && p.state === 'Nuevo') {
        p.state = 'Listo';
        cpuState.readyQueue.push(p.pid);
        logKernel(`t=${cpuState.time}: Llega ${p.name} (ráfaga=${p.burst}) -> Cola de Listos.`);
      }
    });
  }

  let runningProc = cpuState.processes.find(p => p.pid === cpuState.currentPid);

  if (algo === 'FIFO') {
    if (!runningProc && cpuState.readyQueue.length > 0) {
      const nextPid = cpuState.readyQueue.shift();
      runningProc = cpuState.processes.find(p => p.pid === nextPid);
      cpuState.currentPid = runningProc.pid;
    }
  } else if (algo === 'SJF') {
    if (!runningProc && cpuState.readyQueue.length > 0) {
      cpuState.readyQueue.sort((a, b) => {
        const pa = cpuState.processes.find(p => p.pid === a);
        const pb = cpuState.processes.find(p => p.pid === b);
        return pa.burst - pb.burst || pa.arrival - pb.arrival;
      });
      const nextPid = cpuState.readyQueue.shift();
      runningProc = cpuState.processes.find(p => p.pid === nextPid);
      cpuState.currentPid = runningProc.pid;
    }
  } else if (algo === 'SRTF') {
    if (cpuState.readyQueue.length > 0) {
      cpuState.readyQueue.sort((a, b) => {
        const pa = cpuState.processes.find(p => p.pid === a);
        const pb = cpuState.processes.find(p => p.pid === b);
        return pa.remaining - pb.remaining || pa.arrival - pb.arrival;
      });
      const bestReady = cpuState.processes.find(p => p.pid === cpuState.readyQueue[0]);
      if (!runningProc) {
        cpuState.readyQueue.shift();
        runningProc = bestReady;
        cpuState.currentPid = runningProc.pid;
      } else if (bestReady.remaining < runningProc.remaining) {
        runningProc.state = 'Listo';
        cpuState.readyQueue.push(runningProc.pid);
        cpuState.readyQueue.shift();
        logKernel(`t=${cpuState.time}: SRTF apropia CPU a ${runningProc.name} por ${bestReady.name}.`, 'warn');
        runningProc = bestReady;
        cpuState.currentPid = runningProc.pid;
      }
    }
  } else if (algo === 'RR') {
    if (runningProc && cpuState.quantumCounter >= quantum) {
      runningProc.state = 'Listo';
      cpuState.readyQueue.push(runningProc.pid);
      logKernel(`t=${cpuState.time}: Quantum expirado para ${runningProc.name} -> Cola de Listos.`, 'warn');
      runningProc = null;
      cpuState.currentPid = null;
      cpuState.quantumCounter = 0;
    }
    if (!runningProc && cpuState.readyQueue.length > 0) {
      const nextPid = cpuState.readyQueue.shift();
      runningProc = cpuState.processes.find(p => p.pid === nextPid);
      cpuState.currentPid = runningProc.pid;
      cpuState.quantumCounter = 0;
    }
  }

  if (runningProc) {
    runningProc.state = 'Ejecutando';
    if (runningProc.startTime === null) runningProc.startTime = cpuState.time;
    runningProc.remaining -= 1;
    cpuState.quantumCounter += 1;
    cpuState.busyTicks += 1;

    cpuState.gantt.push({
      time: cpuState.time,
      pid: runningProc.pid,
      name: runningProc.name,
      color: runningProc.color
    });

    cpuState.processes.forEach(p => {
      if (p.state === 'Listo') p.waitingTime += 1;
    });

    if (runningProc.remaining === 0) {
      runningProc.state = 'Terminado';
      runningProc.finishTime = cpuState.time + 1;
      runningProc.turnaroundTime = runningProc.finishTime - runningProc.arrival;
      logKernel(`t=${cpuState.time + 1}: ${runningProc.name} TERMINÓ (Retorno=${runningProc.turnaroundTime}, Espera=${runningProc.waitingTime}).`, 'ok');
      cpuState.currentPid = null;
      cpuState.quantumCounter = 0;
    }
  } else {
    cpuState.gantt.push({
      time: cpuState.time,
      pid: null,
      name: 'Idle',
      color: '#334155'
    });
  }

  cpuState.time += 1;
  renderCPU();

  if (cpuState.processes.every(p => p.state === 'Terminado')) {
    document.getElementById('cpu-status-msg').textContent = '✅ Todos los procesos completados';
    return true;
  }
  return false;
}

function renderCPU() {
  document.getElementById('global-clock').textContent = cpuState.time;

  const ganttBar = document.getElementById('cpu-gantt-bar');
  const ganttTicks = document.getElementById('cpu-gantt-ticks');
  if (cpuState.gantt.length === 0) {
    ganttBar.innerHTML = '<div class="text-xs text-slate-500 italic flex items-center">Presiona "Paso a Paso" o "Automático" para comenzar...</div>';
    ganttTicks.innerHTML = '';
  } else {
    ganttBar.innerHTML = cpuState.gantt.map(slot => `
      <div style="background-color: ${slot.color}; min-width: 34px;" class="gantt-block flex-1 rounded flex flex-col items-center justify-center text-white font-bold text-xs shadow-sm py-1">
        <span>${slot.name}</span>
        <span class="text-[9px] opacity-80 font-mono-code">t=${slot.time}</span>
      </div>
    `).join('');
  }

  const rqEl = document.getElementById('cpu-ready-queue');
  if (cpuState.readyQueue.length === 0) {
    rqEl.innerHTML = '<span class="text-xs text-slate-500 italic">Vacía</span>';
  } else {
    rqEl.innerHTML = cpuState.readyQueue.map(pid => {
      const p = cpuState.processes.find(x => x.pid === pid);
      return `<span style="border-color:${p.color}" class="px-2 py-0.5 rounded bg-slate-800 border text-xs font-mono-code text-white">${p.name} (${p.remaining})</span>`;
    }).join('');
  }

  const finished = cpuState.processes.filter(p => p.state === 'Terminado');
  const avgWait = cpuState.processes.reduce((acc, p) => acc + p.waitingTime, 0) / cpuState.processes.length;
  const avgTurn = finished.length > 0
    ? finished.reduce((acc, p) => acc + p.turnaroundTime, 0) / finished.length
    : 0;
  const util = cpuState.time > 0 ? (cpuState.busyTicks / cpuState.time) * 100 : 0;

  document.getElementById('cpu-avg-wait').textContent = avgWait.toFixed(2);
  document.getElementById('cpu-avg-turn').textContent = avgTurn.toFixed(2);
  document.getElementById('cpu-util').textContent = `${util.toFixed(1)}%`;

  document.getElementById('proc-table-extra-col').textContent = 'Restante';
  document.getElementById('global-process-table').innerHTML = cpuState.processes.map(p => `
    <tr>
      <td class="py-2 px-1.5 font-mono-code font-bold text-slate-300">${p.pid}</td>
      <td class="py-2 px-1.5 font-semibold text-white flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${p.color}"></span>${p.name}
      </td>
      <td class="py-2 px-1.5">${getStateBadge(p.state)}</td>
      <td class="py-2 px-1.5 font-mono-code text-slate-300">${p.remaining}/${p.burst}</td>
    </tr>
  `).join('');

  document.getElementById('cpu-metrics-tbody').innerHTML = cpuState.processes.map(p => `
    <tr>
      <td class="py-1 font-semibold text-white">${p.name}</td>
      <td class="py-1">${p.arrival}</td>
      <td class="py-1">${p.burst}</td>
      <td class="py-1">${p.remaining}</td>
      <td class="py-1 text-sky-400">${p.waitingTime}</td>
      <td class="py-1 text-indigo-400">${p.finishTime !== null ? p.turnaroundTime : '-'}</td>
    </tr>
  `).join('');
}

// =========================================================================
// MÓDULO 2: MEMORIA CONTINUA
// =========================================================================
let memState = {};

function initMem(scenario) {
  document.getElementById('mem-total').value = scenario.total;
  memState.baseRequests = JSON.parse(JSON.stringify(scenario.requests));
  resetMem(true);
}

function resetMem(clearLog = true) {
  const total = Math.max(128, parseInt(document.getElementById('mem-total').value) || 1024);
  const mode = document.getElementById('mem-mode').value;

  memState.time = 0;
  memState.total = total;
  memState.mode = mode;
  memState.waitQueue = [];

  if (mode === 'variable') {
    memState.blocks = [
      { id: 1, base: 0, size: total, free: true, pid: null, procName: null, procSize: 0, color: null }
    ];
  } else {
    const p1 = Math.floor(total * 0.15);
    const p2 = Math.floor(total * 0.25);
    const p3 = Math.floor(total * 0.30);
    const p4 = total - (p1 + p2 + p3);
    memState.partitionSizes = [p1, p2, p3, p4];
    memState.blocks = [
      { id: 1, base: 0, size: p1, free: true, pid: null, procName: null, procSize: 0, color: null },
      { id: 2, base: p1, size: p2, free: true, pid: null, procName: null, procSize: 0, color: null },
      { id: 3, base: p1 + p2, size: p3, free: true, pid: null, procName: null, procSize: 0, color: null },
      { id: 4, base: p1 + p2 + p3, size: p4, free: true, pid: null, procName: null, procSize: 0, color: null }
    ];
  }
  if (mode === 'variable') memState.partitionSizes = null;

  memState.processes = memState.baseRequests.map((r, idx) => ({
    ...r,
    color: COLORS[idx % COLORS.length],
    remaining: r.duration,
    state: 'Nuevo'
  }));

  if (clearLog) clearKernelLog();
  logKernel(`[MEM] Memoria (${total} KB, modo ${mode}) inicializada.`);
  renderMem();
}

function addMemProcess() {
  const nameInput = document.getElementById('mem-new-name');
  const size = Math.max(16, parseInt(document.getElementById('mem-new-size').value) || 128);
  const dur = Math.max(1, parseInt(document.getElementById('mem-new-dur').value) || 4);
  const nextPid = memState.processes.length + 1;
  const name = nameInput.value.trim() || `P${nextPid}`;

  const newProc = {
    pid: nextPid,
    name,
    arrival: memState.time,
    size,
    duration: dur,
    remaining: dur,
    color: COLORS[(nextPid - 1) % COLORS.length],
    state: 'Nuevo'
  };
  memState.baseRequests.push(newProc);
  memState.processes.push(newProc);
  nameInput.value = '';
  tryAllocateProcess(newProc);
  renderMem();
}

function findBlockIndexForPolicy(size, policy) {
  let candidates = [];
  memState.blocks.forEach((b, idx) => {
    if (b.free && b.size >= size) {
      candidates.push({ idx, size: b.size });
    }
  });
  if (candidates.length === 0) return -1;

  if (policy === 'first') return candidates[0].idx;
  if (policy === 'best') {
    candidates.sort((a, b) => a.size - b.size);
    return candidates[0].idx;
  }
  if (policy === 'worst') {
    candidates.sort((a, b) => b.size - a.size);
    return candidates[0].idx;
  }
  return candidates[0].idx;
}

function tryAllocateProcess(proc) {
  const policy = document.getElementById('mem-policy').value;
  const maxAllocatable = memState.mode === 'variable'
    ? memState.total
    : Math.max(...memState.partitionSizes);

  if (proc.size > maxAllocatable) {
    proc.state = 'Imposible';
    memState.waitQueue = memState.waitQueue.filter(id => id !== proc.pid);
    logKernel(`t=${memState.time}: ${proc.name} (${proc.size} KB) es imposible de asignar en modo ${memState.mode}.`, 'err');
    document.getElementById('mem-event-msg').textContent = `${proc.name}: solicitud imposible (${proc.size} KB)`;
    return false;
  }

  const idx = findBlockIndexForPolicy(proc.size, policy);

  if (idx === -1) {
    if (proc.state !== 'En espera de memoria') {
      proc.state = 'En espera de memoria';
      if (!memState.waitQueue.includes(proc.pid)) memState.waitQueue.push(proc.pid);
      logKernel(`t=${memState.time}: ${proc.name} (${proc.size} KB) rechazado -> Cola de espera.`, 'warn');
    }
    return false;
  }

  const block = memState.blocks[idx];
  if (memState.mode === 'variable' && block.size > proc.size) {
    const allocatedBlock = {
      id: Date.now() + Math.random(),
      base: block.base,
      size: proc.size,
      free: false,
      pid: proc.pid,
      procName: proc.name,
      procSize: proc.size,
      color: proc.color
    };
    const remainingHole = {
      id: Date.now() + Math.random() + 1,
      base: block.base + proc.size,
      size: block.size - proc.size,
      free: true,
      pid: null,
      procName: null,
      procSize: 0,
      color: null
    };
    memState.blocks.splice(idx, 1, allocatedBlock, remainingHole);
  } else {
    block.free = false;
    block.pid = proc.pid;
    block.procName = proc.name;
    block.procSize = proc.size;
    block.color = proc.color;
  }

  proc.state = 'Ejecutando';
  memState.waitQueue = memState.waitQueue.filter(id => id !== proc.pid);
  document.getElementById('mem-event-msg').textContent = `Asignado ${proc.name} (${proc.size} KB) en dir. ${block.base}`;
  logKernel(`t=${memState.time}: ${proc.name} (${proc.size} KB) asignado en base ${block.base} (${policy.toUpperCase()}).`, 'ok');
  return true;
}

function retryMemWaitQueue() {
  while (memState.waitQueue.length > 0) {
    const pid = memState.waitQueue[0];
    const proc = memState.processes.find(p => p.pid === pid);
    if (!proc || proc.state !== 'En espera de memoria') {
      memState.waitQueue.shift();
      continue;
    }
    if (!tryAllocateProcess(proc)) break;
  }
}

function releaseProcessFromMem(pid) {
  const proc = memState.processes.find(p => p.pid === pid);
  memState.blocks.forEach(b => {
    if (b.pid === pid) {
      b.free = true;
      b.pid = null;
      b.procName = null;
      b.procSize = 0;
      b.color = null;
    }
  });
  if (proc) {
    proc.state = 'Terminado';
    logKernel(`t=${memState.time}: ${proc.name} liberó su memoria.`);
  }
  if (memState.mode === 'variable') coalesceFreeBlocks();
  retryMemWaitQueue();
  renderMem();
}

function coalesceFreeBlocks() {
  for (let i = 0; i < memState.blocks.length - 1; i++) {
    if (memState.blocks[i].free && memState.blocks[i + 1].free) {
      memState.blocks[i].size += memState.blocks[i + 1].size;
      memState.blocks.splice(i + 1, 1);
      i--;
    }
  }
}

function compactMemory() {
  if (memState.mode !== 'variable') {
    logKernel('La compactación solo aplica a particionamiento variable.', 'warn');
    return;
  }
  let currentBase = 0;
  const occupied = [];
  let totalFree = 0;

  memState.blocks.forEach(b => {
    if (!b.free) {
      b.base = currentBase;
      currentBase += b.size;
      occupied.push(b);
    } else {
      totalFree += b.size;
    }
  });

  if (totalFree > 0) {
    occupied.push({
      id: Date.now(),
      base: currentBase,
      size: totalFree,
      free: true,
      pid: null,
      procName: null,
      procSize: 0,
      color: null
    });
  }

  memState.blocks = occupied;
  logKernel(`t=${memState.time}: Memoria compactada. Hueco único de ${totalFree} KB.`, 'ok');
  document.getElementById('mem-event-msg').textContent = `Compactación realizada (${totalFree} KB contiguos)`;

  retryMemWaitQueue();
  renderMem();
}

function stepMem() {
  memState.processes.forEach(p => {
    if (p.state === 'Ejecutando') {
      p.remaining -= 1;
      if (p.remaining <= 0) {
        releaseProcessFromMem(p.pid);
      }
    }
  });

  memState.processes.forEach(p => {
    if (p.arrival === memState.time && p.state === 'Nuevo') {
      tryAllocateProcess(p);
    }
  });

  memState.time += 1;
  renderMem();

  const allDone = memState.processes.every(p => p.state === 'Terminado' || p.state === 'Imposible');
  return allDone;
}

function renderMem() {
  document.getElementById('global-clock').textContent = memState.time;

  const bar = document.getElementById('mem-visual-bar');
  bar.innerHTML = memState.blocks.map(b => {
    const pct = (b.size / memState.total) * 100;
    if (b.free) {
      return `
        <div style="width: ${pct}%" class="h-full bg-slate-900 border-r border-slate-700 flex flex-col items-center justify-center text-[10px] text-slate-400 px-1 overflow-hidden" title="Libre: ${b.size} KB">
          <span class="font-semibold">LIBRE</span>
          <span class="font-mono-code">${b.size}K</span>
        </div>
      `;
    } else {
      return `
        <div style="width: ${pct}%; background-color: ${b.color}" class="h-full border-r border-slate-900 flex flex-col items-center justify-center text-[10px] text-white font-bold px-1 overflow-hidden" title="${b.procName}: ${b.procSize} KB (Bloque ${b.size} KB)">
          <span>${b.procName}</span>
          <span class="font-mono-code font-normal">${b.procSize}K</span>
        </div>
      `;
    }
  }).join('');

  document.getElementById('mem-blocks-table').innerHTML = memState.blocks.map((b, i) => {
    const intFrag = !b.free ? (b.size - b.procSize) : 0;
    return `
      <tr>
        <td class="py-1.5 px-2 text-slate-300">#${i + 1}</td>
        <td class="py-1.5 px-2 text-slate-400">${b.base} KB</td>
        <td class="py-1.5 px-2 text-white">${b.size} KB</td>
        <td class="py-1.5 px-2">${b.free ? '<span class="text-emerald-400">Libre</span>' : '<span class="text-amber-400">Ocupado</span>'}</td>
        <td class="py-1.5 px-2">${b.free ? '-' : `${b.procName} (${b.procSize} KB)${intFrag > 0 ? ` · Frag.Int: ${intFrag} KB` : ''}`}</td>
        <td class="py-1.5 px-2 text-right">
          ${!b.free ? `<button onclick="releaseProcessFromMem(${b.pid})" class="text-rose-400 hover:underline text-[11px]">Liberar</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const wq = document.getElementById('mem-wait-queue');
  if (memState.waitQueue.length === 0) {
    wq.innerHTML = '<span class="text-xs text-slate-500 italic">Vacía</span>';
  } else {
    wq.innerHTML = memState.waitQueue.map(pid => {
      const p = memState.processes.find(x => x.pid === pid);
      return `<span class="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono-code">${p.name} (${p.size} KB)</span>`;
    }).join('');
  }

  const freeBlocks = memState.blocks.filter(b => b.free);
  const totalFree = freeBlocks.reduce((acc, b) => acc + b.size, 0);
  const maxHole = freeBlocks.length > 0 ? Math.max(...freeBlocks.map(b => b.size)) : 0;
  const extFrag = totalFree - maxHole;
  const extPct = totalFree > 0 ? ((extFrag / totalFree) * 100).toFixed(1) : '0.0';

  document.getElementById('mem-free-total').textContent = `${totalFree} KB`;
  document.getElementById('mem-max-hole').textContent = `${maxHole} KB`;
  document.getElementById('mem-ext-frag').textContent = `${extFrag} KB (${extPct}%)`;

  document.getElementById('proc-table-extra-col').textContent = 'Tam / Rest';
  document.getElementById('global-process-table').innerHTML = memState.processes.map(p => `
    <tr>
      <td class="py-2 px-1.5 font-mono-code font-bold text-slate-300">${p.pid}</td>
      <td class="py-2 px-1.5 font-semibold text-white flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${p.color}"></span>${p.name}
      </td>
      <td class="py-2 px-1.5">${getStateBadge(p.state)}</td>
      <td class="py-2 px-1.5 font-mono-code text-slate-300">${p.size}K · ${p.remaining}t</td>
    </tr>
  `).join('');
}

// =========================================================================
// MÓDULO 3: PAGINACIÓN CON TLB Y SWAP
// =========================================================================
let pagState = {};

function initPag(scenario) {
  document.getElementById('pag-frames').value = scenario.frames;
  document.getElementById('pag-size').value = scenario.pageSize;
  document.getElementById('pag-tlb-size').value = scenario.tlbSize;
  pagState.baseProcesses = JSON.parse(JSON.stringify(scenario.processes));
  pagState.baseRefs = JSON.parse(JSON.stringify(scenario.refs));
  resetPag(true);
}

function resetPag(clearLog = true) {
  const numFrames = Math.max(2, parseInt(document.getElementById('pag-frames').value) || 4);
  const pageSize = parseInt(document.getElementById('pag-size').value) || 1024;
  const tlbSize = Math.max(1, parseInt(document.getElementById('pag-tlb-size').value) || 2);

  pagState.step = 0;
  pagState.numFrames = numFrames;
  pagState.pageSize = pageSize;
  pagState.tlbSize = tlbSize;

  pagState.frames = Array.from({ length: numFrames }, (_, i) => ({
    frame: i,
    pid: null,
    page: null,
    loadedAt: 0,
    lastUsed: 0
  }));

  pagState.tlb = [];

  pagState.processes = pagState.baseProcesses.map((p, idx) => ({
    ...p,
    color: COLORS[idx % COLORS.length],
    state: 'Listo',
    pageTable: Array.from({ length: p.pages }, (_, pg) => ({
      page: pg,
      frame: null,
      valid: false,
      inSwap: false,
      everLoaded: false
    }))
  }));

  pagState.refs = JSON.parse(JSON.stringify(pagState.baseRefs));
  pagState.refIndex = 0;

  pagState.totalAccesses = 0;
  pagState.tlbHits = 0;
  pagState.pageFaults = 0;
  pagState.pageIns = 0;
  pagState.pageOuts = 0;
  pagState.swapTransfers = 0;

  const pidSel = document.getElementById('pag-ref-pid');
  pidSel.innerHTML = pagState.processes.map(p => `<option value="${p.pid}">${p.name}</option>`).join('');

  if (clearLog) clearKernelLog();
  logKernel(`[PAG] Paginación iniciada (${numFrames} marcos, pág ${pageSize}B, TLB ${tlbSize}).`);
  renderPag();
}

function addPagReference() {
  const pid = parseInt(document.getElementById('pag-ref-pid').value);
  const addr = Math.max(0, parseInt(document.getElementById('pag-ref-addr').value) || 0);
  pagState.baseRefs.push({ pid, addr });
  pagState.refs.push({ pid, addr });
  renderPag();
}

function stepPag() {
  if (pagState.refIndex >= pagState.refs.length) {
    pagState.processes.forEach(p => p.state = 'Terminado');
    renderPag();
    return true;
  }

  const ref = pagState.refs[pagState.refIndex];
  const proc = pagState.processes.find(p => p.pid === ref.pid);
  const pageNum = Math.floor(ref.addr / pagState.pageSize);
  const offset = ref.addr % pagState.pageSize;

  pagState.processes.forEach(p => {
    p.state = p.pid === ref.pid ? 'Ejecutando' : 'Listo';
  });

  pagState.step += 1;

  if (!proc || pageNum < 0 || pageNum >= proc.pages) {
    logKernel(`Ref #${pagState.step}: Error de direccionamiento en ${proc ? proc.name : 'PID ' + ref.pid} (Pág ${pageNum} fuera de rango).`, 'err');
    const box = document.getElementById('pag-translation-box');
    box.innerHTML = `<span class="text-rose-400 font-bold">REFERENCIA INVÁLIDA:</span> ${proc ? proc.name : 'PID ' + ref.pid}, página ${pageNum} fuera de rango. No cuenta para las métricas.`;
    pagState.refIndex += 1;
    renderPag();
    return false;
  }

  pagState.totalAccesses += 1;

  const tlbAlgo = document.getElementById('pag-tlb-algo').value;
  const ramAlgo = document.getElementById('pag-ram-algo').value;

  let tlbHit = false;
  let pageFault = false;
  let frameNum = null;
  let victimInfo = '';

  const tlbEntry = pagState.tlb.find(e => e.pid === ref.pid && e.page === pageNum);
  if (tlbEntry) {
    tlbHit = true;
    pagState.tlbHits += 1;
    frameNum = tlbEntry.frame;
    tlbEntry.lastUsed = pagState.step;
    const fObj = pagState.frames[frameNum];
    if (fObj) fObj.lastUsed = pagState.step;
  } else {
    const pte = proc.pageTable[pageNum];
    if (pte.valid) {
      frameNum = pte.frame;
      pagState.frames[frameNum].lastUsed = pagState.step;
    } else {
      pageFault = true;
      pagState.pageFaults += 1;
      pagState.pageIns += 1;
      proc.state = 'Bloqueado';

      let targetFrame = pagState.frames.find(f => f.pid === null);
      if (!targetFrame) {
        const sorted = [...pagState.frames].sort((a, b) =>
          ramAlgo === 'FIFO' ? a.loadedAt - b.loadedAt : a.lastUsed - b.lastUsed
        );
        targetFrame = sorted[0];
        const victimProc = pagState.processes.find(p => p.pid === targetFrame.pid);
        if (victimProc) {
          victimProc.pageTable[targetFrame.page].valid = false;
          victimProc.pageTable[targetFrame.page].frame = null;
          victimProc.pageTable[targetFrame.page].inSwap = true;
          pagState.pageOuts += 1;
          victimInfo = ` | Víctima RAM: ${victimProc.name}:P${targetFrame.page} → Swap`;
        }
        pagState.tlb = pagState.tlb.filter(e => !(e.pid === targetFrame.pid && e.page === targetFrame.page));
      }

      targetFrame.pid = ref.pid;
      targetFrame.page = pageNum;
      targetFrame.loadedAt = pagState.step;
      targetFrame.lastUsed = pagState.step;

      pte.valid = true;
      pte.frame = targetFrame.frame;
      pte.inSwap = false;
      pte.everLoaded = true;
      frameNum = targetFrame.frame;
    }

    if (pagState.tlb.length >= pagState.tlbSize) {
      pagState.tlb.sort((a, b) =>
        tlbAlgo === 'FIFO' ? a.loadedAt - b.loadedAt : a.lastUsed - b.lastUsed
      );
      pagState.tlb.shift();
    }
    pagState.tlb.push({
      pid: ref.pid,
      page: pageNum,
      frame: frameNum,
      loadedAt: pagState.step,
      lastUsed: pagState.step
    });
  }

  const physAddr = frameNum * pagState.pageSize + offset;

  const box = document.getElementById('pag-translation-box');
  box.innerHTML = `
    <div class="flex flex-wrap items-center gap-2 mb-1">
      <span class="text-white font-bold">${proc.name}</span>
      <span class="text-slate-400">Dir. Lógica:</span> <span class="text-sky-400">${ref.addr}</span>
      <span class="text-slate-400">→ (Pág <span class="text-amber-300">${pageNum}</span>, Offset <span class="text-amber-300">${offset}</span>)</span>
      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${tlbHit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
        ${tlbHit ? 'TLB HIT' : 'TLB MISS'}
      </span>
      ${pageFault ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">PAGE FAULT (Swap In)</span>' : ''}
    </div>
    <div class="text-emerald-400">
      Dir. Física = Marco ${frameNum} × ${pagState.pageSize} + ${offset} = <strong>${physAddr}</strong>
      <span class="text-rose-400 text-[11px]">${victimInfo}</span>
    </div>
  `;

  logKernel(`#${pagState.step} ${proc.name} Dir:${ref.addr} (P${pageNum}) -> ${tlbHit ? 'TLB HIT' : pageFault ? 'PAGE FAULT' : 'TLB MISS'} -> Marco ${frameNum} (Fís:${physAddr})`, pageFault ? 'warn' : 'ok');

  pagState.refIndex += 1;
  renderPag();
  return pagState.refIndex >= pagState.refs.length;
}

function updatePagMetrics() {
  const hitRate = pagState.totalAccesses > 0 ? (pagState.tlbHits / pagState.totalAccesses) : 0;
  const tTlb = parseFloat(document.getElementById('pag-t-tlb').value) || 10;
  const tRam = parseFloat(document.getElementById('pag-t-ram').value) || 100;
  const tSwap = parseFloat(document.getElementById('pag-t-swap').value) || 5000;

  const faultRate = pagState.totalAccesses > 0 ? (pagState.pageFaults / pagState.totalAccesses) : 0;
  const eat = pagState.totalAccesses > 0
    ? hitRate * (tTlb + tRam) + (1 - hitRate) * (tTlb + 2 * tRam) + faultRate * tSwap
    : 0;

  document.getElementById('pag-hit-rate').textContent = `${(hitRate * 100).toFixed(1)}%`;
  document.getElementById('pag-faults').textContent = pagState.pageFaults;
  pagState.swapTransfers = pagState.pageIns + pagState.pageOuts;
  document.getElementById('pag-page-ins').textContent = `${pagState.pageIns} págs`;
  document.getElementById('pag-page-outs').textContent = `${pagState.pageOuts} págs`;
  document.getElementById('pag-swap-traffic').textContent = `${pagState.swapTransfers} págs`;
  document.getElementById('pag-eat').textContent = `${eat.toFixed(1)} ns`;
}

function renderPag() {
  document.getElementById('global-clock').textContent = pagState.step;

  document.getElementById('pag-ref-queue').innerHTML = pagState.refs.map((r, i) => {
    const proc = pagState.processes.find(p => p.pid === r.pid);
    const pg = Math.floor(r.addr / pagState.pageSize);
    const isCurrent = i === pagState.refIndex;
    const isDone = i < pagState.refIndex;
    return `
      <span class="px-2 py-0.5 rounded text-xs font-mono-code border ${
        isCurrent ? 'bg-purple-600 text-white border-purple-400 font-bold scale-105' :
        isDone ? 'bg-slate-800/50 text-slate-500 border-slate-800 line-through' :
        'bg-slate-800 text-slate-200 border-slate-700'
      }">
        ${proc ? proc.name : 'P' + r.pid}:${r.addr} (P${pg})
      </span>
    `;
  }).join('');

  const tlbTbody = document.getElementById('pag-tlb-table');
  if (pagState.tlb.length === 0) {
    tlbTbody.innerHTML = '<tr><td colspan="3" class="py-2 text-slate-500 italic">TLB vacía</td></tr>';
  } else {
    tlbTbody.innerHTML = pagState.tlb.map(e => {
      const proc = pagState.processes.find(p => p.pid === e.pid);
      return `
        <tr>
          <td class="py-1 text-white">${proc ? proc.name : e.pid}</td>
          <td class="py-1 text-amber-300">P${e.page}</td>
          <td class="py-1 text-emerald-400">M${e.frame}</td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('pag-ram-table').innerHTML = pagState.frames.map(f => {
    const proc = pagState.processes.find(p => p.pid === f.pid);
    return `
      <tr>
        <td class="py-1 text-slate-300">M${f.frame}</td>
        <td class="py-1">${f.pid !== null ? `<span class="text-white font-semibold">${proc.name}:P${f.page}</span>` : '<span class="text-slate-500">Libre</span>'}</td>
        <td class="py-1 text-slate-400">${f.frame * pagState.pageSize}</td>
      </tr>
    `;
  }).join('');

  const swapItems = [];
  pagState.processes.forEach(p => {
    p.pageTable.forEach(pt => {
      if (!pt.valid && pt.inSwap) swapItems.push(`${p.name}:P${pt.page}`);
    });
  });
  document.getElementById('pag-swap-list').innerHTML = swapItems.length > 0
    ? swapItems.map(item => `<span class="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">${item}</span>`).join('')
    : '<span class="text-slate-500 italic">Todas las páginas en RAM</span>';

  document.getElementById('pag-page-tables').innerHTML = pagState.processes.map(p => `
    <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div class="text-xs font-bold mb-1 flex items-center gap-1.5" style="color:${p.color}">
        <span>●</span> ${p.name} (Tabla de Páginas)
      </div>
      <table class="w-full text-left text-[11px] font-mono-code">
        <thead>
          <tr class="text-slate-400 border-b border-slate-800">
            <th class="py-0.5">Pág</th>
            <th class="py-0.5">Marco</th>
            <th class="py-0.5">Validez (V)</th>
          </tr>
        </thead>
        <tbody>
          ${p.pageTable.map(pt => `
            <tr>
              <td class="py-0.5 text-slate-300">P${pt.page}</td>
              <td class="py-0.5 text-emerald-400">${pt.valid ? 'M' + pt.frame : '-'}</td>
              <td class="py-0.5">${pt.valid ? '<span class="text-emerald-400 font-bold">1 (RAM)</span>' : pt.inSwap ? '<span class="text-rose-400">0 (Swap)</span>' : '<span class="text-slate-500">0 (No cargada)</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  updatePagMetrics();

  document.getElementById('proc-table-extra-col').textContent = 'Páginas';
  document.getElementById('global-process-table').innerHTML = pagState.processes.map(p => `
    <tr>
      <td class="py-2 px-1.5 font-mono-code font-bold text-slate-300">${p.pid}</td>
      <td class="py-2 px-1.5 font-semibold text-white flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${p.color}"></span>${p.name}
      </td>
      <td class="py-2 px-1.5">${getStateBadge(p.state)}</td>
      <td class="py-2 px-1.5 font-mono-code text-slate-300">${p.pages} págs</td>
    </tr>
  `).join('');
}

// =========================================================================
// MÓDULO 4: SEGMENTACIÓN
// =========================================================================
let segState = {};

function initSeg(scenario) {
  document.getElementById('seg-total').value = scenario.total;
  segState.baseProcesses = JSON.parse(JSON.stringify(scenario.processes));
  segState.baseAccesses = JSON.parse(JSON.stringify(scenario.accesses));
  resetSeg(true);
}

function resetSeg(clearLog = true) {
  const total = Math.max(512, parseInt(document.getElementById('seg-total').value) || 2048);
  segState.step = 0;
  segState.total = total;
  segState.blocks = [
    { base: 0, size: total, free: true, pid: null, procName: null, segId: null, segName: null, color: null }
  ];
  segState.waitQueue = [];
  segState.processes = segState.baseProcesses.map((p, idx) => ({
    ...p,
    color: COLORS[idx % COLORS.length],
    state: 'Nuevo',
    segTable: p.segments.map(s => ({
      ...s,
      base: null,
      allocated: false
    }))
  }));
  segState.accesses = JSON.parse(JSON.stringify(segState.baseAccesses));
  segState.accessIdx = 0;

  const sel = document.getElementById('seg-test-pid');
  sel.innerHTML = segState.processes.map(p => `<option value="${p.pid}">${p.name}</option>`).join('');

  if (clearLog) clearKernelLog();
  logKernel(`[SEG] Memoria segmentada (${total} B) lista.`);
  renderSeg();
}

function allocateSegmentBlock(proc, segEntry) {
  const policy = document.getElementById('seg-policy').value;
  let candidates = [];
  segState.blocks.forEach((b, idx) => {
    if (b.free && b.size >= segEntry.limit) candidates.push({ idx, size: b.size });
  });
  if (candidates.length === 0) return false;

  if (policy === 'best') candidates.sort((a, b) => a.size - b.size);
  if (policy === 'worst') candidates.sort((a, b) => b.size - a.size);

  const idx = candidates[0].idx;
  const hole = segState.blocks[idx];
  const allocBlock = {
    base: hole.base,
    size: segEntry.limit,
    free: false,
    pid: proc.pid,
    procName: proc.name,
    segId: segEntry.id,
    segName: segEntry.name,
    color: proc.color
  };

  if (hole.size > segEntry.limit) {
    const remHole = {
      base: hole.base + segEntry.limit,
      size: hole.size - segEntry.limit,
      free: true,
      pid: null, procName: null, segId: null, segName: null, color: null
    };
    segState.blocks.splice(idx, 1, allocBlock, remHole);
  } else {
    segState.blocks.splice(idx, 1, allocBlock);
  }

  segEntry.base = allocBlock.base;
  segEntry.allocated = true;
  return true;
}

function releaseSegmentsForProcess(proc) {
  if (!proc) return;

  segState.blocks.forEach(b => {
    if (b.pid === proc.pid) {
      b.free = true;
      b.pid = null;
      b.procName = null;
      b.segId = null;
      b.segName = null;
      b.color = null;
    }
  });

  proc.segTable.forEach(seg => {
    seg.base = null;
    seg.allocated = false;
  });

  coalesceSegmentFreeBlocks();
}

function coalesceSegmentFreeBlocks() {
  for (let i = 0; i < segState.blocks.length - 1; i++) {
    if (segState.blocks[i].free && segState.blocks[i + 1].free) {
      segState.blocks[i].size += segState.blocks[i + 1].size;
      segState.blocks.splice(i + 1, 1);
      i--;
    }
  }
}

function tryAllocateAllSegments(proc) {
  const blocksBefore = JSON.parse(JSON.stringify(segState.blocks));
  const tableBefore = proc.segTable.map(seg => ({
    id: seg.id,
    base: seg.base,
    allocated: seg.allocated
  }));

  for (const seg of proc.segTable) {
    if (!allocateSegmentBlock(proc, seg)) {
      segState.blocks = blocksBefore;
      proc.segTable.forEach(segEntry => {
        const previous = tableBefore.find(s => s.id === segEntry.id);
        segEntry.base = previous.base;
        segEntry.allocated = previous.allocated;
      });
      return false;
    }
  }

  return true;
}

function enqueueSegmentWait(proc) {
  if (!segState.waitQueue.includes(proc.pid)) segState.waitQueue.push(proc.pid);
}

function retryWaitingSegments() {
  for (let i = 0; i < segState.waitQueue.length;) {
    const proc = segState.processes.find(p => p.pid === segState.waitQueue[i]);
    if (!proc || proc.state !== 'En espera de memoria') {
      segState.waitQueue.splice(i, 1);
      continue;
    }

    if (!tryAllocateAllSegments(proc)) {
      i++;
      continue;
    }

    proc.state = 'Listo';
    segState.waitQueue.splice(i, 1);
    logKernel(`Reintento: ${proc.name} asignado correctamente desde la cola de espera.`, 'ok');
  }
}

function compactSegments() {
  let curBase = 0;
  const newBlocks = [];
  let freeSum = 0;

  segState.blocks.forEach(b => {
    if (!b.free) {
      b.base = curBase;
      const proc = segState.processes.find(p => p.pid === b.pid);
      if (proc) {
        const st = proc.segTable.find(s => s.id === b.segId);
        if (st) st.base = curBase;
      }
      curBase += b.size;
      newBlocks.push(b);
    } else {
      freeSum += b.size;
    }
  });

  if (freeSum > 0) {
    newBlocks.push({
      base: curBase, size: freeSum, free: true,
      pid: null, procName: null, segId: null, segName: null, color: null
    });
  }
  segState.blocks = newBlocks;
  logKernel(`Compactación de segmentos realizada (${freeSum} B libres contiguos).`, 'ok');
  retryWaitingSegments();
  renderSeg();
}

function verifySegmentAddress(pid, segNum, offset) {
  const proc = segState.processes.find(p => p.pid === pid);
  const resBox = document.getElementById('seg-translation-result');

  if (!proc) {
    resBox.innerHTML = `<span class="text-rose-400 font-bold">ERROR: Proceso no encontrado.</span>`;
    return;
  }

  const segEntry = proc.segTable.find(s => s.id === segNum);
  if (!segEntry || !segEntry.allocated) {
    resBox.innerHTML = `<span class="text-rose-400 font-bold">⚠️ SEGMENTATION FAULT: El segmento #${segNum} no existe o no está asignado en ${proc.name}.</span>`;
    logKernel(`SEGMENTATION FAULT en ${proc.name} (Seg ${segNum} inválido).`, 'err');
    return;
  }

  if (offset < 0 || offset >= segEntry.limit) {
    resBox.innerHTML = `<span class="text-rose-400 font-bold">⚠️ SEGMENTATION FAULT (Fuera de límite): Desplazamiento ${offset} >= Límite ${segEntry.limit} en ${proc.name} (${segEntry.name}).</span>`;
    logKernel(`SEGMENTATION FAULT en ${proc.name} Seg ${segNum}: offset ${offset} >= límite ${segEntry.limit}.`, 'err');
    return;
  }

  const physAddr = segEntry.base + offset;
  resBox.innerHTML = `<span class="text-emerald-400 font-bold">✅ TRADUCCIÓN VÁLIDA:</span> ${proc.name} (Seg ${segNum}: ${segEntry.name}) → Base (${segEntry.base}) + Offset (${offset}) = <strong class="text-white">${physAddr}</strong>`;
  logKernel(`${proc.name} Seg ${segNum} + ${offset} -> Dir. Física ${physAddr}.`, 'ok');
}

function translateSegmentManual() {
  const pid = parseInt(document.getElementById('seg-test-pid').value);
  const segNum = parseInt(document.getElementById('seg-test-num').value);
  const offset = parseInt(document.getElementById('seg-test-off').value);
  verifySegmentAddress(pid, segNum, offset);
}

function stepSeg() {
  segState.step += 1;

  retryWaitingSegments();

  const pendingProc = segState.processes.find(p => p.state === 'Nuevo');
  if (pendingProc) {
    const allFit = tryAllocateAllSegments(pendingProc);
    pendingProc.state = allFit ? 'Listo' : 'En espera de memoria';
    if (!allFit) enqueueSegmentWait(pendingProc);
    logKernel(`Asignando segmentos de ${pendingProc.name} -> ${pendingProc.state}.`, allFit ? 'ok' : 'warn');
    renderSeg();
    return false;
  }

  if (segState.accessIdx < segState.accesses.length) {
    const acc = segState.accesses[segState.accessIdx];
    segState.processes.forEach(p => {
      if (p.state !== 'En espera de memoria') {
        p.state = p.pid === acc.pid ? 'Ejecutando' : 'Listo';
      }
    });
    verifySegmentAddress(acc.pid, acc.seg, acc.offset);
    segState.accessIdx += 1;
    renderSeg();
    return false;
  }

  segState.processes.forEach(p => {
    if (p.state !== 'En espera de memoria' && p.segTable.every(seg => seg.allocated)) {
      releaseSegmentsForProcess(p);
      p.state = 'Terminado';
    }
  });
  retryWaitingSegments();
  renderSeg();
  return segState.processes.every(p => p.state === 'Terminado');
}

function renderSeg() {
  document.getElementById('global-clock').textContent = segState.step;

  document.getElementById('seg-visual-bar').innerHTML = segState.blocks.map(b => {
    const pct = (b.size / segState.total) * 100;
    if (b.free) {
      return `
        <div style="width:${pct}%" class="h-full bg-slate-900 border-r border-slate-700 flex flex-col items-center justify-center text-[10px] text-slate-400 overflow-hidden">
          <span>LIBRE</span>
          <span class="font-mono-code">${b.size}B</span>
        </div>
      `;
    }
    return `
      <div style="width:${pct}%; background-color:${b.color}" class="h-full border-r border-slate-950 flex flex-col items-center justify-center text-[10px] text-white font-bold overflow-hidden px-1" title="${b.procName} - ${b.segName} (${b.size}B)">
        <span>${b.procName}:S${b.segId}</span>
        <span class="font-mono-code font-normal">${b.size}B</span>
      </div>
    `;
  }).join('');

  const freeBlocks = segState.blocks.filter(b => b.free);
  const totalFree = freeBlocks.reduce((a, b) => a + b.size, 0);
  const maxHole = freeBlocks.length > 0 ? Math.max(...freeBlocks.map(b => b.size)) : 0;
  document.getElementById('seg-ext-frag').textContent = `Frag. Externa: ${totalFree - maxHole} B (Libre total: ${totalFree} B)`;

  document.getElementById('seg-tables-container').innerHTML = segState.processes.map(p => `
    <div class="bg-slate-950 border border-slate-800 rounded-lg p-3">
      <div class="text-xs font-bold mb-1.5 flex items-center gap-1.5" style="color:${p.color}">
        <span>●</span> ${p.name} - Tabla de Segmentos
      </div>
      <table class="w-full text-left text-xs font-mono-code">
        <thead>
          <tr class="text-slate-400 border-b border-slate-800">
            <th class="py-1">Seg</th>
            <th class="py-1">Nombre</th>
            <th class="py-1">Base</th>
            <th class="py-1">Límite</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          ${p.segTable.map(s => `
            <tr>
              <td class="py-1 text-slate-300">${s.id}</td>
              <td class="py-1 text-white font-sans">${s.name}</td>
              <td class="py-1 text-emerald-400">${s.allocated ? s.base : 'Sin asignar'}</td>
              <td class="py-1 text-amber-300">${s.limit} B</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  document.getElementById('proc-table-extra-col').textContent = 'Segmentos';
  document.getElementById('global-process-table').innerHTML = segState.processes.map(p => `
    <tr>
      <td class="py-2 px-1.5 font-mono-code font-bold text-slate-300">${p.pid}</td>
      <td class="py-2 px-1.5 font-semibold text-white flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${p.color}"></span>${p.name}
      </td>
      <td class="py-2 px-1.5">${getStateBadge(p.state)}</td>
      <td class="py-2 px-1.5 font-mono-code text-slate-300">${p.segments.length} segs</td>
    </tr>
  `).join('');
}

// =========================================================================
// COMPARATIVA RÁPIDA DE POLÍTICAS (PARA INFORME)
// =========================================================================
function openCompareModal() {
  stopAutoPlay();
  const modal = document.getElementById('compare-modal');
  const body = document.getElementById('compare-body');
  const title = document.getElementById('compare-title');

  if (activeTab === 'cpu') {
    title.textContent = 'Comparativa de Planificación de CPU (Escenario Actual)';
    const algos = ['FIFO', 'RR', 'SJF', 'SRTF'];
    const q = parseInt(document.getElementById('cpu-quantum').value) || 2;
    const rows = algos.map(algo => {
      const res = simulateCPUHeadless(cpuState.baseProcesses, algo, q);
      return `
        <tr class="border-b border-slate-800">
          <td class="py-2 px-3 font-bold text-white">${algo === 'RR' ? `Round Robin (Q=${q})` : algo}</td>
          <td class="py-2 px-3 font-mono-code text-sky-400">${res.avgWait.toFixed(2)}</td>
          <td class="py-2 px-3 font-mono-code text-indigo-400">${res.avgTurn.toFixed(2)}</td>
          <td class="py-2 px-3 font-mono-code text-emerald-400">${res.util.toFixed(1)}%</td>
          <td class="py-2 px-3 font-mono-code text-slate-300">${res.totalTime} ticks</td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700">
            <th class="py-2 px-3">Política</th>
            <th class="py-2 px-3">T. Espera Prom.</th>
            <th class="py-2 px-3">T. Retorno Prom.</th>
            <th class="py-2 px-3">Uso de CPU</th>
            <th class="py-2 px-3">Tiempo Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } else if (activeTab === 'mem') {
    title.textContent = 'Comparativa de Memoria Continua (Escenario Actual)';
    const policies = [
      { id: 'first', name: 'First Fit (Primer Ajuste)' },
      { id: 'best', name: 'Best Fit (Mejor Ajuste)' },
      { id: 'worst', name: 'Worst Fit (Peor Ajuste)' }
    ];
    const rows = policies.map(pol => {
      const res = simulateMemHeadless(
        memState.baseRequests,
        memState.total,
        memState.mode,
        memState.partitionSizes,
        pol.id
      );
      return `
        <tr class="border-b border-slate-800">
          <td class="py-2 px-3 font-bold text-white">${pol.name}</td>
          <td class="py-2 px-3 font-mono-code text-emerald-400">${res.allocatedCount} / ${memState.baseRequests.length}</td>
          <td class="py-2 px-3 font-mono-code text-amber-400">${res.rejectedEvents} rechazos</td>
          <td class="py-2 px-3 font-mono-code text-rose-400">${res.avgExtFrag.toFixed(1)} KB</td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700">
            <th class="py-2 px-3">Política</th>
            <th class="py-2 px-3">Procesos Completados</th>
            <th class="py-2 px-3">Eventos en Cola Espera</th>
            <th class="py-2 px-3">Frag. Externa Promedio</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } else if (activeTab === 'pag') {
    title.textContent = 'Comparativa de Paginación: TLB y RAM';
    const tlbFixed = document.getElementById('pag-ram-algo').value;
    const ramFixed = document.getElementById('pag-tlb-algo').value;
    const tlbRows = ['FIFO', 'LRU'].map(tlb => {
      const res = simulatePagHeadless(pagState.baseProcesses, pagState.baseRefs, pagState.numFrames, pagState.pageSize, pagState.tlbSize, tlb, tlbFixed);
      return `
        <tr class="border-b border-slate-800">
          <td class="py-2 px-3 font-bold text-white">TLB ${tlb} / RAM ${tlbFixed} (fija)</td>
          <td class="py-2 px-3 font-mono-code text-amber-400">${res.hitRate.toFixed(1)}%</td>
          <td class="py-2 px-3 font-mono-code text-rose-400">${res.pageFaults}</td>
          <td class="py-2 px-3 font-mono-code text-purple-400">${res.pageIns} / ${res.pageOuts} / ${res.swapTransfers}</td>
          <td class="py-2 px-3 font-mono-code text-emerald-400">${res.eat.toFixed(1)} ns</td>
        </tr>
      `;
    }).join('');
    const ramRows = ['FIFO', 'LRU'].map(ram => {
      const res = simulatePagHeadless(pagState.baseProcesses, pagState.baseRefs, pagState.numFrames, pagState.pageSize, pagState.tlbSize, ramFixed, ram);
      return `
        <tr class="border-b border-slate-800">
          <td class="py-2 px-3 font-bold text-white">RAM ${ram} / TLB ${ramFixed} (fija)</td>
          <td class="py-2 px-3 font-mono-code text-amber-400">${res.hitRate.toFixed(1)}%</td>
          <td class="py-2 px-3 font-mono-code text-rose-400">${res.pageFaults}</td>
          <td class="py-2 px-3 font-mono-code text-purple-400">${res.pageIns} / ${res.pageOuts} / ${res.swapTransfers}</td>
          <td class="py-2 px-3 font-mono-code text-emerald-400">${res.eat.toFixed(1)} ns</td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <p class="text-xs text-slate-400 mb-2">Page-in / page-out / tráfico total de Swap. Cada tabla cambia solo la política indicada.</p>
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700">
            <th class="py-2 px-3">Comparación independiente</th>
            <th class="py-2 px-3">TLB Hit Rate</th>
            <th class="py-2 px-3">Fallos de Página</th>
            <th class="py-2 px-3">Tráfico Swap</th>
            <th class="py-2 px-3">EAT</th>
          </tr>
        </thead>
        <tbody>${tlbRows}</tbody>
      </table>
      <table class="w-full text-left text-xs mt-4">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700">
            <th class="py-2 px-3">Comparación independiente</th>
            <th class="py-2 px-3">TLB Hit Rate</th>
            <th class="py-2 px-3">Fallos de Página</th>
            <th class="py-2 px-3">Page-in / Page-out / Total</th>
            <th class="py-2 px-3">EAT</th>
          </tr>
        </thead>
        <tbody>${ramRows}</tbody>
      </table>
    `;
  } else {
    title.textContent = 'Comparativa de Segmentación: First Fit vs Best Fit vs Worst Fit';
    const policies = ['first', 'best', 'worst'];
    const rows = policies.map(pol => {
      const res = simulateSegHeadless(segState.baseProcesses, segState.total, pol);
      return `
        <tr class="border-b border-slate-800">
          <td class="py-2 px-3 font-bold text-white uppercase">${pol} Fit</td>
          <td class="py-2 px-3 font-mono-code text-emerald-400">${res.segsAllocated} segmentos</td>
          <td class="py-2 px-3 font-mono-code text-rose-400">${res.extFrag} B</td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700">
            <th class="py-2 px-3">Política</th>
            <th class="py-2 px-3">Segmentos Ubicados</th>
            <th class="py-2 px-3">Fragmentación Externa</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCompareModal() {
  const modal = document.getElementById('compare-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function simulateCPUHeadless(baseProcs, algo, quantum) {
  let time = 0, busy = 0, curPid = null, qCnt = 0;
  const rq = [];
  const procs = baseProcs.map(p => ({ ...p, remaining: p.burst, state: p.arrival === 0 ? 'Listo' : 'Nuevo', wait: 0, turn: 0 }));
  procs.forEach(p => { if (p.arrival === 0) rq.push(p.pid); });

  while (!procs.every(p => p.state === 'Terminado') && time < 500) {
    if (time > 0) {
      procs.forEach(p => { if (p.arrival === time && p.state === 'Nuevo') { p.state = 'Listo'; rq.push(p.pid); } });
    }
    let run = procs.find(p => p.pid === curPid);
    if (algo === 'FIFO' && !run && rq.length) { curPid = rq.shift(); run = procs.find(p => p.pid === curPid); }
    if (algo === 'SJF' && !run && rq.length) {
      rq.sort((a, b) => procs.find(p => p.pid === a).burst - procs.find(p => p.pid === b).burst);
      curPid = rq.shift(); run = procs.find(p => p.pid === curPid);
    }
    if (algo === 'SRTF' && rq.length) {
      rq.sort((a, b) => procs.find(p => p.pid === a).remaining - procs.find(p => p.pid === b).remaining);
      const best = procs.find(p => p.pid === rq[0]);
      if (!run) { rq.shift(); run = best; curPid = run.pid; }
      else if (best.remaining < run.remaining) { run.state = 'Listo'; rq.push(run.pid); rq.shift(); run = best; curPid = run.pid; }
    }
    if (algo === 'RR') {
      if (run && qCnt >= quantum) { run.state = 'Listo'; rq.push(run.pid); run = null; curPid = null; qCnt = 0; }
      if (!run && rq.length) { curPid = rq.shift(); run = procs.find(p => p.pid === curPid); qCnt = 0; }
    }
    if (run) {
      run.state = 'Ejecutando'; run.remaining--; qCnt++; busy++;
      procs.forEach(p => { if (p.state === 'Listo') p.wait++; });
      if (run.remaining === 0) { run.state = 'Terminado'; run.turn = (time + 1) - run.arrival; curPid = null; qCnt = 0; }
    }
    time++;
  }
  return {
    avgWait: procs.reduce((a, p) => a + p.wait, 0) / procs.length,
    avgTurn: procs.reduce((a, p) => a + p.turn, 0) / procs.length,
    util: time > 0 ? (busy / time) * 100 : 0,
    totalTime: time
  };
}

function simulateMemHeadless(baseReqs, total, mode, partitionSizes, policy) {
  const initialSizes = mode === 'fixed' && Array.isArray(partitionSizes)
    ? partitionSizes
    : [total];
  let base = 0;
  let blocks = initialSizes.map((size) => {
    const block = { base, size, free: true, pid: null };
    base += size;
    return block;
  });
  let procs = baseReqs.map(r => ({ ...r, remaining: r.duration, state: 'Nuevo' }));
  let waitQ = [], rejectedEvents = 0, impossibleCount = 0, fragSamples = [];
  const maxAllocatable = mode === 'variable' ? total : Math.max(...initialSizes);

  for (let t = 0; t < 60; t++) {
    procs.forEach(p => {
      if (p.state === 'Ejecutando') {
        p.remaining--;
        if (p.remaining <= 0) {
          p.state = 'Terminado';
          blocks.forEach(b => { if (b.pid === p.pid) { b.free = true; b.pid = null; } });
          for (let i = 0; i < blocks.length - 1; i++) {
            if (blocks[i].free && blocks[i + 1].free) { blocks[i].size += blocks[i + 1].size; blocks.splice(i + 1, 1); i--; }
          }
        }
      }
    });
    const tryOne = p => {
      if (!p || p.state === 'Ejecutando' || p.state === 'Terminado') return;
      if (p.size > maxAllocatable) {
        p.state = 'Imposible';
        waitQ = waitQ.filter(id => id !== p.pid);
        impossibleCount++;
        return;
      }
      let cands = blocks.map((b, idx) => ({ idx, size: b.size, free: b.free })).filter(b => b.free && b.size >= p.size);
      if (cands.length === 0) {
        if (p.state !== 'En espera de memoria') { p.state = 'En espera de memoria'; waitQ.push(p.pid); rejectedEvents++; }
      } else {
        if (policy === 'best') cands.sort((a, b) => a.size - b.size);
        if (policy === 'worst') cands.sort((a, b) => b.size - a.size);
        const b = blocks[cands[0].idx];
        if (mode === 'variable' && b.size > p.size) {
          blocks.splice(cands[0].idx, 1, { base: b.base, size: p.size, free: false, pid: p.pid }, { base: b.base + p.size, size: b.size - p.size, free: true, pid: null });
        } else { b.free = false; b.pid = p.pid; }
        p.state = 'Ejecutando';
        waitQ = waitQ.filter(id => id !== p.pid);
      }
    };
    for (const id of [...waitQ]) {
      const p = procs.find(x => x.pid === id);
      const before = p && p.state;
      tryOne(p);
      if (p && before === 'En espera de memoria' && p.state === 'En espera de memoria') break;
    }
    procs.filter(p => p.arrival === t && p.state === 'Nuevo').forEach(tryOne);
    const frees = blocks.filter(b => b.free);
    const sumFree = frees.reduce((a, b) => a + b.size, 0);
    const maxH = frees.length ? Math.max(...frees.map(b => b.size)) : 0;
    fragSamples.push(sumFree - maxH);
    if (procs.every(p => p.state === 'Terminado' || p.state === 'Imposible')) break;
  }
  return {
    allocatedCount: procs.filter(p => p.state === 'Terminado').length,
    rejectedEvents,
    impossibleCount,
    avgExtFrag: fragSamples.reduce((a, b) => a + b, 0) / (fragSamples.length || 1)
  };
}

function simulatePagHeadless(baseProcs, refs, numFrames, pageSize, tlbSize, tlbAlgo, ramAlgo) {
  const frames = Array.from({ length: numFrames }, (_, i) => ({ frame: i, pid: null, page: null, loadedAt: 0, lastUsed: 0 }));
  let tlb = [], hits = 0, faults = 0, pageIns = 0, pageOuts = 0, validAccesses = 0, invalidAccesses = 0;
  const procs = baseProcs.map(p => ({ ...p, pt: Array.from({ length: p.pages }, () => ({ valid: false, frame: null, inSwap: false, everLoaded: false })) }));

  refs.forEach((r, idx) => {
    const step = idx + 1;
    const proc = procs.find(p => p.pid === r.pid);
    const pg = Math.floor(r.addr / pageSize);
    if (!proc || pg < 0 || pg >= proc.pages) { invalidAccesses++; return; }
    validAccesses++;
    const tEntry = tlb.find(e => e.pid === r.pid && e.page === pg);
    if (tEntry) {
      hits++; tEntry.lastUsed = step; frames[tEntry.frame].lastUsed = step;
    } else {
      const pte = proc.pt[pg];
      let fNum;
      if (pte.valid) {
        fNum = pte.frame; frames[fNum].lastUsed = step;
      } else {
        faults++; pageIns++;
        let tf = frames.find(f => f.pid === null);
        if (!tf) {
          tf = [...frames].sort((a, b) => ramAlgo === 'FIFO' ? a.loadedAt - b.loadedAt : a.lastUsed - b.lastUsed)[0];
          const vp = procs.find(p => p.pid === tf.pid);
          if (vp) { vp.pt[tf.page].valid = false; vp.pt[tf.page].frame = null; vp.pt[tf.page].inSwap = true; pageOuts++; }
          tlb = tlb.filter(e => !(e.pid === tf.pid && e.page === tf.page));
        }
        tf.pid = r.pid; tf.page = pg; tf.loadedAt = step; tf.lastUsed = step;
        pte.valid = true; pte.frame = tf.frame; pte.inSwap = false; pte.everLoaded = true; fNum = tf.frame;
      }
      if (tlb.length >= tlbSize) {
        tlb.sort((a, b) => tlbAlgo === 'FIFO' ? a.loadedAt - b.loadedAt : a.lastUsed - b.lastUsed);
        tlb.shift();
      }
      tlb.push({ pid: r.pid, page: pg, frame: fNum, loadedAt: step, lastUsed: step });
    }
  });

  const h = validAccesses ? hits / validAccesses : 0;
  const fRate = validAccesses ? faults / validAccesses : 0;
  const tTlb = parseFloat(document.getElementById('pag-t-tlb').value) || 10;
  const tRam = parseFloat(document.getElementById('pag-t-ram').value) || 100;
  const tSwap = parseFloat(document.getElementById('pag-t-swap').value) || 5000;
  return {
    hitRate: h * 100,
    pageFaults: faults,
    pageIns,
    pageOuts,
    swapTransfers: pageIns + pageOuts,
    validAccesses,
    invalidAccesses,
    eat: h * (tTlb + tRam) + (1 - h) * (tTlb + 2 * tRam) + fRate * tSwap
  };
}

function simulateSegHeadless(baseProcs, total, policy) {
  let blocks = [{ base: 0, size: total, free: true }];
  let segsAllocated = 0;
  baseProcs.forEach(p => {
    p.segments.forEach(s => {
      let cands = blocks.map((b, idx) => ({ idx, size: b.size, free: b.free })).filter(b => b.free && b.size >= s.limit);
      if (cands.length > 0) {
        if (policy === 'best') cands.sort((a, b) => a.size - b.size);
        if (policy === 'worst') cands.sort((a, b) => b.size - a.size);
        const hole = blocks[cands[0].idx];
        if (hole.size > s.limit) {
          blocks.splice(cands[0].idx, 1, { base: hole.base, size: s.limit, free: false }, { base: hole.base + s.limit, size: hole.size - s.limit, free: true });
        } else { hole.free = false; }
        segsAllocated++;
      }
    });
  });
  const frees = blocks.filter(b => b.free);
  const sumF = frees.reduce((a, b) => a + b.size, 0);
  const maxH = frees.length ? Math.max(...frees.map(b => b.size)) : 0;
  return { segsAllocated, extFrag: sumF - maxH };
}

window.onload = function () {
  initCPU(SCENARIOS.cpu[0]);
  initMem(SCENARIOS.mem[0]);
  initPag(SCENARIOS.pag[0]);
  initSeg(SCENARIOS.seg[0]);
  switchTab('cpu');
};
