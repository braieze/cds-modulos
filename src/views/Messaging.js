window.Views = window.Views || {};

window.Views.Messaging = ({ userProfile }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const Utils = window.Utils || {};
    const { Button, Input, Select, Icon, formatDate, compressImage, Modal } = Utils;

    // --- ESTADOS ---
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]); 
    const [selectedChat, setSelectedChat] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [imageModal, setImageModal] = useState(null);
    const [viewersModal, setViewersModal] = useState(null); 

    // Formularios
    const [composeForm, setComposeForm] = useState({ 
        to: '', 
        context: 'individual', 
        type: 'text', 
        content: '', 
        isPinned: false, 
        attachmentUrl: '',
        pollOptions: ['', ''],
        linkUrl: ''
    });
    
    const [newGroupForm, setNewGroupForm] = useState({ name: '', members: [] });
    const [replyText, setReplyText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);

    // Permisos
    const canBroadcast = ['Pastor', 'Líder'].includes(userProfile.role);

    // --- CONEXIÓN FIREBASE ---
    useEffect(() => {
        if (!window.db) return;

        // 1. Mensajes
        const unsubMsg = window.db.collection('messages').orderBy('date', 'desc').limit(150).onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(data);
        });

        // 2. Miembros
        const unsubMem = window.db.collection('members').onSnapshot(snap => {
            setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 3. Grupos Personalizados
        const unsubGroups = window.db.collection('groups').onSnapshot(snap => {
            setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubMsg(); unsubMem(); unsubGroups(); };
    }, []);

    // Scroll automático
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [selectedChat, messages]);

    // --- LÓGICA DE FILTRADO ---
    const myChats = useMemo(() => {
        const relevant = messages.filter(m => {
            if (m.to === 'all') return true; 
            if (m.to === userProfile.id || m.from === userProfile.id) return true; 
            if (m.to.startsWith('group:')) { 
                const gName = m.to.split(':')[1];
                return userProfile.role === 'Pastor' || userProfile.ministry === gName || m.from === userProfile.id;
            }
            if (m.to.startsWith('custom:')) { 
                const gId = m.to.split(':')[1];
                const group = groups.find(g => g.id === gId);
                return group && (group.members.includes(userProfile.id) || m.from === userProfile.id);
            }
            return false;
        });
        return relevant;
    }, [messages, userProfile, groups]);

    // --- ACCIONES (CORREGIDAS) ---

    // 1. Subir Imagen (LA QUE FALTABA)
    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const base64 = await compressImage(file);
            setComposeForm(p => ({ ...p, attachmentUrl: base64 }));
        } catch(err) { 
            console.error(err);
            Utils.notify("Error al subir imagen", "error"); 
        } finally {
            setIsUploading(false);
        }
    };

    // 2. Marcar como leído (LA OTRA QUE FALTABA)
    const markAsRead = async (msg) => {
        if (!msg || !window.db) return;
        if (!msg.readBy?.includes(userProfile.id)) {
            try {
                // Usamos arrayUnion para agregar el ID sin borrar los anteriores
                await window.db.collection('messages').doc(msg.id).update({
                    readBy: firebase.firestore.FieldValue.arrayUnion(userProfile.id)
                });
            } catch (e) { console.error("Error al marcar leído", e); }
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupForm.name || newGroupForm.members.length === 0) return Utils.notify("Faltan datos", "error");
        try {
            const finalMembers = [...new Set([...newGroupForm.members, userProfile.id])];
            await window.db.collection('groups').add({
                name: newGroupForm.name,
                members: finalMembers,
                createdBy: userProfile.name,
                createdAt: new Date().toISOString()
            });
            setIsGroupModalOpen(false);
            setNewGroupForm({ name: '', members: [] });
            Utils.notify("Grupo creado");
        } catch (e) { console.error(e); }
    };

    const handleSend = async () => {
        if (composeForm.type === 'text' && !composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Escribe algo", "error");
        
        let recipient = composeForm.to;
        if (composeForm.context === 'group') recipient = `group:${composeForm.to}`;
        if (composeForm.context === 'custom_group') recipient = `custom:${composeForm.to}`;
        if (composeForm.context === 'broadcast') recipient = 'all';

        const newMessage = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: recipient,
            contextType: composeForm.context,
            type: composeForm.type, 
            content: composeForm.content,
            isPinned: composeForm.isPinned,
            attachmentUrl: composeForm.attachmentUrl,
            linkUrl: composeForm.linkUrl,
            pollOptions: composeForm.type === 'poll' ? composeForm.pollOptions.map(o => ({ text: o, votes: [] })) : [],
            date: new Date().toISOString(),
            readBy: [userProfile.id],
            reactions: {},
            replies: [] 
        };

        try {
            await window.db.collection('messages').add(newMessage);
            setIsComposeOpen(false);
            setComposeForm({ 
                to: '', context: 'individual', type: 'text', content: '', 
                isPinned: false, attachmentUrl: '', pollOptions: ['', ''], linkUrl: '' 
            });
            Utils.notify("Enviado");
        } catch(e) { console.error(e); }
    };

    const handleReaction = async (msgId, emoji) => {
        if (!msgId) return;
        const msg = messages.find(m => m.id === msgId);
        const currentReactions = msg.reactions || {};
        
        if (currentReactions[userProfile.id] === emoji) delete currentReactions[userProfile.id];
        else currentReactions[userProfile.id] = emoji;

        await window.db.collection('messages').doc(msgId).update({ reactions: currentReactions });
    };

    const handleVote = async (msgId, optionIndex) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        
        const newOptions = [...msg.pollOptions];
        const currentVotes = newOptions[optionIndex].votes || [];
        
        newOptions.forEach(op => {
            if (op.votes?.includes(userProfile.id)) {
                op.votes = op.votes.filter(id => id !== userProfile.id);
            }
        });

        if (!currentVotes.includes(userProfile.id)) {
            newOptions[optionIndex].votes = [...(newOptions[optionIndex].votes || []), userProfile.id];
        }

        await window.db.collection('messages').doc(msgId).update({ pollOptions: newOptions });
    };

    const handlePin = async (msg) => {
        if (userProfile.role !== 'Pastor') return;
        await window.db.collection('messages').doc(msg.id).update({ isPinned: !msg.isPinned });
        Utils.notify(msg.isPinned ? "Mensaje desfijado" : "Mensaje fijado");
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
            await window.db.collection('messages').doc(selectedChat.id).update({
                replies: firebase.firestore.FieldValue.arrayUnion(reply),
                readBy: firebase.firestore.FieldValue.arrayUnion(userProfile.id)
            });
            setReplyText("");
            // Update local rápido para que se sienta instantáneo
            setSelectedChat(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
        } catch(e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar conversación?")) {
            await window.db.collection('messages').doc(id).delete();
            setSelectedChat(null);
            Utils.notify("Eliminado");
        }
    };

    // --- RENDER HELPERS ---
    const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';
    const getAvatarColor = (name) => {
        const colors = ['bg-red-100 text-red-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-yellow-100 text-yellow-600', 'bg-purple-100 text-purple-600'];
        return colors[(name?.length || 0) % colors.length];
    };

    const getChatTitle = (msg) => {
        if (msg.to === 'all') return '📢 Difusión General';
        if (msg.to.startsWith('group:')) return `👥 Ministerio: ${msg.to.split(':')[1]}`;
        if (msg.to.startsWith('custom:')) {
            const g = groups.find(grp => grp.id === msg.to.split(':')[1]);
            return { title: `🛡️ ${g ? g.name : 'Grupo'}`, icon: 'Shield', color: 'bg-purple-100 text-purple-600' };
        }
        const otherName = msg.from === userProfile.id 
            ? (members.find(m => m.id === msg.to)?.name || 'Usuario') 
            : msg.fromName;
        return { title: otherName, icon: 'User', color: 'bg-slate-100 text-slate-600' };
    };
    
    const getChatInfo = (msg) => {
        if (msg.to === 'all') return { title: '📢 Difusión General', icon: 'Megaphone', color: 'bg-orange-100 text-orange-600', isBroadcast: true };
        if (msg.to.startsWith('group:')) return { title: `👥 ${msg.to.split(':')[1]}`, icon: 'Users', color: 'bg-blue-100 text-blue-600' };
        if (msg.to.startsWith('custom:')) {
            const g = groups.find(grp => grp.id === msg.to.split(':')[1]);
            return { title: `🛡️ ${g ? g.name : 'Grupo'}`, icon: 'Shield', color: 'bg-purple-100 text-purple-600' };
        }
        const otherName = msg.from === userProfile.id 
            ? (members.find(m => m.id === msg.to)?.name || 'Usuario') 
            : msg.fromName;
        return { title: otherName, icon: 'User', color: 'bg-slate-100 text-slate-600' };
    };

    const getMemberName = (id) => members.find(m => m.id === id)?.name || 'Desconocido';

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            <div className="flex justify-between items-center flex-shrink-0">
                <h2 className="text-2xl font-extrabold text-slate-800">Centro de Mensajes</h2>
                <div className="flex gap-2">
                    <Button variant="secondary" icon="Users" onClick={()=>setIsGroupModalOpen(true)}>Crear Grupo</Button>
                    <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Redactar</Button>
                </div>
            </div>

            <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200">
                
                {/* LISTA DE CHATS */}
                <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <Input placeholder="Buscar..." className="py-2 text-sm" />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {myChats.map(msg => {
                            const info = getChatInfo(msg);
                            const isUnread = !msg.readBy?.includes(userProfile.id);
                            return (
                                <div key={msg.id} onClick={()=>{setSelectedChat(msg); markAsRead(msg);}} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white transition-all ${selectedChat?.id===msg.id ? 'bg-white border-l-4 border-l-brand-500 shadow-sm' : 'border-l-4 border-l-transparent'} ${info.isBroadcast ? 'bg-orange-50/50' : ''}`}>
                                    <div className="flex justify-between mb-1">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${info.color}`}>
                                                <Icon name={info.icon} size={14}/>
                                            </div>
                                            <span className={`text-sm truncate ${isUnread ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{info.title}</span>
                                        </div>
                                        {msg.isPinned && <Icon name="Bell" size={12} className="text-yellow-500 fill-current"/>}
                                    </div>
                                    <div className="flex justify-between items-center pl-10">
                                        <p className={`text-xs truncate max-w-[150px] ${isUnread ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                                            {msg.from === userProfile.id && "Tú: "}
                                            {msg.type === 'poll' ? '📊 Encuesta' : (msg.type === 'link' ? '🔗 Enlace' : (msg.content || 'Adjunto'))}
                                        </p>
                                        <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* VISTA DE CHAT */}
                <div className={`flex-1 flex flex-col bg-[#eef2f6] relative ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                    {selectedChat ? (
                        <>
                            {/* Header Chat */}
                            <div className={`p-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10 ${selectedChat.to === 'all' ? 'bg-orange-50' : 'bg-white'}`}>
                                <div className="flex items-center gap-3">
                                    <button onClick={()=>setSelectedChat(null)} className="md:hidden text-slate-500"><Icon name="ChevronLeft"/></button>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${getChatInfo(selectedChat).color}`}>
                                        <Icon name={getChatInfo(selectedChat).icon} size={20}/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 leading-tight">{getChatInfo(selectedChat).title}</h3>
                                        {selectedChat.to === 'all' && <span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-bold">DIFUSIÓN</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {canBroadcast && (
                                        <button onClick={()=>handlePin(selectedChat)} className={`p-2 rounded-full transition-colors ${selectedChat.isPinned ? 'text-yellow-500 bg-yellow-50' : 'text-slate-400 hover:bg-slate-100'}`} title={selectedChat.isPinned ? "Desfijar" : "Fijar"}>
                                            <Icon name="Bell" size={18} className={selectedChat.isPinned ? "fill-current" : ""}/>
                                        </button>
                                    )}
                                    {(userProfile.role==='Pastor' || selectedChat.from === userProfile.id) && (
                                        <button onClick={()=>{if(confirm('¿Eliminar?')) {deleteData('messages', selectedChat.id); setSelectedChat(null);}}} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"><Icon name="Trash" size={18}/></button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Mensajes Scroll */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-6" ref={scrollRef}>
                                {/* Mensaje Principal */}
                                <div className={`flex ${selectedChat.from === userProfile.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl shadow-sm relative group ${selectedChat.to === 'all' ? 'bg-white border-2 border-orange-200' : (selectedChat.from === userProfile.id ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none')}`}>
                                        
                                        <div className="p-4">
                                            {selectedChat.from !== userProfile.id && <p className="text-xs font-bold mb-1 opacity-70">{selectedChat.fromName}</p>}
                                            
                                            {selectedChat.attachmentUrl && (
                                                <div className="mb-2 rounded-lg overflow-hidden cursor-pointer" onClick={()=>setImageModal(selectedChat.attachmentUrl)}>
                                                    <img src={selectedChat.attachmentUrl} className="max-w-full max-h-60 object-cover" />
                                                </div>
                                            )}

                                            {selectedChat.type === 'text' && <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedChat.content}</p>}
                                            
                                            {selectedChat.type === 'link' && (
                                                <div className="bg-black/10 p-3 rounded-lg flex items-center gap-3 mt-1">
                                                    <div className="bg-white p-2 rounded-full text-black"><Icon name="Link" size={16}/></div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold opacity-80 mb-0.5">{selectedChat.content || 'Enlace Compartido'}</p>
                                                        <a href={selectedChat.linkUrl} target="_blank" className="text-xs underline truncate block hover:opacity-80">{selectedChat.linkUrl}</a>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedChat.type === 'poll' && (
                                                <div className="mt-1 space-y-2 min-w-[200px]">
                                                    <p className="font-bold text-sm mb-2">{selectedChat.content}</p>
                                                    {selectedChat.pollOptions.map((opt, idx) => {
                                                        const votes = opt.votes?.length || 0;
                                                        const isVoted = opt.votes?.includes(userProfile.id);
                                                        const totalVotes = selectedChat.pollOptions.reduce((acc, o) => acc + (o.votes?.length||0), 0);
                                                        const percent = totalVotes > 0 ? Math.round((votes/totalVotes)*100) : 0;
                                                        
                                                        return (
                                                            <div key={idx} onClick={()=>handleVote(selectedChat.id, idx)} className={`relative p-2 rounded-lg border cursor-pointer overflow-hidden ${isVoted ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                                                                <div className="absolute left-0 top-0 bottom-0 bg-black/10 transition-all duration-500" style={{width: `${percent}%`}}></div>
                                                                <div className="relative flex justify-between items-center z-10">
                                                                    <span className="text-xs font-medium">{opt.text}</span>
                                                                    <span className="text-[10px] font-bold">{percent}% ({votes})</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Footer Info */}
                                            <div className="flex justify-between items-end mt-2 pt-2 border-t border-black/10">
                                                <div className="flex gap-1">
                                                    {Object.entries(selectedChat.reactions || {}).length > 0 && (
                                                        <div className="flex -space-x-1 bg-white rounded-full px-1.5 py-0.5 shadow-sm items-center cursor-pointer" title="Ver reacciones">
                                                            {Object.entries(selectedChat.reactions).slice(0,3).map(([uid, emoji], i) => (
                                                                <span key={i} className="text-xs">{emoji}</span>
                                                            ))}
                                                            <span className="text-[9px] text-slate-500 ml-1">{Object.keys(selectedChat.reactions).length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-1.5 opacity-70 text-[10px]">
                                                    <span>{formatDate(selectedChat.date).split(',')[1]}</span>
                                                    {selectedChat.from === userProfile.id && (
                                                        <button onClick={()=>setViewersModal(selectedChat)} className="hover:text-white flex items-center gap-0.5">
                                                            <Icon name="Eye" size={10}/> 
                                                            <span>{selectedChat.readBy?.length || 0}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Menú Reacciones Hover */}
                                        <div className="absolute -top-3 right-4 bg-white shadow-lg rounded-full px-2 py-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100 duration-200">
                                            {['👍','❤️','🙏','🔥','👏'].map(em => (
                                                <button key={em} onClick={(e)=>{e.stopPropagation(); handleReaction(selectedChat.id, em)}} className="hover:scale-125 transition-transform">{em}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Respuestas */}
                                {(selectedChat.replies || []).map((reply, idx) => (
                                    <div key={idx} className={`flex ${reply.from === userProfile.id ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-xl p-3 shadow-sm text-sm relative ${reply.from === userProfile.id ? 'bg-blue-50 text-slate-800' : 'bg-white text-slate-800'}`}>
                                            <p className="text-[10px] font-bold text-slate-400 mb-0.5">{reply.fromName}</p>
                                            <p>{reply.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input */}
                            <div className="p-4 bg-white border-t border-slate-200">
                                <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-200 transition-all">
                                    <input 
                                        className="flex-1 bg-transparent px-2 text-sm outline-none text-slate-700 placeholder:text-slate-400" 
                                        placeholder="Escribe una respuesta..." 
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && handleReply()}
                                    />
                                    <button onClick={handleReply} className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"><Icon name="Send" size={16}/></button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                            <Icon name="MessageCircle" size={64}/>
                            <p className="mt-4 font-bold">Selecciona un chat</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL REDACTAR */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Nuevo Mensaje">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['text','poll','link'].map(t => (
                            <button key={t} onClick={()=>setComposeForm({...composeForm, type: t})} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${composeForm.type===t ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}>
                                {t==='text'?'Texto':(t==='poll'?'Encuesta':'Enlace')}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Tipo Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value, to:''})}>
                            <option value="individual">Persona</option>
                            <option value="group">Ministerio</option>
                            <option value="custom_group">Grupo Personalizado</option>
                            {canBroadcast && <option value="broadcast">DIFUSIÓN TOTAL</option>}
                        </Select>
                        
                        {composeForm.context === 'individual' && (
                            <Select label="Persona" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                                <option value="">Seleccionar...</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </Select>
                        )}
                        {composeForm.context === 'group' && (
                            <Select label="Ministerio" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                                <option value="">Seleccionar...</option>
                                {['Alabanza', 'Ujieres', 'Jóvenes', 'Escuela Bíblica', 'Evangelismo', 'Servidores'].map(g => <option key={g} value={g}>{g}</option>)}
                            </Select>
                        )}
                        {composeForm.context === 'custom_group' && (
                            <Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                                <option value="">Seleccionar...</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </Select>
                        )}
                    </div>

                    {composeForm.type === 'text' && (
                        <>
                            <textarea className="input-modern h-32" placeholder="Escribe aquí..." value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}></textarea>
                            <div className="flex gap-2">
                                <label className={`flex-1 p-3 border rounded-xl flex justify-center items-center gap-2 cursor-pointer ${composeForm.attachmentUrl ? 'bg-green-50 border-green-200 text-green-700' : 'border-slate-200 text-slate-500'}`}>
                                    <Icon name="Image" size={16}/> {isUploading ? '...' : (composeForm.attachmentUrl ? 'Foto Lista' : 'Adjuntar')}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImage} disabled={isUploading}/>
                                </label>
                                {canBroadcast && <button onClick={()=>setComposeForm(p=>({...p, isPinned:!p.isPinned}))} className={`flex-1 p-3 border rounded-xl flex justify-center items-center gap-2 ${composeForm.isPinned?'bg-yellow-50 border-yellow-200 text-yellow-600':'border-slate-200 text-slate-500'}`}><Icon name="Bell" size={16}/> Fijar</button>}
                            </div>
                        </>
                    )}

                    {composeForm.type === 'poll' && (
                        <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <Input label="Pregunta" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>
                            <label className="label-modern">Opciones</label>
                            {composeForm.pollOptions.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                    <input className="input-modern py-2" placeholder={`Opción ${i+1}`} value={opt} onChange={e=>{
                                        const newOpts = [...composeForm.pollOptions];
                                        newOpts[i] = e.target.value;
                                        setComposeForm({...composeForm, pollOptions: newOpts});
                                    }}/>
                                    {i > 1 && <button onClick={()=>{
                                        const newOpts = composeForm.pollOptions.filter((_, idx) => idx !== i);
                                        setComposeForm({...composeForm, pollOptions: newOpts});
                                    }} className="text-red-400"><Icon name="X"/></button>}
                                </div>
                            ))}
                            <Button variant="secondary" size="sm" onClick={()=>setComposeForm({...composeForm, pollOptions: [...composeForm.pollOptions, '']})}>+ Opción</Button>
                        </div>
                    )}

                    {composeForm.type === 'link' && (
                        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <Input label="Título del Link" placeholder="Ej. Reunión de Zoom" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>
                            <Input label="URL (https://...)" placeholder="https://meet.google.com/..." value={composeForm.linkUrl} onChange={e=>setComposeForm({...composeForm, linkUrl:e.target.value})}/>
                        </div>
                    )}

                    <Button className="w-full" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>

            {/* MODAL CREAR GRUPO */}
            <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Nuevo Grupo">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <Input label="Nombre del Grupo" value={newGroupForm.name} onChange={e=>setNewGroupForm({...newGroupForm, name:e.target.value})}/>
                    <div>
                        <label className="label-modern mb-2">Integrantes</label>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                            {members.map(m => (
                                <div key={m.id} onClick={()=>{
                                    const exists = newGroupForm.members.includes(m.id);
                                    setNewGroupForm({...newGroupForm, members: exists ? newGroupForm.members.filter(id=>id!==m.id) : [...newGroupForm.members, m.id]});
                                }} className={`p-2 rounded-lg cursor-pointer flex justify-between items-center text-sm ${newGroupForm.members.includes(m.id) ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'}`}>
                                    <span>{m.name}</span>
                                    {newGroupForm.members.includes(m.id) && <Icon name="Check" size={14}/>}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-right text-slate-400 mt-1">{newGroupForm.members.length} seleccionados</p>
                    </div>
                    <Button className="w-full" onClick={handleCreateGroup}>Crear Grupo</Button>
                </div>
            </Modal>

            {/* MODAL IMAGEN FULL */}
            <Modal isOpen={!!imageModal} onClose={()=>setImageModal(null)} title="Imagen">
                <div className="flex flex-col items-center gap-4">
                    <img src={imageModal} className="max-w-full max-h-[70vh] rounded-lg shadow-lg"/>
                    <a href={imageModal} download="imagen_conquistadores.jpg" className="bg-brand-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-brand-700 flex items-center gap-2">
                        <Icon name="Download"/> Descargar
                    </a>
                </div>
            </Modal>

            {/* MODAL VISTOS */}
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Visto por">
                <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                    {viewersModal?.readBy?.length > 0 ? (
                        viewersModal.readBy.map((uid, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
                                    {getInitials(getMemberName(uid))}
                                </div>
                                <span className="text-sm font-medium text-slate-700">{getMemberName(uid)}</span>
                            </div>
                        ))
                    ) : <p className="text-center text-slate-400 text-sm">Nadie lo ha visto aún.</p>}
                </div>
            </Modal>
        </div>
    );
};
