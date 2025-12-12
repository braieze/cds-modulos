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
        to: '', context: 'individual', type: 'text', category: 'General',
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

    // Scroll
    useEffect(() => {
        if (scrollRef.current && !highlightId) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [selectedChat]);

    // --- FILTRADO ---
    const categorizedMessages = useMemo(() => {
        const matchesSearch = (msg) => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (msg.content || '').toLowerCase().includes(term) || (msg.body || '').toLowerCase().includes(term);
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
                if (userProfile.role === 'Pastor' || userProfile.ministry === gName || msg.from === userProfile.id) {
                    if (!ministries[msg.to]) ministries[msg.to] = { id: msg.to, title: gName, msgs: [] };
                    ministries[msg.to].msgs.push(msg);
                }
                return;
            }

            if (msg.to.startsWith('custom:')) {
                const gId = msg.to.split(':')[1];
                // Buscar nombre del grupo en el estado 'groups'
                const grpData = groups.find(g => g.id === gId);
                // Mostrar si soy miembro o si yo lo envié
                if ((grpData && grpData.members.includes(userProfile.id)) || msg.from === userProfile.id) {
                    const groupTitle = grpData ? grpData.name : 'Grupo Eliminado';
                    if (!customGroups[msg.to]) customGroups[msg.to] = { id: msg.to, title: groupTitle, msgs: [] };
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

        const sortChats = (chats) => Object.values(chats).sort((a,b) => new Date(b.msgs[0]?.date) - new Date(a.msgs[0]?.date));

        return {
            broadcasts,
            ministries: sortChats(ministries),
            groups: sortChats(customGroups),
            directs: sortChats(directs)
        };
    }, [messages, userProfile, members, groups, searchTerm]);

    // --- ACCIONES ---

    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const base64 = await compressImage(file);
            setComposeForm(p => ({ ...p, attachmentUrl: base64 }));
        } catch(err) { console.error(err); Utils.notify("Error imagen", "error"); }
        finally { setIsUploading(false); }
    };

    const handleSend = async () => {
        if (!composeForm.content) return Utils.notify("Falta el título", "error");
        
        let recipient = composeForm.to;
        if (composeForm.context === 'group') recipient = `group:${composeForm.to}`;
        if (composeForm.context === 'custom_group') recipient = `custom:${composeForm.to}`; // Aquí estaba el error de grupos, ahora usa el ID correcto
        if (composeForm.context === 'broadcast') recipient = 'all';

        // Validar selección de grupo
        if ((composeForm.context === 'custom_group' || composeForm.context === 'individual' || composeForm.context === 'group') && !composeForm.to) {
            return Utils.notify("Selecciona un destinatario", "error");
        }

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
            attachmentType: 'image',
            linkUrl: composeForm.linkUrl,
            pollOptions: composeForm.type === 'poll' ? composeForm.pollOptions.map(o => ({ text: o, votes: [] })) : [],
            date: new Date().toISOString(),
            readBy: [userProfile.id],
            replies: [],
            reactions: {}
        };

        try {
            await window.db.collection('messages').add(msgData);
            setIsComposeOpen(false);
            setComposeForm(initialCompose);
            Utils.notify("Enviado");
        } catch(e) { console.error(e); }
    };

    const handleCreateGroup = async () => {
        if (!newGroupForm.name || newGroupForm.members.length === 0) return Utils.notify("Datos faltantes", "error");
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
        } catch (e) { console.error(e); Utils.notify("Error al crear", "error"); }
    };

    const handleReply = async (isBroadcast) => {
        if (!replyText.trim()) return;
        const target = isBroadcast ? selectedBroadcast : selectedChat;
        if (!target) return;

        const reply = {
            id: Date.now(),
            from: userProfile.id,
            fromName: userProfile.name,
            content: replyText,
            date: new Date().toISOString()
        };

        try {
            if (isBroadcast) {
                // Difusión: Reply anidado
                await window.db.collection('messages').doc(target.id).update({
                    replies: firebase.firestore.FieldValue.arrayUnion(reply)
                });
                setSelectedBroadcast(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
            } else {
                // Chat: Nuevo mensaje en el hilo
                const newMessage = {
                    from: userProfile.id,
                    fromName: userProfile.name,
                    to: target.id || target.chatId, // ID del grupo o chat
                    content: replyText,
                    type: 'text',
                    date: new Date().toISOString(),
                    readBy: [userProfile.id],
                    replies: [], reactions: {}
                };
                if (activeTab === 'direct') newMessage.to = target.id;
                await window.db.collection('messages').add(newMessage);
            }
            setReplyText("");
        } catch(e) { console.error(e); }
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

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar?")) {
            await window.db.collection('messages').doc(id).delete();
            if (selectedBroadcast?.id === id) setSelectedBroadcast(null);
            if (selectedChat?.id === id) setSelectedChat(null);
        }
    };

    const handlePin = async (msg) => {
        if (userProfile.role !== 'Pastor') return;
        await window.db.collection('messages').doc(msg.id).update({ isPinned: !msg.isPinned });
    };

    // --- ESTILOS DE PORTADA (OLD SCHOOL) ---
    const getCoverStyle = (category) => {
        const styles = {
            'Urgente': 'from-red-500 to-rose-600',
            'Aviso': 'from-blue-500 to-cyan-500',
            'Reunión': 'from-purple-500 to-indigo-600',
            'Oración': 'from-amber-400 to-orange-500', // Nueva categoría
            'Devocional': 'from-emerald-500 to-teal-600',
            'General': 'from-slate-600 to-slate-800'
        };
        return styles[category] || styles['General'];
    };
    
    const getCoverIcon = (category) => {
        const icons = { 'Urgente': 'AlertTriangle', 'Aviso': 'Bell', 'Reunión': 'Calendar', 'Devocional': 'Book', 'General': 'Megaphone', 'Oración': 'Video' };
        return icons[category] || 'Megaphone';
    };

    // --- RENDER ---
    
    // VISTA DIFUSIÓN (DISEÑO FLYER)
    const renderBroadcastView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-enter p-1">
            {categorizedMessages.broadcasts.map(msg => (
                <div key={msg.id} onClick={() => setSelectedBroadcast(msg)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-xl transition-all hover:-translate-y-1 relative h-auto flex flex-col">
                    
                    {/* PORTADA: IMAGEN O DISEÑO AUTOMÁTICO */}
                    <div className="h-40 relative overflow-hidden shrink-0">
                         {msg.attachmentUrl && msg.attachmentType === 'image' ? (
                            <img src={msg.attachmentUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${getCoverStyle(msg.category || 'General')} flex flex-col items-center justify-center text-white p-4 text-center relative`}>
                                {/* Patrón de fondo sutil */}
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                                <div className="bg-white/20 p-3 rounded-full backdrop-blur-md mb-2 shadow-lg relative z-10">
                                    <Icon name={getCoverIcon(msg.category)} size={32} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-black/20 px-3 py-1 rounded-lg border border-white/10 relative z-10">{msg.category || 'GENERAL'}</span>
                            </div>
                        )}
                        {msg.isPinned && <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 p-1.5 rounded-full shadow-sm z-10"><Icon name="Bell" size={14} className="fill-current"/></div>}
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatDate(msg.date)}</span>
                            {msg.type === 'poll' && <Badge type="brand">ENCUESTA</Badge>}
                        </div>
                        <h3 className="font-extrabold text-lg text-slate-900 leading-tight mb-2 line-clamp-2">{msg.content}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-auto">{msg.body || (msg.type==='link' ? 'Enlace adjunto...' : 'Ver detalles...')}</p>
                        
                        {/* BARRA DE REACCIONES EN TARJETA */}
                        <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-3">
                            <div className="flex -space-x-1">
                                {Object.entries(msg.reactions||{}).slice(0,3).map(([k,v],i)=><span key={i} className="text-xs bg-slate-100 rounded-full px-1.5 border border-white">{v}</span>)}
                                <button 
                                    onClick={(e)=>{e.stopPropagation(); handleReaction(msg.id, '❤️')}} 
                                    className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors border border-dashed border-slate-300 ml-2"
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

    // VISTA CHAT (Mantiene estilo WhatsApp)
    const renderChatInterface = (chatList) => (
        <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200 h-full animate-enter">
            <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 bg-white"><Input placeholder="Buscar chat..." className="py-2 text-sm rounded-xl" /></div>
                <div className="flex-1 overflow-y-auto">
                    {chatList.map(chat => (
                        <div key={chat.chatId||chat.id} onClick={()=>setSelectedChat(chat)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white transition-colors flex gap-3 items-center ${selectedChat?.id===chat.id?'bg-white border-l-4 border-l-brand-500':'border-l-4 border-l-transparent'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${chat.color || 'bg-slate-200 text-slate-500'}`}>
                                {chat.icon ? <Icon name={chat.icon}/> : chat.title.charAt(0)}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h4 className="font-bold text-sm text-slate-800 truncate">{chat.title}</h4>
                                <p className="text-xs text-slate-500 truncate">{chat.msgs[0]?.content || '...'}</p>
                            </div>
                        </div>
                    ))}
                    {chatList.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">No hay chats activos.</div>}
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
                                <h3 className="font-bold text-slate-800">{selectedChat.title}</h3>
                            </div>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
                            {[...selectedChat.msgs].reverse().map(msg => (
                                <div key={msg.id} className={`flex ${msg.from===userProfile.id?'justify-end':'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm text-sm relative ${msg.from===userProfile.id?'bg-brand-600 text-white rounded-tr-none':'bg-white text-slate-800 rounded-tl-none'}`}>
                                        {msg.from!==userProfile.id && <p className="text-[10px] font-bold text-orange-600 mb-1">{msg.fromName}</p>}
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <div className="text-[9px] text-right mt-1 opacity-60">{formatDate(msg.date, 'time')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 bg-white flex gap-2 items-center border-t border-slate-200">
                            <input className="input-modern rounded-full flex-1 py-3" placeholder="Escribe un mensaje..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleReply(false)}/>
                            <button onClick={()=>handleReply(false)} className="p-3 bg-brand-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"><Icon name="Send" size={18}/></button>
                        </div>
                    </>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><Icon name="MessageCircle" size={64}/><p>Selecciona un chat</p></div>}
            </div>
        </div>
    );

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            {/* Header */}
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

            {/* MODAL LECTURA DIFUSIÓN */}
            {selectedBroadcast && (
                <Modal isOpen={!!selectedBroadcast} onClose={()=>setSelectedBroadcast(null)} title="Comunicado">
                    <div className="space-y-6">
                        <div className={`h-40 rounded-2xl relative flex items-center justify-center overflow-hidden ${selectedBroadcast.attachmentUrl ? '' : getCoverStyle(selectedBroadcast.category)}`}>
                            {selectedBroadcast.attachmentUrl ? <img src={selectedBroadcast.attachmentUrl} className="w-full h-full object-cover"/> : (
                                <div className="text-white text-center">
                                    <Icon name={getCoverIcon(selectedBroadcast.category)} size={48} className="mx-auto mb-2 opacity-80"/>
                                    <h2 className="text-2xl font-black uppercase tracking-widest">{selectedBroadcast.category}</h2>
                                </div>
                            )}
                        </div>
                        
                        <div className="px-2">
                            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{selectedBroadcast.content}</h2>
                            <div className="prose prose-slate text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedBroadcast.body}</div>

                            {/* ENCUESTA */}
                            {selectedBroadcast.type === 'poll' && (
                                <div className="mt-4 space-y-2">
                                    {selectedBroadcast.pollOptions.map((opt, i) => {
                                        const votes = opt.votes?.length || 0;
                                        const total = selectedBroadcast.pollOptions.reduce((a,b)=>a+(b.votes?.length||0),0);
                                        const pct = total ? Math.round((votes/total)*100) : 0;
                                        const voted = opt.votes?.includes(userProfile.id);
                                        return (
                                            <div key={i} onClick={()=>handleVote(selectedBroadcast.id, i)} className={`relative p-3 rounded-xl border cursor-pointer overflow-hidden ${voted ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                                                <div className="absolute left-0 top-0 bottom-0 bg-brand-200/50" style={{width:`${pct}%`}}></div>
                                                <div className="relative flex justify-between z-10 font-bold text-sm"><span>{opt.text}</span><span>{pct}%</span></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* LINK */}
                            {selectedBroadcast.type === 'link' && <a href={selectedBroadcast.linkUrl} target="_blank" className="mt-4 block bg-blue-50 border border-blue-200 p-4 rounded-xl text-center text-blue-700 font-bold hover:bg-blue-100">Abrir Enlace: {selectedBroadcast.linkUrl}</a>}
                        </div>

                        {/* COMENTARIOS */}
                        {selectedBroadcast.allowReplies !== false && (
                            <div className="border-t pt-6">
                                <h4 className="font-bold text-sm mb-4">Comentarios</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                                    {(selectedBroadcast.replies || []).map((r, i) => (
                                        <div key={i} className="bg-slate-50 p-3 rounded-xl text-sm">
                                            <span className="font-bold block text-xs text-slate-600 mb-1">{r.fromName}</span>
                                            {r.content}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input className="input-modern py-2 text-sm" placeholder="Comentar..." value={replyText} onChange={e=>setReplyText(e.target.value)}/>
                                    <Button onClick={()=>handleReply(true)}><Icon name="Send"/></Button>
                                </div>
                            </div>
                        )}

                        {/* ACCIONES ADMIN */}
                        {(canBroadcast || selectedBroadcast.from === userProfile.id) && (
                            <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                                <button onClick={()=>handleDelete(selectedBroadcast.id)} className="text-xs text-red-600 font-bold flex gap-1"><Icon name="Trash" size={12}/> Eliminar</button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* MODAL REDACTAR (INPUTS UNIFICADOS) */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['text','poll','link','prayer'].map(t=><button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t==='prayer'?'Oración':t}</button>)}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}>
                            <option value="individual">Persona</option>
                            <option value="group">Ministerio</option>
                            <option value="custom_group">Grupo</option>
                            {canBroadcast && <option value="broadcast">DIFUSIÓN</option>}
                        </Select>
                        
                        {composeForm.context === 'broadcast' ? (
                            <Select label="Categoría" value={composeForm.category} onChange={e=>setComposeForm({...composeForm, category:e.target.value})}>
                                {['General', 'Aviso', 'Reunión', 'Urgente', 'Devocional', 'Oración'].map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        ) : (
                            composeForm.context === 'custom_group' ? (
                                <Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                                    <option value="">Seleccionar...</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </Select>
                            ) : (
                                <Select label={composeForm.context==='group'?'Ministerio':'Persona'} value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                                    <option value="">Seleccionar...</option>
                                    {(composeForm.context==='group' ? ['Alabanza','Jóvenes','Escuela Bíblica','Servidores'] : members).map(o => <option key={o.id||o} value={o.id||o}>{o.name||o}</option>)}
                                </Select>
                            )
                        )}
                    </div>

                    <Input label="Título / Asunto" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>
                    
                    {/* CUERPO DEL MENSAJE (INPUT MODERN) */}
                    <div>
                        <label className="label-modern mb-1">Cuerpo del mensaje</label>
                        <textarea className="input-modern h-32 text-sm resize-none" placeholder="Descripción detallada..." value={composeForm.body} onChange={e=>setComposeForm({...composeForm, body:e.target.value})}/>
                    </div>

                    {composeForm.type === 'poll' && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <label className="label-modern">Opciones</label>
                            {composeForm.pollOptions.map((opt, i) => <Input key={i} placeholder={`Opción ${i+1}`} value={opt} onChange={e=>{const n=[...composeForm.pollOptions];n[i]=e.target.value;setComposeForm({...composeForm, pollOptions:n})}}/>)}
                            <Button size="sm" variant="secondary" onClick={()=>setComposeForm(p=>({...p, pollOptions:[...p.pollOptions, '']}))}>+ Agregar Opción</Button>
                        </div>
                    )}

                    {composeForm.type === 'link' && <Input label="URL (Enlace)" value={composeForm.linkUrl} onChange={e=>setComposeForm({...composeForm, linkUrl:e.target.value})} placeholder="https://..." />}

                    <div className="flex gap-2">
                        <label className={`flex-1 p-3 border rounded-xl flex justify-center items-center gap-2 cursor-pointer transition-colors ${composeForm.attachmentUrl ? 'bg-green-50 border-green-200 text-green-700' : 'hover:bg-slate-50 text-slate-500'}`}>
                            <Icon name="Image" size={16}/> {isUploading?'Subiendo...':(composeForm.attachmentUrl?'Adjunto OK':'Foto/PDF')}
                            <input type="file" className="hidden" onChange={handleImage} disabled={isUploading}/>
                        </label>
                    </div>

                    {composeForm.context === 'broadcast' && (
                        <div className="flex items-center gap-4 pt-2 border-t mt-2">
                            <label className="flex items-center gap-2 text-xs cursor-pointer select-none"><input type="checkbox" checked={composeForm.isPinned} onChange={e=>setComposeForm({...composeForm, isPinned:e.target.checked})} className="rounded text-brand-600 focus:ring-brand-500"/> Fijar Aviso</label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer select-none"><input type="checkbox" checked={composeForm.allowReplies} onChange={e=>setComposeForm({...composeForm, allowReplies:e.target.checked})} className="rounded text-brand-600 focus:ring-brand-500"/> Permitir Respuestas</label>
                        </div>
                    )}

                    <Button className="w-full py-3 text-base shadow-lg mt-4" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>

            {/* MODAL NUEVO GRUPO */}
            <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Nuevo Grupo">
                <div className="space-y-4">
                    <Input label="Nombre del Grupo" value={newGroupForm.name} onChange={e=>setNewGroupForm({...newGroupForm, name:e.target.value})}/>
                    <div>
                        <label className="label-modern mb-2">Integrantes</label>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 custom-scrollbar">
                            {members.map(m => (
                                <div key={m.id} onClick={()=>{const e=newGroupForm.members.includes(m.id);setNewGroupForm({...newGroupForm, members:e?newGroupForm.members.filter(x=>x!==m.id):[...newGroupForm.members,m.id]})}} className={`p-2 rounded-lg cursor-pointer flex justify-between items-center text-xs transition-colors ${newGroupForm.members.includes(m.id)?'bg-brand-50 text-brand-700 font-bold':'hover:bg-slate-50 text-slate-600'}`}>
                                    {m.name} {newGroupForm.members.includes(m.id)&&<Icon name="Check" size={14}/>}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-right text-slate-400 mt-1">{newGroupForm.members.length} seleccionados</p>
                    </div>
                    <Button className="w-full" onClick={handleCreateGroup}>Crear Grupo</Button>
                </div>
            </Modal>
            
            <Modal isOpen={!!imageModal} onClose={()=>setImageModal(null)} title="Vista Previa"><div className="text-center"><img src={imageModal} className="max-h-[60vh] mx-auto rounded shadow mb-4"/><a href={imageModal} download="imagen.jpg" className="inline-block bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-bold">Descargar</a></div></Modal>
        </div>
    );
};
