// src/views/MinistryWithTasks.js
window.Views = window.Views || {};

window.Views.MinistryWithTasks = ({ title, col, filterMinistry, members, tasks, events, addData, deleteData, updateData }) => {
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, DateFilter, formatDate, formatTime, Icon, SmartSelect } = Utils;

    const [activeTab, setActiveTab] = useState('events');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const initialEvent = { date: window.Utils.getLocalDate(), time: '', title: '', type: 'Reunión', assignments: {}, details: {}, links: '' };
    const [evtForm, setEvtForm] = useState(initialEvent);
    
    // Tareas
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [taskForm, setTaskForm] = useState({ description: '', assignedTo: [], dueDate: '', status: 'Pendiente', checklist: [], notes: '' });
    const [tempAssignee, setTempAssignee] = useState('');
    const [newCheckItem, setNewCheckItem] = useState('');

    const memberOptions = useMemo(() => members.filter(m => m.ministry === filterMinistry || ['Líder', 'Pastor'].includes(m.role) || m.ministry === 'General').map(m => ({ value: m.name, label: m.name })), [members, filterMinistry]);
    const monthlyEvents = useMemo(() => events.filter(e => e.date && e.date.startsWith(currentDate.toISOString().slice(0, 7))).sort((a,b) => new Date(a.date) - new Date(b.date)), [events, currentDate]);
    const ministryTasks = tasks.filter(t => t.ministry === col).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    // MULTI-ASIGNACIÓN DE ROLES
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

    const openEventModal = (ev = null) => {
        setEditingEvent(ev);
        setEvtForm(ev || { ...initialEvent, date: window.Utils.getLocalDate() });
        setIsAddingEvent(true);
    };

    const saveEvent = () => {
        if(!evtForm.date) return Utils.notify("Falta fecha", "error");
        const finalTitle = evtForm.title || (col === 'servers' ? 'Servicio General' : 'Actividad');
        const data = { ...evtForm, title: finalTitle };
        editingEvent ? updateData(col, editingEvent.id, data) : addData(col, data);
        setIsAddingEvent(false);
        Utils.notify("Guardado");
    };

    const renderRoles = () => {
        const baseRoles = col === 'ebd' ? ['Maestro', 'Auxiliar'] : (col === 'servers' ? ['Recepción','Baños','Altar','Ofrenda','Seguridad'] : ['Lider']);
        const allRoles = [...new Set([...baseRoles, ...Object.keys(evtForm.assignments || {})])];
        
        return (
            <div className="space-y-4 pt-2 border-t border-slate-100 mt-2">
                <label className="label-modern">Equipo</label>
                {allRoles.map(role => (
                    <div key={role} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2">{role}</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {(Array.isArray(evtForm.assignments[role]) ? evtForm.assignments[role] : (evtForm.assignments[role]?[evtForm.assignments[role]]:[])).map(n => (
                                <span key={n} className="bg-white border px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                                    {n} <button onClick={()=>handleAssignmentRemove(role, n)} className="text-slate-400 hover:text-red-500"><Icon name="X" size={10}/></button>
                                </span>
                            ))}
                        </div>
                        <SmartSelect options={memberOptions} onChange={v=>handleAssignmentAdd(role, v)} placeholder="Agregar persona..." />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">{title}</h2><div className="flex bg-white p-1 rounded-xl shadow-sm"><button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab==='events'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Calendario</button><button onClick={()=>setActiveTab('tasks')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab==='tasks'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Tareas</button></div></div>
            {activeTab === 'events' && (<><div className="flex justify-between items-end mb-4"><DateFilter currentDate={currentDate} onChange={setCurrentDate} /><Button icon="Plus" onClick={()=>openEventModal()}>Nuevo</Button></div><div className="space-y-4">{monthlyEvents.map(e => (<Card key={e.id} className="group relative hover:border-brand-300"><div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={()=>openEventModal(e)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Icon name="Edit" size={16}/></button><button onClick={()=>deleteData(col, e.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Icon name="Trash" size={16}/></button></div><div className="flex gap-4"><div className="flex flex-col items-center justify-center bg-brand-50 text-brand-700 rounded-xl min-w-[70px] px-2 py-3 h-fit border border-brand-100"><span className="text-xs font-bold uppercase">{new Date(e.date).toLocaleDateString('es-AR',{weekday:'short'})}</span><span className="text-2xl font-black">{new Date(e.date).getDate()}</span></div><div className="flex-1"><div className="flex items-center gap-2 mb-1"><Badge type="brand">{e.type}</Badge><span className="text-xs font-bold text-slate-400">{e.time} hs</span></div><h3 className="font-bold text-lg">{e.title}</h3>{e.details?.preacher && <p className="text-sm text-slate-600">🎤 {e.details.preacher}</p>}{e.assignments && <div className="mt-3 flex flex-wrap gap-2">{Object.entries(e.assignments).map(([r,p])=><span key={r} className="text-xs bg-slate-50 border px-2 py-1 rounded"><strong>{r}:</strong> {Array.isArray(p)?p.join(', '):p}</span>)}</div>}</div></div></Card>))}</div><Modal isOpen={isAddingEvent} onClose={()=>setIsAddingEvent(false)} title="Evento"><div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1"><div className="grid grid-cols-2 gap-4"><Input type="date" label="Fecha" value={evtForm.date} onChange={e=>setEvtForm({...evtForm, date:e.target.value})} /><Input type="time" label="Hora" value={evtForm.time} onChange={e=>setEvtForm({...evtForm, time:e.target.value})} /></div><Input label="Título" value={evtForm.title} onChange={e=>setEvtForm({...evtForm, title:e.target.value})} />{col==='servers'&&<Input label="Predicador" value={evtForm.details?.preacher} onChange={e=>setEvtForm(p=>({...p,details:{...p.details,preacher:e.target.value}}))} />}{col==='ebd'&&<Input label="Tema Clase" value={evtForm.details?.topic} onChange={e=>setEvtForm(p=>({...p,details:{...p.details,topic:e.target.value}}))} />}{renderRoles()}<Button className="w-full" onClick={saveEvent}>Guardar</Button></div></Modal></>)}
        </div>
    );
};

            {activeTab === 'tasks' && (
                <>
                    <div className="flex justify-end mb-4"><Button icon="Plus" onClick={()=>openTaskModal()}>Nueva Tarea</Button></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{ministryTasks.map(t => (<div key={t.id} onClick={()=>openTaskModal(t)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer"><div className="flex justify-between items-start mb-2"><Badge type={t.status === 'Completada' ? 'success' : 'warning'}>{t.status}</Badge>{t.dueDate && <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">{formatDate(t.dueDate)}</span>}</div><h4 className="font-bold text-slate-800 mb-1">{t.description}</h4><div className="flex -space-x-2 mt-2">{t.assignedTo?.map && t.assignedTo.map((n,i)=><div key={i} className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[9px] border border-white font-bold text-brand-700" title={n}>{n.charAt(0)}</div>)}</div></div>))}</div>
                    <Modal isOpen={isTaskModalOpen} onClose={()=>setIsTaskModalOpen(false)} title="Tarea"><div className="space-y-5 max-h-[75vh] overflow-y-auto"><Input label="Título" value={taskForm.description} onChange={e=>setTaskForm({...taskForm, description:e.target.value})} /><div><label className="label-modern">Responsables</label><div className="flex flex-wrap gap-2 mb-2">{(taskForm.assignedTo||[]).map(n=><span key={n} className="bg-slate-100 px-2 rounded text-xs flex items-center gap-1">{n} <button onClick={()=>setTaskForm(p=>({...p, assignedTo:p.assignedTo.filter(x=>x!==n)}))}><Icon name="X" size={10}/></button></span>)}</div><div className="flex gap-2"><SmartSelect options={memberOptions} value={tempAssignee} onChange={setTempAssignee}/><Button variant="secondary" onClick={addAssignee} icon="Plus">Agg</Button></div></div><Input type="date" label="Vence" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm, dueDate:e.target.value})} /><div className="bg-slate-50 p-4 rounded-xl"><label className="label-modern">Checklist</label><div className="flex gap-2 mb-2"><input className="input-modern bg-white py-1" value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} /><button onClick={()=>{if(newCheckItem) setTaskForm(p=>({...p, checklist:[...(p.checklist||[]),{id:Date.now(),text:newCheckItem,done:false}]}))}}><Icon name="Plus"/></button></div><div className="space-y-2">{(taskForm.checklist||[]).map(i=>(<div key={i.id} className="flex gap-2"><input type="checkbox" checked={i.done} onChange={()=>setTaskForm(p=>({...p, checklist:p.checklist.map(x=>x.id===i.id?{...x,done:!x.done}:x)}))} /><span className={i.done?'line-through':''}>{i.text}</span></div>))}</div></div><Button className="w-full" onClick={saveTask}>Guardar</Button>{editingTask && <button onClick={()=>{deleteData('tasks', editingTask.id); setIsTaskModalOpen(false)}} className="text-red-500 text-xs w-full text-center mt-2">Eliminar</button>}</div></Modal>
                </>
            )}
        </div>
    );
};
