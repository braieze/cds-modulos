window.Views = window.Views || {};

window.Views.Visits = ({ userProfile }) => {
    // 1. HOOKS
    const { useState, useEffect, useMemo } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal, Select, Badge, SmartSelect, formatDate } = Utils;

    // 2. ESTADOS
    const [visits, setVisits] = useState([]);
    const [members, setMembers] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('my_visits'); // 'my_visits' | 'management' | 'history'
    
    // Modales
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState(null); // Para ver detalles
    const [memberHistory, setMemberHistory] = useState(null); // Para ver historial de una persona

    // Formularios
    const initialForm = { memberId: '', reason: 'Rutina', priority: 'Media', notes: '', assignedToId: '', scheduledDate: '' };
    const [createForm, setCreateForm] = useState(initialForm);
    const [reportForm, setReportForm] = useState({ outcome: 'Realizada', notes: '', needsFollowUp: false });

    const isPastor = ['Pastor', 'Líder'].includes(userProfile.role);

    // 3. CONEXIÓN FIREBASE
    useEffect(() => {
        if (!window.db) return;

        // Escuchar Visitas
        const unsubVisits = window.db.collection('visits').orderBy('createdAt', 'desc').onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVisits(data);
            setLoading(false);
        });

        // Escuchar Miembros
        const unsubMembers = window.db.collection('members').onSnapshot(snap => {
            setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Chequear si venimos del Directorio con una orden de visita (Puente)
        if (window.tempVisitMember) {
            setCreateForm(prev => ({ ...prev, memberId: window.tempVisitMember.id }));
            setIsCreateOpen(true);
            window.tempVisitMember = null; // Limpiar
        }

        return () => { unsubVisits(); unsubMembers(); };
    }, []);

    // 4. HELPERS
    const getMember = (id) => members.find(m => m.id === id) || {};
    
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

    // Opciones para Selectores
    const memberOptions = useMemo(() => members.map(m => ({ value: m.id, label: m.name })), [members]);
    const leaderOptions = useMemo(() => members.filter(m => ['Pastor', 'Líder', 'Servidor', 'Diácono'].includes(m.role)).map(m => ({ value: m.id, label: m.name })), [members]);

    // 5. ACCIONES
    const handleCreate = async () => {
        if (!createForm.memberId) return Utils.notify("Selecciona un miembro", "error");
        
        const member = getMember(createForm.memberId);
        const assignedLeader = getMember(createForm.assignedToId); // Puede ser undefined si no se asignó

        const newVisit = {
            memberId: createForm.memberId,
            memberName: member.name || 'Desconocido',
            address: member.address || 'Sin dirección',
            phone: member.phone || '',
            photo: member.photo || '',
            reason: createForm.reason,
            priority: createForm.priority,
            
            // Lógica de estado inicial
            status: createForm.assignedToId ? 'Asignada' : 'Pendiente',
            
            // Asignación directa
            assignedToId: createForm.assignedToId || '',
            assignedToName: assignedLeader.name || '',
            scheduledDate: createForm.scheduledDate || '',
            
            requestedBy: userProfile.name,
            createdAt: new Date().toISOString(),
            notes: createForm.notes // Notas iniciales del pedido
        };

        try {
            await window.db.collection('visits').add(newVisit);
            Utils.notify(createForm.assignedToId ? `Asignada a ${assignedLeader.name}` : "Solicitud creada (Pendiente)");
            setIsCreateOpen(false);
            setCreateForm(initialForm);
        } catch (e) { console.error(e); Utils.notify("Error al crear", "error"); }
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
            setSelectedVisit(null);
        } catch (e) { console.error(e); Utils.notify("Error al reportar", "error"); }
    };

    const loadHistory = (memberId) => {
        const hist = visits.filter(v => v.memberId === memberId && v.status === 'Realizada');
        setMemberHistory({ name: getMember(memberId).name, list: hist });
    };

    // 6. FILTROS DE LISTA (Lógica Corregida)
    const filteredVisits = useMemo(() => {
        // 1. MI AGENDA: Solo lo asignado a mí, que no esté terminado.
        if (activeTab === 'my_visits') {
            return visits.filter(v => v.status !== 'Realizada' && v.assignedToId === userProfile.id);
        }
        // 2. GESTIÓN: Todo lo pendiente o asignado (Global). Solo para líderes.
        if (activeTab === 'management') {
            return visits.filter(v => v.status !== 'Realizada');
        }
        // 3. HISTORIAL: Todo lo terminado.
        if (activeTab === 'history') {
            return visits.filter(v => v.status === 'Realizada');
        }
        return [];
    }, [visits, activeTab, userProfile]);

    // --- COMPONENTE TARJETA ---
    const VisitCard = ({ visit }) => {
        const isUrgent = visit.priority === 'Alta';
        
        return (
            <div onClick={() => setSelectedVisit(visit)} className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 transition-all hover:shadow-md cursor-pointer group ${isUrgent ? 'border-l-red-500' : (visit.status==='Asignada' ? 'border-l-blue-500' : 'border-l-orange-400')}`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <img src={getPhoto(visit.photo, visit.memberName)} className="w-12 h-12 rounded-full object-cover bg-slate-100 border-2 border-white shadow-sm" />
                        <div>
                            <h3 className="font-bold text-slate-800 leading-tight text-lg">{visit.memberName}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span className={`font-bold ${isUrgent ? 'text-red-600' : 'text-slate-500'}`}>{visit.priority}</span>
                                <span>•</span>
                                <span>{visit.reason}</span>
                            </div>
                        </div>
                    </div>
                    {visit.status === 'Pendiente' && <Badge type="warning">Sin Asignar</Badge>}
                    {visit.status === 'Asignada' && <Badge type="blue">Agendada</Badge>}
                    {visit.status === 'Realizada' && <Badge type="success">Hecha</Badge>}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-slate-600">
                        <Icon name="MapPin" size={14} className="text-brand-500 mt-0.5 shrink-0"/>
                        <span className="leading-tight line-clamp-1">{visit.address || 'Sin dirección registrada'}</span>
                    </div>
                    {visit.scheduledDate && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Icon name="Calendar" size={14} className="text-brand-500 shrink-0"/>
                            <span>Programada: <strong>{formatDate(visit.scheduledDate)}</strong></span>
                        </div>
                    )}
                    {visit.assignedToName ? (
                        <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200">
                            <Icon name="User" size={14} className="text-blue-500 shrink-0"/>
                            <span>Visita: <strong>{visit.assignedToName}</strong></span>
                        </div>
                    ) : (
                        <div className="text-xs text-orange-600 font-bold flex items-center gap-1">
                            <Icon name="AlertCircle" size={12}/> Esperando asignación
                        </div>
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
                    <h2 className="text-2xl font-extrabold text-slate-800">Pastoral</h2>
                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">
                        {filteredVisits.length} {activeTab === 'history' ? 'Reportes' : 'Visitas'}
                    </span>
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={()=>setActiveTab('my_visits')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='my_visits'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Mi Agenda</button>
                    {isPastor && <button onClick={()=>setActiveTab('management')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='management'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Gestión</button>}
                    <button onClick={()=>setActiveTab('history')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='history'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Historial</button>
                </div>
            </div>

            {/* Botón Crear */}
            {isPastor && (
                <div className="flex justify-end">
                    <Button icon="Plus" onClick={() => setIsCreateOpen(true)}>Programar Visita</Button>
                </div>
            )}

            {/* LISTADO */}
            {loading ? <div className="text-center py-10 text-slate-400">Cargando visitas...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVisits.length > 0 ? (
                        filteredVisits.map(visit => <VisitCard key={visit.id} visit={visit} />)
                    ) : (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                            <Icon name="Smile" size={48} className="mb-4 opacity-20"/>
                            <p className="font-medium">¡Todo al día! No hay visitas aquí.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- MODALES --- */}

            {/* 1. CREAR / PROGRAMAR VISITA (Completo) */}
            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Programar Visita Pastoral">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
                    <div>
                        <label className="label-modern mb-2">Miembro a visitar</label>
                        <SmartSelect 
                            options={memberOptions} 
                            value={createForm.memberId} 
                            onChange={val => setCreateForm({...createForm, memberId: val})} 
                            placeholder="Buscar persona..."
                        />
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase">Detalles de la Asignación</h4>
                        
                        <div>
                            <label className="label-modern mb-1">Responsable (¿Quién va?)</label>
                            <SmartSelect 
                                options={leaderOptions} 
                                value={createForm.assignedToId} 
                                onChange={val => setCreateForm({...createForm, assignedToId: val})} 
                                placeholder="Seleccionar líder..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input type="date" label="Fecha Límite" value={createForm.scheduledDate} onChange={e => setCreateForm({...createForm, scheduledDate: e.target.value})} />
                            <Select label="Prioridad" value={createForm.priority} onChange={e => setCreateForm({...createForm, priority: e.target.value})}>
                                <option>Baja</option>
                                <option>Media</option>
                                <option>Alta</option>
                                <option>Urgente</option>
                            </Select>
                        </div>
                    </div>

                    <Select label="Motivo Principal" value={createForm.reason} onChange={e => setCreateForm({...createForm, reason: e.target.value})}>
                        <option>Rutina / Seguimiento</option>
                        <option>Enfermedad</option>
                        <option>Duelo</option>
                        <option>Nuevo Convertido</option>
                        <option>Ausencia Prolongada</option>
                        <option>Cumpleaños</option>
                        <option>Consejería</option>
                    </Select>

                    <div>
                        <label className="label-modern mb-1">Notas Iniciales</label>
                        <textarea className="input-modern h-24" placeholder="Detalles extra para el líder..." value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})}></textarea>
                    </div>

                    <Button className="w-full" onClick={handleCreate}>Confirmar Programación</Button>
                </div>
            </Modal>

            {/* 2. DETALLES DE VISITA & REPORTE */}
            {selectedVisit && (
                <Modal isOpen={!!selectedVisit} onClose={() => {setSelectedVisit(null); setMemberHistory(null);}} title="Detalle de Visita">
                    <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
                        
                        {/* Cabecera del Miembro */}
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <img src={getPhoto(selectedVisit.photo, selectedVisit.memberName)} className="w-16 h-16 rounded-full object-cover bg-white border shadow-sm" />
                            <div className="flex-1">
                                <h2 className="text-xl font-extrabold text-slate-800">{selectedVisit.memberName}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge type={selectedVisit.priority==='Alta'?'danger':'default'}>{selectedVisit.reason}</Badge>
                                    <button onClick={()=>loadHistory(selectedVisit.memberId)} className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1">
                                        <Icon name="Clock" size={12}/> Ver Historial
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Historial Desplegable */}
                        {memberHistory && (
                            <div className="bg-slate-100 p-4 rounded-xl animate-enter">
                                <h4 className="font-bold text-sm text-slate-700 mb-3">Historial de {memberHistory.name}</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {memberHistory.list.length > 0 ? memberHistory.list.map(h => (
                                        <div key={h.id} className="bg-white p-2 rounded border border-slate-200 text-xs">
                                            <div className="flex justify-between font-bold text-slate-600 mb-1">
                                                <span>{formatDate(h.completedAt)}</span>
                                                <span>{h.completedBy}</span>
                                            </div>
                                            <p className="text-slate-500 italic">"{h.visitNotes}"</p>
                                        </div>
                                    )) : <p className="text-xs text-slate-400">No hay visitas previas registradas.</p>}
                                </div>
                            </div>
                        )}

                        {/* Datos Operativos */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white border border-slate-200 p-3 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dirección</p>
                                <div className="flex items-start gap-2">
                                    <Icon name="MapPin" size={16} className="text-brand-500 mt-0.5 shrink-0"/>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedVisit.address)}`} target="_blank" className="text-sm font-medium text-slate-700 hover:text-brand-600 hover:underline leading-tight">
                                        {selectedVisit.address || 'Sin dirección'}
                                    </a>
                                </div>
                            </div>
                            <div className="bg-white border border-slate-200 p-3 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Responsable</p>
                                <div className="flex items-center gap-2">
                                    <Icon name="User" size={16} className="text-blue-500 shrink-0"/>
                                    <span className="text-sm font-medium text-slate-700">{selectedVisit.assignedToName || 'Sin asignar'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Formulario de Reporte (Solo si no está realizada) */}
                        {selectedVisit.status !== 'Realizada' ? (
                            <div className="bg-white border-2 border-brand-100 p-5 rounded-2xl shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Icon name="Clipboard" className="text-brand-600"/> Completar Reporte
                                </h3>
                                
                                <div className="space-y-4">
                                    <Select label="Resultado de la Visita" value={reportForm.outcome} onChange={e => setReportForm({...reportForm, outcome: e.target.value})}>
                                        <option>Realizada con éxito</option>
                                        <option>No se encontró en casa</option>
                                        <option>Rechazada / Cancelada</option>
                                        <option>Reprogramada</option>
                                    </Select>

                                    <div>
                                        <label className="label-modern mb-1">Bitácora / Observaciones</label>
                                        <textarea 
                                            className="input-modern h-24 text-sm" 
                                            placeholder="Describe brevemente la visita, peticiones de oración, estado de ánimo..."
                                            value={reportForm.notes}
                                            onChange={e => setReportForm({...reportForm, notes: e.target.value})}
                                        ></textarea>
                                    </div>

                                    <div className="flex items-center gap-3 bg-red-50 p-3 rounded-xl border border-red-100">
                                        <input 
                                            type="checkbox" 
                                            checked={reportForm.needsFollowUp} 
                                            onChange={e => setReportForm({...reportForm, needsFollowUp: e.target.checked})}
                                            className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm font-bold text-red-700">Requiere seguimiento urgente del Pastor</span>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <a href={`https://wa.me/${selectedVisit.phone.replace(/\D/g,'')}`} target="_blank" className="bg-emerald-100 text-emerald-700 p-3 rounded-xl font-bold flex-1 text-center flex items-center justify-center gap-2 hover:bg-emerald-200">
                                            <Icon name="MessageCircle"/> Avisar llegada
                                        </a>
                                        <Button className="flex-[2]" onClick={handleReport}>Finalizar Visita</Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Si ya está realizada, mostrar el reporte
                            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
                                <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                                    <Icon name="Check"/> Visita Completada
                                </div>
                                <p className="text-sm text-slate-700 mb-2"><strong>Resultado:</strong> {selectedVisit.outcome}</p>
                                <p className="text-sm text-slate-600 italic">"{selectedVisit.visitNotes}"</p>
                                <div className="mt-4 text-xs text-slate-400">
                                    Realizada por {selectedVisit.completedBy} el {formatDate(selectedVisit.completedAt)}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};
