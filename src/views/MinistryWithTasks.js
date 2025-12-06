// src/views/MinistryWithTasks.js
window.Views = window.Views || {};

window.Views.MinistryWithTasks = ({ title, col, filterMinistry, members, tasks, events, addData, deleteData, updateData }) => {
    const { useState, useMemo } = React;
    // Importación segura de Utils
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, DateFilter, formatDate, formatTime, Icon, SmartSelect } = Utils;

    const [activeTab, setActiveTab] = useState('events');
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // --- ESTADOS EVENTOS ---
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const initialEvent = { date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0], time: '', title: '', type: 'Reunión', assignments: {}, details: {}, links: '' };
    const [evtForm, setEvtForm] = useState(initialEvent);
    const [customRoleName, setCustomRoleName] = useState("");

    // --- ESTADOS TAREAS ---
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const initialTask = { description: '', assignedTo: [], dueDate: '', status: 'Pendiente', checklist: [], notes: '' };
    const [taskForm, setTaskForm] = useState(initialTask);
    const [tempAssignee, setTempAssignee] = useState('');
    const [newCheckItem, setNewCheckItem] = useState('');

    // --- FILTROS Y MEMOS ---
    const memberOptions = useMemo(() => {
        if (!members) return [];
        return members
            .filter(m => m.ministry === filterMinistry || ['Líder', 'Pastor'].includes(m.role) || m.ministry === 'General')
            .map(m => ({ value: m.name, label: m.name }));
    }, [members, filterMinistry]);

    const monthlyEvents = useMemo(() => {
        if (!events) return [];
        const monthStr = currentDate.toISOString().slice(0, 7);
        return events
            .filter(e => e.date && e.date.startsWith(monthStr))
            .sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [events, currentDate]);

    const ministryTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks
            .filter(t => t.ministry === col)
            .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    }, [tasks, col]);

    // --- HANDLERS EVENTOS ---
    const handleAssignmentAdd = (role, name) => {
        if (!name) return;
        const current = Array.isArray(evtForm.assignments[role]) ? evtForm.assignments[role] : (evtForm.assignments[role] ? [evtForm.assignments[role]] : []);
        if (!current.includes(name)) {
            setEvtForm(p => ({ ...p, assignments: { ...p.assignments, [role]: [...current, name] } }));
        }
    };

    const handleAssignmentRemove = (role, name) => {
        const current = Array.isArray(evtForm.assignments[role]) ? evtForm.assignments[role] : [];
        setEvtForm(p => ({ ...p, assignments: { ...p.assignments, [role]: current.filter(n => n !== name) } }));
    };

    const addCustomRole = () => {
        if (!customRoleName) return;
        setEvtForm(prev => ({ ...prev, assignments: { ...prev.assignments, [customRoleName]: [] } }));
        setCustomRoleName("");
    };

    const handleDetail = (field, value) => {
        setEvtForm(prev => ({ ...prev, details: { ...prev.details, [field]: value } }));
    };

    const openEventModal = (ev = null) => {
        setEditingEvent(ev);
        setEvtForm(ev || { ...initialEvent, date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0] });
        setIsAddingEvent(true);
    };

    const saveEvent = () => {
        if(!evtForm.date) return Utils.notify("Falta fecha", "error");
        const finalTitle = evtForm.title || (col === 'servers' ? 'Servicio General' : 'Actividad');
        const data = { ...evtForm, title: finalTitle };
        
        if (editingEvent) {
            updateData(col, editingEvent.id, data);
        } else {
            addData(col, data);
        }
        setIsAddingEvent(false);
        Utils.notify("Guardado");
    };

    // --- HANDLERS TAREAS ---
    const openTaskModal = (task = null) => {
        setEditingTask(task);
        // Normalizar assignedTo a array
        let assignedToArray = [];
        if (task && task.assignedTo) {
            assignedToArray = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
        }
        setTaskForm(task ? { ...task, assignedTo: assignedToArray } : initialTask);
        setIsTaskModalOpen(true);
    };

    const addAssignee = () => {
        if(tempAssignee && !taskForm.assignedTo.includes(tempAssignee)) {
            setTaskForm(p => ({...p, assignedTo: [...p.assignedTo, tempAssignee]}));
        }
        setTempAssignee('');
    };

    const removeAssignee = (name) => {
        setTaskForm(p => ({...p, assignedTo: p.assignedTo.filter(n => n !== name)}));
    };

    const addCheckItem = () => {
        if(!newCheckItem.trim()) return;
        setTaskForm(p => ({
            ...p, 
            checklist: [...(p.checklist || []), { id: Date.now(), text: newCheckItem, done: false }]
        }));
        setNewCheckItem('');
    };

    const toggleCheckItem = (id) => {
        setTaskForm(p => ({
            ...p, 
            checklist: (p.checklist || []).map(i => i.id === id ? { ...i, done: !i.done } : i)
        }));
    };

    const deleteCheckItem = (id) => {
        setTaskForm(p => ({
            ...p, 
            checklist: (p.checklist || []).filter(i => i.id !== id)
        }));
    };

    const saveTask = () => {
        if(!taskForm.description) return Utils.notify("Descripción requerida", "error");
        const data = { ...taskForm, ministry: col };
        
        if (editingTask) {
            updateData('tasks', editingTask.id, data);
        } else {
            addData('tasks', data);
        }
        setIsTaskModalOpen(false);
        Utils.notify("Tarea guardada");
    };

    // --- RENDERIZADO DE CAMPOS ESPECÍFICOS ---
    const renderSpecificFields = () => {
        if (col === 'ebd') {
            return (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-sm text-slate-700">Detalles Clase</h4>
                    <Input label="Tema" value={evtForm.details?.topic} onChange={e=>handleDetail('topic', e.target.value)} />
                    <Input label="Versículo" value={evtForm.details?.verse} onChange={e=>handleDetail('verse', e.target.value)} />
                    <Input label="Materiales" value={evtForm.details?.materials} onChange={e=>handleDetail('materials', e.target.value)} />
                </div>
            );
        }
        if (col === 'youth') {
            return (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-sm text-slate-700">Reunión</h4>
                    <Input label="Tema" value={evtForm.details?.topic} onChange={e=>handleDetail('topic', e.target.value)} />
                    <Input label="Juego" value={evtForm.details?.game} onChange={e=>handleDetail('game', e.target.value)} />
                    <Input label="Comida" value={evtForm.details?.food} onChange={e=>handleDetail('food', e.target.value)} />
                </div>
            );
        }
        if (col === 'servers') {
            return (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-sm text-slate-700">Orden</h4>
                    <Input label="Predicador" value={evtForm.details?.preacher} onChange={e=>handleDetail('preacher', e.target.value)} />
                </div>
            );
        }
        return null;
    };

    const renderRoles = () => {
        const baseRoles = col === 'ebd' ? ['Maestro', 'Auxiliar'] : (col === 'servers' ? ['Recepción','Baños','Altar','Ofrenda','Seguridad'] : ['Lider']);
        const allRoles = [...new Set([...baseRoles, ...Object.keys(evtForm.assignments || {})])];

        return (
            <div className="space-y-4 pt-2 border-t border-slate-100 mt-2">
                <label className="label-modern">Equipo y Roles</label>
                {allRoles.map(role => (
                    <div key={role} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2">{role}</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {(Array.isArray(evtForm.assignments[role]) ? evtForm.assignments[role] : (evtForm.assignments[role] ? [evtForm.assignments[role]] : [])).map((n, idx) => (
                                <span key={idx} className="bg-white border px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-sm">
                                    {n} <button onClick={()=>handleAssignmentRemove(role, n)} className="text-slate-400 hover:text-red-500"><Icon name="X" size={10}/></button>
                                </span>
                            ))}
                        </div>
                        <SmartSelect options={memberOptions} onChange={v=>handleAssignmentAdd(role, v)} placeholder="Agregar persona..." />
                    </div>
                ))}
                
                <div className="flex gap-2 items-end pt-2 border-t border-slate-200">
                    <div className="flex-1">
                        <Input placeholder="Nombre de nuevo rol (ej. Sonido)" value={customRoleName} onChange={e=>setCustomRoleName(e.target.value)} />
                    </div>
                    <Button variant="secondary" onClick={addCustomRole} icon="Plus">Crear Rol</Button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{title}</h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab==='events'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Calendario</button>
                    <button onClick={()=>setActiveTab('tasks')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab==='tasks'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Tareas</button>
                </div>
            </div>

            {activeTab === 'events' && (
                <>
                    <div className="flex justify-between items-end mb-4">
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                        <Button icon="Plus" onClick={()=>{setEvtForm({...initialEvent, date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0]}); setIsAddingEvent(true);}}>Nuevo</Button>
                    </div>
                    
                    <div className="space-y-4">
                        {monthlyEvents.length === 0 && <div className="text-center py-10 text-slate-400 italic">No hay actividades este mes.</div>}
                        
                        {monthlyEvents.map(e => (
                            <Card key={e.id} className="group relative hover:border-brand-300">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>openEventModal(e)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Icon name="Edit" size={16}/></button>
                                    <button onClick={()=>deleteData(col, e.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center justify-center bg-brand-50 text-brand-700 rounded-xl min-w-[70px] px-2 py-3 h-fit border border-brand-100">
                                        <span className="text-xs font-bold uppercase">{new Date(e.date).toLocaleDateString('es-AR',{weekday:'short'})}</span>
                                        <span className="text-2xl font-black">{new Date(e.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge type="brand">{e.type}</Badge>
                                            <span className="text-xs font-bold text-slate-400">{e.time} hs</span>
                                        </div>
                                        <h3 className="font-bold text-lg">{e.title}</h3>
                                        {e.details?.preacher && <p className="text-sm text-slate-600">🎤 {e.details.preacher}</p>}
                                        {e.links && <a href={e.links} target="_blank" className="text-xs text-blue-500 underline block mt-1">Ver Links/Adjuntos</a>}
                                        {e.assignments && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {Object.entries(e.assignments).map(([r,p]) => {
                                                    const names = Array.isArray(p) ? p.join(', ') : p;
                                                    if (!names) return null;
                                                    return (
                                                        <span key={r} className="text-xs bg-slate-50 border px-2 py-1 rounded">
                                                            <strong>{r}:</strong> {names}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Modal isOpen={isAddingEvent} onClose={()=>setIsAddingEvent(false)} title="Evento / Clase">
                        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-4">
                                <Input type="date" label="Fecha" value={evtForm.date} onChange={e=>setEvtForm({...evtForm, date:e.target.value})} />
                                <Input type="time" label="Hora" value={evtForm.time} onChange={e=>setEvtForm({...evtForm, time:e.target.value})} />
                            </div>
                            
                            <Input label="Título / Tema" value={evtForm.title} onChange={e=>setEvtForm({...evtForm, title:e.target.value})} />
                            <Input label="Links / Material" value={evtForm.links} onChange={e=>setEvtForm({...evtForm, links:e.target.value})} placeholder="https://..." />
                            
                            {renderSpecificFields()}
                            {renderRoles()}
                            
                            <div className="pt-4">
                                <Button className="w-full" onClick={saveEvent}>Guardar</Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}

            {activeTab === 'tasks' && (
                <>
                    <div className="flex justify-end mb-4"><Button icon="Plus" onClick={()=>openTaskModal()}>Nueva Tarea</Button></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {ministryTasks.map(t => (
                            <div key={t.id} onClick={()=>openTaskModal(t)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge type={t.status === 'Completada' ? 'success' : 'warning'}>{t.status}</Badge>
                                    {t.dueDate && <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">{formatDate(t.dueDate)}</span>}
                                </div>
                                <h4 className="font-bold text-slate-800 mb-1">{t.description}</h4>
                                <div className="flex -space-x-2 mt-2">
                                    {(Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo?[t.assignedTo]:[])).map((n,i)=>(
                                        <div key={i} className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[9px] border border-white font-bold text-brand-700" title={n}>{n.charAt(0)}</div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Modal isOpen={isTaskModalOpen} onClose={()=>setIsTaskModalOpen(false)} title="Tarea">
                        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                            <Input label="Título" value={taskForm.description} onChange={e=>setTaskForm({...taskForm, description:e.target.value})} />
                            
                            <div>
                                <label className="label-modern">Responsables</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(taskForm.assignedTo||[]).map(n => (
                                        <span key={n} className="bg-slate-100 px-2 rounded text-xs flex items-center gap-1 border">
                                            {n} <button onClick={()=>removeAssignee(n)}><Icon name="X" size={10}/></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <SmartSelect options={memberOptions} value={tempAssignee} onChange={setTempAssignee} placeholder="Buscar..." />
                                    <Button variant="secondary" onClick={addAssignee} icon="Plus">Agg</Button>
                                </div>
                            </div>

                            <Input type="date" label="Vence" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm, dueDate:e.target.value})} />
                            
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <label className="label-modern mb-2">Checklist</label>
                                <div className="flex gap-2 mb-3">
                                    <input className="input-modern bg-white py-1" value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} onKeyPress={e=>e.key==='Enter'&&addCheckItem()} placeholder="Nuevo item..." />
                                    <button onClick={addCheckItem} className="bg-slate-200 p-2 rounded-lg"><Icon name="Plus" size={18}/></button>
                                </div>
                                <div className="space-y-2">
                                    {(taskForm.checklist||[]).map(i=>(
                                        <div key={i.id} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                                            <input type="checkbox" checked={i.done} onChange={()=>toggleCheckItem(i.id)} />
                                            <span className={`flex-1 text-sm ${i.done?'line-through text-slate-400':'text-slate-700'}`}>{i.text}</span>
                                            <button onClick={()=>deleteCheckItem(i.id)} className="text-slate-300 hover:text-red-500"><Icon name="Trash" size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {editingTask && (
                                    <Select label="Estado" value={taskForm.status} onChange={e=>setTaskForm({...taskForm, status:e.target.value})}>
                                        <option>Pendiente</option>
                                        <option>En Proceso</option>
                                        <option>Completada</option>
                                    </Select>
                                )}
                                <div className="flex items-end col-span-2">
                                    <Button className="w-full" onClick={saveTask}>Guardar Tarea</Button>
                                </div>
                            </div>
                            
                            {editingTask && (
                                <button onClick={()=>{if(confirm("¿Eliminar?")) { deleteData('tasks', editingTask.id); setIsTaskModalOpen(false); }}} className="text-red-500 text-xs w-full text-center mt-2 hover:underline">Eliminar Tarea</button>
                            )}
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
};
