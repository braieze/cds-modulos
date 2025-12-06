// src/views/Dashboard.js
window.Views = window.Views || {};

window.Views.Dashboard = ({ userProfile, worship, servers, tasks, messages, ebd, youth, updateData, setActiveTab }) => {
    const { useMemo, useState, useEffect } = React;
    const Utils = window.Utils || {};
    const { Card, Icon, Button, formatDate, formatTime, Badge, Modal } = Utils;
    const Recharts = window.Recharts || null;
    const { EventDetails } = window.Views;
    const { db } = window; 

    const [showHistory, setShowHistory] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [latestPost, setLatestPost] = useState(null);

    // Cargar Último Post
    useEffect(() => {
        const unsub = db.collection('posts').orderBy('date', 'desc').limit(1).onSnapshot(snap => {
            if (!snap.empty) setLatestPost({ id: snap.docs[0].id, ...snap.docs[0].data() });
        });
        return () => unsub();
    }, []);

    // Filtrar Mensajes Fijados
    const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned && m.to === 'all').slice(0, 2), [messages]);

    const today = new Date(); today.setHours(0,0,0,0);

    // Procesar Datos (Futuro vs Historial)
    const processedData = useMemo(() => {
        let upcoming = [], history = [];
        const myName = userProfile.name;

        const process = (collection, category, color) => {
            collection.forEach(item => {
                const itemDate = new Date(item.date);
                if(item.date.length === 10) itemDate.setMinutes(itemDate.getMinutes() + itemDate.getTimezoneOffset());
                
                let myRole = null;
                // Búsqueda inteligente de rol
                if (category === 'Alabanza' && item.team) {
                    Object.entries(item.team).forEach(([inst, list]) => { if (Array.isArray(list) ? list.includes(myName) : list===myName) myRole = inst; });
                } else if (category === 'Servidor' && item.assignments) {
                    Object.entries(item.assignments).forEach(([role, person]) => { if (person === myName) myRole = role; });
                }

                if (myRole) {
                    const data = { ...item, role: myRole, category, color };
                    if (itemDate >= today) upcoming.push(data); else history.push(data);
                }
            });
        };

        process(worship, 'Alabanza', 'brand');
        process(servers, 'Servidor', 'blue');
        
        // Tareas
        tasks.filter(t => t.assignedTo === myName || (Array.isArray(t.assignedTo) && t.assignedTo.includes(myName))).forEach(t => {
            const data = { ...t, title: t.description, category: 'Tarea', date: t.dueDate, color: 'warning', isTask: true };
            if(t.status === 'Pendiente') upcoming.push(data); else history.push(data);
        });

        return { 
            upcoming: upcoming.sort((a,b) => new Date(a.date) - new Date(b.date)), 
            history: history.sort((a,b) => new Date(b.date) - new Date(a.date)) 
        };
    }, [worship, servers, tasks, userProfile, today]);

    // Helpers de Tareas
    const toggleCheckItem = (itemId) => {
        if (!selectedTask) return;
        const updatedList = (selectedTask.checklist || []).map(item => item.id === itemId ? { ...item, done: !item.done } : item);
        const newTask = { ...selectedTask, checklist: updatedList };
        setSelectedTask(newTask);
        updateData('tasks', selectedTask.id, { checklist: updatedList });
    };

    const completeTask = () => {
        if (!selectedTask) return;
        updateData('tasks', selectedTask.id, { status: 'Completada' });
        setSelectedTask(null);
        Utils.notify("Tarea completada");
    };

    // Datos Gráficos
    const chartData = useMemo(() => {
        const counts = {};
        processedData.history.forEach(h => { 
            if(!h.date) return;
            const month = h.date.substring(0, 7); 
            counts[month] = (counts[month] || 0) + 1; 
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).slice(-6);
    }, [processedData.history]);

    return (
        <div className="space-y-8 fade-in">
            
            {/* AVISOS FIJADOS (Sticky Alerts) */}
            {pinnedMessages.length > 0 && (
                <div className="space-y-3 animate-enter">
                    {pinnedMessages.map(msg => (
                        <div key={msg.id} onClick={()=>setActiveTab('messages')} className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-start gap-4 cursor-pointer hover:bg-orange-100 transition-colors shadow-sm">
                            <div className="text-orange-500 bg-orange-100 p-2 rounded-lg"><Icon name="Bell" size={20}/></div>
                            <div>
                                <h4 className="font-bold text-orange-900 text-xs uppercase tracking-wide mb-1">Aviso Importante • {msg.fromName}</h4>
                                <p className="text-orange-800 text-sm font-medium leading-snug">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* HERO & BLOG */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-r from-brand-900 to-brand-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 p-12 opacity-10 transform rotate-12"><Icon name="Home" size={120} /></div>
                    <h2 className="text-3xl font-extrabold mb-2 relative z-10">Hola, {userProfile.name.split(' ')[0]} 👋</h2>
                    <p className="text-brand-100 font-medium max-w-lg relative z-10">
                        Tienes <strong>{processedData.upcoming.length} compromisos</strong> próximos en agenda.
                    </p>
                </div>

                {latestPost && (
                    <div onClick={() => setActiveTab('blog')} className="cursor-pointer bg-white rounded-3xl p-1 shadow-soft border border-slate-100 group relative overflow-hidden h-48 md:h-auto transition-transform hover:-translate-y-1">
                        {latestPost.coverUrl ? (
                            <img src={latestPost.coverUrl} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-90 group-hover:scale-105 transition-transform" />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl"></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent rounded-2xl"></div>
                        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                            <span className="bg-brand-600/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold uppercase mb-2 inline-block shadow-sm">NUEVO MENSAJE</span>
                            <h3 className="font-bold text-lg leading-tight line-clamp-2">{latestPost.title}</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AGENDA */}
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="bg-brand-100 text-brand-600 p-2 rounded-lg"><Icon name="Calendar" size={20} /></div>
                            <h3 className="font-bold text-lg text-slate-800">Tu Agenda Próxima</h3>
                        </div>
                        
                        {processedData.upcoming.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {processedData.upcoming.map((s, i) => (
                                    <Card 
                                        key={i} 
                                        className="border-l-4 border-l-brand-500 hover:shadow-md transition-shadow cursor-pointer relative group" 
                                        onClick={() => s.isTask ? setSelectedTask(s) : setSelectedDate(s.date)}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <Badge type={s.color}>{s.category}</Badge>
                                            <div className="text-right">
                                                <span className="block text-xs font-bold text-slate-700">{formatDate(s.date)}</span>
                                                {!s.isTask && <span className="text-[10px] text-slate-400">{formatTime(s.time)}</span>}
                                            </div>
                                        </div>
                                        <p className="font-bold text-slate-800 leading-tight mb-1">{s.theme || s.title || 'Servicio'}</p>
                                        <p className="text-sm text-slate-500 mb-3">{s.isTask ? 'Tarea asignada' : `Rol: ${s.role}`}</p>
                                        <div className="text-[10px] text-brand-600 font-bold text-right group-hover:underline flex items-center justify-end gap-1">
                                            {s.isTask ? 'Abrir Tarea' : 'Ver Detalles'} <Icon name="ChevronRight" size={12}/>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                <div className="text-slate-300 mb-2 flex justify-center"><Icon name="Smile" size={40}/></div>
                                <p className="text-slate-500 text-sm font-medium">¡Estás libre! No tienes responsabilidades asignadas.</p>
                            </div>
                        )}
                    </div>

                    {/* HISTORIAL */}
                    <div>
                        <button onClick={()=>setShowHistory(!showHistory)} className="w-full flex items-center justify-between text-slate-500 hover:text-brand-600 transition-colors font-bold text-sm mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 hover:bg-white hover:shadow-sm">
                            <span className="flex items-center gap-2"><Icon name="Book" size={16}/> Historial de Servicios</span>
                            <Icon name={showHistory ? "ChevronDown" : "ChevronRight"} size={16}/>
                        </button>
                        
                        {showHistory && (
                            <div className="space-y-2 animate-enter">
                                {processedData.history.map((s, i) => (
                                    <div key={i} className="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs font-bold text-slate-400 w-16 text-center bg-slate-50 rounded py-1">{formatDate(s.date)}</div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-700">{s.theme || s.title}</div>
                                                <div className="text-xs text-slate-500">{s.category} • {s.role || s.status}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {processedData.history.length === 0 && <p className="text-center text-xs text-slate-400">Sin historial aún.</p>}
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMNA LATERAL */}
                <div className="space-y-6">
                    {/* Gráfico Participación */}
                    {Recharts && chartData.length > 0 && (
                        <Card>
                            <h3 className="font-bold text-sm text-slate-800 mb-4 uppercase tracking-wide border-b border-slate-100 pb-2">Tu Participación</h3>
                            <div className="h-40 w-full text-xs">
                                <Recharts.ResponsiveContainer width="100%" height="100%">
                                    <Recharts.BarChart data={chartData}>
                                        <Recharts.XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                        <Recharts.Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} />
                                        <Recharts.Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 4, 4]} barSize={20} />
                                    </Recharts.BarChart>
                                </Recharts.ResponsiveContainer>
                            </div>
                        </Card>
                    )}
                    
                    {/* Avisos Recientes (No fijados) */}
                    <Card className="bg-slate-900 text-white border-slate-800">
                        <div className="flex items-center gap-2 mb-4 text-brand-400">
                            <Icon name="Bell" />
                            <h3 className="font-bold">Últimos Avisos</h3>
                        </div>
                        <div className="space-y-3">
                            {messages.filter(m => !m.isPinned).slice(0, 3).map(m => (
                                <div key={m.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wide">
                                        <span>{m.fromName}</span>
                                        <span>{formatDate(m.date)}</span>
                                    </div>
                                    <p className="text-sm text-slate-200 line-clamp-2 leading-snug">{m.content}</p>
                                </div>
                            ))}
                            {messages.length === 0 && <p className="text-slate-500 text-sm italic text-center">No hay avisos recientes.</p>}
                        </div>
                        <Button variant="secondary" className="w-full mt-4 bg-transparent border-slate-700 text-white hover:bg-slate-800 hover:border-slate-600 transition-colors" onClick={()=>setActiveTab('messages')}>
                            Ver Bandeja de Entrada
                        </Button>
                    </Card>
                </div>
            </div>

            {/* MODAL DE TAREA INTERACTIVA */}
            {selectedTask && (
                <Modal isOpen={!!selectedTask} onClose={()=>setSelectedTask(null)} title="Detalle de Tarea">
                    <div className="space-y-6">
                        <div className="border-b border-slate-100 pb-4">
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">Tarea</span>
                            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{selectedTask.description}</h2>
                            <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                                <Icon name="Calendar" size={14}/> Vence el: <span className="font-bold text-slate-700">{formatDate(selectedTask.dueDate)}</span>
                            </p>
                        </div>

                        {selectedTask.notes && (
                            <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 border border-slate-100 leading-relaxed italic">
                                "{selectedTask.notes}"
                            </div>
                        )}

                        <div className="space-y-3">
                            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Checklist</h4>
                            {(!selectedTask.checklist || selectedTask.checklist.length === 0) 
                                ? <p className="text-sm text-slate-400 italic">No hay sub-tareas.</p>
                                : <div className="space-y-2">
                                    {selectedTask.checklist.map(item => (
                                        <div key={item.id} onClick={() => toggleCheckItem(item.id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${item.done ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-brand-300 shadow-sm'}`}>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${item.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                {item.done && <Icon name="Check" size={14} className="text-white"/>}
                                            </div>
                                            <span className={`flex-1 text-sm font-medium ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                                        </div>
                                    ))}
                                  </div>
                            }
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <Button className="w-full py-4 text-base shadow-xl shadow-brand-500/20" onClick={completeTask}>
                                ✅ Marcar Como Completada
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* SUPER MODAL GLOBAL */}
            {selectedDate && (
                <EventDetails 
                    isOpen={!!selectedDate} 
                    onClose={()=>setSelectedDate(null)} 
                    dateStr={selectedDate}
                    worship={worship}
                    servers={servers}
                    ebd={ebd}
                    youth={youth}
                />
            )}
        </div>
    );
};
