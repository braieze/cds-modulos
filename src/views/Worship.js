window.Views = window.Views || {};

window.Views.Worship = ({ worship, songs, members, addData, updateData, deleteData }) => {
    const { useState, useMemo, useEffect, useRef } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Icon, Modal, Input, Select, DateFilter, formatDate, formatTime, SmartSelect } = Utils;

    const [activeTab, setActiveTab] = useState('events'); // 'events' | 'songs' | 'rehearsal'
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // --- ESTADOS DE GESTIÓN ---
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [eventForm, setEventForm] = useState({ 
        date: window.Utils.getLocalDate(), time: '10:00', theme: '', type: 'Culto', team: {}, songList: [] // songList ahora guardará objetos {title, id, key}
    });

    // --- ESTADOS CANCIONERO ---
    const [isSongModalOpen, setIsSongModalOpen] = useState(false);
    const [songForm, setSongForm] = useState({ title: '', artist: '', bpm: '', key: 'C', youtubeUrl: '', content: '' });
    const [songSearch, setSongSearch] = useState('');

    // --- ESTADOS MODO ENSAYO ---
    const [rehearsalEvent, setRehearsalEvent] = useState(null);
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const [transposeMap, setTransposeMap] = useState({}); // { songId: semitones }

    // --- LOGICA MUSICAL (TRANSPOSICIÓN) ---
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const NOTES_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

    const getNoteIndex = (note) => {
        let n = note.toUpperCase();
        if(n.includes('B')) n = n.replace('B', 'b'); // Normalizar flats
        let idx = NOTES.indexOf(n);
        if (idx === -1) idx = NOTES_FLAT.indexOf(n);
        return idx;
    };

    const transposeChord = (chord, semitones) => {
        // Regex simple para encontrar la nota base (Ej: C, C#, Bb)
        const match = chord.match(/^([A-G][#b]?)(.*)$/);
        if (!match) return chord;
        
        const [_, root, suffix] = match;
        const idx = getNoteIndex(root);
        if (idx === -1) return chord;

        let newIdx = (idx + semitones) % 12;
        if (newIdx < 0) newIdx += 12;

        return NOTES[newIdx] + suffix;
    };

    const transposeContent = (text, semitones) => {
        if (semitones === 0) return text;
        // Regex para identificar acordes (Simplificado pero efectivo para cifrado americano)
        // Busca letras A-G seguidas opcionalmente de #/b y sufijos comunes, rodeadas de espacios o al inicio/fin de línea
        return text.replace(/\b[A-G][#b]?(?:m|maj|dim|aug|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:\/[A-G][#b]?)?\b/g, (match) => {
            if (match.includes('/')) {
                const parts = match.split('/');
                return transposeChord(parts[0], semitones) + '/' + transposeChord(parts[1], semitones);
            }
            return transposeChord(match, semitones);
        });
    };

    // --- FILTROS ---
    const monthlyEvents = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return worship.filter(w => w.date && w.date.startsWith(monthStr)).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [worship, currentDate]);

    const filteredSongs = useMemo(() => {
        return songs.filter(s => s.title.toLowerCase().includes(songSearch.toLowerCase()) || s.content?.toLowerCase().includes(songSearch.toLowerCase()));
    }, [songs, songSearch]);

    const musicians = members.filter(m => ['Alabanza','Pastor','Líder'].includes(m.ministry) || ['Pastor','Líder'].includes(m.role));
    const musicianOptions = musicians.map(m => ({ value: m.name, label: m.name }));
    const defaultInstruments = ['Vocal', 'Guitarra', 'Bajo', 'Batería', 'Teclado', 'Acústica'];

    // --- HANDLERS ---
    const openEventModal = (ev = null) => {
        setEditingEvent(ev);
        if (ev) {
            // Migración segura: si songList son strings, convertirlos a objetos
            const safeSongs = (ev.songList || []).map(s => typeof s === 'string' ? { title: s, id: null } : s);
            setEventForm({ ...ev, songList: safeSongs });
        } else {
            setEventForm({ ...initialEvent, date: window.Utils.getLocalDate() });
        }
        setIsEventModalOpen(true);
    };

    const handleTeamAssign = (inst, name) => {
        if (!name) return;
        const currentList = Array.isArray(eventForm.team[inst]) ? eventForm.team[inst] : [];
        if (!currentList.includes(name)) {
            setEventForm(p => ({ ...p, team: { ...p.team, [inst]: [...currentList, name] } }));
        }
    };

    const removeTeamMember = (inst, name) => {
        const currentList = Array.isArray(eventForm.team[inst]) ? eventForm.team[inst] : [];
        setEventForm(p => ({ ...p, team: { ...p.team, [inst]: currentList.filter(n => n !== name) } }));
    };

    const addSongToSetlist = (songId) => {
        const song = songs.find(s => s.id === songId);
        if (song) {
            setEventForm(p => ({
                ...p, 
                songList: [...p.songList, { title: song.title, id: song.id, key: song.key }]
            }));
        }
    };

    const removeSongFromSetlist = (idx) => {
        setEventForm(p => ({ ...p, songList: p.songList.filter((_, i) => i !== idx) }));
    };

    const handleSaveEvent = () => {
        if(!eventForm.date) return Utils.notify("Falta fecha", "error");
        editingEvent ? updateData('worship', editingEvent.id, eventForm) : addData('worship', eventForm);
        setIsEventModalOpen(false);
        Utils.notify("Setlist guardado");
    };

    const handleSaveSong = () => {
        if(!songForm.title) return Utils.notify("Título requerido", "error");
        addData('songs', songForm);
        setIsSongModalOpen(false);
        setSongForm({ title: '', artist: '', bpm: '', key: 'C', youtubeUrl: '', content: '' });
        Utils.notify("Canción guardada");
    };

    const notifyTeam = () => {
        // Simulación: En un futuro esto enviaría mensajes por WhatsApp o Notificaciones
        Utils.notify("🔔 Notificación enviada al equipo de Alabanza");
    };

    // --- COMPONENTE: MODO ENSAYO ---
    if (activeTab === 'rehearsal' && rehearsalEvent) {
        const currentSongData = rehearsalEvent.songList[currentSongIndex] || {};
        // Buscar la canción completa en la base de datos para obtener letra y video
        const fullSong = songs.find(s => s.id === currentSongData.id || s.title === currentSongData.title) || {};
        
        // Calcular transposición
        const semitones = transposeMap[fullSong.id] || 0;
        const displayKey = transposeChord(fullSong.key || 'C', semitones);
        const displayContent = transposeContent(fullSong.content || 'Sin letra disponible.', semitones);

        // Extraer ID de YouTube
        let videoId = null;
        if (fullSong.youtubeUrl) {
            const match = fullSong.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([^&?]*)/);
            if (match) videoId = match[1];
        }

        return (
            <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col md:flex-row text-white animate-enter">
                {/* SIDEBAR: SETLIST */}
                <div className="w-full md:w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg">{rehearsalEvent.type}</h3>
                            <p className="text-xs text-slate-400">{formatDate(rehearsalEvent.date)}</p>
                        </div>
                        <button onClick={()=>setActiveTab('events')} className="text-slate-400 hover:text-white"><Icon name="X" size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {rehearsalEvent.songList.map((s, i) => (
                            <button 
                                key={i} 
                                onClick={()=>setCurrentSongIndex(i)}
                                className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-colors ${i === currentSongIndex ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-slate-700 text-slate-300'}`}
                            >
                                <span className="font-bold text-sm truncate">{i+1}. {s.title}</span>
                                <span className="text-xs font-mono opacity-70">{s.key}</span>
                            </button>
                        ))}
                    </div>
                    <div className="p-4 bg-slate-900 border-t border-slate-700">
                        <div className="text-xs text-slate-400 mb-2 font-bold uppercase">Equipo</div>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(rehearsalEvent.team || {}).map(([inst, names]) => (
                                <span key={inst} className="bg-slate-800 px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-700">
                                    <strong className="text-brand-400">{inst}:</strong> {Array.isArray(names) ? names[0] : names}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MAIN: VISOR DE CANCIÓN */}
                <div className="flex-1 flex flex-col h-full relative">
                    {/* Header Canción */}
                    <div className="h-16 bg-slate-800 border-b border-slate-700 flex justify-between items-center px-6 shadow-md z-10">
                        <div>
                            <h2 className="text-xl font-extrabold">{fullSong.title || currentSongData.title}</h2>
                            <p className="text-xs text-slate-400">{fullSong.artist} • {fullSong.bpm ? `${fullSong.bpm} BPM` : ''}</p>
                        </div>
                        
                        {/* Controles Transposición */}
                        <div className="flex items-center gap-4 bg-slate-900 px-4 py-1.5 rounded-full border border-slate-600">
                            <span className="text-xs font-bold text-slate-400 uppercase">Tono:</span>
                            <div className="flex items-center gap-3">
                                <button onClick={()=>setTransposeMap(p => ({...p, [fullSong.id]: semitones - 1}))} className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center font-bold text-lg">-</button>
                                <span className="font-mono font-bold text-brand-400 w-6 text-center">{displayKey}</span>
                                <button onClick={()=>setTransposeMap(p => ({...p, [fullSong.id]: semitones + 1}))} className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center font-bold text-lg">+</button>
                            </div>
                        </div>
                    </div>

                    {/* Contenido Split: Video / Letra */}
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#0f172a]">
                        {/* Video (Solo si hay ID) */}
                        {videoId && (
                            <div className="w-full md:w-1/3 bg-black flex items-center justify-center relative border-r border-slate-800">
                                <iframe 
                                    className="w-full aspect-video md:h-full md:aspect-auto" 
                                    src={`https://www.youtube.com/embed/${videoId}?rel=0`} 
                                    title="YouTube video" 
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen
                                ></iframe>
                            </div>
                        )}

                        {/* Visor de Acordes */}
                        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
                            <pre className="whitespace-pre-wrap font-mono text-base md:text-lg leading-relaxed text-slate-300">
                                {displayContent.split('\n').map((line, i) => {
                                    // Resaltar acordes (Líneas con muchas mayúsculas y espacios)
                                    const isChordLine = /^[A-G#bmsusdim0-9/\s]+$/.test(line) && line.trim().length > 0;
                                    return (
                                        <div key={i} className={isChordLine ? "text-brand-400 font-bold mb-1 mt-4" : "mb-0.5"}>
                                            {line}
                                        </div>
                                    );
                                })}
                            </pre>
                            {/* Botones Flotantes Navegación */}
                            <div className="fixed bottom-8 right-8 flex gap-3">
                                <button disabled={currentSongIndex===0} onClick={()=>setCurrentSongIndex(c=>c-1)} className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-lg disabled:opacity-50"><Icon name="ChevronLeft"/></button>
                                <button disabled={currentSongIndex===rehearsalEvent.songList.length-1} onClick={()=>setCurrentSongIndex(c=>c+1)} className="p-3 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-lg disabled:opacity-50"><Icon name="ChevronRight"/></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA PRINCIPAL ---
    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Ministerio de Alabanza</h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='events'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Agenda</button>
                    <button onClick={()=>setActiveTab('songs')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='songs'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Cancionero</button>
                </div>
            </div>

            {activeTab === 'events' && (
                <>
                    <div className="flex justify-between items-end mb-4">
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                        <Button icon="Plus" onClick={()=>openEventModal()}>Planificar Culto</Button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {monthlyEvents.map(w => (
                            <Card key={w.id} className="group relative border-l-4 border-l-brand-500">
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button onClick={()=>openEventModal(w)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Icon name="Edit" size={16}/></button>
                                    <button onClick={()=>deleteData('worship', w.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Icon name="Trash" size={16}/></button>
                                </div>
                                
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Info Principal */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Badge type="brand">{w.type}</Badge>
                                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">{formatDate(w.date)} • {formatTime(w.time)}</span>
                                        </div>
                                        <h3 className="font-extrabold text-2xl text-slate-900 mb-4">{w.theme || 'Servicio General'}</h3>
                                        
                                        {/* Equipo */}
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {Object.entries(w.team || {}).map(([inst, name]) => (
                                                name && name.length > 0 && (
                                                    <div key={inst} className="text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-md flex items-center gap-1">
                                                        <span className="font-bold text-slate-500">{inst}:</span> 
                                                        <span className="font-medium text-slate-800">{Array.isArray(name) ? name.join(', ') : name}</span>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>

                                    {/* Setlist */}
                                    <div className="w-full md:w-1/3 bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">SETLIST</h4>
                                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">{w.songList?.length || 0}</span>
                                        </div>
                                        <div className="flex-1 space-y-2 mb-4">
                                            {(w.songList || []).map((s, i) => (
                                                <div key={i} className="flex items-center gap-2 text-sm">
                                                    <span className="text-slate-400 font-mono text-xs w-4">{i+1}</span>
                                                    <span className="font-medium text-slate-700 truncate">{typeof s === 'string' ? s : s.title}</span>
                                                    {s.key && <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1 rounded ml-auto">{s.key}</span>}
                                                </div>
                                            ))}
                                            {(!w.songList || w.songList.length === 0) && <p className="text-xs text-slate-400 italic">Sin canciones asignadas.</p>}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2 mt-auto">
                                            <button onClick={()=>notifyTeam()} className="py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-white transition-colors flex justify-center items-center gap-1">
                                                <Icon name="Bell" size={12}/> Notificar
                                            </button>
                                            <button onClick={()=>{setRehearsalEvent(w); setCurrentSongIndex(0); setActiveTab('rehearsal');}} className="py-2 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors flex justify-center items-center gap-1 shadow-lg">
                                                <Icon name="Play" size={12}/> Modo Ensayo
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* PESTAÑA CANCIONERO */}
            {activeTab === 'songs' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div className="relative w-full max-w-md">
                            <Icon name="Search" className="absolute left-3 top-3 text-slate-400" size={18}/>
                            <input className="input-modern pl-10" placeholder="Buscar por título, letra o artista..." value={songSearch} onChange={e=>setSongSearch(e.target.value)} />
                        </div>
                        <Button icon="Plus" onClick={()=>setIsSongModalOpen(true)}>Nueva Canción</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSongs.map(s => (
                            <Card key={s.id} className="relative group hover:border-brand-300">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>deleteData('songs',s.id)} className="p-1 text-slate-300 hover:text-red-500"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg text-slate-800 line-clamp-1">{s.title}</h4>
                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded border border-slate-200">{s.key || 'C'}</span>
                                </div>
                                <p className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-wide">{s.artist || 'Desconocido'} {s.bpm && `• ${s.bpm} BPM`}</p>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 h-24 overflow-hidden relative">
                                    <p className="text-[10px] text-slate-600 font-mono whitespace-pre-wrap leading-tight">{s.content}</p>
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none"></div>
                                </div>
                                {s.youtubeUrl && (
                                    <a href={s.youtubeUrl} target="_blank" className="mt-3 text-xs text-red-600 font-bold flex items-center gap-1 hover:underline">
                                        <Icon name="Play" size={12}/> Ver en YouTube
                                    </a>
                                )}
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* MODAL PLANIFICAR EVENTO */}
            <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title="Planificar Culto">
                <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                    {/* Datos Básicos */}
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Tipo" value={eventForm.type} onChange={e=>setEventForm({...eventForm, type:e.target.value})}><option>Culto</option><option>Ensayo</option><option>Especial</option></Select>
                        <Input type="time" label="Hora" value={eventForm.time} onChange={e=>setEventForm({...eventForm, time:e.target.value})}/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="date" label="Fecha" value={eventForm.date} onChange={e=>setEventForm({...eventForm, date:e.target.value})}/>
                        <Input label="Tema / Título" value={eventForm.theme} onChange={e=>setEventForm({...eventForm, theme:e.target.value})}/>
                    </div>

                    {/* Selector de Canciones */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                            <label className="label-modern">Setlist ({eventForm.songList.length})</label>
                            <SmartSelect 
                                options={songs.map(s => ({ value: s.id, label: `${s.title} (${s.key})` }))} 
                                onChange={addSongToSetlist} 
                                placeholder="+ Agregar canción..." 
                            />
                        </div>
                        <div className="space-y-2">
                            {eventForm.songList.map((s, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">{idx+1}</span>
                                        <span className="text-sm font-medium">{typeof s === 'string' ? s : s.title}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {s.key && <span className="text-xs font-bold text-slate-400">{s.key}</span>}
                                        <button onClick={()=>removeSongFromSetlist(idx)} className="text-slate-300 hover:text-red-500"><Icon name="X" size={14}/></button>
                                    </div>
                                </div>
                            ))}
                            {eventForm.songList.length === 0 && <p className="text-center text-xs text-slate-400 italic py-2">No hay canciones seleccionadas.</p>}
                        </div>
                    </div>

                    {/* Asignación de Equipo */}
                    <div>
                        <label className="label-modern mb-2">Asignación de Equipo</label>
                        <div className="space-y-3">
                            {defaultInstruments.map(inst => (
                                <div key={inst} className="bg-white p-2 rounded border border-slate-100">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase">{inst}</span>
                                        <div className="flex flex-wrap gap-1">
                                            {(Array.isArray(eventForm.team[inst]) ? eventForm.team[inst] : (eventForm.team[inst]?[eventForm.team[inst]]:[])).map(n => (
                                                <span key={n} className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded flex items-center gap-1 border border-brand-100">
                                                    {n} <button onClick={()=>removeTeamMember(inst, n)} className="hover:text-red-500"><Icon name="X" size={10}/></button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <SmartSelect options={musicianOptions} onChange={v=>handleTeamAssign(inst, v)} placeholder="Asignar..." />
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button className="w-full" onClick={handleSaveEvent}>Guardar Planificación</Button>
                </div>
            </Modal>

            {/* MODAL NUEVA CANCIÓN */}
            <Modal isOpen={isSongModalOpen} onClose={()=>setIsSongModalOpen(false)} title="Nueva Canción">
                <div className="space-y-4">
                    <Input label="Título" value={songForm.title} onChange={e=>setSongForm({...songForm, title:e.target.value})}/>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2"><Input label="Artista" value={songForm.artist} onChange={e=>setSongForm({...songForm, artist:e.target.value})}/></div>
                        <Input label="Tono (Ej: G, Am)" value={songForm.key} onChange={e=>setSongForm({...songForm, key:e.target.value})} placeholder="C" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="BPM (Tempo)" type="number" value={songForm.bpm} onChange={e=>setSongForm({...songForm, bpm:e.target.value})} placeholder="Ej: 72" />
                        <Input label="Link YouTube" value={songForm.youtubeUrl} onChange={e=>setSongForm({...songForm, youtubeUrl:e.target.value})} placeholder="https://..." />
                    </div>
                    <div>
                        <label className="label-modern mb-1">Letra y Acordes</label>
                        <p className="text-[10px] text-slate-400 mb-1">Pega aquí la letra. Los acordes se detectarán automáticamente para la transposición.</p>
                        <textarea 
                            className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none text-sm font-mono leading-relaxed resize-none" 
                            placeholder="Ej:
[G]          [D]
Tu fidelidad es grande
[Em]         [C]
Tu fidelidad incomparable..." 
                            value={songForm.content} 
                            onChange={e=>setSongForm({...songForm, content:e.target.value})}
                        ></textarea>
                    </div>
                    <Button className="w-full" onClick={handleSaveSong}>Guardar Canción</Button>
                </div>
            </Modal>
        </div>
    );
};
