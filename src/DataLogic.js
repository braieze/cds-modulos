// src/DataLogic.js
window.DataLogic = {};

const db = firebase.firestore();

// Helpers CRUD
window.DataLogic.addData = (col, data) => db.collection(col).add(data);
window.DataLogic.updateData = (col, id, data) => db.collection(col).doc(id).update(data);
window.DataLogic.deleteData = (col, id) => { if(window.confirm("¿Seguro?")) db.collection(col).doc(id).delete(); };

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
                })
            );
        };

        // Ejecutar suscripciones pasadas en el objeto callbacks
        // Ejemplo: callbacks = { members: setMembers, finances: setFinances }
        Object.entries(callbacks).forEach(([collectionName, setterFunction]) => {
            subscribe(collectionName, setterFunction);
        });

        return () => unsubs.forEach(u => u());
    }, [userProfile]);
};
