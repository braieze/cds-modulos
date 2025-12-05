// src/views/Dashboard.js
window.Views = window.Views || {};

window.Views.Dashboard = ({ userProfile, worship, servers, tasks, messages, updateData, setActiveTab }) => {
    const { useMemo } = React;
    const { Card, Icon, Button, formatDate, formatTime, Badge } = window.Utils;

    const myServices = useMemo(() => {
        const services = [];
        const myName = userProfile.name;
        
        // Buscar en Alabanza
        worship.forEach(w => {
            Object.entries(w.team || {}).forEach(([inst, list]) => {
                if(list.includes(myName)) services.push({ ...w, role: inst, category: 'Alabanza', color: 'brand' });
            });
        });
        // Buscar en Servidores
        servers.forEach(s => {
            Object.entries(s.assignments || {}).forEach(([role, person]) => {
                if(person === myName) services.push({ ...s, role: role, category: 'Servidor', color: 'blue' });
            });
        });
        // Tareas
        tasks.filter(t => t.assignedTo === myName && t.status === 'Pendiente').forEach(t => {
            services.push({ ...t, title: t.description, category: 'Tarea', date: t.dueDate, color: 'warning', isTask:true });
        });

        return services.sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [worship, servers, tasks, userProfile]);

    const unreadCount = messages.filter(m => (m.to === 'all' || m.to === userProfile.id) && !m.readBy?.includes(userProfile.id)).length;

    return (
        <div className="space-y-8 fade-in">
            {/* HERO SECTION */}
            <div className="bg-gradient-to-r from-brand-900 to-brand-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 transform rotate-12"><Icon name="Home" size={120} /></div>
                <h2 className="text-3xl font-extrabold mb-2 relative z-10">Hola, {userProfile.name.split(' ')[0]} 👋</h2>
                <p className="text-brand-100 font-medium max-w-lg relative z-10">
                    Tienes <strong>{myServices.length} actividades</strong> pendientes y <strong>{unreadCount} mensajes</strong> nuevos.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 relative z-10">
                    <button onClick={()=>setActiveTab('messages')} className="bg-white/10 backdrop-blur border border-white/20 p-4 rounded-xl hover:bg-white/20 transition-all text-left">
                        <div className="text-2xl font-bold">{unreadCount}</div>
                        <div className="text-xs text-brand-100 uppercase font-bold">Mensajes</div>
                    </button>
                    <button onClick={()=>setActiveTab('calendar')} className="bg-white/10 backdrop-blur border border-white/20 p-4 rounded-xl hover:bg-white/20 transition-all text-left">
                        <div className="text-2xl font-bold">{myServices.filter(s=>!s.isTask).length}</div>
                        <div className="text-xs text-brand-100 uppercase font-bold">Servicios</div>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COLUMNA IZQUIERDA: SERVICIOS */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Icon name="Clipboard" className="text-brand-600" />
                        <h3 className="font-bold text-lg text-slate-800">Tu Agenda Próxima</h3>
                    </div>
                    
                    {myServices.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {myServices.map((s, i) => (
                                <Card key={i} className="border-l-4 border-l-brand-500 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <Badge type={s.color}>{s.category}</Badge>
                                        <div className="text-right">
                                            <span className="block text-xs font-bold text-slate-700">{formatDate(s.date)}</span>
                                            {!s.isTask && <span className="text-[10px] text-slate-400">{formatTime(s.time)}</span>}
                                        </div>
                                    </div>
                                    <p className="font-bold text-slate-800 leading-tight mb-1">{s.theme || s.title || 'Servicio General'}</p>
                                    <p className="text-sm text-slate-500 mb-3">{s.isTask ? 'Tarea asignada' : `Rol: ${s.role}`}</p>
                                    
                                    {s.isTask && (
                                        <Button variant="secondary" className="w-full py-1.5 text-xs h-8" onClick={()=>updateData('tasks', s.id, {status: 'Completada'})}>
                                            Marcar Listo
                                        </Button>
                                    )}
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="text-slate-300 mb-2"><Icon name="Smile" size={40}/></div>
                            <p className="text-slate-500 text-sm font-medium">¡Estás libre! No tienes responsabilidades asignadas.</p>
                        </div>
                    )}
                </div>

                {/* COLUMNA DERECHA: ACCESOS */}
                <div className="space-y-6">
                    <Card className="bg-slate-900 text-white border-slate-800">
                        <div className="flex items-center gap-2 mb-4 text-brand-400">
                            <Icon name="Bell" />
                            <h3 className="font-bold">Avisos Recientes</h3>
                        </div>
                        <div className="space-y-4">
                            {messages.slice(0, 3).map(m => (
                                <div key={m.id} className="border-b border-slate-700 pb-3 last:border-0 last:pb-0">
                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span>{m.fromName}</span>
                                        <span>{formatDate(m.date)}</span>
                                    </div>
                                    <p className="text-sm text-slate-200 line-clamp-2">{m.content}</p>
                                </div>
                            ))}
                            {messages.length === 0 && <p className="text-slate-500 text-sm italic">No hay avisos.</p>}
                        </div>
                        <Button variant="secondary" className="w-full mt-4 bg-slate-800 border-slate-700 text-white hover:bg-slate-700" onClick={()=>setActiveTab('messages')}>Ver Todos</Button>
                    </Card>
                </div>
            </div>
        </div>
    );
};
