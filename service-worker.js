// --- 1. IMPORTAR LIBRERÍAS DE FIREBASE ---
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// --- 2. CONFIGURACIÓN FIREBASE ---
firebase.initializeApp({
   apiKey: "AIzaSyDXK_EcXsFGhRmXfkKG8SMdsM69c4PNfHw",
   authDomain: "conquistadoresapp.firebaseapp.com",
   projectId: "conquistadoresapp",
   storageBucket: "conquistadoresapp.firebasestorage.app",
   messagingSenderId: "518647225464",
   appId: "1:518647225464:web:b3344ca5172498187e218d"
});

// --- 3. MANEJAR NOTIFICACIONES EN SEGUNDO PLANO ---
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Notificación recibida:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/1909/1909849.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/1909/1909849.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- 4. LÓGICA DE CACHÉ ---
const CACHE_NAME = 'conquistadores-v2'; // Cambié a v2 para forzar actualización
const urlsToCache = [
  './index.html',
  './src/Utils.js',
  './src/DataLogic.js',
  './src/NotificationLogic.js', // ¡IMPORTANTE AGREGARLO!
  './src/views/Dashboard.js',
  './src/views/Directory.js',
  './src/views/Finances.js',
  './src/views/Worship.js',
  './src/views/MinistryWithTasks.js',
  './src/views/Messaging.js',
  './src/views/Blog.js',
  './src/views/EventDetails.js',
  './src/views/GlobalCalendar.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) return;
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
