// src/views/MinistryWithTasks.js
window.Views = window.Views || {};

window.Views.MinistryWithTasks = ({ title, col, filterMinistry, members, tasks, events, addData, deleteData, updateData }) => {
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, DateFilter, formatDate, Icon, SmartSelect } = Utils;

    const [activeTab, setActiveTab] = useState('events'); // events | tasks
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // -- ESTADOS EVENTOS --
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    // Estructura: details guarda info específica (tema, juego, predicador)
    const initialEvent = { date: new Date().toISOString().split('T')[0], time: '', title: '', type: 'Reunión', assignments: {}, details: {} };
    const [evtForm, setEvtForm] = useState(initialEvent);
    const [customRoleName, setCustomRoleName] = useState(""); // Para agregar roles extra

    // -- ESTADOS TAREAS (TRELLO) --
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const initialTask = { description: '', assignedTo: [], dueDate: '', status: 'Pendiente', checklist: [], notes: '' };
    const [taskForm, setTaskForm] = useState(initialTask);
    const [newCheckItem, setNewCheckItem] = useState('');
    const [tempAssignee, setTempAssignee] = useState(''); // Para agregar múltiples responsables

    // -- PREPARAR DATOS --
    const memberOptions = useMemo(() => {
        // Filtrar gente relevante para este ministerio + Líderes/Pastores
        const filtered = members.filter(m => m.ministry === filterMinistry || ['Líder', 'Pastor'].includes(m.role) || m.ministry === 'General');
        return filtered.map(m => ({ value: m.name, label: m.name }));
    }, [members, filterMinistry]);

    const monthlyEvents = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return events.filter(e => e.date && e.date.startsWith(monthStr)).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [events, currentDate]);

    const ministryTasks = tasks.filter(t => t.ministry === col).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    // -- LÓGICA EVENTOS --
    const handleAssignment = (role, name) => {
        // Si ya existe, lo reemplazamos (o podríamos hacerlo array para multi-asignación en el mismo rol)
        // Para simplificar la UI, por ahora es 1 persona por rol, pero puedes agregar roles "Auxiliar 1", "Auxiliar 2" con el botón de custom role.
        setEvtForm(prev => ({ ...prev, assignments: { ...prev.assignments, [role]: name } }));
    };

    const addCustomRole = () => {
        if (!customRoleName) return;
        setEvtForm(prev => ({ ...prev, assignments: { ...prev.assignments, [customRoleName]: "" } }));
        setCustomRoleName("");
    };

    const handleDetail = (field, value) => {
        setEvtForm(prev => ({ ...prev, details: { ...prev.details, [field]: value } }));
    };

    const saveEvent = () => {
        if(!evtForm.date || (!evtForm.title && col !== 'servers')) return Utils.notify("Faltan datos obligatorios", "error");
        // En servidores, el título puede ser automático
        const finalTitle = evtForm.title || (col === 'servers' ? 'Servicio General' : 'Actividad');
        
        addData(col, { ...evtForm, title: finalTitle });
        setIsAddingEvent(false);
        setEvtForm(initialEvent);
        Utils.notify("Evento creado");
    };

    // -- LÓGICA TAREAS --
    const openTaskModal = (task = null) => {
        setEditingTask(task);
        // Asegurar que assignedTo sea array (migración de datos viejos)
        let assignees = [];
        if (task) {
            assignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
        }
        setTaskForm(task ? { ...task, assignedTo: assignees } : initialTask);
        setIsTaskModalOpen(true);
    };

    const addAssignee = (name) => {
        if (!name || taskForm.assignedTo.includes(name)) return;
        setTaskForm(prev => ({ ...prev, assignedTo: [...prev.assignedTo, name] }));
    };

    const removeAssignee = (name) => {
        setTaskForm(prev => ({ ...prev, assignedTo: prev.assignedTo.filter(n => n !== name) }));
    };

    const saveTask = () => {
        if(!taskForm.description) return Utils.notify("Descripción requerida", "error");
        const dataToSave = { ...taskForm, ministry: col };
        editingTask ? updateData('tasks', editingTask.id, dataToSave) : addData('tasks', dataToSave);
        setIsTaskModalOpen(false);
        Utils.notify("Tarea guardada");
    };

    // -- CAMPOS ESPECÍFICOS --
    const renderSpecificFields = () => {
        switch(col) {
            case 'ebd':
                return (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-sm text-brand-700 uppercase tracking-wide">Planificación de Clase</h4>
                        <Input label="Tema / Lección" value={evtForm.details?.topic} onChange={e=>handleDetail('topic', e.target.value)} />
                        <Input label="Versículo / Base Bíblica" value={evtForm.details?.verse} onChange={e=>handleDetail('verse', e.target.value)} />
                        <Input label="Materiales" value={evtForm.details?.materials} onChange={e=>handleDetail('materials', e.target.value)} placeholder="Ej. Cartulinas, colores..." />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 mt-2">
                            <SmartSelect label="Maestro Principal" options={memberOptions} value={evtForm.assignments?.Maestro} onChange={v=>handleAssignment('Maestro', v)} />
                            <SmartSelect label="Auxiliar" options={memberOptions} value={evtForm.assignments?.Auxiliar} onChange={v=>handleAssignment('Auxiliar', v)} />
                        </div>
                    </div>
                );
            case 'youth':
                return (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-sm text-brand-700 uppercase tracking-wide">Dinámica de Reunión</h4>
                        <Input label="Tema Central" value={evtForm.details?.topic} onChange={e=>handleDetail('topic', e.target.value)} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Juego / Rompehielo" value={evtForm.details?.game} onChange={e=>handleDetail('game', e.target.value)} />
                            <Input label="Comida / Menú" value={evtForm.details?.food} onChange={e=>handleDetail('food', e.target.value)} />
                        </div>
                        <SmartSelect label="Líder de Turno" options={memberOptions} value={evtForm.assignments?.Lider} onChange={v=>handleAssignment('Lider', v)} />
                    </div>
                );
            case 'servers':
                return (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-sm text-brand-700 uppercase tracking-wide">Orden del Culto</h4>
                        <Input label="Predicador" value={evtForm.details?.preacher} onChange={e=>handleDetail('preacher', e.target.value)} placeholder="¿Quién comparte la palabra?" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {['Recepción', 'Baños', 'Altar', 'Ofrenda', 'Seguridad'].map(role => (
                                <SmartSelect key={role} label={role} options={memberOptions} value={evtForm.assignments?.[role]} onChange={v=>handleAssignment(role, v)} />
                            ))}
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                    <p className="text-slate-500 text-sm">Gestión del ministerio</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='events'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>Calendario</button>
                    <button onClick={()=>setActiveTab('tasks')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='tasks'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>Tareas</button>
                </div>
            </div>

            {/* VISTA CALENDARIO */}
            {activeTab === 'events' && (
                <>
                    <div className="flex justify-between items-end mb-4">
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                        <Button icon="Plus" onClick={()=>{setEvtForm({...initialEvent, date: new Date().toISOString().split('T')[0]}); setIsAddingEvent(true);}}>
                            {col === 'servers' ? 'Planificar Servicio' : 'Nuevo Evento'}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {monthlyEvents.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                <div className="text-slate-300 mb-2 flex justify-center"><Icon name="Calendar" size={32}/></div>
                                <p className="text-slate-500 text-sm">No hay actividades este mes.</p>
                            </div>
                        )}
                        
                        {monthlyEvents.map(e => (
                            <Card key={e.id} className="group relative hover:border-brand-300 transition-colors">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>deleteData(col, e.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Icon name="Trash" size={16}/></button>
                                </div>
                                
                                <div className="flex flex-col md:flex-row gap-4">
                                    {/* Fecha Badge */}
                                    <div className="flex flex-row md:flex-col items-center justify-center bg-brand-50 text-brand-700 rounded-xl min-w-[80px] px-4 py-3 h-fit border border-brand-100 gap-2 md:gap-0">
                                        <span className="text-xs font-bold uppercase tracking-wide">{new Date(e.date).toLocaleDateString('es-AR',{weekday:'short'})}</span>
                                        <span className="text-2xl font-black leading-none">{new Date(e.date).getDate()}</span>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge type="brand">{e.type}</Badge>
                                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Icon name="Clock" size={12}/> {e.time || '--:--'} hs</span>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900 leading-tight">{e.title || e.theme || 'Actividad'}</h3>
                                        
                                        {/* Info Específica en Tarjeta */}
                                        {e.details?.preacher && <p className="text-sm text-slate-600 mt-1 font-medium">🎤 {e.details.preacher}</p>}
                                        {e.details?.topic && <p className="text-sm text-slate-600 mt-1">📚 {e.details.topic}</p>}
                                        
                                        {/* Chips de Asignaciones */}
                                        {e.assignments && Object.keys(e.assignments).length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {Object.entries(e.assignments).map(([role, person]) => person && (
                                                    <span key={role} className="inline-flex items-center px-2 py-1 rounded bg-slate-50 border border-slate-100 text-[10px] text-slate-600">
                                                        <span className="font-bold mr-1">{role}:</span> {person}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Modal isOpen={isAddingEvent} onClose={()=>setIsAddingEvent(false)} title={`Planificar: ${title}`}>
                        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-4">
                                <Input type="date" label="Fecha" value={evtForm.date} onChange={e=>setEvtForm({...evtForm, date:e.target.value})} />
                                <Input type="time" label="Hora" value={evtForm.time} onChange={e=>setEvtForm({...evtForm, time:e.target.value})} />
                            </div>
                            
                            <Input label="Título / Tema" value={evtForm.title} onChange={e=>setEvtForm({...evtForm, title:e.target.value})} placeholder={col==='servers'?'Servicio General':'Título del evento'} />
                            
                            {renderSpecificFields()}

                            {/* Agregar Roles Extra Dinámicamente */}
                            <div className="pt-4 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Roles Adicionales / Participación</label>
                                <div className="flex gap-2 mb-2">
                                    <input className="input-modern w-full" placeholder="Ej. Saxofón, Danza..." value={customRoleName} onChange={e=>setCustomRoleName(e.target.value)} />
                                    <Button variant="secondary" onClick={addCustomRole} icon="Plus">Agregar</Button>
                                </div>
                                <div className="space-y-2">
                                    {Object.keys(evtForm.assignments).filter(k => !['Maestro','Auxiliar','Lider','Recepción','Baños','Altar','Ofrenda','Seguridad'].includes(k)).map(role => (
                                        <SmartSelect key={role} label={role} options={memberOptions} value={evtForm.assignments[role]} onChange={v=>handleAssignment(role, v)} />
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2"><Button className="w-full" onClick={saveEvent}>Confirmar Planificación</Button></div>
                        </div>
                    </Modal>
                </>
            )}

            {/* VISTA TAREAS */}
            {activeTab === 'tasks' && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-slate-500">Gestión de proyectos</p>
                        <Button icon="Plus" onClick={()=>openTaskModal()}>Nueva Tarea</Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ministryTasks.map(t => {
                            const completed = t.checklist?.filter(i=>i.done).length || 0;
                            const total = t.checklist?.length || 0;
                            const progress = total === 0 ? 0 : (completed/total)*100;
                            // Manejo seguro de asignados (array)
                            const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo ? [t.assignedTo] : []);

                            return (
                                <div key={t.id} onClick={()=>openTaskModal(t)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge type={t.status === 'Completada' ? 'success' : 'warning'}>{t.status}</Badge>
                                        {t.dueDate && <span className={`text-[10px] font-bold px-2 py-1 rounded ${new Date(t.dueDate)<new Date() && t.status!=='Completada' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>{formatDate(t.dueDate)}</span>}
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-1 leading-tight">{t.description}</h4>
                                    
                                    <div className="mt-auto pt-4 flex justify-between items-center">
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {assignees.map((name, i) => (
                                                <div key={i} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-[9px] font-bold text-brand-700 ring-2 ring-white" title={name}>
                                                    {name.charAt(0)}
                                                </div>
                                            ))}
                                            {assignees.length === 0 && <span className="text-[10px] text-slate-400 italic">Sin asignar</span>}
                                        </div>
                                        {total > 0 && (
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                <Icon name="Check" size={10}/> {completed}/{total}
                                            </div>
                                        )}
                                    </div>
                                    {total > 0 && <div className="mt-2 w-full bg-slate-100 rounded-full h-1"><div className="bg-brand-500 h-1 rounded-full transition-all" style={{width: `${progress}%`}}></div></div>}
                                </div>
                            );
                        })}
                    </div>

                    <Modal isOpen={isTaskModalOpen} onClose={()=>setIsTaskModalOpen(false)} title={editingTask ? "Editar Tarea" : "Nueva Tarea"}>
                        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                            <Input label="Título" value={taskForm.description} onChange={e=>setTaskForm({...taskForm, description:e.target.value})} placeholder="¿Qué hay que hacer?" />
                            
                            <div>
                                <label className="label-modern">Responsables</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(taskForm.assignedTo||[]).map(name => (
                                        <span key={name} className="bg-brand-50 text-brand-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-brand-100">
                                            {name} <button onClick={()=>removeAssignee(name)} className="hover:text-red-500"><Icon name="X" size={12}/></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <SmartSelect options={memberOptions} value={tempAssignee} onChange={setTempAssignee} placeholder="Buscar persona..." />
                                    <Button variant="secondary" onClick={()=>{addAssignee(tempAssignee); setTempAssignee('');}} icon="Plus">Agregar</Button>
                                </div>
                            </div>

                            <Input type="date" label="Fecha Límite" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm, dueDate:e.target.value})} />

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <label className="label-modern mb-2">Checklist</label>
                                <div className="flex gap-2 mb-3">
                                    <input className="input-modern bg-white" placeholder="Nuevo item..." value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} onKeyPress={e=>e.key==='Enter'&&setTaskForm(p=>({...p, checklist:[...(p.checklist||[]),{id:Date.now(),text:newCheckItem,done:false}]}))&&setNewCheckItem('')} />
                                    <button onClick={()=>{if(newCheckItem) setTaskForm(p=>({...p, checklist:[...(p.checklist||[]),{id:Date.now(),text:newCheckItem,done:false}]}))&&setNewCheckItem('')}} className="bg-white border border-slate-200 p-2 rounded-lg hover:bg-slate-100"><Icon name="Plus" size={18}/></button>
                                </div>
                                <div className="space-y-2">
                                    {(taskForm.checklist||[]).map(i=>(
                                        <div key={i.id} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                                            <input type="checkbox" checked={i.done} onChange={()=>setTaskForm(p=>({...p, checklist:p.checklist.map(x=>x.id===i.id?{...x,done:!x.done}:x)}))} className="rounded text-brand-600 focus:ring-brand-500" />
                                            <span className={`flex-1 text-sm ${i.done?'line-through text-slate-400':'text-slate-700'}`}>{i.text}</span>
                                            <button onClick={()=>setTaskForm(p=>({...p, checklist:p.checklist.filter(x=>x.id!==i.id)}))} className="text-slate-300 hover:text-red-500"><Icon name="Trash" size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {editingTask && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Select label="Estado" value={taskForm.status} onChange={e=>setTaskForm({...taskForm, status:e.target.value})}>
                                        <option>Pendiente</option><option>En Proceso</option><option>Completada</option>
                                    </Select>
                                    <div className="flex items-end"><Button className="w-full" onClick={saveTask}>Guardar Cambios</Button></div>
                                </div>
                            )}
                            {!editingTask && <Button className="w-full" onClick={saveTask}>Crear Tarea</Button>}
                            
                            {editingTask && <button onClick={()=>{if(confirm("¿Eliminar tarea?")) {deleteData('tasks', editingTask.id); setIsTaskModalOpen(false)}}} className="w-full text-center text-xs text-red-500 hover:underline mt-2">Eliminar Tarea</button>}
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
};
