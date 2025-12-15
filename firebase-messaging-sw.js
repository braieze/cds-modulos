window.NotificationLogic = {
    // Tu clave real de Firebase Console (VAPID)
    VAPID_KEY: "BHfJ1SQOqfljjMHYhfhYeEii6KSzooMUTIXDd5AT6g48qWj5l6uG5d6n-ZdyShPQM4xiAGM0kALUZwVQ-0an6KA", 
    
    // --- ¡ATENCIÓN! PEGA AQUÍ TU CLAVE DE SERVIDOR (EMPIEZA CON AAAA...) ---
    // Ve a Firebase Console > Configuración > Cloud Messaging > Cloud Messaging API (Legacy)
    // Si no está habilitada, habilítala en los 3 puntitos.
    SERVER_KEY: "AIzaSyDDgNWktwBOYS1fnwGngHVRgWkhm-7QLMA", 

    // Función para enviar la notificación real a los dispositivos
    sendPushNotification: async (tokens, title, body) => {
        if (!tokens || tokens.length === 0) return;
        
        // Limpiamos tokens duplicados y nulos
        const uniqueTokens = [...new Set(tokens)].filter(t => t);
        if (uniqueTokens.length === 0) return;

        console.log("Enviando push a", uniqueTokens.length, "dispositivos...");

        try {
            // Enviamos usando la API Legacy de FCM (la más fácil para usar desde el cliente)
            const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `key=${window.NotificationLogic.SERVER_KEY}`
                },
                body: JSON.stringify({
                    registration_ids: uniqueTokens,
                    notification: {
                        title: title,
                        body: body,
                        icon: '/icon-192.png', // Asegúrate de que este ícono exista
                        click_action: '/'
                    }
                })
            });

            if (response.ok) {
                console.log("Notificaciones enviadas con éxito.");
            } else {
                console.error("Error al enviar push:", await response.text());
            }
        } catch (error) {
            console.error("Error de red al enviar push:", error);
        }
    },

    // --- Escuchar mensajes mientras la app está abierta ---
    listenForMessages: () => {
        try {
            const messaging = firebase.messaging();
            messaging.onMessage((payload) => {
                console.log('Notificación recibida en primer plano:', payload);
                const { title, body } = payload.notification || {};
                window.Utils.notify(`🔔 ${title}: ${body}`, "brand");
            });
        } catch (e) {
            console.log("Messaging no soportado o error al iniciar listener:", e);
        }
    },

    requestPermission: async (userProfile) => {
        if (!('Notification' in window)) {
            window.Utils.notify("Este dispositivo no soporta notificaciones.", "error");
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                window.Utils.notify("Permiso concedido. Configurando...", "success");
                const messaging = firebase.messaging();
                const registration = await navigator.serviceWorker.ready;

                const token = await messaging.getToken({ 
                    vapidKey: window.NotificationLogic.VAPID_KEY,
                    serviceWorkerRegistration: registration 
                });

                if (token) {
                    window.NotificationLogic.listenForMessages();

                    if (userProfile && userProfile.id) {
                        await window.db.collection('members').doc(userProfile.id).update({
                            pushToken: token,
                            deviceType: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iOS' : 'Android',
                            updatedAt: new Date().toISOString()
                        });
                        window.Utils.notify("¡Notificaciones Activadas con Éxito!", "success");
                    }
                } else {
                    window.Utils.notify("No se pudo obtener el token ID.", "error");
                }
            } else {
                window.Utils.notify("Permiso denegado.", "error");
            }
        } catch (error) {
            console.error("Error notificaciones detailed:", error);
            if (error.code === 'messaging/failed-service-worker-registration') {
                 window.Utils.notify("Error de configuración SW.", "error");
            } else {
                 window.Utils.notify("Error al activar: " + error.message, "error");
            }
        }
    }
};
