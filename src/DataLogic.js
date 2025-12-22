// src/DataLogic.js
window.DataLogic = {};

// --- 1. OPERACIONES CRUD (CREATE, READ, UPDATE, DELETE) ---

// Agregar documento (con fecha de creación automática si no viene)
window.DataLogic.addData = async (col, data) => {
    try {
        const payload = { 
            ...data, 
            createdAt: data.createdAt || new Date().toISOString() 
        };
        await window.db.collection(col).add(payload);
        return true;
    } catch (error) {
        console.error(`Error al agregar en ${col}:`, error);
        window.Utils.notify("Error al guardar datos", "error");
        return false;
    }
};

// Actualizar documento
window.DataLogic.updateData = async (col, id, data) => {
    try {
        // Evitamos sobreescribir el ID o createdAt accidentalmente
        const { id: _, ...cleanData } = data; 
        await window.db.collection(col).doc(id).update(cleanData);
        return true;
    } catch (error) {
        console.error(`Error actualizando ${col}/${id}:`, error);
        window.Utils.notify("Error al actualizar", "error");
        return false;
    }
};

// Eliminar documento (SIN CONFIRMACIÓN - La UI debe preguntar antes)
window.DataLogic.deleteData = async (col, id) => {
    try {
        await window.db.collection(col).doc(id).delete();
        return true;
    } catch (error) {
        console.error(`Error eliminando ${col}/${id}:`, error);
        window.Utils.notify("Error al eliminar", "error");
        return false;
    }
};

// --- 2. LISTENERS INTELIGENTES (EL MOTOR) ---

/**
 * Hook para escuchar múltiples colecciones de Firestore en tiempo real.
 * Soporta configuración avanzada para limitar datos y mejorar rendimiento.
 * * @param {Object} userProfile - Usuario actual (para activar listeners)
 * @param {Object} config - Objeto de configuración. 
 * Ejemplo:
 * {
 * members: setMembers, // Modo Simple (Trae todo)
 * messages: {          // Modo Avanzado
 * setter: setMessages,
 * orderBy: 'date',
 * orderDir: 'desc',
 * limit: 50
 * }
 * }
 */
window.DataLogic.useFirebaseListeners = (userProfile, config) => {
    const { useEffect } = React;

    useEffect(() => {
        if (!userProfile) return;

        const unsubs = [];

        // Recorremos cada colección solicitada
        Object.entries(config).forEach(([collectionName, options]) => {
            
            // Normalizar opciones (si solo pasaron la función setter, la convertimos a objeto)
            let opts = typeof options === 'function' ? { setter: options } : options;
            
            // 1. Iniciar Referencia
            let query = window.db.collection(collectionName);

            // 2. Aplicar Filtros (Where)
            // Ejemplo: where: ['status', '==', 'Activo']
            if (opts.where && Array.isArray(opts.where) && opts.where.length === 3) {
                query = query.where(opts.where[0], opts.where[1], opts.where[2]);
            }

            // 3. Aplicar Orden (OrderBy)
            if (opts.orderBy) {
                query = query.orderBy(opts.orderBy, opts.orderDir || 'asc');
            }

            // 4. Aplicar Límite (Limit) - VITAL PARA RENDIMIENTO
            if (opts.limit) {
                query = query.limit(opts.limit);
            }

            // 5. Activar Listener
            const unsubscribe = query.onSnapshot(
                (snapshot) => {
                    const data = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    // Ejecutar el setter de React para actualizar la vista
                    opts.setter(data);
                },
                (error) => {
                    console.error(`🔥 Error escuchando ${collectionName}:`, error);
                    // Opcional: Notificar al usuario si es crítico
                }
            );

            unsubs.push(unsubscribe);
        });

        // Limpieza al desmontar o cambiar usuario
        return () => unsubs.forEach(u => u());

    }, [userProfile]); // Solo se reinicia si cambia el usuario
};

// --- 3. UTILIDADES DE DATOS ---

// Generador de Datos Demo (Opcional, útil para pruebas)
window.DataLogic.generateDemoFinances = async () => {
    const { db } = window;
    const batch = db.batch();
    
    const demos = [
        { type: 'Culto', date: '2025-10-05', tithesCash: 50000, offeringsCash: 20000, total: 70000, category: 'General' },
        { type: 'Gasto', date: '2025-10-10', amount: -15000, total: -15000, category: 'Mantenimiento', method: 'Efectivo', notes: 'Limpieza' },
        { type: 'Culto', date: '2025-10-12', tithesCash: 60000, offeringsCash: 25000, total: 85000, category: 'General' },
        { type: 'Gasto', date: '2025-11-05', amount: -40000, total: -40000, category: 'Alquiler', method: 'Banco', notes: 'Alquiler Templo' }
    ];

    demos.forEach(d => {
        const ref = db.collection('finances').doc();
        batch.set(ref, { ...d, createdAt: new Date().toISOString() });
    });

    await batch.commit();
    window.Utils.notify("Datos de prueba generados");
};
