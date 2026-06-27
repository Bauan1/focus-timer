const CACHE = 'focus-timer-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

let timerInterval = null;
let timerState = null;

self.addEventListener('message', e => {
  const { type, payload } = e.data;

  if (type === 'START_TIMER') {
    timerState = { ...payload };
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => tickTimer(), 1000);
  }

  if (type === 'PAUSE_TIMER') {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  if (type === 'RESET_TIMER') {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerState = null;
  }

  if (type === 'SYNC_STATE') {
    timerState = { ...payload };
  }
});

function tickTimer() {
  if (!timerState) return;

  timerState.timeLeft--;

  broadcastState();

  if (timerState.timeLeft <= 0) {
    handlePhaseEnd();
  }
}

function broadcastState() {
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'TICK', state: { ...timerState } }));
  });
}

function handlePhaseEnd() {
  clearInterval(timerInterval);
  timerInterval = null;

  const wasBreak = timerState.isBreak;

  if (!wasBreak) {
    if (timerState.currentSession >= timerState.totalSessions) {
      timerState.currentSession = 1;
      timerState.isBreak = false;
      timerState.timeLeft = timerState.focusMin * 60;
      timerState.totalTime = timerState.focusMin * 60;
      timerState.running = false;

      showNotification('All done!', 'You completed all ' + timerState.totalSessions + ' sessions. Great work!', false);
      broadcastState();
      return;
    }
    timerState.isBreak = true;
    timerState.timeLeft = timerState.breakMin * 60;
    timerState.totalTime = timerState.breakMin * 60;
    showNotification('Break time!', timerState.breakMin + ' min break started. Relax.', true);
  } else {
    timerState.currentSession++;
    timerState.isBreak = false;
    timerState.timeLeft = timerState.focusMin * 60;
    timerState.totalTime = timerState.focusMin * 60;
    showNotification('Focus time!', 'Session ' + timerState.currentSession + ' of ' + timerState.totalSessions + ' — let\'s go!', true);
  }

  timerInterval = setInterval(() => tickTimer(), 1000);
  broadcastState();
}

function showNotification(title, body, renotify) {
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'focus-timer',
    renotify,
    vibrate: [200, 100, 200],
    silent: false
  });
}
