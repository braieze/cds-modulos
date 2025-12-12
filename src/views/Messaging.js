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

    // Formulario Redactar
    const [composeForm, setComposeForm] = useState({ 
        to: '', context: 'individual', type: 'text', content: '', // content = Título en encuestas/links
        body: '', // Nuevo campo para descripción extra
        isPinned: false, allowReplies: true, // Nuevo Toggle
        attachmentUrl: '', pollOptions: ['', ''], linkUrl: ''
    });
    
    const [newGroupForm, setNewGroupForm] = useState({ name: '', members: [] });
    const [replyText, setReplyText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const scrollRef = useRef(null);
    const canBroadcast = ['Pastor', 'Líder'].includes(userProfile.role);

    // --- CONEXIÓN FIREBASE ---
    useEffect(() => {
        if (!window.db) return;
        const unsubMsg = window.db.collection('messages').orderBy('date', 'desc').limit(200).onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(data);
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
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [selectedChat, messages]);

    // --- FILTRADO CHATS ---
    const myChats = useMemo(() => {
        return messages.filter(m => {
            if (m.to === 'all') return true;
            if (m.to === userProfile.id || m.from === userProfile.id) return true;
            if (m.to.startsWith('group:')) {
                const gName = m.to.split(':')[1];
                return userProfile.role === 'Pastor' || userProfile.ministry === gName || m.from === userProfile.id;
            }
            if (m.to.startsWith('custom:')) {
                const gId = m.to.split(':')[1];
                const grp = groups.find(g => g.id === gId);
                return grp && (grp.members.includes(userProfile.id) || m.from === userProfile.id);
            }
            return false;
        });
    }, [messages, userProfile, groups]);

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
        if (!composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Falta título/contenido", "error");
        if (composeForm.type === 'poll' && composeForm.pollOptions.some(o => !o.trim())) return Utils.notify("Completa las opciones", "error");
        
        let recipient = composeForm.to;
        if (composeForm.context === 'group') recipient = `group:${composeForm.to}`;
        if (composeForm.context === 'custom_group') recipient = `custom:${composeForm.to}`;
        if (composeForm.context === 'broadcast') recipient = 'all';

        const newMessage = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: recipient,
            type: composeForm.type,
            content: composeForm.content, // Título principal
            body: composeForm.body, // Descripción secundaria
            isPinned: composeForm.isPinned,
            allowReplies: composeForm.allowReplies, // Nuevo campo
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
                to: '', context: 'individual', type: 'text', content: '', body: '',
                isPinned: false, allowReplies: true, attachmentUrl: '', pollOptions: ['',''], linkUrl: '' 
            });
            Utils.notify("Enviado");
        } catch(e) { console.error(e); }
    };

    const handleCreateGroup = async () => {
        if (!newGroupForm.name || newGroupForm.members.length === 0) return Utils.notify("Nombre y miembros requeridos", "error");
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
            setSelectedChat(prev => ({ ...prev, replies: [...(prev.replies||[]), reply] }));
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
        // Voto único: quitar voto previo
        opts.forEach(op => { if (op.votes?.includes(userProfile.id)) op.votes = op.votes.filter(id => id !== userProfile.id); });
        // Agregar voto
        opts[idx].votes = [...(opts[idx].votes || []), userProfile.id];
        await window.db.collection('messages').doc(msgId).update({ pollOptions: opts });
    };

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar?")) {
            await window.db.collection('messages').doc(id).delete();
            setSelectedChat(null);
        }
    };

    // --- RENDER ---
    const getChatTitle = (msg) => {
        if (msg.to === 'all') return '📢 Difusión General';
        if (msg.to.startsWith('group:')) return `👥 Ministerio: ${msg.to.split(':')[1]}`;
        if (msg.to.startsWith('custom:')) {
            const g = groups.find(grp => grp.id === msg.to.split(':')[1]);
            return `🛡️ ${g ? g.name : 'Grupo'}`;
        }
        return msg.from === userProfile.id ? (members.find(m => m.id === msg.to)?.name || 'Usuario') : msg.fromName;
    };

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col font-sans">
            <div className="flex justify-between items-center flex-shrink-0">
                <h2 className="text-2xl font-extrabold text-slate-800">Mensajes</h2>
                <div className="flex gap-2">
                    <Button variant="secondary" icon="Users" onClick={()=>setIsGroupModalOpen(true)}>Grupos</Button>
                    <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Redactar</Button>
                </div>
            </div>

            <div className="flex flex-1 gap-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200">
                
                {/* LISTA */}
                <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="flex-1 overflow-y-auto">
                        {myChats.map(msg => {
                            const isUnread = !msg.readBy?.includes(userProfile.id);
                            return (
                                <div key={msg.id} onClick={()=>setSelectedChat(msg)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white ${selectedChat?.id===msg.id ? 'bg-white border-l-4 border-l-brand-500' : ''}`}>
                                    <div className="flex justify-between mb-1">
                                        <span className={`font-bold text-sm truncate ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>{getChatTitle(msg)}</span>
                                        <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                                    </div>
                                    <p className={`text-xs truncate ${isUnread ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                        {msg.from===userProfile.id && 'Tú: '} {msg.type === 'poll' ? '📊 Encuesta: ' : (msg.type==='link'?'🔗 ':'')} {msg.content || 'Adjunto'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CHAT */}
                <div className={`flex-1 flex flex-col bg-[#eef2f6] relative ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                    {selectedChat ? (
                        <>
                            <div className="p-4 bg-white border-b flex justify-between items-center z-10 shadow-sm">
                                <button onClick={()=>setSelectedChat(null)} className="md:hidden mr-2"><Icon name="ChevronLeft"/></button>
                                <div>
                                    <h3 className="font-bold text-slate-800">{getChatTitle(selectedChat)}</h3>
                                    <p className="text-xs text-slate-500">{selectedChat.fromName}</p>
                                </div>
                                {(userProfile.role==='Pastor'||selectedChat.from===userProfile.id) && <button onClick={()=>handleDelete(selectedChat.id)}><Icon name="Trash" size={16}/></button>}
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto space-y-6" ref={scrollRef}>
                                {/* Mensaje Principal */}
                                <div className={`flex ${selectedChat.from===userProfile.id?'justify-end':'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm relative group ${selectedChat.from===userProfile.id?'bg-brand-600 text-white rounded-tr-none':'bg-white text-slate-800 rounded-tl-none'}`}>
                                        
                                        {/* CONTENIDO */}
                                        <h4 className="font-bold text-sm mb-2">{selectedChat.content}</h4>
                                        {selectedChat.body && <p className="text-xs opacity-90 mb-3 whitespace-pre-wrap">{selectedChat.body}</p>}
                                        
                                        {selectedChat.attachmentUrl && <img src={selectedChat.attachmentUrl} className="rounded-lg mb-2 max-h-60 object-cover cursor-pointer" onClick={()=>setImageModal(selectedChat.attachmentUrl)}/>}
                                        
                                        {selectedChat.type === 'link' && <a href={selectedChat.linkUrl} target="_blank" className="block bg-black/10 p-3 rounded text-xs underline truncate">{selectedChat.linkUrl}</a>}
                                        
                                        {selectedChat.type === 'poll' && (
                                            <div className="space-y-2 mt-2">
                                                {selectedChat.pollOptions.map((opt, i) => {
                                                    const votes = opt.votes?.length || 0;
                                                    const total = selectedChat.pollOptions.reduce((a,b)=>a+(b.votes?.length||0),0);
                                                    const pct = total ? Math.round((votes/total)*100) : 0;
                                                    const voted = opt.votes?.includes(userProfile.id);
                                                    return (
                                                        <div key={i} onClick={()=>handleVote(selectedChat.id, i)} className={`relative p-2 rounded border cursor-pointer overflow-hidden ${voted ? (selectedChat.from===userProfile.id?'bg-white/20':'bg-brand-50 border-brand-200') : 'bg-black/5 border-transparent'}`}>
                                                            <div className="absolute left-0 top-0 bottom-0 bg-black/10" style={{width:`${pct}%`}}></div>
                                                            <div className="relative flex justify-between text-xs font-bold z-10"><span>{opt.text}</span><span>{pct}%</span></div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* FOOTER: Reacciones y Vistos */}
                                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/20 text-[10px] opacity-80">
                                            <div className="flex gap-1">
                                                {Object.entries(selectedChat.reactions||{}).map(([uid, em], i) => <span key={i} title={members.find(m=>m.id===uid)?.name}>{em}</span>)}
                                            </div>
                                            <div className="flex gap-2">
                                                {formatDate(selectedChat.date).split(',')[1]}
                                                {selectedChat.from === userProfile.id && <button onClick={()=>setViewersModal(selectedChat)} className="hover:opacity-100"><Icon name="Eye" size={10}/> {selectedChat.readBy?.length}</button>}
                                            </div>
                                        </div>

                                        {/* Menú Reacciones */}
                                        <div className="absolute -top-3 right-2 bg-white shadow-lg rounded-full px-2 py-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-800 scale-90 group-hover:scale-100">
                                            {['👍','❤️','🙏','🔥'].map(em => <button key={em} onClick={()=>handleReaction(selectedChat.id, em)}>{em}</button>)}
                                        </div>
                                    </div>
                                </div>

                                {/* Hilo de Respuestas */}
                                {selectedChat.replies?.map((reply, i) => (
                                    <div key={i} className={`flex ${reply.from===userProfile.id?'justify-end':'justify-start'}`}>
                                        <div className={`max-w-[75%] p-3 rounded-xl shadow-sm text-sm ${reply.from===userProfile.id?'bg-blue-50 text-slate-800':'bg-white text-slate-800'}`}>
                                            <p className="text-[10px] font-bold text-slate-400 mb-0.5">{reply.fromName}</p>
                                            <p>{reply.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Respuesta (Solo si está permitido) */}
                            {selectedChat.allowReplies !== false ? (
                                <div className="p-4 bg-white border-t">
                                    <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                                        <input className="flex-1 bg-transparent px-2 text-sm outline-none" placeholder="Responder..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleReply()}/>
                                        <button onClick={handleReply} className="p-2 bg-brand-600 text-white rounded-lg"><Icon name="Send" size={16}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 font-bold border-t">
                                    <Icon name="Lock" size={12} className="inline mr-1"/> Respuestas desactivadas por el administrador
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300"><Icon name="MessageCircle" size={64}/><p className="mt-4 font-bold">Selecciona un mensaje</p></div>
                    )}
                </div>
            </div>

            {/* MODAL REDACTAR (RENOVADO) */}
            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Redactar">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    {/* TABS TIPO */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        {['text','poll','link'].map(t => (
                            <button key={t} onClick={()=>setComposeForm({...composeForm, type:t})} className={`flex-1 py-1.5 text-xs font-bold rounded-lg uppercase ${composeForm.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>
                                {t==='text'?'Mensaje':(t==='poll'?'Encuesta':'Enlace')}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}><option value="individual">Persona</option><option value="group">Ministerio</option><option value="custom_group">Grupo</option>{canBroadcast&&<option value="broadcast">DIFUSIÓN</option>}</Select>
                        {composeForm.context==='individual'&&<Select label="Para" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select>}
                        {composeForm.context==='group'&&<Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{['Alabanza','Jóvenes','Escuela Bíblica'].map(g=><option key={g} value={g}>{g}</option>)}</Select>}
                        {composeForm.context==='custom_group'&&<Select label="Grupo" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
                    </div>

                    <Input label={composeForm.type==='poll'?'Pregunta Principal':(composeForm.type==='link'?'Título del Link':'Asunto / Título')} value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}/>

                    {composeForm.type === 'text' && (
                        <>
                            <textarea className="input-modern h-24 text-sm" placeholder="Cuerpo del mensaje..." value={composeForm.body} onChange={e=>setComposeForm({...composeForm, body:e.target.value})}/>
                            <label className="flex items-center gap-2 p-3 border border-dashed rounded-xl cursor-pointer text-xs text-slate-500 hover:bg-slate-50"><Icon name="Image"/> {isUploading?'Subiendo...':(composeForm.attachmentUrl?'Imagen adjunta OK':'Adjuntar Imagen')}<input type="file" className="hidden" onChange={handleImage}/></label>
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

                    {composeForm.type === 'link' && <Input label="URL" value={composeForm.linkUrl} onChange={e=>setComposeForm({...composeForm, linkUrl:e.target.value})} placeholder="https://..."/>}

                    {/* OPCIONES DE DIFUSIÓN */}
                    {composeForm.context === 'broadcast' && (
                        <div className="flex gap-4 pt-2 border-t">
                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={composeForm.isPinned} onChange={e=>setComposeForm({...composeForm, isPinned:e.target.checked})}/> Fijar Aviso</label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={composeForm.allowReplies} onChange={e=>setComposeForm({...composeForm, allowReplies:e.target.checked})}/> Permitir Respuestas</label>
                        </div>
                    )}

                    <Button className="w-full" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>

            {/* MODAL GRUPOS */}
            <Modal isOpen={isGroupModalOpen} onClose={()=>setIsGroupModalOpen(false)} title="Crear Grupo">
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

            <Modal isOpen={!!imageModal} onClose={()=>setImageModal(null)} title="Vista Previa"><div className="text-center"><img src={imageModal} className="max-h-[60vh] mx-auto rounded shadow mb-4"/><a href={imageModal} download="imagen.jpg" className="inline-block bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-bold">Descargar</a></div></Modal>
            
            <Modal isOpen={!!viewersModal} onClose={()=>setViewersModal(null)} title="Visto por"><div className="max-h-60 overflow-y-auto space-y-1">{viewersModal?.readBy?.map((uid,i)=><div key={i} className="p-2 border-b text-sm text-slate-600">{members.find(m=>m.id===uid)?.name || 'Usuario'}</div>)}</div></Modal>
        </div>
    );
};
