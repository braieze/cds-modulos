window.NotificationLogic = {
    // Tu clave real de Firebase Console
    VAPID_KEY: "BHfJ1SQOqfljjMHYhfhYeEii6KSzooMUTIXDd5AT6g48qWj5l6uG5d6n-ZdyShPQM4xiAGM0kALUZwVQ-0an6KA", 

    requestPermission: async (userProfile) => {
        // 1. Verificación básica de soporte
        if (!('Notification' in window)) {
            window.Utils.notify("Este dispositivo no soporta notificaciones.", "error");
            return;
        }

        try {
            // 2. Pedir permiso explícito al usuario
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                window.Utils.notify("Permiso concedido. Configurando...", "success");

                const messaging = firebase.messaging();
                
                // --- CORRECCIÓN CRÍTICA PARA EL ERROR DE LA IMAGEN ---
                // Esperamos a que el Service Worker registrado en index.html esté listo.
                // Esto evita que Firebase intente buscar 'firebase-messaging-sw.js' en la raíz equivocada.
                const registration = await navigator.serviceWorker.ready;

                // 3. Obtener el Token usando el registro existente
                const token = await messaging.getToken({ 
                    vapidKey: window.NotificationLogic.VAPID_KEY,
                    serviceWorkerRegistration: registration 
                });

                if (token) {
                    console.log("Token obtenido:", token);
                    
                    // 4. Guardar el token en Firestore
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
                window.Utils.notify("Permiso denegado. Revisa la configuración del navegador.", "error");
            }
        } catch (error) {
            console.error("Error notificaciones detailed:", error);
            // Mensaje amigable si es el error de la imagen
            if (error.code === 'messaging/failed-service-worker-registration') {
                 window.Utils.notify("Error de configuración: El Service Worker no se encontró.", "error");
            } else {
                 window.Utils.notify("Error al activar: " + error.message, "error");
            }
        }
    }
};
