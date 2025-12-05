// src/views/Dashboard.js
window.Views = window.Views || {};

window.Views.Dashboard = ({ userProfile, worship, servers, tasks, messages, updateData, setActiveTab }) => {
    const { useMemo } = React;
    const { Card, Icon, Button, formatDate, formatTime } = window.Utils;

    const myServices = useMemo(() => {
        const services = [];
        const myName = userProfile.name;
        
        worship.forEach(w => {
            Object.entries(w.team || {}).forEach(([inst, list]) => {
                if(list.includes(myName)) services.push({ ...w, role: inst, category: 'Alabanza', color: 'bg-purple-100 text-purple-700' });
            });
        });
        servers.forEach(s => {
            Object.entries(s.assignments || {}).forEach(([role, person]) => {
                if(person === myName) services.push({ ...s, role: role, category: 'Servidor', color: 'bg-blue-100 text-blue-700' });
            });
        });
        tasks.filter(t => t.assignedTo === myName && t.status === 'Pendiente').forEach(t => {
            services.push({ ...t, title: t.description, category: 'Tarea', date: t.dueDate, color: 'bg-amber-100 text-amber-700', isTask:true });
        });

        return services.sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [worship, servers, tasks, userProfile]);

    const myMessages = messages.filter(m => (m.to === 'all' || m.to === userProfile.id) && !m.readBy?.includes(userProfile.id));

    const markAsRead = (msg) => {
        const readBy = msg.readBy || [];
        updateData('messages', msg.id, { readBy: [...readBy, userProfile.id] });
    };

    return (
        <div className="space-y-8 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Hola, {userProfile.name.split(' ')[0]}</h2>
                    <p className="text-slate-500 font-medium">Panel de control de {userProfile.ministry}</p>
                </div>
                {myMessages.length > 0 && (
                    <div className="bg-brand-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-brand-500/40 animate-pulse cursor-pointer" onClick={()=>setActiveTab('messages')}>
                        <Icon name="Mail" size={16}/> {myMessages.length} Mensajes nuevos
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-l-4 border-l-brand-500">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                            <Icon name="Clipboard" className="text-brand-600"/> Mis Servicios & Tareas
                        </h3>
                        {myServices.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {myServices.map((s, i) => (
                                    <div key={i} className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${s.color}`}>{s.category}</span>
                                            <div className="text-right">
                                                <span className="block text-xs font-bold text-slate-700">{formatDate(s.date)}</span>
                                                <span className="text-[10px] text-slate-400">{formatTime(s.time)}</span>
                                            </div>
                                        </div>
                                        <p className="font-bold text-slate-800 leading-tight mb-1">{s.theme || s.title || 'Servicio General'}</p>
                                        <p className="text-sm text-slate-500">{s.isTask ? 'Tarea asignada' : `Rol: ${s.role}`}</p>
                                        {s.isTask && <Button variant="secondary" className="mt-3 text-xs py-1 h-8" onClick={()=>updateData('tasks', s.id, {status: 'Completada'})}>Marcar Lista</Button>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-slate-400 text-sm">No tienes responsabilidades asignadas próximamente.</p>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-slate-900 text-white">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Icon name="Bell"/> Notificaciones</h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto hide-scroll">
                            {myMessages.length > 0 ? myMessages.map(m => (
                                <div key={m.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors" onClick={()=>markAsRead(m)}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-brand-400">{m.fromName}</span>
                                        <span className="text-[10px] text-slate-400">{formatDate(m.date)}</span>
                                    </div>
                                    <p className="text-sm text-slate-200 line-clamp-2">{m.content}</p>
                                    <div className="mt-2 text-[10px] text-blue-300 font-bold uppercase tracking-wider">Marcar como leído</div>
                                </div>
                            )) : <p className="text-slate-500 text-sm text-center italic py-4">Estás al día.</p>}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
