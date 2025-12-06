// src/views/Dashboard.js
window.Views = window.Views || {};

window.Views.Dashboard = ({ userProfile, worship, servers, tasks, messages, ebd, youth, updateData, setActiveTab }) => {
    const { useMemo, useState } = React;
    const { Card, Icon, Button, formatDate, formatTime, Badge, Accordion } = window.Utils;
    const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } = window.Recharts || {};
    const { EventDetails } = window.Views; // Importamos el Súper Modal

    const [showHistory, setShowHistory] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null); // Para el modal global

    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Procesar Servicios (Futuros vs Historial)
    const processedData = useMemo(() => {
        let upcoming = [];
        let history = [];
        const myName = userProfile.name;

        const process = (collection, category, roleKey, color) => {
            collection.forEach(item => {
                const itemDate = new Date(item.date);
                // Buscar si estoy asignado
                let myRole = null;
                
                // Lógica de búsqueda profunda en objetos de asignación
                if (category === 'Alabanza' && item.team) {
                    Object.entries(item.team).forEach(([inst, list]) => { if (list.includes(myName)) myRole = inst; });
                } else if (category === 'Servidor' && item.assignments) {
                    Object.entries(item.assignments).forEach(([role, person]) => { if (person === myName) myRole = role; });
                } else if (category === 'EBD' || category === 'Jóvenes') {
                    // Lógica futura para EBD/Jóvenes si se asignan personas
                }

                if (myRole) {
                    const data = { ...item, role: myRole, category, color };
                    if (itemDate >= today) upcoming.push(data);
                    else history.push(data);
                }
            });
        };

        process(worship, 'Alabanza', 'team', 'brand');
        process(servers, 'Servidor', 'assignments', 'blue');
        
        // Tareas (Siempre futuros o pendientes)
        tasks.filter(t => t.assignedTo === myName && t.status === 'Pendiente').forEach(t => {
            upcoming.push({ ...t, title: t.description, category: 'Tarea', date: t.dueDate, color: 'warning', isTask: true });
        });

        return {
            upcoming: upcoming.sort((a,b) => new Date(a.date) - new Date(b.date)),
            history: history.sort((a,b) => new Date(b.date) - new Date(a.date)) // Más reciente primero
        };
    }, [worship, servers, tasks, userProfile, today]);

    // 2. Datos para Gráficos (Métricas básicas)
    const chartData = useMemo(() => {
        // Ejemplo: Cantidad de servicios por mes en el historial
        const counts = {};
        processedData.history.forEach(h => {
            const month = h.date.substring(0, 7); // YYYY-MM
            counts[month] = (counts[month] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a,b) => a.name.localeCompare(b.name))
            .slice(-6); // Últimos 6 meses
    }, [processedData.history]);

    return (
        <div className="space-y-8 fade-in">
            {/* HERO */}
            <div className="bg-gradient-to-r from-brand-900 to-brand-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 transform rotate-12"><Icon name="Home" size={120} /></div>
                <h2 className="text-3xl font-extrabold mb-2 relative z-10">Hola, {userProfile.name.split(' ')[0]} 👋</h2>
                <p className="text-brand-100 font-medium max-w-lg relative z-10">
                    Tienes <strong>{processedData.upcoming.length} compromisos</strong> próximos.
                </p>
                
                {/* Estadísticas Rápidas */}
                <div className="flex gap-4 mt-6 relative z-10">
                    <div className="bg-white/10 backdrop-blur rounded-xl p-3 px-5 border border-white/20">
                        <div className="text-2xl font-bold">{processedData.history.length}</div>
                        <div className="text-[10px] uppercase tracking-wider opacity-80">Servicios Totales</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COLUMNA PRINCIPAL */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* AGENDA PRÓXIMA */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Icon name="Calendar" className="text-brand-600" />
                            <h3 className="font-bold text-lg text-slate-800">Tu Agenda Próxima</h3>
                        </div>
                        
                        {processedData.upcoming.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {processedData.upcoming.map((s, i) => (
                                    <Card key={i} className="border-l-4 border-l-brand-500 hover:shadow-md transition-shadow cursor-pointer" onClick={() => !s.isTask && setSelectedDate(s.date)}>
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
                                            <Button variant="secondary" className="w-full py-1.5 text-xs h-8" onClick={(e)=>{ e.stopPropagation(); updateData('tasks', s.id, {status: 'Completada'}); }}>
                                                Marcar Listo
                                            </Button>
                                        )}
                                        {!s.isTask && <p className="text-[10px] text-brand-500 font-bold mt-2 text-right">Ver Detalles →</p>}
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-slate-500 text-sm font-medium">¡Estás libre! No tienes responsabilidades asignadas próximamente.</p>
                            </div>
                        )}
                    </div>

                    {/* HISTORIAL DESPLEGABLE */}
                    <div>
                        <button onClick={()=>setShowHistory(!showHistory)} className="flex items-center gap-2 text-slate-500 hover:text-brand-600 transition-colors font-bold text-sm mb-4">
                            <Icon name={showHistory ? "ChevronDown" : "ChevronRight"} size={16}/>
                            {showHistory ? "Ocultar Historial" : "Ver Mis Servicios Anteriores"}
                        </button>
                        
                        {showHistory && (
                            <div className="space-y-2 animate-enter">
                                {processedData.history.map((s, i) => (
                                    <div key={i} className="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs font-bold text-slate-400 w-16">{formatDate(s.date)}</div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-700">{s.theme || s.title}</div>
                                                <div className="text-xs text-slate-500">{s.category} • {s.role}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMNA LATERAL (GRÁFICOS) */}
                <div className="space-y-6">
                    {BarChart && chartData.length > 0 && (
                        <Card>
                            <h3 className="font-bold text-sm text-slate-800 mb-4 uppercase tracking-wide">Tu Participación (6 Meses)</h3>
                            <div className="h-48 w-full text-xs">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                        <YAxis hide />
                                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 4, 4]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    )}
                    
                    <Card className="bg-slate-900 text-white border-slate-800">
                        <div className="flex items-center gap-2 mb-4 text-brand-400">
                            <Icon name="Bell" />
                            <h3 className="font-bold">Avisos</h3>
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
                        </div>
                        <Button variant="secondary" className="w-full mt-4 bg-slate-800 border-slate-700 text-white hover:bg-slate-700" onClick={()=>setActiveTab('messages')}>Ver Todos</Button>
                    </Card>
                </div>
            </div>

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
                    profile={userProfile}
                />
            )}
        </div>
    );
};
