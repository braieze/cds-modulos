// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;
    
    // Acceso seguro a Recharts
    const Recharts = window.Recharts || null;
    const { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = Recharts || {};

    // --- 1. DECLARACIÓN DE HOOKS (Siempre primero) ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard');
    const [receiptModal, setReceiptModal] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [showBalance, setShowBalance] = useState(true); // Ocultar/Mostrar saldos

    // Formulario
    const initialForm = { 
        type: 'Culto', date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0], 
        tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', tithersCount: '', 
        amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' 
    };
    const [form, setForm] = useState(initialForm);

    const categories = [
        { value: 'General', label: 'General / Varios' },
        { value: 'Mantenimiento', label: 'Infraestructura' },
        { value: 'Honorarios', label: 'Honorarios' },
        { value: 'Alquiler', label: 'Alquiler/Servicios' },
        { value: 'Ayuda Social', label: 'Ayuda Social' },
        { value: 'Ministerios', label: 'Ministerios' }
    ];

    // Cálculos (Hooks)
    const globalBalances = useMemo(() => {
        let cash = 0, bank = 0;
        finances.forEach(f => {
            if (f.type === 'Culto') { 
                cash += (Number(f.tithesCash||0) + Number(f.offeringsCash||0)); 
                bank += (Number(f.tithesTransfer||0) + Number(f.offeringsTransfer||0)); 
            } else { 
                const val = Number(f.amount||0); 
                if (f.method === 'Banco') bank += val; else cash += val; 
            }
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
        for(let i=5; i>=0; i--) { 
            const d = new Date(); d.setMonth(d.getMonth() - i); 
            // Fix fecha segura
            const key = d.toISOString().slice(0,7);
            trendMap[key] = { name: Utils.formatDate ? Utils.formatDate(d.toISOString().slice(0,10), 'month') : 'Mes', ingresos: 0, gastos: 0 }; 
        }
        finances.forEach(f => {
            const key = f.date.slice(0, 7);
            if (trendMap[key]) {
                let val = f.type === 'Culto' ? (Number(f.tithesCash||0)+Number(f.tithesTransfer||0)+Number(f.offeringsCash||0)+Number(f.offeringsTransfer||0)) : Number(f.amount||0);
                if (val > 0) trendMap[key].ingresos += val; else trendMap[key].gastos += Math.abs(val);
            }
        });
        const pieMap = {}; 
        monthlyData.filter(f => f.type === 'Gasto').forEach(f => pieMap[f.category||'Gral'] = (pieMap[f.category||'Gral']||0) + Math.abs(Number(f.amount)));
        return { trend: Object.values(trendMap), pie: Object.entries(pieMap).map(([name, value]) => ({ name, value })) };
    }, [finances, monthlyData, Recharts]);

    // --- 2. VALIDACIÓN DE ROL (Ahora sí es seguro hacerlo aquí) ---
    if (!userProfile || userProfile.role !== 'Pastor') {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-10">
                <div className="bg-slate-100 p-4 rounded-full mb-4 text-slate-400"><Icon name="LogOut" size={40} /></div>
                <h3 className="text-xl font-bold text-slate-700">Acceso Restringido</h3>
                <p className="text-slate-500">Solo el Pastor puede ver la tesorería.</p>
            </div>
        );
    }

    // --- 3. MANEJADORES ---
    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const base64 = await compressImage(file);
            setForm(p => ({ ...p, attachmentUrl: base64 }));
        } catch(err) { Utils.notify("Error imagen", "error"); }
        setIsUploading(false);
    };

    const handleSave = () => {
        let final = { type: form.type, date: form.date, notes: form.notes, category: form.category, attachmentUrl: form.attachmentUrl, createdAt: new Date().toISOString() };
        if(form.type === 'Culto') {
            const total = Number(form.tithesCash||0)+Number(form.tithesTransfer||0)+Number(form.offeringsCash||0)+Number(form.offeringsTransfer||0);
            if(total===0) return Utils.notify("Total 0", "error");
            final = {...final, tithesCash:form.tithesCash, tithesTransfer:form.tithesTransfer, offeringsCash:form.offeringsCash, offeringsTransfer:form.offeringsTransfer, tithersCount:form.tithersCount, total};
        } else {
            const amt = Number(form.amount||0);
            if(amt===0) return Utils.notify("Monto requerido", "error");
            final = {...final, amount: form.type==='Gasto' ? -Math.abs(amt) : Math.abs(amt), method: form.method, total: form.type==='Gasto' ? -Math.abs(amt) : Math.abs(amt)};
        }
        addData('finances', final); setIsModalOpen(false); setForm(initialForm); Utils.notify("Registrado");
    };

    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
    const renderAmount = (amount) => showBalance ? formatCurrency(amount) : "$ ••••••";

    return (
        <div className="space-y-8 fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-800">Billetera</h2>
                    <button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400 hover:text-brand-600"><Icon name="Search" size={20}/></button>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200"><button onClick={()=>setTabView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='dashboard'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Panel</button><button onClick={()=>setTabView('list')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='list'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Movimientos</button></div>
                    <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0]}); setIsModalOpen(true);}}>Nuevo</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="Wallet" size={80}/></div><p className="text-slate-400 text-xs font-bold uppercase">Total Global</p><h3 className="text-3xl font-extrabold">{renderAmount(globalBalances.total)}</h3></div>
                <Card className="border-l-4 border-l-emerald-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Caja Chica (Efectivo)</p><h3 className="text-2xl font-extrabold text-slate-800">{renderAmount(globalBalances.cash)}</h3></Card>
                <Card className="border-l-4 border-l-blue-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Banco / Digital</p><h3 className="text-2xl font-extrabold text-slate-800">{renderAmount(globalBalances.bank)}</h3></Card>
            </div>

            <div className="flex justify-between items-center mt-6"><h3 className="font-bold text-lg text-slate-800">Resumen Mensual</h3><DateFilter currentDate={currentDate} onChange={setCurrentDate} /></div>

            {tabView === 'dashboard' && Recharts && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
                    <Card className="lg:col-span-2 h-72">
                        <h3 className="font-bold text-slate-800 mb-4">Flujo de Caja</h3>
                        <div className="h-full w-full -ml-4">
                            <ResponsiveContainer width="100%" height="90%"><AreaChart data={chartData.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:10}} axisLine={false} tickLine={false}/><Tooltip /><Area type="monotone" dataKey="ingresos" stroke="#10b981" fillOpacity={1} fill="#10b981" strokeWidth={3} /><Area type="monotone" dataKey="gastos" stroke="#ef4444" fillOpacity={1} fill="#ef4444" strokeWidth={3} /></AreaChart></ResponsiveContainer>
                        </div>
                    </Card>
                    <Card className="h-72 flex flex-col">
                        <h3 className="font-bold text-slate-800 mb-2">Gastos</h3>
                        <div className="flex-1 relative">
                            {chartData.pie.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData.pie} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">{chartData.pie.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : <div className="flex h-full items-center justify-center text-slate-400 text-xs">Sin gastos</div>}
                        </div>
                    </Card>
                </div>
            )}

            {tabView === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-2 bg-slate-50 border-b flex justify-end"><button onClick={window.DataLogic.generateDemoFinances} className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1"><Icon name="Plus" size={12}/> Datos Prueba</button></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="p-4">Fecha</th><th className="p-4">Detalle</th><th className="p-4 text-right">Monto</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{monthlyData.map(f => (<tr key={f.id} className="hover:bg-slate-50"><td className="p-4 whitespace-nowrap text-slate-600">{formatDate(f.date)}</td><td className="p-4"><div className="font-bold text-slate-800">{f.type==='Culto'?'Cierre Culto':f.category}</div><div className="text-xs text-slate-500">{f.notes||f.method}</div></td><td className={`p-4 text-right font-mono font-bold ${f.total<0?'text-red-600':'text-emerald-600'}`}>{formatCurrency(f.total||f.amount)}</td><td className="p-4 text-right">{f.attachmentUrl && <button onClick={()=>setReceiptModal(f.attachmentUrl)} className="text-blue-500 hover:text-blue-700"><Icon name="Image" size={16}/></button>}</td></tr>))}</tbody></table>
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo Movimiento">
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 gap-4"><Select label="Tipo" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}><option value="Culto">Cierre de Culto</option><option value="Gasto">Gasto / Salida</option><option value="Ingreso">Otro Ingreso</option></Select><Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /></div>
                    {form.type === 'Culto' ? (<div className="space-y-3 p-3 bg-slate-50 rounded-xl border"><div className="grid grid-cols-2 gap-2"><Input label="Diezmo Efec." type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/><Input label="Ofrenda Efec." type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/></div><div className="grid grid-cols-2 gap-2"><Input label="Diezmo Banco" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/><Input label="Ofrenda Banco" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/></div><Input label="Cant. Diezmantes" type="number" value={form.tithersCount} onChange={e=>setForm({...form, tithersCount:e.target.value})}/></div>) : (<><Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="text-lg" /><div className="grid grid-cols-2 gap-4"><Select label="Origen" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select><SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/></div></>)}
                    <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
                    <label className="block w-full cursor-pointer border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-brand-300"><Icon name="Image" size={24} /><span className="text-xs font-bold">{isUploading?'Subiendo...':(form.attachmentUrl?'Listo':'Adjuntar')}</span><input type="file" className="hidden" accept="image/*" onChange={handleImage} disabled={isUploading} /></label>
                    <Button className="w-full" onClick={handleSave}>Guardar</Button>
                </div>
            </Modal>
            <Modal isOpen={!!receiptModal} onClose={()=>setReceiptModal(null)} title="Comprobante"><img src={receiptModal} className="w-full rounded-xl shadow-lg" /></Modal>
        </div>
    );
};
