// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    // 1. HOOKS PRIMERO
    const { useState, useMemo, useEffect } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;
    
    // Acceso seguro a Recharts desde window
    const Recharts = window.Recharts; 

    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard');
    const [receiptModal, setReceiptModal] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    const initialForm = { type: 'Culto', date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0], tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', tithersCount: '', amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' };
    const [form, setForm] = useState(initialForm);

    const categories = [{value:'General',label:'General'},{value:'Mantenimiento',label:'Mantenimiento'},{value:'Honorarios',label:'Honorarios'},{value:'Alquiler',label:'Alquiler'},{value:'Ayuda Social',label:'Ayuda Social'},{value:'Ministerios',label:'Ministerios'}];

    // Helper numérico seguro (ADIOS NaN)
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    const globalBalances = useMemo(() => {
        let cash=0, bank=0;
        if(finances) finances.forEach(f => {
            if(f.type==='Culto') { cash += (safeNum(f.tithesCash)+safeNum(f.offeringsCash)); bank += (safeNum(f.tithesTransfer)+safeNum(f.offeringsTransfer)); }
            else { const v = safeNum(f.amount); if(f.method==='Banco') bank+=v; else cash+=v; }
        });
        return { cash, bank, total: cash+bank };
    }, [finances]);

    const monthlyData = useMemo(() => {
        if(!finances) return [];
        const m = currentDate.toISOString().slice(0,7);
        return finances.filter(f=>f.date && f.date.startsWith(m)).sort((a,b)=>new Date(b.date)-new Date(a.date));
    }, [finances, currentDate]);

    const chartData = useMemo(() => {
        if(!finances) return {trend:[],pie:[]};
        const trendMap = {};
        for(let i=5;i>=0;i--){ const d=new Date(); d.setMonth(d.getMonth()-i); const k=d.toISOString().slice(0,7); trendMap[k]={name:k, label:Utils.formatDate?Utils.formatDate(d.toISOString().slice(0,10),'month'):k, ingresos:0, gastos:0}; }
        finances.forEach(f=>{
            if(!f.date)return; const k=f.date.slice(0,7);
            if(trendMap[k]){
                let val=0, inc=false;
                if(f.type==='Culto'){ val=safeNum(f.tithesCash)+safeNum(f.tithesTransfer)+safeNum(f.offeringsCash)+safeNum(f.offeringsTransfer); inc=true; }
                else { val=safeNum(f.amount); inc=val>0; }
                if(inc) trendMap[k].ingresos+=Math.abs(val); else trendMap[k].gastos+=Math.abs(val);
            }
        });
        const pieMap={}; monthlyData.filter(f=>(Number(f.total||f.amount||0)<0)).forEach(f=>{ const c=f.category||'General'; pieMap[c]=(pieMap[c]||0)+Math.abs(Number(f.total||f.amount||0)); });
        return { trend:Object.values(trendMap).sort((a,b)=>a.name.localeCompare(b.name)), pie:Object.entries(pieMap).map(([n,v])=>({name:n,value:v})).sort((a,b)=>b.value-a.value) };
    }, [monthlyData, currentDate, finances]);

    const handleSave = () => {
        let f = {...form, createdAt:new Date().toISOString()};
        if(form.type==='Culto'){
            const t = safeNum(form.tithesCash)+safeNum(form.tithesTransfer)+safeNum(form.offeringsCash)+safeNum(form.offeringsTransfer);
            if(t===0) return Utils.notify("Total 0", "error");
            f = {...f, tithesCash:safeNum(form.tithesCash), tithesTransfer:safeNum(form.tithesTransfer), offeringsCash:safeNum(form.offeringsCash), offeringsTransfer:safeNum(form.offeringsTransfer), tithersCount:safeNum(form.tithersCount), total:t, category:'Culto'};
        } else {
            const a = safeNum(form.amount); if(a===0) return Utils.notify("Monto 0", "error");
            const v = Math.abs(a); f = {...f, amount: form.type==='Gasto'?-v:v, total: form.type==='Gasto'?-v:v};
        }
        addData('finances', f); setIsModalOpen(false); setForm(initialForm); Utils.notify("Registrado");
    };

    const handleImage = async (e) => { const f=e.target.files[0]; if(!f)return; setIsUploading(true); try{const b=await compressImage(f); setForm(p=>({...p, attachmentUrl:b}));}catch(err){Utils.notify("Error","error");} setIsUploading(false); };
    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
    const renderAmount = (a) => showBalance ? formatCurrency(safeNum(a)) : "$ ••••••";

    // 2. RENDER SEGURO
    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-500"><Icon name="LogOut" className="mr-2"/> Acceso Pastoral</div>;
    
    if (isLocked) return (
        <div className="h-full flex flex-col items-center justify-center animate-enter"><div className="bg-white p-8 rounded-3xl shadow-soft max-w-sm w-full text-center border border-slate-100"><div className="bg-brand-100 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-brand-600 mb-6"><Icon name="Wallet" size={32}/></div><h2 className="text-2xl font-extrabold text-slate-800 mb-2">Billetera</h2><p className="text-slate-500 mb-6">PIN: 1234</p><input type="password" maxLength="4" className="text-center text-3xl font-bold w-full border-b-2 outline-none py-2" value={pinInput} onChange={e=>setPinInput(e.target.value)} /><Button className="w-full mt-4" onClick={()=>{if(pinInput==='1234'){setIsLocked(false);setErrorPin(false)}else{setErrorPin(true);setPinInput('')}}}>Desbloquear</Button></div></div>
    );

    return (
        <div className="space-y-8 fade-in pb-24">
            <div className="flex justify-between items-center"><div className="flex gap-3 items-center"><h2 className="text-2xl font-bold">Billetera</h2><button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400"><Icon name={showBalance?"Search":"LogOut"}/></button></div><div className="flex gap-2"><button onClick={()=>setTabView('dashboard')} className="px-4 py-2 bg-slate-100 rounded text-xs font-bold">Panel</button><button onClick={()=>setTabView('list')} className="px-4 py-2 bg-slate-100 rounded text-xs font-bold">Lista</button><Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}}>Nuevo</Button></div></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg"><p className="text-xs font-bold opacity-70">Total</p><h3 className="text-3xl font-black">{renderAmount(globalBalances.total)}</h3></div><Card className="border-l-4 border-l-emerald-500 py-4"><p className="text-xs font-bold text-slate-500">Efectivo</p><h3 className="text-2xl font-bold">{renderAmount(globalBalances.cash)}</h3></Card><Card className="border-l-4 border-l-blue-500 py-4"><p className="text-xs font-bold text-slate-500">Banco</p><h3 className="text-2xl font-bold">{renderAmount(globalBalances.bank)}</h3></Card></div>
            <div className="flex justify-between items-center mt-6"><h3 className="font-bold text-lg">Resumen</h3><DateFilter currentDate={currentDate} onChange={setCurrentDate}/></div>
            
            {tabView==='dashboard' && Recharts && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
                    <Card className="lg:col-span-2 h-72"><h3 className="font-bold text-xs uppercase mb-4 text-slate-500">Flujo</h3><div className="h-full w-full -ml-4"><Recharts.ResponsiveContainer width="100%" height="90%"><Recharts.AreaChart data={chartData.trend}><Recharts.CartesianGrid strokeDasharray="3 3" vertical={false}/><Recharts.XAxis dataKey="label" tick={{fontSize:10}} axisLine={false} tickLine={false}/><Recharts.Tooltip/><Recharts.Area type="monotone" dataKey="ingresos" stroke="#10b981" fill="#10b981" fillOpacity={0.1}/><Recharts.Area type="monotone" dataKey="gastos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1}/></Recharts.AreaChart></Recharts.ResponsiveContainer></div></Card>
                    <Card className="h-72"><h3 className="font-bold text-xs uppercase mb-4 text-slate-500">Gastos</h3><div className="h-full relative">{chartData.pie.length>0 ? <Recharts.ResponsiveContainer width="100%" height="90%"><Recharts.PieChart><Recharts.Pie data={chartData.pie} innerRadius={50} outerRadius={70} dataKey="value">{chartData.pie.map((e,i)=><Recharts.Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Recharts.Pie><Recharts.Tooltip/></Recharts.PieChart></Recharts.ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Sin datos</div>}</div></Card>
                </div>
            )}
            
            {tabView==='list' && (<div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><div className="p-2 flex justify-end"><button onClick={window.DataLogic.generateDemoFinances} className="text-xs text-brand-600 font-bold flex items-center gap-1"><Icon name="Plus" size={12}/> Demo Data</button></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="p-4">Fecha</th><th className="p-4">Detalle</th><th className="p-4 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100">{monthlyData.length===0 && <tr><td colSpan="3" className="p-6 text-center text-slate-400">Sin movimientos</td></tr>}{monthlyData.map(f=>(<tr key={f.id}><td className="p-4 whitespace-nowrap text-slate-600">{formatDate(f.date)}</td><td className="p-4"><div className="font-bold text-slate-800">{f.type==='Culto'?'Cierre':f.category}</div><div className="text-xs text-slate-500">{f.notes||f.method}</div></td><td className={`p-4 text-right font-mono font-bold ${Number(f.total||f.amount)<0?'text-red-600':'text-emerald-600'}`}>{formatCurrency(f.total||f.amount)}</td></tr>))}</tbody></table></div></div>)}
            
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo"><div className="space-y-4"><div className="grid grid-cols-3 gap-2">{['Culto','Gasto','Ingreso'].map(t=><button key={t} onClick={()=>setForm({...initialForm, type:t})} className={`py-2 text-xs font-bold rounded ${form.type===t?'bg-slate-800 text-white':'bg-slate-100'}`}>{t}</button>)}</div><Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />{form.type==='Culto' ? <div className="grid grid-cols-2 gap-2"><Input label="Diezmo Efec." type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})} /><Input label="Ofrenda Efec." type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})} /><Input label="Diezmo Bco." type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})} /><Input label="Ofrenda Bco." type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})} /></div> : <div className="grid grid-cols-2 gap-2"><Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} /><Select label="Origen" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select><SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/></div>}<Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} /><Button className="w-full" onClick={handleSave}>Guardar</Button></div></Modal>
        </div>
    );
};
