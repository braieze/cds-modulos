// src/DataLogic.js
window.DataLogic = {};

window.DataLogic.addData = (col, data) => window.db.collection(col).add(data);
window.DataLogic.updateData = (col, id, data) => window.db.collection(col).doc(id).update(data);
window.DataLogic.deleteData = (col, id) => { if(window.confirm("¿Seguro?")) window.db.collection(col).doc(id).delete(); };

window.DataLogic.useFirebaseListeners = (userProfile, callbacks) => {
    const { useEffect } = React;
    useEffect(() => {
        if (!userProfile) return;
        const unsubs = [];
        
        // Helper para suscribirse
        const subscribe = (col, setter) => {
            unsubs.push(
                window.db.collection(col).onSnapshot(snap => {
                    setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }, error => console.error(`Error en ${col}:`, error))
            );
        };

        // Suscribir colecciones explícitas
        Object.entries(callbacks).forEach(([col, setter]) => subscribe(col, setter));
        
        // Agregar 'posts' si no está
        if (!callbacks.posts) {
            unsubs.push(window.db.collection('posts').orderBy('date', 'desc').onSnapshot(s => {}, e => {}));
        }

        return () => unsubs.forEach(u => u());
    }, [userProfile]);
};
