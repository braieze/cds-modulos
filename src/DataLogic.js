// src/DataLogic.js
window.DataLogic = {};

// Usamos window.db que está definido en index.html
// Helpers CRUD
window.DataLogic.addData = (col, data) => window.db.collection(col).add(data);
window.DataLogic.updateData = (col, id, data) => window.db.collection(col).doc(id).update(data);
window.DataLogic.deleteData = (col, id) => { if(window.confirm("¿Seguro?")) window.db.collection(col).doc(id).delete(); };

// Hook personalizado para suscribirse a datos
window.DataLogic.useFirebaseListeners = (userProfile, callbacks) => {
    const { useEffect } = React;
    
    useEffect(() => {
        if (!userProfile) return;
        const unsubs = [];
        
        // Función genérica de suscripción con window.db
        const subscribe = (col, setter) => {
            unsubs.push(
                window.db.collection(col).onSnapshot(snap => {
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
