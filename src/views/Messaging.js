// src/views/Messaging.js
window.Views = window.Views || {};

window.Views.Messaging = ({ messages, members, userProfile, addData, updateData }) => {
    const { useState } = React;
    const { Card, Button, formatDate } = window.Utils;

    const [compose, setCompose] = useState({ to: '', content: '' });
    
    // Filtrar mis mensajes
    const myInbox = messages.filter(m => (m.to === 'all' || m.to === userProfile.id));

    const handleSend = () => {
        if(!compose.content) return;
        const msg = {
            from: userProfile.id,
            fromName: userProfile.name,
            to: compose.to, // 'all' o userId
            content: compose.content,
            date: new Date().toISOString(),
            readBy: []
        };
        addData('messages', msg);
        setCompose({ to: '', content: '' });
        alert("Mensaje enviado");
    };

    const markAsRead = (msg) => {
        if (!msg.readBy?.includes(userProfile.id)) {
            const readBy = msg.readBy || [];
            updateData('messages', msg.id, { readBy: [...readBy, userProfile.id] });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in">
            <div className="space-y-6">
                <h2 className="text-2xl font-bold">Mis Mensajes</h2>
                <div className="space-y-3">
                    {myInbox.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(m => (
                        <Card key={m.id} className={`border-l-4 ${m.to==='all'?'border-l-blue-400':'border-l-brand-500'}`}>
                            <div className="flex justify-between mb-2">
                                <span className="font-bold text-sm text-slate-700">{m.fromName}</span>
                                <span className="text-xs text-slate-400">{formatDate(m.date)}</span>
                            </div>
                            <p className="text-slate-600 text-sm">{m.content}</p>
                            {m.to === 'all' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded mt-2 inline-block">Difusión</span>}
                            <button onClick={()=>markAsRead(m)} className="block mt-2 text-[10px] text-blue-400 hover:underline">Marcar leído</button>
                        </Card>
                    ))}
                </div>
            </div>
            <div>
                <Card className="sticky top-6">
                    <h3 className="font-bold mb-4">Redactar Nuevo</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="label-modern">Destinatario</label>
                            <select className="input-modern" value={compose.to} onChange={e=>setCompose({...compose, to:e.target.value})}>
                                <option value="">Seleccionar...</option>
                                <option value="all">📢 TODOS (Difusión)</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label-modern">Mensaje</label>
                            <textarea className="input-modern h-32" value={compose.content} onChange={e=>setCompose({...compose, content:e.target.value})}></textarea>
                        </div>
                        <Button icon="Mail" className="w-full" onClick={handleSend}>Enviar Mensaje</Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};
