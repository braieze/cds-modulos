// src/views/GlobalCalendar.js
window.Views = window.Views || {};

window.Views.GlobalCalendar = ({ worship, youth, ebd, servers, tasks, userProfile, addData }) => {
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, DateFilter, Modal, Input, Select, Icon } = Utils;
    const { EventDetails } = window.Views;

    // Seguridad si userProfile no cargó aún
    if (!userProfile) return <div className="p-8 text-center">Cargando perfil...</div>;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEventDate, setSelectedEventDate] = useState(null);
    const [createModal, setCreateModal] = useState(null);
    const [newEvent, setNewEvent] = useState({ type: '', title: '', time: '' });

    const allEvents = useMemo(() => {
        let events = [];
        const add = (list, type, color, titleKey) => {
            if (!list) return;
            list.forEach(item => {
                if(item.date) {
                    events.push({
                        id: item.id,
                        date: item.date,
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
        return events;
    }, [worship, youth, ebd, servers]);

    const getCreateOptions = () => {
        const role = userProfile.role;
        const ministry = userProfile.ministry;
        const options = [];

        if (role === 'Pastor') {
            options.push({ value: 'worship', label: 'Alabanza' });
            options.push({ value: 'servers', label: 'Servicio General' });
            options.push({ value: 'ebd', label: 'EBD' });
            options.push({ value: 'youth', label: 'Jóvenes' });
        } else if (role === 'Líder') {
            if (ministry === 'Alabanza') options.push({ value: 'worship', label: 'Ensayo/Culto' });
            if (ministry === 'EBD') options.push({ value: 'ebd', label: 'Clase EBD' });
            if (ministry === 'Jóvenes') options.push({ value: 'youth', label: 'Reunión Jóvenes' });
            if (ministry === 'Servidores') options.push({ value: 'servers', label: 'Servicio' });
        }
        return options;
    };

    const handleDayClick = (dateStr, hasEvents) => {
        if (hasEvents) {
            setSelectedEventDate(dateStr);
        } else {
            const opts = getCreateOptions();
            if (opts.length > 0) {
                setCreateModal({ date: dateStr, options: opts });
                setNewEvent({ type: opts[0].value, title: '', time: '19:00' });
            }
        }
    };

    const handleCreate = () => {
        if (!newEvent.title) return Utils.notify("Título requerido", "error");
        
        let payload = {
            date: createModal.date,
            time: newEvent.time,
            title: newEvent.title,
            type: 'Reunión',
            assignments: {},
            details: {}
        };

        // Adaptar payload según colección
        if (newEvent.type === 'servers') payload.type = 'Orden de Culto';
        if (newEvent.type === 'worship') {
            payload = { ...payload, theme: newEvent.title, type: 'Culto', team: {}, songList: [] };
            delete payload.title; 
        }

        addData(newEvent.type, payload);
        Utils.notify("Evento agendado");
        setCreateModal(null);
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-slate-800">Calendario Global</h2></div>
            <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
            <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (<div key={d} className="py-3 text-center text-xs font-extrabold text-slate-400 uppercase tracking-wider">{d}</div>))}</div>
                <div className="grid grid-cols-7 bg-slate-100 gap-px">
                    {days.map((day, idx) => {
                        if (!day) return <div key={idx} className="bg-white min-h-[100px] md:min-h-[120px]"></div>;
                        const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = allEvents.filter(e => e.date === currentDayStr);
                        const isToday = new Date().toISOString().slice(0,10) === currentDayStr;

                        return (
                            <div key={idx} onClick={() => handleDayClick(currentDayStr, dayEvents.length > 0)} className="bg-white min-h-[100px] md:min-h-[120px] p-1 md:p-2 hover:bg-brand-50 transition-colors flex flex-col gap-1 cursor-pointer group relative">
                                <div className="flex justify-between items-start">
                                    <span className={`text-xs md:text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-brand-600 text-white shadow-glow' : 'text-slate-700'}`}>{day}</span>
                                    {dayEvents.length === 0 && getCreateOptions().length > 0 && <span className="opacity-0 group-hover:opacity-100 text-brand-400"><Icon name="Plus" size={14}/></span>}
                                </div>
                                <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto hide-scroll">
                                    {dayEvents.map((ev, i) => (
                                        <div key={i} className={`text-[9px] md:text-[10px] px-1 md:px-2 py-0.5 md:py-1 rounded-md font-bold truncate border-l-2 border-transparent ${ev.color}`}>
                                            <span className="hidden md:inline font-normal opacity-75 mr-1">{ev.time}</span>{ev.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
            
            {/* Modal Creación Rápida */}
            {createModal && (
                <Modal isOpen={!!createModal} onClose={()=>setCreateModal(null)} title={`Agendar: ${window.Utils.formatDate(createModal.date)}`}>
                    <div className="space-y-4">
                        <Select label="Ministerio" value={newEvent.type} onChange={e=>setNewEvent({...newEvent, type:e.target.value})}>{createModal.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                        <Input label="Título" value={newEvent.title} onChange={e=>setNewEvent({...newEvent, title:e.target.value})} placeholder="Ej. Reunión Especial" />
                        <Input type="time" label="Hora" value={newEvent.time} onChange={e=>setNewEvent({...newEvent, time:e.target.value})} />
                        <Button className="w-full" onClick={handleCreate}>Guardar Evento</Button>
                    </div>
                </Modal>
            )}

            {/* Modal Detalle Global */}
            {selectedEventDate && (
                <EventDetails isOpen={!!selectedEventDate} onClose={()=>setSelectedEventDate(null)} dateStr={selectedEventDate} worship={worship} servers={servers} ebd={ebd} youth={youth} />
            )}
        </div>
    );
};
