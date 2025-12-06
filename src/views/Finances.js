// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    // 1. HOOKS INICIALES (Orden estricto, sin condiciones antes)
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;

    // Estado de la UI
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard');
    const [receiptModal, setReceiptModal] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showBalance, setShowBalance] = useState(true); // Ojo para ocultar saldos
    
    // Seguridad PIN
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    // Estado Formulario
    const initialForm = { 
        type: 'Culto', date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0], 
        tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', tithersCount: '', 
        amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' 
    };
    const [form, setForm] = useState(initialForm);

    // Categorías para gastos
    const categories = [
        { value: 'General', label: 'General / Varios' },
        { value: 'Mantenimiento', label: 'Infraestructura' },
        { value: 'Honorarios', label: 'Honorarios / Invitados' },
        { value: 'Alquiler', label: 'Alquiler y Servicios' },
        { value: 'Ayuda Social', label: 'Ayuda Social' },
        { value: 'Ministerios', label: 'Ministerios' },
        { value: 'Ofrenda Misionera', label: 'Ofrenda Misionera' }
    ];

    // --- CÁLCULOS DE DATOS ---
    
    // 1. Saldos Globales (Históricos)
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

    // 2. Datos del Mes Seleccionado (Para lista y gráfico de torta)
    const monthlyData = useMemo(() => {
        if (!finances) return [];
        const monthStr = currentDate.toISOString().slice(0, 7);
        return finances.filter(f => f.date && f.date.startsWith(monthStr)).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate]);

    // 3. Datos para Gráficos (Tendencia 6 meses)
    const chartData = useMemo(() => {
        // Aseguramos formato seguro para Recharts
        const trendMap = {};
        // Crear últimos 6 meses vacíos
        for(let i=5; i>=0; i--) { 
            const d = new Date(); d.setMonth(d.getMonth() - i); 
            const key = d.toISOString().slice(0,7);
            // IMPORTANTE: Usamos un label corto para el eje X
            trendMap[key] = { name: key, label: Utils.formatDate ? Utils.formatDate(d.toISOString().slice(0,10), 'month') : key, ingresos: 0, gastos: 0 }; 
        }

        if (finances) {
            finances.forEach(f => {
                if(!f.date) return;
                const key = f.date.slice(0, 7);
                if (trendMap[key]) {
                    let val = f.type === 'Culto' ? (Number(f.tithesCash||0)+Number(f.tithesTransfer||0)+Number(f.offeringsCash||0)+Number(f.offeringsTransfer||0)) : Number(f.amount||0);
                    if (val > 0) trendMap[key].ingresos += val; else trendMap[key].gastos += Math.abs(val);
                }
            });
        }

        // Datos Torta (Mes actual)
        const pieMap = {};
        monthlyData.filter(f => (f.amount < 0) || (f.total < 0)).forEach(f => {
            const cat = f.category || 'General';
            const val = Math.abs(Number(f.total || f.amount || 0));
            pieMap[cat] = (pieMap[cat] || 0) + val;
        });

        return { 
            trend: Object.values(trendMap), 
            pie: Object.entries(pieMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
        };
    }, [monthlyData, currentDate, finances]);


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
        } catch(err) { Utils.notify("Error al subir imagen", "error"); }
        setIsUploading(false);
    };

    const handleSave = () => {
        let final = { ...form, createdAt: new Date().toISOString() };
        
        if(form.type === 'Culto') {
            const total = Number(form.tithesCash||0)+Number(form.tithesTransfer||0)+Number(form.offeringsCash||0)+Number(form.offeringsTransfer||0);
            if(total===0) return Utils.notify("El total no puede ser 0", "error");
            final = { ...final, total, category: 'Culto' };
        } else {
            const amt = Number(form.amount||0);
            if(amt===0) return Utils.notify("Monto requerido", "error");
            // Lógica de signos: Gasto negativo, Ingreso positivo
            const val = Math.abs(amt);
            final = { ...final, amount: form.type==='Gasto' ? -val : val, total: form.type==='Gasto' ? -val : val };
        }

        addData('finances', final); 
        setIsModalOpen(false); 
        setForm(initialForm); 
        Utils.notify("Movimiento registrado");
    };

    // --- RENDERIZADO SEGURO ---
    const R = window.Recharts; // Acceso directo
    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
    const renderAmount = (amount) => showBalance ? formatCurrency(amount) : "$ ••••••";

    // 1. Validación Rol
    if (userProfile?.role !== 'Pastor') {
        return <div className="h-full flex items-center justify-center text-slate-500"><Icon name="LogOut" className="mr-2"/> Acceso exclusivo Pastoral</div>;
    }

    // 2. Bloqueo PIN
    if (isLocked) {
        return (
            <div className="h-full flex flex-col items-center justify-center animate-enter">
                <div className="bg-white p-8 rounded-3xl shadow-soft max-w-sm w-full text-center border border-slate-100">
                    <div className="bg-brand-100 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-brand-600 mb-6"><Icon name="Wallet" size={32}/></div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Billetera Digital</h2>
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <input type="password" inputMode="numeric" maxLength="4" className="text-center text-3xl tracking-[0.5em] font-bold w-full border-b-2 border-slate-200 focus:border-brand-500 outline-none py-2 text-slate-800" placeholder="••••" value={pinInput} autoFocus onChange={e => setPinInput(e.target.value)} />
                        {errorPin && <p className="text-red-500 text-xs font-bold">PIN Incorrecto</p>}
                        <Button className="w-full justify-center py-3 mt-4" onClick={handleUnlock}>Desbloquear</Button>
                    </form>
                </div>
            </div>
        );
    }

    // 3. Vista Principal
    return (
        <div className="space-y-8 fade-in pb-24">
            {/* CABECERA */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Billetera</h2>
                    <button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400 hover:text-brand-600"><Icon name={showBalance?"Search":"LogOut"} size={20}/></button>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        <button onClick={()=>setTabView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tabView==='dashboard'?'bg-slate-800 text-white shadow-md':'text-slate-500 hover:bg-slate-50'}`}>Dashboard</button>
                        <button onClick={()=>setTabView('list')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tabView==='list'?'bg-slate-800 text-white shadow-md':'text-slate-500 hover:bg-slate-50'}`}>Movimientos</button>
                    </div>
                    <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate ? Utils.getLocalDate() : new Date().toISOString().split('T')[0]}); setIsModalOpen(true);}}>Nuevo</Button>
                </div>
            </div>

            {/* TARJETAS DE SALDO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="Wallet" size={80}/></div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Saldo Global</p>
                    <h3 className="text-3xl font-black mt-1">{renderAmount(globalBalances.total)}</h3>
                </div>
                <Card className="border-l-4 border-l-emerald-500 py-4">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Caja Chica (Efectivo)</p>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{renderAmount(globalBalances.cash)}</h3>
                </Card>
                <Card className="border-l-4 border-l-blue-500 py-4">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Banco / Digital</p>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{renderAmount(globalBalances.bank)}</h3>
                </Card>
            </div>

            {/* VISTA GRÁFICOS */}
            {tabView === 'dashboard' && (
                <div className="space-y-6 animate-enter">
                    
                    {/* Botón Generar Datos si está vacío */}
                    {finances.length === 0 && (
                        <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                            <p className="text-slate-500 mb-2">No hay datos históricos.</p>
                            <button onClick={window.DataLogic.generateDemoFinances} className="text-brand-600 font-bold hover:underline text-sm flex items-center justify-center gap-2">
                                <Icon name="Plus" size={14}/> Generar Datos Demo (Oct/Nov 2025)
                            </button>
                        </div>
                    )}

                    {/* GRÁFICOS (Solo si Recharts existe) */}
                    {R ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Flujo de Caja */}
                            <Card className="lg:col-span-2 h-80 flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Tendencia Semestral</h3>
                                <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                                    <R.ResponsiveContainer width="100%" height="100%">
                                        <R.AreaChart data={chartData.trend}>
                                            <R.defs>
                                                <linearGradient id="colorIng" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                                <linearGradient id="colorEgr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                            </R.defs>
                                            <R.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                            <R.XAxis dataKey="label" tick={{fontSize:10}} axisLine={false} tickLine={false} />
                                            <R.Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px rgba(0,0,0,0.1)'}} />
                                            <R.Area type="monotone" dataKey="ingresos" stroke="#10b981" fillOpacity={1} fill="url(#colorIng)" strokeWidth={3} />
                                            <R.Area type="monotone" dataKey="gastos" stroke="#ef4444" fillOpacity={1} fill="url(#colorEgr)" strokeWidth={3} />
                                        </R.AreaChart>
                                    </R.ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Gastos del Mes */}
                            <Card className="h-80 flex flex-col">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Gastos del Mes</h3>
                                </div>
                                {/* Selector de Fecha para filtrar Torta */}
                                <div className="mb-2 scale-90 origin-left">
                                    <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                                </div>
                                
                                <div className="flex-1 relative" style={{ minHeight: 0 }}>
                                    {chartData.pie.length > 0 ? (
                                        <R.ResponsiveContainer width="100%" height="100%">
                                            <R.PieChart>
                                                <R.Pie data={chartData.pie} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                                                    {chartData.pie.map((entry, index) => <R.Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                                </R.Pie>
                                                <R.Tooltip />
                                            </R.PieChart>
                                        </R.ResponsiveContainer>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-slate-400 text-xs italic">
                                            Sin gastos en {formatDate(currentDate.toISOString().slice(0,10), 'month')}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    ) : (
                        <div className="p-4 bg-red-50 text-red-500 text-center rounded-xl border border-red-100">
                            Error: Librería de gráficos no cargada. Revisa tu conexión.
                        </div>
                    )}
                </div>
            )}

            {/* VISTA LISTA MOVIMIENTOS */}
            {tabView === 'list' && (
                <div className="space-y-4 animate-enter">
                    <div className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                        <span className="font-bold text-slate-700 ml-2">Filtrar por Mes:</span>
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                                    <tr><th className="p-4">Fecha</th><th className="p-4">Concepto</th><th className="p-4">Origen</th><th className="p-4 text-right">Monto</th><th className="p-4"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {monthlyData.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Sin movimientos en este mes.</td></tr>}
                                    {monthlyData.map(f => {
                                        const isCash = f.method === 'Efectivo' || (f.type === 'Culto' && (Number(f.tithesCash)>0 || Number(f.offeringsCash)>0));
                                        const isBank = f.method === 'Banco' || (f.type === 'Culto' && (Number(f.tithesTransfer)>0 || Number(f.offeringsTransfer)>0));
                                        return (
                                            <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-slate-600 whitespace-nowrap">{formatDate(f.date)}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{f.type==='Culto'?'Cierre Culto':f.category}</div>
                                                    <div className="text-xs text-slate-400">{f.notes || (f.type==='Culto' ? `${f.tithersCount} sobres` : '')}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex gap-2">
                                                        {isCash && <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold border border-emerald-100 flex items-center gap-1"><Icon name="DollarSign" size={10}/> Efec</span>}
                                                        {isBank && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-blue-100 flex items-center gap-1"><Icon name="Briefcase" size={10}/> Dig</span>}
                                                    </div>
                                                </td>
                                                <td className={`p-4 text-right font-mono font-bold ${(f.total||f.amount)<0?'text-red-600':'text-emerald-600'}`}>{formatCurrency(f.total||f.amount)}</td>
                                                <td className="p-4 text-right">{f.attachmentUrl && <button onClick={()=>setReceiptModal(f.attachmentUrl)} className="text-blue-400 hover:text-blue-600"><Icon name="Image" size={16}/></button>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL NUEVO */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Registrar Movimiento">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 mb-2">
                        {['Culto', 'Gasto', 'Ingreso'].map(t => (
                            <button key={t} onClick={()=>setForm({...initialForm, type: t})} className={`py-2 text-xs font-bold rounded-lg transition-all ${form.type===t ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
                        ))}
                    </div>
                    
                    <Input type="date" label="Fecha" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />

                    {form.type === 'Culto' ? (
                        <div className="space-y-4">
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                <h4 className="font-bold text-emerald-800 text-xs uppercase mb-3 flex items-center gap-2"><Icon name="DollarSign" size={14}/> Efectivo (Alfolí)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Diezmos" type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})} placeholder="$" />
                                    <Input label="Ofrendas" type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})} placeholder="$" />
                                </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-blue-800 text-xs uppercase mb-3 flex items-center gap-2"><Icon name="Briefcase" size={14}/> Banco / Digital</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Diezmos" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})} placeholder="$" />
                                    <Input label="Ofrendas" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})} placeholder="$" />
                                </div>
                            </div>
                            <Input label="Cant. Sobres" type="number" value={form.tithersCount} onChange={e=>setForm({...form, tithersCount:e.target.value})} placeholder="Ej. 12" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="text-lg font-mono" placeholder="$ 0.00" />
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Origen" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option value="Efectivo">Caja Chica</option><option value="Banco">Banco / App</option></Select>
                                <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})} />
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Detalle opcional..." />
                        <label className="block w-full cursor-pointer border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-brand-300 hover:bg-brand-50 transition-all">
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                                <Icon name="Image" size={20} />
                                <span className="text-xs font-bold">{isUploading ? 'Subiendo...' : (form.attachmentUrl ? 'Comprobante OK' : 'Adjuntar Foto')}</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImage} disabled={isUploading} />
                        </label>
                    </div>

                    <div className="pt-2">
                        <Button className="w-full py-3 shadow-lg shadow-brand-500/20" onClick={handleSave} disabled={isUploading}>Confirmar Operación</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Foto */}
            <Modal isOpen={!!receiptModal} onClose={()=>setReceiptModal(null)} title="Comprobante">
                <img src={receiptModal} className="w-full rounded-xl shadow-lg" alt="Comprobante" />
            </Modal>
        </div>
    );
};
