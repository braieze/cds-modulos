// src/DataLogic.js
window.DataLogic = {};

// 1. CONFIGURACIÓN E INICIALIZACIÓN (Movido aquí para evitar errores)
const firebaseConfig = {
    apiKey: "AIzaSyDXK_EcXsFGhRmXfkKG8SMdsM69c4PNfHw",
    authDomain: "conquistadoresapp.firebaseapp.com",
    projectId: "conquistadoresapp",
    storageBucket: "conquistadoresapp.firebasestorage.app",
    messagingSenderId: "518647225464",
    appId: "1:518647225464:web:b3344ca5172498187e218d"
};

// Verificar si ya existe para no inicializar doble
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 2. DEFINIR VARIABLES GLOBALES DE FIREBASE
const db = firebase.firestore();
const auth = firebase.auth(); // También definimos auth aquí para uso interno

// --- EXPORTAR FUNCIONES AL OBJETO GLOBAL ---

// Helpers CRUD
window.DataLogic.addData = (col, data) => db.collection(col).add(data);
window.DataLogic.updateData = (col, id, data) => db.collection(col).doc(id).update(data);
window.DataLogic.deleteData = (col, id) => { if(window.confirm("¿Seguro?")) db.collection(col).doc(id).delete(); };

// Exportar Auth providers para usarlos en el Login
window.DataLogic.auth = auth;
window.DataLogic.googleProvider = new firebase.auth.GoogleAuthProvider();

// Hook personalizado para suscribirse a datos
window.DataLogic.useFirebaseListeners = (userProfile, callbacks) => {
    const { useEffect } = React;
    
    useEffect(() => {
        if (!userProfile) return;
        const unsubs = [];
        
        // Función genérica de suscripción
        const subscribe = (col, setter) => {
            unsubs.push(
                db.collection(col).onSnapshot(snap => {
                    setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }, error => {
                    console.error(`Error en colección ${col}:`, error);
                })
            );
        };

        // Ejecutar suscripciones
        Object.entries(callbacks).forEach(([collectionName, setterFunction]) => {
            subscribe(collectionName, setterFunction);
        });

        return () => unsubs.forEach(u => u());
    }, [userProfile]);
};
