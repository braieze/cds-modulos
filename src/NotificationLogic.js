window.NotificationLogic = {
    // Tu clave real de Firebase Console
    VAPID_KEY: "BHfJ1SQOqfljjMHYhfhYeEii6KSzooMUTIXDd5AT6g48qWj5l6uG5d6n-ZdyShPQM4xiAGM0kALUZwVQ-0an6KA", 

    requestPermission: async (userProfile) => {
        if (!('Notification' in window)) {
            alert("Este dispositivo no soporta notificaciones.");
            return;
        }

        try {
            // 1. Pedir permiso explícito al usuario
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                window.Utils.notify("Permiso concedido. Obteniendo credenciales...", "success");

                const messaging = firebase.messaging();
                
                // 2. Obtener el Token único del dispositivo
                const token = await messaging.getToken({ vapidKey: window.NotificationLogic.VAPID_KEY });

                if (token) {
                    console.log("Token obtenido:", token);
                    
                    // 3. Guardar el token en el perfil del usuario (Firestore)
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
                window.Utils.notify("Permiso denegado. Habilítalo en Configuración > Safari > Avanzado (o Configuración de la Web App en Inicio).", "error");
            }
        } catch (error) {
            console.error("Error notificaciones:", error);
            window.Utils.notify("Error al activar: " + error.message, "error");
        }
    }
};
