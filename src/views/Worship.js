// src/views/Worship.js
window.Views = window.Views || {};

window.Views.Worship = ({ worship, songs, members, addData, updateData, deleteData }) => {
    const { useState } = React;
    const { Card, Button, Badge, Icon, Modal, formatDate, formatTime } = window.Utils;

    const [view, setView] = useState('list');
    const [editing, setEditing] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [srvForm, setSrvForm] = useState({ date: '', time: '', theme: '', type: 'Culto', team: {}, songList: [] });
    const [songSearch, setSongSearch] = useState('');
    const [newSong, setNewSong] = useState({ title: '', artist: '' });

    const musicians = members.filter(m => m.ministry === 'Alabanza' || m.role === 'Pastor');
    const instruments = ['Vocal', 'Guitarra A.', 'Guitarra E.', 'Bajo', 'Batería', 'Teclado'];

    const openServiceModal = (srv = null) => {
        setEditing(srv);
        setSrvForm(srv || { date: '', time: '', theme: '', type: 'Culto', team: {}, songList: [] });
        setIsModalOpen(true);
    };

    const toggleMusician = (inst, name) => {
        const current = srvForm.team[inst] || [];
        const updated = current.includes(name) ? current.filter(n => n !== name) : [...current, name];
        setSrvForm({ ...srvForm, team: { ...srvForm.team, [inst]: updated } });
    };

    const addSongToService = (songTitle) => {
        if(!srvForm.songList.includes(songTitle)) {
            setSrvForm({ ...srvForm, songList: [...srvForm.songList, songTitle] });
        }
        setSongSearch('');
    };

    const saveService = () => {
        if(editing) updateData('worship', editing.id, srvForm);
        else addData('worship', srvForm);
        setIsModalOpen(false);
    };

    const saveSongLibrary = () => {
        if(newSong.title) { addData('songs', newSong); setNewSong({title:'', artist:''}); }
    };

    return (
        <div className="space-y-6 fade-in">
            <div className="flex gap-2 border-b border-slate-200 pb-2">
                <button onClick={()=>setView('list')} className={`px-4 py-2 text-sm font-bold rounded-lg ${view==='list'?'bg-brand-100 text-brand-700':'text-slate-500'}`}>Eventos</button>
                <button onClick={()=>setView('songs')} className={`px-4 py-2 text-sm font-bold rounded-lg ${view==='songs'?'bg-brand-100 text-brand-700':'text-slate-500'}`}>Biblioteca</button>
            </div>

            {view === 'list' && (
                <>
                    <div className="flex justify-end"><Button icon="Plus" onClick={()=>openServiceModal()}>Nuevo Evento</Button></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {worship.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(w => (
                            <Card key={w.id} className="relative group">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>openServiceModal(w)} className="p-1 bg-blue-50 text-blue-600 rounded"><Icon name="Edit" size={16}/></button>
                                    <button onClick={()=>deleteData('worship', w.id)} className="p-1 bg-red-50 text-red-600 rounded"><Icon name="Trash" size={16}/></button>
                                </div>
                                <div className="flex items-center gap-3 mb-3">
                                    <Badge type={w.type === 'Ensayo' ? 'default' : 'brand'}>{w.type}</Badge>
                                    <span className="text-sm font-bold text-slate-500">{formatDate(w.date)} • {formatTime(w.time)}</span>
                                </div>
                                <h3 className="font-bold text-xl text-slate-800 mb-2">{w.theme || 'Sin Tema'}</h3>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
                                    <ul className="list-disc list-inside text-sm text-slate-700">
                                        {w.songList?.map((s,i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {view === 'songs' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="h-fit">
                        <h3 className="font-bold mb-4">Agregar Canción</h3>
                        <input className="input-modern mb-2" placeholder="Título" value={newSong.title} onChange={e=>setNewSong({...newSong, title:e.target.value})}/>
                        <input className="input-modern mb-4" placeholder="Artista" value={newSong.artist} onChange={e=>setNewSong({...newSong, artist:e.target.value})}/>
                        <Button className="w-full" onClick={saveSongLibrary}>Guardar</Button>
                    </Card>
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {songs.map(s => (
                            <div key={s.id} className="bg-white p-3 rounded-lg border flex justify-between items-center">
                                <div><p className="font-bold">{s.title}</p><p className="text-xs text-slate-500">{s.artist}</p></div>
                                <button onClick={()=>deleteData('songs',s.id)} className="text-red-400 hover:text-red-600"><Icon name="Trash" size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Planificar Alabanza">
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1"><label className="label-modern">Tipo</label><select className="input-modern" value={srvForm.type} onChange={e=>setSrvForm({...srvForm, type:e.target.value})}><option>Culto</option><option>Ensayo</option></select></div>
                        <div className="col-span-1"><label className="label-modern">Fecha</label><input type="date" className="input-modern" value={srvForm.date} onChange={e=>setSrvForm({...srvForm, date:e.target.value})}/></div>
                        <div className="col-span-1"><label className="label-modern">Hora</label><input type="time" className="input-modern" value={srvForm.time} onChange={e=>setSrvForm({...srvForm, time:e.target.value})}/></div>
                    </div>
                    <div><label className="label-modern">Tema</label><input className="input-modern" value={srvForm.theme} onChange={e=>setSrvForm({...srvForm, theme:e.target.value})}/></div>
                    
                    {/* Sección Equipo (Simplificada para el ejemplo) */}
                    <div>
                        <label className="label-modern">Equipo</label>
                        {instruments.map(inst => (
                            <div key={inst} className="flex flex-wrap gap-1 mb-2">
                                <span className="text-xs font-bold w-full text-slate-400">{inst}</span>
                                {musicians.map(m => (
                                    <button key={m.id} onClick={()=>toggleMusician(inst, m.name)} 
                                        className={`text-xs px-2 py-1 border rounded-full ${(srvForm.team[inst]||[]).includes(m.name) ? 'bg-brand-600 text-white' : 'bg-white'}`}>
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                    <Button className="w-full" onClick={saveService}>Guardar Evento</Button>
                </div>
            </Modal>
        </div>
    );
};
