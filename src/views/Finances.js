// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    // 1. HOOKS
    const { useState, useMemo, useEffect } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;
    
    // Estados UI
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard');
    const [receiptModal, setReceiptModal] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const [searchTerm, setSearchTerm] = useState(''); // Nuevo Buscador
    
    // Seguridad PIN
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    // Formulario
    const initialForm = { type: 'Culto', date: Utils.getLocalDate(), tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', tithersCount: '', amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' };
    const [form, setForm] = useState(initialForm);

    const categories = [
        { value: 'General', label: 'General / Varios', icon: 'Info' },
        { value: 'Mantenimiento', label: 'Infraestructura', icon: 'Briefcase' }, // Usar iconos disponibles
        { value: 'Honorarios', label: 'Honorarios', icon: 'Users' },
        { value: 'Alquiler', label: 'Alquiler', icon: 'Home' },
        { value: 'Ayuda Social', label: 'Ayuda Social', icon: 'Smile' },
        { value: 'Ministerios', label: 'Ministerios', icon: 'Music' },
        { value: 'Ofrenda Misionera', label: 'Misiones', icon: 'Globe' } // Icono genérico
    ];

    // --- CÁLCULOS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    // 1. Saldos Globales + Tendencia
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
                if (f.type === 'Culto') {
                    const c = safeNum(f.tithesCash)+safeNum(f.offeringsCash);
                    const b = safeNum(f.tithesTransfer)+safeNum(f.offeringsTransfer);
                    cash += c; bank += b;
                    val = c + b;
                } else {
                    val = safeNum(f.amount);
                    if (f.method === 'Banco') bank += val; else cash += val;
                }

                // Calcular totales mensuales para tendencia
                if (f.date && f.date.startsWith(currentMonthStr)) currentMonthTotal += val;
                if (f.date && f.date.startsWith(lastMonthStr)) lastMonthTotal += val;
            });
        }
        
        // Cálculo de tendencia (%)
        let trend = 0;
        if (lastMonthTotal !== 0) trend = ((currentMonthTotal - lastMonthTotal) / Math.abs(lastMonthTotal)) * 100;
        
        return { cash, bank, total: cash + bank, trend: trend.toFixed(1) };
    }, [finances, currentDate]);

    // 2. Datos Mensuales Filtrados
    const monthlyData = useMemo(() => {
        if (!finances) return [];
        const m = currentDate.toISOString().slice(0, 7);
        return finances
            .filter(f => f.date && f.date.startsWith(m))
            .filter(f => { // Filtro de Buscador
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return (f.category||'').toLowerCase().includes(term) || (f.notes||'').toLowerCase().includes(term);
            })
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate, searchTerm]);

    // 3. Datos Gráficos Avanzados
    const chartData = useMemo(() => {
        if (!finances) return { trend: [], pie: [], bar: [] };
        const trendMap = {};
        
        // Inicializar 6 meses
        for(let i=5; i>=0; i--) { 
            const d = new Date(); d.setMonth(d.getMonth() - i); 
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

        // Pie Chart (Gastos del mes)
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
    const Chart = window.Chart; // Usamos Chart.js directo del CDN

    // Render Chart.js Effects
    const lineChartRef = useRef(null);
    const barChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const chartInstances = useRef({});

    useEffect(() => {
        if (tabView !== 'dashboard' || !Chart) return;

        // Destruir instancias viejas
        Object.values(chartInstances.current).forEach(c => c.destroy());

        // 1. Gráfico de Línea (Flujo)
        if (lineChartRef.current) {
            const ctx = lineChartRef.current.getContext('2d');
            chartInstances.current.line = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.trend.map(d => d.label),
                    datasets: [
                        { label: 'Balance', data: chartData.trend.map(d => d.balance), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } }
            });
        }

        // 2. Gráfico de Barras (Ingreso vs Gasto)
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

        // 3. Gráfico Donut (Categorías)
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

    // Validaciones
    const handleUnlock = (e) => { e.preventDefault(); if (pinInput === '1234') { setIsLocked(false); setErrorPin(false); } else { setErrorPin(true); setPinInput(''); } };
    const handleImage = async (e) => { const f=e.target.files[0]; if(!f)return; setIsUploading(true); try{const b=await compressImage(f); setForm(p=>({...p, attachmentUrl:b}));}catch(err){Utils.notify("Error","error");} setIsUploading(false); };
    const handleSave = () => { 
        let f = {...form, createdAt: new Date().toISOString() };
        if(form.type==='Culto') {
            const t = safeNum(form.tithesCash)+safeNum(form.tithesTransfer)+safeNum(form.offeringsCash)+safeNum(form.offeringsTransfer);
            if(t===0) return Utils.notify("Total 0", "error");
            f.total = t; f.category = 'Culto';
            f.tithesCash=safeNum(f.tithesCash); f.tithesTransfer=safeNum(f.tithesTransfer); // Limpiar strings vacíos
        } else {
            const a = safeNum(form.amount); if(a===0) return Utils.notify("Monto 0", "error");
            const v = Math.abs(a); f.amount = form.type==='Gasto'?-v:v; f.total = f.amount;
        }
        addData('finances', f); setIsModalOpen(false); setForm(initialForm); Utils.notify("Registrado");
    };

    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-500">Acceso Restringido</div>;
    if (isLocked) return (<div className="h-full flex flex-col items-center justify-center animate-enter"><div className="bg-white p-8 rounded-3xl shadow-soft max-w-sm w-full text-center border border-slate-100"><div className="bg-brand-100 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-brand-600 mb-6"><Icon name="Wallet" size={32}/></div><h2 className="text-2xl font-extrabold text-slate-800 mb-2">Billetera</h2><form onSubmit={handleUnlock}><input type="password" maxLength="4" className="text-center text-3xl font-bold w-full border-b-2 outline-none py-2" value={pinInput} onChange={e=>setPinInput(e.target.value)} placeholder="••••" /><Button className="w-full mt-4" onClick={handleUnlock}>Desbloquear</Button></form></div></div>);

    return (
        <div className="space-y-8 fade-in pb-24">
            {/* 1. HEADER DASHBOARD */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3"><h2 className="text-2xl font-extrabold text-slate-800">Billetera</h2><button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400 hover:text-brand-600"><Icon name={showBalance?"Search":"LogOut"}/></button></div>
                <div className="flex gap-2">
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200"><button onClick={()=>setTabView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='dashboard'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Panel</button><button onClick={()=>setTabView('list')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tabView==='list'?'bg-brand-50 text-brand-600':'text-slate-500'}`}>Lista</button></div>
                    <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}}>Nuevo</Button>
                </div>
            </div>

            {/* 2. TARJETAS DE SALDO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Global</p>
                    <h3 className="text-4xl font-black">{renderAmount(globalBalances.total)}</h3>
                    {/* Indicador de Tendencia */}
                    <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${globalBalances.trend >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        <span>{globalBalances.trend >= 0 ? '↑' : '↓'} {Math.abs(globalBalances.trend)}% vs mes anterior</span>
                    </div>
                </div>
                <Card className="border-l-4 border-l-emerald-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Caja Chica (Efectivo)</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{renderAmount(globalBalances.cash)}</h3></Card>
                <Card className="border-l-4 border-l-blue-500 py-4"><p className="text-xs text-slate-500 font-bold uppercase">Banco / Digital</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{renderAmount(globalBalances.bank)}</h3></Card>
            </div>

            {/* 3. PESTAÑA PANEL (GRÁFICOS) */}
            {tabView === 'dashboard' && (
                <div className="space-y-6 animate-enter">
                    {finances.length === 0 && <div className="text-center py-4"><button onClick={window.DataLogic.generateDemoFinances} className="text-brand-600 text-xs font-bold hover:underline">+ Generar Demo</button></div>}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Gráfico 1: Evolución Saldo */}
                        <Card className="h-72">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-4">Evolución del Saldo</h3>
                            <div className="h-56 w-full relative"><canvas ref={lineChartRef}></canvas></div>
                        </Card>
                        {/* Gráfico 2: Ingresos vs Gastos */}
                        <Card className="h-72">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-4">Balance Mensual</h3>
                            <div className="h-56 w-full relative"><canvas ref={barChartRef}></canvas></div>
                        </Card>
                    </div>
                    
                    {/* Gráfico 3: Gastos Donut */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="h-80 col-span-1">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-4">Distribución de Gastos (Este Mes)</h3>
                            <div className="h-48 w-full relative flex justify-center">
                                {chartData.pie.length > 0 ? <canvas ref={pieChartRef}></canvas> : <p className="text-xs text-slate-400 self-center">Sin gastos</p>}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                {chartData.pie.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1 text-[10px] bg-slate-50 px-2 py-1 rounded-full">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: PIE_COLORS[i % PIE_COLORS.length]}}></div> {p.name}
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card className="col-span-2 bg-slate-900 text-white">
                            <div className="flex items-center gap-2 mb-4 text-brand-400"><Icon name="Info"/><h3 className="font-bold">Resumen Rápido</h3></div>
                            <div className="grid grid-cols-2 gap-8">
                                <div><p className="text-xs text-slate-400 uppercase mb-1">Mes Actual</p><h4 className="text-2xl font-bold text-white">{Utils.formatDate(currentDate.toISOString(), 'month')}</h4></div>
                                <div><p className="text-xs text-slate-400 uppercase mb-1">Movimientos</p><h4 className="text-2xl font-bold text-white">{monthlyData.length}</h4></div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* 4. PESTAÑA LISTA (HISTORIAL) */}
            {tabView === 'list' && (
                <div className="space-y-4 animate-enter">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                        <div className="relative w-full md:w-64">
                            <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400"/>
                            <input className="w-full bg-slate-50 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="Buscar movimiento..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="p-4">Fecha</th><th className="p-4">Concepto</th><th className="p-4 text-right">Monto</th><th className="p-4"></th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {monthlyData.length===0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Sin movimientos.</td></tr>}
                                    {monthlyData.map(f => {
                                        const catInfo = categories.find(c => c.value === f.category) || {};
                                        const IconName = catInfo.icon || (f.type === 'Culto' ? 'Home' : 'DollarSign');
                                        return (
                                            <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 whitespace-nowrap text-slate-600">{formatDate(f.date)}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center"><Icon name={IconName} size={16}/></div>
                                                        <div>
                                                            <div className="font-bold text-slate-800">{f.type==='Culto'?'Cierre Culto':f.category}</div>
                                                            <div className="text-xs text-slate-500">{f.notes||f.method}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={`p-4 text-right font-mono font-bold ${safeNum(f.total||f.amount)<0?'text-red-600':'text-emerald-600'}`}>{formatCurrency(f.total||f.amount)}</td>
                                                <td className="p-4 text-right">{f.attachmentUrl && <button onClick={()=>setReceiptModal(f.attachmentUrl)} className="text-slate-400 hover:text-brand-600"><Icon name="Image"/></button>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo Movimiento">
                {/* (Formulario igual que antes, omitido para brevedad pero inclúyelo del código anterior) */}
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl mb-4">{['Culto','Gasto','Ingreso'].map(t=><button key={t} onClick={()=>setForm({...initialForm, type:t})} className={`py-2 text-xs font-bold rounded ${form.type===t?'bg-slate-800 text-white':'bg-slate-100'}`}>{t}</button>)}</div>
                    <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                    {form.type==='Culto' ? <div className="space-y-2"><Input label="Diezmos Efec." type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/><Input label="Ofrendas Efec." type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/><Input label="Diezmos Bco." type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/><Input label="Ofrendas Bco." type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/></div> : <div className="grid grid-cols-2 gap-2"><Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} /><Select label="Origen" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select><SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/></div>}
                    <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/><Button className="w-full" onClick={handleSave}>Guardar</Button>
                </div>
            </Modal>
            <Modal isOpen={!!receiptModal} onClose={()=>setReceiptModal(null)} title="Comprobante"><img src={receiptModal} className="w-full rounded-xl" /></Modal>
        </div>
    );
};
