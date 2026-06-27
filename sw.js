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
    // Focus session ended
    if (timerState.currentSession >= timerState.totalSessions) {
      // All sessions done
      timerState.currentSession = 1;
      timerState.isBreak = false;
      timerState.timeLeft = timerState.focusMin * 60;
      timerState.totalTime = timerState.focusMin * 60;
      timerState.running = false;
      showNotification('All done! 🎉', 'You completed all ' + timerState.totalSessions + ' sessions. Great work!', false);
      broadcastState();
      return;
    }
    // Switch to break, pause and wait for manual start
    timerState.isBreak = true;
    timerState.timeLeft = timerState.breakMin * 60;
    timerState.totalTime = timerState.breakMin * 60;
    timerState.running = false;
    showNotification('Break time! ☕', 'Focus done. Press play when ready for your break.', true);
  } else {
    // Break ended, switch to next focus session, pause and wait
    timerState.currentSession++;
    timerState.isBreak = false;
    timerState.timeLeft = timerState.focusMin * 60;
    timerState.totalTime = timerState.focusMin * 60;
    timerState.running = false;
    showNotification('Break over!', 'Session ' + timerState.currentSession + ' of ' + timerState.totalSessions + ' — press play when ready.', true);
  }

  // Don't restart interval — wait for user to press play
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
