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
        const subscribe = (col, setter) => {
            unsubs.push(
                window.db.collection(col).onSnapshot(snap => {
                    setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }, error => console.error(`Error en ${col}:`, error))
            );
        };
        Object.entries(callbacks).forEach(([col, setter]) => subscribe(col, setter));
        
        // Listener seguro para posts (evita error si no existe)
        if (!callbacks.posts) {
            unsubs.push(window.db.collection('posts').orderBy('date', 'desc').limit(5).onSnapshot(()=>{}));
        }

        return () => unsubs.forEach(u => u());
    }, [userProfile]);
};

// GENERADOR DE DATOS DE PRUEBA (SOLO PARA FINANZAS)
window.DataLogic.generateDemoFinances = async () => {
    const { db } = window;
    const batch = db.batch();
    
    // Octubre 2025
    batch.set(db.collection('finances').doc(), { type: 'Culto', date: '2025-10-05', tithesCash: 50000, offeringsCash: 20000, total: 70000, category: 'General' });
    batch.set(db.collection('finances').doc(), { type: 'Gasto', date: '2025-10-10', amount: -15000, total: -15000, category: 'Mantenimiento', method: 'Efectivo', notes: 'Limpieza' });
    batch.set(db.collection('finances').doc(), { type: 'Culto', date: '2025-10-12', tithesCash: 60000, offeringsCash: 25000, total: 85000, category: 'General' });
    
    // Noviembre 2025
    batch.set(db.collection('finances').doc(), { type: 'Culto', date: '2025-11-02', tithesCash: 55000, offeringsCash: 22000, total: 77000, category: 'General' });
    batch.set(db.collection('finances').doc(), { type: 'Gasto', date: '2025-11-05', amount: -40000, total: -40000, category: 'Alquiler', method: 'Banco', notes: 'Alquiler Templo' });
    batch.set(db.collection('finances').doc(), { type: 'Culto', date: '2025-11-09', tithesCash: 65000, offeringsCash: 30000, total: 95000, category: 'General' });

    await batch.commit();
    window.Utils.notify("Datos de prueba generados (Oct/Nov 2025)");
};
