// src/views/Blog.js
window.Views = window.Views || {};

window.Views.Blog = ({ userProfile, addData, deleteData, updateData }) => {
    const { useState, useEffect } = React;
    // Importaciones seguras
    const Utils = window.Utils || {};
    const { Card, Button, Input, Icon, Modal, formatDate, Badge } = Utils;
    const { db } = window;

    const [posts, setPosts] = useState([]);
    const [view, setView] = useState('list'); // 'list' | 'read' | 'create'
    const [selectedPost, setSelectedPost] = useState(null);
    const [viewersModal, setViewersModal] = useState(null); // Para ver quién leyó
    const [form, setForm] = useState({ title: '', coverUrl: '', content: '', tags: '' });
    const [commentText, setCommentText] = useState(''); // Nuevo comentario
    const [isCompressing, setIsCompressing] = useState(false);

    // Suscripción a Posts
    useEffect(() => {
        const unsub = db.collection('posts').orderBy('date', 'desc').onSnapshot(snap => {
            setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const canWrite = ['Pastor', 'Líder'].includes(userProfile.role);

    // Subida de Imagen
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsCompressing(true);
        try {
            const base64 = await Utils.compressImage(file);
            setForm(prev => ({ ...prev, coverUrl: base64 }));
            Utils.notify("Imagen procesada correctamente");
        } catch (error) {
            console.error(error);
            Utils.notify("Error al procesar imagen", "error");
        } finally {
            setIsCompressing(false);
        }
    };

    // Abrir Post (Registrar Visto)
    const handleOpenPost = (post) => {
        setSelectedPost(post);
        setView('read');
        
        // Lógica de "Visto"
        const myEntry = `${userProfile.name}|${userProfile.id}`;
        const readList = post.readBy || [];
        const alreadyRead = readList.some(r => r.includes(userProfile.id));

        if (!alreadyRead) {
            updateData('posts', post.id, { 
                readBy: [...readList, myEntry],
                views: (post.views || 0) + 1 
            });
        }
    };

    // Guardar Post
    const handleSave = () => {
        if (!form.title || !form.content) return Utils.notify("Faltan datos obligatorios", "error");
        
        addData('posts', {
            ...form,
            author: userProfile.name,
            authorRole: userProfile.role,
            authorId: userProfile.id,
            date: new Date().toISOString(),
            readBy: [],
            views: 0,
            likes: [],
            comments: []
        });
        
        setForm({ title: '', coverUrl: '', content: '', tags: '' });
        setView('list');
        Utils.notify("Devocional publicado con éxito");
    };

    // Reacción (Me Gusta)
    const handleLike = () => {
        if (!selectedPost) return;
        const likes = selectedPost.likes || [];
        const myId = userProfile.id;
        
        let newLikes;
        if (likes.includes(myId)) {
            newLikes = likes.filter(id => id !== myId); // Quitar like
        } else {
            newLikes = [...likes, myId]; // Agregar like
        }

        updateData('posts', selectedPost.id, { likes: newLikes });
        // Actualización optimista local para que se sienta rápido
        setSelectedPost(prev => ({ ...prev, likes: newLikes }));
    };

    // Comentar
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
        setSelectedPost(prev => ({ ...prev, comments: updatedComments }));
        setCommentText('');
        Utils.notify("Comentario agregado");
    };

    const handleDelete = (id) => {
        if(confirm("¿Eliminar esta publicación permanentemente?")) {
            deleteData('posts', id);
            if (view === 'read') setView('list');
        }
    };

    return (
        <div className="space-y-6 fade-in pb-24">
            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Devocionales</h2>
                    <p className="text-slate-500 text-sm">Inspiración y comunidad</p>
                </div>
                {view === 'list' && canWrite && (
                    <Button icon="Plus" onClick={() => setView('create')}>Escribir</Button>
                )}
                {view !== 'list' && (
                    <button onClick={() => setView('list')} className="text-slate-500 flex items-center gap-2 hover:text-brand-600 transition-colors font-bold text-sm">
                        <Icon name="ChevronLeft" /> Volver al Muro
                    </button>
                )}
            </div>

            {/* VISTA LISTA */}
            {view === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="inline-block p-4 bg-slate-50 rounded-full text-slate-300 mb-2"><Icon name="Book" size={32}/></div>
                            <p className="text-slate-500">Aún no hay devocionales publicados.</p>
                        </div>
                    )}
                    {posts.map(post => (
                        <div key={post.id} onClick={() => handleOpenPost(post)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-lg transition-all hover:-translate-y-1">
                            {/* Portada */}
                            <div className="h-48 bg-slate-100 relative overflow-hidden">
                                {post.coverUrl ? (
                                    <img src={post.coverUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Portada" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-brand-50 to-slate-100 flex items-center justify-center text-brand-200">
                                        <Icon name="Image" size={48} />
                                    </div>
                                )}
                                <div className="absolute top-3 left-3">
                                    <Badge type="brand">{post.tags || 'Mensaje'}</Badge>
                                </div>
                            </div>
                            
                            {/* Info */}
                            <div className="p-5">
                                <h3 className="font-bold text-lg text-slate-900 mb-2 leading-tight group-hover:text-brand-600 transition-colors line-clamp-2">{post.title}</h3>
                                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{post.content}</p>
                                
                                <div className="flex justify-between items-center pt-4 border-t border-slate-50 text-xs text-slate-400">
                                    <span>{post.author} • {formatDate(post.date)}</span>
                                    
                                    {/* Contador de Vistas (Solo Pastor/Lider) */}
                                    {['Pastor', 'Líder'].includes(userProfile.role) && (
                                        <button onClick={(e) => { e.stopPropagation(); setViewersModal(post); }} className="flex items-center gap-1 hover:text-brand-600 bg-slate-50 px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                                            <Icon name="Users" size={14} /> {post.readBy?.length || 0}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VISTA LECTURA (READ) */}
            {view === 'read' && selectedPost && (
                <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden animate-enter">
                    {selectedPost.coverUrl && (
                        <div className="h-64 md:h-80 w-full relative">
                            <img src={selectedPost.coverUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <div className="absolute bottom-6 left-6 text-white">
                                <Badge type="brand" className="mb-2 shadow-sm">{selectedPost.tags || 'Devocional'}</Badge>
                            </div>
                        </div>
                    )}

                    <div className="p-6 md:p-10">
                        {/* Título y Autor */}
                        <div className="flex justify-between items-start mb-6">
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">{selectedPost.title}</h1>
                            {canWrite && (
                                <button onClick={() => handleDelete(selectedPost.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50">
                                    <Icon name="Trash" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-100">
                            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                                {selectedPost.author.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">{selectedPost.author}</p>
                                <p className="text-xs text-slate-500">{selectedPost.authorRole} • {formatDate(selectedPost.date, 'long')}</p>
                            </div>
                        </div>

                        {/* Contenido del Post */}
                        <div className="prose prose-lg prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">
                            {selectedPost.content}
                        </div>

                        {/* SECCIÓN SOCIAL */}
                        <div className="mt-12 pt-8 border-t border-slate-100">
                            {/* Botón Like */}
                            <div className="flex items-center gap-4 mb-8">
                                <button 
                                    onClick={handleLike} 
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all transform active:scale-95 ${selectedPost.likes?.includes(userProfile.id) ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                >
                                    <Icon name="Smile" className={selectedPost.likes?.includes(userProfile.id) ? "fill-current" : ""} /> 
                                    <span className="font-bold">{selectedPost.likes?.length || 0}</span> Me bendice
                                </button>
                            </div>

                            {/* Comentarios */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Icon name="MessageCircle" size={18}/> Comentarios ({selectedPost.comments?.length || 0})
                                </h4>
                                
                                <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-2">
                                    {(selectedPost.comments || []).map((c, i) => (
                                        <div key={i} className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-xs text-slate-900">{c.user}</span>
                                                <span className="text-[10px] text-slate-400">{formatDate(c.date)}</span>
                                            </div>
                                            <p className="text-sm text-slate-600">{c.text}</p>
                                        </div>
                                    ))}
                                    {(!selectedPost.comments || selectedPost.comments.length === 0) && (
                                        <p className="text-sm text-slate-400 italic text-center py-2">Sé el primero en comentar.</p>
                                    )}
                                </div>
                                
                                <div className="flex gap-2">
                                    <input 
                                        className="input-modern bg-white w-full" 
                                        placeholder="Escribe un comentario..." 
                                        value={commentText} 
                                        onChange={e=>setCommentText(e.target.value)}
                                        onKeyPress={e=>e.key==='Enter' && handleComment()}
                                    />
                                    <Button onClick={handleComment} icon="Plus"></Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA CREAR */}
            {view === 'create' && (
                <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-soft border border-slate-100 p-6 md:p-8 animate-enter">
                    <h3 className="text-xl font-bold text-slate-800 mb-6">Escribir Nuevo Mensaje</h3>
                    
                    <div className="space-y-5">
                        <Input 
                            label="Título Principal" 
                            placeholder="Ej. La Fe que Mueve Montañas" 
                            value={form.title} 
                            onChange={e => setForm({...form, title: e.target.value})} 
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label-modern mb-1.5 ml-1">Imagen de Portada</label>
                                <div className="flex items-center gap-3">
                                    <label className={`cursor-pointer flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${isCompressing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <Icon name="Image" size={18}/>
                                        {isCompressing ? 'Procesando...' : 'Subir Foto'}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isCompressing} />
                                    </label>
                                </div>
                            </div>
                            <Input 
                                label="Etiqueta / Tema" 
                                placeholder="Ej. Fe, Esperanza" 
                                value={form.tags} 
                                onChange={e => setForm({...form, tags: e.target.value})} 
                            />
                        </div>

                        {form.coverUrl && (
                            <div className="h-40 w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-200 relative group">
                                <img src={form.coverUrl} className="w-full h-full object-cover" alt="Vista previa" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button onClick={()=>setForm({...form, coverUrl: ''})} className="bg-white text-red-500 px-4 py-2 rounded-full font-bold text-xs shadow-lg">Eliminar Imagen</button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="label-modern mb-2">Cuerpo del Mensaje</label>
                            <textarea 
                                className="w-full h-72 bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-y text-base leading-relaxed"
                                placeholder="Escribe aquí tu mensaje inspiracional..."
                                value={form.content}
                                onChange={e => setForm({...form, content: e.target.value})}
                            ></textarea>
                        </div>

                        <div className="pt-4 flex gap-3 justify-end border-t border-slate-100 mt-4">
                            <Button variant="secondary" onClick={() => setView('list')}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={isCompressing}>Publicar Mensaje</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Lectores (Analytics) */}
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Lectores del Devocional">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {viewersModal?.readBy?.map((entry, i) => {
                        const [name] = entry.split('|');
                        return (
                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{name.charAt(0)}</div>
                                <span className="text-sm font-medium text-slate-700">{name}</span>
                            </div>
                        );
                    }) || <div className="text-slate-400 text-center py-4 italic">Aún nadie ha leído este mensaje.</div>}
                </div>
            </Modal>
        </div>
    );
};
