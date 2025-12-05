// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData }) => {
    const { useState } = React;
    const { Card, Button, Badge, Modal, formatCurrency, formatDate } = window.Utils;

    const [isAdding, setIsAdding] = useState(false);
    const [type, setType] = useState('Culto');
    const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], cash: 0, transfer: 0, notes: '', tithersCount: 0 });

    const handleSave = () => {
        let finalData = { ...form, type, cash: Number(form.cash), transfer: Number(form.transfer), tithersCount: Number(form.tithersCount || 0) };
        if(type === 'Gasto') { finalData.cash *= -1; finalData.transfer *= -1; }
        addData('finances', finalData);
        setIsAdding(false);
        setForm({ date: new Date().toISOString().split('T')[0], cash: 0, transfer: 0, notes: '', tithersCount: 0 });
    };

    const total = finances.reduce((acc, f) => acc + (f.cash || 0) + (f.transfer || 0), 0);
    const totalTithers = finances.reduce((acc, f) => acc + (f.tithersCount || 0), 0);

    return (
        <div className="space-y-6 fade-in">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="bg-emerald-50 border-emerald-200 text-emerald-800">
                    <p className="text-xs uppercase font-bold">Caja Actual</p>
                    <p className="text-2xl font-bold">{formatCurrency(total)}</p>
                </Card>
                <Card className="bg-blue-50 border-blue-200 text-blue-800">
                    <p className="text-xs uppercase font-bold">Diezmantes (Mes)</p>
                    <p className="text-2xl font-bold">{totalTithers}</p>
                </Card>
            </div>
            <div className="flex gap-2 justify-end">
                <Button variant="danger" onClick={()=>{setType('Gasto'); setIsAdding(true);}}>Gasto</Button>
                <Button onClick={()=>{setType('Ingreso'); setIsAdding(true);}}>Ingreso</Button>
                <Button onClick={()=>{setType('Culto'); setIsAdding(true);}}>Cierre Culto</Button>
            </div>
            
            <div className="bg-white rounded-xl shadow border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr><th className="p-3">Fecha</th><th className="p-3">Detalle</th><th className="p-3 text-right">Monto</th></tr>
                    </thead>
                    <tbody>
                        {finances.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(f => (
                            <tr key={f.id} className="border-t border-slate-100">
                                <td className="p-3">{formatDate(f.date)}</td>
                                <td className="p-3">
                                    <Badge type={f.type === 'Gasto' ? 'danger' : 'success'}>{f.type}</Badge> 
                                    <span className="ml-2">{f.notes}</span>
                                    {f.tithersCount > 0 && <span className="ml-2 text-xs text-slate-400">({f.tithersCount} diezmantes)</span>}
                                </td>
                                <td className={`p-3 text-right font-mono font-bold ${(f.cash+f.transfer) < 0 ? 'text-red-500' : 'text-slate-700'}`}>{formatCurrency(f.cash + f.transfer)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isAdding} onClose={()=>setIsAdding(false)} title={`Registrar ${type}`}>
                <div className="space-y-4">
                    <input type="date" className="input-modern" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                    <input className="input-modern" placeholder="Detalle / Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
                    {type === 'Culto' && (
                        <div>
                            <label className="label-modern text-brand-600">Cantidad de Diezmantes</label>
                            <input type="number" className="input-modern bg-brand-50 border-brand-200" value={form.tithersCount} onChange={e=>setForm({...form, tithersCount:e.target.value})}/>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="label-modern">Efectivo</label><input type="number" className="input-modern" value={form.cash} onChange={e=>setForm({...form, cash:e.target.value})}/></div>
                        <div><label className="label-modern">Transferencia</label><input type="number" className="input-modern" value={form.transfer} onChange={e=>setForm({...form, transfer:e.target.value})}/></div>
                    </div>
                    <Button className="w-full" onClick={handleSave}>Guardar</Button>
                </div>
            </Modal>
        </div>
    );
};
