window.Views = window.Views || {};

window.Views.Messaging = ({ userProfile }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const Utils = window.Utils || {};
    const { Button, Input, Select, Icon, formatDate, compressImage, Modal, Badge } = Utils;

    // --- ESTADOS ---
    const [activeTab, setActiveTab] = useState('broadcast'); 
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);
    
    // UI
    const [selectedChat, setSelectedChat] = useState(null);
    const [selectedBroadcast, setSelectedBroadcast] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [imageModal, setImageModal] = useState(null);
    const [viewersModal, setViewersModal] = useState(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Highlight
    const [highlightId, setHighlightId] = useState(null);

    // Formularios
    const initialCompose = { 
        id: null, to: '', context: 'individual', type: 'text', category: 'General',
        content: '', body: '', 
        isPinned: false, allowReplies: true, 
        attachmentUrl: '', attachmentType: 'image', 
        pollOptions: ['', ''], linkUrl: ''
    };
    const [composeForm, setComposeForm] = useState(initialCompose);
    const [newGroupForm, setNewGroupForm] = useState({ name: '', members: [] });
    const [replyText, setReplyText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);
    const messageRefs = useRef({}); 
    // Pastor y Líder pueden borrar/editar todo. Servidor solo lo suyo.
    const isAdmin = ['Pastor', 'Líder'].includes(userProfile.role);

    // --- FIREBASE ---
    useEffect(() => {
        if (!window.db) return;
        
        // 1. Mensajes
        const unsubMsg = window.db.collection('messages').orderBy('date', 'desc').limit(300).onSnapshot(snap => {
            setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        // 2. Miembros
        const unsubMem = window.db.collection('members').onSnapshot(snap => {
            setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        // 3. Grupos
        const unsubGroups = window.db.collection('groups').onSnapshot(snap => {
            setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubMsg(); unsubMem(); unsubGroups(); };
    }, []);

    // Auto-scroll en chat
    useEffect(() => {
        if (scrollRef.current && !highlightId) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [selectedChat]);

    // Scroll a mensaje fijado
    useEffect(() => {
        if (highlightId && messageRefs.current[highlightId]) {
            messageRefs.current[highlightId].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setHighlightId(null), 2000);
        }
    }, [highlightId, selectedChat]);

    // --- HELPERS ---
    const getMemberName = (id) => {
        if (id === userProfile.id) return 'Tú';
        const m = members.find(x => x.id === id);
        return m ? m.name : 'Usuario';
    };

    // --- ACCIONES ---
    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const type = file.type.includes('pdf') ? 'pdf' : 'image';
            let base64 = "";
            if (type === 'pdf') {
                base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            } else {
                base64 = await compressImage(file);
            }
            setComposeForm(p => ({ ...p, attachmentUrl: base64, attachmentType: type }));
        } catch(err) { console.error(err); Utils.notify("Error adjunto", "error"); }
        finally { setIsUploading(false); }
    };

    const handleSend = async () => {
        if (!composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Falta contenido", "error");
        
        let recipient = composeForm.to;
        if (composeForm.context === 'group') recipient = `group:${composeForm.to}`;
        if (composeForm.context === 'custom_group') recipient = `custom:${composeForm.to}`;
        if (composeForm.context === 'broadcast') recipient = 'all';

        // Validaciones
        if (composeForm.context !== 'broadcast' && !composeForm.to) return Utils.notify("Selecciona destinatario", "error");

        const msgData = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: recipient,
            type: composeForm.type,
            category: composeForm.category,
            content: composeForm.content,
            body: composeForm.body,
            isPinned: composeForm.isPinned,
            allowReplies: composeForm.allowReplies,
            attachmentUrl: composeForm.attachmentUrl,
            attachmentType: composeForm.attachmentType || 'image',
            linkUrl: composeForm.linkUrl,
            pollOptions: composeForm.type === 'poll' ? composeForm.pollOptions.map(o => ({ text: o, votes: [] })) : [],
            // No sobrescribir fecha al editar si no es necesario
            ...(!composeForm.id && {
                date: new Date().toISOString(),
                readBy: [userProfile.id],
                replies: [],
                reactions: {},
                prayedBy: [] 
            })
        };

        try {
            if (composeForm.id) {
                await window.db.collection('messages').doc(composeForm.id).update(msgData);
                Utils.notify("Mensaje actualizado");
                // Cerrar modales de vista previa para ver cambios
                setSelectedBroadcast(null);
            } else {
                await window.db.collection('messages').add(msgData);
                Utils.notify("Enviado");
            }
            setIsComposeOpen(false);
            setComposeForm(initialCompose);
        } catch(e) { console.error(e); Utils.notify("Error al enviar", "error"); }
    };

    const handleEditMessage = (msg) => {
        let ctx = 'individual';
        let toVal = msg.to;
        if (msg.to === 'all') { ctx = 'broadcast'; }
        else if (msg.to.startsWith('group:')) { ctx = 'group'; toVal = msg.to.split(':')[1]; }
        else if (msg.to.startsWith('custom:')) { ctx = 'custom_group'; toVal = msg.to.split(':')[1]; }

        setComposeForm({
            id: msg.id,
            to: toVal,
            context: ctx,
            type: msg.type || 'text',
            category: msg.category || 'General',
            content: msg.content,
            body: msg.body || '',
            isPinned: msg.isPinned || false,
            allowReplies: msg.allowReplies !== false,
            attachmentUrl: msg.attachmentUrl || '',
            attachmentType: msg.attachmentType || 'image',
            linkUrl: msg.linkUrl || '',
            pollOptions: msg.pollOptions ? msg.pollOptions.map(o => o.text) : ['', '']
        });
        setIsComposeOpen(true);
    };

    const handleDelete = async (id, ownerId) => {
        // PERMISOS: Admin borra todo, usuario borra lo suyo
        if (isAdmin || ownerId === userProfile.id) {
            if(confirm("¿Eliminar mensaje permanentemente?")) {
                await window.db.collection('messages').doc(id).delete();
                if (selectedBroadcast?.id === id) setSelectedBroadcast(null);
                // No cerramos el chat completo si borras un mensaje, solo se actualiza
                Utils.notify("Eliminado");
            }
        } else {
            Utils.notify("No tienes permiso", "error");
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupForm.name || newGroupForm.members.length === 0) return Utils.notify("Faltan datos", "error");
        try {
            const finalMembers = [...new Set([...newGroupForm.members, userProfile.id])];
            const groupRef = await window.db.collection('groups').add({
                name: newGroupForm.name,
                members: finalMembers,
                createdBy: userProfile.name,
                createdAt: new Date().toISOString()
            });

            // Mensaje automático para que aparezca el chat
            await window.db.collection('messages').add({
                from: userProfile.id,
                fromName: 'Sistema',
                to: `custom:${groupRef.id}`,
                type: 'text',
                content: `Grupo "${newGroupForm.name}" creado`,
                body: 'Bienvenidos.',
                date: new Date().toISOString(),
                readBy: finalMembers,
                replies: [], reactions: {}
            });

            setIsGroupModalOpen(false);
            setNewGroupForm({ name: '', members: [] });
            setActiveTab('groups'); 
            Utils.notify("Grupo creado");
        } catch (e) { console.error(e); }
    };

    const handleReaction = async (msgId, emoji) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const current = msg.reactions || {};
        if (current[userProfile.id] === emoji) delete current[userProfile.id];
        else current[userProfile.id] = emoji;
        await window.db.collection('messages').doc(msgId).update({ reactions: current });
    };

    const handleBroadcastReply = async () => {
        if (!replyText.trim() || !selectedBroadcast) return;
        const reply = { id: Date.now(), from: userProfile.id, fromName: userProfile.name, content: replyText, date: new Date().toISOString() };
        await window.db.collection('messages').doc(selectedBroadcast.id).update({
            replies: firebase.firestore.FieldValue.arrayUnion(reply)
        });
        setReplyText("");
        setSelectedBroadcast(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
    };

    const handleChatReply = async () => {
        if (!replyText.trim() || !selectedChat) return;
        
        // En chats, enviamos mensaje nuevo al hilo
        const newMessage = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: selectedChat.id || selectedChat.chatId, 
            content: replyText,
            type: 'text',
            date: new Date().toISOString(),
            readBy: [userProfile.id],
            replies: [], reactions: {}
        };
        
        if (activeTab === 'direct') newMessage.to = selectedChat.id;

        try {
            await window.db.collection('messages').add(newMessage);
            setReplyText("");
        } catch(e) { console.error(e); }
    };

    const handleVote = async (msgId, idx) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const opts = [...msg.pollOptions];
        opts.forEach(op => { if (op.votes?.includes(userProfile.id)) op.votes = op.votes.filter(id => id !== userProfile.id); });
        opts[idx].votes = [...(opts[idx].votes || []), userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ pollOptions: opts });
    };

    const handlePray = async (msgId) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const prayed = msg.prayedBy || [];
        const newPrayed = prayed.includes(userProfile.id) ? prayed.filter(id => id !== userProfile.id) : [...prayed, userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ prayedBy: newPrayed });
    };
    
    const handlePin = async (msg) => {
        if (userProfile.role !== 'Pastor') return;
        await window.db.collection('messages').doc(msg.id).update({ isPinned: !msg.isPinned });
        Utils.notify(msg.isPinned ? "Desfijado" : "Fijado");
    };

    // --- FILTRADO ---
    const categorizedMessages = useMemo(() => {
        const matchesSearch = (msg) => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (msg.content||'').toLowerCase().includes(term) || (msg.body||'').toLowerCase().includes(term);
        };

        const broadcasts = [];
        const ministries = {};
        const customGroups = {};
        const directs = {}; 

        messages.forEach(msg => {
            if (!matchesSearch(msg)) return;

            if (msg.to === 'all') {
                broadcasts.push(msg);
                return;
            }
            if (msg.to.startsWith('group:')) {
                const gName = msg.to.split(':')[1];
                if (isAdmin || userProfile.ministry === gName || msg.from === userProfile.id) {
                    if (!ministries[msg.to]) ministries[msg.to] = { id: msg.to, title: gName, msgs: [] };
                    ministries[msg.to].msgs.push(msg);
                }
                return;
            }
            if (msg.to.startsWith('custom:')) {
                const gId = msg.to.split(':')[1];
                const grp = groups.find(g => g.id === gId);
                if ((grp && grp.members.includes(userProfile.id)) || msg.from === userProfile.id) {
                    const title = grp ? grp.name : 'Grupo';
                    if (!customGroups[msg.to]) customGroups[msg.to] = { id: msg.to, title: title, msgs: [] };
                    customGroups[msg.to].msgs.push(msg);
                }
                return;
            }
            if (msg.to === userProfile.id || msg.from === userProfile.id) {
                const otherId = msg.from === userProfile.id ? msg.to : msg.from;
                const chatId = [userProfile.id, otherId].sort().join('_');
                if (!directs[chatId]) {
                    const otherUser = members.find(m => m.id === otherId);
                    directs[chatId] = { id: otherId, chatId, title: otherUser ? otherUser.name : 'Usuario', msgs: [] };
                }
                directs[chatId].msgs.push(msg);
            }
        });

        const sortChats = (chats) => Object.values(chats).sort((a,b) => new Date(b.msgs[0]?.date) - new Date(a.msgs[0]?.date));
        return { broadcasts, ministries: sortChats(ministries), groups: sortChats(customGroups), directs: sortChats(directs) };
    }, [messages, userProfile, members, groups, searchTerm]);

    // --- ESTILOS DE PORTADA ---
    const getCoverStyle = (category) => {
        const styles = {
            'Urgente': 'from-red-500 to-rose-600',
            'Aviso': 'from-blue-500 to-cyan-500',
            'Reunión': 'from-purple-500 to-indigo-600',
            'Oración': 'from-amber-400 to-orange-500', 
            'Devocional': 'from-emerald-500 to-teal-600',
            'General': 'from-slate-600 to-slate-800'
        };
        return styles[category] || styles['General'];
    };
    
    const getCoverIcon = (category) => {
        const icons = { 'Urgente': 'AlertTriangle', 'Aviso': 'Bell', 'Reunión': 'Calendar', 'Devocional': 'Book', 'General': 'Megaphone', 'Oración': 'Smile' };
        return icons[category] || 'Megaphone';
    };

    // --- RENDER ---
    
    // VISTA DIFUSIÓN
    const renderBroadcastView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-enter p-1">
            {categorizedMessages.broadcasts.map(msg => (
                <div key={msg.id} onClick={() => setSelectedBroadcast(msg)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-xl transition-all hover:-translate-y-1 relative h-auto flex flex-col">
                    
                    <div className="h-32 relative overflow-hidden shrink-0">
                         {msg.attachmentUrl && msg.attachmentType === 'image' ? (
                            <img src={msg.attachmentUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${getCoverStyle(msg.category || 'General')} flex flex-col items-center justify-center text-white p-4 text-center relative`}>
                                <div className="bg-white/20 p-3 rounded-full backdrop-blur-md mb-2 shadow-lg relative z-10">
                                    <Icon name={getCoverIcon(msg.category)} size={28} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-black/20 px-3 py-1 rounded-lg border border-white/10 relative z-10">{msg.category || 'GENERAL'}</span>
                            </div>
                        )}
                        {msg.isPinned && <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 p-1.5 rounded-full shadow-sm z-10"><Icon name="Bell" size={14} className="fill-current"/></div>}
                    </div>
                    
                    <div className="p-4 flex-1 flex flex-col gap-0">
                        <div className="flex justify-between items-center mb-1">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatDate(msg.date)}</span>
                             {msg.type === 'poll' && <Badge type="brand">ENCUESTA</Badge>}
                        </div>
                        <h3 className="font-extrabold text-lg text-slate-900 leading-tight mb-1 line-clamp-2">{msg.content}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-2">{msg.body || 'Ver detalles...'}</p>
                        
                        <div className="flex items-center justify-between border-t border-slate-50 pt-2 mt-auto">
                            <div className="flex -space-x-1 items-center">
                                {Object.entries(msg.reactions||{}).slice(0,3).map(([k,v],i)=><span key={i} className="text-xs bg-slate-100 rounded-full px-1.5 border border-white">{v}</span>)}
                                <button 
                                    onClick={(e)=>{e.stopPropagation(); handleReaction(msg.id, '❤️')}} 
                                    className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 ml-2 border border-dashed border-slate-300"
                                >
                                    <Icon name="Plus" size={10}/>
                                </button>
                            </div>
                            <span className="text-xs font-bold text-brand-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Abrir <Icon name="ArrowRight" size={12}/></span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    // VISTA CHAT
    const renderChatInterface = (chatList) => (
        <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200 h-full animate-enter">
            <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 bg-white"><Input placeholder="Buscar chat..." className="py-2 text-sm rounded-xl" /></div>
                <div className="flex-1 overflow-y-auto">
                    {chatList.map(chat => {
                        const lastMsg = chat.msgs[0]; 
                        const isUnread = !lastMsg?.readBy?.includes(userProfile.id);
                        return (
                            <div key={chat.chatId||chat.id} onClick={()=>setSelectedChat(chat)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white transition-colors flex gap-3 items-center ${selectedChat?.id===chat.id?'bg-white border-l-4 border-l-brand-500':'border-l-4 border-l-transparent'}`}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${chat.color || 'bg-slate-200 text-slate-500'}`}>
                                    {chat.icon ? <Icon name={chat.icon}/> : chat.title.charAt(0)}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h4 className="font-bold text-sm text-slate-800 truncate">{chat.title}</h4>
                                    <p className="text-xs text-slate-500 truncate">{chat.msgs[0]?.content || '...'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={`flex-1 flex flex-col bg-[#eef2f6] relative ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                {selectedChat ? (
                    <>
                        <div className="p-3 bg-white border-b flex justify-between items-center shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={()=>setSelectedChat(null)} className="md:hidden text-slate-500"><Icon name="ChevronLeft"/></button>
                                <h3 className="font-bold text-slate-800">{selectedChat.title}</h3>
                            </div>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
                            {[...selectedChat.msgs].reverse().map(msg => (
                                <div key={msg.id} className={`flex ${msg.from===userProfile.id?'justify-end':'justify-start'} group relative`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg shadow-sm text-sm relative ${msg.from===userProfile.id?'bg-[#d9fdd3] text-slate-900':'bg-white'}`}>
                                        {msg.from!==userProfile.id && <p className="text-[10px] font-bold text-orange-600 mb-1">{msg.fromName}</p>}
                                        
                                        {msg.attachmentUrl && <img src={msg.attachmentUrl} className="mb-2 rounded-lg max-h-60 object-cover cursor-pointer bg-black/10" onClick={()=>setImageModal(msg.attachmentUrl)}/>}
                                        
                                        <p className="whitespace-pre-wrap">{msg.content}</p>

                                        {msg.type === 'poll' && (
                                            <div className="space-y-2 mt-2">
                                                {msg.pollOptions.map((opt, i) => {
                                                    const votes = opt.votes?.length || 0;
                                                    const total = msg.pollOptions.reduce((a,b)=>a+(b.votes?.length||0),0);
                                                    const pct = total ? Math.round((votes/total)*100) : 0;
                                                    const voted = opt.votes?.includes(userProfile.id);
                                                    return (
                                                        <div key={i} onClick={()=>handleVote(msg.id, i)} className={`relative p-2 rounded border cursor-pointer overflow-hidden ${voted ? 'border-brand-500 bg-brand-50' : 'bg-black/5 border-transparent'}`}>
                                                            <div className="absolute left-0 top-0 bottom-0 bg-black/10" style={{width:`${pct}%`}}></div>
                                                            <div className="relative flex justify-between items-center z-10">
                                                                <span className="text-xs font-medium">{opt.text}</span>
                                                                <span className="text-[10px] font-bold">{pct}%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {msg.type === 'link' && <a href={msg.linkUrl} target="_blank" className="block mt-2 text-xs underline truncate bg-black/10 p-2 rounded">{msg.linkUrl}</a>}

                                        <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/10 gap-3">
                                            <div className="flex gap-1">
                                                {Object.entries(msg.reactions||{}).slice(0,3).map(([k,v],i)=><span key={i} className="text-xs bg-white text-black rounded-full px-1 border border-slate-200">{v}</span>)}
                                            </div>
                                            <div className="text-[9px] opacity-70 flex items-center gap-1">
                                                {formatDate(msg.date, 'time')}
                                                {msg.from === userProfile.id && (<span className="flex items-center cursor-pointer hover:opacity-100" onClick={()=>setViewersModal(msg)}><Icon name="Eye" size={10}/> {msg.readBy?.length}</span>)}
                                            </div>
                                        </div>

                                        {/* ACCIONES HOVER CHAT (Reaccionar/Eliminar) */}
                                        <div className="absolute -top-3 right-0 bg-white shadow-md rounded-full px-2 py-1 hidden group-hover:flex gap-1 scale-90 text-slate-800 z-20">
                                            {['👍','❤️','🙏','🔥'].map(em => <button key={em} onClick={()=>handleReaction(msg.id, em)}>{em}</button>)}
                                            {(isAdmin || msg.from === userProfile.id) && <button onClick={()=>handleDelete(msg.id, msg.from)} className="text-red-500 px-1"><Icon name="Trash" size={12}/></button>}
                                            {isAdmin && <button onClick={()=>handleEditMessage(msg)} className="text-blue-500 px-1"><Icon name="Edit" size={12}/></button>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 bg-white flex gap-2 items-center">
                            <input className="input-modern rounded-full flex-1 py-3" placeholder="Escribe un mensaje..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleChatReply()}/>
                            <button onClick={handleChatReply} className="p-3 bg-brand-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"><Icon name="Send" size={18}/></button>
                        </div>
                    </>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><Icon name="MessageCircle" size={64}/><p>Selecciona un chat</p></div>}
            </div>
        </div>
    );

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full md:w-auto">
                    {[{id:'broadcast',label:'Difusión',icon:'Megaphone'},{id:'ministries',label:'Ministerios',icon:'Briefcase'},{id:'groups',label:'Grupos',icon:'Users'},{id:'direct',label:'Chats',icon:'MessageCircle'}].map(t=>(
                        <button key={t.id} onClick={()=>{setActiveTab(t.id);setSelectedChat(null);}} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab===t.id?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}><Icon name={t.icon} size={16}/><span className="hidden md:inline">{t.label}</span></button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" icon="Users" onClick={()=>setIsGroupModalOpen(true)}>Grupo</Button>
                    <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Redactar</Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'broadcast' && <div className="h-full overflow-y-auto pr-2 pb-10">{renderBroadcastView()}</div>}
                {activeTab === 'ministries' && renderChatInterface(categorizedMessages.ministries)}
                {activeTab === 'groups' && renderChatInterface(categorizedMessages.groups)}
                {activeTab === 'direct' && renderChatInterface(categorizedMessages.directs)}
            </div>

            {/* MODAL LECTURA */}
            {selectedBroadcast && (
                <Modal isOpen={!!selectedBroadcast} onClose={()=>setSelectedBroadcast(null)} title="Comunicado">
                    <div className="space-y-6">
                        {selectedBroadcast.type === 'prayer' ? (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
                                <Icon name="Smile" size={32} className="mx-auto text-amber-600 mb-2"/>
                                <h3 className="font-bold text-amber-800 text-lg">Petición de Oración</h3>
                                <p className="text-sm text-amber-700">{selectedBroadcast.content}</p>
                                <div className="mt-4">
                                    <button onClick={()=>handlePray(selectedBroadcast.id)} className={`px-6 py-2 rounded-full font-bold transition-all ${selectedBroadcast.prayedBy?.includes(userProfile.id) ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-600'}`}>
                                        🙏 {selectedBroadcast.prayedBy?.includes(userProfile.id) ? 'Ya oraste' : 'Orar por esto'}
                                    </button>
                                </div>
                                <p className="text-xs text-amber-600 mt-2">{selectedBroadcast.prayedBy?.length || 0} personas oraron.</p>
                            </div>
                        ) : (
                            <>
                                <div className={`h-40 rounded-2xl relative flex items-center justify-center overflow-hidden ${selectedBroadcast.attachmentUrl ? '' : getCoverStyle(selectedBroadcast.category)}`}>
                                    {selectedBroadcast.attachmentUrl ? <img src={selectedBroadcast.attachmentUrl} className="w-full h-full object-cover"/> : (
                                        <div className="text-white text-center"><Icon name={getCoverIcon(selectedBroadcast.category)} size={48} className="mx-auto mb-2 opacity-80"/><h2 className="text-2xl font-black uppercase tracking-widest">{selectedBroadcast.category}</h2></div>
                                    )}
                                </div>
                                <div className="px-2">
                                    <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{selectedBroadcast.content}</h2>
                                    <div className="prose prose-slate text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedBroadcast.body}</div>
                                    
                                    {selectedBroadcast.type === 'link' && <a href={selectedBroadcast.linkUrl} target="_blank" className="mt-4 block bg-blue-50 border border-blue-200 p-4 rounded-xl text-center text-blue-700 font-bold hover:bg-blue-100">Abrir Enlace</a>}
                                    
                                    {/* Reacciones */}
                                    <div className="flex gap-2 mt-4 pt-4 border-t">
                                        {['👍','❤️','🙏','🔥'].map(em => (
                                            <button key={em} onClick={()=>handleReaction(selectedBroadcast.id, em)} className={`px-3 py-1 rounded-full border text-sm hover:scale-110 transition-transform ${selectedBroadcast.reactions?.[userProfile.id]===em ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-white border-slate-200'}`}>
                                                {em} <span className="text-xs text-slate-500 ml-1">{Object.values(selectedBroadcast.reactions||{}).filter(x=>x===em).length || ''}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {(isAdmin || selectedBroadcast.from === userProfile.id) && (
                            <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                                <button onClick={()=>{handleEditMessage(selectedBroadcast); setSelectedBroadcast(null);}} className="text-xs text-blue-600 font-bold flex gap-1"><Icon name="Edit" size={12}/> Editar</button>
                                <button onClick={()=>handleDelete(selectedBroadcast.id, selectedBroadcast.from)} className="text-xs text-red-600 font-bold flex gap-1"><Icon name="Trash" size={12}/> Eliminar</button>
                            </div>
                        )}

                        {/* Comentarios */}
                        {selectedBroadcast.allowReplies !== false && selectedBroadcast.type !== 'prayer' && (
                            <div className="border-t pt-4">
                                <h4 className="font-bold text-sm mb-3">Comentarios</h4>
                                <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
                                    {(selectedBroadcast.replies || []).map((r, i) => (
                                        <div key={i} className="bg-slate-50 p-2 rounded text-xs"><span className="font-bold text-slate-600">{r.fromName}: </span>{r.content}</div>
                                    ))}
                                </div>
                                <div className="flex gap-2"><input className="input-modern py-2 text-sm" placeholder="Comentar..." value={replyText} onChange={e=>setReplyText(e.target.value)}/><Button onClick={handleBroadcastReply} size="sm"><Icon name="Send"/></Button></div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* MODAL REDACTAR */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                    <div className="flex bg-slate-100 p-1 rounded-xl">{['text','poll','link','prayer'].map(t=><button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t==='prayer'?'Oración':t}</button>)}</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}><option value="individual">Persona</option><option value="group">Ministerio</option><option value="custom_group">Grupo</option>{isAdmin&&<option value="broadcast">DIFUSIÓN</option>}</Select>
                        {composeForm.context==='broadcast' ? (
                            <Select label="Categoría" value={composeForm.category} onChange={e=>setComposeForm({...composeForm, category:e.target.value})}>{['General','Aviso','Urgente','Reunión','Oración'].map(c=><option key={c} value={c}>{c}</option>)}</Select>
                        ) : (
                            <Select label={composeForm.context==='group'?'Ministerio':(composeForm.context==='custom_group'?'Grupo':'Persona')} value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                                <option value="">Seleccionar...</option>
                                {(composeForm.context==='group' ? ['Alabanza','Jóvenes','Escuela Bíblica','Servidores'] : (composeForm.context==='custom_group' ? groups.map(g=>({id:g.id, name:g.name})) : members)).map(o=><option key={o.id||o} value={o.id||o}>{o.name||o}</option>)}
                            </Select>
                        )}
                    </div>

                    <Input label="Título / Asunto" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>
                    <div><label className="label-modern mb-1">Cuerpo del mensaje</label><textarea className="input-modern h-32 text-sm resize-none" placeholder="Descripción detallada..." value={composeForm.body} onChange={e=>setComposeForm({...composeForm, body:e.target.value})}/></div>
                    
                    {composeForm.type==='poll'&&<div className="bg-slate-50 p-3 rounded-xl border space-y-2"><label className="label-modern">Opciones</label>{composeForm.pollOptions.map((opt,i)=><Input key={i} placeholder={`Opción ${i+1}`} value={opt} onChange={e=>{const n=[...composeForm.pollOptions];n[i]=e.target.value;setComposeForm({...composeForm, pollOptions:n})}}/>)}<Button size="sm" variant="secondary" onClick={()=>setComposeForm(p=>({...p, pollOptions:[...p.pollOptions,'']}))}>+ Opción</Button></div>}
                    {composeForm.type==='link'&&<Input label="URL" value={composeForm.linkUrl} onChange={e=>setComposeForm({...composeForm, linkUrl:e.target.value})} placeholder="https://..."/>}
                    
                    {composeForm.type!=='prayer' && <div className="flex gap-2"><label className="flex-1 p-3 border rounded-xl flex justify-center items-center gap-2 cursor-pointer hover:bg-slate-50"><Icon name="Image"/> {isUploading?'...':(composeForm.attachmentUrl?'Adjunto OK':'Foto')}<input type="file" className="hidden" onChange={handleImage}/></label></div>}
                    {composeForm.context==='broadcast'&&<div className="flex gap-4 pt-2 border-t"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={composeForm.isPinned} onChange={e=>setComposeForm({...composeForm, isPinned:e.target.checked})}/> Fijar</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={composeForm.allowReplies} onChange={e=>setComposeForm({...composeForm, allowReplies:e.target.checked})}/> Respuestas</label></div>}
                    <Button className="w-full py-3" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>

            <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Nuevo Grupo"><div className="space-y-4"><Input label="Nombre" value={newGroupForm.name} onChange={e=>setNewGroupForm({...newGroupForm, name:e.target.value})}/><div className="max-h-40 overflow-y-auto border p-2 rounded">{members.map(m=><div key={m.id} onClick={()=>{const e=newGroupForm.members.includes(m.id);setNewGroupForm({...newGroupForm, members:e?newGroupForm.members.filter(x=>x!==m.id):[...newGroupForm.members,m.id]})}} className={`p-2 cursor-pointer flex justify-between ${newGroupForm.members.includes(m.id)?'bg-brand-50 text-brand-700':''}`}><span>{m.name}</span>{newGroupForm.members.includes(m.id)&&<Icon name="Check" size={14}/>}</div>)}</div><Button className="w-full" onClick={handleCreateGroup}>Crear</Button></div></Modal>
            <Modal isOpen={!!imageModal} onClose={()=>setImageModal(null)} title="Vista Previa"><div className="text-center"><img src={imageModal} className="max-h-[60vh] mx-auto rounded shadow mb-4"/><a href={imageModal} download="imagen.jpg" className="inline-block bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-bold">Descargar</a></div></Modal>
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Visto por"><div className="max-h-60 overflow-y-auto space-y-1">{viewersModal?.readBy?.map((uid,i)=><div key={i} className="p-2 border-b text-sm text-slate-600">{members.find(m=>m.id===uid)?.name || 'Usuario'}</div>)}</div></Modal>
        </div>
    );
};


