// src/views/Blog.js
window.Views = window.Views || {};

window.Views.Blog = ({ userProfile, addData, deleteData, updateData }) => {
    const { useState, useEffect } = React;
    const { Card, Button, Input, Icon, Modal, formatDate, Badge } = window.Utils;
    const { db } = window;

    const [posts, setPosts] = useState([]);
    const [view, setView] = useState('list');
    const [selectedPost, setSelectedPost] = useState(null);
    const [viewersModal, setViewersModal] = useState(null);
    const [form, setForm] = useState({ title: '', coverUrl: '', content: '', tags: '' });
    const [isCompressing, setIsCompressing] = useState(false);

    useEffect(() => {
        const unsub = db.collection('posts').orderBy('date', 'desc').onSnapshot(snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, []);

    const canWrite = ['Pastor', 'Líder'].includes(userProfile.role);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsCompressing(true);
        try {
            const base64 = await window.Utils.compressImage(file);
            setForm(prev => ({ ...prev, coverUrl: base64 }));
            window.Utils.notify("Imagen procesada");
        } catch (error) { window.Utils.notify("Error imagen", "error"); } finally { setIsCompressing(false); }
    };

    const handleOpenPost = (post) => {
        setSelectedPost(post);
        setView('read');
        if (!post.readBy?.includes(userProfile.id)) {
            updateData('posts', post.id, { readBy: [...(post.readBy || []), `${userProfile.name}|${userProfile.id}`], views: (post.views || 0) + 1 });
        }
    };

    const handleSave = () => {
        if (!form.title || !form.content) return window.Utils.notify("Datos faltantes", "error");
        addData('posts', { ...form, author: userProfile.name, authorRole: userProfile.role, date: new Date().toISOString(), readBy: [], views: 0 });
        setForm({ title: '', coverUrl: '', content: '', tags: '' });
        setView('list');
        window.Utils.notify("Publicado!");
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800">Devocionales</h2>{view === 'list' && canWrite && <Button icon="Plus" onClick={() => setView('create')}>Escribir</Button>}{view !== 'list' && <button onClick={() => setView('list')} className="text-slate-500 flex items-center gap-2"><Icon name="ChevronLeft" /> Volver</button>}</div>
            {view === 'list' && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{posts.map(post => (<div key={post.id} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden group"><div onClick={() => handleOpenPost(post)} className="h-40 bg-slate-100 relative cursor-pointer overflow-hidden">{post.coverUrl ? <img src={post.coverUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" /> : <div className="flex items-center justify-center h-full text-slate-300"><Icon name="Book" size={40}/></div>}<div className="absolute top-2 left-2"><Badge type="brand">{post.tags || 'Mensaje'}</Badge></div></div><div className="p-4"><h3 onClick={() => handleOpenPost(post)} className="font-bold text-lg mb-2 cursor-pointer hover:text-brand-600">{post.title}</h3><div className="flex justify-between items-center text-xs text-slate-400 mt-4 border-t pt-3"><span>{post.author} • {formatDate(post.date)}</span>{userProfile.role === 'Pastor' && (<button onClick={(e) => { e.stopPropagation(); setViewersModal(post); }} className="flex items-center gap-1 text-brand-600 bg-brand-50 px-2 py-1 rounded hover:bg-brand-100"><Icon name="Users" size={14} /> {post.readBy?.length || 0}</button>)}</div></div></div>))}</div>)}
            {view === 'read' && selectedPost && (<div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">{selectedPost.coverUrl && <img src={selectedPost.coverUrl} className="w-full h-64 object-cover" />}<div className="p-8"><h1 className="text-3xl font-extrabold text-slate-900 mb-4">{selectedPost.title}</h1><p className="text-sm text-slate-500 mb-8 pb-4 border-b">Por {selectedPost.author} • {formatDate(selectedPost.date, 'long')}</p><div className="prose prose-lg text-slate-700 whitespace-pre-wrap">{selectedPost.content}</div></div></div>)}
            {view === 'create' && (<div className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-soft space-y-4"><Input label="Título" value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/><div><label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">Portada</label><div className="flex items-center gap-4"><label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"><Icon name="Image" size={18}/> {isCompressing?'...':'Subir'}<input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isCompressing} /></label>{form.coverUrl && <span className="text-xs text-emerald-600 font-bold">¡OK!</span>}</div></div><Input label="Etiqueta" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} /><textarea className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none" placeholder="Escribe..." value={form.content} onChange={e=>setForm({...form, content:e.target.value})}></textarea><Button className="w-full" onClick={handleSave} disabled={isCompressing}>Publicar</Button></div>)}
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Lectores"><div className="space-y-2 max-h-60 overflow-y-auto">{viewersModal?.readBy?.map((entry, i) => { const [name] = entry.split('|'); return (<div key={i} className="flex items-center gap-3 p-2 border-b border-slate-50"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{name.charAt(0)}</div><span className="text-sm text-slate-700">{name}</span></div>); }) || <p className="text-slate-400 text-center">Nadie aún.</p>}</div></Modal>
        </div>
    );
};
