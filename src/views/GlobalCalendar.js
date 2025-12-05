// src/views/GlobalCalendar.js
window.Views = window.Views || {};

window.Views.GlobalCalendar = ({ worship, youth, ebd, servers, tasks }) => {
    const { useState, useMemo } = React;
    const { Card, Icon, Button } = window.Utils;

    // Estado del mes visualizado
    const [currentDate, setCurrentDate] = useState(new Date());

    // 1. Unificar todos los eventos en un solo array
    const allEvents = useMemo(() => {
        let events = [];
        
        // Helper para normalizar
        const add = (list, type, color, titleKey) => {
            list.forEach(item => {
                if(item.date) {
                    events.push({
                        id: item.id,
                        date: item.date, // Formato YYYY-MM-DD
                        time: item.time,
                        title: item[titleKey] || item.theme || item.type,
                        type: type,
                        color: color
                    });
                }
            });
        };

        add(worship, 'Alabanza', 'bg-purple-100 text-purple-700', 'theme');
        add(youth, 'Jóvenes', 'bg-yellow-100 text-yellow-700', 'title');
        add(ebd, 'EBD', 'bg-green-100 text-green-700', 'title');
        add(servers, 'Servidores', 'bg-blue-100 text-blue-700', 'type');
        // Tareas con fecha límite
        tasks.forEach(t => {
            if(t.dueDate) events.push({ id: t.id, date: t.dueDate, title: `Tarea: ${t.description}`, type: 'Tarea', color: 'bg-red-50 text-red-600 border border-red-100' });
        });

        return events;
    }, [worship, youth, ebd, servers, tasks]);

    // Navegación
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    // Cálculos del Grid
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 Domingo, 1 Lunes...

    const days = [];
    // Relleno previo
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    // Días reales
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const monthName = currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold capitalize">{monthName}</h2>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={prevMonth} icon="ChevronLeft">Ant</Button>
                    <Button variant="secondary" onClick={nextMonth} icon="ChevronRight">Sig</Button>
                </div>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                        <div key={d} className="py-3 text-center text-xs font-bold text-slate-500 uppercase">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 bg-slate-200 gap-px">
                    {days.map((day, idx) => {
                        if (!day) return <div key={idx} className="bg-white min-h-[100px]"></div>;
                        
                        // Construir string de fecha para comparar (YYYY-MM-DD local)
                        // Truco simple: crear fecha local y tomar ISO slice
                        // OJO: La fecha que viene de inputs type="date" es YYYY-MM-DD.
                        // Ajustamos el formato para que coincida
                        const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        
                        const dayEvents = allEvents.filter(e => e.date === currentDayStr);

                        return (
                            <div key={idx} className="bg-white min-h-[100px] p-2 hover:bg-slate-50 transition-colors flex flex-col gap-1 group">
                                <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${dayEvents.length > 0 ? 'bg-slate-900 text-white' : 'text-slate-700'}`}>{day}</span>
                                <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[80px] hide-scroll">
                                    {dayEvents.map((ev, i) => (
                                        <div key={i} className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${ev.color}`} title={ev.title}>
                                            {ev.time && <span className="opacity-75 mr-1">{ev.time}</span>}
                                            {ev.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
};
