// -------------------------------------------------------------------------
// ESTE ARCHIVO DEBE IR EN LA RAÍZ (AL LADO DE INDEX.HTML)
// NOMBRE OBLIGATORIO: firebase-messaging-sw.js
// -------------------------------------------------------------------------

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 1. Configuración de Firebase (Debe coincidir con la de index.html)
firebase.initializeApp({
    apiKey: "AIzaSyDXK_EcXsFGhRmXfkKG8SMdsM69c4PNfHw",
    authDomain: "conquistadoresapp.firebaseapp.com",
    projectId: "conquistadoresapp",
    storageBucket: "conquistadoresapp.firebasestorage.app",
    messagingSenderId: "518647225464",
    appId: "1:518647225464:web:b3344ca5172498187e218d"
});

// 2. Inicializar Messaging en segundo plano
const messaging = firebase.messaging();

// 3. Manejar notificaciones cuando la app está CERRADA o en 2do plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificación en 2do plano:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png', // Asegúrate de tener este ícono o uno similar en tu carpeta
    badge: '/icon-192.png',
    // Opciones extra para móviles
    vibrate: [100, 50, 100],
    data: {
        url: payload.data?.click_action || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Listener para abrir la app al tocar la notificación
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notificación clickeada.');
    event.notification.close();

    // Intentar abrir la ventana
    event.waitUntil(
        clients.matchAll({type: 'window'}).then( windowClients => {
            // Si ya está abierta, enfocarla
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
