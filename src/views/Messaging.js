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
        to: '', context: 'individual', type: 'text', content: '', 
        isPinned: false, attachmentUrl: '', pollOptions: ['', ''], linkUrl: ''
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

    // Scroll automático
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [selectedChat, messages]);

    const myChats = useMemo(() => {
        // Lógica de chats (simplificada)
        const relevant = messages.filter(m => {
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
        // Aquí podrías agrupar por "hilo" real si quisieras, por ahora listamos
        return relevant;
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
        if (!composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Escribe algo", "error");
        
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
            date: new Date().toISOString(),
            readBy: [userProfile.id],
            replies: []
        };

        try {
            await window.db.collection('messages').add(newMessage);
            setIsComposeOpen(false);
            setComposeForm({ to: '', context: 'individual', type: 'text', content: '', isPinned: false, attachmentUrl: '', pollOptions: ['',''], linkUrl: '' });
            Utils.notify("Enviado");
        } catch(e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        if(confirm("¿Eliminar?")) {
            await window.db.collection('messages').doc(id).delete();
            setSelectedChat(null);
        }
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
                <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="flex-1 overflow-y-auto">
                        {myChats.map(msg => (
                            <div key={msg.id} onClick={()=>setSelectedChat(msg)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-white ${selectedChat?.id===msg.id ? 'bg-white border-l-4 border-l-brand-500' : ''}`}>
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-sm text-slate-800 truncate">{msg.to==='all'?'📢 Difusión':msg.fromName}</span>
                                    <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{msg.content || 'Adjunto'}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`flex-1 flex flex-col bg-[#eef2f6] relative ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                    {selectedChat ? (
                        <>
                            <div className="p-4 bg-white border-b flex justify-between items-center">
                                <button onClick={()=>setSelectedChat(null)} className="md:hidden"><Icon name="ChevronLeft"/></button>
                                <h3 className="font-bold">{selectedChat.fromName}</h3>
                                {(userProfile.role==='Pastor'||selectedChat.from===userProfile.id) && <button onClick={()=>handleDelete(selectedChat.id)}><Icon name="Trash" size={16}/></button>}
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
                                <div className={`flex ${selectedChat.from===userProfile.id?'justify-end':'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-xl ${selectedChat.from===userProfile.id?'bg-brand-600 text-white':'bg-white text-slate-800'} shadow-sm`}>
                                        {selectedChat.attachmentUrl && <img src={selectedChat.attachmentUrl} className="mb-2 rounded max-h-48 object-cover"/>}
                                        <p className="text-sm whitespace-pre-wrap">{selectedChat.content}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">Selecciona un mensaje</div>
                    )}
                </div>
            </div>

            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Nuevo Mensaje">
                <div className="space-y-4">
                    <Select label="Destino" value={composeForm.context} onChange={e=>setComposeForm({...composeForm, context:e.target.value})}>
                        <option value="individual">Persona</option>
                        {canBroadcast && <option value="broadcast">DIFUSIÓN</option>}
                    </Select>
                    {composeForm.context==='individual' && <Select label="Para" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select>}
                    
                    <textarea className="input-modern h-32" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})} placeholder="Mensaje..."/>
                    
                    <div className="flex gap-2">
                        <label className="flex-1 p-2 border rounded cursor-pointer text-xs flex items-center justify-center gap-1">
                            <Icon name="Image"/> {isUploading?'...':(composeForm.attachmentUrl?'Listo':'Foto')}
                            <input type="file" className="hidden" onChange={handleImage} disabled={isUploading}/>
                        </label>
                    </div>

                    <Button className="w-full" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>
        </div>
    );
};
