// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, MonthNav, formatCurrency, formatDate, Icon, SmartSelect } = Utils;
    const Recharts = window.Recharts || null;

    if (userProfile?.role !== 'Pastor') return <div className="p-8 text-center text-slate-500">Acceso restringido.</div>;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard');
    const initialForm = { type: 'Culto', date: new Date().toISOString().split('T')[0], tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', tithersCount: '', amount: '', category: 'General', method: 'Efectivo', notes: '' };
    const [form, setForm] = useState(initialForm);
    const categories = [{value:'General',label:'General'},{value:'Mantenimiento',label:'Mantenimiento'},{value:'Honorarios',label:'Honorarios'},{value:'Alquiler',label:'Alquiler'},{value:'Ayuda Social',label:'Ayuda Social'},{value:'Ministerios',label:'Ministerios'}];

    const globalBalances = useMemo(() => {
        let cash = 0, bank = 0;
        finances.forEach(f => {
            if (f.type === 'Culto') { cash += (Number(f.tithesCash||0) + Number(f.offeringsCash||0)); bank += (Number(f.tithesTransfer||0) + Number(f.offeringsTransfer||0)); } 
            else { const val = Number(f.amount||0); if (f.method === 'Banco') bank += val; else cash += val; }
        });
        return { cash, bank, total: cash + bank };
    }, [finances]);

    const monthlyData = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return finances.filter(f => f.date && f.date.startsWith(monthStr)).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate]);

    const chartData = useMemo(() => {
        if (!Recharts) return { trend: [], pie: [] };
        const trendMap = {};
        for(let i=5; i>=0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); trendMap[d.toISOString().slice(0,7)] = { name: Utils.formatDate(d, 'month'), ingresos: 0, gastos: 0 }; }
        finances.forEach(f => {
            const key = f.date.slice(0, 7);
            if (trendMap[key]) {
                let val = f.type === 'Culto' ? (Number(f.tithesCash||0)+Number(f.tithesTransfer||0)+Number(f.offeringsCash||0)+Number(f.offeringsTransfer||0)) : Number(f.amount||0);
                if (val > 0) trendMap[key].ingresos += val; else trendMap[key].gastos += Math.abs(val);
            }
        });
        const pieMap = {}; monthlyData.filter(f => f.type === 'Gasto').forEach(f => pieMap[f.category||'Gral'] = (pieMap[f.category||'Gral']||0) + Math.abs(Number(f.amount)));
        return { trend: Object.values(trendMap), pie: Object.entries(pieMap).map(([name, value]) => ({ name, value })) };
    }, [finances, monthlyData, Recharts]);

    const handleSave = () => {
        let final = { type: form.type, date: form.date, notes: form.notes, category: form.category, createdAt: new Date().toISOString() };
        if(form.type === 'Culto') {
            const total = Number(form.tithesCash||0)+Number(form.tithesTransfer||0)+Number(form.offeringsCash||0)+Number(form.offeringsTransfer||0);
            if(total===0) return Utils.notify("Total en 0", "error");
            final = {...final, tithesCash:form.tithesCash, tithesTransfer:form.tithesTransfer, offeringsCash:form.offeringsCash, offeringsTransfer:form.offeringsTransfer, tithersCount:form.tithersCount, total};
        } else {
            const amt = Number(form.amount||0);
            final = {...final, amount: form.type==='Gasto' ? -Math.abs(amt) : Math.abs(amt), method: form.method, total: form.type==='Gasto' ? -Math.abs(amt) : Math.abs(amt)};
        }
        addData('finances', final); setIsModalOpen(false); setForm(initialForm); Utils.notify("Movimiento registrado");
    };

    const generateFixed = () => {
        if(!confirm("¿Generar gastos fijos?")) return;
        const fixed = [{ type: 'Gasto', category: 'Alquiler', amount: -50000, method: 'Banco', notes: 'Alquiler', date: new Date().toISOString().slice(0,10) }];
        fixed.forEach(f => addData('finances', { ...f, total: f.amount }));
        Utils.notify("Gastos generados");
    };

    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

    return (
        <div className="space-y-8 fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div><h2 className="text-2xl font-bold text-slate-800">Billetera Digital</h2><p className="text-slate-500 text-sm">Gestión financiera</p></div>
                <div className="flex gap-2"><div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100"><button onClick={()=>setTabView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='dashboard'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Dashboard</button><button onClick={()=>setTabView('list')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='list'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Movimientos</button></div><Button icon="Plus" onClick={()=>{setForm({...initialForm, date: new Date().toISOString().split('T')[0]}); setIsModalOpen(true);}}>Nuevo</Button></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="Wallet" size={80}/></div><p className="text-slate-400 text-xs font-bold uppercase">Total Global</p><h3 className="text-3xl font-extrabold">{formatCurrency(globalBalances.total)}</h3></div>
                <Card className="border-l-4 border-l-emerald-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Caja Chica (Efectivo)</p><h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(globalBalances.cash)}</h3></Card>
                <Card className="border-l-4 border-l-blue-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Banco / Digital</p><h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(globalBalances.bank)}</h3></Card>
            </div>
            {tabView === 'dashboard' && Recharts && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Card className="lg:col-span-2 h-64"><Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.LineChart data={chartData.trend}><Recharts.XAxis dataKey="name" tick={{fontSize:10}} axisLine={false} tickLine={false}/><Recharts.Tooltip /><Recharts.Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} dot={false}/><Recharts.Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} dot={false}/></Recharts.LineChart></Recharts.ResponsiveContainer></Card><Card className="h-64 flex flex-col items-center justify-center">{chartData.pie.length > 0 ? (<Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.PieChart><Recharts.Pie data={chartData.pie} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">{chartData.pie.map((entry, index) => <Recharts.Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Recharts.Pie><Recharts.Tooltip /></Recharts.PieChart></Recharts.ResponsiveContainer>) : <p className="text-xs text-slate-400">Sin datos</p>}</Card></div>)}
            <div className="space-y-4"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Historial</h3><MonthNav currentDate={currentDate} onMonthChange={setCurrentDate} /></div>{tabView === 'list' && (<div className="flex justify-end"><button onClick={generateFixed} className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1"><Icon name="Plus" size={12}/> Generar Fijos</button></div>)}<div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="p-3">Fecha</th><th className="p-3">Detalle</th><th className="p-3 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100">{monthlyData.map(f => (<tr key={f.id}><td className="p-3 whitespace-nowrap">{formatDate(f.date)}</td><td className="p-3"><div className="font-bold">{f.type === 'Culto' ? 'Cierre Culto' : f.category}</div><div className="text-xs text-slate-500">{f.notes || f.method}</div></td><td className={`p-3 text-right font-mono font-bold ${f.total<0?'text-red-600':'text-emerald-600'}`}>{formatCurrency(f.total || f.amount)}</td></tr>))}</tbody></table></div></div>
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo Movimiento"><div className="space-y-4"><Select label="Tipo" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}><option value="Culto">Cierre de Culto</option><option value="Gasto">Gasto / Salida</option><option value="Ingreso">Otro Ingreso</option></Select><Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>{form.type === 'Culto' ? (<div className="grid grid-cols-2 gap-2"><Input label="Diezmo Efec." type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/><Input label="Ofrenda Efec." type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/><Input label="Diezmo Banco" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/><Input label="Ofrenda Banco" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/><Input label="Cant. Diezmantes" type="number" value={form.tithersCount} onChange={e=>setForm({...form, tithersCount:e.target.value})}/></div>) : (<><Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/><Select label="Origen" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select><SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/></>)}<Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/><Button className="w-full" onClick={handleSave}>Guardar</Button></div></Modal>
        </div>
    );
};
