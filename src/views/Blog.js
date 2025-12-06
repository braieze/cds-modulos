// src/views/Blog.js
window.Views = window.Views || {};

window.Views.Blog = ({ userProfile, addData, deleteData, updateData }) => {
    const { useState, useEffect, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Input, Icon, Modal, formatDate, Badge } = Utils;
    const { db } = window;

    const [posts, setPosts] = useState([]);
    const [view, setView] = useState('list'); // 'list' | 'read' | 'create'
    const [selectedPost, setSelectedPost] = useState(null);
    const [viewersModal, setViewersModal] = useState(null);
    
    // Formularios
    const [form, setForm] = useState({ title: '', coverUrl: '', content: '', tags: '' });
    const [commentText, setCommentText] = useState('');
    const [isCompressing, setIsCompressing] = useState(false);

    // 1. Suscripción a Datos
    useEffect(() => {
        const unsub = db.collection('posts').orderBy('date', 'desc').onSnapshot(snap => {
            setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const canWrite = ['Pastor', 'Líder'].includes(userProfile.role);

    // 2. Lógica de Vistos Agrupados (Tu corrección)
    const viewersList = useMemo(() => {
        if (!viewersModal || !viewersModal.readBy) return [];
        const counts = {};
        viewersModal.readBy.forEach(entry => {
            // Soporte para formato viejo (solo ID) y nuevo (Nombre|ID)
            const name = entry.includes('|') ? entry.split('|')[0] : 'Usuario';
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count }));
    }, [viewersModal]);

    // 3. Manejadores de Acción
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsCompressing(true);
        try {
            const base64 = await Utils.compressImage(file);
            setForm(prev => ({ ...prev, coverUrl: base64 }));
            Utils.notify("Imagen lista");
        } catch (error) {
            console.error(error);
            Utils.notify("Error al procesar imagen", "error");
        } finally {
            setIsCompressing(false);
        }
    };

    const handleOpenPost = (post) => {
        setSelectedPost(post);
        setView('read');
        
        // Registrar Visto (Evitar duplicados excesivos en la misma sesión si se desea)
        const myEntry = `${userProfile.name}|${userProfile.id}`;
        // Siempre registramos para contar "vistas totales", pero en la lista agrupada se verá limpio.
        updateData('posts', post.id, { 
            readBy: [...(post.readBy || []), myEntry],
            views: (post.views || 0) + 1 
        });
    };

    const handleSave = () => {
        if (!form.title || !form.content) return Utils.notify("Faltan datos", "error");
        addData('posts', {
            ...form,
            author: userProfile.name,
            authorRole: userProfile.role,
            authorId: userProfile.id,
            date: new Date().toISOString(),
            readBy: [],
            views: 0,
            likes: [], // Array de IDs
            reactions: {}, // Map { userId: 'emoji' }
            comments: []
        });
        setForm({ title: '', coverUrl: '', content: '', tags: '' });
        setView('list');
        Utils.notify("Publicado!");
    };

    const handleDelete = (id) => {
        if(confirm("¿Eliminar publicación permanentemente?")) {
            deleteData('posts', id);
            if (view === 'read') setView('list');
        }
    };

    // Social
    const handleReaction = (emoji) => {
        if (!selectedPost) return;
        const reactions = selectedPost.reactions || {};
        // Si ya tiene esa reacción, la quitamos (toggle). Si es distinta, la cambiamos.
        if (reactions[userProfile.id] === emoji) delete reactions[userProfile.id];
        else reactions[userProfile.id] = emoji;
        
        updateData('posts', selectedPost.id, { reactions });
        // Optimistic UI update no necesario si Firestore es rápido, pero seguro:
        setSelectedPost({ ...selectedPost, reactions });
    };

    const handleComment = () => {
        if (!commentText.trim()) return;
        const newComment = {
            id: Date.now(),
            user: userProfile.name,
            userId: userProfile.id,
            text: commentText,
            date: new Date().toISOString()
        };
        const updatedComments = [...(selectedPost.comments || []), newComment];
        updateData('posts', selectedPost.id, { comments: updatedComments });
        setCommentText('');
    };

    // Helpers de Renderizado
    const getReactionCounts = (reactions) => {
        const counts = {};
        Object.values(reactions || {}).forEach(r => counts[r] = (counts[r] || 0) + 1);
        return counts;
    };

    // --- VISTA DE LECTURA ---
    if (view === 'read' && selectedPost) {
        const reactionCounts = getReactionCounts(selectedPost.reactions);
        const myReaction = selectedPost.reactions?.[userProfile.id];

        return (
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden fade-in pb-20">
                {selectedPost.coverUrl && (
                    <div className="w-full h-64 md:h-80 relative">
                        <img src={selectedPost.coverUrl} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-4 left-4"><Badge type="brand">{selectedPost.tags || 'Devocional'}</Badge></div>
                    </div>
                )}
                
                <div className="p-6 md:p-10">
                    <button onClick={()=>setView('list')} className="mb-6 text-slate-500 flex gap-2 hover:text-brand-600 transition-colors font-bold text-sm"><Icon name="ChevronLeft"/> Volver al Muro</button>
                    
                    <div className="flex justify-between items-start mb-4">
                        <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{selectedPost.title}</h1>
                        {canWrite && <button onClick={()=>handleDelete(selectedPost.id)} className="text-slate-300 hover:text-red-500 p-2"><Icon name="Trash"/></button>}
                    </div>

                    <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">{selectedPost.author.charAt(0)}</div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{selectedPost.author}</p>
                            <p className="text-xs text-slate-500">{formatDate(selectedPost.date, 'long')}</p>
                        </div>
                    </div>

                    <div className="prose prose-lg text-slate-700 whitespace-pre-wrap leading-relaxed font-serif">
                        {selectedPost.content}
                    </div>

                    {/* SECCIÓN SOCIAL */}
                    <div className="mt-10 pt-8 border-t border-slate-100">
                        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
                            {['❤️','🔥','🙏','👏'].map(emoji => (
                                <button key={emoji} onClick={()=>handleReaction(emoji)} className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${myReaction===emoji ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-100' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                    <span className="text-lg">{emoji}</span>
                                    <span className="text-sm font-bold text-slate-700">{reactionCounts[emoji] || 0}</span>
                                </button>
                            ))}
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                            <h4 className="font-bold text-slate-800 mb-4">Comentarios ({selectedPost.comments?.length || 0})</h4>
                            <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
                                {(selectedPost.comments || []).map((c, i) => (
                                    <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between mb-1"><span className="font-bold text-xs text-brand-700">{c.user}</span><span className="text-[10px] text-slate-400">{formatDate(c.date)}</span></div>
                                        <p className="text-sm text-slate-700">{c.text}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input className="input-modern bg-white" placeholder="Escribe un comentario..." value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleComment()} />
                                <Button icon="Plus" onClick={handleComment}></Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA LISTA ---
    return (
        <div className="space-y-6 fade-in pb-24">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Devocionales</h2>
                {view==='list' && canWrite && <Button icon="Plus" onClick={()=>setView('create')}>Escribir</Button>}
            </div>

            {view === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.length===0 && <div className="col-span-full text-center py-12 text-slate-400">No hay publicaciones.</div>}
                    {posts.map(post => (
                        <div key={post.id} onClick={()=>handleOpenPost(post)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:border-brand-300 transition-all">
                            <div className="h-48 bg-slate-100 relative overflow-hidden">
                                {post.coverUrl ? <img src={post.coverUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105"/> : <div className="flex items-center justify-center h-full text-slate-300"><Icon name="Image" size={40}/></div>}
                                <div className="absolute top-3 left-3"><Badge type="brand">{post.tags||'Mensaje'}</Badge></div>
                            </div>
                            <div className="p-5">
                                <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2 leading-snug">{post.title}</h3>
                                <p className="text-sm text-slate-500 line-clamp-2">{post.content}</p>
                                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400">
                                    <span>{post.author} • {formatDate(post.date)}</span>
                                    {['Pastor','Líder'].includes(userProfile.role) && (
                                        <button onClick={(e)=>{e.stopPropagation(); setViewersModal(post)}} className="flex items-center gap-1 hover:text-brand-600 bg-slate-50 px-2 py-1 rounded">
                                            <Icon name="Users" size={14}/> {post.views||0}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view === 'create' && (
                <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-soft space-y-4">
                    <h3 className="font-bold text-lg mb-4">Nueva Publicación</h3>
                    <Input label="Título" value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/>
                    <div>
                        <label className="label-modern">Imagen</label>
                        <div className="flex gap-4 items-center">
                            <label className="cursor-pointer bg-slate-100 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-200"><Icon name="Image"/> Subir <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isCompressing} /></label>
                            {form.coverUrl && <span className="text-emerald-600 text-xs font-bold">¡Imagen Cargada!</span>}
                        </div>
                    </div>
                    <Input label="Etiqueta" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})}/>
                    <textarea className="w-full h-64 input-modern" placeholder="Escribe tu mensaje..." value={form.content} onChange={e=>setForm({...form, content:e.target.value})}></textarea>
                    <div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setView('list')}>Cancelar</Button><Button onClick={handleSave} disabled={isCompressing}>Publicar</Button></div>
                </div>
            )}

            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Lectores">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {viewersList.length > 0 ? viewersList.map((v,i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-700 text-sm">{v.name}</span>
                            <Badge type="brand">{v.count} vistas</Badge>
                        </div>
                    )) : <p className="text-center text-slate-400 italic">Sin lectores aún.</p>}
                </div>
            </Modal>
        </div>
    );
};
