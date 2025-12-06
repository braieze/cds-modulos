// src/views/MinistryWithTasks.js
window.Views = window.Views || {};

window.Views.MinistryWithTasks = ({ title, col, filterMinistry, members, tasks, events, addData, deleteData, updateData }) => {
    const { useState, useMemo } = React;
    const { Card, Button, Badge, Modal, Input, Select, MonthNav, formatDate, formatTime, Icon, SmartSelect } = window.Utils;

    const [activeTab, setActiveTab] = useState('events'); // 'events' | 'tasks'
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // -- ESTADOS PARA EVENTOS --
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const initialEvent = { date: '', time: '', title: '', type: 'Reunión', assignments: {}, details: {} };
    const [evtForm, setEvtForm] = useState(initialEvent);

    // -- ESTADOS PARA TAREAS (TRELLO) --
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null); // Si es null, es nueva. Si tiene objeto, es edición.
    const initialTask = { description: '', assignedTo: '', dueDate: '', status: 'Pendiente', checklist: [], notes: '' };
    const [taskForm, setTaskForm] = useState(initialTask);
    const [newCheckItem, setNewCheckItem] = useState('');

    // -- PREPARAR DATOS --
    // Convertir miembros para el SmartSelect
    const memberOptions = useMemo(() => {
        const filtered = members.filter(m => m.ministry === filterMinistry || m.role === 'Líder' || m.role === 'Pastor' || m.ministry === 'General');
        return filtered.map(m => ({ value: m.name, label: m.name }));
    }, [members, filterMinistry]);

    // Filtrar eventos por mes
    const monthlyEvents = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return events.filter(e => e.date && e.date.startsWith(monthStr)).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [events, currentDate]);

    // Tareas del ministerio
    const ministryTasks = tasks.filter(t => t.ministry === col).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    // -- LÓGICA EVENTOS --
    const handleAssignment = (role, name) => {
        setEvtForm(prev => ({ ...prev, assignments: { ...prev.assignments, [role]: name } }));
    };

    const handleDetail = (field, value) => {
        setEvtForm(prev => ({ ...prev, details: { ...prev.details, [field]: value } }));
    };

    const saveEvent = () => {
        if(!evtForm.date || !evtForm.title) return window.Utils.notify("Faltan datos obligatorios", "error");
        addData(col, evtForm);
        setIsAddingEvent(false);
        setEvtForm(initialEvent);
        window.Utils.notify("Evento creado correctamente");
    };

    // -- LÓGICA TAREAS (TRELLO) --
    const openTaskModal = (task = null) => {
        setEditingTask(task);
        setTaskForm(task || initialTask);
        setIsTaskModalOpen(true);
    };

    const addCheckItem = () => {
        if(!newCheckItem.trim()) return;
        const newItem = { id: Date.now(), text: newCheckItem, done: false };
        setTaskForm(prev => ({ ...prev, checklist: [...(prev.checklist || []), newItem] }));
        setNewCheckItem('');
    };

    const toggleCheckItem = (itemId) => {
        const updatedList = taskForm.checklist.map(item => 
            item.id === itemId ? { ...item, done: !item.done } : item
        );
        setTaskForm(prev => ({ ...prev, checklist: updatedList }));
    };

    const deleteCheckItem = (itemId) => {
        setTaskForm(prev => ({ ...prev, checklist: prev.checklist.filter(i => i.id !== itemId) }));
    };

    const saveTask = () => {
        if(!taskForm.description) return window.Utils.notify("Descripción requerida", "error");
        
        const dataToSave = { ...taskForm, ministry: col };
        
        if (editingTask) {
            updateData('tasks', editingTask.id, dataToSave);
            window.Utils.notify("Tarea actualizada");
        } else {
            addData('tasks', dataToSave);
            window.Utils.notify("Tarea creada");
        }
        setIsTaskModalOpen(false);
    };

    // -- RENDERIZADO DE FORMULARIOS ESPECÍFICOS --
    const renderSpecificFields = () => {
        switch(col) {
            case 'ebd':
                return (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-sm text-slate-700 uppercase">Detalles de la Clase</h4>
                        <Input label="Tema / Lección" value={evtForm.details?.topic} onChange={e=>handleDetail('topic', e.target.value)} />
                        <Input label="Versículo Clave" value={evtForm.details?.verse} onChange={e=>handleDetail('verse', e.target.value)} />
                        <Input label="Materiales Necesarios" value={evtForm.details?.materials} onChange={e=>handleDetail('materials', e.target.value)} placeholder="Cartulinas, tijeras..." />
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <SmartSelect label="Maestro Principal" options={memberOptions} value={evtForm.assignments?.Maestro} onChange={val=>handleAssignment('Maestro', val)} />
                            <SmartSelect label="Ayudante" options={memberOptions} value={evtForm.assignments?.Ayudante} onChange={val=>handleAssignment('Ayudante', val)} />
                        </div>
                    </div>
                );
            case 'youth':
                return (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-sm text-slate-700 uppercase">Dinámica de la Reunión</h4>
                        <Input label="Tema Central" value={evtForm.details?.topic} onChange={e=>handleDetail('topic', e.target.value)} />
                        <Input label="Juego / Rompehielo" value={evtForm.details?.game} onChange={e=>handleDetail('game', e.target.value)} />
                        <Input label="Menú / Comida" value={evtForm.details?.food} onChange={e=>handleDetail('food', e.target.value)} />
                        <div className="pt-2">
                            <SmartSelect label="Líder a Cargo" options={memberOptions} value={evtForm.assignments?.Lider} onChange={val=>handleAssignment('Lider', val)} />
                        </div>
                    </div>
                );
            case 'servers':
                return (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-sm text-slate-700 uppercase">Orden del Servicio</h4>
                        <Input label="Predicador" value={evtForm.details?.preacher} onChange={e=>handleDetail('preacher', e.target.value)} placeholder="¿Quién predica?" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {['Recepción', 'Baños', 'Altar', 'Ofrenda', 'Seguridad'].map(role => (
                                <SmartSelect 
                                    key={role} 
                                    label={role} 
                                    options={memberOptions} 
                                    value={evtForm.assignments?.[role]} 
                                    onChange={val=>handleAssignment(role, val)} 
                                />
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6 fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='events'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Calendario</button>
                    <button onClick={()=>setActiveTab('tasks')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='tasks'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Tablero Tareas</button>
                </div>
            </div>

            {/* VISTA CALENDARIO */}
            {activeTab === 'events' && (
                <>
                    <MonthNav currentDate={currentDate} onMonthChange={setCurrentDate} />
                    <div className="flex justify-end mb-4"><Button icon="Plus" onClick={()=>{setEvtForm({...initialEvent, date: new Date().toISOString().split('T')[0]}); setIsAddingEvent(true);}}>Nuevo Evento</Button></div>
                    
                    <div className="space-y-4">
                        {monthlyEvents.length === 0 && <div className="text-center py-10 text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-200">No hay actividades planificadas para este mes.</div>}
                        {monthlyEvents.map(e => (
                            <Card key={e.id} className="group relative hover:border-brand-300">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={()=>deleteData(col, e.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex flex-row md:flex-col items-center justify-center bg-brand-50 text-brand-700 rounded-xl min-w-[70px] px-4 py-3 h-fit border border-brand-100 gap-2 md:gap-0">
                                        <span className="text-xs font-bold uppercase">{new Date(e.date).toLocaleDateString('es-AR',{weekday:'short'})}</span>
                                        <span className="text-2xl font-black leading-none">{new Date(e.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge type="brand">{e.type}</Badge>
                                            <span className="text-xs font-bold text-slate-400">{e.time} hs</span>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900">{e.title}</h3>
                                        
                                        {/* Detalles Específicos en la Tarjeta */}
                                        {e.details?.topic && <p className="text-sm text-slate-600 mt-1">📚 Tema: {e.details.topic}</p>}
                                        {e.details?.preacher && <p className="text-sm text-slate-600 mt-1">🎤 Predica: {e.details.preacher}</p>}
                                        
                                        {/* Asignaciones Visuales */}
                                        {e.assignments && Object.keys(e.assignments).length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {Object.entries(e.assignments).map(([role, person]) => person && (
                                                    <span key={role} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-[10px] text-slate-600">
                                                        <strong>{role}:</strong> {person}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Modal isOpen={isAddingEvent} onClose={()=>setIsAddingEvent(false)} title={`Nuevo Evento: ${title}`}>
                        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-4">
                                <Input type="date" label="Fecha" value={evtForm.date} onChange={e=>setEvtForm({...evtForm, date:e.target.value})} />
                                <Input type="time" label="Hora" value={evtForm.time} onChange={e=>setEvtForm({...evtForm, time:e.target.value})} />
                            </div>
                            <Input label="Título del Evento" value={evtForm.title} onChange={e=>setEvtForm({...evtForm, title:e.target.value})} placeholder="Ej. Reunión Especial" />
                            <Input label="Ubicación" value={evtForm.location} onChange={e=>setEvtForm({...evtForm, location:e.target.value})} placeholder="Templo Principal" />
                            
                            {/* Campos Dinámicos según Ministerio */}
                            {renderSpecificFields()}

                            <div className="pt-4"><Button className="w-full" onClick={saveEvent}>Crear Evento</Button></div>
                        </div>
                    </Modal>
                </>
            )}

            {/* VISTA TAREAS (ESTILO TRELLO) */}
            {activeTab === 'tasks' && (
                <>
                    <div className="flex justify-between items-end mb-4">
                        <p className="text-sm text-slate-500">Gestión de pendientes y proyectos.</p>
                        <Button icon="Plus" onClick={()=>openTaskModal()}>Nueva Tarea</Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ministryTasks.map(t => {
                            const completedCount = t.checklist?.filter(i=>i.done).length || 0;
                            const totalCount = t.checklist?.length || 0;
                            const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

                            return (
                                <div key={t.id} onClick={()=>openTaskModal(t)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge type={t.status === 'Completada' ? 'success' : 'warning'}>{t.status}</Badge>
                                        {t.dueDate && <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">{formatDate(t.dueDate)}</span>}
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-1">{t.description}</h4>
                                    <p className="text-xs text-slate-500 mb-3">Resp: <span className="text-brand-600 font-bold">{t.assignedTo}</span></p>
                                    
                                    {/* Barra de Progreso Checklist */}
                                    {totalCount > 0 && (
                                        <div className="mt-2">
                                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                <span>Checklist</span>
                                                <span>{completedCount}/{totalCount}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{width: `${progress}%`}}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Modal isOpen={isTaskModalOpen} onClose={()=>setIsTaskModalOpen(false)} title={editingTask ? "Editar Tarea" : "Nueva Tarea"}>
                        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                            <Input label="Título de la Tarea" value={taskForm.description} onChange={e=>setTaskForm({...taskForm, description:e.target.value})} />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <SmartSelect label="Responsable" options={memberOptions} value={taskForm.assignedTo} onChange={val=>setTaskForm({...taskForm, assignedTo:val})} />
                                <Input type="date" label="Vencimiento" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm, dueDate:e.target.value})} />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <label className="label-modern mb-2">Checklist (Sub-tareas)</label>
                                <div className="flex gap-2 mb-3">
                                    <input className="input-modern bg-white text-sm" placeholder="Agregar item..." value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} onKeyPress={e=>e.key==='Enter'&&addCheckItem()} />
                                    <button onClick={addCheckItem} className="bg-slate-200 text-slate-600 p-2.5 rounded-lg hover:bg-slate-300"><Icon name="Plus" size={18}/></button>
                                </div>
                                <div className="space-y-2">
                                    {(taskForm.checklist || []).map(item => (
                                        <div key={item.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200">
                                            <input type="checkbox" checked={item.done} onChange={()=>toggleCheckItem(item.id)} className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer" />
                                            <span className={`flex-1 text-sm ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.text}</span>
                                            <button onClick={()=>deleteCheckItem(item.id)} className="text-slate-300 hover:text-red-500"><Icon name="X" size={14}/></button>
                                        </div>
                                    ))}
                                    {(!taskForm.checklist || taskForm.checklist.length === 0) && <p className="text-xs text-slate-400 italic text-center">No hay items en la lista.</p>}
                                </div>
                            </div>

                            <Input label="Notas Adicionales" value={taskForm.notes} onChange={e=>setTaskForm({...taskForm, notes:e.target.value})} placeholder="Detalles extra..." />
                            
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                {editingTask && (
                                    <Select label="Estado" value={taskForm.status} onChange={e=>setTaskForm({...taskForm, status:e.target.value})}>
                                        <option>Pendiente</option>
                                        <option>En Proceso</option>
                                        <option>Completada</option>
                                    </Select>
                                )}
                                <div className={editingTask ? "" : "col-span-2"}>
                                    <label className="block text-xs font-bold text-transparent mb-1.5">.</label>
                                    <Button className="w-full" onClick={saveTask}>{editingTask ? "Actualizar" : "Crear Tarea"}</Button>
                                </div>
                            </div>
                            
                            {editingTask && (
                                <div className="border-t pt-4 mt-2">
                                    <button onClick={()=>{if(confirm("¿Borrar tarea?")) { deleteData('tasks', editingTask.id); setIsTaskModalOpen(false); }}} className="text-red-500 text-xs font-bold hover:underline w-full text-center">Eliminar Tarea</button>
                                </div>
                            )}
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
};
