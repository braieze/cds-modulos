// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    // 1. HOOKS UNIFICADOS (Solución al error anterior)
    const { useState, useMemo, useEffect, useRef } = React;
    
    const Utils = window.Utils || {};
    const { Card, Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;

    // Estados UI
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard');
    const [receiptModal, setReceiptModal] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null); // Nuevo: Para expandir filas
    const [isUploading, setIsUploading] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Seguridad PIN
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    // Formulario
    const initialForm = { type: 'Culto', date: Utils.getLocalDate(), tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', tithersCount: '', amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' };
    const [form, setForm] = useState(initialForm);

    const categories = [
        { value: 'General', label: 'General / Varios', icon: 'Info' },
        { value: 'Mantenimiento', label: 'Infraestructura', icon: 'Briefcase' },
        { value: 'Honorarios', label: 'Honorarios', icon: 'Users' },
        { value: 'Alquiler', label: 'Alquiler', icon: 'Home' },
        { value: 'Ayuda Social', label: 'Ayuda Social', icon: 'Smile' },
        { value: 'Ministerios', label: 'Ministerios', icon: 'Music' },
        { value: 'Ofrenda Misionera', label: 'Misiones', icon: 'Globe' }
    ];

    // --- CÁLCULOS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    // 1. Saldos Globales (Histórico completo) + Tendencia Mensual
    const balances = useMemo(() => {
        let cash = 0, bank = 0;
        let currentMonthTotal = 0;
        let lastMonthTotal = 0;
        
        const currentMonthStr = currentDate.toISOString().slice(0, 7);
        const lastMonthDate = new Date(currentDate); lastMonthDate.setMonth(lastMonthDate.getMonth()-1);
        const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);

        if (finances) {
            finances.forEach(f => {
                let val = 0;
                // Cálculo de saldos acumulados (histórico)
                if (f.type === 'Culto') {
                    const c = safeNum(f.tithesCash)+safeNum(f.offeringsCash);
                    const b = safeNum(f.tithesTransfer)+safeNum(f.offeringsTransfer);
                    cash += c; bank += b;
                    val = c + b;
                } else {
                    val = safeNum(f.amount);
                    if (f.method === 'Banco') bank += val; else cash += val;
                }

                // Cálculo para tendencia (solo compara meses)
                // Nota: Usamos la fecha del movimiento para ver si cae en el mes actual o pasado
                if (f.date && f.date.startsWith(currentMonthStr)) currentMonthTotal += val;
                if (f.date && f.date.startsWith(lastMonthStr)) lastMonthTotal += val;
            });
        }
        
        let trend = 0;
        if (lastMonthTotal !== 0) trend = ((currentMonthTotal - lastMonthTotal) / Math.abs(lastMonthTotal)) * 100;
        
        return { cash, bank, total: cash + bank, trend: trend.toFixed(1) };
    }, [finances, currentDate]);

    // 2. Datos Filtrados por Mes (Para Lista y Gráficos de periodo)
    const monthlyData = useMemo(() => {
        if (!finances) return [];
        const m = currentDate.toISOString().slice(0, 7);
        return finances
            .filter(f => f.date && f.date.startsWith(m))
            .filter(f => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return (f.category||'').toLowerCase().includes(term) || (f.notes||'').toLowerCase().includes(term);
            })
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate, searchTerm]);

    // 3. Datos para Gráficos
    const chartData = useMemo(() => {
        if (!finances) return { trend: [], pie: [], bar: [] };
        const trendMap = {};
        
        // Inicializar 6 meses hacia atrás desde la fecha seleccionada
        for(let i=5; i>=0; i--) { 
            const d = new Date(currentDate); d.setMonth(d.getMonth() - i); 
            const k = d.toISOString().slice(0,7);
            trendMap[k] = { name: k, label: Utils.formatDate(d.toISOString().slice(0,10), 'month'), ingresos: 0, gastos: 0, balance: 0 }; 
        }

        finances.forEach(f => {
            if(!f.date) return;
            const k = f.date.slice(0, 7);
            if (trendMap[k]) {
                let val = 0, inc = false;
                if (f.type === 'Culto') { val = safeNum(f.tithesCash)+safeNum(f.tithesTransfer)+safeNum(f.offeringsCash)+safeNum(f.offeringsTransfer); inc = true; }
                else { val = safeNum(f.amount); inc = val > 0; }
                
                if (inc) trendMap[k].ingresos += Math.abs(val); 
                else trendMap[k].gastos += Math.abs(val);
                trendMap[k].balance += val;
            }
        });

        // Pie Chart: Usamos monthlyData (el mes seleccionado)
        const pieMap = {};
        monthlyData.filter(f => safeNum(f.total||f.amount) < 0).forEach(f => {
            const c = f.category || 'General';
            pieMap[c] = (pieMap[c] || 0) + Math.abs(safeNum(f.total||f.amount));
        });

        return { 
            trend: Object.values(trendMap).sort((a,b) => a.name.localeCompare(b.name)), 
            pie: Object.entries(pieMap).map(([n,v]) => ({ name: n, value: v })).sort((a,b) => b.value - a.value)
        };
    }, [monthlyData, currentDate, finances]);

    // --- RENDER ---
    const renderAmount = (a) => showBalance ? formatCurrency(safeNum(a)) : "$ ••••••";
    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#6366f1'];
    const Chart = window.Chart; 

    // Chart Hooks
    const lineChartRef = useRef(null);
    const barChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const chartInstances = useRef({});

    useEffect(() => {
        if (tabView !== 'dashboard' || !Chart) return;
        Object.values(chartInstances.current).forEach(c => c.destroy());

        if (lineChartRef.current) {
            const ctx = lineChartRef.current.getContext('2d');
            chartInstances.current.line = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.trend.map(d => d.label),
                    datasets: [{ label: 'Balance', data: chartData.trend.map(d => d.balance), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } }
            });
        }

        if (barChartRef.current) {
            const ctx = barChartRef.current.getContext('2d');
            chartInstances.current.bar = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.trend.map(d => d.label),
                    datasets: [
                        { label: 'Ingresos', data: chartData.trend.map(d => d.ingresos), backgroundColor: '#10b981', borderRadius: 4 },
                        { label: 'Gastos', data: chartData.trend.map(d => d.gastos), backgroundColor: '#ef4444', borderRadius: 4 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { display: false } } } }
            });
        }

        if (pieChartRef.current && chartData.pie.length > 0) {
            const ctx = pieChartRef.current.getContext('2d');
            chartInstances.current.pie = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartData.pie.map(d => d.name),
                    datasets: [{ data: chartData.pie.map(d => d.value), backgroundColor: PIE_COLORS, borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }
            });
        }
        return () => Object.values(chartInstances.current).forEach(c => c.destroy());
    }, [chartData, tabView]);

    // Helpers
    const handleUnlock = (e) => { e.preventDefault(); if (pinInput === '1234') { setIsLocked(false); setErrorPin(false); } else { setErrorPin(true); setPinInput(''); } };
    const handleImage = async (e) => { const f=e.target.files[0]; if(!f)return; setIsUploading(true); try{const b=await compressImage(f); setForm(p=>({...p, attachmentUrl:b}));}catch(err){Utils.notify("Error subida","error");} setIsUploading(false); };
    
    const handleSave = () => { 
        let f = {...form, createdAt: new Date().toISOString() };
        if(form.type==='Culto') {
            const t = safeNum(form.tithesCash)+safeNum(form.tithesTransfer)+safeNum(form.offeringsCash)+safeNum(form.offeringsTransfer);
            if(t===0) return Utils.notify("Total 0", "error");
            f.total = t; f.category = 'Culto';
            f.tithesCash=safeNum(f.tithesCash); f.tithesTransfer=safeNum(f.tithesTransfer); 
        } else {
            const a = safeNum(form.amount); if(a===0) return Utils.notify("Monto 0", "error");
            const v = Math.abs(a); f.amount = form.type==='Gasto'?-v:v; f.total = f.amount;
        }
        addData('finances', f); setIsModalOpen(false); setForm(initialForm); Utils.notify("Registrado");
    };

    const toggleRow = (id) => setExpandedRow(expandedRow === id ? null : id);

    // Render Bloqueo
    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-500">Acceso Restringido</div>;
    if (isLocked) return (<div className="h-full flex flex-col items-center justify-center animate-enter"><div className="bg-white p-8 rounded-3xl shadow-soft max-w-sm w-full text-center border border-slate-100"><div className="bg-brand-100 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-brand-600 mb-6"><Icon name="Wallet" size={32}/></div><h2 className="text-2xl font-extrabold text-slate-800 mb-2">Billetera</h2><form onSubmit={handleUnlock}><input type="password" maxLength="4" className="text-center text-3xl font-bold w-full border-b-2 outline-none py-2" value={pinInput} onChange={e=>setPinInput(e.target.value)} placeholder="••••" /><Button className="w-full mt-4" onClick={handleUnlock}>Desbloquear</Button></form></div></div>);

    return (
        <div className="space-y-8 fade-in pb-24">
            {/* 1. HEADER GLOBAL (Con Filtro de Fecha para Panel y Lista) */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Billetera</h2>
                    <button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400 hover:text-brand-600"><Icon name={showBalance?"Search":"LogOut"}/></button>
                </div>
                
                {/* Aquí está el selector de fecha y pestañas */}
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                    </div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        <button onClick={()=>setTabView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='dashboard'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Panel</button>
                        <button onClick={()=>setTabView('list')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='list'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Lista</button>
                    </div>
                    <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}}>Nuevo</Button>
                </div>
            </div>

            {/* 2. TARJETAS DE SALDO (Siempre visibles) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Global</p>
                    <h3 className="text-4xl font-black">{renderAmount(balances.total)}</h3>
                    <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${balances.trend >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        <span>{balances.trend >= 0 ? '↑' : '↓'} {Math.abs(balances.trend)}% este mes</span>
                    </div>
                </div>
                <Card className="border-l-4 border-l-emerald-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Caja Chica (Efectivo)</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{renderAmount(balances.cash)}</h3></Card>
                <Card className="border-l-4 border-l-blue-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Banco / Digital</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{renderAmount(balances.bank)}</h3></Card>
            </div>

            {/* 3. VISTA PANEL */}
            {tabView === 'dashboard' && (
                <div className="space-y-6 animate-enter">
                    {finances.length === 0 && <div className="text-center py-4"><button onClick={window.DataLogic.generateDemoFinances} className="text-brand-600 text-xs font-bold hover:underline">+ Generar Demo</button></div>}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="h-72">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-4">Evolución (6 Meses)</h3>
                            <div className="h-56 w-full relative"><canvas ref={lineChartRef}></canvas></div>
                        </Card>
                        <Card className="h-72">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-4">Balance vs Mes Anterior</h3>
                            <div className="h-56 w-full relative"><canvas ref={barChartRef}></canvas></div>
                        </Card>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="h-80 col-span-1">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-4">Gastos ({Utils.formatDate(currentDate.toISOString(), 'month')})</h3>
                            <div className="h-48 w-full relative flex justify-center">
                                {chartData.pie.length > 0 ? <canvas ref={pieChartRef}></canvas> : <p className="text-xs text-slate-400 self-center">Sin gastos este mes</p>}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                {chartData.pie.slice(0,4).map((p, i) => (
                                    <div key={i} className="flex items-center gap-1 text-[10px] bg-slate-50 px-2 py-1 rounded-full">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: PIE_COLORS[i % PIE_COLORS.length]}}></div> {p.name}
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card className="col-span-2 bg-slate-900 text-white flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-6 text-brand-400"><Icon name="Info"/><h3 className="font-bold">Resumen del Mes</h3></div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div><p className="text-xs text-slate-400 uppercase mb-2">Ingresos</p><h4 className="text-xl font-bold text-emerald-400">{renderAmount(monthlyData.filter(x=>safeNum(x.total||x.amount)>0).reduce((a,b)=>a+Math.abs(safeNum(b.total||b.amount)),0))}</h4></div>
                                <div><p className="text-xs text-slate-400 uppercase mb-2">Gastos</p><h4 className="text-xl font-bold text-red-400">{renderAmount(monthlyData.filter(x=>safeNum(x.total||x.amount)<0).reduce((a,b)=>a+Math.abs(safeNum(b.total||b.amount)),0))}</h4></div>
                                <div><p className="text-xs text-slate-400 uppercase mb-2">Neto</p><h4 className="text-xl font-bold text-white">{renderAmount(monthlyData.reduce((a,b)=>a+safeNum(b.total||b.amount),0))}</h4></div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* 4. VISTA LISTA (EXPANDIBLE) */}
            {tabView === 'list' && (
                <div className="space-y-4 animate-enter">
                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                        <Icon name="Search" size={16} className="text-slate-400 ml-2"/>
                        <input className="w-full bg-transparent border-none text-sm outline-none" placeholder="Buscar concepto, nota..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    </div>

                    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="p-4">Día</th><th className="p-4">Concepto</th><th className="p-4 text-right">Monto</th><th className="p-4"></th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {monthlyData.length===0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Sin movimientos en {Utils.formatDate(currentDate.toISOString(),'month')}.</td></tr>}
                                    {monthlyData.map(f => {
                                        const catInfo = categories.find(c => c.value === f.category) || {};
                                        const IconName = catInfo.icon || (f.type === 'Culto' ? 'Home' : 'DollarSign');
                                        const isExp = expandedRow === f.id;
                                        const totalAmount = safeNum(f.total || f.amount);

                                        return (
                                            <React.Fragment key={f.id}>
                                                <tr onClick={()=>toggleRow(f.id)} className={`cursor-pointer transition-colors ${isExp ? 'bg-brand-50/50' : 'hover:bg-slate-50'}`}>
                                                    <td className="p-4 text-slate-500 font-medium w-16 text-center">
                                                        <div className="text-lg font-bold text-slate-700">{f.date.slice(8,10)}</div>
                                                        <div className="text-[10px] uppercase">{Utils.formatDate(f.date).split(' ')[0]}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${f.type==='Culto'?'bg-indigo-100 text-indigo-600':(totalAmount<0?'bg-red-100 text-red-600':'bg-emerald-100 text-emerald-600')}`}><Icon name={IconName} size={16}/></div>
                                                            <div>
                                                                <div className="font-bold text-slate-800">{f.type==='Culto' ? 'Cierre de Culto' : f.category}</div>
                                                                <div className="text-xs text-slate-500 truncate max-w-[150px]">{f.notes || (f.type==='Culto'?'Diezmos y Ofrendas':f.method)}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={`p-4 text-right font-mono font-bold ${totalAmount<0?'text-red-600':'text-emerald-600'}`}>{formatCurrency(totalAmount)}</td>
                                                    <td className="p-4 text-right text-slate-400"><Icon name={isExp ? "ChevronUp" : "ChevronDown"} size={16}/></td>
                                                </tr>
                                                {/* DETALLE EXPANDIBLE */}
                                                {isExp && (
                                                    <tr className="bg-slate-50/50 animate-enter border-b border-slate-100">
                                                        <td colSpan="4" className="p-4">
                                                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start">
                                                                
                                                                {/* Lado Izquierdo: Desglose */}
                                                                <div className="space-y-3 w-full">
                                                                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Detalle del Movimiento</h4>
                                                                    {f.type === 'Culto' ? (
                                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                                            <div className="p-2 bg-emerald-50 rounded border border-emerald-100">
                                                                                <div className="text-emerald-800 font-bold mb-1">Efectivo (Caja)</div>
                                                                                <div className="flex justify-between text-slate-600 text-xs"><span>Diezmos:</span> <span>{formatCurrency(f.tithesCash)}</span></div>
                                                                                <div className="flex justify-between text-slate-600 text-xs"><span>Ofrendas:</span> <span>{formatCurrency(f.offeringsCash)}</span></div>
                                                                            </div>
                                                                            <div className="p-2 bg-blue-50 rounded border border-blue-100">
                                                                                <div className="text-blue-800 font-bold mb-1">Banco / Transf.</div>
                                                                                <div className="flex justify-between text-slate-600 text-xs"><span>Diezmos:</span> <span>{formatCurrency(f.tithesTransfer)}</span></div>
                                                                                <div className="flex justify-between text-slate-600 text-xs"><span>Ofrendas:</span> <span>{formatCurrency(f.offeringsTransfer)}</span></div>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex gap-4 items-center">
                                                                             <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${f.method==='Banco'?'bg-blue-50 text-blue-600 border-blue-100':'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                                                Método: {f.method}
                                                                             </div>
                                                                             {f.notes && <div className="text-sm text-slate-600 italic">"{f.notes}"</div>}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Lado Derecho: Comprobante */}
                                                                <div className="shrink-0">
                                                                    {f.attachmentUrl ? (
                                                                        <button onClick={(e)=>{e.stopPropagation(); setReceiptModal(f.attachmentUrl)}} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors">
                                                                            <Icon name="Image" size={14}/> Ver Comprobante
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-400 italic flex items-center gap-1"><Icon name="Slash" size={10}/> Sin comprobante</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALES */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo Movimiento">
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl mb-4">
                        {['Culto','Gasto','Ingreso'].map(t=><button key={t} onClick={()=>setForm({...initialForm, type:t})} className={`py-2 text-xs font-bold rounded ${form.type===t?'bg-slate-800 text-white shadow-md':'text-slate-500 hover:bg-slate-200'}`}>{t}</button>)}
                    </div>
                    <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                    
                    {form.type==='Culto' ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <label className="text-xs font-bold text-emerald-700 uppercase mb-2 block">Efectivo (A Caja Chica)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input label="Diezmos" placeholder="$0" type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/>
                                    <Input label="Ofrendas" placeholder="$0" type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/>
                                </div>
                            </div>
                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                <label className="text-xs font-bold text-blue-700 uppercase mb-2 block">Digital (A Banco)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input label="Diezmos" placeholder="$0" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/>
                                    <Input label="Ofrendas" placeholder="$0" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Monto" type="number" placeholder="$0.00" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} />
                                <Select label="Método de Pago" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}>
                                    <option value="Efectivo">Efectivo (Caja)</option>
                                    <option value="Banco">Banco / Digital</option>
                                </Select>
                            </div>
                            <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/>
                        </>
                    )}
                    
                    <Input label="Notas / Detalles" placeholder="Ej. Compra de cables..." value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comprobante (Foto)</label>
                        <div className="flex items-center gap-2">
                            <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleImage} />
                            <label htmlFor="file-upload" className="flex-1 cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-3 text-slate-500 hover:border-brand-500 hover:text-brand-600 transition-colors">
                                <Icon name={isUploading ? "Loader" : "Camera"} />
                                <span className="text-xs font-bold">{form.attachmentUrl ? 'Cambiar Foto' : 'Adjuntar Foto'}</span>
                            </label>
                            {form.attachmentUrl && <div className="w-10 h-10 rounded-lg bg-slate-100 bg-cover bg-center border border-slate-200" style={{backgroundImage:`url(${form.attachmentUrl})`}}></div>}
                        </div>
                    </div>

                    <Button className="w-full mt-2" onClick={handleSave} disabled={isUploading}>{isUploading ? 'Procesando...' : 'Guardar Movimiento'}</Button>
                </div>
            </Modal>
            
            <Modal isOpen={!!receiptModal} onClose={()=>setReceiptModal(null)} title="Comprobante Adjunto">
                <div className="flex justify-center bg-slate-100 rounded-xl overflow-hidden">
                    <img src={receiptModal} className="max-w-full max-h-[70vh] object-contain" />
                </div>
                <div className="mt-4 flex justify-end">
                    <Button onClick={()=>setReceiptModal(null)} className="bg-slate-200 !text-slate-800 hover:bg-slate-300">Cerrar</Button>
                </div>
            </Modal>
        </div>
    );
};
