window.Views = window.Views || {};

window.Views.Messaging = ({ userProfile }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const Utils = window.Utils || {};
    const { Button, Input, Select, Icon, formatDate, compressImage, Modal, Badge } = Utils;

    // --- ESTADOS ---
    const [activeTab, setActiveTab] = useState('broadcast'); // 'broadcast' | 'ministries' | 'groups' | 'direct'
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);
    
    // Estados de Interfaz
    const [selectedChat, setSelectedChat] = useState(null); // Para vista Chat
    const [selectedBroadcast, setSelectedBroadcast] = useState(null); // Para vista Lectura Difusión
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [imageModal, setImageModal] = useState(null);
    const [viewersModal, setViewersModal] = useState(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

    // Formularios
    const [composeForm, setComposeForm] = useState({ 
        to: '', context: 'individual', type: 'text', content: '', body: '', 
        isPinned: false, allowReplies: true, category: 'General', // Para portadas
        attachmentUrl: '', pollOptions: ['', ''], linkUrl: ''
    });
    const [replyText, setReplyText] = useState('');
    const [newGroupForm, setNewGroupForm] = useState({ name: '', members: [] });
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);
    const canBroadcast = ['Pastor', 'Líder'].includes(userProfile.role);

    // --- CONEXIÓN FIREBASE ---
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

    // --- CLASIFICACIÓN DE MENSAJES ---
    const categorizedMessages = useMemo(() => {
        const broadcasts = [];
        const ministries = {};
        const customGroups = {};
        const directs = {}; // Agruparemos por ID de conversación

        messages.forEach(msg => {
            // 1. Difusión
            if (msg.to === 'all') {
                broadcasts.push(msg);
                return;
            }
            
            // 2. Ministerios
            if (msg.to.startsWith('group:')) {
                const gName = msg.to.split(':')[1];
                // Solo mostrar si pertenezco o soy pastor
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
                // Solo si soy miembro del grupo
                if (grpData && (grpData.members.includes(userProfile.id) || msg.from === userProfile.id)) {
                    if (!customGroups[msg.to]) customGroups[msg.to] = { id: msg.to, title: grpData.name, msgs: [] };
                    customGroups[msg.to].msgs.push(msg);
                }
                return;
            }

            // 4. Directos
            if (msg.to === userProfile.id || msg.from === userProfile.id) {
                const otherId = msg.from === userProfile.id ? msg.to : msg.from;
                const chatId = [userProfile.id, otherId].sort().join('_'); // ID único de conversación
                if (!directs[chatId]) {
                    const otherUser = members.find(m => m.id === otherId);
                    directs[chatId] = { 
                        id: otherId, // ID del usuario destino para enviar
                        chatId, // ID para agrupar visualmente
                        title: otherUser ? otherUser.name : 'Usuario', 
                        photo: otherUser?.photo,
                        msgs: [] 
                    };
                }
                directs[chatId].msgs.push(msg);
            }
        });

        return {
            broadcasts,
            ministries: Object.values(ministries),
            groups: Object.values(customGroups),
            directs: Object.values(directs).sort((a,b) => { // Ordenar por último mensaje
                const lastA = a.msgs[0]?.date || 0;
                const lastB = b.msgs[0]?.date || 0;
                return new Date(lastB) - new Date(lastA);
            })
        };
    }, [messages, userProfile, members, groups]);

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
        if (!composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Falta contenido", "error");
        
        let recipient = composeForm.to;
        if (composeForm.context === 'group') recipient = `group:${composeForm.to}`;
        if (composeForm.context === 'custom_group') recipient = `custom:${composeForm.to}`;
        if (composeForm.context === 'broadcast') recipient = 'all';

        const newMessage = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: recipient,
            type: composeForm.type,
            category: composeForm.category, // Nuevo: Estilo de portada
            content: composeForm.content,
            body: composeForm.body,
            isPinned: composeForm.isPinned,
            allowReplies: composeForm.allowReplies,
            attachmentUrl: composeForm.attachmentUrl,
            linkUrl: composeForm.linkUrl,
            pollOptions: composeForm.type === 'poll' ? composeForm.pollOptions.map(o => ({ text: o, votes: [] })) : [],
            date: new Date().toISOString(),
            readBy: [userProfile.id],
            replies: [],
            reactions: {}
        };

        try {
            await window.db.collection('messages').add(newMessage);
            setIsComposeOpen(false);
            setComposeForm({ 
                to: '', context: 'individual', type: 'text', content: '', body: '', category: 'General',
                isPinned: false, allowReplies: true, attachmentUrl: '', pollOptions: ['',''], linkUrl: '' 
            });
            Utils.notify("Enviado");
        } catch(e) { console.error(e); }
    };

    // Chat Actions (Reply, React, etc. - Similar a la versión anterior pero adaptada)
    const handleChatReply = async () => {
        // Lógica para chats normales (Grupos/Directos)
        // En este modelo, enviamos un NUEVO mensaje a la colección, no un "reply" anidado, para mantener el flujo de chat real.
        if (!replyText.trim() || !selectedChat) return;
        
        const newMessage = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: selectedChat.id, // ID del grupo o del usuario destino
            content: replyText,
            type: 'text',
            date: new Date().toISOString(),
            readBy: [userProfile.id],
            replies: [], reactions: {}
        };
        
        // Si es directo, asegurarnos que 'to' sea el ID del otro usuario, no el ID compuesto del chat
        if (activeTab === 'direct') {
            newMessage.to = selectedChat.id; // En directs, guardamos el ID del otro usuario en .id del objeto agrupado
        }

        try {
            await window.db.collection('messages').add(newMessage);
            setReplyText("");
        } catch(e) { console.error(e); }
    };

    const handleBroadcastReply = async () => {
        // Lógica para Difusión (Aquí SI usamos replies anidados porque es tipo Blog)
        if (!replyText.trim() || !selectedBroadcast) return;
        const reply = {
            id: Date.now(),
            from: userProfile.id,
            fromName: userProfile.name,
            content: replyText,
            date: new Date().toISOString()
        };
        try {
            await window.db.collection('messages').doc(selectedBroadcast.id).update({
                replies: firebase.firestore.FieldValue.arrayUnion(reply)
            });
            setReplyText("");
            // Optimistic Update
            setSelectedBroadcast(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
        } catch(e) { console.error(e); }
    };
    
    // Auxiliares de Estilo
    const getCoverStyle = (category) => {
        const styles = {
            'Urgente': 'bg-gradient-to-br from-red-500 to-orange-600',
            'Aviso': 'bg-gradient-to-br from-blue-500 to-cyan-500',
            'Reunión': 'bg-gradient-to-br from-purple-500 to-indigo-600',
            'Devocional': 'bg-gradient-to-br from-emerald-400 to-teal-600',
            'General': 'bg-gradient-to-br from-slate-500 to-slate-700'
        };
        return styles[category] || styles['General'];
    };

    const getCoverIcon = (category) => {
        const icons = { 'Urgente': 'AlertTriangle', 'Aviso': 'Bell', 'Reunión': 'Calendar', 'Devocional': 'Book', 'General': 'Megaphone' };
        return icons[category] || 'Megaphone';
    };

    // --- RENDERIZADO ---

    // 1. VISTA DE DIFUSIÓN (BLOG STYLE)
    const renderBroadcastView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-enter">
            {categorizedMessages.broadcasts.map(msg => (
                <div key={msg.id} onClick={() => setSelectedBroadcast(msg)} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-lg transition-all hover:-translate-y-1">
                    {/* PORTADA */}
                    <div className={`h-40 relative flex items-center justify-center ${msg.attachmentUrl ? '' : getCoverStyle(msg.category || 'General')}`}>
                        {msg.attachmentUrl ? (
                            <img src={msg.attachmentUrl} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-white flex flex-col items-center gap-2">
                                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                    <Icon name={getCoverIcon(msg.category)} size={32} />
                                </div>
                                <span className="font-bold uppercase tracking-widest text-xs">{msg.category || 'COMUNICADO'}</span>
                            </div>
                        )}
                        {msg.isPinned && <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 p-1.5 rounded-full shadow-sm"><Icon name="Bell" size={14} className="fill-current"/></div>}
                    </div>
                    
                    {/* CONTENIDO */}
                    <div className="p-5">
                        <h3 className="font-bold text-lg text-slate-800 leading-tight mb-2 line-clamp-2">{msg.content}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-4">{msg.body || 'Haz clic para leer más...'}</p>
                        
                        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">{msg.fromName.charAt(0)}</div>
                                <span className="text-xs text-slate-400 font-medium">{formatDate(msg.date)}</span>
                            </div>
                            <span className="text-xs font-bold text-brand-600 flex items-center gap-1 group-hover:underline">Leer <Icon name="ArrowRight" size={12}/></span>
                        </div>
                    </div>
                </div>
            ))}
            {categorizedMessages.broadcasts.length === 0 && <div className="col-span-full py-12 text-center text-slate-400">No hay comunicados recientes.</div>}
        </div>
    );

    // 2. VISTA DE CHAT (WHATSAPP STYLE)
    const renderChatInterface = (chatList) => (
        <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200 h-full animate-enter">
            
            {/* SIDEBAR LISTA */}
            <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Input placeholder="Buscar chat..." className="py-2 text-sm" />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {chatList.map(chat => {
                        const lastMsg = chat.msgs[0]; // El más reciente (asumiendo orden descendente en array)
                        return (
                            <div key={chat.chatId || chat.id} onClick={() => setSelectedChat(chat)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white transition-colors ${selectedChat?.id === chat.id ? 'bg-white border-l-4 border-l-brand-500' : 'border-l-4 border-l-transparent'}`}>
                                <div className="flex justify-between mb-1">
                                    <h4 className="font-bold text-sm text-slate-800 truncate">{chat.title}</h4>
                                    <span className="text-[10px] text-slate-400">{lastMsg ? formatDate(lastMsg.date) : ''}</span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{lastMsg?.content || 'Imagen'}</p>
                            </div>
                        );
                    })}
                    {chatList.length === 0 && <div className="p-8 text-center text-slate-400 text-xs">No hay conversaciones activas.</div>}
                </div>
            </div>

            {/* AREA DE CHAT */}
            <div className={`flex-1 flex flex-col bg-[#efeae2] relative ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                {selectedChat ? (
                    <>
                        <div className="p-3 bg-white border-b flex justify-between items-center shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={()=>setSelectedChat(null)} className="md:hidden text-slate-500"><Icon name="ChevronLeft"/></button>
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">{selectedChat.title.charAt(0)}</div>
                                <h3 className="font-bold text-slate-800">{selectedChat.title}</h3>
                            </div>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
                            {/* Renderizar mensajes en orden cronológico (reverse del array original) */}
                            {[...selectedChat.msgs].reverse().map(msg => (
                                <div key={msg.id} className={`flex ${msg.from === userProfile.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg shadow-sm text-sm relative ${msg.from === userProfile.id ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none'}`}>
                                        {msg.from !== userProfile.id && activeTab !== 'direct' && <p className="text-[10px] font-bold text-orange-600 mb-0.5">{msg.fromName}</p>}
                                        
                                        {msg.attachmentUrl && <img src={msg.attachmentUrl} className="rounded mb-2 max-h-60 object-cover cursor-pointer" onClick={()=>setImageModal(msg.attachmentUrl)}/>}
                                        
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        
                                        <div className="text-[9px] text-right mt-1 opacity-50 flex justify-end gap-1 items-center">
                                            {formatDate(msg.date, 'time')}
                                            {msg.from === userProfile.id && <Icon name="Check" size={12} className="text-blue-500"/>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 bg-white">
                            <div className="flex items-center gap-2">
                                <input className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2.5 text-sm outline-none" placeholder="Escribe un mensaje..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleChatReply()}/>
                                <button onClick={handleChatReply} className="p-2.5 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors"><Icon name="Send" size={18}/></button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-[#f0f2f5]">
                        <Icon name="MessageCircle" size={64} className="opacity-20 mb-4"/>
                        <p className="font-medium text-sm">Selecciona un chat para comenzar</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            {/* HEADER & PESTAÑAS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    {[
                        { id: 'broadcast', label: 'Difusión', icon: 'Megaphone' },
                        { id: 'ministries', label: 'Ministerios', icon: 'Briefcase' },
                        { id: 'groups', label: 'Grupos', icon: 'Users' },
                        { id: 'direct', label: 'Chats', icon: 'MessageCircle' }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedChat(null); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-brand-50 text-brand-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <Icon name={tab.icon} size={16} /> <span className="hidden md:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" icon="Users" onClick={()=>setIsGroupModalOpen(true)}>Nuevo Grupo</Button>
                    <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Redactar</Button>
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'broadcast' && (
                    <div className="h-full overflow-y-auto pr-2 pb-10">
                        {renderBroadcastView()}
                    </div>
                )}
                {activeTab === 'ministries' && renderChatInterface(categorizedMessages.ministries)}
                {activeTab === 'groups' && renderChatInterface(categorizedMessages.groups)}
                {activeTab === 'direct' && renderChatInterface(categorizedMessages.directs)}
            </div>

            {/* MODAL LECTURA DIFUSIÓN */}
            {selectedBroadcast && (
                <Modal isOpen={!!selectedBroadcast} onClose={()=>setSelectedBroadcast(null)} title="Comunicado">
                    <div className="space-y-6">
                        {/* Header con Portada */}
                        <div className={`h-40 rounded-2xl relative flex items-center justify-center overflow-hidden ${selectedBroadcast.attachmentUrl ? '' : getCoverStyle(selectedBroadcast.category)}`}>
                            {selectedBroadcast.attachmentUrl ? <img src={selectedBroadcast.attachmentUrl} className="w-full h-full object-cover"/> : <Icon name={getCoverIcon(selectedBroadcast.category)} size={48} className="text-white/50"/>}
                        </div>
                        
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{selectedBroadcast.content}</h2>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                <span className="font-bold text-brand-600">{selectedBroadcast.fromName}</span>
                                <span>•</span>
                                <span>{formatDate(selectedBroadcast.date, 'full')}</span>
                            </div>
                            <div className="prose prose-slate text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {selectedBroadcast.body}
                            </div>
                        </div>
                        
                        {/* Links y Encuestas */}
                        {selectedBroadcast.type === 'link' && (
                            <a href={selectedBroadcast.linkUrl} target="_blank" className="block bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3 hover:bg-blue-100 transition-colors">
                                <div className="bg-blue-200 p-2 rounded-full text-blue-700"><Icon name="Link"/></div>
                                <div><p className="font-bold text-blue-900 text-sm">Abrir Enlace Adjunto</p><p className="text-xs text-blue-600 truncate">{selectedBroadcast.linkUrl}</p></div>
                            </a>
                        )}

                        {/* Hilo de Respuestas (Si habilitado) */}
                        <div className="border-t border-slate-100 pt-6">
                            <h4 className="font-bold text-sm text-slate-800 mb-4">Comentarios</h4>
                            <div className="space-y-4 max-h-60 overflow-y-auto mb-4">
                                {(selectedBroadcast.replies || []).map((r, i) => (
                                    <div key={i} className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">{r.fromName.charAt(0)}</div>
                                        <div className="bg-slate-50 p-3 rounded-xl rounded-tl-none text-sm flex-1">
                                            <p className="font-bold text-xs text-slate-600 mb-1">{r.fromName}</p>
                                            <p>{r.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {selectedBroadcast.allowReplies !== false ? (
                                <div className="flex gap-2">
                                    <input className="input-modern py-2 text-sm" placeholder="Escribe un comentario..." value={replyText} onChange={e=>setReplyText(e.target.value)}/>
                                    <Button onClick={handleBroadcastReply}><Icon name="Send"/></Button>
                                </div>
                            ) : (
                                <div className="text-center text-xs text-slate-400 bg-slate-50 p-2 rounded-lg italic">Los comentarios están desactivados para este comunicado.</div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL REDACTAR */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                    {/* Tabs Tipo */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['text','poll','link'].map(t => (
                            <button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t==='text'?'Mensaje':(t==='poll'?'Encuesta':'Enlace')}</button>
                        ))}
                    </div>

                    {/* Destino */}
                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}>
                            <option value="individual">Persona</option>
                            <option value="group">Ministerio</option>
                            <option value="custom_group">Grupo</option>
                            {canBroadcast && <option value="broadcast">DIFUSIÓN</option>}
                        </Select>
                        
                        {composeForm.context === 'broadcast' ? (
                            <Select label="Categoría" value={composeForm.category} onChange={e=>setComposeForm({...composeForm, category:e.target.value})}>
                                {['General', 'Aviso', 'Reunión', 'Urgente', 'Devocional'].map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        ) : (
                            // Selectores normales para otros contextos...
                            composeForm.context === 'individual' ? (
                                <Select label="Para" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select>
                            ) : (
                                <Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{(composeForm.context==='group' ? ['Alabanza','Jóvenes','Escuela Bíblica'] : groups.map(g=>g.name)).map(g=><option key={g} value={g}>{g}</option>)}</Select>
                            )
                        )}
                    </div>

                    {/* Contenido */}
                    <Input label="Título / Asunto" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>
                    
                    {composeForm.type !== 'poll' && (
                        <textarea className="input-modern h-32 text-sm" placeholder="Cuerpo del mensaje..." value={composeForm.body} onChange={e=>setComposeForm({...composeForm, body:e.target.value})}/>
                    )}

                    {composeForm.type === 'link' && <Input label="URL" value={composeForm.linkUrl} onChange={e=>setComposeForm({...composeForm, linkUrl:e.target.value})}/>}

                    {composeForm.context === 'broadcast' && (
                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <input type="checkbox" checked={composeForm.allowReplies} onChange={e=>setComposeForm({...composeForm, allowReplies:e.target.checked})} className="w-4 h-4 text-brand-600 rounded"/>
                            <span className="text-xs font-bold text-slate-700">Permitir comentarios públicos</span>
                        </div>
                    )}

                    <Button className="w-full py-3" onClick={handleSend}>Publicar / Enviar</Button>
                </div>
            </Modal>
        </div>
    );
};
