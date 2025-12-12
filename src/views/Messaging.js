window.Views = window.Views || {};

window.Views.Messaging = ({ userProfile }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const Utils = window.Utils || {};
    const { Button, Input, Select, Icon, compressImage, Modal, Badge } = Utils;

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
    
    // PERMISOS DE ROL
    const isLeader = ['Pastor', 'Líder'].includes(userProfile.role);

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

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [selectedChat]);

    // --- HELPER FECHA LOCAL (Blindado) ---
    const formatMsgDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return ''; // Fallback
            return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        } catch (e) { return ''; }
    };

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
        if (!composeForm.content) return Utils.notify("Falta el Título", "error");
        
        let recipient = composeForm.to;
        if (composeForm.context === 'group') recipient = `group:${composeForm.to}`;
        if (composeForm.context === 'custom_group') recipient = `custom:${composeForm.to}`;
        if (composeForm.context === 'broadcast') recipient = 'all';

        if (composeForm.context !== 'broadcast' && !composeForm.to) return Utils.notify("Selecciona destinatario", "error");

        const msgData = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: recipient,
            type: composeForm.type,
            category: composeForm.category, // SE GUARDA EN ESPAÑOL
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
            if (composeForm.id) {
                await window.db.collection('messages').doc(composeForm.id).update(msgData);
                Utils.notify("Actualizado");
            } else {
                await window.db.collection('messages').add(msgData);
                Utils.notify("Enviado");
            }
            setIsComposeOpen(false);
            setComposeForm(initialCompose);
        } catch(e) { console.error(e); Utils.notify("Error al enviar", "error"); }
    };

    // CREACIÓN DE GRUPO + CHAT AUTOMÁTICO
    const handleCreateGroup = async () => {
        if (!newGroupForm.name || newGroupForm.members.length === 0) return Utils.notify("Faltan datos", "error");
        try {
            const finalMembers = [...new Set([...newGroupForm.members, userProfile.id])];
            
            // 1. Crear Grupo
            const groupRef = await window.db.collection('groups').add({
                name: newGroupForm.name,
                members: finalMembers,
                createdBy: userProfile.name,
                createdAt: new Date().toISOString()
            });

            // 2. Crear mensaje de sistema para inicializar el chat
            await window.db.collection('messages').add({
                from: userProfile.id,
                fromName: 'Sistema',
                to: `custom:${groupRef.id}`,
                type: 'text',
                content: `Grupo "${newGroupForm.name}" creado`,
                body: 'Comienza la conversación.',
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

    // ELIMINACIÓN CON PERMISOS CORREGIDOS
    const handleDelete = async (id, ownerId) => {
        // Pastor/Líder borra cualquiera. Usuario solo el suyo.
        const canDelete = isLeader || ownerId === userProfile.id;
        
        if (canDelete) {
            if(confirm("¿Eliminar mensaje permanentemente?")) {
                await window.db.collection('messages').doc(id).delete();
                if (selectedBroadcast?.id === id) setSelectedBroadcast(null);
                if (selectedChat?.id === id) setSelectedChat(null);
                Utils.notify("Eliminado");
            }
        } else {
            Utils.notify("No tienes permiso para borrar esto", "error");
        }
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
        // Optimistic UI
        setSelectedBroadcast(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
    };

    const handleChatReply = async () => {
        if (!replyText.trim() || !selectedChat) return;
        const newMessage = {
            from: userProfile.id, fromName: userProfile.name,
            to: selectedChat.id || selectedChat.chatId, 
            content: replyText, type: 'text', date: new Date().toISOString(),
            readBy: [userProfile.id], replies: [], reactions: {}
        };
        if (activeTab === 'direct') newMessage.to = selectedChat.id;
        try {
            await window.db.collection('messages').add(newMessage);
            setReplyText("");
        } catch(e) { console.error(e); }
    };

    const handlePin = async (msg) => {
        if (!isLeader) return;
        await window.db.collection('messages').doc(msg.id).update({ isPinned: !msg.isPinned });
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
            linkUrl: msg.linkUrl || '',
            pollOptions: msg.pollOptions ? msg.pollOptions.map(o => o.text) : ['', '']
        });
        setIsComposeOpen(true);
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
                if (isLeader || userProfile.ministry === gName || msg.from === userProfile.id) {
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

    // --- ESTILOS VISUALES ---
    const getCoverStyle = (category) => {
        const styles = {
            'Urgente': 'bg-red-500',
            'Aviso': 'bg-blue-500',
            'Reunión': 'bg-purple-600',
            'Oración': 'bg-amber-500', // COLOR ESPECÍFICO PARA ORACIÓN
            'Devocional': 'bg-emerald-600',
            'General': 'bg-slate-700'
        };
        return styles[category] || styles['General'];
    };
    
    const getCoverIcon = (category) => {
        const icons = { 'Urgente': 'AlertTriangle', 'Aviso': 'Bell', 'Reunión': 'Calendar', 'Devocional': 'Book', 'General': 'Megaphone', 'Oración': 'Smile' }; // Prayer Icon
        return icons[category] || 'Megaphone';
    };

    // --- RENDER ---
    
    // VISTA DIFUSIÓN (DISEÑO TARJETA CON REACCIONES)
    const renderBroadcastView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-enter p-1">
            {categorizedMessages.broadcasts.map(msg => (
                <div key={msg.id} onClick={() => setSelectedBroadcast(msg)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-xl transition-all hover:-translate-y-1 relative flex flex-col h-full">
                    
                    {/* PORTADA: COLOR + ICONO + CATEGORÍA */}
                    <div className="h-32 relative overflow-hidden shrink-0">
                         {msg.attachmentUrl && msg.attachmentType === 'image' ? (
                            <img src={msg.attachmentUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                            <div className={`w-full h-full flex flex-col items-center justify-center text-white ${getCoverStyle(msg.category || 'General')}`}>
                                <div className="bg-white/20 p-3 rounded-full backdrop-blur-md mb-2 shadow-lg">
                                    <Icon name={getCoverIcon(msg.category)} size={28} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-black/20 px-3 py-1 rounded-lg border border-white/10">{msg.category || 'GENERAL'}</span>
                            </div>
                        )}
                        {msg.isPinned && <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 p-1.5 rounded-full shadow-sm z-10"><Icon name="Bell" size={14} className="fill-current"/></div>}
                    </div>
                    
                    <div className="p-4 flex-1 flex flex-col gap-2">
                        <div className="flex justify-between items-center mb-1">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatMsgDate(msg.date)}</span>
                             {msg.type !== 'text' && <Badge type="brand">{msg.type.toUpperCase()}</Badge>}
                        </div>
                        <h3 className="font-extrabold text-lg text-slate-900 leading-tight mb-1 line-clamp-2">{msg.content}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-auto">{msg.body || 'Ver detalles...'}</p>
                        
                        {/* BARRA REACCIONES EN TARJETA (TIPO DEVOCIONAL) */}
                        <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-3">
                            <div className="flex gap-2">
                                {['❤️','🙏','🔥'].map(em => (
                                    <button 
                                        key={em} 
                                        onClick={(e)=>{e.stopPropagation(); handleReaction(msg.id, em)}} 
                                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors border ${msg.reactions?.[userProfile.id]===em ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white'}`}
                                    >
                                        {em} {Object.values(msg.reactions||{}).filter(v=>v===em).length || ''}
                                    </button>
                                ))}
                            </div>
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
                    {chatList.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">No hay chats.</div>}
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
                            {/* ELIMINAR CHAT (LÓGICA PERMISOS) */}
                            {(isLeader || selectedChat.msgs[0].from === userProfile.id) && 
                                <button onClick={()=>handleDelete(selectedChat.id, selectedChat.msgs[0].from)} className="text-red-400 hover:text-red-600"><Icon name="Trash" size={18}/></button>
                            }
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
                            {[...selectedChat.msgs].reverse().map(msg => (
                                <div key={msg.id} className={`flex ${msg.from===userProfile.id?'justify-end':'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg shadow-sm text-sm relative ${msg.from===userProfile.id?'bg-[#d9fdd3] text-slate-900':'bg-white'}`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <div className="text-[9px] text-right mt-1 opacity-50">{formatMsgDate(msg.date)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 bg-white flex gap-2 items-center">
                            <input className="input-modern rounded-full flex-1 py-3" placeholder="Mensaje..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleChatReply()}/>
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

            {/* MODAL LECTURA DIFUSIÓN */}
            {selectedBroadcast && (
                <Modal isOpen={!!selectedBroadcast} onClose={()=>setSelectedBroadcast(null)} title="Comunicado">
                    <div className="space-y-6">
                        <div className={`h-32 rounded-2xl relative flex items-center justify-center overflow-hidden ${selectedBroadcast.attachmentUrl ? '' : getCoverStyle(selectedBroadcast.category)}`}>
                            {selectedBroadcast.attachmentUrl ? <img src={selectedBroadcast.attachmentUrl} className="w-full h-full object-cover"/> : (
                                <div className="text-white text-center"><Icon name={getCoverIcon(selectedBroadcast.category)} size={48} className="mx-auto mb-2 opacity-80"/><h2 className="text-2xl font-black uppercase tracking-widest">{selectedBroadcast.category}</h2></div>
                            )}
                        </div>
                        <div className="px-2">
                            <h2 className="text-xl font-extrabold text-slate-900 mb-2">{selectedBroadcast.content}</h2>
                            <div className="prose prose-slate text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedBroadcast.body}</div>
                            
                            {/* REACCIONES EN MODAL */}
                            <div className="flex gap-2 mt-4 pt-4 border-t">
                                {['👍','❤️','🙏','🔥'].map(em => (
                                    <button key={em} onClick={()=>handleReaction(selectedBroadcast.id, em)} className={`px-3 py-1 rounded-full border text-sm hover:scale-110 transition-transform ${selectedBroadcast.reactions?.[userProfile.id]===em ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-white border-slate-200'}`}>
                                        {em} <span className="text-xs text-slate-500 ml-1">{Object.values(selectedBroadcast.reactions||{}).filter(x=>x===em).length || ''}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {/* ELIMINACIÓN Y EDICIÓN (SOLO LIDERES O DUEÑO) */}
                            {(isLeader || selectedBroadcast.from === userProfile.id) && (
                                <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                                    <button onClick={()=>handleDelete(selectedBroadcast.id, selectedBroadcast.from)} className="text-xs text-red-600 font-bold flex gap-1 items-center"><Icon name="Trash" size={12}/> Eliminar</button>
                                </div>
                            )}

                            {/* COMENTARIOS */}
                            {selectedBroadcast.allowReplies !== false && (
                                <div className="border-t pt-4">
                                    <h4 className="font-bold text-sm mb-3">Comentarios</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                                        {(selectedBroadcast.replies || []).map((r, i) => (
                                            <div key={i} className="bg-slate-50 p-2 rounded text-xs"><span className="font-bold text-slate-600">{r.fromName}: </span>{r.content}</div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2"><input className="input-modern py-2 text-sm" placeholder="Comentar..." value={replyText} onChange={e=>setReplyText(e.target.value)}/><Button onClick={handleBroadcastReply} size="sm"><Icon name="Send"/></Button></div>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL REDACTAR */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                    <div className="flex bg-slate-100 p-1 rounded-xl">{['text','poll','link','prayer'].map(t=><button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t==='prayer'?'Oración':t}</button>)}</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}><option value="individual">Persona</option><option value="group">Ministerio</option><option value="custom_group">Grupo</option>{isLeader&&<option value="broadcast">DIFUSIÓN</option>}</Select>
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
                    
                    <div className="flex gap-2"><label className="flex-1 p-3 border rounded-xl flex justify-center items-center gap-2 cursor-pointer hover:bg-slate-50"><Icon name="Image"/> {isUploading?'...':(composeForm.attachmentUrl?'Adjunto OK':'Foto')}<input type="file" className="hidden" onChange={handleImage}/></label></div>
                    {composeForm.context==='broadcast'&&<div className="flex gap-4 pt-2 border-t"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={composeForm.isPinned} onChange={e=>setComposeForm({...composeForm, isPinned:e.target.checked})}/> Fijar</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={composeForm.allowReplies} onChange={e=>setComposeForm({...composeForm, allowReplies:e.target.checked})}/> Respuestas</label></div>}
                    <Button className="w-full py-3" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>

            <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Nuevo Grupo"><div className="space-y-4"><Input label="Nombre" value={newGroupForm.name} onChange={e=>setNewGroupForm({...newGroupForm, name:e.target.value})}/><div className="max-h-40 overflow-y-auto border p-2 rounded">{members.map(m=><div key={m.id} onClick={()=>{const e=newGroupForm.members.includes(m.id);setNewGroupForm({...newGroupForm, members:e?newGroupForm.members.filter(x=>x!==m.id):[...newGroupForm.members,m.id]})}} className={`p-2 cursor-pointer flex justify-between ${newGroupForm.members.includes(m.id)?'bg-brand-50 text-brand-700':''}`}><span>{m.name}</span>{newGroupForm.members.includes(m.id)&&<Icon name="Check" size={14}/>}</div>)}</div><Button className="w-full" onClick={handleCreateGroup}>Crear</Button></div></Modal>
        </div>
    );
};
