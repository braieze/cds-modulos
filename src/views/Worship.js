// src/views/Worship.js
window.Views = window.Views || {};

window.Views.Worship = ({ worship, songs, members, addData, updateData, deleteData }) => {
    const { useState, useMemo } = React;
    const { Card, Button, Badge, Icon, Modal, Input, Select, MonthNav, formatDate, formatTime } = window.Utils;

    const [activeTab, setActiveTab] = useState('events'); // events | songs
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Estados Evento
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const initialEvent = { date: '', time: '', theme: '', type: 'Culto', team: {}, songList: [] };
    const [eventForm, setEventForm] = useState(initialEvent);
    
    // Estados Canción
    const [isSongModalOpen, setIsSongModalOpen] = useState(false);
    const initialSong = { title: '', artist: '', lyrics: '', order: '' };
    const [songForm, setSongForm] = useState(initialSong);
    const [songSearch, setSongSearch] = useState('');

    // Datos Filtrados
    const monthlyEvents = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return worship.filter(w => w.date && w.date.startsWith(monthStr)).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [worship, currentDate]);

    const musicians = members.filter(m => m.ministry === 'Alabanza' || m.role === 'Pastor');
    const instruments = ['Vocal', 'Guitarra A.', 'Guitarra E.', 'Bajo', 'Batería', 'Teclado'];

    // Lógica Eventos
    const openEventModal = (ev = null) => {
        setEditingEvent(ev);
        setEventForm(ev || { ...initialEvent, date: new Date().toISOString().split('T')[0] });
        setIsEventModalOpen(true);
    };

    const toggleMusician = (inst, name) => {
        const current = eventForm.team[inst] || [];
        const updated = current.includes(name) ? current.filter(n => n !== name) : [...current, name];
        setEventForm({ ...eventForm, team: { ...eventForm.team, [inst]: updated } });
    };

    const handleSaveEvent = () => {
        if(!eventForm.date || !eventForm.type) return alert("Faltan datos básicos");
        if(editingEvent) updateData('worship', editingEvent.id, eventForm);
        else addData('worship', eventForm);
        setIsEventModalOpen(false);
    };

    // Lógica Canciones
    const handleSaveSong = () => {
        if(!songForm.title) return alert("El título es obligatorio");
        addData('songs', songForm);
        setSongForm(initialSong);
        setIsSongModalOpen(false);
    };

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Ministerio de Alabanza</h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='events'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Calendario</button>
                    <button onClick={()=>setActiveTab('songs')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='songs'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Canciones</button>
                </div>
            </div>

            {activeTab === 'events' && (
                <>
                    <MonthNav currentDate={currentDate} onMonthChange={setCurrentDate} />
                    <div className="flex justify-end mb-4"><Button icon="Plus" onClick={()=>openEventModal()}>Planificar</Button></div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {monthlyEvents.length === 0 && <div className="col-span-full text-center py-10 text-slate-400 italic">No hay ensayos ni cultos este mes.</div>}
                        
                        {monthlyEvents.map(w => (
                            <Card key={w.id} className="relative group hover:border-brand-300">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>openEventModal(w)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Icon name="Edit" size={16}/></button>
                                    <button onClick={()=>deleteData('worship', w.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex items-center gap-3 mb-3">
                                    <Badge type={w.type === 'Ensayo' ? 'default' : 'brand'}>{w.type}</Badge>
                                    <span className="text-sm font-bold text-slate-500">{formatDate(w.date)} • {formatTime(w.time)}</span>
                                </div>
                                <h3 className="font-bold text-xl text-slate-800 mb-3">{w.theme || 'Sin Tema'}</h3>
                                
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Setlist</p>
                                    {w.songList && w.songList.length > 0 ? (
                                        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                                            {w.songList.map((s,i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    ) : <span className="text-xs text-slate-400 italic">No hay canciones asignadas.</span>}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(w.team || {}).map(([inst, ppl]) => ppl.length > 0 && (
                                        <div key={inst} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                            <span className="font-bold text-slate-500">{inst}:</span> <span className="text-slate-700">{ppl.join(', ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title="Planificar Alabanza">
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Tipo" value={eventForm.type} onChange={e=>setEventForm({...eventForm, type:e.target.value})}>
                                    <option>Culto</option><option>Ensayo</option><option>Especial</option>
                                </Select>
                                <Input type="time" label="Hora" value={eventForm.time} onChange={e=>setEventForm({...eventForm, time:e.target.value})}/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input type="date" label="Fecha" value={eventForm.date} onChange={e=>setEventForm({...eventForm, date:e.target.value})}/>
                                <Input label="Tema Principal" value={eventForm.theme} onChange={e=>setEventForm({...eventForm, theme:e.target.value})}/>
                            </div>

                            {/* Selector de Canciones */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="block text-xs font-bold text-slate-900 uppercase mb-2">Canciones</label>
                                <Select onChange={(e)=>{
                                    if(e.target.value && !eventForm.songList.includes(e.target.value)) 
                                        setEventForm({...eventForm, songList: [...eventForm.songList, e.target.value]})
                                }}>
                                    <option value="">+ Agregar canción...</option>
                                    {songs.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                                </Select>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {eventForm.songList.map((s,i) => (
                                        <span key={i} className="bg-white border px-2 py-1 rounded text-sm flex items-center gap-2 shadow-sm">
                                            {s} <button onClick={()=>setEventForm({...eventForm, songList: eventForm.songList.filter(x=>x!==s)})} className="text-red-500 hover:bg-red-50 rounded-full w-4 h-4 flex items-center justify-center font-bold">×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Equipo */}
                            <div>
                                <label className="block text-xs font-bold text-slate-900 uppercase mb-2">Equipo</label>
                                <div className="space-y-3">
                                    {instruments.map(inst => (
                                        <div key={inst} className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold w-20 text-slate-500">{inst}</span>
                                            {musicians.map(m => (
                                                <button key={m.id} onClick={()=>toggleMusician(inst, m.name)} 
                                                    className={`text-xs px-3 py-1 border rounded-full transition-all ${(eventForm.team[inst]||[]).includes(m.name) ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4"><Button className="w-full" onClick={handleSaveEvent}>Guardar Evento</Button></div>
                        </div>
                    </Modal>
                </>
            )}

            {activeTab === 'songs' && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <Input placeholder="Buscar canción..." value={songSearch} onChange={e=>setSongSearch(e.target.value)} className="w-full md:max-w-xs" />
                        <Button icon="Plus" onClick={()=>setIsSongModalOpen(true)}>Nueva</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {songs.filter(s => s.title.toLowerCase().includes(songSearch.toLowerCase())).map(s => (
                            <Card key={s.id} className="relative group">
                                <button onClick={()=>deleteData('songs',s.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="Trash" size={16}/></button>
                                <h4 className="font-bold text-slate-900">{s.title}</h4>
                                <p className="text-xs text-slate-500 mb-2">{s.artist}</p>
                                {s.lyrics && <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-600 line-clamp-3 whitespace-pre-wrap font-mono">{s.lyrics}</div>}
                            </Card>
                        ))}
                    </div>
                    <Modal isOpen={isSongModalOpen} onClose={()=>setIsSongModalOpen(false)} title="Agregar Canción">
                        <div className="space-y-4">
                            <Input label="Título" value={songForm.title} onChange={e=>setSongForm({...songForm, title:e.target.value})} />
                            <Input label="Artista / Tono" value={songForm.artist} onChange={e=>setSongForm({...songForm, artist:e.target.value})} />
                            <div>
                                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">Letra</label>
                                <textarea className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-input h-32" 
                                    value={songForm.lyrics} onChange={e=>setSongForm({...songForm, lyrics:e.target.value})} placeholder="Pegar letra aquí..."></textarea>
                            </div>
                            <Button className="w-full" onClick={handleSaveSong}>Guardar en Biblioteca</Button>
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
};
