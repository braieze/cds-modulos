// src/views/Messaging.js
window.Views = window.Views || {};

window.Views.Messaging = ({ messages, members, userProfile, addData, updateData, deleteData }) => {
    const { useState } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, Icon, formatDate, compressImage } = Utils;

    const [selectedItem, setSelectedItem] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeForm, setComposeForm] = useState({ to: '', content: '', isPinned: false, attachmentUrl: '' });
    const [isUploading, setIsUploading] = useState(false);

    // Mensajes ordenados por fecha
    const myMessages = messages.filter(m => (m.to === 'all' || m.to === userProfile.id)).sort((a,b) => new Date(b.date) - new Date(a.date));

    const canCompose = ['Pastor', 'Líder'].includes(userProfile.role);

    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const base64 = await compressImage(file);
            setComposeForm(p => ({ ...p, attachmentUrl: base64 }));
        } catch(err) { Utils.notify("Error imagen", "error"); }
        setIsUploading(false);
    };

    const handleSend = () => {
        if(!composeForm.content && !composeForm.attachmentUrl) return Utils.notify("Escribe algo", "error");
        addData('messages', {
            from: userProfile.id, fromName: userProfile.name,
            to: composeForm.to, content: composeForm.content,
            isPinned: composeForm.isPinned, attachmentUrl: composeForm.attachmentUrl,
            date: new Date().toISOString(), readBy: []
        });
        setIsComposeOpen(false); setComposeForm({ to: '', content: '', isPinned: false, attachmentUrl: '' });
        Utils.notify("Enviado");
    };

    const handleDelete = (id) => {
        if(confirm("¿Eliminar para todos?")) {
            deleteData('messages', id);
            setSelectedItem(null);
        }
    };

    return (
        <div className="space-y-4 fade-in h-[calc(100vh-140px)] flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Mensajería</h2>
                {canCompose && <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Nuevo</Button>}
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden bg-white rounded-2xl shadow-soft border border-slate-200">
                {/* Lista Contactos/Mensajes */}
                <div className={`w-full md:w-1/3 border-r border-slate-100 flex flex-col ${selectedItem ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-700">Bandeja</h3></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {myMessages.map(msg => {
                            const isRead = msg.readBy?.includes(userProfile.id);
                            return (
                                <div key={msg.id} onClick={()=>{setSelectedItem(msg); if(!isRead) updateData('messages', msg.id, {readBy:[...(msg.readBy||[]), userProfile.id]});}} className={`p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all ${selectedItem?.id===msg.id ? 'bg-brand-50' : ''}`}>
                                    <div className="flex justify-between mb-1">
                                        <span className={`text-sm ${!isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{msg.fromName}</span>
                                        <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-1 flex items-center gap-1">
                                        {msg.attachmentUrl && <Icon name="Image" size={10}/>} {msg.content || 'Imagen adjunta'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Vista Chat */}
                <div className={`w-full md:w-2/3 flex flex-col ${selectedItem ? 'flex' : 'hidden md:flex'}`}>
                    {selectedItem ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <button onClick={()=>setSelectedItem(null)} className="md:hidden text-slate-500"><Icon name="ChevronLeft"/></button>
                                    <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center font-bold text-brand-600">{selectedItem.fromName.charAt(0)}</div>
                                    <div><h3 className="font-bold text-slate-800">{selectedItem.fromName}</h3><p className="text-xs text-slate-500">{selectedItem.to==='all'?'Difusión':'Privado'}</p></div>
                                </div>
                                {(userProfile.role==='Pastor'||selectedItem.from===userProfile.id) && <button onClick={()=>handleDelete(selectedItem.id)} className="text-slate-400 hover:text-red-500"><Icon name="Trash"/></button>}
                            </div>
                            
                            {/* Chat Body */}
                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50 flex flex-col gap-4">
                                <div className={`max-w-[85%] self-start`}>
                                    <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 text-slate-800 relative">
                                        {selectedItem.isPinned && <div className="absolute -top-2 -right-2 bg-yellow-100 text-yellow-600 p-1 rounded-full shadow-sm"><Icon name="Bell" size={12}/></div>}
                                        {selectedItem.attachmentUrl && <img src={selectedItem.attachmentUrl} className="mb-3 rounded-lg max-h-60 object-cover w-full cursor-pointer hover:opacity-90" onClick={()=>window.open(selectedItem.attachmentUrl)} />}
                                        <p className="whitespace-pre-wrap">{selectedItem.content}</p>
                                        <div className="text-[10px] text-slate-400 mt-2 text-right">{formatDate(selectedItem.date)}</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                            <Icon name="MessageCircle" size={64}/>
                            <p className="mt-4 font-medium">Selecciona un mensaje</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Nuevo Mensaje">
                <div className="space-y-4">
                    <Select label="Destinatario" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}><option value="">Seleccionar...</option><option value="all">📢 TODOS (Difusión)</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
                    <div className="flex gap-2">
                        <div onClick={()=>setComposeForm(p=>({...p, isPinned:!p.isPinned}))} className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer ${composeForm.isPinned?'bg-yellow-50 border-yellow-200 text-yellow-700':'bg-slate-50 border-slate-100'}`}><Icon name="Bell" size={16}/> Fijar</div>
                        <label className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer ${composeForm.attachmentUrl?'bg-green-50 border-green-200 text-green-700':'bg-slate-50 border-slate-100'}`}>
                            <Icon name="Image" size={16}/> {isUploading?'...':(composeForm.attachmentUrl?'Adjunto OK':'Adjuntar')}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImage} disabled={isUploading}/>
                        </label>
                    </div>
                    {composeForm.attachmentUrl && <img src={composeForm.attachmentUrl} className="h-20 rounded-lg object-cover" />}
                    <textarea className="input-modern h-32" placeholder="Escribe..." value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})}></textarea>
                    <Button className="w-full" onClick={handleSend} disabled={isUploading}>Enviar</Button>
                </div>
            </Modal>
        </div>
    );
};
