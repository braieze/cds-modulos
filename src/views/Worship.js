// src/views/Worship.js
window.Views = window.Views || {};

window.Views.Worship = ({ worship, songs, members, addData, updateData, deleteData }) => {
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Icon, Modal, Input, Select, DateFilter, formatDate, formatTime, SmartSelect } = Utils;

    const [activeTab, setActiveTab] = useState('events');
    const [currentDate, setCurrentDate] = useState(new Date());
    
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const initialEvent = { date: window.Utils.getLocalDate(), time: '', theme: '', type: 'Culto', team: {}, songList: [] };
    const [eventForm, setEventForm] = useState(initialEvent);
    const [customInst, setCustomInst] = useState("");
    const [tempSong, setTempSong] = useState(""); // Estado temporal para selector de canción

    // CANCIONES
    const [isSongModalOpen, setIsSongModalOpen] = useState(false);
    const [songForm, setSongForm] = useState({ title: '', artist: '', lyrics: '', key: '' });
    const [songSearch, setSongSearch] = useState('');

    const monthlyEvents = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return worship.filter(w => w.date && w.date.startsWith(monthStr)).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [worship, currentDate]);

    const musicians = members.filter(m => m.ministry === 'Alabanza' || m.role === 'Pastor' || m.role === 'Líder');
    const musicianOptions = musicians.map(m => ({ value: m.name, label: m.name }));
    const songOptions = songs.map(s => ({ value: s.title, label: s.title }));
    const defaultInstruments = ['Vocal', 'Guitarra A.', 'Guitarra E.', 'Bajo', 'Batería', 'Teclado'];

    const openEventModal = (ev = null) => {
        setEditingEvent(ev);
        // Si team viene como string antiguo, convertirlo a array si es necesario, o mantenerlo
        setEventForm(ev || { ...initialEvent, date: window.Utils.getLocalDate() });
        setIsEventModalOpen(true);
    };

    // MULTI-SELECCIÓN: Ahora team[inst] es un ARRAY
    const handleTeamAssign = (inst, name) => {
        if (!name) return;
        const currentList = Array.isArray(eventForm.team[inst]) ? eventForm.team[inst] : (eventForm.team[inst] ? [eventForm.team[inst]] : []);
        if (!currentList.includes(name)) {
            setEventForm(p => ({ ...p, team: { ...p.team, [inst]: [...currentList, name] } }));
        }
    };
    
    const removeTeamMember = (inst, name) => {
        const currentList = Array.isArray(eventForm.team[inst]) ? eventForm.team[inst] : [];
        setEventForm(p => ({ ...p, team: { ...p.team, [inst]: currentList.filter(n => n !== name) } }));
    };

    const addSong = (val) => {
        if(val && !eventForm.songList.includes(val)) {
            setEventForm(p=>({...p, songList: [...p.songList, val]}));
            setTempSong(""); // Limpiar selector
        }
    };

    const handleSaveEvent = () => {
        if(!eventForm.date) return Utils.notify("Falta fecha", "error");
        editingEvent ? updateData('worship', editingEvent.id, eventForm) : addData('worship', eventForm);
        setIsEventModalOpen(false);
        Utils.notify("Evento guardado");
    };

    const handleSaveSong = () => {
        if(!songForm.title) return Utils.notify("Título requerido", "error");
        addData('songs', songForm);
        setIsSongModalOpen(false);
        setSongForm({ title: '', artist: '', lyrics: '', key: '' });
        Utils.notify("Canción agregada");
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Alabanza</h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='events'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Calendario</button>
                    <button onClick={()=>setActiveTab('songs')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='songs'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Canciones</button>
                </div>
            </div>

            {activeTab === 'events' && (
                <>
                    <div className="flex justify-between items-end mb-4"><DateFilter currentDate={currentDate} onChange={setCurrentDate} /><Button icon="Plus" onClick={()=>openEventModal()}>Planificar</Button></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {monthlyEvents.map(w => (
                            <Card key={w.id} className="relative group hover:border-brand-300">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>deleteData('worship', w.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex items-center gap-3 mb-3"><Badge type={w.type === 'Ensayo' ? 'default' : 'brand'}>{w.type}</Badge><span className="text-sm font-bold text-slate-500">{formatDate(w.date)} • {formatTime(w.time)}</span></div>
                                <h3 className="font-bold text-xl text-slate-900 mb-3">{w.theme || 'Sin Tema'}</h3>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Setlist</p><div className="flex flex-wrap gap-2">{(w.songList||[]).map((s,i) => <Badge key={i} type="white">{s}</Badge>)}</div></div>
                                <div className="flex flex-wrap gap-2">{Object.entries(w.team || {}).map(([inst, name]) => name && name.length > 0 && (<div key={inst} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-md"><span className="font-bold text-slate-500">{inst}:</span> {Array.isArray(name) ? name.join(', ') : name}</div>))}</div>
                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end"><button onClick={()=>openEventModal(w)} className="text-xs font-bold text-brand-600 hover:underline">Editar</button></div>
                            </Card>
                        ))}
                    </div>

                    <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title="Planificar Alabanza">
                        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-4"><Select label="Tipo" value={eventForm.type} onChange={e=>setEventForm({...eventForm, type:e.target.value})}><option>Culto</option><option>Ensayo</option><option>Especial</option></Select><Input type="time" label="Hora" value={eventForm.time} onChange={e=>setEventForm({...eventForm, time:e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4"><Input type="date" label="Fecha" value={eventForm.date} onChange={e=>setEventForm({...eventForm, date:e.target.value})}/><Input label="Tema" value={eventForm.theme} onChange={e=>setEventForm({...eventForm, theme:e.target.value})}/></div>

                            {/* Setlist */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="label-modern mb-2">Canciones</label>
                                <div className="flex flex-wrap gap-2 mb-2">{(eventForm.songList||[]).map(s => (<span key={s} className="bg-white border px-2 py-1 rounded text-sm flex items-center gap-1 shadow-sm">{s} <button onClick={()=>setEventForm(p=>({...p, songList: p.songList.filter(x=>x!==s)}))} className="text-red-500 hover:bg-red-50 rounded-full"><Icon name="X" size={12}/></button></span>))}</div>
                                <SmartSelect options={songOptions} value={tempSong} onChange={addSong} placeholder="+ Agregar canción..." />
                            </div>

                            {/* Equipo Multi-Select */}
                            <div>
                                <label className="label-modern mb-2">Equipo</label>
                                <div className="space-y-3">
                                    {defaultInstruments.map(inst => (
                                        <div key={inst} className="bg-white p-2 rounded border border-slate-100">
                                            <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-slate-500 uppercase">{inst}</span></div>
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {(Array.isArray(eventForm.team[inst]) ? eventForm.team[inst] : (eventForm.team[inst]?[eventForm.team[inst]]:[])).map(n => (
                                                    <span key={n} className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded flex items-center gap-1">{n} <button onClick={()=>removeTeamMember(inst, n)}><Icon name="X" size={10}/></button></span>
                                                ))}
                                            </div>
                                            <SmartSelect options={musicianOptions} onChange={v=>handleTeamAssign(inst, v)} placeholder="Agregar..." />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Button className="w-full" onClick={handleSaveEvent}>Guardar</Button>
                        </div>
                    </Modal>
                </>
            )}

            {activeTab === 'songs' && (<><div className="flex justify-between mb-4"><Input placeholder="Buscar..." value={songSearch} onChange={e=>setSongSearch(e.target.value)} className="w-full max-w-xs" /><Button icon="Plus" onClick={()=>setIsSongModalOpen(true)}>Nueva</Button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{songs.filter(s => s.title.toLowerCase().includes(songSearch.toLowerCase())).map(s => (<Card key={s.id} className="relative group"><button onClick={()=>deleteData('songs',s.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="Trash" size={16}/></button><h4 className="font-bold text-slate-900">{s.title}</h4><p className="text-xs text-slate-500 mb-2">{s.artist} {s.key && `(${s.key})`}</p>{s.lyrics && <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-600 line-clamp-3 font-mono leading-tight">{s.lyrics}</div>}</Card>))}</div><Modal isOpen={isSongModalOpen} onClose={()=>setIsSongModalOpen(false)} title="Nueva Canción"><div className="space-y-4"><Input label="Título" value={songForm.title} onChange={e=>setSongForm({...songForm, title:e.target.value})}/><div className="grid grid-cols-2 gap-4"><Input label="Artista" value={songForm.artist} onChange={e=>setSongForm({...songForm, artist:e.target.value})}/><Input label="Tono" value={songForm.key} onChange={e=>setSongForm({...songForm, key:e.target.value})} placeholder="Ej. G" /></div><textarea className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none text-sm font-mono" placeholder="Letra..." value={songForm.lyrics} onChange={e=>setSongForm({...songForm, lyrics:e.target.value})}></textarea><Button className="w-full" onClick={handleSaveSong}>Guardar</Button></div></Modal></>)}
        </div>
    );
};
