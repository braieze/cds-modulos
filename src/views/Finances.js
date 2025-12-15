window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    const { useState, useMemo, useEffect, useRef } = React;
    const Utils = window.Utils || {};
    // Extraemos componentes. Si Card no soporta estilos oscuros, usaremos divs directos.
    const { Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage, Badge } = Utils;

    // --- ESTADOS ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tabView, setTabView] = useState('dashboard'); // 'dashboard', 'list', 'goals'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Accordion State
    const [expandedId, setExpandedId] = useState(null);

    // Selección Múltiple
    const [selectedIds, setSelectedIds] = useState([]);

    // Seguridad PIN
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    // Formulario
    const initialForm = { type: 'Culto', date: Utils.getLocalDate(), tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' };
    const [form, setForm] = useState(initialForm);

    // Metas
    const [goals, setGoals] = useState(() => JSON.parse(localStorage.getItem('finance_goals')) || {});
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [goalForm, setGoalForm] = useState({ category: '', amount: '' });

    // Referencias PDF
    const printRef = useRef(null);
    const [pdfData, setPdfData] = useState(null);

    // Chart Refs
    const lineChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const chartInstances = useRef({});

    const categories = [
        { value: 'General', label: 'General / Varios', icon: 'Info', color: '#94a3b8' },
        { value: 'Mantenimiento', label: 'Infraestructura', icon: 'Briefcase', color: '#f59e0b' },
        { value: 'Honorarios', label: 'Honorarios', icon: 'Users', color: '#3b82f6' },
        { value: 'Alquiler', label: 'Alquiler', icon: 'Home', color: '#ef4444' },
        { value: 'Ayuda Social', label: 'Ayuda Social', icon: 'Smile', color: '#10b981' },
        { value: 'Ministerios', label: 'Ministerios', icon: 'Music', color: '#8b5cf6' },
        { value: 'Ofrenda Misionera', label: 'Misiones', icon: 'Globe', color: '#ec4899' }
    ];

    // --- CÁLCULOS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

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

    const monthTotals = useMemo(() => {
        let incomes = 0, expenses = 0;
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            if (val > 0) incomes += val;
            else expenses += Math.abs(val);
        });
        return { incomes, expenses, net: incomes - expenses };
    }, [monthlyData]);

    const globalBalances = useMemo(() => {
        let cash = 0, bank = 0;
        if (finances) {
            finances.forEach(f => {
                let val = 0;
                if (f.type === 'Culto') {
                    cash += safeNum(f.tithesCash)+safeNum(f.offeringsCash);
                    bank += safeNum(f.tithesTransfer)+safeNum(f.offeringsTransfer);
                } else {
                    val = safeNum(f.amount);
                    if (f.method === 'Banco') bank += val; else cash += val;
                }
            });
        }
        return { cash, bank, total: cash + bank };
    }, [finances]);

    const chartData = useMemo(() => {
        if (!finances) return { trend: [], pie: [] };
        const trendMap = {};
        for(let i=5; i>=0; i--) { 
            const d = new Date(currentDate); d.setMonth(d.getMonth() - i); 
            const k = d.toISOString().slice(0,7);
            trendMap[k] = { name: k, label: Utils.formatDate(d.toISOString().slice(0,10), 'month'), ingresos: 0, gastos: 0 }; 
        }
        finances.forEach(f => {
            if(!f.date) return;
            const k = f.date.slice(0, 7);
            if (trendMap[k]) {
                const val = safeNum(f.total || f.amount);
                if (val > 0) trendMap[k].ingresos += val;
                else trendMap[k].gastos += Math.abs(val);
            }
        });
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

    // --- CHART.JS CONFIG (DARK MODE) ---
    useEffect(() => {
        const Chart = window.Chart;
        if (tabView !== 'dashboard' || !Chart) return;
        
        // Global defaults for dark mode
        Chart.defaults.color = '#94a3b8'; // Slate 400
        Chart.defaults.borderColor = '#334155'; // Slate 700

        Object.values(chartInstances.current).forEach(c => c.destroy());

        if (lineChartRef.current) {
            chartInstances.current.line = new Chart(lineChartRef.current, {
                type: 'line',
                data: {
                    labels: chartData.trend.map(d => d.label),
                    datasets: [
                        { label: 'Ingresos', data: chartData.trend.map(d => d.ingresos), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#10b981' },
                        { label: 'Gastos', data: chartData.trend.map(d => d.gastos), borderColor: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#f43f5e' }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { labels: { color: '#cbd5e1' } } },
                    scales: { 
                        x: { grid: { display: false } }, 
                        y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } } 
                    } 
                }
            });
        }
        if (pieChartRef.current && chartData.pie.length > 0) {
            chartInstances.current.pie = new Chart(pieChartRef.current, {
                type: 'doughnut',
                data: {
                    labels: chartData.pie.map(d => d.name),
                    datasets: [{ 
                        data: chartData.pie.map(d => d.value), 
                        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { position: 'right', labels: { color: '#cbd5e1', padding: 20 } } }, 
                    cutout: '75%' 
                }
            });
        }
        return () => Object.values(chartInstances.current).forEach(c => c.destroy());
    }, [chartData, tabView]);

    // --- ACCIONES ---
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

    const toggleSelect = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
        else setSelectedIds(prev => [...prev, id]);
    };
    
    const selectAll = () => {
        if (selectedIds.length === monthlyData.length) setSelectedIds([]);
        else setSelectedIds(monthlyData.map(d => d.id));
    };

    const handleBulkDelete = async () => {
        if(!confirm(`¿Eliminar ${selectedIds.length} movimientos?`)) return;
        const batch = window.db.batch();
        selectedIds.forEach(id => batch.delete(window.db.collection('finances').doc(id)));
        await batch.commit();
        setSelectedIds([]);
        Utils.notify("Eliminados");
    };

    const handleExportPDF = (item = null) => {
        const data = item || { 
            date: new Date().toISOString(), 
            category: 'Reporte Mensual', 
            notes: `Balance de ${Utils.formatDate(currentDate.toISOString(), 'month')}`,
            total: monthTotals.net,
            id: 'RESUMEN' 
        };
        setPdfData(data);
        setTimeout(async () => {
            const element = printRef.current;
            element.style.display = 'block';
            const opt = {
                margin: 0,
                filename: `Comprobante_${data.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 3, useCORS: true },
                jsPDF: { unit: 'mm', format: [100, 150], orientation: 'portrait' }
            };
            if (window.html2pdf) await window.html2pdf().set(opt).from(element).save();
            element.style.display = 'none';
        }, 500);
    };

    const handleSaveGoal = () => {
        const newGoals = { ...goals, [goalForm.category]: safeNum(goalForm.amount) };
        setGoals(newGoals);
        localStorage.setItem('finance_goals', JSON.stringify(newGoals));
        setIsGoalModalOpen(false);
    };

    // --- RENDERIZADO ---

    // Pantalla Bloqueo
    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-500">Acceso Restringido</div>;
    if (isLocked) return (
        <div className="h-full flex flex-col items-center justify-center animate-enter bg-[#0f172a] absolute top-0 left-0 w-full z-50">
            <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-slate-700">
                <div className="bg-gradient-to-tr from-brand-600 to-indigo-600 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/30">
                    <Icon name="Lock" size={32}/>
                </div>
                <h2 className="text-2xl font-extrabold text-white mb-2">Billetera Segura</h2>
                <p className="text-slate-400 text-sm mb-6">Ingrese su PIN de acceso</p>
                <form onSubmit={handleUnlock}>
                    <input type="password" maxLength="4" 
                        className={`text-center text-3xl font-bold w-full bg-[#0f172a] border-2 rounded-xl py-3 text-white tracking-widest outline-none transition-all ${errorPin ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'}`}
                        value={pinInput} onChange={e=>setPinInput(e.target.value)} placeholder="••••" 
                    />
                    <button className="w-full mt-6 bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors" onClick={handleUnlock}>
                        Desbloquear
                    </button>
                </form>
            </div>
        </div>
    );

    const renderAmount = (a) => showBalance ? formatCurrency(safeNum(a)) : "$ ••••••";

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans -m-4 sm:-m-8 p-4 sm:p-8 pb-32">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="bg-indigo-600 p-2 rounded-lg"><Icon name="Wallet" className="text-white"/></div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-white leading-none">Tesorería</h2>
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Panel Financiero</span>
                    </div>
                    <button onClick={()=>setShowBalance(!showBalance)} className="ml-2 text-slate-500 hover:text-white transition-colors">
                        <Icon name={showBalance?"Eye":"EyeOff"} size={18}/>
                    </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    <div className="bg-[#1e293b] p-1 rounded-xl shadow-sm border border-slate-700 flex items-center">
                         {/* Asumiendo que DateFilter acepta custom styles o es lo suficientemente neutro. Si no, habría que envolverlo. */}
                         <div className="text-slate-300 [&>select]:bg-transparent [&>select]:text-white [&>select]:border-none">
                            <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                         </div>
                    </div>
                    
                    <div className="flex bg-[#1e293b] p-1 rounded-xl border border-slate-700">
                        {['dashboard','list','goals'].map(t => (
                            <button key={t} onClick={()=>setTabView(t)} 
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${tabView===t?'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40':'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                {t==='dashboard'?'Panel':(t==='list'?'Movimientos':'Metas')}
                            </button>
                        ))}
                    </div>

                    <button onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}} 
                        className="bg-emerald-500 hover:bg-emerald-400 text-white p-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center">
                        <Icon name="Plus" size={20}/>
                    </button>
                </div>
            </div>

            {/* DASHBOARD */}
            {tabView === 'dashboard' && (
                <div className="space-y-6 animate-enter">
                    {/* Tarjetas Resumen */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[#1e293b] p-6 rounded-3xl shadow-xl border border-slate-700 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400"><Icon name="ArrowUpRight" size={24}/></div>
                                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Ingresos</span>
                                </div>
                                <h3 className="text-3xl font-black text-white tracking-tight">{renderAmount(monthTotals.incomes)}</h3>
                                <p className="text-slate-500 text-xs mt-1 font-medium">Total recaudado este mes</p>
                            </div>
                        </div>

                        <div className="bg-[#1e293b] p-6 rounded-3xl shadow-xl border border-slate-700 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-32 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-rose-500/20 rounded-2xl text-rose-400"><Icon name="ArrowDownRight" size={24}/></div>
                                    <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Gastos</span>
                                </div>
                                <h3 className="text-3xl font-black text-white tracking-tight">{renderAmount(monthTotals.expenses)}</h3>
                                <p className="text-slate-500 text-xs mt-1 font-medium">Total egresos este mes</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl shadow-xl shadow-indigo-600/20 relative overflow-hidden text-white">
                            <div className="absolute right-0 bottom-0 p-24 bg-white/10 rounded-full blur-2xl -mr-10 -mb-10 pointer-events-none"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm"><Icon name="Wallet" size={24}/></div>
                                    <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">Balance Neto</span>
                                </div>
                                <h3 className="text-4xl font-black tracking-tight mb-1">{renderAmount(monthTotals.net)}</h3>
                                <div className="flex items-center gap-2 mt-4 text-indigo-100 text-xs font-medium bg-black/20 p-2 rounded-lg w-fit">
                                    <span>Caja: {renderAmount(globalBalances.cash)}</span>
                                    <span className="w-px h-3 bg-white/30"></span>
                                    <span>Banco: {renderAmount(globalBalances.bank)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-[#1e293b] rounded-3xl p-6 border border-slate-700 shadow-xl">
                            <h3 className="font-bold text-xs uppercase text-slate-400 mb-6 flex items-center gap-2"><Icon name="Activity" size={14}/> Tendencia Semestral</h3>
                            <div className="h-64 w-full relative"><canvas ref={lineChartRef}></canvas></div>
                        </div>
                        <div className="bg-[#1e293b] rounded-3xl p-6 border border-slate-700 shadow-xl flex flex-col">
                            <h3 className="font-bold text-xs uppercase text-slate-400 mb-6 flex items-center gap-2"><Icon name="PieChart" size={14}/> Distribución</h3>
                            <div className="h-48 w-full relative flex-1 flex justify-center items-center">
                                {chartData.pie.length > 0 ? <canvas ref={pieChartRef}></canvas> : <p className="text-xs text-slate-500">Sin datos de gastos</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LISTA MOVIMIENTOS (MODERNA CON ACORDEÓN) */}
            {tabView === 'list' && (
                <div className="space-y-4 animate-enter relative">
                    {/* Buscador y Filtros */}
                    <div className="flex items-center gap-3 bg-[#1e293b] p-3 rounded-2xl shadow-sm border border-slate-700 sticky top-0 z-30 backdrop-blur-md bg-opacity-80">
                        <Icon name="Search" size={20} className="text-slate-400 ml-2"/>
                        <input className="w-full bg-transparent border-none text-sm outline-none text-white placeholder-slate-500 font-medium" placeholder="Buscar por concepto o nota..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    </div>

                    {monthlyData.length === 0 ? (
                        <div className="p-12 text-center border-2 border-dashed border-slate-700 rounded-3xl">
                            <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600"><Icon name="Inbox" size={32}/></div>
                            <p className="text-slate-500 font-medium">No hay movimientos en este periodo.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-24">
                            {/* ENCABEZADOS DE TABLA (SOLO DESKTOP) */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <div className="col-span-1 text-center">Sel</div>
                                <div className="col-span-2">Fecha</div>
                                <div className="col-span-5">Detalle</div>
                                <div className="col-span-3 text-right">Monto</div>
                                <div className="col-span-1 text-center">Acc</div>
                            </div>

                            {monthlyData.map(f => {
                                const amount = safeNum(f.total||f.amount);
                                const isExpanded = expandedId === f.id;
                                const isIncome = amount > 0;
                                const isSelected = selectedIds.includes(f.id);

                                return (
                                    <div key={f.id} 
                                        className={`group relative bg-[#1e293b] border transition-all duration-300 rounded-2xl overflow-hidden
                                        ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-900/10' : 'border-slate-700 hover:border-slate-500'}
                                        ${isExpanded ? 'shadow-2xl shadow-black/50 z-10 scale-[1.01]' : 'shadow-sm'}`}
                                    >
                                        {/* LAYOUT MÓVIL (Tarjeta) Y DESKTOP (Fila) HÍBRIDO */}
                                        <div className="p-4 md:py-3 md:px-6 grid md:grid-cols-12 gap-4 items-center cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                                            
                                            {/* Checkbox (Visible en Móvil y Desktop) */}
                                            <div className="flex justify-between items-center md:col-span-1 md:justify-center">
                                                <div onClick={(e)=>e.stopPropagation()} className="relative">
                                                    <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(f.id)} 
                                                        className="w-5 h-5 rounded-md border-slate-600 bg-slate-800 checked:bg-indigo-500 transition-colors cursor-pointer"/>
                                                </div>
                                                {/* Mobile Only Date */}
                                                <span className="md:hidden text-xs text-slate-500 font-medium">{formatDate(f.date)}</span>
                                            </div>

                                            {/* Date (Desktop) */}
                                            <div className="hidden md:block col-span-2 text-sm text-slate-400 font-medium">
                                                {formatDate(f.date)}
                                            </div>

                                            {/* Detalle */}
                                            <div className="col-span-12 md:col-span-5 flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner
                                                    ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    <Icon name={f.type === 'Culto' ? 'Church' : (categories.find(c=>c.value===f.category)?.icon || 'Tag')} size={18}/>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-200 text-base">{f.type==='Culto'?'Culto General':f.category}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{f.notes || f.method}</div>
                                                </div>
                                            </div>

                                            {/* Monto */}
                                            <div className="col-span-12 md:col-span-3 flex justify-between md:justify-end items-center">
                                                <span className="md:hidden text-xs text-slate-500 uppercase font-bold">Total</span>
                                                <span className={`font-mono text-lg font-bold ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formatCurrency(amount)}
                                                </span>
                                            </div>

                                            {/* Icono Acordeón (Desktop) */}
                                            <div className="hidden md:flex col-span-1 justify-center text-slate-500">
                                                <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={18}/>
                                            </div>
                                        </div>

                                        {/* SECCIÓN EXPANDIBLE (ACORDEÓN) */}
                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-[#0f172a]/50 border-t border-slate-700/50 ${isExpanded ? 'max-h-96 opacity-100 p-4' : 'max-h-0 opacity-0'}`}>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div className="space-y-2">
                                                    <p className="text-slate-400 text-xs uppercase font-bold">Detalles de Pago</p>
                                                    <div className="flex justify-between border-b border-slate-700 pb-1">
                                                        <span className="text-slate-300">Método</span>
                                                        <span className="text-white font-medium">{f.method}</span>
                                                    </div>
                                                    {f.type === 'Culto' && (
                                                        <>
                                                        <div className="flex justify-between border-b border-slate-700 pb-1">
                                                            <span className="text-slate-300">Diezmos</span>
                                                            <span className="text-emerald-400 font-mono">{formatCurrency(safeNum(f.tithesCash)+safeNum(f.tithesTransfer))}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-slate-700 pb-1">
                                                            <span className="text-slate-300">Ofrendas</span>
                                                            <span className="text-emerald-400 font-mono">{formatCurrency(safeNum(f.offeringsCash)+safeNum(f.offeringsTransfer))}</span>
                                                        </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="space-y-3 flex flex-col justify-between">
                                                    <div>
                                                        <p className="text-slate-400 text-xs uppercase font-bold mb-1">Notas</p>
                                                        <p className="text-slate-300 italic text-xs bg-slate-800 p-2 rounded-lg">{f.notes || "Sin notas adicionales."}</p>
                                                    </div>
                                                    
                                                    <div className="flex justify-end gap-3 pt-2">
                                                        {f.attachmentUrl && (
                                                            <a href={f.attachmentUrl} target="_blank" className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-900/30 px-3 py-2 rounded-lg transition-colors">
                                                                <Icon name="Image" size={14}/> Ver Adjunto
                                                            </a>
                                                        )}
                                                        <button onClick={(e)=>{e.stopPropagation(); handleExportPDF(f)}} className="flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-600/30">
                                                            <Icon name="Printer" size={14}/> Comprobante
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Barra Flotante Acciones (Fixed para que no se pierda) */}
                    {selectedIds.length > 0 && (
                        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white text-slate-900 px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-enter z-50 min-w-[300px] justify-between border-4 border-slate-900/10">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Selección</span>
                                <span className="text-lg font-black text-slate-900 leading-none">{selectedIds.length} items</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={()=>setSelectedIds([])} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><Icon name="X" size={20}/></button>
                                <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-500/30">
                                    <Icon name="Trash" size={16}/> Eliminar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* METAS (PRESUPUESTO) */}
            {tabView === 'goals' && (
                <div className="space-y-6 animate-enter">
                    <div className="flex justify-end">
                        <button onClick={()=>setIsGoalModalOpen(true)} className="text-indigo-400 hover:text-white text-sm font-bold flex items-center gap-2 border border-indigo-500/30 px-4 py-2 rounded-xl hover:bg-indigo-500/10 transition-colors">
                            <Icon name="Target" size={16}/> Definir Nueva Meta
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categories.filter(c=>c.value!=='Ingreso').map(cat => {
                            const spent = Math.abs(safeNum(chartData.pie.find(p=>p.name===cat.value)?.value || 0));
                            const goal = goals[cat.value] || 0;
                            const pct = goal > 0 ? Math.min(100, Math.round((spent/goal)*100)) : 0;
                            const statusColor = pct > 90 ? 'bg-rose-500' : (pct > 70 ? 'bg-amber-500' : 'bg-emerald-500');
                            const textColor = pct > 90 ? 'text-rose-400' : (pct > 70 ? 'text-amber-400' : 'text-emerald-400');
                            
                            return (
                                <div key={cat.value} className="bg-[#1e293b] border border-slate-700 p-5 rounded-2xl relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-800 rounded-lg" style={{color: cat.color}}><Icon name={cat.icon} size={20}/></div>
                                            <h4 className="font-bold text-slate-200">{cat.label}</h4>
                                        </div>
                                        <span className={`text-sm font-black ${textColor}`}>{pct}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2 mb-3 overflow-hidden">
                                        <div className={`h-full ${statusColor} shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000 ease-out`} style={{width: `${pct}%`, boxShadow: `0 0 10px ${statusColor}`}}></div>
                                    </div>
                                    <div className="flex justify-between text-xs font-mono">
                                        <span className="text-slate-400">Gastado: <span className="text-white font-bold">{formatCurrency(spent)}</span></span>
                                        <span className="text-slate-500">Meta: {formatCurrency(goal)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MODALES ESTILIZADOS */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Registrar Movimiento">
                <div className="space-y-4 pt-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        {['Culto','Gasto','Ingreso'].map(t=><button key={t} onClick={()=>setForm({...initialForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.type===t?'bg-white shadow text-indigo-600':'text-slate-400 hover:text-slate-600'}`}>{t}</button>)}
                    </div>
                    <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                    
                    {form.type==='Culto' ? (
                        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Efectivo</p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <Input label="Diezmos" type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/>
                                <Input label="Ofrendas" type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/>
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Digital / Banco</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Diezmos" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/>
                                <Input label="Ofrendas" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1"><Input label="Monto Total" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="font-mono text-lg font-bold" /></div>
                                <div className="col-span-1"><Select label="Método" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select></div>
                            </div>
                            <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/>
                        </div>
                    )}
                    <Input label="Notas / Detalles Adicionales" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
                    
                    <div className="flex gap-3 mt-4">
                        <label className={`flex-1 p-3 border-2 border-dashed rounded-xl flex justify-center items-center gap-2 cursor-pointer transition-colors ${form.attachmentUrl ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400'}`}>
                            <Icon name={form.attachmentUrl?"Check":"Camera"} size={18}/> 
                            <span className="text-xs font-bold">{isUploading?'Subiendo...':(form.attachmentUrl?'Comprobante Listo':'Adjuntar Foto')}</span>
                            <input type="file" className="hidden" onChange={handleImage}/>
                        </label>
                    </div>
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl shadow-lg shadow-indigo-500/30 font-bold text-lg mt-2" onClick={handleSave} disabled={isUploading}>
                        {isUploading ? 'Procesando...' : 'Guardar Operación'}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={isGoalModalOpen} onClose={()=>setIsGoalModalOpen(false)} title="Presupuesto Mensual">
                <div className="space-y-6 pt-2">
                    <SmartSelect label="Seleccionar Categoría" options={categories} value={goalForm.category} onChange={v=>setGoalForm({...goalForm, category:v})}/>
                    <div className="bg-slate-50 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-500 mb-1">Límite de Gasto Mensual</p>
                        <Input type="number" value={goalForm.amount} onChange={e=>setGoalForm({...goalForm, amount:e.target.value})} className="text-center text-3xl font-black bg-transparent border-none outline-none text-slate-800 placeholder-slate-300"/>
                    </div>
                    <Button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold" onClick={handleSaveGoal}>Establecer Meta</Button>
                </div>
            </Modal>

            {/* ELEMENTO OCULTO PARA PDF (Diseño Clean Moderno) */}
            {pdfData && (
                <div ref={printRef} style={{ display: 'none', width: '100mm', height: '150mm', background: 'white', color: '#1e293b', padding: '0', fontFamily: 'sans-serif', position: 'relative' }}>
                    <div style={{ background: '#4f46e5', height: '8px', width: '100%' }}></div>
                    <div style={{ padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#4f46e5' }}>CONQUISTADORES</h1>
                                <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', letterSpacing: '1px' }}>COMPROBANTE DIGITAL</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>FECHA</p>
                                <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>{formatDate(pdfData.date)}</p>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', margin: '40px 0' }}>
                            <p style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', marginBottom: '5px' }}>Monto Total</p>
                            <h2 style={{ fontSize: '42px', margin: '0', fontWeight: '900', color: '#0f172a' }}>{formatCurrency(pdfData.total || pdfData.amount)}</h2>
                            <div style={{ display: 'inline-block', padding: '5px 15px', background: '#f1f5f9', borderRadius: '20px', marginTop: '10px', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                                {pdfData.type==='Culto'?'INGRESO':'GASTO'} / {pdfData.method?.toUpperCase()}
                            </div>
                        </div>
                        
                        <div style={{ borderTop: '2px dashed #e2e8f0', borderBottom: '2px dashed #e2e8f0', padding: '20px 0', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                                <span style={{ color: '#64748b' }}>Categoría</span>
                                <span style={{ fontWeight: 'bold' }}>{pdfData.type==='Culto'?'Culto General':pdfData.category}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#64748b' }}>ID Referencia</span>
                                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>#{pdfData.id?.slice(0,8).toUpperCase()}</span>
                            </div>
                        </div>

                        {pdfData.notes && (
                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                                "{pdfData.notes}"
                            </div>
                        )}
                    </div>
                    <div style={{ position: 'absolute', bottom: '30px', left: '0', width: '100%', textAlign: 'center' }}>
                        <p style={{ fontSize: '9px', color: '#cbd5e1' }}>Documento generado electrónicamente por CDS App</p>
                    </div>
                </div>
            )}
        </div>
    );
};
