// src/views/MinistryWithTasks.js
window.Views = window.Views || {};

window.Views.MinistryWithTasks = ({ title, col, filterMinistry, members, tasks, events, addData, deleteData, updateData }) => {
    const { useState, useMemo } = React;
    const { Card, Button, Badge, Modal, Input, Select, MonthNav, formatDate, formatTime, Icon } = window.Utils;

    const [activeTab, setActiveTab] = useState('events'); // 'events' | 'tasks'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAdding, setIsAdding] = useState(false);
    
    // Formularios
    const initialEvent = { date: '', time: '', title: '', location: '', type: 'Reunión', preacher: '', assignments: {} };
    const initialTask = { description: '', assignedTo: '', dueDate: '', status: 'Pendiente' };
    
    const [evtForm, setEvtForm] = useState(initialEvent);
    const [taskForm, setTaskForm] = useState(initialTask);

    // Es el módulo de Servidores?
    const isServersModule = col === 'servers';

    // Filtrar Eventos por Mes
    const monthlyEvents = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return events.filter(e => e.date && e.date.startsWith(monthStr)).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [events, currentDate]);

    // Tareas del ministerio (Globales, no por mes necesariamente, pero ordenadas)
    const ministryTasks = tasks.filter(t => t.ministry === col).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    // Miembros disponibles
    const availableMembers = members.filter(m => m.ministry === filterMinistry || m.role === 'Líder' || m.role === 'Pastor' || m.ministry === 'General');

    // Lógica de Asignación Múltiple (Simple string o array en el futuro)
    const handleAssignment = (role, name) => {
        setEvtForm(prev => ({
            ...prev,
            assignments: { ...prev.assignments, [role]: name }
        }));
    };

    const handleSaveEvent = () => {
        if(!evtForm.title && !evtForm.type) return alert("Falta título o tipo");
        addData(col, evtForm);
        setIsAdding(false);
        setEvtForm(initialEvent);
    };

    const handleSaveTask = () => {
        if(!taskForm.description) return alert("Falta descripción");
        addData('tasks', { ...taskForm, ministry: col });
        setIsAdding(false);
        setTaskForm(initialTask);
    };

    // Roles definidos para Servidores
    const serverRoles = ['Recepción', 'Baños', 'Altar', 'Ofrenda', 'Limpieza'];

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='events'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Calendario</button>
                    <button onClick={()=>setActiveTab('tasks')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='tasks'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Tareas</button>
                </div>
            </div>

            {activeTab === 'events' && (
                <>
                    <MonthNav currentDate={currentDate} onMonthChange={setCurrentDate} />
                    
                    <div className="flex justify-end mb-4">
                        <Button icon="Plus" onClick={()=>{setEvtForm({...initialEvent, date: new Date().toISOString().split('T')[0]}); setIsAdding(true);}}>
                            {isServersModule ? 'Planificar Servicio' : 'Nuevo Evento'}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {monthlyEvents.length === 0 && <div className="text-center py-10 text-slate-400 italic">No hay actividades este mes.</div>}
                        
                        {monthlyEvents.map(e => (
                            <Card key={e.id} className="group relative hover:border-brand-300">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>deleteData(col, e.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center justify-center bg-brand-50 text-brand-700 rounded-xl min-w-[70px] px-2 py-3 h-fit border border-brand-100">
                                        <span className="text-xs font-bold uppercase">{new Date(e.date).toLocaleDateString('es-AR',{weekday:'short'})}</span>
                                        <span className="text-2xl font-black leading-none">{new Date(e.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge type="brand">{e.type || (isServersModule ? 'Servicio' : 'Reunión')}</Badge>
                                            <span className="text-xs font-bold text-slate-400">{e.time} hs</span>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900">{e.title || e.theme || 'Servicio General'}</h3>
                                        {e.preacher && <p className="text-sm text-slate-600 font-medium mt-1">🎤 Predica: {e.preacher}</p>}
                                        {e.location && <p className="text-xs text-slate-400 mt-1">📍 {e.location}</p>}
                                        
                                        {/* Asignaciones (Servidores) */}
                                        {e.assignments && Object.keys(e.assignments).length > 0 && (
                                            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {Object.entries(e.assignments).map(([role, person]) => person && (
                                                    <div key={role} className="bg-slate-50 px-2 py-1.5 rounded border border-slate-100 text-xs">
                                                        <span className="font-bold text-slate-500 block text-[10px] uppercase">{role}</span>
                                                        <span className="font-semibold text-slate-700">{person}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Modal isOpen={isAdding} onClose={()=>setIsAdding(false)} title={isServersModule ? "Planificar Servicio" : "Nuevo Evento"}>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-4">
                                <Input type="date" label="Fecha" value={evtForm.date} onChange={e=>setEvtForm({...evtForm, date:e.target.value})} />
                                <Input type="time" label="Hora" value={evtForm.time} onChange={e=>setEvtForm({...evtForm, time:e.target.value})} />
                            </div>
                            
                            <Input label={isServersModule ? "Tema / Título (Opcional)" : "Título del Evento"} value={evtForm.title} onChange={e=>setEvtForm({...evtForm, title:e.target.value})} placeholder="Ej. Culto Especial" />
                            
                            {!isServersModule && (
                                <Input label="Lugar" value={evtForm.location} onChange={e=>setEvtForm({...evtForm, location:e.target.value})} />
                            )}

                            {isServersModule && (
                                <div className="pt-2 border-t border-slate-100 mt-2">
                                    <h4 className="font-bold text-slate-800 mb-3 text-sm">Roles y Predicación</h4>
                                    <Input label="Predicador" value={evtForm.preacher} onChange={e=>setEvtForm({...evtForm, preacher:e.target.value})} placeholder="Nombre del predicador" className="mb-4" />
                                    
                                    <div className="space-y-3">
                                        {serverRoles.map(role => (
                                            <div key={role}>
                                                <Select label={role} value={evtForm.assignments[role] || ''} onChange={e=>handleAssignment(role, e.target.value)}>
                                                    <option value="">-- Asignar --</option>
                                                    {availableMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <Button className="w-full" onClick={handleSaveEvent}>Guardar Actividad</Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}

            {activeTab === 'tasks' && (
                <>
                    <div className="flex justify-end mb-4">
                        <Button icon="Clipboard" onClick={()=>setIsAdding(true)}>Asignar Tarea</Button>
                    </div>
                    <div className="space-y-3">
                        {ministryTasks.map(t => (
                            <Card key={t.id} className="flex justify-between items-center p-4">
                                <div>
                                    <p className="font-bold text-slate-900">{t.description}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Resp: <span className="font-semibold text-brand-600">{t.assignedTo}</span> • Vence: {formatDate(t.dueDate)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge type={t.status === 'Pendiente' ? 'warning' : 'success'}>{t.status}</Badge>
                                    <button onClick={()=>deleteData('tasks', t.id)} className="text-slate-300 hover:text-red-500"><Icon name="Trash" size={16}/></button>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Modal isOpen={isAdding} onClose={()=>setIsAdding(false)} title="Nueva Tarea">
                        <div className="space-y-4">
                            <Input label="Descripción" value={taskForm.description} onChange={e=>setTaskForm({...taskForm, description:e.target.value})} placeholder="¿Qué hay que hacer?" />
                            <Select label="Responsable" value={taskForm.assignedTo} onChange={e=>setTaskForm({...taskForm, assignedTo:e.target.value})}>
                                <option value="">Seleccionar...</option>
                                {availableMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </Select>
                            <Input type="date" label="Fecha Límite" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm, dueDate:e.target.value})} />
                            <div className="pt-2">
                                <Button className="w-full" onClick={handleSaveTask}>Asignar Tarea</Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
};
