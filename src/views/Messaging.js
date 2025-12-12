window.Views = window.Views || {};

window.Views.Messaging = ({ userProfile }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const Utils = window.Utils || {};
    const { Button, Input, Select, Icon, formatDate, compressImage, Modal, Badge } = Utils;

    // --- ESTADOS ---
    const [activeTab, setActiveTab] = useState('broadcast'); // 'broadcast' | 'ministries' | 'groups' | 'direct' | 'scheduled'
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
        id: null, // Para edición
        to: '', context: 'individual', type: 'text', category: 'General',
        content: '', body: '', 
        isPinned: false, allowReplies: true, 
        attachmentUrl: '', attachmentType: 'image', // image | pdf
        pollOptions: ['', ''], linkUrl: '',
        scheduledAt: '' // Fecha programación
    };
    const [composeForm, setComposeForm] = useState(initialCompose);
    
    const [newGroupForm, setNewGroupForm] = useState({ name: '', members: [] });
    const [replyText, setReplyText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);
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

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [selectedChat, messages]);

    // --- FILTRADO INTELIGENTE ---
    const categorizedMessages = useMemo(() => {
        const now = new Date().toISOString();
        
        // Función de búsqueda profunda
        const matchesSearch = (msg) => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (msg.content || '').toLowerCase().includes(term) || 
                   (msg.body || '').toLowerCase().includes(term) ||
                   (msg.fromName || '').toLowerCase().includes(term);
        };

        const broadcasts = [];
        const ministries = {};
        const customGroups = {};
        const directs = {}; 
        const scheduled = [];

        messages.forEach(msg => {
            // Lógica de Programación: Si tiene fecha futura, solo la ve el autor en "Programados"
            if (msg.scheduledAt && msg.scheduledAt > now) {
                if (msg.from === userProfile.id) scheduled.push(msg);
                return; // No mostrar en otras listas
            }

            if (!matchesSearch(msg)) return;

            // 1. Difusión
            if (msg.to === 'all') {
                broadcasts.push(msg);
                return;
            }
            
            // 2. Ministerios
            if (msg.to.startsWith('group:')) {
                const gName = msg.to.split(':')[1];
                if (userProfile.role === 'Pastor' || userProfile.ministry === gName || msg.from === userProfile.id) {
                    if (!ministries[msg.to]) ministries[msg.to] = { id: msg.to, title: gName, msgs: [] };
                    ministries[msg.to].msgs.push(msg);
                }
                return;
            }

            // 3. Grupos Personalizados
            if (msg.to.startsWith('custom:')) {
                const gId = msg.to.split(':')[1];
                const grpData = groups.find(g => g.id === gId);
                if (grpData && (grpData.members.includes(userProfile.id) || msg.from === userProfile.id)) {
                    if (!customGroups[msg.to]) customGroups[msg.to] = { id: msg.to, title: grpData.name, msgs: [] };
                    customGroups[msg.to].msgs.push(msg);
                }
                return;
            }

            // 4. Directos
            if (msg.to === userProfile.id || msg.from === userProfile.id) {
                const otherId = msg.from === userProfile.id ? msg.to : msg.from;
                const chatId = [userProfile.id, otherId].sort().join('_');
                if (!directs[chatId]) {
                    const otherUser = members.find(m => m.id === otherId);
                    directs[chatId] = { 
                        id: otherId, 
                        chatId, 
                        title: otherUser ? otherUser.name : 'Usuario', 
                        photo: otherUser?.photo,
                        msgs: [] 
                    };
                }
                directs[chatId].msgs.push(msg);
            }
        });

        // Ordenar chats por último mensaje
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

    // --- ACCIONES ---
    const handleAttachment = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            // Detectar tipo
            const type = file.type.includes('pdf') ? 'pdf' : 'image';
            // Para PDFs usamos FileReader básico a Base64, para imágenes comprimimos
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
        } catch(err) { console.error(err); Utils.notify("Error al adjuntar", "error"); }
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
            type: composeForm.type, // text, poll, link, prayer
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
            // Datos que no se sobreescriben al editar si no es necesario
            ...(!composeForm.id && {
                date: new Date().toISOString(),
                readBy: [userProfile.id],
                replies: [],
                reactions: {},
                prayedBy: [] // Para peticiones
            })
        };

        try {
            if (composeForm.id) {
                // EDICIÓN
                await window.db.collection('messages').doc(composeForm.id).update(msgData);
                Utils.notify("Mensaje actualizado");
            } else {
                // NUEVO
                await window.db.collection('messages').add(msgData);
                Utils.notify(composeForm.scheduledAt ? "Mensaje programado" : "Enviado");
            }
            setIsComposeOpen(false);
            setComposeForm(initialCompose);
        } catch(e) { console.error(e); }
    };

    const handleEditMessage = (msg) => {
        setComposeForm({
            id: msg.id,
            to: msg.to.startsWith('group:') ? msg.to.split(':')[1] : (msg.to.startsWith('custom:') ? msg.to.split(':')[1] : msg.to),
            context: msg.to === 'all' ? 'broadcast' : (msg.to.startsWith('group:') ? 'group' : (msg.to.startsWith('custom:') ? 'custom_group' : 'individual')),
            type: msg.type || 'text',
            category: msg.category || 'General',
            content: msg.content,
            body: msg.body,
            isPinned: msg.isPinned,
            allowReplies: msg.allowReplies !== false,
            attachmentUrl: msg.attachmentUrl || '',
            attachmentType: msg.attachmentType || 'image',
            linkUrl: msg.linkUrl || '',
            pollOptions: msg.pollOptions ? msg.pollOptions.map(o => o.text) : ['', ''],
            scheduledAt: msg.scheduledAt || ''
        });
        setIsComposeOpen(true);
    };

    // --- ACCIONES DE MENSAJES ---
    const handleChatReply = async () => {
        if (!replyText.trim() || !selectedChat) return;
        const reply = {
            id: Date.now(),
            from: userProfile.id,
            fromName: userProfile.name,
            content: replyText,
            date: new Date().toISOString()
        };
        try {
            // En chats directos/grupos, enviamos un nuevo mensaje al stream (estilo WhatsApp)
            // NOTA: Para mantener consistencia con el diseño anterior, aquí estamos insertando en una colección plana
            // Si quieres hilos, usa replies. Si quieres chat fluido, usa add() nuevo mensaje.
            // Usaremos add() para chats normales y update() para Difusión (comentarios)
            
            const newMessage = {
                from: userProfile.id,
                fromName: userProfile.name,
                to: selectedChat.id || selectedChat.chatId, // ID destino real
                content: replyText,
                type: 'text',
                date: new Date().toISOString(),
                readBy: [userProfile.id],
                replies: [], reactions: {}
            };
            
            // Corrección ID destino para DMs
            if (activeTab === 'direct') newMessage.to = selectedChat.id;

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
        // Optimistic update
        setSelectedBroadcast(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
    };

    const handlePray = async (msgId) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const prayed = msg.prayedBy || [];
        const newPrayed = prayed.includes(userProfile.id) ? prayed.filter(id => id !== userProfile.id) : [...prayed, userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ prayedBy: newPrayed });
    };

    const handleReaction = async (msgId, emoji) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const current = msg.reactions || {};
        if (current[userProfile.id] === emoji) delete current[userProfile.id];
        else current[userProfile.id] = emoji;
        await window.db.collection('messages').doc(msgId).update({ reactions: current });
    };

    const handlePin = async (msg) => {
        if (userProfile.role !== 'Pastor') return;
        await window.db.collection('messages').doc(msg.id).update({ isPinned: !msg.isPinned });
        Utils.notify(msg.isPinned ? "Desfijado" : "Fijado");
    };

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar para todos?")) {
            await window.db.collection('messages').doc(id).delete();
            if(selectedBroadcast?.id === id) setSelectedBroadcast(null);
        }
    };

    const handleCreateGroup = async () => { /* ... Mismo código de grupos ... */
        if (!newGroupForm.name || newGroupForm.members.length === 0) return Utils.notify("Datos faltantes", "error");
        await window.db.collection('groups').add({ name: newGroupForm.name, members: [...new Set([...newGroupForm.members, userProfile.id])], createdBy: userProfile.name, createdAt: new Date().toISOString() });
        setIsGroupModalOpen(false); setNewGroupForm({ name: '', members: [] });
    };

    const handleVote = async (msgId, idx) => { /* ... Mismo código votos ... */ 
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const opts = [...msg.pollOptions];
        opts.forEach(op => { if (op.votes?.includes(userProfile.id)) op.votes = op.votes.filter(id => id !== userProfile.id); });
        opts[idx].votes = [...(opts[idx].votes || []), userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ pollOptions: opts });
    };

    // --- ESTILOS VISUALES ---
    const getCoverStyle = (category) => {
        const styles = {
            'Urgente': 'bg-gradient-to-r from-red-500 to-rose-600',
            'Aviso': 'bg-gradient-to-r from-blue-500 to-cyan-500',
            'Reunión': 'bg-gradient-to-r from-violet-500 to-purple-600',
            'Devocional': 'bg-gradient-to-r from-emerald-500 to-teal-600',
            'General': 'bg-gradient-to-r from-slate-600 to-slate-800'
        };
        return styles[category] || styles['General'];
    };

    // --- RENDERIZADO ---
    
    // VISTA DIFUSIÓN (Cards)
    const renderBroadcastView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-enter">
            {/* Mensajes Programados (Solo yo) */}
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

            {/* Mensajes Públicos */}
            {categorizedMessages.broadcasts.map(msg => (
                <div key={msg.id} onClick={() => setSelectedBroadcast(msg)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-xl transition-all hover:-translate-y-1 relative">
                    {/* Badge Petición */}
                    {msg.type === 'prayer' && <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20">PETICIÓN DE ORACIÓN</div>}
                    
                    <div className={`h-32 relative flex items-center justify-center overflow-hidden ${msg.attachmentUrl && msg.attachmentType==='image' ? '' : getCoverStyle(msg.category || 'General')}`}>
                        {msg.attachmentUrl && msg.attachmentType==='image' ? (
                            <img src={msg.attachmentUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                            <Icon name={msg.type === 'prayer' ? 'Smile' : 'Megaphone'} size={40} className="text-white/20"/>
                        )}
                        {msg.isPinned && <div className="absolute top-2 left-2 bg-white/90 p-1.5 rounded-full shadow-sm"><Icon name="Bell" size={14} className="text-orange-500 fill-current"/></div>}
                    </div>
                    
                    <div className="p-5">
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${msg.type==='prayer'?'text-yellow-600':'text-brand-600'}`}>{msg.category || (msg.type==='prayer'?'Oración':'General')}</span>
                            <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                        </div>
                        <h3 className="font-extrabold text-lg text-slate-900 leading-tight mb-2 line-clamp-2">{msg.content}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-4">{msg.body || 'Ver detalles...'}</p>
                        
                        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">{msg.fromName.charAt(0)}</div>
                                <span className="text-xs text-slate-500 font-medium truncate max-w-[100px]">{msg.fromName}</span>
                            </div>
                            {msg.type === 'prayer' ? (
                                <span className="text-xs font-bold text-yellow-600 flex items-center gap-1"><Icon name="Smile" size={14}/> {msg.prayedBy?.length || 0} oraron</span>
                            ) : (
                                <span className="text-xs font-bold text-brand-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Leer <Icon name="ArrowRight" size={12}/></span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    // VISTA CHAT (Mismo estilo anterior + Funciones nuevas)
    const renderChatInterface = (chatList) => (
        <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200 h-full animate-enter">
            {/* Lista Chats (Igual que antes) */}
            <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 bg-white"><Input placeholder="Buscar..." className="py-2 text-sm" /></div>
                <div className="flex-1 overflow-y-auto">
                    {chatList.map(chat => (
                        <div key={chat.chatId||chat.id} onClick={()=>setSelectedChat(chat)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white transition-colors ${selectedChat?.id===chat.id?'bg-white border-l-4 border-l-brand-500':'border-l-4 border-l-transparent'}`}>
                            <h4 className="font-bold text-sm">{chat.title}</h4>
                            <p className="text-xs text-slate-500 truncate">{chat.msgs[0]?.content}</p>
                        </div>
                    ))}
                </div>
            </div>
            {/* Area Chat */}
            <div className={`flex-1 flex flex-col bg-[#eef2f6] relative ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                {selectedChat ? (
                    <>
                        <div className="p-3 bg-white border-b flex justify-between items-center shadow-sm z-10">
                            <button onClick={()=>setSelectedChat(null)} className="md:hidden"><Icon name="ChevronLeft"/></button>
                            <h3 className="font-bold">{selectedChat.title}</h3>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
                            {[...selectedChat.msgs].reverse().map(msg => (
                                <div key={msg.id} className={`flex ${msg.from===userProfile.id?'justify-end':'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg shadow-sm text-sm relative ${msg.from===userProfile.id?'bg-[#d9fdd3] text-slate-900':'bg-white'}`}>
                                        {msg.from!==userProfile.id && <p className="text-[10px] font-bold text-orange-600 mb-1">{msg.fromName}</p>}
                                        {msg.attachmentUrl && (
                                            msg.attachmentType === 'pdf' ? (
                                                <a href={msg.attachmentUrl} download className="flex items-center gap-2 bg-slate-100 p-2 rounded mb-2 border hover:bg-slate-200"><Icon name="Paperclip" size={16}/> Archivo PDF</a>
                                            ) : <img src={msg.attachmentUrl} className="rounded mb-2 max-h-48 cursor-pointer" onClick={()=>setImageModal(msg.attachmentUrl)}/>
                                        )}
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <div className="text-[9px] text-right mt-1 opacity-50">{formatDate(msg.date, 'time')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 bg-white flex gap-2">
                            <input className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm outline-none" value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleChatReply()}/>
                            <button onClick={handleChatReply} className="p-2 bg-brand-600 text-white rounded-full"><Icon name="Send" size={16}/></button>
                        </div>
                    </>
                ) : <div className="flex-1 flex items-center justify-center text-slate-400">Selecciona un chat</div>}
            </div>
        </div>
    );

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    {[{id:'broadcast',label:'Difusión',icon:'Megaphone'},{id:'ministries',label:'Ministerios',icon:'Briefcase'},{id:'groups',label:'Grupos',icon:'Users'},{id:'direct',label:'Chats',icon:'MessageCircle'}].map(t=>(
                        <button key={t.id} onClick={()=>{setActiveTab(t.id);setSelectedChat(null);}} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab===t.id?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500 hover:bg-slate-50'}`}><Icon name={t.icon} size={16}/><span className="hidden md:inline">{t.label}</span></button>
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
                <Modal isOpen={!!selectedBroadcast} onClose={()=>setSelectedBroadcast(null)} title="Lectura">
                    <div className="space-y-6">
                        {/* Header tipo Petición o Normal */}
                        {selectedBroadcast.type === 'prayer' ? (
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-center">
                                <Icon name="Smile" size={32} className="mx-auto text-yellow-600 mb-2"/>
                                <h3 className="font-bold text-yellow-800 text-lg">Petición de Oración</h3>
                                <p className="text-sm text-yellow-700">{selectedBroadcast.content}</p>
                                <div className="mt-4">
                                    <button onClick={()=>handlePray(selectedBroadcast.id)} className={`px-6 py-2 rounded-full font-bold transition-all ${selectedBroadcast.prayedBy?.includes(userProfile.id) ? 'bg-yellow-600 text-white' : 'bg-white border border-yellow-300 text-yellow-600'}`}>
                                        🙏 {selectedBroadcast.prayedBy?.includes(userProfile.id) ? 'Ya oraste' : 'Orar por esto'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Header Normal
                            <>
                                {selectedBroadcast.attachmentUrl && (
                                    selectedBroadcast.attachmentType === 'pdf' ? (
                                        <a href={selectedBroadcast.attachmentUrl} target="_blank" className="flex items-center gap-3 bg-slate-100 p-4 rounded-xl border hover:bg-slate-200">
                                            <Icon name="Paperclip" size={24} className="text-slate-500"/>
                                            <div><p className="font-bold text-slate-700">Archivo Adjunto</p><p className="text-xs text-slate-500">Clic para descargar PDF</p></div>
                                        </a>
                                    ) : <img src={selectedBroadcast.attachmentUrl} className="w-full max-h-64 object-cover rounded-xl"/>
                                )}
                                <h2 className="text-2xl font-extrabold text-slate-900">{selectedBroadcast.content}</h2>
                                {selectedBroadcast.body && <div className="prose prose-slate text-sm text-slate-700 whitespace-pre-wrap">{selectedBroadcast.body}</div>}
                            </>
                        )}
                        
                        {/* Acciones Admin */}
                        {(canBroadcast || selectedBroadcast.from === userProfile.id) && (
                            <div className="flex gap-2 justify-end border-t pt-2">
                                <button onClick={()=>{handleEditMessage(selectedBroadcast); setSelectedBroadcast(null);}} className="text-xs font-bold text-blue-600 flex items-center gap-1"><Icon name="Edit" size={12}/> Editar</button>
                                <button onClick={()=>handleDelete(selectedBroadcast.id)} className="text-xs font-bold text-red-600 flex items-center gap-1"><Icon name="Trash" size={12}/> Eliminar</button>
                            </div>
                        )}

                        {/* Comentarios (Si habilitados) */}
                        {selectedBroadcast.type !== 'prayer' && (
                            <div className="border-t pt-6">
                                <h4 className="font-bold text-sm mb-4">Comentarios</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                                    {(selectedBroadcast.replies || []).map((r, i) => (
                                        <div key={i} className="bg-slate-50 p-3 rounded-xl text-sm">
                                            <span className="font-bold block text-xs text-slate-500">{r.fromName}</span>
                                            {r.content}
                                        </div>
                                    ))}
                                </div>
                                {selectedBroadcast.allowReplies ? (
                                    <div className="flex gap-2">
                                        <input className="input-modern py-2 text-sm" placeholder="Comentar..." value={replyText} onChange={e=>setReplyText(e.target.value)}/>
                                        <Button onClick={handleBroadcastReply}><Icon name="Send"/></Button>
                                    </div>
                                ) : <p className="text-center text-xs text-slate-400 italic">Comentarios desactivados.</p>}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* MODAL REDACTAR */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    {/* Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['text','poll','link','prayer'].map(t => (
                            <button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t==='prayer'?'Oración':t}</button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}>
                            <option value="individual">Persona</option>
                            <option value="group">Ministerio</option>
                            <option value="custom_group">Grupo</option>
                            {canBroadcast && <option value="broadcast">DIFUSIÓN</option>}
                        </Select>
                        {composeForm.context==='broadcast' && (
                            <Select label="Categoría" value={composeForm.category} onChange={e=>setComposeForm({...composeForm, category:e.target.value})}>
                                {['General', 'Aviso', 'Reunión', 'Urgente', 'Devocional'].map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        )}
                        {/* Otros selectores de destino... */}
                        {composeForm.context==='individual'&&<Select label="Para" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select>}
                        {composeForm.context==='group'&&<Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{['Alabanza','Jóvenes','Escuela Bíblica'].map(g=><option key={g} value={g}>{g}</option>)}</Select>}
                        {composeForm.context==='custom_group'&&<Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
                    </div>

                    <Input label={composeForm.type==='prayer'?'Motivo de Oración':'Título / Asunto'} value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>
                    
                    {['text','prayer'].includes(composeForm.type) && (
                        <>
                            <textarea className="input-modern h-24 text-sm" placeholder="Cuerpo del mensaje..." value={composeForm.body} onChange={e=>setComposeForm({...composeForm, body:e.target.value})}/>
                            <div className="flex gap-2">
                                <label className="flex-1 p-2 border rounded cursor-pointer text-xs flex items-center justify-center gap-1 hover:bg-slate-50">
                                    <Icon name="Paperclip"/> {isUploading?'...':(composeForm.attachmentUrl?'Adjunto OK':'Foto/PDF')}
                                    <input type="file" className="hidden" onChange={handleAttachment} disabled={isUploading}/>
                                </label>
                                <div className="flex-1">
                                    <Input type="datetime-local" value={composeForm.scheduledAt} onChange={e=>setComposeForm({...composeForm, scheduledAt:e.target.value})} className="text-xs"/>
                                </div>
                            </div>
                        </>
                    )}

                    {composeForm.type === 'poll' && (
                        <div className="bg-slate-50 p-3 rounded-xl border space-y-2">
                            <label className="label-modern">Opciones</label>
                            {composeForm.pollOptions.map((opt, i) => (
                                <input key={i} className="input-modern py-1.5 text-xs" placeholder={`Opción ${i+1}`} value={opt} onChange={e=>{const n=[...composeForm.pollOptions];n[i]=e.target.value;setComposeForm({...composeForm, pollOptions:n})}}/>
                            ))}
                            <Button size="sm" variant="secondary" onClick={()=>setComposeForm(p=>({...p, pollOptions:[...p.pollOptions, '']}))}>+ Opción</Button>
                        </div>
                    )}

                    {composeForm.type === 'link' && <Input label="URL" value={composeForm.linkUrl} onChange={e=>setComposeForm({...composeForm, linkUrl:e.target.value})}/>}

                    {composeForm.context === 'broadcast' && composeForm.type !== 'prayer' && (
                        <div className="flex items-center gap-4 pt-2 border-t">
                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={composeForm.isPinned} onChange={e=>setComposeForm({...composeForm, isPinned:e.target.checked})}/> Fijar Aviso</label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={composeForm.allowReplies} onChange={e=>setComposeForm({...composeForm, allowReplies:e.target.checked})}/> Permitir Respuestas</label>
                        </div>
                    )}

                    <Button className="w-full py-3" onClick={handleSend} disabled={isUploading}>{composeForm.scheduledAt ? 'Programar Envío' : 'Enviar'}</Button>
                </div>
            </Modal>

            {/* MODAL IMAGEN */}
            <Modal isOpen={!!imageModal} onClose={()=>setImageModal(null)} title="Vista Previa"><div className="text-center"><img src={imageModal} className="max-h-[60vh] mx-auto rounded shadow mb-4"/><a href={imageModal} download="archivo.jpg" className="inline-block bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-bold">Descargar</a></div></Modal>
            
            {/* MODAL VISTOS */}
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Visto por"><div className="max-h-60 overflow-y-auto space-y-1">{viewersModal?.readBy?.map((uid,i)=><div key={i} className="p-2 border-b text-sm text-slate-600">{members.find(m=>m.id===uid)?.name || 'Usuario'}</div>)}</div></Modal>

             {/* MODAL CREAR GRUPO */}
             <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Nuevo Grupo">
                <div className="space-y-4">
                    <Input label="Nombre" value={newGroupForm.name} onChange={e=>setNewGroupForm({...newGroupForm, name:e.target.value})}/>
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
        </div>
    );
};
