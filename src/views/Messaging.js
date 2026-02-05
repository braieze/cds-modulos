window.Views = window.Views || {};

window.Views.Announcements = ({ userProfile }) => {
    const { useState, useEffect } = React;
    const { Icon, Button, Modal, Input, formatDate } = window.Utils;

    const [posts, setPosts] = useState([]);
    const [isWriting, setIsWriting] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', priority: 'normal' });
    const [isAdmin] = useState(true); // TODO: Conectar con userProfile.role === 'admin'

    // Cargar Anuncios (Simulado -> Conectar a Firebase 'announcements')
    useEffect(() => {
        const unsubscribe = window.db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .onSnapshot(snapshot => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPosts(data);
            });
        return () => unsubscribe();
    }, []);

    const handlePublish = async () => {
        if (!newPost.title || !newPost.content) return alert("Falta título o contenido");
        
        try {
            await window.db.collection('announcements').add({
                ...newPost,
                createdAt: new Date().toISOString(),
                author: userProfile.name || 'Liderazgo',
                authorRole: userProfile.role || 'Admin'
            });
            setIsWriting(false);
            setNewPost({ title: '', content: '', priority: 'normal' });
        } catch (e) {
            console.error("Error publicando", e);
        }
    };

    const handleDelete = async (id) => {
        if(confirm("¿Borrar anuncio?")) {
            await window.db.collection('announcements').doc(id).delete();
        }
    };

    return (
        <div className="p-4 sm:p-8 animate-enter max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        <Icon name="Bell" className="text-yellow-500"/> Tablón Oficial
                    </h2>
                    <p className="text-slate-400 text-sm">Novedades importantes de la iglesia.</p>
                </div>
                {isAdmin && (
                    <Button onClick={() => setIsWriting(true)} icon="Plus" className="bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20">
                        Nuevo Anuncio
                    </Button>
                )}
            </div>

            {/* Lista de Anuncios */}
            <div className="space-y-6">
                {posts.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                            <Icon name="BellOff" size={32}/>
                        </div>
                        <p className="text-slate-400">No hay anuncios oficiales por el momento.</p>
                    </div>
                ) : (
                    posts.map(post => (
                        <div key={post.id} className={`relative bg-[#1e293b] rounded-2xl p-6 border-l-4 shadow-xl ${post.priority === 'urgent' ? 'border-red-500' : 'border-indigo-500'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white uppercase">
                                        {post.author?.[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg leading-tight">{post.title}</h3>
                                        <p className="text-xs text-slate-400">{formatDate(post.createdAt)} • Por {post.author}</p>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <button onClick={() => handleDelete(post.id)} className="text-slate-500 hover:text-red-400 transition-colors p-2">
                                        <Icon name="Trash" size={16}/>
                                    </button>
                                )}
                            </div>
                            
                            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap pl-13">
                                {post.content}
                            </div>

                            {post.priority === 'urgent' && (
                                <div className="absolute top-4 right-12 bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-red-500/20">
                                    Importante
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Modal Crear Anuncio */}
            <Modal isOpen={isWriting} onClose={() => setIsWriting(false)} title="Publicar Anuncio Oficial">
                <div className="space-y-4">
                    <Input 
                        label="Título del Anuncio" 
                        placeholder="Ej: Reunión de Jóvenes suspendida" 
                        value={newPost.title} 
                        onChange={e => setNewPost({...newPost, title: e.target.value})}
                    />
                    
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-1 block uppercase">Mensaje</label>
                        <textarea 
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                            placeholder="Escribe los detalles..."
                            value={newPost.content}
                            onChange={e => setNewPost({...newPost, content: e.target.value})}
                        ></textarea>
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer bg-slate-800 p-3 rounded-lg flex-1 border border-slate-700">
                            <input 
                                type="radio" 
                                name="priority" 
                                checked={newPost.priority === 'normal'} 
                                onChange={() => setNewPost({...newPost, priority: 'normal'})}
                            />
                            <span className="text-sm font-bold">Normal</span>
                        </label>
                        <label className="flex items-center gap-2 text-red-300 cursor-pointer bg-red-900/20 p-3 rounded-lg flex-1 border border-red-900/30">
                            <input 
                                type="radio" 
                                name="priority" 
                                checked={newPost.priority === 'urgent'} 
                                onChange={() => setNewPost({...newPost, priority: 'urgent'})}
                            />
                            <span className="text-sm font-bold">Urgente / Importante</span>
                        </label>
                    </div>

                    <Button onClick={handlePublish} className="w-full mt-2">Publicar Ahora</Button>
                </div>
            </Modal>
        </div>
    );
};
