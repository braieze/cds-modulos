// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    // 1. HOOKS AL PRINCIPIO (Orden estricto)
    const { useState, useMemo, useEffect } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;
    
    // Acceso seguro a Recharts
    const Recharts = window.Recharts || null;
    
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard');
    const [receiptModal, setReceiptModal] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    
    // Seguridad PIN
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

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
        { value: 'Ministerios', label: 'Ministerios' },
        { value: 'Ofrenda Misionera', label: 'Ofrenda Misionera' }
    ];

    // --- CÁLCULOS ---
    const globalBalances = useMemo(() => {
        let cash = 0, bank = 0;
        if (finances) {
            finances.forEach(f => {
                if (f.type === 'Culto') { 
                    cash += (Number(f.tithesCash||0) + Number(f.offeringsCash||0)); 
                    bank += (Number(f.tithesTransfer||0) + Number(f.offeringsTransfer||0)); 
                } else { 
                    const val = Number(f.amount||0); 
                    if (f.method === 'Banco') bank += val; else cash += val; 
                }
            });
        }
        return { cash, bank, total: cash + bank };
    }, [finances]);

    const monthlyData = useMemo(() => {
        if (!finances) return [];
        const monthStr = currentDate.toISOString().slice(0, 7);
        return finances.filter(f => f.date && f.date.startsWith(monthStr)).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate]);

    const chartData = useMemo(() => {
        if (!Recharts || !finances) return { trend: [], pie: [] };
        
        const trendMap = {};
        // Generar últimos 6 meses dinámicamente
        for(let i=5; i>=0; i--) { 
            const d = new Date(); d.setMonth(d.getMonth() - i); 
            const key = d.toISOString().slice(0,7);
            // Usamos key como etiqueta temporal
            trendMap[key] = { name: key, ingresos: 0, gastos: 0, label: Utils.formatDate ? Utils.formatDate(d.toISOString().slice(0,10), 'month') : key }; 
        }

        finances.forEach(f => {
            if(!f.date) return;
            const key = f.date.slice(0, 7);
            
            // Si el mes está en el rango de los últimos 6 o es el actual
            if (trendMap[key] || key === currentDate.toISOString().slice(0,7)) {
                // Si no existe en el mapa (ej. futuro o selección actual), lo creamos
                if(!trendMap[key]) trendMap[key] = { name: key, ingresos: 0, gastos: 0, label: key };

                let val = 0;
                if (f.type === 'Culto') {
                    val = (Number(f.tithesCash||0)+Number(f.tithesTransfer||0)+Number(f.offeringsCash||0)+Number(f.offeringsTransfer||0));
                    trendMap[key].ingresos += val;
                } else {
                    const amt = Number(f.amount||0);
                    if (amt > 0) trendMap[key].ingresos += amt; 
                    else trendMap[key].gastos += Math.abs(amt);
                }
            }
        });
        
        const pieMap = {};
        monthlyData.filter(f => (f.amount < 0)).forEach(f => {
            const cat = f.category || 'General';
            pieMap[cat] = (pieMap[cat] || 0) + Math.abs(Number(f.amount));
        });
        
        return { 
            // Convertir a array y ordenar por fecha
            trend: Object.values(trendMap).sort((a,b) => a.name.localeCompare(b.name)), 
            pie: Object.entries(pieMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
        };
    }, [monthlyData, currentDate, Recharts, finances]);


    // --- HANDLERS ---
    const handleUnlock = (e) => {
        e.preventDefault();
        if (pinInput === '1234') { setIsLocked(false); setErrorPin(false); } 
        else { setErrorPin(true); setPinInput(''); }
    };

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
        let final = { ...form, createdAt: new Date().toISOString() };
        if(form.type === 'Culto') {
            const total = Number(form.tithesCash||0)+Number(form.tithesTransfer||0)+Number(form.offeringsCash||0)+Number(form.offeringsTransfer||0);
            if(total===0) return Utils.notify("Total 0", "error");
            final = {...final, tithesCash:form.tithesCash, tithesTransfer:form.tithesTransfer, offeringsCash:form.offeringsCash, offeringsTransfer:form.offeringsTransfer, tithersCount:form.tithersCount, total, category:'Culto'};
        } else {
            const amt = Number(form.amount||0);
            if(amt===0) return Utils.notify("Monto requerido", "error");
            final = {...final, amount: form.type==='Gasto' ? -Math.abs(amt) : Math.abs(amt), method: form.method, total: form.type==='Gasto' ? -Math.abs(amt) : Math.abs(amt)};
        }
        addData('finances', final); setIsModalOpen(false); setForm(initialForm); Utils.notify("Registrado");
    };

    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
    const renderAmount = (amount) => showBalance ? formatCurrency(amount) : "$ ••••••";

    // --- RENDER ---

    if (userProfile?.role !== 'Pastor') {
        return <div className="h-full flex items-center justify-center text-slate-500"><Icon name="LogOut" className="mr-2"/> Acceso Restringido</div>;
    }

    if (isLocked) {
        return (
            <div className="h-full flex flex-col items-center justify-center animate-enter">
                <div className="bg-white p-8 rounded-3xl shadow-soft max-w-sm w-full text-center border border-slate-100">
                    <div className="bg-brand-100 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-brand-600 mb-6"><Icon name="Wallet" size={32}/></div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Billetera Digital</h2>
                    <p className="text-slate-500 mb-6 text-sm">PIN de Acceso: 1234</p>
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <input type="password" inputMode="numeric" maxLength="4" className="text-center text-3xl tracking-[0.5em] font-bold w-full border-b-2 border-slate-200 focus:border-brand-500 outline-none py-2 text-slate-800" placeholder="••••" value={pinInput} autoFocus onChange={e => setPinInput(e.target.value)} />
                        {errorPin && <p className="text-red-500 text-xs font-bold">PIN Incorrecto</p>}
                        <Button className="w-full justify-center py-3 mt-4" onClick={handleUnlock}>Desbloquear</Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3"><h2 className="text-2xl font-bold text-slate-800">Billetera</h2><button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400 hover:text-brand-600"><Icon name={showBalance?"Search":"LogOut"} size={20}/></button></div>
                <div className="flex gap-2">
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        <button onClick={()=>setTabView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tabView==='dashboard'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Panel</button>
                        <button onClick={()=>setTabView('list')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='list'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Movimientos</button>
                    </div>
                    <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0]}); setIsModalOpen(true);}}>Nuevo</Button>
                </div>
            </div>

            {/* Saldos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="Wallet" size={80}/></div><p className="text-slate-400 text-xs font-bold uppercase">Total Global</p><h3 className="text-3xl font-extrabold">{renderAmount(globalBalances.total)}</h3></div>
                <Card className="border-l-4 border-l-emerald-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Caja Chica (Efectivo)</p><h3 className="text-2xl font-extrabold text-slate-800">{renderAmount(globalBalances.cash)}</h3></Card>
                <Card className="border-l-4 border-l-blue-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Banco / Digital</p><h3 className="text-2xl font-extrabold text-slate-800">{renderAmount(globalBalances.bank)}</h3></Card>
            </div>

            <div className="flex justify-between items-center mt-6">
                <h3 className="font-bold text-lg text-slate-800">Resumen Mensual</h3>
                <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
            </div>

            {/* Gráficos Dashboard */}
            {tabView === 'dashboard' && (
                <div className="animate-enter space-y-6">
                    {/* Si no hay datos globales, mostrar botón de generación */}
                    {finances.length === 0 && (
                        <div className="text-center py-12 bg-brand-50 rounded-3xl border border-brand-100">
                            <Icon name="Wallet" size={48} className="text-brand-300 mx-auto mb-4"/>
                            <h3 className="text-brand-900 font-bold text-lg">Comienza tu Billetera</h3>
                            <p className="text-brand-700/70 text-sm mb-6 max-w-xs mx-auto">Aún no tienes movimientos. Genera datos de prueba para ver los gráficos.</p>
                            <button onClick={window.DataLogic.generateDemoFinances} className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">
                                Generar Datos Demo (Oct/Nov)
                            </button>
                        </div>
                    )}

                    {finances.length > 0 && Recharts ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="lg:col-span-2 h-72">
                                <h3 className="font-bold text-slate-800 mb-4">Flujo de Caja (6 Meses)</h3>
                                <div className="h-full w-full -ml-4">
                                    <Recharts.ResponsiveContainer width="100%" height="90%">
                                        <Recharts.LineChart data={chartData.trend}>
                                            <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                            <Recharts.XAxis dataKey="label" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                                            <Recharts.Tooltip />
                                            <Recharts.Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} dot={{r:4}} />
                                            <Recharts.Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={3} dot={{r:4}} />
                                        </Recharts.LineChart>
                                    </Recharts.ResponsiveContainer>
                                </div>
                            </Card>
                            <Card className="h-72 flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-2">Gastos del Mes</h3>
                                <div className="flex-1 relative">
                                    {chartData.pie.length > 0 ? (
                                        <Recharts.ResponsiveContainer width="100%" height="100%">
                                            <Recharts.PieChart>
                                                <Recharts.Pie data={chartData.pie} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                                    {chartData.pie.map((entry, index) => <Recharts.Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                                </Recharts.Pie>
                                                <Recharts.Tooltip />
                                            </Recharts.PieChart>
                                        </Recharts.ResponsiveContainer>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-slate-400 text-xs italic">
                                            Selecciona un mes con gastos (ej. Octubre)
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Lista Movimientos */}
            {tabView === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="p-4">Fecha</th><th className="p-4">Detalle</th><th className="p-4 text-right">Monto</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{monthlyData.length===0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Sin movimientos este mes.</td></tr>}{monthlyData.map(f => (<tr key={f.id} className="hover:bg-slate-50"><td className="p-4 whitespace-nowrap text-slate-600">{formatDate(f.date)}</td><td className="p-4"><div className="font-bold text-slate-800">{f.type==='Culto'?'Cierre Culto':f.category}</div><div className="text-xs text-slate-500">{f.notes||f.method}</div></td><td className={`p-4 text-right font-mono font-bold ${f.total<0?'text-red-600':'text-emerald-600'}`}>{formatCurrency(f.total || f.amount)}</td><td className="p-4 text-right">{f.attachmentUrl && <button onClick={()=>setReceiptModal(f.attachmentUrl)} className="text-blue-500 hover:text-blue-700"><Icon name="Image" size={16}/></button>}</td></tr>))}</tbody></table>
                    </div>
                </div>
            )}

            {/* Modal Movimiento */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo Movimiento">
                <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 mb-4">{['Culto', 'Gasto', 'Ingreso'].map(t => (<button key={t} onClick={()=>setForm({...initialForm, type: t})} className={`py-2 text-xs font-bold rounded-lg transition-all ${form.type===t ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>))}</div>
                    <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
                    {form.type === 'Culto' ? (<div className="space-y-4"><div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100"><h4 className="font-bold text-emerald-800 text-xs uppercase mb-3 flex items-center gap-2"><Icon name="DollarSign" size={14}/> Efectivo</h4><div className="grid grid-cols-2 gap-3"><Input label="Diezmos" type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})} /><Input label="Ofrendas" type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})} /></div></div><div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><h4 className="font-bold text-blue-800 text-xs uppercase mb-3 flex items-center gap-2"><Icon name="Briefcase" size={14}/> Banco</h4><div className="grid grid-cols-2 gap-3"><Input label="Diezmos" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})} /><Input label="Ofrendas" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})} /></div></div><Input label="Sobres de Diezmo" type="number" value={form.tithersCount} onChange={e=>setForm({...form, tithersCount:e.target.value})} /></div>) : (<div className="space-y-4"><Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="text-lg" /><div className="grid grid-cols-2 gap-4"><SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})} /><Select label="Método" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option value="Efectivo">Efectivo</option><option value="Banco">Banco</option></Select></div></div>)}
                    <div className="space-y-2"><Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} /><label className="block w-full cursor-pointer border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-brand-300"><div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-brand-500"><Icon name="Image" size={24} /><span className="text-xs font-bold">{isUploading?'Subiendo...':(form.attachmentUrl?'Cambiar Comprobante':'Adjuntar Comprobante')}</span></div><input type="file" className="hidden" accept="image/*" onChange={handleImage} disabled={isUploading} /></label></div>
                    <div className="pt-2"><Button className="w-full py-3 shadow-lg shadow-brand-500/20" onClick={handleSave} disabled={isUploading}>Registrar</Button></div>
                </div>
            </Modal>
            <Modal isOpen={!!receiptModal} onClose={()=>setReceiptModal(null)} title="Comprobante"><img src={receiptModal} className="w-full rounded-xl shadow-lg" /></Modal>
        </div>
    );
};
