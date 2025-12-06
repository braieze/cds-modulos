// src/views/Blog.js
window.Views = window.Views || {};

window.Views.Blog = ({ userProfile, addData, deleteData }) => {
    const { useState, useEffect } = React;
    const { Card, Button, Input, Icon, Modal, formatDate, Badge } = window.Utils;
    const { db } = window; // Acceso directo a Firestore para consultar colección 'posts'

    const [posts, setPosts] = useState([]);
    const [view, setView] = useState('list'); // 'list' | 'read' | 'create'
    const [selectedPost, setSelectedPost] = useState(null);
    
    // Formulario
    const [form, setForm] = useState({ title: '', coverUrl: '', content: '', tags: '' });

    // Escuchar posts en tiempo real (separado para no cargar App.js demasiado)
    useEffect(() => {
        const unsub = db.collection('posts').orderBy('date', 'desc').onSnapshot(snap => {
            setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const canWrite = ['Pastor', 'Líder'].includes(userProfile.role);

    const handleSave = () => {
        if (!form.title || !form.content) return window.Utils.notify("Título y contenido requeridos", "error");
        
        const newPost = {
            ...form,
            author: userProfile.name,
            authorRole: userProfile.role,
            authorId: userProfile.id,
            date: new Date().toISOString(),
            likes: 0
        };

        addData('posts', newPost);
        setForm({ title: '', coverUrl: '', content: '', tags: '' });
        setView('list');
        window.Utils.notify("Devocional publicado con éxito");
    };

    const handleDelete = (id) => {
        if(confirm("¿Eliminar esta publicación?")) {
            deleteData('posts', id);
            if (view === 'read') setView('list');
        }
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Devocionales</h2>
                    <p className="text-slate-500 text-sm">Inspiración y noticias de la iglesia</p>
                </div>
                {view === 'list' && canWrite && (
                    <Button icon="Plus" onClick={() => setView('create')}>Escribir</Button>
                )}
                {view !== 'list' && (
                    <button onClick={() => setView('list')} className="text-slate-500 flex items-center gap-2 hover:text-brand-600 transition-colors">
                        <Icon name="ChevronLeft" /> Volver
                    </button>
                )}
            </div>

            {/* VISTA LISTA (GRID) */}
            {view === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="inline-block p-4 bg-slate-50 rounded-full text-slate-300 mb-2"><Icon name="BookOpen" size={32}/></div>
                            <p className="text-slate-500">Aún no hay devocionales publicados.</p>
                        </div>
                    )}
                    {posts.map(post => (
                        <div 
                            key={post.id} 
                            onClick={() => { setSelectedPost(post); setView('read'); }}
                            className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-lg transition-all hover:-translate-y-1"
                        >
                            {/* Imagen de Portada */}
                            <div className="h-48 bg-slate-100 relative overflow-hidden">
                                {post.coverUrl ? (
                                    <img src={post.coverUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Portada" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                                        <Icon name="Book" size={40} />
                                    </div>
                                )}
                                <div className="absolute top-3 left-3">
                                    <Badge type="brand">{post.tags || 'Devocional'}</Badge>
                                </div>
                            </div>
                            
                            {/* Contenido Tarjeta */}
                            <div className="p-5">
                                <h3 className="font-bold text-lg text-slate-900 mb-2 leading-tight group-hover:text-brand-600 transition-colors">{post.title}</h3>
                                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{post.content}</p>
                                
                                <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                                    <div className="text-xs text-slate-400">
                                        <span className="font-bold text-slate-600">{post.author}</span> • {formatDate(post.date)}
                                    </div>
                                    <div className="text-brand-500 text-xs font-bold flex items-center gap-1">
                                        Leer más <Icon name="ChevronRight" size={14}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VISTA LECTURA */}
            {view === 'read' && selectedPost && (
                <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden animate-enter">
                    {/* Hero Image */}
                    {selectedPost.coverUrl && (
                        <div className="h-64 md:h-80 w-full relative">
                            <img src={selectedPost.coverUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <div className="absolute bottom-6 left-6 text-white">
                                <Badge type="brand" className="mb-2">{selectedPost.tags || 'Mensaje'}</Badge>
                            </div>
                        </div>
                    )}

                    <div className="p-8 md:p-12">
                        <div className="flex justify-between items-start mb-6">
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">{selectedPost.title}</h1>
                            {canWrite && (
                                <button onClick={() => handleDelete(selectedPost.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
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

                        <div className="prose prose-lg text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">
                            {selectedPost.content}
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
                            label="Título del Devocional" 
                            placeholder="Ej. La Fe que Mueve Montañas" 
                            value={form.title} 
                            onChange={e => setForm({...form, title: e.target.value})} 
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input 
                                label="Etiqueta / Categoría" 
                                placeholder="Ej. Fe, Esperanza, Aviso" 
                                value={form.tags} 
                                onChange={e => setForm({...form, tags: e.target.value})} 
                            />
                            <Input 
                                label="URL de Imagen de Portada" 
                                placeholder="https://..." 
                                value={form.coverUrl} 
                                onChange={e => setForm({...form, coverUrl: e.target.value})} 
                            />
                        </div>

                        {form.coverUrl && (
                            <div className="h-32 w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-200">
                                <img src={form.coverUrl} className="w-full h-full object-cover" alt="Vista previa" onError={(e) => e.target.style.display='none'} />
                            </div>
                        )}

                        <div>
                            <label className="label-modern mb-2">Contenido del Mensaje</label>
                            <textarea 
                                className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-y"
                                placeholder="Escribe aquí tu mensaje inspiracional..."
                                value={form.content}
                                onChange={e => setForm({...form, content: e.target.value})}
                            ></textarea>
                            <p className="text-xs text-slate-400 mt-2 text-right">Se respetarán los párrafos y espacios.</p>
                        </div>

                        <div className="pt-4 flex gap-3 justify-end">
                            <Button variant="ghost" onClick={() => setView('list')}>Cancelar</Button>
                            <Button onClick={handleSave}>Publicar Mensaje</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
