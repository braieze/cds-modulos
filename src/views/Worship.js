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
        date: window.Utils.getLocalDate(), time: '10:00', theme: '', type: 'Culto', team: {}, songList: [] 
    });

    // --- ESTADOS CANCIONERO ---
    const [isSongModalOpen, setIsSongModalOpen] = useState(false);
    const [songForm, setSongForm] = useState({ title: '', artist: '', bpm: '', key: 'C', youtubeUrl: '', content: '' });
    const [songSearch, setSongSearch] = useState('');

    // --- ESTADOS MODO ENSAYO ---
    const [rehearsalData, setRehearsalData] = useState(null); // { title:Str, songs:[], team:{} }
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const [transposeMap, setTransposeMap] = useState({}); 
    const [showSetlistMobile, setShowSetlistMobile] = useState(false); // Menú móvil

    // --- LÓGICA MUSICAL ---
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const NOTES_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

    const getNoteIndex = (note) => {
        let n = note.toUpperCase();
        if(n.includes('B')) n = n.replace('B', 'b'); 
        let idx = NOTES.indexOf(n);
        if (idx === -1) idx = NOTES_FLAT.indexOf(n);
        return idx;
    };

    const transposeChord = (chord, semitones) => {
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
        return text.replace(/\b[A-G][#b]?(?:m|maj|dim|aug|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:\/[A-G][#b]?)?\b/g, (match) => {
            if (match.includes('/')) {
                const parts = match.split('/');
                return transposeChord(parts[0], semitones) + '/' + transposeChord(parts[1], semitones);
            }
            return transposeChord(match, semitones);
        });
    };

    // --- FILTROS Y DATOS ---
    const monthlyEvents = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return worship.filter(w => w.date && w.date.startsWith(monthStr)).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [worship, currentDate]);

    const filteredSongs = useMemo(() => {
        return songs.filter(s => s.title.toLowerCase().includes(songSearch.toLowerCase()) || s.content?.toLowerCase().includes(songSearch.toLowerCase()));
    }, [songs, songSearch]);

    // Filtramos músicos (Cualquiera en ministerio alabanza o roles de liderazgo)
    const musicians = members.filter(m => ['Alabanza','Pastor','Líder'].includes(m.ministry) || ['Pastor','Líder'].includes(m.role));
    const musicianOptions = musicians.map(m => ({ value: m.name, label: m.name }));
    const defaultInstruments = ['Vocal', 'Guitarra', 'Bajo', 'Batería', 'Teclado', 'Acústica'];

    // --- HANDLERS EVENTOS ---
    const openEventModal = (ev = null) => {
        setEditingEvent(ev);
        if (ev) {
            // Normalizar songList para asegurar que sean objetos
            const safeSongs = (ev.songList || []).map(s => typeof s === 'string' ? { title: s, id: null, key: '', lead: '' } : s);
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

    // --- HANDLERS SETLIST (ORDEN Y VOCALISTA) ---
    const addSongToSetlist = (songId) => {
        const song = songs.find(s => s.id === songId);
        if (song) {
            setEventForm(p => ({
                ...p, 
                songList: [...p.songList, { title: song.title, id: song.id, key: song.key, lead: '' }]
            }));
        }
    };

    const removeSongFromSetlist = (idx) => {
        setEventForm(p => ({ ...p, songList: p.songList.filter((_, i) => i !== idx) }));
    };

    const moveSongOrder = (idx, direction) => {
        const newSongs = [...eventForm.songList];
        if (direction === 'up' && idx > 0) {
            [newSongs[idx], newSongs[idx - 1]] = [newSongs[idx - 1], newSongs[idx]];
        } else if (direction === 'down' && idx < newSongs.length - 1) {
            [newSongs[idx], newSongs[idx + 1]] = [newSongs[idx + 1], newSongs[idx]];
        }
        setEventForm(p => ({ ...p, songList: newSongs }));
    };

    const assignSongLead = (idx, leadName) => {
        const newSongs = [...eventForm.songList];
        newSongs[idx].lead = leadName;
        setEventForm(p => ({ ...p, songList: newSongs }));
    };

    const handleSaveEvent = () => {
        if(!eventForm.date) return Utils.notify("Falta fecha", "error");
        editingEvent ? updateData('worship', editingEvent.id, eventForm) : addData('worship', eventForm);
        setIsEventModalOpen(false);
        Utils.notify("Setlist guardado");
    };

    // --- HANDLERS CANCIONES ---
    const handleSaveSong = () => {
        if(!songForm.title) return Utils.notify("Título requerido", "error");
        addData('songs', songForm);
        setIsSongModalOpen(false);
        setSongForm({ title: '', artist: '', bpm: '', key: 'C', youtubeUrl: '', content: '' });
        Utils.notify("Canción guardada");
    };

    // Iniciar ensayo desde EVENTO
    const startRehearsalEvent = (ev) => {
        setRehearsalData({
            title: ev.theme || ev.type,
            date: ev.date,
            songs: ev.songList.map(s => {
                // Fusionar datos del setlist (lead) con datos de la base (video, letra)
                const dbSong = songs.find(dbS => dbS.id === s.id) || {};
                return { ...dbSong, ...s }; // Prioridad a datos del setlist (como key personalizada si la hubiera)
            }),
            team: ev.team
        });
        setCurrentSongIndex(0);
        setActiveTab('rehearsal');
    };

    // Iniciar ensayo desde UNA CANCIÓN (Cancionero)
    const startRehearsalSong = (song) => {
        setRehearsalData({
            title: "Ensayo Individual",
            date: new Date().toISOString(),
            songs: [song],
            team: {}
        });
        setCurrentSongIndex(0);
        setActiveTab('rehearsal');
    };

    // --- COMPONENTE: MODO ENSAYO (RESPONSIVE) ---
    if (activeTab === 'rehearsal' && rehearsalData) {
        const currentSong = rehearsalData.songs[currentSongIndex] || {};
        const semitones = transposeMap[currentSong.id] || 0;
        const displayKey = transposeChord(currentSong.key || 'C', semitones);
        const displayContent = transposeContent(currentSong.content || 'Letra no disponible.', semitones);

        let videoId = null;
        if (currentSong.youtubeUrl) {
            const match = currentSong.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([^&?]*)/);
            if (match) videoId = match[1];
        }

        return (
            <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col text-white animate-enter font-sans">
                
                {/* HEADER SUPERIOR */}
                <div className="h-14 bg-slate-800 border-b border-slate-700 flex justify-between items-center px-4 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button onClick={()=>setActiveTab(rehearsalData.songs.length > 1 ? 'events' : 'songs')} className="text-slate-400 hover:text-white"><Icon name="ChevronLeft" size={24}/></button>
                        <div className="min-w-0">
                            <h2 className="font-bold text-sm md:text-base truncate">{currentSong.title}</h2>
                            <p className="text-[10px] text-slate-400 truncate">{currentSong.artist} {currentSong.lead ? `• Voz: ${currentSong.lead}` : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Botón Setlist Móvil */}
                        {rehearsalData.songs.length > 1 && (
                            <button onClick={()=>setShowSetlistMobile(!showSetlistMobile)} className="md:hidden text-brand-400 relative">
                                <Icon name="List" size={24}/>
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">{currentSongIndex+1}/{rehearsalData.songs.length}</span>
                            </button>
                        )}
                        {/* Controles Transposición */}
                        <div className="flex items-center bg-slate-900 rounded-lg border border-slate-600 overflow-hidden">
                            <button onClick={()=>setTransposeMap(p => ({...p, [currentSong.id]: semitones - 1}))} className="px-3 py-1 hover:bg-slate-700 font-bold">-</button>
                            <span className="w-8 text-center text-sm font-mono font-bold text-brand-400">{displayKey}</span>
                            <button onClick={()=>setTransposeMap(p => ({...p, [currentSong.id]: semitones + 1}))} className="px-3 py-1 hover:bg-slate-700 font-bold">+</button>
                        </div>
                    </div>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    
                    {/* SIDEBAR SETLIST (Desktop: Fijo, Mobile: Overlay) */}
                    {(rehearsalData.songs.length > 1) && (
                        <div className={`
                            absolute inset-y-0 left-0 w-64 bg-slate-800 border-r border-slate-700 z-20 transition-transform duration-300 transform 
                            md:relative md:translate-x-0 
                            ${showSetlistMobile ? 'translate-x-0' : '-translate-x-full'}
                        `}>
                            <div className="flex flex-col h-full">
                                <div className="p-3 bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                                    <span>Setlist</span>
                                    <button onClick={()=>setShowSetlistMobile(false)} className="md:hidden"><Icon name="X" size={14}/></button>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {rehearsalData.songs.map((s, i) => (
                                        <button key={i} onClick={()=>{setCurrentSongIndex(i); setShowSetlistMobile(false);}} className={`w-full text-left p-3 border-b border-slate-700/50 flex justify-between items-center ${i===currentSongIndex ? 'bg-brand-900/30 text-brand-300 border-l-4 border-l-brand-500' : 'text-slate-400 hover:bg-slate-700'}`}>
                                            <span className="truncate text-sm">{i+1}. {s.title}</span>
                                            {s.lead && <span className="text-[9px] bg-slate-900 px-1 rounded ml-1 opacity-60">{s.lead.charAt(0)}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ÁREA DE TRABAJO (VIDEO + LETRA) */}
                    <div className="flex-1 flex flex-col md:flex-row bg-[#0f172a] overflow-hidden">
                        
                        {/* Video Player (Responsive: Arriba en móvil, Izquierda en PC) */}
                        {videoId && (
                            <div className="w-full md:w-1/3 bg-black shrink-0 aspect-video md:aspect-auto md:h-full border-b md:border-b-0 md:border-r border-slate-700 relative group">
                                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}?rel=0`} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                            </div>
                        )}

                        {/* Visor de Acordes */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 relative">
                            <div className="max-w-3xl mx-auto">
                                <h3 className="text-2xl font-bold mb-4 text-white md:hidden">{currentSong.title}</h3>
                                <pre className="whitespace-pre-wrap font-mono text-sm md:text-lg leading-relaxed text-slate-300">
                                    {displayContent.split('\n').map((line, i) => {
                                        // Detección mejorada de línea de acordes
                                        const isChordLine = /^[A-G#bmsusdim0-9/\s()]+$/.test(line) && line.trim().length > 0 && !line.includes('Intro') && !line.includes('Verso');
                                        const isHeader = line.includes('[') || line.includes('Intro') || line.includes('Coro') || line.includes('Verso');
                                        
                                        return (
                                            <div key={i} className={`
                                                ${isChordLine ? "text-brand-400 font-bold mt-4 text-base md:text-xl" : "mb-1"} 
                                                ${isHeader ? "text-yellow-500 font-bold uppercase text-xs mt-6 mb-2 tracking-widest border-b border-yellow-500/20 pb-1 inline-block" : ""}
                                            `}>
                                                {line}
                                            </div>
                                        );
                                    })}
                                </pre>
                                <div className="h-20"></div> {/* Espacio extra al final */}
                            </div>
                        </div>

                        {/* Navegación Flotante Móvil (Solo si hay setlist) */}
                        {rehearsalData.songs.length > 1 && (
                            <div className="absolute bottom-6 right-6 flex gap-3 md:hidden">
                                <button disabled={currentSongIndex===0} onClick={()=>setCurrentSongIndex(c=>c-1)} className="w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg flex items-center justify-center disabled:opacity-50"><Icon name="ChevronLeft"/></button>
                                <button disabled={currentSongIndex===rehearsalData.songs.length-1} onClick={()=>setCurrentSongIndex(c=>c+1)} className="w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center disabled:opacity-50"><Icon name="ChevronRight"/></button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA PRINCIPAL ---
    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Ministerio de Alabanza</h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='events'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Agenda</button>
                    <button onClick={()=>setActiveTab('songs')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='songs'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Cancionero</button>
                </div>
            </div>

            {/* TAB AGENDA (EVENTOS) */}
            {activeTab === 'events' && (
                <>
                    <div className="flex justify-between items-end mb-4">
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                        <Button icon="Plus" onClick={()=>openEventModal()}>Planificar Culto</Button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {monthlyEvents.length === 0 && <div className="text-center py-10 text-slate-400">No hay eventos programados.</div>}
                        {monthlyEvents.map(w => (
                            <Card key={w.id} className="group relative border-l-4 border-l-brand-500">
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button onClick={()=>openEventModal(w)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Icon name="Edit" size={16}/></button>
                                    <button onClick={()=>deleteData('worship', w.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Icon name="Trash" size={16}/></button>
                                </div>
                                
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Badge type="brand">{w.type}</Badge>
                                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">{formatDate(w.date)} • {formatTime(w.time)}</span>
                                        </div>
                                        <h3 className="font-extrabold text-2xl text-slate-900 mb-4">{w.theme || 'Servicio General'}</h3>
                                        
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {Object.entries(w.team || {}).map(([inst, name]) => name && name.length > 0 && (
                                                <div key={inst} className="text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-md flex items-center gap-1">
                                                    <span className="font-bold text-slate-500">{inst}:</span> 
                                                    <span className="font-medium text-slate-800">{Array.isArray(name) ? name.join(', ') : name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="w-full md:w-1/3 bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">SETLIST</h4>
                                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">{w.songList?.length || 0}</span>
                                        </div>
                                        <div className="flex-1 space-y-2 mb-4">
                                            {(w.songList || []).map((s, i) => (
                                                <div key={i} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-slate-100">
                                                    <span className="text-slate-400 font-mono text-xs w-4">{i+1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-bold text-slate-700 truncate block">{typeof s === 'string' ? s : s.title}</span>
                                                        {s.lead && <span className="text-[10px] text-brand-600 flex items-center gap-1"><Icon name="User" size={8}/> {s.lead}</span>}
                                                    </div>
                                                    {s.key && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1 rounded">{s.key}</span>}
                                                </div>
                                            ))}
                                            {(!w.songList || w.songList.length === 0) && <p className="text-xs text-slate-400 italic">Sin canciones asignadas.</p>}
                                        </div>
                                        <button onClick={()=>startRehearsalEvent(w)} className="w-full py-2.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors flex justify-center items-center gap-2 shadow-lg">
                                            <Icon name="Play" size={14}/> Iniciar Ensayo
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* TAB CANCIONERO */}
            {activeTab === 'songs' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div className="relative w-full max-w-md">
                            <Icon name="Search" className="absolute left-3 top-3 text-slate-400" size={18}/>
                            <input className="input-modern pl-10" placeholder="Buscar canción..." value={songSearch} onChange={e=>setSongSearch(e.target.value)} />
                        </div>
                        <Button icon="Plus" onClick={()=>setIsSongModalOpen(true)}>Nueva Canción</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSongs.map(s => (
                            <Card key={s.id} className="relative group hover:border-brand-300 flex flex-col">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white p-1 rounded-lg shadow-sm z-10">
                                    <button onClick={()=>deleteData('songs',s.id)} className="p-1 text-slate-400 hover:text-red-500"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg text-slate-900 line-clamp-1">{s.title}</h4>
                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded border border-slate-200">{s.key || 'C'}</span>
                                </div>
                                <p className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-wide">{s.artist || 'Desconocido'}</p>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 h-24 overflow-hidden relative mb-3">
                                    <p className="text-[10px] text-slate-600 font-mono whitespace-pre-wrap leading-tight">{s.content}</p>
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none"></div>
                                </div>
                                <div className="mt-auto flex gap-2">
                                    {s.youtubeUrl && (
                                        <a href={s.youtubeUrl} target="_blank" className="flex-1 text-center py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100">YouTube</a>
                                    )}
                                    <button onClick={()=>startRehearsalSong(s)} className="flex-1 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700">Ensayar</button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* MODAL PLANIFICAR EVENTO */}
            <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title="Planificar Culto">
                <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Tipo" value={eventForm.type} onChange={e=>setEventForm({...eventForm, type:e.target.value})}><option>Culto</option><option>Ensayo</option><option>Especial</option></Select>
                        <Input type="time" label="Hora" value={eventForm.time} onChange={e=>setEventForm({...eventForm, time:e.target.value})}/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="date" label="Fecha" value={eventForm.date} onChange={e=>setEventForm({...eventForm, date:e.target.value})}/>
                        <Input label="Tema / Título" value={eventForm.theme} onChange={e=>setEventForm({...eventForm, theme:e.target.value})}/>
                    </div>

                    {/* SETLIST INTELIGENTE */}
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
                                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">{idx+1}</span>
                                            <span className="text-sm font-bold text-slate-800">{s.title}</span>
                                            <span className="text-xs text-slate-400 bg-slate-50 px-1 rounded">{s.key}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={()=>moveSongOrder(idx, 'up')} disabled={idx===0} className="p-1 hover:bg-slate-100 text-slate-400 rounded disabled:opacity-30"><Icon name="ChevronLeft" className="rotate-90" size={14}/></button>
                                            <button onClick={()=>moveSongOrder(idx, 'down')} disabled={idx===eventForm.songList.length-1} className="p-1 hover:bg-slate-100 text-slate-400 rounded disabled:opacity-30"><Icon name="ChevronRight" className="rotate-90" size={14}/></button>
                                            <button onClick={()=>removeSongFromSetlist(idx)} className="p-1 text-red-400 hover:bg-red-50 rounded ml-1"><Icon name="X" size={14}/></button>
                                        </div>
                                    </div>
                                    {/* Selector de Vocalista */}
                                    <div className="flex items-center gap-2">
                                        <Icon name="User" size={12} className="text-slate-400"/>
                                        <select className="flex-1 bg-slate-50 border-none text-xs text-slate-600 rounded p-1 outline-none" value={s.lead || ''} onChange={(e)=>assignSongLead(idx, e.target.value)}>
                                            <option value="">Voz Principal...</option>
                                            {musicians.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Asignación de Equipo */}
                    <div>
                        <label className="label-modern mb-2">Equipo Base</label>
                        <div className="space-y-3">
                            {defaultInstruments.map(inst => (
                                <div key={inst} className="bg-white p-2 rounded border border-slate-100">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase">{inst}</span>
                                        <SmartSelect options={musicianOptions} onChange={v=>handleTeamAssign(inst, v)} placeholder="Asignar..." />
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {(Array.isArray(eventForm.team[inst]) ? eventForm.team[inst] : (eventForm.team[inst]?[eventForm.team[inst]]:[])).map(n => (
                                            <span key={n} className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded flex items-center gap-1 border border-brand-100">
                                                {n} <button onClick={()=>removeTeamMember(inst, n)} className="hover:text-red-500"><Icon name="X" size={10}/></button>
                                            </span>
                                        ))}
                                    </div>
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
                        <Input label="Tono (Ej: G)" value={songForm.key} onChange={e=>setSongForm({...songForm, key:e.target.value})} placeholder="C" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="BPM" type="number" value={songForm.bpm} onChange={e=>setSongForm({...songForm, bpm:e.target.value})} placeholder="Ej: 72" />
                        <Input label="Link YouTube" value={songForm.youtubeUrl} onChange={e=>setSongForm({...songForm, youtubeUrl:e.target.value})} placeholder="https://..." />
                    </div>
                    <div>
                        <label className="label-modern mb-1">Letra y Acordes</label>
                        <p className="text-[10px] text-slate-400 mb-1">Escribe la letra. Usa corchetes para indicar secciones ej: [CORO].</p>
                        <textarea 
                            className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none text-sm font-mono leading-relaxed resize-none" 
                            placeholder="[VERSO 1]&#10;G          D&#10;Tu fidelidad..." 
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
