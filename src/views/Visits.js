window.Views = window.Views || {};

window.Views.Visits = ({ userProfile }) => {
    // 1. HOOKS
    const { useState, useEffect, useMemo } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal, Select, Badge, Card, SmartSelect } = Utils;

    // 2. ESTADOS
    const [visits, setVisits] = useState([]);
    const [members, setMembers] = useState([]); // Para seleccionar a quién visitar y a quién asignar
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('my_visits'); // 'my_visits' | 'management' | 'history'
    
    // Modales
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState(null);

    // Formularios
    const initialForm = { memberId: '', reason: 'Rutina', priority: 'Media', notes: '' };
    const [createForm, setCreateForm] = useState(initialForm);
    const [reportForm, setReportForm] = useState({ outcome: 'Realizada', notes: '', needsFollowUp: false });
    const [assignForm, setAssignForm] = useState({ leaderId: '' });

    const isPastor = userProfile.role === 'Pastor';

    // 3. CONEXIÓN FIREBASE (DOBLE SUSCRIPCIÓN)
    useEffect(() => {
        if (!window.db) return;

        // A. Escuchar Visitas
        const unsubVisits = window.db.collection('visits').orderBy('createdAt', 'desc').onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVisits(data);
            setLoading(false);
        });

        // B. Escuchar Miembros (Para los selectores)
        const unsubMembers = window.db.collection('members').onSnapshot(snap => {
            setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubVisits(); unsubMembers(); };
    }, []);

    // 4. HELPERS
    const getPhoto = (url, name) => {
        if (url && url.length > 10) {
            if (url.includes('drive.google.com')) {
                const idMatch = url.match(/[-\w]{25,}/);
                if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
            }
            return url;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0f172a&color=cbd5e1`;
    };

    const getMemberName = (id) => members.find(m => m.id === id)?.name || 'Desconocido';
    const getMemberAddress = (id) => members.find(m => m.id === id)?.address || '';
    const getMemberPhone = (id) => members.find(m => m.id === id)?.phone || '';

    // Opciones para Selectores
    const memberOptions = useMemo(() => members.map(m => ({ value: m.id, label: m.name })), [members]);
    const leaderOptions = useMemo(() => members.filter(m => ['Pastor', 'Líder', 'Servidor'].includes(m.role)).map(m => ({ value: m.id, label: m.name })), [members]);

    // 5. ACCIONES
    const handleCreate = async () => {
        if (!createForm.memberId) return Utils.notify("Selecciona un miembro", "error");
        
        const member = members.find(m => m.id === createForm.memberId);
        
        const newVisit = {
            memberId: createForm.memberId,
            memberName: member.name,
            address: member.address || 'Sin dirección',
            phone: member.phone || '',
            photo: member.photo || '',
            reason: createForm.reason,
            priority: createForm.priority,
            status: 'Pendiente', // Pendiente -> Asignada -> Realizada
            requestedBy: userProfile.name,
            createdAt: new Date().toISOString(),
            logs: []
        };

        try {
            await window.db.collection('visits').add(newVisit);
            Utils.notify("Solicitud de visita creada");
            setIsCreateOpen(false);
            setCreateForm(initialForm);
        } catch (e) { console.error(e); Utils.notify("Error al crear", "error"); }
    };

    const handleAssign = async () => {
        if (!assignForm.leaderId) return Utils.notify("Selecciona un líder", "error");
        const leader = members.find(m => m.id === assignForm.leaderId);

        try {
            await window.db.collection('visits').doc(selectedVisit.id).update({
                status: 'Asignada',
                assignedToId: leader.id,
                assignedToName: leader.name,
                assignedAt: new Date().toISOString()
            });
            Utils.notify(`Asignado a ${leader.name}`);
            setIsAssignOpen(false);
        } catch (e) { console.error(e); Utils.notify("Error al asignar", "error"); }
    };

    const handleReport = async () => {
        if (!reportForm.notes) return Utils.notify("Escribe una nota pastoral", "error");

        try {
            await window.db.collection('visits').doc(selectedVisit.id).update({
                status: 'Realizada',
                outcome: reportForm.outcome,
                visitNotes: reportForm.notes,
                needsFollowUp: reportForm.needsFollowUp,
                completedAt: new Date().toISOString(),
                completedBy: userProfile.name
            });
            Utils.notify("Visita reportada. ¡Gracias!");
            setIsReportOpen(false);
        } catch (e) { console.error(e); Utils.notify("Error al reportar", "error"); }
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar esta solicitud?")) return;
        await window.db.collection('visits').doc(id).delete();
        Utils.notify("Eliminado");
    };

    // 6. FILTROS DE LISTA
    const filteredVisits = useMemo(() => {
        if (activeTab === 'my_visits') {
            // Muestro lo asignado a mí Y lo que está pendiente si soy pastor (para que no se pierda)
            return visits.filter(v => v.status !== 'Realizada' && (v.assignedToId === userProfile.id || (isPastor && v.status === 'Pendiente')));
        }
        if (activeTab === 'management') {
            return visits.filter(v => v.status !== 'Realizada');
        }
        if (activeTab === 'history') {
            return visits.filter(v => v.status === 'Realizada');
        }
        return [];
    }, [visits, activeTab, userProfile]);

    // --- COMPONENTE DE TARJETA ---
    const VisitCard = ({ visit }) => {
        const isUrgent = visit.priority === 'Alta';
        const isAssignedToMe = visit.assignedToId === userProfile.id;
        
        return (
            <div className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 transition-all hover:shadow-md ${isUrgent ? 'border-l-red-500' : (visit.status==='Asignada' ? 'border-l-blue-500' : 'border-l-orange-400')}`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <img src={getPhoto(visit.photo, visit.memberName)} className="w-10 h-10 rounded-full object-cover bg-slate-100" />
                        <div>
                            <h3 className="font-bold text-slate-800 leading-tight">{visit.memberName}</h3>
                            <p className="text-xs text-slate-500">{visit.reason}</p>
                        </div>
                    </div>
                    <Badge type={visit.status === 'Pendiente' ? 'warning' : (visit.status==='Realizada'?'success':'blue')}>
                        {visit.status}
                    </Badge>
                </div>

                <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-start gap-2 text-xs text-slate-600">
                        <Icon name="MapPin" size={14} className="text-brand-500 mt-0.5 shrink-0"/>
                        <span className="leading-tight">{visit.address || 'Sin dirección registrada'}</span>
                    </div>
                    {visit.assignedToName && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Icon name="User" size={14} className="text-brand-500 shrink-0"/>
                            <span>Responsable: <strong>{visit.assignedToName}</strong></span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 justify-end">
                    {/* Botones de Acción según estado */}
                    
                    {/* Si está pendiente y soy Pastor -> ASIGNAR */}
                    {visit.status === 'Pendiente' && isPastor && (
                        <button onClick={() => { setSelectedVisit(visit); setIsAssignOpen(true); }} className="flex-1 bg-slate-800 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-700">
                            <Icon name="UserPlus" size={14}/> Asignar
                        </button>
                    )}

                    {/* Si está asignada a mí -> REPORTAR o VISITAR */}
                    {(isAssignedToMe || (isPastor && visit.status !== 'Realizada')) && (
                        <>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.address)}`} target="_blank" className="bg-brand-50 text-brand-600 p-2 rounded-lg hover:bg-brand-100 border border-brand-200">
                                <Icon name="MapPin" size={18}/>
                            </a>
                            <a href={`https://wa.me/${visit.phone.replace(/\D/g,'')}`} target="_blank" className="bg-emerald-50 text-emerald-600 p-2 rounded-lg hover:bg-emerald-100 border border-emerald-200">
                                <Icon name="MessageCircle" size={18}/>
                            </a>
                            <button onClick={() => { setSelectedVisit(visit); setIsReportOpen(true); }} className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-brand-700 shadow-sm">
                                <Icon name="Check" size={14}/> Finalizar
                            </button>
                        </>
                    )}

                    {/* Botón borrar (Solo admin) */}
                    {isPastor && (
                        <button onClick={() => handleDelete(visit.id)} className="text-slate-300 hover:text-red-500 p-2">
                            <Icon name="Trash" size={16}/>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 fade-in pb-24 font-sans text-slate-800">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Visitas</h2>
                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{visits.filter(v=>v.status!=='Realizada').length} Activas</span>
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={()=>setActiveTab('my_visits')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='my_visits'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Mi Agenda</button>
                    {isPastor && <button onClick={()=>setActiveTab('management')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='management'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Gestión</button>}
                    <button onClick={()=>setActiveTab('history')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='history'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Historial</button>
                </div>
            </div>

            {/* Botón Crear Flotante o en Header */}
            <div className="flex justify-end">
                <Button icon="Plus" onClick={() => setIsCreateOpen(true)}>Nueva Visita</Button>
            </div>

            {/* LISTADO DE TARJETAS */}
            {loading ? <div className="text-center py-10 text-slate-400">Cargando...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVisits.length > 0 ? (
                        filteredVisits.map(visit => <VisitCard key={visit.id} visit={visit} />)
                    ) : (
                        <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                            <Icon name="Smile" size={40} className="mx-auto text-slate-300 mb-2"/>
                            <p className="text-slate-500 font-medium">No hay visitas en esta sección.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- MODALES --- */}

            {/* 1. CREAR SOLICITUD */}
            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Programar Visita">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label className="label-modern mb-2">Miembro a visitar</label>
                        <SmartSelect 
                            options={memberOptions} 
                            value={createForm.memberId} 
                            onChange={val => setCreateForm({...createForm, memberId: val})} 
                            placeholder="Buscar persona..."
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Motivo" value={createForm.reason} onChange={e => setCreateForm({...createForm, reason: e.target.value})}>
                            <option>Rutina</option>
                            <option>Enfermedad</option>
                            <option>Duelo</option>
                            <option>Nuevo Convertido</option>
                            <option>Ausencia</option>
                            <option>Cumpleaños</option>
                        </Select>
                        <Select label="Prioridad" value={createForm.priority} onChange={e => setCreateForm({...createForm, priority: e.target.value})}>
                            <option>Baja</option>
                            <option>Media</option>
                            <option>Alta</option>
                        </Select>
                    </div>

                    <Button className="w-full mt-4" onClick={handleCreate}>Crear Solicitud</Button>
                </div>
            </Modal>

            {/* 2. ASIGNAR LÍDER */}
            <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title="Asignar Responsable">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 mb-2">
                        ¿Quién realizará la visita a <strong>{selectedVisit?.memberName}</strong>?
                    </p>
                    <SmartSelect 
                        options={leaderOptions} 
                        value={assignForm.leaderId} 
                        onChange={val => setAssignForm({leaderId: val})} 
                        placeholder="Seleccionar Líder/Servidor..."
                    />
                    <Button className="w-full mt-4" onClick={handleAssign}>Confirmar Asignación</Button>
                </div>
            </Modal>

            {/* 3. REPORTAR VISITA */}
            <Modal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} title="Reporte de Visita">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500 mb-2">Completa la bitácora para finalizar.</p>
                    
                    <Select label="Resultado" value={reportForm.outcome} onChange={e => setReportForm({...reportForm, outcome: e.target.value})}>
                        <option>Realizada</option>
                        <option>No estaba</option>
                        <option>Reprogramada</option>
                    </Select>

                    <div>
                        <label className="label-modern mb-1">Notas Pastorales</label>
                        <textarea 
                            className="input-modern h-32 text-sm" 
                            placeholder="¿Cómo lo encontraste? ¿Hubo alguna necesidad específica?"
                            value={reportForm.notes}
                            onChange={e => setReportForm({...reportForm, notes: e.target.value})}
                        ></textarea>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <input 
                            type="checkbox" 
                            checked={reportForm.needsFollowUp} 
                            onChange={e => setReportForm({...reportForm, needsFollowUp: e.target.checked})}
                            className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm font-bold text-slate-700">Requiere seguimiento urgente (Avisar Pastor)</span>
                    </div>

                    <Button className="w-full mt-2" onClick={handleReport}>Guardar Reporte</Button>
                </div>
            </Modal>

        </div>
    );
};
