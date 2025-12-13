// --- 1. IMPORTAR LIBRERÍAS DE FIREBASE (Compat) ---
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// --- 2. CONFIGURACIÓN FIREBASE (Mismas credenciales que index.html) ---
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
    icon: '/icon-192.png', // Asegúrate de tener este icono o usa el enlace externo
    badge: '/badge-icon.png', // Icono pequeño para la barra de estado (blanco y negro preferiblemente)
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- 4. LÓGICA DE CACHÉ (Tu código original) ---
const CACHE_NAME = 'conquistadores-v1';
const urlsToCache = [
  './index.html',
  './src/Utils.js',
  './src/DataLogic.js',
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
  // Ignorar peticiones a Firebase o APIs externas para no romper la app si fallan
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
     return; 
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
