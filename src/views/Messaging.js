// src/views/Messaging.js
window.Views = window.Views || {};

window.Views.Messaging = ({ messages, members, userProfile, addData, updateData }) => {
    const { useState } = React;
    const { Card, Button, Badge, Modal, Input, Select, Icon, formatDate } = window.Utils;

    const [activeTab, setActiveTab] = useState('messages');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeForm, setComposeForm] = useState({ to: '', content: '', isPinned: false }); // Nuevo campo isPinned

    const myMessages = messages.filter(m => (m.to === 'all' || m.to === userProfile.id)).sort((a,b) => {
        // Ordenar: Fijados primero, luego por fecha
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.date) - new Date(a.date);
    });

    const canCompose = ['Pastor', 'Líder'].includes(userProfile.role);

    const handleSend = () => {
        if(!composeForm.content || !composeForm.to) return window.Utils.notify("Faltan datos", "error");
        const msg = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: composeForm.to,
            content: composeForm.content,
            isPinned: composeForm.isPinned, // Guardar estado fijado
            date: new Date().toISOString(),
            readBy: []
        };
        addData('messages', msg);
        setIsComposeOpen(false);
        setComposeForm({ to: '', content: '', isPinned: false });
        window.Utils.notify("Enviado");
    };

    const markAsRead = (msg) => {
        if (!msg.readBy?.includes(userProfile.id)) {
            const readBy = msg.readBy || [];
            updateData('messages', msg.id, { readBy: [...readBy, userProfile.id] });
        }
        setSelectedItem(msg);
    };

    return (
        <div className="space-y-6 fade-in h-[calc(100vh-140px)] flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Bandeja de Entrada</h2>
                {canCompose && <Button icon="Plus" onClick={()=>setIsComposeOpen(true)}>Redactar</Button>}
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Lista Lateral */}
                <div className={`w-full md:w-1/3 overflow-y-auto pr-2 space-y-2 ${selectedItem ? 'hidden md:block' : 'block'}`}>
                    {myMessages.map(msg => {
                        const isRead = msg.readBy?.includes(userProfile.id);
                        const isSelected = selectedItem?.id === msg.id;
                        return (
                            <div key={msg.id} onClick={()=>markAsRead(msg)} className={`p-4 rounded-xl cursor-pointer border transition-all relative ${isSelected ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100 hover:border-brand-200'} ${!isRead ? 'border-l-4 border-l-brand-500' : ''}`}>
                                {msg.isPinned && <div className="absolute top-2 right-2 text-orange-500"><Icon name="Bell" size={14}/></div>}
                                <div className="flex justify-between items-start mb-1 pr-6">
                                    <span className={`text-sm ${!isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{msg.fromName}</span>
                                    <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2">{msg.content}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Panel Detalle */}
                <div className={`w-full md:w-2/3 bg-white rounded-2xl shadow-soft border border-slate-100 p-6 overflow-y-auto ${selectedItem ? 'block' : 'hidden md:flex items-center justify-center'}`}>
                    {selectedItem ? (
                        <div className="animate-enter">
                            <button onClick={()=>setSelectedItem(null)} className="md:hidden mb-4 text-slate-500 flex items-center gap-2"><Icon name="ChevronLeft" size={16}/> Volver</button>
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">{selectedItem.fromName.charAt(0)}</div>
                                    <div><h3 className="font-bold text-slate-900">{selectedItem.fromName}</h3><p className="text-xs text-slate-500">{selectedItem.to === 'all' ? 'Difusión General' : 'Privado'}</p></div>
                                </div>
                                {selectedItem.isPinned && <Badge type="warning">Fijado</Badge>}
                            </div>
                            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{selectedItem.content}</div>
                        </div>
                    ) : <div className="text-center text-slate-400"><Icon name="Mail" size={32} className="mx-auto mb-2 opacity-50"/><p>Selecciona un mensaje</p></div>}
                </div>
            </div>

            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Nuevo Mensaje">
                <div className="space-y-4">
                    <Select label="Destinatario" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                        <option value="">Seleccionar...</option><option value="all">📢 TODOS (Difusión)</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </Select>
                    
                    {/* Checkbox Fijar */}
                    <div className="flex items-center gap-2 bg-orange-50 p-3 rounded-xl border border-orange-100 cursor-pointer" onClick={()=>setComposeForm(p=>({...p, isPinned: !p.isPinned}))}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${composeForm.isPinned ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-300'}`}>
                            {composeForm.isPinned && <Icon name="Check" size={14}/>}
                        </div>
                        <span className="text-sm font-bold text-orange-800">Fijar este mensaje (Importante)</span>
                    </div>

                    <textarea className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none" value={composeForm.content} onChange={e=>setComposeForm({...composeForm, content:e.target.value})} placeholder="Mensaje..."></textarea>
                    <Button className="w-full" onClick={handleSend}>Enviar</Button>
                </div>
            </Modal>
        </div>
    );
};
