// src/views/Messaging.js
window.Views = window.Views || {};

window.Views.Messaging = ({ messages, members, userProfile, addData, updateData }) => {
    const { useState } = React;
    const { Card, Button, Badge, Modal, Input, Select, Icon, formatDate } = window.Utils;

    const [activeTab, setActiveTab] = useState('messages'); // 'messages' | 'tasks'
    const [selectedItem, setSelectedItem] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeForm, setComposeForm] = useState({ to: '', content: '' });

    // Filtrar mis datos
    const myMessages = messages.filter(m => (m.to === 'all' || m.to === userProfile.id)).sort((a,b) => new Date(b.date) - new Date(a.date));
    // Tareas pendientes (simuladas o reales si pasas la colección tasks)
    // Nota: Para que esto funcione 100%, asegúrate de pasar 'tasks' como prop desde App.js, 
    // pero por ahora filtramos mensajes.

    const canCompose = ['Pastor', 'Líder'].includes(userProfile.role);

    const handleSend = () => {
        if(!composeForm.content || !composeForm.to) return alert("Faltan datos");
        const msg = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: composeForm.to,
            content: composeForm.content,
            date: new Date().toISOString(),
            readBy: []
        };
        addData('messages', msg);
        setIsComposeOpen(false);
        setComposeForm({ to: '', content: '' });
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

            <div className="flex gap-2 border-b border-slate-200 flex-shrink-0">
                <button onClick={()=>{setActiveTab('messages'); setSelectedItem(null);}} className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab==='messages'?'border-brand-600 text-brand-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    Mensajes
                </button>
                {/* Futura implementación de Tareas aquí si se desea unificar */}
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Lista Lateral */}
                <div className={`w-full md:w-1/3 overflow-y-auto pr-2 space-y-2 ${selectedItem ? 'hidden md:block' : 'block'}`}>
                    {myMessages.length === 0 && <p className="text-slate-400 text-center py-10">No hay mensajes.</p>}
                    {myMessages.map(msg => {
                        const isRead = msg.readBy?.includes(userProfile.id);
                        const isSelected = selectedItem?.id === msg.id;
                        return (
                            <div 
                                key={msg.id} 
                                onClick={()=>markAsRead(msg)}
                                className={`p-4 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-brand-50 border-brand-200 shadow-sm' : 'bg-white border-slate-100 hover:border-brand-200'} ${!isRead ? 'border-l-4 border-l-brand-500' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm ${!isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{msg.fromName}</span>
                                    <span className="text-[10px] text-slate-400">{formatDate(msg.date)}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2">{msg.content}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Panel de Detalle */}
                <div className={`w-full md:w-2/3 bg-white rounded-2xl shadow-soft border border-slate-100 p-6 overflow-y-auto ${selectedItem ? 'block' : 'hidden md:flex items-center justify-center'}`}>
                    {selectedItem ? (
                        <div className="animate-enter">
                            <button onClick={()=>setSelectedItem(null)} className="md:hidden mb-4 text-slate-500 flex items-center gap-2"><Icon name="ChevronLeft" size={16}/> Volver</button>
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">
                                        {selectedItem.fromName.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{selectedItem.fromName}</h3>
                                        <p className="text-xs text-slate-500">{selectedItem.to === 'all' ? 'Para: Todos (Difusión)' : 'Para: Mí'}</p>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 font-medium">{formatDate(selectedItem.date)}</span>
                            </div>
                            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {selectedItem.content}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-400">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <Icon name="Mail" size={32} />
                            </div>
                            <p>Selecciona un mensaje para leerlo</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isComposeOpen} onClose={()=>setIsComposeOpen(false)} title="Nuevo Mensaje">
                <div className="space-y-4">
                    <Select label="Destinatario" value={composeForm.to} onChange={e=>setComposeForm({...composeForm, to:e.target.value})}>
                        <option value="">Seleccionar...</option>
                        <option value="all">📢 TODOS (Difusión)</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </Select>
                    <div>
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">Mensaje</label>
                        <textarea 
                            className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-input placeholder:text-slate-400 h-32"
                            value={composeForm.content}
                            onChange={e=>setComposeForm({...composeForm, content:e.target.value})}
                            placeholder="Escribe tu mensaje aquí..."
                        ></textarea>
                    </div>
                    <div className="pt-2">
                        <Button className="w-full" onClick={handleSend}>Enviar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
