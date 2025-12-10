window.Views = window.Views || {};

window.Views.GlobalCalendar = ({ worship, youth, ebd, servers, tasks, userProfile, addData }) => {
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, DateFilter, Modal, Input, Select, Icon } = Utils;
    const { EventDetails } = window.Views;

    if (!userProfile) return <div className="p-8 text-center">Cargando...</div>;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEventDate, setSelectedEventDate] = useState(null);
    const [createModal, setCreateModal] = useState(null);
    const [newEvent, setNewEvent] = useState({ type: '', title: '', time: '' });

    // UNIFICAR TODOS LOS EVENTOS EN UNA LISTA
    const allEvents = useMemo(() => {
        let events = [];
        const process = (list, type, color, titleKey) => {
            if (!list) return;
            list.forEach(item => {
                if(item.date) {
                    events.push({
                        id: item.id,
                        date: item.date,
                        time: item.time || '',
                        title: item[titleKey] || item.theme || item.type || 'Evento',
                        category: type,
                        color: color,
                        raw: item // Guardamos el objeto original
                    });
                }
            });
        };

        process(worship, 'Alabanza', 'bg-purple-100 text-purple-700 border-purple-200', 'theme');
        process(youth, 'Jóvenes', 'bg-yellow-100 text-yellow-700 border-yellow-200', 'title');
        process(ebd, 'EBD', 'bg-green-100 text-green-700 border-green-200', 'title');
        process(servers, 'Servidores', 'bg-blue-100 text-blue-700 border-blue-200', 'type');
        
        // Agregar Tareas con fecha límite
        if(tasks) {
            tasks.forEach(t => {
                if(t.dueDate && t.status !== 'Completada') {
                    events.push({
                        id: t.id,
                        date: t.dueDate,
                        time: '',
                        title: t.description,
                        category: 'Tarea',
                        color: 'bg-orange-100 text-orange-700 border-orange-200',
                        isTask: true
                    });
                }
            });
        }

        return events;
    }, [worship, youth, ebd, servers, tasks]);

    const handleDayClick = (dateStr, hasEvents) => {
        // Siempre permitir ver detalles si hay eventos, o crear si no hay
        if (hasEvents) {
            setSelectedEventDate(dateStr);
        } else if (['Pastor', 'Líder'].includes(userProfile.role)) {
            // Solo líderes pueden crear desde calendario
             setCreateModal({ date: dateStr });
             setNewEvent({ type: 'servers', title: '', time: '19:00' });
        }
    };

    const handleCreate = () => {
        if (!newEvent.title) return Utils.notify("Título requerido", "error");
        
        // Crear evento básico en la colección correspondiente
        let collection = newEvent.type;
        let payload = {
            date: createModal.date,
            time: newEvent.time,
            title: newEvent.title,
            type: 'Reunión', 
            assignments: {},
            details: {}
        };
        
        if (collection === 'worship') {
            payload.theme = newEvent.title;
            payload.type = 'Culto';
            delete payload.title;
        }

        addData(collection, payload);
        Utils.notify("Evento creado");
        setCreateModal(null);
    };

    // Render del Calendario
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 Domingo
    
    // Crear array de días con espacios vacíos al inicio
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Calendario Global</h2>
            </div>
            
            <DateFilter currentDate={currentDate} onChange={setCurrentDate} />

            <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                        <div key={d} className="py-3 text-center text-xs font-extrabold text-slate-400 uppercase tracking-wider">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 bg-slate-200 gap-px">
                    {days.map((day, idx) => {
                        if (!day) return <div key={idx} className="bg-slate-50/50 min-h-[100px] md:min-h-[120px]"></div>;
                        
                        const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = allEvents.filter(e => e.date === currentDayStr);
                        const isToday = Utils.getLocalDate() === currentDayStr;

                        return (
                            <div key={idx} onClick={() => handleDayClick(currentDayStr, dayEvents.length > 0)} className={`bg-white min-h-[100px] md:min-h-[120px] p-1 md:p-2 hover:bg-blue-50 transition-colors flex flex-col gap-1 cursor-pointer group relative ${isToday ? 'bg-blue-50/30' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <span className={`text-xs md:text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-brand-600 text-white shadow-md' : 'text-slate-700'}`}>{day}</span>
                                    {dayEvents.length > 0 && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">{dayEvents.length}</span>}
                                </div>
                                
                                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                    {dayEvents.slice(0, 3).map((ev, i) => (
                                        <div key={i} className={`text-[9px] md:text-[10px] px-1.5 py-1 rounded border-l-2 truncate font-medium ${ev.color}`}>
                                            {ev.time && <span className="opacity-75 mr-1">{ev.time}</span>}
                                            {ev.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && <div className="text-[9px] text-slate-400 pl-1 font-bold">+{dayEvents.length - 3} más...</div>}
                                </div>

                                {/* Botón + invisible en hover */}
                                {!dayEvents.length && ['Pastor','Líder'].includes(userProfile.role) && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-brand-100 text-brand-600 p-2 rounded-full shadow-sm"><Icon name="Plus" size={16}/></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* MODAL CREAR EVENTO RÁPIDO */}
            {createModal && (
                <Modal isOpen={!!createModal} onClose={()=>setCreateModal(null)} title={`Evento: ${Utils.formatDate(createModal.date)}`}>
                    <div className="space-y-4">
                        <Select label="Ministerio" value={newEvent.type} onChange={e=>setNewEvent({...newEvent, type:e.target.value})}>
                            <option value="">Seleccionar...</option>
                            <option value="servers">Servicio General</option>
                            <option value="worship">Alabanza</option>
                            <option value="youth">Jóvenes</option>
                            <option value="ebd">Escuela Bíblica</option>
                        </Select>
                        <Input label="Título" value={newEvent.title} onChange={e=>setNewEvent({...newEvent, title:e.target.value})} placeholder="Ej. Reunión Especial"/>
                        <Input type="time" label="Hora" value={newEvent.time} onChange={e=>setNewEvent({...newEvent, time:e.target.value})}/>
                        <Button className="w-full" onClick={handleCreate}>Guardar</Button>
                    </div>
                </Modal>
            )}

            {/* MODAL DETALLES DEL DÍA */}
            {selectedEventDate && (
                <EventDetails 
                    isOpen={!!selectedEventDate} 
                    onClose={()=>setSelectedEventDate(null)} 
                    dateStr={selectedEventDate}
                    worship={worship}
                    servers={servers}
                    ebd={ebd}
                    youth={youth}
                />
            )}
        </div>
    );
};
