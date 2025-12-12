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
        content: '', body: '', isPinned: false, allowReplies: true, 
        attachmentUrl: '', attachmentType: 'image', 
        pollOptions: ['', ''], linkUrl: '', scheduledAt: ''
    };
    const [composeForm, setComposeForm] = useState(initialCompose);
    
    const [newGroupForm, setNewGroupForm] = useState({ name: '', members: [] });
    const [replyText, setReplyText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);
    const messageRefs = useRef({}); 
    const canBroadcast = ['Pastor', 'Líder'].includes(userProfile.role);

    // --- FIREBASE ---
    useEffect(() => {
        if (!window.db) return;
        const unsubMsg = window.db.collection('messages').orderBy('date', 'desc').limit(300).onSnapshot(snap => {
            setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubMem = window.db.collection('members').onSnapshot(snap => {
            setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubGroups = window.db.collection('groups').onSnapshot(snap => {
            setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => { unsubMsg(); unsubMem(); unsubGroups(); };
    }, []);

    // Scroll al fondo
    useEffect(() => {
        if (scrollRef.current && !highlightId) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [selectedChat]);

    // Scroll a mensaje
    useEffect(() => {
        if (highlightId && messageRefs.current[highlightId]) {
            messageRefs.current[highlightId].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setHighlightId(null), 2000);
        }
    }, [highlightId, selectedChat]);

    // --- FILTRADO ---
    const categorizedMessages = useMemo(() => {
        const now = new Date().toISOString();
        const matchesSearch = (msg) => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (msg.content || '').toLowerCase().includes(term) || (msg.body || '').toLowerCase().includes(term) || (msg.fromName || '').toLowerCase().includes(term);
        };

        const broadcasts = [];
        const ministries = {};
        const customGroups = {};
        const directs = {}; 
        const scheduled = [];

        messages.forEach(msg => {
            if (msg.scheduledAt && msg.scheduledAt > now) {
                if (msg.from === userProfile.id) scheduled.push(msg);
                return;
            }
            if (!matchesSearch(msg)) return;

            if (msg.to === 'all') {
                broadcasts.push(msg);
                return;
            }
            
            if (msg.to.startsWith('group:')) {
                const gName = msg.to.split(':')[1];
                if (userProfile.role === 'Pastor' || userProfile.ministry === gName || msg.from === userProfile.id) {
                    if (!ministries[msg.to]) ministries[msg.to] = { id: msg.to, title: gName, msgs: [] };
                    ministries[msg.to].msgs.push(msg);
                }
                return;
            }

            if (msg.to.startsWith('custom:')) {
                const gId = msg.to.split(':')[1];
                const grpData = groups.find(g => g.id === gId);
                if (grpData && (grpData.members.includes(userProfile.id) || msg.from === userProfile.id)) {
                    if (!customGroups[msg.to]) customGroups[msg.to] = { id: msg.to, title: grpData.name, msgs: [] };
                    customGroups[msg.to].msgs.push(msg);
                }
                return;
            }

            if (msg.to === userProfile.id || msg.from === userProfile.id) {
                const otherId = msg.from === userProfile.id ? msg.to : msg.from;
                const chatId = [userProfile.id, otherId].sort().join('_');
                if (!directs[chatId]) {
                    const otherUser = members.find(m => m.id === otherId);
                    directs[chatId] = { 
                        id: otherId, chatId, 
                        title: otherUser ? otherUser.name : 'Usuario', 
                        photo: otherUser?.photo, msgs: [] 
                    };
                }
                directs[chatId].msgs.push(msg);
            }
        });

        const sortChats = (chats) => Object.values(chats).sort((a,b) => {
            const lastA = a.msgs[0]?.date || 0;
            const lastB = b.msgs[0]?.date || 0;
            return new Date(lastB) - new Date(lastA);
        });

        return {
            broadcasts,
            ministries: sortChats(ministries),
            groups: sortChats(customGroups),
            directs: sortChats(directs),
            scheduled
        };
    }, [messages, userProfile, members, groups, searchTerm]);

    // --- ACCIONES FALTANTES AGREGADAS ---

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
        } catch (e) { console.error(e); Utils.notify("Error al crear grupo", "error"); }
    };

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar?")) {
            await window.db.collection('messages').doc(id).delete();
            if (selectedChat?.id === id) setSelectedChat(null);
            if (selectedBroadcast?.id === id) setSelectedBroadcast(null);
            Utils.notify("Eliminado");
        }
    };

    const handlePin = async (msg) => {
        if (userProfile.role !== 'Pastor') return;
        await window.db.collection('messages').doc(msg.id).update({ isPinned: !msg.isPinned });
        Utils.notify(msg.isPinned ? "Desfijado" : "Fijado");
    };

    const handleEditMessage = (msg) => {
        setComposeForm({
            id: msg.id,
            to: msg.to.startsWith('group:') ? msg.to.split(':')[1] : (msg.to.startsWith('custom:') ? msg.to.split(':')[1] : msg.to),
            context: msg.to === 'all' ? 'broadcast' : (msg.to.startsWith('group:') ? 'group' : (msg.to.startsWith('custom:') ? 'custom_group' : 'individual')),
            type: msg.type || 'text',
            category: msg.category || 'General',
            content: msg.content,
            body: msg.body || '',
            isPinned: msg.isPinned || false,
            allowReplies: msg.allowReplies !== false,
            attachmentUrl: msg.attachmentUrl || '',
            attachmentType: msg.attachmentType || 'image',
            linkUrl: msg.linkUrl || '',
            pollOptions: msg.pollOptions ? msg.pollOptions.map(o => o.text) : ['', ''],
            scheduledAt: msg.scheduledAt || ''
        });
        setIsComposeOpen(true);
    };

    const handlePray = async (msgId) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const prayed = msg.prayedBy || [];
        const newPrayed = prayed.includes(userProfile.id) ? prayed.filter(id => id !== userProfile.id) : [...prayed, userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ prayedBy: newPrayed });
    };

    // --- ACCIONES EXISTENTES ---
    const handleAttachment = async (e) => {
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
            scheduledAt: composeForm.scheduledAt || null,
            ...(!composeForm.id && {
                date: new Date().toISOString(),
                readBy: [userProfile.id],
                replies: [], reactions: {}, prayedBy: []
            })
        };

        try {
            if (composeForm.id) {
                await window.db.collection('messages').doc(composeForm.id).update(msgData);
                Utils.notify("Actualizado");
            } else {
                await window.db.collection('messages').add(msgData);
                Utils.notify(composeForm.scheduledAt ? "Programado" : "Enviado");
            }
            setIsComposeOpen(false);
            setComposeForm(initialCompose);
        } catch(e) { console.error(e); }
    };

    const handleChatReply = async () => {
        if (!replyText.trim() || !selectedChat) return;
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

    const handleBroadcastReply = async () => {
        if (!replyText.trim() || !selectedBroadcast) return;
        const reply = { id: Date.now(), from: userProfile.id, fromName: userProfile.name, content: replyText, date: new Date().toISOString() };
        await window.db.collection('messages').doc(selectedBroadcast.id).update({
            replies: firebase.firestore.FieldValue.arrayUnion(reply)
        });
        setReplyText("");
        setSelectedBroadcast(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
    };

    const handleReaction = async (msgId, emoji) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const current = msg.reactions || {};
        if (current[userProfile.id] === emoji) delete current[userProfile.id];
        else current[userProfile.id] = emoji;
        await window.db.collection('messages').doc(msgId).update({ reactions: current });
    };

    const handleVote = async (msgId, idx) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const opts = [...msg.pollOptions];
        opts.forEach(op => { if (op.votes?.includes(userProfile.id)) op.votes = op.votes.filter(id => id !== userProfile.id); });
        opts[idx].votes = [...(opts[idx].votes || []), userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ pollOptions: opts });
    };

    // --- ESTILOS ---
    const getCoverStyle = (category) => {
        const styles = {
            'Urgente': 'bg-gradient-to-r from-red-500 to-rose-600',
            'Aviso': 'bg-gradient-to-r from-blue-500 to-cyan-500',
            'Reunión': 'bg-gradient-to-r from-purple-500 to-indigo-600',
            'Devocional': 'bg-gradient-to-r from-emerald-500 to-teal-600',
            'General': 'bg-gradient-to-r from-slate-600 to-slate-800'
        };
        return styles[category] || styles['General'];
    };
    
    const getCoverIcon = (category) => {
        const icons = { 'Urgente': 'AlertTriangle', 'Aviso': 'Bell', 'Reunión': 'Calendar', 'Devocional': 'Book', 'General': 'Megaphone' };
        return icons[category] || 'Megaphone';
    };

    // --- RENDER ---
    
    // VISTA DIFUSIÓN
    const renderBroadcastView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-enter p-1">
            {/* Programados */}
            {categorizedMessages.scheduled.length > 0 && (
                <div className="col-span-full mb-4">
                    <h3 className="font-bold text-slate-500 text-sm mb-2 flex items-center gap-2"><Icon name="Clock"/> Programados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {categorizedMessages.scheduled.map(msg => (
                            <div key={msg.id} className="bg-slate-50 border border-dashed border-slate-300 p-4 rounded-xl opacity-75 hover:opacity-100 transition-opacity cursor-pointer" onClick={()=>handleEditMessage(msg)}>
                                <div className="flex justify-between items-center mb-2">
                                    <Badge type="warning">Programado</Badge>
                                    <Icon name="Edit" size={14}/>
                                </div>
                                <p className="font-bold text-sm truncate">{msg.content}</p>
                                <p className="text-xs text-slate-500 mt-1">Para: {formatDate(msg.scheduledAt, 'full')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Mensaje Fijado */}
            {categorizedMessages.broadcasts.filter(m=>m.isPinned).map(msg => (
                <div key={msg.id} onClick={() => setSelectedBroadcast(msg)} className="col-span-full bg-gradient-to-r from-yellow-50 to-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer shadow-sm hover:shadow-md transition-all">
                    <div className="bg-orange-100 text-orange-600 p-3 rounded-full shrink-0 animate-pulse"><Icon name="Bell" size={24}/></div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Aviso Fijado</span>
                            <span className="text-[10px] text-orange-400">{formatDate(msg.date)}</span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">{msg.content}</h3>
                        <p className="text-sm text-slate-600 line-clamp-1">{msg.body || 'Clic para leer más'}</p>
                    </div>
                </div>
            ))}

            {categorizedMessages.broadcasts.map(msg => (
                <div key={msg.id} onClick={() => setSelectedBroadcast(msg)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-xl transition-all hover:-translate-y-1 relative h-80 flex flex-col">
                    <div className="h-40 relative overflow-hidden shrink-0">
                         {msg.attachmentUrl && msg.attachmentType === 'image' ? (
                            <img src={msg.attachmentUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${getCoverStyle(msg.category || 'General')} flex flex-col items-center justify-center text-white p-4 text-center`}>
                                <div className="bg-white/20 p-3 rounded-full backdrop-blur-md mb-2 shadow-lg">
                                    <Icon name={getCoverIcon(msg.category)} size={32} />
                                </div>
                                <h3 className="font-black text-xl leading-tight drop-shadow-md line-clamp-2">{msg.content}</h3>
                                <span className="text-[10px] font-bold uppercase tracking-widest mt-2 bg-black/20 px-2 py-0.5 rounded">{msg.category}</span>
                            </div>
                        )}
                        {msg.isPinned && <div className="absolute top-2 left-2 bg-white/90 p-1.5 rounded-full shadow-sm"><Icon name="Bell" size={14} className="text-orange-500 fill-current"/></div>}
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${msg.type==='prayer'?'text-yellow-600':'text-brand-600'}`}>{msg.category || (msg.type==='prayer'?'Oración':'General')}</span>
                            <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 leading-tight mb-2 line-clamp-2">{msg.content}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-auto">{msg.body || (msg.type==='link' ? 'Enlace adjunto' : '...')}</p>
                        
                        <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">{msg.fromName.charAt(0)}</div>
                                <span className="text-xs text-slate-500 font-medium truncate max-w-[100px]">{msg.fromName}</span>
                            </div>
                            <span className="text-xs font-bold text-brand-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Leer <Icon name="ArrowRight" size={12}/></span>
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
                <div className="p-4 border-b border-slate-200 bg-white"><Input placeholder="Buscar..." className="py-2 text-sm rounded-full" /></div>
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
                                    <div className="flex justify-between mb-0.5">
                                        <h4 className={`text-sm truncate ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{chat.title}</h4>
                                        <span className="text-[10px] text-slate-400 shrink-0">{formatDate(lastMsg?.date)}</span>
                                    </div>
                                    <p className={`text-xs truncate ${isUnread ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                        {lastMsg?.from===userProfile.id && 'Tú: '} {lastMsg?.body || lastMsg?.content}
                                    </p>
                                </div>
                                {isUnread && <div className="w-2.5 h-2.5 bg-brand-600 rounded-full"></div>}
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
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${selectedChat.color || 'bg-slate-200 text-slate-600'}`}>
                                    {selectedChat.icon ? <Icon name={selectedChat.icon} size={20}/> : selectedChat.title.charAt(0)}
                                </div>
                                <div><h3 className="font-bold text-slate-800">{selectedChat.title}</h3><p className="text-xs text-slate-500">En línea</p></div>
                            </div>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
                            {[...selectedChat.msgs].reverse().map(msg => (
                                <div key={msg.id} ref={el => messageRefs.current[msg.id] = el} className={`flex ${msg.from===userProfile.id?'justify-end':'justify-start'} ${highlightId===msg.id ? 'animate-pulse' : ''}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm text-sm relative group ${msg.from===userProfile.id?'bg-brand-600 text-white rounded-tr-none':'bg-white text-slate-800 rounded-tl-none'} ${highlightId===msg.id ? 'ring-2 ring-yellow-400' : ''}`}>
                                        {msg.from!==userProfile.id && <p className="text-[10px] font-bold text-orange-600 mb-1">{msg.fromName}</p>}
                                        
                                        {msg.attachmentUrl && <img src={msg.attachmentUrl} className="mb-2 rounded-lg max-h-60 object-cover cursor-pointer bg-black/10" onClick={()=>setImageModal(msg.attachmentUrl)}/>}
                                        
                                        <h4 className="font-bold text-sm mb-1">{msg.content}</h4>
                                        {msg.body && <p className="whitespace-pre-wrap opacity-90">{msg.body}</p>}
                                        
                                        {msg.type === 'link' && <a href={msg.linkUrl} target="_blank" className="block mt-2 text-xs underline truncate bg-black/10 p-2 rounded">{msg.linkUrl}</a>}
                                        
                                        <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/10 gap-3">
                                            <div className="flex gap-1">{Object.entries(msg.reactions||{}).slice(0,3).map(([k,v],i)=><span key={i} className="text-xs bg-white text-black rounded-full px-1 border border-slate-200">{v}</span>)}</div>
                                            <div className="text-[9px] opacity-70 flex items-center gap-1">{formatDate(msg.date, 'time')} {msg.from === userProfile.id && (<span className="flex items-center cursor-pointer hover:opacity-100" onClick={()=>setViewersModal(msg)}><Icon name="Eye" size={10}/> {msg.readBy?.length}</span>)}</div>
                                        </div>

                                        <div className="absolute -top-3 right-0 bg-white shadow-md rounded-full px-2 py-1 hidden group-hover:flex gap-1 scale-90 text-slate-800">
                                            {['👍','❤️','🙏','🔥'].map(e => <button key={e} onClick={()=>handleReaction(msg.id, e)}>{e}</button>)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 bg-white flex gap-2 items-center">
                            <input className="flex-1 bg-slate-100 border-none rounded-full px-5 py-3 text-sm outline-none" placeholder="Escribe un mensaje..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleChatReply()}/>
                            <button onClick={handleChatReply} className="p-3 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 transition-transform active:scale-95"><Icon name="Send" size={18}/></button>
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
                    {[{id:'broadcast',label:'Difusión'},{id:'ministries',label:'Ministerios'},{id:'groups',label:'Grupos'},{id:'direct',label:'Chats'}].map(t=>(
                        <button key={t.id} onClick={()=>{setActiveTab(t.id);setSelectedChat(null);}} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab===t.id?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>{t.label}</button>
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
                <Modal isOpen={!!selectedBroadcast} onClose={()=>setSelectedBroadcast(null)} title="Lectura">
                    <div className="space-y-6">
                        {selectedBroadcast.attachmentUrl && selectedBroadcast.attachmentType === 'image' ? (
                            <img src={selectedBroadcast.attachmentUrl} className="w-full max-h-64 object-cover rounded-xl"/>
                        ) : (
                            <div className={`h-32 rounded-xl flex items-center justify-center text-white ${getCoverStyle(selectedBroadcast.category || 'General')}`}>
                                <Icon name={getCoverIcon(selectedBroadcast.category)} size={48}/>
                            </div>
                        )}
                        
                        <div className="px-2">
                            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{selectedBroadcast.content}</h2>
                            <div className="prose prose-slate text-sm text-slate-700 whitespace-pre-wrap">{selectedBroadcast.body}</div>
                            
                            {selectedBroadcast.type === 'poll' && (
                                <div className="mt-4 space-y-2">
                                    {selectedBroadcast.pollOptions.map((opt, i) => {
                                        const votes = opt.votes?.length || 0;
                                        const total = selectedBroadcast.pollOptions.reduce((a,b)=>a+(b.votes?.length||0),0);
                                        const pct = total ? Math.round((votes/total)*100) : 0;
                                        return (
                                            <div key={i} onClick={()=>handleVote(selectedBroadcast.id, i)} className="relative p-3 rounded-xl border cursor-pointer bg-slate-50 overflow-hidden">
                                                <div className="absolute left-0 top-0 bottom-0 bg-brand-200/50" style={{width:`${pct}%`}}></div>
                                                <div className="relative flex justify-between z-10 font-bold text-sm"><span>{opt.text}</span><span>{pct}%</span></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedBroadcast.type === 'link' && <a href={selectedBroadcast.linkUrl} target="_blank" className="mt-4 block bg-blue-50 border border-blue-200 p-4 rounded-xl text-center text-blue-700 font-bold hover:bg-blue-100">Abrir Enlace</a>}
                        </div>

                        {selectedBroadcast.allowReplies !== false && (
                            <div className="border-t pt-4">
                                <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
                                    {(selectedBroadcast.replies||[]).map((r,i)=>(<div key={i} className="bg-slate-50 p-2 rounded text-xs"><span className="font-bold">{r.fromName}: </span>{r.content}</div>))}
                                </div>
                                <div className="flex gap-2">
                                    <input className="input-modern py-2 text-sm" placeholder="Comentar..." value={replyText} onChange={e=>setReplyText(e.target.value)}/>
                                    <Button onClick={handleBroadcastReply}><Icon name="Send"/></Button>
                                </div>
                            </div>
                        )}
                        
                        {(canBroadcast || selectedBroadcast.from === userProfile.id) && (
                            <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                                <button onClick={()=>{handleEditMessage(selectedBroadcast); setSelectedBroadcast(null);}} className="text-xs text-blue-600 font-bold flex gap-1"><Icon name="Edit" size={12}/> Editar</button>
                                <button onClick={()=>handleDelete(selectedBroadcast.id)} className="text-xs text-red-600 font-bold flex gap-1"><Icon name="Trash" size={12}/> Eliminar</button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* MODAL REDACTAR */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    <div className="flex bg-slate-100 p-1 rounded-xl">{['text','poll','link','prayer'].map(t=><button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t==='prayer'?'Oración':t}</button>)}</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}><option value="individual">Persona</option><option value="group">Ministerio</option><option value="custom_group">Grupo</option>{canBroadcast&&<option value="broadcast">DIFUSIÓN</option>}</Select>
                        {composeForm.context==='broadcast' && <Select label="Categoría" value={composeForm.category} onChange={e=>setComposeForm({...composeForm, category:e.target.value})}>{['General','Aviso','Urgente','Reunión'].map(c=><option key={c} value={c}>{c}</option>)}</Select>}
                        {composeForm.context==='individual'&&<Select label="Para" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select>}
                    </div>

                    <Input label="Título / Asunto" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>
                    
                    {['text','prayer'].includes(composeForm.type) && (
                        <>
                            <textarea className="input-modern h-24 text-sm" placeholder="Cuerpo del mensaje..." value={composeForm.body} onChange={e=>setComposeForm({...composeForm, body:e.target.value})}/>
                            <div className="flex gap-2"><label className="flex-1 p-3 border rounded-xl flex justify-center items-center gap-2 cursor-pointer hover:bg-slate-50"><Icon name="Image"/> Adjuntar<input type="file" className="hidden" onChange={handleAttachment}/></label></div>
                        </>
                    )}

                    {composeForm.type === 'poll' && (
                        <div className="bg-slate-50 p-3 rounded-xl border space-y-2">
                            <label className="label-modern">Opciones</label>
                            {composeForm.pollOptions.map((opt, i) => <input key={i} className="input-modern py-2 text-sm" placeholder={`Opción ${i+1}`} value={opt} onChange={e=>{const n=[...composeForm.pollOptions];n[i]=e.target.value;setComposeForm({...composeForm, pollOptions:n})}}/>)}
                            <Button size="sm" variant="secondary" onClick={()=>setComposeForm(p=>({...p, pollOptions:[...p.pollOptions, '']}))}>+ Opción</Button>
                        </div>
                    )}

                    {composeForm.type === 'link' && <Input label="URL" value={composeForm.linkUrl} onChange={e=>setComposeForm({...composeForm, linkUrl:e.target.value})} />}

                    {composeForm.context === 'broadcast' && (
                        <div className="flex items-center gap-4 pt-2 border-t">
                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={composeForm.isPinned} onChange={e=>setComposeForm({...composeForm, isPinned:e.target.checked})}/> Fijar</label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={composeForm.allowReplies} onChange={e=>setComposeForm({...composeForm, allowReplies:e.target.checked})}/> Permitir Respuestas</label>
                        </div>
                    )}

                    <Button className="w-full py-3" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>

            <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Nuevo Grupo">
                <div className="space-y-4">
                    <Input label="Nombre del Grupo" value={newGroupForm.name} onChange={e=>setNewGroupForm({...newGroupForm, name:e.target.value})}/>
                    <div className="max-h-40 overflow-y-auto border p-2 rounded-xl space-y-1">
                        {members.map(m => (
                            <div key={m.id} onClick={()=>{const e=newGroupForm.members.includes(m.id);setNewGroupForm({...newGroupForm, members:e?newGroupForm.members.filter(x=>x!==m.id):[...newGroupForm.members,m.id]})}} className={`p-2 rounded cursor-pointer flex justify-between text-xs ${newGroupForm.members.includes(m.id)?'bg-brand-50 text-brand-700 font-bold':'hover:bg-slate-50'}`}>
                                {m.name} {newGroupForm.members.includes(m.id)&&<Icon name="Check" size={14}/>}
                            </div>
                        ))}
                    </div>
                    <Button className="w-full" onClick={handleCreateGroup}>Crear</Button>
                </div>
            </Modal>

            <Modal isOpen={!!imageModal} onClose={()=>setImageModal(null)} title="Imagen"><div className="text-center"><img src={imageModal} className="max-h-[60vh] mx-auto rounded shadow mb-4"/><a href={imageModal} download="imagen.jpg" className="inline-block bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-bold">Descargar</a></div></Modal>
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Visto por"><div className="max-h-60 overflow-y-auto space-y-1">{viewersModal?.readBy?.map((uid,i)=><div key={i} className="p-2 border-b text-sm text-slate-600">{members.find(m=>m.id===uid)?.name || 'Usuario'}</div>)}</div></Modal>
        </div>
    );
};
