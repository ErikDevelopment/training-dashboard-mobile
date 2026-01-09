// ===== State Management =====
const STATE_KEY = 'workout_app_state';
const HISTORY_KEY = 'workout_app_history';

let state = {
  routines: [],
  currentRoutineId: null,
  exerciseProgress: {}, // { [routineId_exerciseId]: { completed: bool, doneSets: num } }
  timers: {}, // { [exerciseId]: { running, phase, startedAt, remainingSec, currentSet } }
  restTimers: {}, // { [exerciseId]: { running, startedAt, remainingSec } }
  routineStopwatch: { running: false, startedAt: null, elapsedMs: 0 }
};

let history = [];
let wakeLock = null;

// Fullscreen timer state
let fullscreenState = {
  active: false,
  exerciseId: null,
  exerciseData: null
};

// Image zoom state
let imageZoomState = {
  active: false,
  imageSrc: null
};

// ===== Default Routines Fallback =====
const DEFAULT_ROUTINES = {
  "routines": [
    {
      "id": "push",
      "name": "Push Day",
      "description": "Brust & Schulter",
      "exercises": [
        { "id": "bench", "name": "Bankdrücken", "type": "reps", "sets": 4, "reps": 8, "restSec": 90 },
        { "id": "shoulder-press", "name": "Schulterdrücken", "type": "reps", "sets": 4, "reps": 8, "restSec": 90 },
        { "id": "lateral-raise", "name": "Seitheben", "type": "reps", "sets": 3, "reps": 15, "restSec": 60 }
      ]
    },
    {
      "id": "core",
      "name": "Core Blast",
      "description": "Bauch & Rumpf",
      "exercises": [
        { "id": "plank", "name": "Plank", "type": "time", "sets": 3, "durationSec": 45, "restSec": 30 },
        { "id": "crunches", "name": "Crunches", "type": "reps", "sets": 3, "reps": 20, "restSec": 45 }
      ]
    }
  ]
};

// ===== Vibration Patterns =====
const VIBRATE = {
  short: [80],
  setEnd: [250, 120, 250],
  complete: [300, 120, 300, 120, 450]
};

function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// ===== Beep Sound =====
let beepAudio = null;

function playBeep() {
  try {
    if (!beepAudio) {
      beepAudio = new Audio('./assets/sounds/beep.mp3'); 
      // Alternativ: wav oder ogg
    }
    beepAudio.currentTime = 0;
    beepAudio.play();
  } catch (e) {
    console.log('Beep not available');
  }
}

// ===== Wake Lock =====
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.log('Wake Lock not available');
    }
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release();
    wakeLock = null;
  }
}

// ===== LocalStorage =====
function saveState() {
  // Don't save routines to localStorage - they come from JSON
  const stateToSave = { ...state };
  delete stateToSave.routines;
  localStorage.setItem(STATE_KEY, JSON.stringify(stateToSave));
}

function loadState() {
  const saved = localStorage.getItem(STATE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    // Don't overwrite routines - they come from JSON
    const { routines, ...rest } = parsed;
    state = { ...state, ...rest };
    
    // Recalculate timer states based on timestamps
    Object.keys(state.timers).forEach(key => {
      const timer = state.timers[key];
      if (timer.running && timer.startedAt) {
        const elapsed = (Date.now() - timer.startedAt) / 1000;
        timer.remainingSec = Math.max(0, timer.remainingSec - elapsed);
        timer.startedAt = Date.now();
      }
    });
    
    Object.keys(state.restTimers).forEach(key => {
      const timer = state.restTimers[key];
      if (timer.running && timer.startedAt) {
        const elapsed = (Date.now() - timer.startedAt) / 1000;
        timer.remainingSec = Math.max(0, timer.remainingSec - elapsed);
        timer.startedAt = Date.now();
      }
    });
    
    // Recalculate stopwatch
    if (state.routineStopwatch.running && state.routineStopwatch.startedAt) {
      const elapsed = Date.now() - state.routineStopwatch.startedAt;
      state.routineStopwatch.elapsedMs += elapsed;
      state.routineStopwatch.startedAt = Date.now();
    }
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadHistory() {
  const saved = localStorage.getItem(HISTORY_KEY);
  if (saved) {
    history = JSON.parse(saved);
  }
}

// ===== Data Loading =====
async function loadRoutines() {
  try {
    const response = await fetch('./assets/data/routines.json');
    if (!response.ok) throw new Error('Fetch failed');
    const data = await response.json();
    state.routines = data.routines;
  } catch (err) {
    console.log('Using default routines');
    state.routines = DEFAULT_ROUTINES.routines;
  }
}

// ===== SVG Icons =====
const ICONS = {
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`,
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5L17.5 17.5M6.5 17.5L17.5 6.5M3 8v8M21 8v8M5.5 10v4M18.5 10v4"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  skip: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4l10 8-10 8V4zM19 5v14h-2V5h2z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v5h5"/><path d="M3 12a9 9 0 1 0 3-6.5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>`,
  empty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`
};

// ===== View Rendering =====
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
}

function renderRoutineList() {
  const container = document.getElementById('routine-list-container');
  
  if (state.routines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        ${ICONS.empty}
        <p>Keine Routinen verfügbar</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.routines.map(routine => {
    const completedCount = getRoutineCompletedCount(routine.id);
    const totalCount = routine.exercises.length;
    const isInProgress = completedCount > 0 && completedCount < totalCount;
    
    return `
      <div class="card card-clickable routine-card" onclick="openRoutine('${routine.id}')">
        <div class="routine-card-header">
          <span class="routine-name">${routine.name}</span>
          ${isInProgress ? `<span class="routine-badge">${completedCount}/${totalCount}</span>` : ''}
        </div>
        <p class="routine-description">${routine.description}</p>
        <div class="routine-meta">
          <span class="routine-meta-item">
            ${ICONS.dumbbell}
            ${totalCount} Übungen
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function getRoutineCompletedCount(routineId) {
  const routine = state.routines.find(r => r.id === routineId);
  if (!routine) return 0;
  
  return routine.exercises.filter(ex => {
    const key = `${routineId}_${ex.id}`;
    return state.exerciseProgress[key]?.completed;
  }).length;
}

function openRoutine(routineId) {
  state.currentRoutineId = routineId;
  saveState();
  renderRoutineDetail();
  showView('routine-detail');
}

function renderRoutineDetail() {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const completedCount = getRoutineCompletedCount(routine.id);
  const totalCount = routine.exercises.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  document.getElementById('routine-detail-header').innerHTML = `
    <button class="back-btn" onclick="goBack()">
      ${ICONS.back}
      Zurück
    </button>
    <div>
      <h1 class="header-title">${routine.name}</h1>
      <p class="header-subtitle">${routine.description}</p>
    </div>
  `;
  
  document.getElementById('routine-progress').innerHTML = `
    <div class="progress-header">
      <span class="progress-label">Fortschritt</span>
      <span class="progress-value">${completedCount} / ${totalCount}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${progress}%"></div>
    </div>
  `;
  
  renderStopwatch();
  renderExerciseList(routine);
  renderCompleteButton(routine);
}

function renderStopwatch() {
  const sw = state.routineStopwatch;
  const totalMs = sw.running 
    ? sw.elapsedMs + (Date.now() - sw.startedAt)
    : sw.elapsedMs;
  
  const formatted = formatTime(Math.floor(totalMs / 1000));
  
  document.getElementById('routine-stopwatch').innerHTML = `
    <div class="card stopwatch-card">
      <div class="stopwatch-label">Trainingszeit</div>
      <div class="stopwatch-value">${formatted}</div>
      <div class="btn-group btn-group-center">
        <button class="btn btn-icon ${sw.running ? 'btn-primary' : 'btn-secondary'}" onclick="toggleStopwatch()">
          ${sw.running ? ICONS.pause : ICONS.play}
        </button>
        <button class="btn btn-icon btn-secondary" onclick="resetStopwatch()">
          ${ICONS.reset}
        </button>
      </div>
    </div>
  `;
}

function toggleStopwatch() {
  const sw = state.routineStopwatch;
  if (sw.running) {
    sw.elapsedMs += Date.now() - sw.startedAt;
    sw.startedAt = null;
    sw.running = false;
    releaseWakeLock();
  } else {
    sw.startedAt = Date.now();
    sw.running = true;
    requestWakeLock();
  }
  saveState();
  renderStopwatch();
}

function resetStopwatch() {
  state.routineStopwatch = { running: false, startedAt: null, elapsedMs: 0 };
  saveState();
  renderStopwatch();
}

function renderExerciseList(routine) {
  const container = document.getElementById('exercise-list-container');
  
  container.innerHTML = routine.exercises.map(ex => {
    const key = `${routine.id}_${ex.id}`;
    const progress = state.exerciseProgress[key] || { completed: false, doneSets: 0 };
    const isCompleted = progress.completed;
    
    if (ex.type === 'time') {
      return renderTimeExercise(ex, key, progress, isCompleted);
    } else {
      return renderRepsExercise(ex, key, progress, isCompleted);
    }
  }).join('');
}

// ===== Progress Ring Helper =====
function createProgressRing(progress, size = 100, strokeWidth = 6, colorClass = '') {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress * circumference);
  
  return `
    <div class="progress-ring-container">
      <svg class="progress-ring ${progress > 0 && progress < 1 ? 'animating' : ''}" width="${size}" height="${size}">
        <circle class="progress-ring-bg" cx="${size/2}" cy="${size/2}" r="${radius}"/>
        <circle class="progress-ring-fill ${colorClass}" cx="${size/2}" cy="${size/2}" r="${radius}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"/>
      </svg>
    </div>
  `;
}

function renderTimeExercise(ex, key, progress, isCompleted) {
  const timer = state.timers[ex.id] || { 
    running: false, 
    phase: 'work', 
    remainingSec: ex.durationSec, 
    currentSet: 1 
  };
  
  const isRest = timer.phase === 'rest';
  const timerClass = timer.running ? (isRest ? 'rest' : 'active') : '';
  const labelClass = timer.running ? (isRest ? 'rest' : 'active') : '';
  
  // Calculate progress for ring
  let ringProgress = 0;
  let ringColorClass = '';
  if (isRest) {
    ringProgress = 1 - (timer.remainingSec / ex.restSec);
    ringColorClass = 'rest';
  } else {
    ringProgress = 1 - (timer.remainingSec / ex.durationSec);
    ringColorClass = timer.running ? 'active' : '';
  }
  
  // Image section (if exercise has image)
  const imageSection = ex.image ? `
    <div class="exercise-image-container" onclick="openImageZoom('${ex.image}')">
      <img src="${ex.image}" alt="${ex.name}" class="exercise-image" onerror="this.parentElement.style.display='none'"/>
    </div>
  ` : '';

  return `
    <div class="card exercise-card ${isCompleted ? 'completed' : ''}" id="ex-${ex.id}">
      <div class="exercise-header">
        <span class="exercise-name">${ex.name}</span>
        <span class="exercise-type-badge time">Zeit</span>
      </div>
      
      ${imageSection}
      
      <div class="exercise-info">
        <div class="exercise-info-item">
          <div class="exercise-info-value">${ex.sets}</div>
          <div class="exercise-info-label">Sets</div>
        </div>
        <div class="exercise-info-item">
          <div class="exercise-info-value">${ex.durationSec}s</div>
          <div class="exercise-info-label">Dauer</div>
        </div>
        <div class="exercise-info-item">
          <div class="exercise-info-value">${ex.restSec}s</div>
          <div class="exercise-info-label">Pause</div>
        </div>
      </div>
      
      ${createProgressRing(ringProgress, 120, 6, ringColorClass)}
      
      <div class="timer-display" onclick="openFullscreenTimer('${ex.id}', 'time')">
        <div class="timer-value ${timerClass}">${formatTime(Math.ceil(timer.remainingSec))}</div>
        <div class="timer-label ${labelClass}">${isRest ? 'Pause' : 'Aktiv'}</div>
        <div class="set-indicator">Set ${timer.currentSet} / ${ex.sets}</div>
        <div class="timer-display-hint">Tippen für Vollbild</div>
      </div>
      
      <div class="btn-group btn-group-center">
        <button class="btn btn-icon btn-secondary" onclick="resetTimeExercise('${ex.id}', ${ex.durationSec})">
          ${ICONS.reset}
        </button>
        <button class="btn btn-primary" onclick="toggleTimeExercise('${ex.id}', ${ex.durationSec}, ${ex.restSec}, ${ex.sets})" ${isCompleted ? 'disabled' : ''}>
          ${timer.running ? ICONS.pause : ICONS.play}
          ${timer.running ? 'Pause' : 'Start'}
        </button>
        <button class="btn btn-icon btn-secondary" onclick="skipTimeExercise('${ex.id}', ${ex.durationSec}, ${ex.restSec}, ${ex.sets})" ${isCompleted ? 'disabled' : ''}>
          ${ICONS.skip}
        </button>
      </div>
    </div>
  `;
}

function renderRepsExercise(ex, key, progress, isCompleted) {
  const doneSets = progress.doneSets || 0;
  const restTimer = state.restTimers[ex.id];
  const hasRestTimer = restTimer && restTimer.running && restTimer.remainingSec > 0;
  
  // Calculate progress for ring
  const ringProgress = doneSets / ex.sets;
  
  // Image section (if exercise has image)
  const imageSection = ex.image ? `
    <div class="exercise-image-container" onclick="openImageZoom('${ex.image}')">
      <img src="${ex.image}" alt="${ex.name}" class="exercise-image" onerror="this.parentElement.style.display='none'"/>
    </div>
  ` : '';

  return `
    <div class="card exercise-card ${isCompleted ? 'completed' : ''}" id="ex-${ex.id}">
      <div class="exercise-header">
        <span class="exercise-name">${ex.name}</span>
        <span class="exercise-type-badge reps">Reps</span>
      </div>
      
      ${imageSection}
      
      <div class="exercise-info">
        <div class="exercise-info-item">
          <div class="exercise-info-value">${ex.sets}</div>
          <div class="exercise-info-label">Sets</div>
        </div>
        <div class="exercise-info-item">
          <div class="exercise-info-value">${ex.reps}</div>
          <div class="exercise-info-label">Reps</div>
        </div>
        <div class="exercise-info-item">
          <div class="exercise-info-value">${ex.restSec}s</div>
          <div class="exercise-info-label">Pause</div>
        </div>
      </div>
      
      ${createProgressRing(ringProgress, 120, 6, 'reps')}
      
      <div class="reps-display">
        <div class="reps-counter">${doneSets} / ${ex.sets}</div>
        <div class="reps-label">Sets abgeschlossen</div>
        <div class="reps-target">${ex.sets} × ${ex.reps} Wiederholungen</div>
        ${hasRestTimer ? `
          <div class="rest-mini-timer">
            <span class="rest-mini-label">Pause</span>
            <span>${formatTime(Math.ceil(restTimer.remainingSec))}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="btn-group btn-group-center">
        <button class="btn btn-icon btn-secondary" onclick="decrementSet('${ex.id}', ${ex.sets})" ${doneSets === 0 ? 'disabled' : ''}>
          ${ICONS.minus}
        </button>
        <button class="btn btn-primary" onclick="incrementSet('${ex.id}', ${ex.sets}, ${ex.restSec})" ${isCompleted ? 'disabled' : ''}>
          ${ICONS.plus}
          Set fertig
        </button>
        <button class="btn btn-icon btn-danger" onclick="resetRepsExercise('${ex.id}')">
          ${ICONS.reset}
        </button>
      </div>
    </div>
  `;
}

function renderCompleteButton(routine) {
  const completedCount = getRoutineCompletedCount(routine.id);
  const totalCount = routine.exercises.length;
  
  document.getElementById('complete-routine-btn').innerHTML = `
    <button class="btn btn-primary btn-full mt-lg" onclick="completeRoutine()">
      ${ICONS.check}
      Training abschließen (${completedCount}/${totalCount})
    </button>
  `;
}

// ===== Time Exercise Logic =====
let timerIntervals = {};

function toggleTimeExercise(exId, duration, restSec, totalSets) {
  let timer = state.timers[exId];
  
  if (!timer) {
    timer = { running: false, phase: 'work', remainingSec: duration, currentSet: 1 };
    state.timers[exId] = timer;
  }
  
  if (timer.running) {
    // Pause
    clearInterval(timerIntervals[exId]);
    timer.running = false;
    releaseWakeLock();
  } else {
    // Start
    timer.running = true;
    timer.startedAt = Date.now();
    requestWakeLock();
    
    timerIntervals[exId] = setInterval(() => {
      tickTimeExercise(exId, duration, restSec, totalSets);
    }, 100);
  }
  
  saveState();
  updateTimeExerciseUI(exId);
}

function tickTimeExercise(exId, duration, restSec, totalSets) {
  const timer = state.timers[exId];
  if (!timer || !timer.running) return;
  
  const elapsed = (Date.now() - timer.startedAt) / 1000;
  timer.remainingSec = Math.max(0, timer.remainingSec - elapsed);
  timer.startedAt = Date.now();
  
  if (timer.remainingSec <= 0) {
    if (timer.phase === 'work') {
      vibrate(VIBRATE.setEnd);

      playBeep();
      
      if (timer.currentSet >= totalSets) {
        // Exercise complete
        clearInterval(timerIntervals[exId]);
        timer.running = false;
        vibrate(VIBRATE.complete);
        markExerciseCompleted(exId);
        releaseWakeLock();
      } else {
        // Start rest
        timer.phase = 'rest';
        timer.remainingSec = restSec;
      }
    } else {
      // Rest complete, start next set
      vibrate(VIBRATE.short);
      timer.phase = 'work';
      timer.remainingSec = duration;
      timer.currentSet++;
    }
  }
  
  saveState();
  updateTimeExerciseUI(exId);
}

function updateTimeExerciseUI(exId) {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const ex = routine.exercises.find(e => e.id === exId);
  if (!ex) return;
  
  const key = `${routine.id}_${ex.id}`;
  const progress = state.exerciseProgress[key] || { completed: false, doneSets: 0 };
  
  const card = document.getElementById(`ex-${exId}`);
  if (card) {
    card.outerHTML = renderTimeExercise(ex, key, progress, progress.completed);
  }
  
  // Also update fullscreen timer if active
  updateFullscreenTimerIfActive(exId);
}

function resetTimeExercise(exId, duration) {
  clearInterval(timerIntervals[exId]);
  state.timers[exId] = { running: false, phase: 'work', remainingSec: duration, currentSet: 1 };
  
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (routine) {
    const key = `${routine.id}_${exId}`;
    if (state.exerciseProgress[key]) {
      state.exerciseProgress[key].completed = false;
    }
  }
  
  saveState();
  updateTimeExerciseUI(exId);
  renderRoutineDetail();
}

function skipTimeExercise(exId, duration, restSec, totalSets) {
  const timer = state.timers[exId] || { running: false, phase: 'work', remainingSec: duration, currentSet: 1 };
  
  if (timer.phase === 'work') {
    if (timer.currentSet >= totalSets) {
      clearInterval(timerIntervals[exId]);
      timer.running = false;
      vibrate(VIBRATE.complete);
      markExerciseCompleted(exId);
    } else {
      timer.phase = 'rest';
      timer.remainingSec = restSec;
      vibrate(VIBRATE.short);
    }
  } else {
    timer.phase = 'work';
    timer.remainingSec = duration;
    timer.currentSet++;
    vibrate(VIBRATE.short);
  }
  
  state.timers[exId] = timer;
  saveState();
  updateTimeExerciseUI(exId);
}

// ===== Reps Exercise Logic =====
let restIntervals = {};

function incrementSet(exId, totalSets, restSec) {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const key = `${routine.id}_${exId}`;
  if (!state.exerciseProgress[key]) {
    state.exerciseProgress[key] = { completed: false, doneSets: 0 };
  }
  
  const progress = state.exerciseProgress[key];
  progress.doneSets = Math.min(progress.doneSets + 1, totalSets);
  
  vibrate(VIBRATE.short);
  
  if (progress.doneSets >= totalSets) {
    progress.completed = true;
    vibrate(VIBRATE.complete);
    clearInterval(restIntervals[exId]);
    delete state.restTimers[exId];
  } else {
    // Start rest timer
    clearInterval(restIntervals[exId]);
    state.restTimers[exId] = { running: true, startedAt: Date.now(), remainingSec: restSec };
    
    restIntervals[exId] = setInterval(() => {
      tickRestTimer(exId);
    }, 100);
  }
  
  saveState();
  renderRoutineDetail();
}

function tickRestTimer(exId) {
  const restTimer = state.restTimers[exId];
  if (!restTimer || !restTimer.running) return;
  
  const elapsed = (Date.now() - restTimer.startedAt) / 1000;
  restTimer.remainingSec = Math.max(0, restTimer.remainingSec - elapsed);
  restTimer.startedAt = Date.now();
  
  if (restTimer.remainingSec <= 0) {
    clearInterval(restIntervals[exId]);
    restTimer.running = false;
    vibrate(VIBRATE.short);
    playBeep();
  }
  
  saveState();
  
  // Update just the rest timer display
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (routine) {
    const ex = routine.exercises.find(e => e.id === exId);
    if (ex) {
      const key = `${routine.id}_${exId}`;
      const progress = state.exerciseProgress[key] || { completed: false, doneSets: 0 };
      const card = document.getElementById(`ex-${exId}`);
      if (card) {
        card.outerHTML = renderRepsExercise(ex, key, progress, progress.completed);
      }
    }
  }
}

function decrementSet(exId, totalSets) {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const key = `${routine.id}_${exId}`;
  if (!state.exerciseProgress[key]) return;
  
  const progress = state.exerciseProgress[key];
  progress.doneSets = Math.max(0, progress.doneSets - 1);
  progress.completed = false;
  
  saveState();
  renderRoutineDetail();
}

function resetRepsExercise(exId) {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const key = `${routine.id}_${exId}`;
  state.exerciseProgress[key] = { completed: false, doneSets: 0 };
  
  clearInterval(restIntervals[exId]);
  delete state.restTimers[exId];
  
  saveState();
  renderRoutineDetail();
}

function markExerciseCompleted(exId) {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const key = `${routine.id}_${exId}`;
  if (!state.exerciseProgress[key]) {
    state.exerciseProgress[key] = { completed: false, doneSets: 0 };
  }
  state.exerciseProgress[key].completed = true;
  
  saveState();
  renderRoutineDetail();
}

// ===== Routine Completion =====
function completeRoutine() {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const completedCount = getRoutineCompletedCount(routine.id);
  const sw = state.routineStopwatch;
  const totalMs = sw.running 
    ? sw.elapsedMs + (Date.now() - sw.startedAt)
    : sw.elapsedMs;
  
  // Create history entry
  const entry = {
    id: Date.now().toString(),
    routineId: routine.id,
    routineName: routine.name,
    completedAt: new Date().toISOString(),
    totalDuration: totalMs,
    completedExercises: completedCount,
    totalExercises: routine.exercises.length
  };
  
  history.unshift(entry);
  saveHistory();
  
  // Reset routine progress
  routine.exercises.forEach(ex => {
    const key = `${routine.id}_${ex.id}`;
    delete state.exerciseProgress[key];
    delete state.timers[ex.id];
    delete state.restTimers[ex.id];
    clearInterval(timerIntervals[ex.id]);
    clearInterval(restIntervals[ex.id]);
  });
  
  resetStopwatch();
  vibrate(VIBRATE.complete);
  
  saveState();
  goBack();
}

// ===== History View =====
function renderHistory() {
  const container = document.getElementById('history-list-container');
  
  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        ${ICONS.empty}
        <p>Noch keine Trainings abgeschlossen</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = history.map(entry => `
    <div class="card history-card">
      <div class="history-info">
        <div class="history-routine">${entry.routineName}</div>
        <div class="history-date">${formatDate(entry.completedAt)}</div>
      </div>
      <div class="history-stats">
        <div class="history-duration">${formatTime(Math.floor(entry.totalDuration / 1000))}</div>
        <div class="history-exercises">${entry.completedExercises}/${entry.totalExercises} Übungen</div>
      </div>
    </div>
  `).join('');
}

function clearHistory() {
  if (confirm('Verlauf wirklich löschen?')) {
    history = [];
    saveHistory();
    renderHistory();
  }
}

// ===== Navigation =====
function goBack() {
  state.currentRoutineId = null;
  saveState();
  renderRoutineList();
  showView('routine-list');
}

// ===== Utilities =====
function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ===== Fullscreen Timer Mode =====
function openFullscreenTimer(exId, type) {
  const routine = state.routines.find(r => r.id === state.currentRoutineId);
  if (!routine) return;
  
  const ex = routine.exercises.find(e => e.id === exId);
  if (!ex || ex.type !== 'time') return;
  
  fullscreenState = {
    active: true,
    exerciseId: exId,
    exerciseData: ex
  };
  
  document.body.style.overflow = 'hidden';
  renderFullscreenTimer();
  document.getElementById('fullscreen-timer-overlay').classList.add('active');
}

function closeFullscreenTimer() {
  fullscreenState.active = false;
  document.body.style.overflow = '';
  document.getElementById('fullscreen-timer-overlay').classList.remove('active');
}

function renderFullscreenTimer() {
  const ex = fullscreenState.exerciseData;
  if (!ex) return;
  
  const timer = state.timers[ex.id] || { 
    running: false, 
    phase: 'work', 
    remainingSec: ex.durationSec, 
    currentSet: 1 
  };
  
  const isRest = timer.phase === 'rest';
  const timerClass = timer.running ? (isRest ? 'rest' : 'active') : '';
  const labelClass = timer.running ? (isRest ? 'rest' : 'active') : '';
  
  const overlay = document.getElementById('fullscreen-timer-overlay');
  overlay.innerHTML = `
    <button class="fullscreen-close-btn" onclick="closeFullscreenTimer()">
      ${ICONS.close}
    </button>
    
    <div class="fullscreen-exercise-name">${ex.name}</div>
    
    <div class="fullscreen-timer-value ${timerClass}">${formatTime(Math.ceil(timer.remainingSec))}</div>
    <div class="fullscreen-timer-label ${labelClass}">${isRest ? 'Pause' : 'Aktiv'}</div>
    <div class="fullscreen-set-indicator">Set ${timer.currentSet} / ${ex.sets}</div>
    
    <div class="fullscreen-controls">
      <button class="btn btn-secondary" onclick="closeFullscreenTimer()">
        ${ICONS.back}
        Zurück
      </button>
      <button class="btn btn-primary" onclick="toggleTimeExerciseFromFullscreen('${ex.id}', ${ex.durationSec}, ${ex.restSec}, ${ex.sets})">
        ${timer.running ? ICONS.pause : ICONS.play}
        ${timer.running ? 'Pause' : 'Start'}
      </button>
    </div>
  `;
}

function toggleTimeExerciseFromFullscreen(exId, duration, restSec, totalSets) {
  toggleTimeExercise(exId, duration, restSec, totalSets);
  if (fullscreenState.active) {
    renderFullscreenTimer();
  }
}

function updateFullscreenTimerIfActive(exId) {
  if (fullscreenState.active && fullscreenState.exerciseId === exId) {
    renderFullscreenTimer();
  }
}

// ===== Image Zoom =====
function openImageZoom(imageSrc) {
  if (!imageSrc) return;
  
  imageZoomState = {
    active: true,
    imageSrc: imageSrc
  };
  
  document.body.style.overflow = 'hidden';
  renderImageZoom();
  document.getElementById('image-zoom-overlay').classList.add('active');
}

function closeImageZoom() {
  imageZoomState.active = false;
  document.body.style.overflow = '';
  document.getElementById('image-zoom-overlay').classList.remove('active');
}

function renderImageZoom() {
  const overlay = document.getElementById('image-zoom-overlay');
  overlay.innerHTML = `
    <div class="image-zoom-container">
      <button class="image-zoom-close" onclick="closeImageZoom()">
        ${ICONS.close}
      </button>
      <img src="${imageZoomState.imageSrc}" alt="Exercise" class="image-zoom-img"/>
    </div>
  `;
}

// ===== Stopwatch Update Interval =====
let stopwatchInterval;

function startStopwatchUpdate() {
  stopwatchInterval = setInterval(() => {
    if (state.routineStopwatch.running && document.getElementById('routine-detail').classList.contains('active')) {
      renderStopwatch();
    }
  }, 1000);
}

// ===== Initialization =====
async function init() {
  loadState();
  loadHistory();
  await loadRoutines();
  
  // Create overlay elements
  createOverlays();
  
  renderRoutineList();
  renderHistory();
  
  // Setup navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      if (viewId === 'routine-list') {
        goBack();
      } else {
        showView(viewId);
        if (viewId === 'history') {
          renderHistory();
        }
      }
    });
  });
  
  // Clear history button
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
  
  // Restore last view
  if (state.currentRoutineId) {
    renderRoutineDetail();
    showView('routine-detail');
  } else {
    showView('routine-list');
  }
  
  startStopwatchUpdate();
}

function createOverlays() {
  // Create fullscreen timer overlay
  const fullscreenOverlay = document.createElement('div');
  fullscreenOverlay.id = 'fullscreen-timer-overlay';
  fullscreenOverlay.className = 'fullscreen-timer-overlay';
  document.body.appendChild(fullscreenOverlay);
  
  // Create image zoom overlay
  const imageOverlay = document.createElement('div');
  imageOverlay.id = 'image-zoom-overlay';
  imageOverlay.className = 'image-zoom-overlay';
  imageOverlay.onclick = (e) => {
    if (e.target === imageOverlay) {
      closeImageZoom();
    }
  };
  document.body.appendChild(imageOverlay);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
