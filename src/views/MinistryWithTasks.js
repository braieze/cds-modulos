// src/views/MinistryWithTasks.js
window.Views = window.Views || {};

window.Views.MinistryWithTasks = ({ title, col, filterMinistry, members, tasks, events, addData, deleteData }) => {
    const { useState } = React;
    const { Card, Button, Badge, Modal, formatDate, formatTime } = window.Utils;

    const [isAdding, setIsAdding] = useState(false);
    const [tab, setTab] = useState('events'); // events, tasks
    const [evtForm, setEvtForm] = useState({ date: '', time: '', title: '', location: '' });
    const [taskForm, setTaskForm] = useState({ description: '', assignedTo: '', dueDate: '', status: 'Pendiente' });
    
    // Filtrar tareas específicas del ministerio
    const ministryTasks = tasks.filter(t => t.ministry === col);
    const availableMembers = members.filter(m => m.ministry === filterMinistry || m.role === 'Líder');

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{title}</h2>
                <div className="flex gap-2">
                    <button onClick={()=>setTab('events')} className={`px-3 py-1 text-xs font-bold rounded ${tab==='events'?'bg-slate-800 text-white':'bg-slate-200'}`}>Eventos</button>
                    <button onClick={()=>setTab('tasks')} className={`px-3 py-1 text-xs font-bold rounded ${tab==='tasks'?'bg-slate-800 text-white':'bg-slate-200'}`}>Tareas</button>
                </div>
            </div>

            {tab === 'events' ? (
                <>
                    <Button className="w-full md:w-auto" icon="Plus" onClick={()=>{setEvtForm({ date: '', time: '', title: '', location: '' }); setIsAdding(true);}}>Nuevo Evento</Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {events.map(e => (
                            <Card key={e.id}>
                                <h3 className="font-bold">{e.title || e.topic}</h3>
                                <p className="text-sm text-slate-500">{formatDate(e.date)} - {formatTime(e.time)}</p>
                                <p className="text-xs mt-1 text-slate-400">{e.location}</p>
                                <button onClick={()=>deleteData(col, e.id)} className="text-red-400 text-xs mt-2 hover:underline">Eliminar</button>
                            </Card>
                        ))}
                    </div>
                    <Modal isOpen={isAdding} onClose={()=>setIsAdding(false)} title="Evento">
                        <div className="space-y-4">
                            <input className="input-modern" placeholder="Título/Tema" onChange={e=>setEvtForm({...evtForm, title:e.target.value})} />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" className="input-modern" onChange={e=>setEvtForm({...evtForm, date:e.target.value})}/>
                                <input type="time" className="input-modern" onChange={e=>setEvtForm({...evtForm, time:e.target.value})}/>
                            </div>
                            <input className="input-modern" placeholder="Lugar" onChange={e=>setEvtForm({...evtForm, location:e.target.value})} />
                            <Button className="w-full" onClick={()=>{addData(col, evtForm); setIsAdding(false);}}>Guardar</Button>
                        </div>
                    </Modal>
                </>
            ) : (
                <>
                    <Button className="w-full md:w-auto" icon="Clipboard" onClick={()=>setIsAdding(true)}>Asignar Tarea</Button>
                    <div className="space-y-2 mt-4">
                        {ministryTasks.map(t => (
                            <div key={t.id} className="bg-white p-3 rounded-lg border flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm">{t.description}</p>
                                    <p className="text-xs text-slate-500">Resp: <span className="text-brand-600 font-bold">{t.assignedTo}</span> • Vence: {formatDate(t.dueDate)}</p>
                                </div>
                                <Badge type={t.status === 'Pendiente' ? 'warning' : 'success'}>{t.status}</Badge>
                            </div>
                        ))}
                    </div>
                    <Modal isOpen={isAdding} onClose={()=>setIsAdding(false)} title="Nueva Tarea">
                        <div className="space-y-4">
                            <input className="input-modern" placeholder="Descripción de la tarea" onChange={e=>setTaskForm({...taskForm, description:e.target.value})}/>
                            <div>
                                <label className="label-modern">Responsable</label>
                                <select className="input-modern" onChange={e=>setTaskForm({...taskForm, assignedTo:e.target.value})}>
                                    <option value="">Seleccionar...</option>
                                    {availableMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                </select>
                            </div>
                            <div><label className="label-modern">Fecha Límite</label><input type="date" className="input-modern" onChange={e=>setTaskForm({...taskForm, dueDate:e.target.value})}/></div>
                            <Button className="w-full" onClick={()=>{addData('tasks', { ...taskForm, ministry: col }); setIsAdding(false);}}>Asignar</Button>
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
};
