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
        if (!callbacks.posts) { unsubs.push(window.db.collection('posts').orderBy('date', 'desc').limit(5).onSnapshot(()=>{})); }
        return () => unsubs.forEach(u => u());
    }, [userProfile]);
};

// GENERADOR DE DATOS DE PRUEBA (OCT/NOV 2025)
window.DataLogic.generateDemoFinances = async () => {
    const { db } = window;
    const batch = db.batch();
    
    const demos = [
        { type: 'Culto', date: '2025-10-05', tithesCash: 50000, offeringsCash: 20000, total: 70000, category: 'General' },
        { type: 'Gasto', date: '2025-10-10', amount: -15000, total: -15000, category: 'Mantenimiento', method: 'Efectivo', notes: 'Limpieza' },
        { type: 'Culto', date: '2025-10-12', tithesCash: 60000, offeringsCash: 25000, total: 85000, category: 'General' },
        { type: 'Culto', date: '2025-11-02', tithesCash: 55000, offeringsCash: 22000, total: 77000, category: 'General' },
        { type: 'Gasto', date: '2025-11-05', amount: -40000, total: -40000, category: 'Alquiler', method: 'Banco', notes: 'Alquiler Templo' },
        { type: 'Culto', date: '2025-11-09', tithesCash: 65000, offeringsCash: 30000, total: 95000, category: 'General' }
    ];

    demos.forEach(d => {
        const ref = db.collection('finances').doc();
        batch.set(ref, { ...d, createdAt: new Date().toISOString() });
    });

    await batch.commit();
    window.Utils.notify("Datos de prueba generados (Oct/Nov 2025)");
};
