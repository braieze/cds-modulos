window.Views = window.Views || {};

window.Views.Messaging = ({ userProfile }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, Icon, formatDate, compressImage } = Utils;

    // --- ESTADOS ---
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Formulario Nuevo Mensaje
    const [composeForm, setComposeForm] = useState({ to: '', type: 'individual', content: '', isPinned: false, attachmentUrl: '' });
    const [replyText, setReplyText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);

    // Permisos
    const canBroadcast = ['Pastor', 'Líder'].includes(userProfile.role);

    // --- CONEXIÓN DIRECTA FIREBASE (Robusta) ---
    useEffect(() => {
        if (!window.db) return;

        // 1. Escuchar Mensajes
        const unsubMsg = window.db.collection('messages').orderBy('date', 'desc').limit(100).onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(data);
            setLoading(false);
        });

        // 2. Escuchar Miembros (Para el selector)
        const unsubMem = window.db.collection('members').onSnapshot(snap => {
            setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubMsg(); unsubMem(); };
    }, []);

    // Scroll al fondo al abrir chat
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [selectedChat, messages]);

    // --- LÓGICA DE FILTRADO ---
    const myChats = useMemo(() => {
        return messages.filter(m => {
            // Mensajes para mí
            if (m.to === userProfile.id) return true;
            // Mensajes enviados por mí
            if (m.from === userProfile.id) return true;
            // Difusión General
            if (m.to === 'all') return true;
            // Grupos de Ministerio (Si soy del ministerio o soy Pastor)
            if (m.to.startsWith('group:')) {
                const group = m.to.split(':')[1];
                if (userProfile.role === 'Pastor') return true;
                if (userProfile.ministry === group) return true;
                if (m.from === userProfile.id) return true;
            }
            return false;
        });
    }, [messages, userProfile]);

    // --- ACCIONES ---
    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const base64 = await compressImage(file);
            setComposeForm(p => ({ ...p, attachmentUrl: base64 }));
        } catch(err) { Utils.notify("Error al subir imagen", "error"); }
        setIsUploading(false);
    };

    const handleSend = async () => {
        if(!composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Escribe algo", "error");
        
        let recipientId = composeForm.to;
        if (composeForm.type === 'group') recipientId = `group:${composeForm.to}`; // Ej: group:Alabanza
        if (composeForm.type === 'broadcast') recipientId = 'all';

        const newMessage = {
            from: userProfile.id, 
            fromName: userProfile.name,
            to: recipientId, 
            content: composeForm.content,
            isPinned: composeForm.isPinned, 
            attachmentUrl: composeForm.attachmentUrl,
            date: new Date().toISOString(), 
            readBy: [userProfile.id],
            replies: [] // Array para hilos de conversación
        };

        try {
            await window.db.collection('messages').add(newMessage);
            setIsComposeOpen(false); 
            setComposeForm({ to: '', type: 'individual', content: '', isPinned: false, attachmentUrl: '' });
            Utils.notify("Mensaje enviado");
        } catch(e) { console.error(e); Utils.notify("Error al enviar", "error"); }
    };

    const handleReply = async () => {
        if (!replyText.trim() || !selectedChat) return;
        
        const reply = {
            id: Date.now(),
            from: userProfile.id,
            fromName: userProfile.name,
            content: replyText,
            date: new Date().toISOString()
        };

        try {
            const msgRef = window.db.collection('messages').doc(selectedChat.id);
            // Usamos arrayUnion para agregar sin sobrescribir
            await msgRef.update({
                replies: firebase.firestore.FieldValue.arrayUnion(reply),
                readBy: [userProfile.id] // Resetear leídos podría ser complejo, simplificamos marcando actividad
            });
            setReplyText("");
            // Actualizar vista local rápido
            setSelectedChat(prev => ({...prev, replies: [...(prev.replies||[]), reply]}));
        } catch(e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar conversación?")) {
            await window.db.collection('messages').doc(id).delete();
            setSelectedChat(null);
            Utils.notify("Eliminado");
        }
    };

    const markAsRead = async (msg) => {
        if (!msg.readBy?.includes(userProfile.id)) {
            await window.db.collection('messages').doc(msg.id).update({
                readBy: firebase.firestore.FieldValue.arrayUnion(userProfile.id)
            });
        }
    };

    // --- HELPERS VISUALES ---
    const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';
    const getAvatarColor = (name) => {
        const colors = ['bg-red-100 text-red-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-yellow-100 text-yellow-600', 'bg-purple-100 text-purple-600'];
        return colors[(name?.length || 0) % colors.length];
    };

    const getChatTitle = (msg) => {
        if (msg.to === 'all') return '📢 Difusión General';
        if (msg.to.startsWith('group:')) return `👥 Ministerio: ${msg.to.split(':')[1]}`;
        // Si es individual, muestro el nombre del OTRO
        return msg.from === userProfile.id 
            ? members.find(m => m.id === msg.to)?.name || 'Usuario' 
            : msg.fromName;
    };

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            <div className="flex justify-between items-center flex-shrink-0">
                <h2 className="text-2xl font-extrabold text-slate-800">Centro de Mensajes</h2>
                <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Redactar</Button>
            </div>

            <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200">
                
                {/* 1. SIDEBAR: LISTA DE CHATS */}
                <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <div className="relative">
                            <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400"/>
                            <input className="w-full bg-slate-100 border-none rounded-xl py-2 pl-9 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500" placeholder="Buscar mensajes..." />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {myChats.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No tienes mensajes.</div>}
                        {myChats.map(msg => {
                            const isUnread = !msg.readBy?.includes(userProfile.id);
                            const isGroup = msg.to === 'all' || msg.to.startsWith('group:');
                            const title = getChatTitle(msg);
                            
                            return (
                                <div key={msg.id} onClick={()=>{setSelectedChat(msg); markAsRead(msg);}} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white transition-all ${selectedChat?.id===msg.id ? 'bg-white border-l-4 border-l-brand-500 shadow-sm' : 'border-l-4 border-l-transparent'}`}>
                                    <div className="flex justify-between mb-1">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isGroup ? 'bg-indigo-100 text-indigo-600' : getAvatarColor(title)}`}>
                                                {isGroup ? <Icon name="Users" size={14}/> : getInitials(title)}
                                            </div>
                                            <span className={`text-sm truncate ${isUnread ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{title}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(msg.date)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pl-10">
                                        <p className={`text-xs truncate max-w-[180px] ${isUnread ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                                            {msg.from === userProfile.id && <span className="text-brand-600">Tú: </span>}
                                            {msg.content || '📷 Imagen adjunta'}
                                        </p>
                                        {isUnread && <div className="w-2 h-2 bg-brand-500 rounded-full"></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. AREA PRINCIPAL: CHAT */}
                <div className={`flex-1 flex flex-col bg-[#eef2f6] relative ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                    {selectedChat ? (
                        <>
                            {/* Header Chat */}
                            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                                <div className="flex items-center gap-3">
                                    <button onClick={()=>setSelectedChat(null)} className="md:hidden text-slate-500 hover:text-slate-800"><Icon name="ChevronLeft"/></button>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${selectedChat.to.includes('group') || selectedChat.to === 'all' ? 'bg-indigo-600 text-white' : getAvatarColor(getChatTitle(selectedChat))}`}>
                                        {selectedChat.to === 'all' ? <Icon name="Bell" size={18}/> : getInitials(getChatTitle(selectedChat))}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 leading-tight">{getChatTitle(selectedChat)}</h3>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            {selectedChat.to === 'all' ? 'Difusión a todos' : (selectedChat.to.startsWith('group:') ? 'Grupo de Ministerio' : 'Mensaje Directo')}
                                        </p>
                                    </div>
                                </div>
                                {(userProfile.role==='Pastor' || selectedChat.from === userProfile.id) && (
                                    <button onClick={()=>handleDelete(selectedChat.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Icon name="Trash" size={18}/></button>
                                )}
                            </div>
                            
                            {/* Body Chat (Mensajes) */}
                            <div className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
                                {/* Mensaje Original */}
                                <div className={`flex ${selectedChat.from === userProfile.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm relative ${selectedChat.from === userProfile.id ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                                        {selectedChat.from !== userProfile.id && <p className="text-[10px] font-bold text-brand-500 mb-1">{selectedChat.fromName}</p>}
                                        
                                        {selectedChat.attachmentUrl && (
                                            <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                                                <img src={selectedChat.attachmentUrl} className="max-w-full max-h-60 object-cover cursor-pointer" onClick={()=>window.open(selectedChat.attachmentUrl)} />
                                            </div>
                                        )}
                                        
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedChat.content}</p>
                                        
                                        <div className={`text-[9px] mt-2 text-right flex items-center justify-end gap-1 ${selectedChat.from === userProfile.id ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {formatDate(selectedChat.date)}
                                            {selectedChat.from === userProfile.id && <Icon name="Check" size={12} className={selectedChat.readBy?.length > 1 ? 'text-blue-200' : 'text-white/50'}/>}
                                        </div>
                                    </div>
                                </div>

                                {/* Respuestas (Hilos) */}
                                {(selectedChat.replies || []).map((reply, idx) => (
                                    <div key={idx} className={`flex ${reply.from === userProfile.id ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm text-sm relative ${reply.from === userProfile.id ? 'bg-blue-100 text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                                            {reply.from !== userProfile.id && <p className="text-[10px] font-bold text-orange-600 mb-0.5">{reply.fromName}</p>}
                                            <p>{reply.content}</p>
                                            <span className="text-[9px] text-slate-400 block text-right mt-1">{formatDate(reply.date).split(',')[1]}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Respuesta */}
                            <div className="p-3 bg-white border-t border-slate-200">
                                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-full border border-slate-200">
                                    <input 
                                        className="flex-1 bg-transparent px-4 py-2 text-sm outline-none text-slate-700 placeholder:text-slate-400" 
                                        placeholder="Escribe una respuesta..." 
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && handleReply()}
                                    />
                                    <button onClick={handleReply} className={`p-2.5 rounded-full text-white transition-all ${replyText.trim() ? 'bg-brand-600 shadow-md hover:bg-brand-700' : 'bg-slate-300'}`}>
                                        <Icon name="ArrowRight" size={18} strokeWidth={3}/>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <Icon name="MessageCircle" size={48} className="text-slate-200"/>
                            </div>
                            <h3 className="text-lg font-bold text-slate-400">Selecciona un chat</h3>
                            <p className="text-sm">Comunícate con tu equipo o envía avisos.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL NUEVO MENSAJE */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Nuevo Mensaje">
                <div className="space-y-5">
                    {/* Selector de Tipo */}
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        {['individual', 'group', 'broadcast'].map(t => {
                            if (t === 'broadcast' && !canBroadcast) return null;
                            const labels = { individual: 'Privado', group: 'Grupo', broadcast: 'Difusión' };
                            return (
                                <button key={t} onClick={()=>setComposeForm({...composeForm, type: t, to: ''})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${composeForm.type === t ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>
                                    {labels[t]}
                                </button>
                            );
                        })}
                    </div>

                    {/* Selector de Destinatario */}
                    {composeForm.type === 'individual' && (
                        <Select label="Para:" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                            <option value="">Seleccionar miembro...</option>
                            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </Select>
                    )}
                    {composeForm.type === 'group' && (
                        <Select label="Grupo:" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                            <option value="">Seleccionar ministerio...</option>
                            {['Alabanza', 'Ujieres', 'Jóvenes', 'Escuela Bíblica', 'Evangelismo', 'Matrimonios', 'Hombres', 'Mujeres'].map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </Select>
                    )}
                    {composeForm.type === 'broadcast' && (
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center gap-3 text-orange-700">
                            <Icon name="Bell" size={24}/>
                            <p className="text-xs font-bold">Este mensaje se enviará a TODOS los miembros de la iglesia.</p>
                        </div>
                    )}

                    {/* Contenido */}
                    <div>
                        <textarea className="input-modern h-32 resize-none" placeholder="Escribe tu mensaje aquí..." value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}></textarea>
                    </div>

                    {/* Adjuntos */}
                    <div className="flex gap-2">
                        <label className={`flex-1 p-3 rounded-xl border border-dashed border-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-slate-50 ${composeForm.attachmentUrl ? 'bg-green-50 border-green-300 text-green-700' : 'text-slate-500'}`}>
                            <Icon name="Image" size={18}/> {isUploading ? 'Subiendo...' : (composeForm.attachmentUrl ? 'Imagen Lista' : 'Adjuntar Imagen')}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImage} disabled={isUploading}/>
                        </label>
                        {canBroadcast && (
                            <div onClick={()=>setComposeForm(p=>({...p, isPinned:!p.isPinned}))} className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-colors ${composeForm.isPinned?'bg-yellow-50 border-yellow-300 text-yellow-700':'bg-white border-slate-200 text-slate-500'}`}>
                                <Icon name="Bell" size={18}/> Fijar Aviso
                            </div>
                        )}
                    </div>

                    <Button className="w-full py-4 text-base" onClick={handleSend} disabled={isUploading}>
                        Enviar Mensaje <Icon name="Send" size={18} className="ml-2"/>
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
