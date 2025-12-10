window.Views = window.Views || {};

window.Views.Messaging = ({ userProfile }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const Utils = window.Utils || {};
    const { Button, Input, Select, Icon, formatDate, compressImage, Modal } = Utils;

    // --- ESTADOS ---
    const [allMessages, setAllMessages] = useState([]); // Todos los mensajes crudos
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]); 
    
    // Estado de Navegación
    const [selectedChannelId, setSelectedChannelId] = useState(null); // ID del canal seleccionado (ej: 'all', 'user_123')
    
    // Modales y Formularios
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [imageModal, setImageModal] = useState(null);
    const [viewersModal, setViewersModal] = useState(null); 

    // Formulario Nuevo Mensaje (Modal)
    const [composeForm, setComposeForm] = useState({ 
        to: '', context: 'individual', type: 'text', content: '', 
        isPinned: false, attachmentUrl: '', pollOptions: ['', ''], linkUrl: ''
    });
    
    const [newGroupForm, setNewGroupForm] = useState({ name: '', members: [] });
    
    // Input rápido del chat (Bottom bar)
    const [quickText, setQuickText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);
    const canBroadcast = ['Pastor', 'Líder'].includes(userProfile.role);

    // --- CONEXIÓN FIREBASE ---
    useEffect(() => {
        if (!window.db) return;
        const unsubMsg = window.db.collection('messages').orderBy('date', 'desc').limit(200).onSnapshot(snap => {
            setAllMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubMem = window.db.collection('members').onSnapshot(snap => {
            setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubGroups = window.db.collection('groups').onSnapshot(snap => {
            setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => { unsubMsg(); unsubMem(); unsubGroups(); };
    }, []);

    // Scroll al fondo al cambiar de canal o recibir mensajes
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [selectedChannelId, allMessages]);

    // --- LÓGICA DE AGRUPACIÓN (EL CAMBIO CLAVE) ---
    const conversations = useMemo(() => {
        const groupsMap = {};

        allMessages.forEach(msg => {
            let channelId = '';
            let title = '';
            let avatarIcon = 'MessageCircle';
            let avatarColor = 'bg-slate-100 text-slate-600';
            
            // 1. Identificar Canal
            if (msg.to === 'all') {
                channelId = 'all';
                title = '📢 Difusión General';
                avatarIcon = 'Megaphone';
                avatarColor = 'bg-orange-100 text-orange-600';
            } else if (msg.to.startsWith('group:')) {
                channelId = msg.to;
                title = `👥 ${msg.to.split(':')[1]}`;
                avatarIcon = 'Users';
                avatarColor = 'bg-blue-100 text-blue-600';
            } else if (msg.to.startsWith('custom:')) {
                channelId = msg.to;
                const gName = groups.find(g => g.id === msg.to.split(':')[1])?.name || 'Grupo';
                title = `🛡️ ${gName}`;
                avatarIcon = 'Shield';
                avatarColor = 'bg-purple-100 text-purple-600';
            } else {
                // Mensaje Directo (DM)
                // El ID del canal es la combinación de los dos IDs ordenados para que sea único entre A y B
                const participants = [msg.from, msg.to].sort();
                channelId = `dm:${participants.join('_')}`;
                
                // Determinar nombre a mostrar
                const otherId = msg.from === userProfile.id ? msg.to : msg.from;
                const otherMember = members.find(m => m.id === otherId);
                title = otherMember ? otherMember.name : 'Usuario';
                avatarIcon = 'User';
            }

            // Filtro de Seguridad: Solo mostrar si tengo permiso
            let hasAccess = false;
            if (msg.to === 'all') hasAccess = true;
            else if (msg.to.startsWith('group:')) {
                const gName = msg.to.split(':')[1];
                if (userProfile.role === 'Pastor' || userProfile.ministry === gName || msg.from === userProfile.id) hasAccess = true;
            } else if (msg.to.startsWith('custom:')) {
                const gId = msg.to.split(':')[1];
                const grp = groups.find(g => g.id === gId);
                if (grp && (grp.members.includes(userProfile.id) || msg.from === userProfile.id)) hasAccess = true;
            } else {
                if (msg.from === userProfile.id || msg.to === userProfile.id) hasAccess = true;
            }

            if (hasAccess) {
                if (!groupsMap[channelId]) {
                    groupsMap[channelId] = {
                        id: channelId,
                        title,
                        icon: avatarIcon,
                        color: avatarColor,
                        messages: [],
                        lastDate: msg.date,
                        unreadCount: 0,
                        // Guardamos datos raw para usar al enviar
                        rawTo: msg.to 
                    };
                }
                groupsMap[channelId].messages.push(msg);
                // Actualizar fecha si este mensaje es mas nuevo
                if (new Date(msg.date) > new Date(groupsMap[channelId].lastDate)) {
                    groupsMap[channelId].lastDate = msg.date;
                }
                // Contar no leídos
                if (!msg.readBy?.includes(userProfile.id)) {
                    groupsMap[channelId].unreadCount++;
                }
            }
        });

        // Ordenar canales por fecha del último mensaje
        return Object.values(groupsMap).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
    }, [allMessages, userProfile, members, groups]);

    // Mensajes del canal activo (ordenados cronológicamente para el chat)
    const activeMessages = useMemo(() => {
        if (!selectedChannelId) return [];
        const channel = conversations.find(c => c.id === selectedChannelId);
        return channel ? channel.messages.sort((a,b) => new Date(a.date) - new Date(b.date)) : [];
    }, [selectedChannelId, conversations]);

    // --- ACCIONES ---

    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const base64 = await compressImage(file);
            setComposeForm(p => ({ ...p, attachmentUrl: base64 }));
        } catch(err) { console.error(err); Utils.notify("Error imagen", "error"); }
        setIsUploading(false);
    };

    // Marcar mensajes como leídos al entrar al canal
    useEffect(() => {
        if (selectedChannelId && activeMessages.length > 0) {
            const unread = activeMessages.filter(m => !m.readBy?.includes(userProfile.id));
            unread.forEach(m => {
                window.db.collection('messages').doc(m.id).update({
                    readBy: firebase.firestore.FieldValue.arrayUnion(userProfile.id)
                });
            });
        }
    }, [selectedChannelId, activeMessages.length]);

    const handleSendQuick = async () => {
        if (!quickText.trim()) return;
        
        // Determinar destinatario basado en el canal actual
        const channel = conversations.find(c => c.id === selectedChannelId);
        if (!channel) return;

        let to = channel.rawTo;
        // Si es DM, hay que averiguar el ID del otro
        if (selectedChannelId.startsWith('dm:')) {
            const ids = selectedChannelId.split(':')[1].split('_');
            to = ids.find(id => id !== userProfile.id);
        }

        const newMessage = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: to,
            type: 'text',
            content: quickText,
            date: new Date().toISOString(),
            readBy: [userProfile.id],
            replies: [],
            reactions: {}
        };

        try {
            await window.db.collection('messages').add(newMessage);
            setQuickText('');
        } catch(e) { console.error(e); }
    };

    const handleSendForm = async () => {
        if (composeForm.type === 'text' && !composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Falta contenido", "error");
        
        let recipient = composeForm.to;
        if (composeForm.context === 'group') recipient = `group:${composeForm.to}`;
        if (composeForm.context === 'custom_group') recipient = `custom:${composeForm.to}`;
        if (composeForm.context === 'broadcast') recipient = 'all';

        const newMessage = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: recipient,
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
            setComposeForm({ to: '', context: 'individual', type: 'text', content: '', isPinned: false, attachmentUrl: '', pollOptions: ['', ''], linkUrl: '' });
            Utils.notify("Enviado");
        } catch(e) { console.error(e); }
    };

    const handleReaction = async (msgId, emoji) => {
        const msg = allMessages.find(m => m.id === msgId);
        if (!msg) return;
        const currentReactions = msg.reactions || {};
        if (currentReactions[userProfile.id] === emoji) delete currentReactions[userProfile.id];
        else currentReactions[userProfile.id] = emoji;
        await window.db.collection('messages').doc(msgId).update({ reactions: currentReactions });
    };

    const handleVote = async (msgId, optionIndex) => {
        const msg = allMessages.find(m => m.id === msgId);
        if (!msg) return;
        const newOptions = [...msg.pollOptions];
        // Voto único: quitar voto anterior
        newOptions.forEach(op => {
            if (op.votes?.includes(userProfile.id)) op.votes = op.votes.filter(id => id !== userProfile.id);
        });
        // Agregar nuevo voto
        newOptions[optionIndex].votes = [...(newOptions[optionIndex].votes || []), userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ pollOptions: newOptions });
    };

    const handleReplyInternal = async (msgId, text) => {
        if (!text.trim()) return;
        const reply = {
            id: Date.now(),
            from: userProfile.id,
            fromName: userProfile.name,
            content: text,
            date: new Date().toISOString()
        };
        try {
            await window.db.collection('messages').doc(msgId).update({
                replies: firebase.firestore.FieldValue.arrayUnion(reply)
            });
        } catch(e) { console.error(e); }
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

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar mensaje?")) await window.db.collection('messages').doc(id).delete();
    };

    const handlePin = async (msg) => {
        if (userProfile.role !== 'Pastor') return;
        await window.db.collection('messages').doc(msg.id).update({ isPinned: !msg.isPinned });
    };

    // --- SUB-COMPONENTES ---
    const MessageCard = ({ msg }) => {
        const [internalReply, setInternalReply] = useState('');
        const isMe = msg.from === userProfile.id;
        
        return (
            <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4`}>
                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm relative transition-all ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                    
                    {/* Header Mensaje */}
                    {!isMe && <p className="text-xs font-bold mb-1 opacity-70 flex justify-between">
                        {msg.fromName}
                        {msg.isPinned && <Icon name="Bell" size={12} className="text-yellow-500 fill-current"/>}
                    </p>}
                    
                    {/* Contenido */}
                    {msg.attachmentUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden cursor-pointer bg-black/10" onClick={()=>setImageModal(msg.attachmentUrl)}>
                            <img src={msg.attachmentUrl} className="max-w-full max-h-60 object-cover" />
                        </div>
                    )}
                    
                    {msg.type === 'text' && <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>}
                    
                    {msg.type === 'link' && (
                        <div className="bg-black/10 p-3 rounded-lg flex items-center gap-3 mt-1">
                            <div className="bg-white p-2 rounded-full text-black"><Icon name="Link" size={16}/></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold opacity-80 mb-0.5">{msg.content || 'Enlace'}</p>
                                <a href={msg.linkUrl} target="_blank" className="text-xs underline truncate block hover:opacity-80">{msg.linkUrl}</a>
                            </div>
                        </div>
                    )}

                    {msg.type === 'poll' && (
                        <div className="mt-2 space-y-2 min-w-[200px]">
                            <p className="font-bold text-sm mb-2">{msg.content}</p>
                            {msg.pollOptions.map((opt, idx) => {
                                const votes = opt.votes?.length || 0;
                                const isVoted = opt.votes?.includes(userProfile.id);
                                const totalVotes = msg.pollOptions.reduce((acc, o) => acc + (o.votes?.length||0), 0);
                                const percent = totalVotes > 0 ? Math.round((votes/totalVotes)*100) : 0;
                                return (
                                    <div key={idx} onClick={()=>handleVote(msg.id, idx)} className={`relative p-2 rounded-lg border cursor-pointer overflow-hidden ${isVoted ? (isMe?'bg-white/20 border-white':'bg-brand-50 border-brand-300') : 'bg-black/5 border-transparent'}`}>
                                        <div className="absolute left-0 top-0 bottom-0 bg-black/10 transition-all duration-500" style={{width: `${percent}%`}}></div>
                                        <div className="relative flex justify-between items-center z-10">
                                            <span className="text-xs font-medium">{opt.text}</span>
                                            <span className="text-[10px] font-bold">{percent}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer Info */}
                    <div className="flex justify-between items-end mt-2 pt-1 border-t border-black/10 gap-4">
                        <div className="flex gap-1">
                            {Object.entries(msg.reactions || {}).length > 0 && (
                                <div className="flex -space-x-1 bg-white rounded-full px-1.5 py-0.5 shadow-sm items-center cursor-pointer text-slate-800">
                                    {Object.entries(msg.reactions).slice(0,3).map(([uid, emoji], i) => <span key={i} className="text-xs">{emoji}</span>)}
                                    <span className="text-[9px] text-slate-500 ml-1">{Object.keys(msg.reactions).length}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 opacity-70 text-[10px]">
                            <span>{formatDate(msg.date).split(',')[1]}</span>
                            {isMe && <Icon name="Eye" size={10} className="cursor-pointer" onClick={()=>setViewersModal(msg)}/>}
                        </div>
                    </div>

                    {/* Acciones Hover */}
                    <div className={`absolute -top-3 ${isMe?'left-0':'right-0'} bg-white shadow-lg rounded-full px-2 py-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100 text-slate-800 z-20`}>
                        {['👍','❤️','🙏','🔥','👏'].map(em => (
                            <button key={em} onClick={()=>handleReaction(msg.id, em)} className="hover:scale-125 transition-transform">{em}</button>
                        ))}
                        {(canBroadcast || isMe) && <button onClick={()=>handleDelete(msg.id)} className="text-red-500 hover:bg-red-50 rounded-full px-1"><Icon name="Trash" size={12}/></button>}
                        {canBroadcast && <button onClick={()=>handlePin(msg)} className="text-yellow-500 hover:bg-yellow-50 rounded-full px-1"><Icon name="Bell" size={12}/></button>}
                    </div>

                    {/* Hilo de Respuestas */}
                    {(msg.replies && msg.replies.length > 0) && (
                        <div className={`mt-3 pt-2 border-t ${isMe?'border-white/20':'border-slate-100'} space-y-2`}>
                            {msg.replies.map((reply, rid) => (
                                <div key={rid} className={`text-xs p-2 rounded-lg ${isMe?'bg-white/10':'bg-slate-50'}`}>
                                    <span className="font-bold opacity-80 block mb-0.5">{reply.fromName}</span>
                                    {reply.content}
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Input Respuesta Rápida */}
                    <div className="mt-2 flex gap-1">
                        <input className={`w-full text-xs bg-transparent border-b ${isMe?'border-white/30 placeholder-white/50':'border-slate-200 placeholder-slate-400'} outline-none py-1`} 
                            placeholder="Responder..." 
                            value={internalReply} 
                            onChange={e=>setInternalReply(e.target.value)}
                            onKeyPress={e=>e.key==='Enter' && (handleReplyInternal(msg.id, internalReply), setInternalReply(''))}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            <div className="flex justify-between items-center flex-shrink-0">
                <h2 className="text-2xl font-extrabold text-slate-800">Centro de Mensajes</h2>
                <div className="flex gap-2">
                    <Button variant="secondary" icon="Users" onClick={()=>setIsGroupModalOpen(true)}>Grupos</Button>
                    <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Redactar</Button>
                </div>
            </div>

            <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200">
                
                {/* 1. SIDEBAR (CANALES) */}
                <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChannelId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 bg-white"><Input placeholder="Buscar chat..." className="py-2 text-sm" /></div>
                    <div className="flex-1 overflow-y-auto">
                        {conversations.map(chat => (
                            <div key={chat.id} onClick={()=>setSelectedChannelId(chat.id)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white transition-all ${selectedChannelId===chat.id ? 'bg-white border-l-4 border-l-brand-500 shadow-sm' : 'border-l-4 border-l-transparent'}`}>
                                <div className="flex justify-between mb-1">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${chat.color}`}>
                                            <Icon name={chat.icon} size={18}/>
                                        </div>
                                        <div className="overflow-hidden">
                                            <h4 className="font-bold text-sm text-slate-800 truncate">{chat.title}</h4>
                                            <p className="text-xs text-slate-500 truncate">
                                                {chat.messages[chat.messages.length-1]?.content || 'Imagen adjunta'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] text-slate-400">{formatDate(chat.lastDate).split(',')[0]}</span>
                                        {chat.unreadCount > 0 && <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chat.unreadCount}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {conversations.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">No hay conversaciones.</div>}
                    </div>
                </div>

                {/* 2. CHAT FEED (CANAL UNIFICADO) */}
                <div className={`flex-1 flex flex-col bg-[#eef2f6] relative ${selectedChannelId ? 'flex' : 'hidden md:flex'}`}>
                    {selectedChannelId ? (
                        <>
                            <div className={`p-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10 bg-white`}>
                                <div className="flex items-center gap-3">
                                    <button onClick={()=>setSelectedChannelId(null)} className="md:hidden text-slate-500"><Icon name="ChevronLeft"/></button>
                                    <h3 className="font-bold text-slate-800">{conversations.find(c=>c.id===selectedChannelId)?.title}</h3>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-6 overflow-y-auto" ref={scrollRef}>
                                {activeMessages.map(msg => <MessageCard key={msg.id} msg={msg} />)}
                            </div>

                            <div className="p-4 bg-white border-t border-slate-200">
                                <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-200 transition-all">
                                    <input className="flex-1 bg-transparent px-2 text-sm outline-none text-slate-700 placeholder:text-slate-400" placeholder="Mensaje rápido al canal..." value={quickText} onChange={e => setQuickText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendQuick()} />
                                    <button onClick={handleSendQuick} className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"><Icon name="Send" size={16}/></button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                            <Icon name="MessageCircle" size={64}/>
                            <p className="mt-4 font-bold">Selecciona una conversación</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALES */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl">{['text','poll','link'].map(t=><button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-1 text-xs font-bold rounded-lg ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t.toUpperCase()}</button>)}</div>
                    <div className="grid grid-cols-2 gap-3"><Select label="Tipo" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}><option value="individual">Privado</option><option value="group">Ministerio</option><option value="custom_group">Grupo</option>{canBroadcast&&<option value="broadcast">DIFUSIÓN</option>}</Select>{composeForm.context==='individual'&&<Select label="Para" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select>}{composeForm.context==='group'&&<Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{['Alabanza','Jóvenes','Escuela Bíblica'].map(g=><option key={g} value={g}>{g}</option>)}</Select>}</div>
                    {composeForm.type==='text'&&<><textarea className="input-modern h-32" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/><div className="flex gap-2"><label className="flex-1 p-2 border rounded cursor-pointer text-xs flex items-center justify-center gap-1"><Icon name="Image"/> Adjuntar<input type="file" className="hidden" onChange={handleImage}/></label>{canBroadcast&&<button onClick={()=>setComposeForm(p=>({...p, isPinned:!p.isPinned}))} className={`flex-1 border rounded text-xs ${composeForm.isPinned?'bg-yellow-50 text-yellow-600':'text-slate-500'}`}>Fijar</button>}</div></>}
                    {composeForm.type==='poll'&&<div className="space-y-2 bg-slate-50 p-3 rounded border"><Input label="Pregunta" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>{composeForm.pollOptions.map((opt,i)=><div key={i} className="flex gap-2"><input className="input-modern py-1" value={opt} onChange={e=>{const n=[...composeForm.pollOptions];n[i]=e.target.value;setComposeForm({...composeForm, pollOptions:n})}}/></div>)}<Button size="sm" variant="secondary" onClick={()=>setComposeForm({...composeForm, pollOptions:[...composeForm.pollOptions, '']})}>+ Opción</Button></div>}
                    <Button className="w-full" onClick={handleSendForm}>Enviar</Button>
                </div>
            </Modal>
            
            <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Nuevo Grupo"><div className="space-y-4"><Input label="Nombre" value={newGroupForm.name} onChange={e=>setNewGroupForm({...newGroupForm, name:e.target.value})}/><div className="max-h-40 overflow-y-auto border p-2 rounded">{members.map(m=><div key={m.id} onClick={()=>{const e=newGroupForm.members.includes(m.id);setNewGroupForm({...newGroupForm, members:e?newGroupForm.members.filter(x=>x!==m.id):[...newGroupForm.members,m.id]})}} className={`p-2 cursor-pointer flex justify-between ${newGroupForm.members.includes(m.id)?'bg-brand-50 text-brand-700':''}`}><span>{m.name}</span>{newGroupForm.members.includes(m.id)&&<Icon name="Check" size={14}/>}</div>)}</div><Button className="w-full" onClick={handleCreateGroup}>Crear</Button></div></Modal>
            <Modal isOpen={!!imageModal} onClose={()=>setImageModal(null)} title="Vista Previa"><div className="text-center"><img src={imageModal} className="max-h-[60vh] mx-auto rounded shadow"/><br/><a href={imageModal} download="imagen.jpg" className="inline-block bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-bold">Descargar</a></div></Modal>
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Visto por"><div className="max-h-60 overflow-y-auto space-y-2">{viewersModal?.readBy?.map((uid,i)=><div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded"><div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold">{members.find(m=>m.id===uid)?.name.charAt(0)}</div><span className="text-sm">{members.find(m=>m.id===uid)?.name||'Usuario'}</span></div>)}</div></Modal>
        </div>
    );
};
