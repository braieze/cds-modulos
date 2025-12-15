window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    const { useState, useMemo, useEffect, useRef } = React;
    const Utils = window.Utils || {};
    const { Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;

    // --- ESTADOS ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tabView, setTabView] = useState('dashboard');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Privacy & UX
    const [showBalance, setShowBalance] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [expandedId, setExpandedId] = useState(null);

    // Selección Múltiple
    const [selectedIds, setSelectedIds] = useState([]);

    // Seguridad PIN
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    // Formularios
    const initialForm = { type: 'Culto', date: Utils.getLocalDate(), tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' };
    const [form, setForm] = useState(initialForm);

    // Metas (Persistencia Local)
    const [goals, setGoals] = useState(() => JSON.parse(localStorage.getItem('finance_goals_v2')) || []);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    // Goal Form: type='saving' (Ingreso/Recaudación) | 'spending' (Límite Gasto)
    const [goalForm, setGoalForm] = useState({ id: null, category: '', amount: '', type: 'spending', label: '' });

    // Referencias PDF y Gráficos
    const printRef = useRef(null);
    const [pdfData, setPdfData] = useState(null);
    const lineChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const chartInstances = useRef({});

    // Categorías Extendidas
    const categories = [
        { value: 'General', label: 'General / Varios', icon: 'Info', color: '#94a3b8' },
        { value: 'Mantenimiento', label: 'Infraestructura', icon: 'Briefcase', color: '#f59e0b' },
        { value: 'Honorarios', label: 'Honorarios / Sueldos', icon: 'Users', color: '#3b82f6' },
        { value: 'Alquiler', label: 'Alquiler', icon: 'Home', color: '#ef4444' },
        { value: 'Ayuda Social', label: 'Ayuda Social', icon: 'Smile', color: '#10b981' },
        { value: 'Ministerios', label: 'Ministerios', icon: 'Music', color: '#8b5cf6' },
        { value: 'Ofrenda Misionera', label: 'Misiones', icon: 'Globe', color: '#ec4899' },
        { value: 'Diezmos', label: 'Diezmos (Ingreso)', icon: 'TrendingUp', color: '#6366f1' },
        { value: 'Ofrendas', label: 'Ofrendas (Ingreso)', icon: 'Gift', color: '#8b5cf6' }
    ];

    // --- HELPERS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const blurClass = showBalance ? '' : 'filter blur-md select-none transition-all duration-500';

    // --- DATA PROCESSING ---
    const monthlyData = useMemo(() => {
        if (!finances) return [];
        const m = currentDate.toISOString().slice(0, 7);
        return finances
            .filter(f => f.date && f.date.startsWith(m))
            .filter(f => {
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const matches = (f.category||'').toLowerCase().includes(term) || (f.notes||'').toLowerCase().includes(term);
                    if (!matches) return false;
                }
                if (filterType === 'income') return safeNum(f.total || f.amount) > 0;
                if (filterType === 'expense') return safeNum(f.total || f.amount) < 0;
                return true;
            })
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate, searchTerm, filterType]);

    const monthTotals = useMemo(() => {
        let incomes = 0, expenses = 0;
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            if (val > 0) incomes += val; else expenses += Math.abs(val);
        });
        return { incomes, expenses, net: incomes - expenses };
    }, [monthlyData]);

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
        const currentM = currentDate.toISOString().slice(0,7);
        finances.filter(f => f.date.startsWith(currentM) && safeNum(f.total||f.amount) < 0).forEach(f => {
            const c = f.category || 'General';
            pieMap[c] = (pieMap[c] || 0) + Math.abs(safeNum(f.total||f.amount));
        });
        return { 
            trend: Object.values(trendMap).sort((a,b) => a.name.localeCompare(b.name)), 
            pie: Object.entries(pieMap).map(([n,v]) => ({ name: n, value: v })).sort((a,b) => b.value - a.value)
        };
    }, [monthlyData, currentDate, finances]);

    // --- CHARTS ---
    useEffect(() => {
        const Chart = window.Chart;
        if (tabView !== 'dashboard' || !Chart) return;
        Chart.defaults.color = '#94a3b8'; Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
        Object.values(chartInstances.current).forEach(c => c.destroy());

        if (lineChartRef.current) {
            const gradientStroke = lineChartRef.current.getContext('2d').createLinearGradient(0, 0, 0, 400);
            gradientStroke.addColorStop(0, '#818cf8'); gradientStroke.addColorStop(1, '#c084fc');

            chartInstances.current.line = new Chart(lineChartRef.current, {
                type: 'line',
                data: {
                    labels: chartData.trend.map(d => d.label),
                    datasets: [
                        { label: 'Neto', data: chartData.trend.map(d => d.ingresos - d.gastos), borderColor: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#fff', pointBorderColor: '#c084fc' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { display: false } } }
            });
        }
        return () => Object.values(chartInstances.current).forEach(c => c.destroy());
    }, [chartData, tabView]);

    // --- ACTIONS ---
    const handleUnlock = (e) => { e.preventDefault(); if (pinInput === '1234') { setIsLocked(false); setErrorPin(false); } else { setErrorPin(true); setPinInput(''); } };
    
    const toggleSelect = (id) => { if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id)); else setSelectedIds(prev => [...prev, id]); };
    const selectAll = () => { if (selectedIds.length === monthlyData.length) setSelectedIds([]); else setSelectedIds(monthlyData.map(d => d.id)); };
    
    const handleBulkDelete = async () => {
        if(!confirm(`¿ELIMINAR ${selectedIds.length} ELEMENTOS? Esta acción no se puede deshacer.`)) return;
        const batch = window.db.batch();
        selectedIds.forEach(id => batch.delete(window.db.collection('finances').doc(id)));
        await batch.commit();
        setSelectedIds([]);
        Utils.notify("Elementos eliminados exitosamente");
    };

    const handleSave = () => { 
        let f = {...form, createdAt: new Date().toISOString() };
        if(form.type==='Culto') {
            const t = safeNum(form.tithesCash)+safeNum(form.tithesTransfer)+safeNum(form.offeringsCash)+safeNum(form.offeringsTransfer);
            if(t===0) return Utils.notify("El total no puede ser 0", "error");
            f.total = t; f.category = 'Culto';
        } else {
            const a = safeNum(form.amount); if(a===0) return Utils.notify("Ingrese un monto válido", "error");
            const v = Math.abs(a); f.amount = form.type==='Gasto'?-v:v; f.total = f.amount;
        }
        addData('finances', f); setIsModalOpen(false); setForm(initialForm); Utils.notify("Movimiento registrado");
    };

    const handleImage = async (e) => { const f=e.target.files[0]; if(!f)return; setIsUploading(true); try{const b=await compressImage(f); setForm(p=>({...p, attachmentUrl:b}));}catch(err){Utils.notify("Error subida","error");} setIsUploading(false); };

    // --- EXPORTAR A CSV (Recuperado) ---
    const handleExportCSV = () => {
        const headers = ["ID", "Fecha", "Tipo", "Categoría", "Detalle", "Monto", "Método", "Nota"];
        const rows = monthlyData.map(f => [
            f.id,
            f.date,
            f.type,
            f.category || 'Culto',
            `"${(f.notes || '').replace(/"/g, '""')}"`,
            safeNum(f.total || f.amount),
            f.method,
            `"${(f.notes || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Movimientos_${currentDate.toISOString().slice(0,7)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- EXPORTAR A PDF (Recuperado) ---
    const handleExportPDF = (item) => {
        setPdfData(item);
        setTimeout(async () => {
            const el = printRef.current;
            el.style.display = 'block';
            if (window.html2pdf) {
                await window.html2pdf().set({ 
                    margin:0, 
                    filename:`Comprobante_${item.id.slice(0,6)}.pdf`, 
                    image:{type:'jpeg',quality:0.98}, 
                    html2canvas:{scale:3, useCORS: true}, 
                    jsPDF:{unit:'mm',format:[100,150], orientation: 'portrait'} 
                }).from(el).save();
            } else {
                alert("Librería PDF no cargada aún. Intente de nuevo.");
            }
            el.style.display = 'none';
        }, 500);
    };

    // --- METAS LOGIC ---
    const handleSaveGoal = () => {
        let newGoals;
        if (goalForm.id) { // Edit
            newGoals = goals.map(g => g.id === goalForm.id ? { ...g, ...goalForm, id: goalForm.id } : g);
        } else { // Create
            newGoals = [...goals, { ...goalForm, id: Date.now().toString() }];
        }
        setGoals(newGoals);
        localStorage.setItem('finance_goals_v2', JSON.stringify(newGoals));
        setIsGoalModalOpen(false);
        Utils.notify("Meta guardada");
    };

    const handleDeleteGoal = (id) => {
        if(!confirm("¿Borrar esta meta?")) return;
        const newGoals = goals.filter(g => g.id !== id);
        setGoals(newGoals);
        localStorage.setItem('finance_goals_v2', JSON.stringify(newGoals));
        setIsGoalModalOpen(false); // Cierra el modal si estaba abierto
    };

    const openGoalModal = (goal = null) => {
        if (goal) setGoalForm(goal);
        else setGoalForm({ id: null, category: '', amount: '', type: 'spending', label: '' });
        setIsGoalModalOpen(true);
    };

    const getGoalProgress = (goal) => {
        const target = safeNum(goal.amount);
        let current = 0;
        
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            // Gasto: suma negativos
            if (goal.type === 'spending' && val < 0 && (f.category === goal.category || (goal.category === 'Culto' && f.type === 'Culto'))) {
                current += Math.abs(val);
            }
            // Ahorro: suma positivos
            if (goal.type === 'saving' && val > 0 && (f.category === goal.category || (goal.category === 'Culto' && f.type === 'Culto'))) {
                current += val;
            }
        });

        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        return { current, target, pct };
    };

    // --- RENDER ---
    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-500">Acceso Restringido</div>;
    
    if (isLocked) return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050511] animate-enter bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black pointer-events-none"></div>
            <div className="relative bg-white/5 backdrop-blur-2xl p-8 rounded-[32px] shadow-2xl border border-white/10 max-w-sm w-full text-center">
                <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-[0_0_40px_rgba(139,92,246,0.5)]">
                    <Icon name="Lock" size={32}/>
                </div>
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Bienvenido</h2>
                <p className="text-slate-400 mb-8">Tesorería Digital</p>
                <form onSubmit={handleUnlock}>
                    <div className="flex justify-center gap-4 mb-8">
                        {[0,1,2,3].map(i => (
                            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${pinInput.length > i ? 'bg-indigo-400 scale-125 shadow-[0_0_10px_#818cf8]' : 'bg-white/10'}`}></div>
                        ))}
                    </div>
                    <input type="password" maxLength="4" autoFocus className="opacity-0 absolute top-0 left-0 h-full w-full cursor-default" value={pinInput} onChange={e=>setPinInput(e.target.value)} inputMode="numeric" />
                    <div className="grid grid-cols-3 gap-4">
                        {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} type="button" onClick={()=>setPinInput(p=> (p+n).slice(0,4))} className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-2xl transition-all border border-white/5 active:scale-95">{n}</button>)}
                        <div/>
                        <button type="button" onClick={()=>setPinInput(p=> (p+0).slice(0,4))} className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-2xl transition-all border border-white/5 active:scale-95">0</button>
                        <button type="button" onClick={()=>setPinInput(p=>p.slice(0,-1))} className="h-16 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/10 active:scale-95"><Icon name="Delete" size={24}/></button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans -m-4 sm:-m-8 pb-32 relative overflow-hidden selection:bg-indigo-500/30">
            {/* Background Effects */}
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none"></div>
            
            <div className="relative z-10 p-4 sm:p-8">
                {/* HEADER */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-40 animate-pulse"></div>
                            <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl text-white shadow-xl">
                                <Icon name="Wallet" size={28}/>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight">Finanzas</h2>
                            <p className="text-slate-400 font-medium">Panel de Control</p>
                        </div>
                        <button onClick={()=>setShowBalance(!showBalance)} className="ml-2 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                            <Icon name={showBalance?"Eye":"EyeOff"} size={20}/>
                        </button>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="text-slate-300 [&>select]:bg-transparent [&>select]:text-white [&>select]:border-none [&>select]:font-bold [&>select]:outline-none px-2">
                            <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                        {['dashboard','list','goals'].map(t => (
                            <button key={t} onClick={()=>setTabView(t)} 
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all relative overflow-hidden ${tabView===t?'text-white shadow-lg':'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                {tabView===t && <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-100"></div>}
                                <span className="relative z-10 capitalize">{t === 'dashboard' ? 'Resumen' : t === 'list' ? 'Movimientos' : 'Metas'}</span>
                            </button>
                        ))}
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                        <button onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}} 
                            className="bg-white text-indigo-950 p-2.5 rounded-xl hover:bg-indigo-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95">
                            <Icon name="Plus" size={20}/>
                        </button>
                    </div>
                </div>

                {/* DASHBOARD CONTENT */}
                {tabView === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
                        {/* Main Balance Card - Bento Style */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-purple-800 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/40 border border-white/10">
                            <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 mix-blend-overlay"></div>
                            <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
                                <div className="flex justify-between items-start">
                                    <div className="bg-black/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-xs font-bold uppercase tracking-wider text-indigo-100">Balance Total</div>
                                    <Icon name="Activity" className="opacity-50"/>
                                </div>
                                <div>
                                    <h3 className={`text-5xl md:text-6xl font-black tracking-tight mb-2 ${blurClass}`}>
                                        {showBalance ? formatCurrency(monthTotals.net) : '$ •••••••'}
                                    </h3>
                                    <div className={`flex items-center gap-4 text-indigo-100 font-medium ${blurClass}`}>
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"></div> Neto Mes</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mini Cards Stack */}
                        <div className="grid grid-rows-2 gap-6">
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 flex flex-col justify-center relative overflow-hidden group">
                                <div className="absolute right-[-20px] top-[-20px] bg-emerald-500/20 w-32 h-32 rounded-full blur-2xl group-hover:bg-emerald-500/30 transition-all"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-2 text-emerald-400">
                                        <div className="p-2 bg-emerald-500/20 rounded-lg"><Icon name="ArrowUp" size={18}/></div>
                                        <span className="font-bold text-sm uppercase">Ingresos</span>
                                    </div>
                                    <span className={`text-3xl font-black text-white ${blurClass}`}>{showBalance ? formatCurrency(monthTotals.incomes) : '••••'}</span>
                                </div>
                            </div>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 flex flex-col justify-center relative overflow-hidden group">
                                <div className="absolute right-[-20px] bottom-[-20px] bg-rose-500/20 w-32 h-32 rounded-full blur-2xl group-hover:bg-rose-500/30 transition-all"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-2 text-rose-400">
                                        <div className="p-2 bg-rose-500/20 rounded-lg"><Icon name="ArrowDown" size={18}/></div>
                                        <span className="font-bold text-sm uppercase">Gastos</span>
                                    </div>
                                    <span className={`text-3xl font-black text-white ${blurClass}`}>{showBalance ? formatCurrency(monthTotals.expenses) : '••••'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="lg:col-span-3 bg-[#0f172a]/50 backdrop-blur-md border border-white/5 rounded-[32px] p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-white font-bold flex items-center gap-2"><Icon name="BarChart2" className="text-indigo-400"/> Flujo de Caja</h3>
                            </div>
                            <div className={`h-64 w-full ${blurClass}`}>
                                <canvas ref={lineChartRef}></canvas>
                            </div>
                        </div>
                    </div>
                )}

                {/* LIST VIEW */}
                {tabView === 'list' && (
                    <div className="animate-enter space-y-6">
                        {/* Filters & Actions Bar */}
                        <div className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl mb-8">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                                    <div className="relative w-full md:max-w-md">
                                        <Icon name="Search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                        <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all" 
                                            placeholder="Buscar movimiento..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                                    {[
                                        {id: 'all', label: 'Todo'},
                                        {id: 'income', label: 'Ingresos'},
                                        {id: 'expense', label: 'Gastos'}
                                    ].map(f => (
                                        <button key={f.id} onClick={()=>setFilterType(f.id)} className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${filterType===f.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-transparent border-white/10 text-slate-400 hover:bg-white/5'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                                    <button onClick={handleExportCSV} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all flex items-center gap-2">
                                        <Icon name="Download" size={16}/> CSV
                                    </button>
                                    <button onClick={selectAll} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2">
                                        <Icon name="CheckSquare" size={16}/> {selectedIds.length === monthlyData.length && monthlyData.length > 0 ? 'Desmarcar' : 'Todos'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Transactions Grid */}
                        {monthlyData.length === 0 ? (
                             <div className="text-center py-20 opacity-50">
                                 <Icon name="Wind" size={48} className="mx-auto mb-4 text-slate-600"/>
                                 <p>No hay nada por aquí...</p>
                             </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {monthlyData.map(f => {
                                    const isSelected = selectedIds.includes(f.id);
                                    const isIncome = safeNum(f.total||f.amount) > 0;
                                    const amount = safeNum(f.total||f.amount);
                                    const isExpanded = expandedId === f.id;

                                    return (
                                        <div key={f.id} onClick={() => setExpandedId(isExpanded ? null : f.id)}
                                            className={`group relative bg-white/5 border ${isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:border-white/20'} rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer`}>
                                            
                                            <div className="p-4 flex items-center gap-4">
                                                <div onClick={(e)=>e.stopPropagation()}>
                                                    <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(f.id)} 
                                                        className="w-5 h-5 rounded border-slate-600 bg-slate-800/50 checked:bg-indigo-500 cursor-pointer appearance-none checked:border-transparent relative after:content-['✓'] after:absolute after:text-white after:text-xs after:left-1 after:top-0"/>
                                                </div>

                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner flex-shrink-0 ${isIncome ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                    <Icon name={f.type==='Culto'?'Church':(categories.find(c=>c.value===f.category)?.icon || 'Hash')} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-white font-bold truncate pr-4">{f.type==='Culto'?'Culto General':f.category}</h4>
                                                        <span className={`font-mono font-bold ${isIncome?'text-emerald-400':'text-rose-400'} ${blurClass}`}>
                                                            {showBalance ? formatCurrency(amount) : '••••'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-1">
                                                        <p className="text-slate-500 text-xs truncate max-w-[200px]">{f.notes || f.method}</p>
                                                        <span className="text-slate-600 text-[10px] font-medium uppercase tracking-wide">{formatDate(f.date)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            <div className={`bg-black/20 border-t border-white/5 transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-48 opacity-100 p-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                                <div className="flex justify-between items-center text-sm mb-2">
                                                    <span className="text-slate-400">Detalle Completo:</span>
                                                    <span className="text-white">{f.notes || "Sin notas"}</span>
                                                </div>
                                                <div className="flex justify-end gap-3 mt-3">
                                                    {f.attachmentUrl && <a href={f.attachmentUrl} target="_blank" className="text-indigo-400 text-xs font-bold hover:underline flex items-center gap-1"><Icon name="Image" size={14}/> Ver Recibo</a>}
                                                    <button onClick={(e)=>{e.stopPropagation(); handleExportPDF(f)}} className="text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"><Icon name="Printer" size={14}/> Imprimir PDF</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* GOALS VIEW (NEW 2.0) */}
                {tabView === 'goals' && (
                    <div className="animate-enter space-y-6">
                        <div className="flex justify-end">
                            <button onClick={()=>openGoalModal()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2">
                                <Icon name="Target" size={18}/> Crear Meta
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {goals.map(g => {
                                const { current, target, pct } = getGoalProgress(g);
                                const isSaving = g.type === 'saving'; // Green/Blue theme
                                const colorClass = isSaving ? 'emerald' : 'orange'; // Tailwind dynamic class limitation: prefer static
                                const colorHex = isSaving ? '#10b981' : '#f97316';
                                const catIcon = categories.find(c=>c.value===g.category)?.icon || 'Star';

                                return (
                                    <div key={g.id} onClick={()=>openGoalModal(g)} className="cursor-pointer group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 transition-all duration-300">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-3 rounded-2xl ${isSaving ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                    <Icon name={catIcon} size={24}/>
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-bold text-lg">{g.label || g.category}</h4>
                                                    <p className="text-slate-500 text-xs uppercase font-bold">{isSaving ? 'Meta de Ahorro' : 'Límite de Gasto'}</p>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-black ${isSaving ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                                {pct}%
                                            </div>
                                        </div>
                                        
                                        <div className="relative h-4 bg-white/5 rounded-full overflow-hidden mb-4 shadow-inner">
                                            <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${isSaving ? 'bg-emerald-500' : 'bg-orange-500'} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
                                                style={{ width: `${Math.min(pct, 100)}%`, boxShadow: `0 0 20px ${colorHex}` }}></div>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-slate-500 text-xs mb-1">{isSaving ? 'Recaudado' : 'Gastado'}</p>
                                                <p className={`text-xl font-black ${blurClass} text-white`}>{formatCurrency(current)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-slate-500 text-xs mb-1">Meta</p>
                                                <p className={`text-lg font-bold text-slate-300 ${blurClass}`}>{formatCurrency(target)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* FIXED BULK DELETE BAR (OUTSIDE EVERYTHING) */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[9999] animate-enter">
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white pl-6 pr-2 py-2 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selección</span>
                            <span className="text-base font-black leading-none">{selectedIds.length} items</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={()=>setSelectedIds([])} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-slate-300"><Icon name="X"/></button>
                            <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-red-500/30 transition-all flex items-center gap-2">
                                <Icon name="Trash2" size={18}/> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REGISTRO */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo Movimiento">
                <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                        {['Culto','Gasto','Ingreso'].map(t=><button key={t} onClick={()=>setForm({...initialForm, type:t})} className={`py-2 text-xs font-black uppercase tracking-wide rounded-xl transition-all ${form.type===t?'bg-white text-indigo-900 shadow-sm':'text-slate-400 hover:text-slate-600'}`}>{t}</button>)}
                    </div>
                    <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                    
                    {form.type==='Culto' ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-3">Efectivo</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Diezmos" type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/>
                                    <Input label="Ofrendas" type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-3">Digital</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Diezmos" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/>
                                    <Input label="Ofrendas" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="font-mono text-xl font-bold"/>
                                <Select label="Método" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select>
                            </div>
                            <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/>
                        </>
                    )}
                    <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
                    <div className="flex gap-3 mt-4">
                        <label className={`flex-1 p-3 border-2 border-dashed rounded-xl flex justify-center items-center gap-2 cursor-pointer transition-colors ${form.attachmentUrl ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400'}`}>
                            <Icon name={form.attachmentUrl?"Check":"Camera"} size={18}/> 
                            <span className="text-xs font-bold">{isUploading?'Subiendo...':(form.attachmentUrl?'Comprobante Listo':'Adjuntar Foto')}</span>
                            <input type="file" className="hidden" onChange={handleImage}/>
                        </label>
                    </div>
                    <Button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20" onClick={handleSave} disabled={isUploading}>Guardar</Button>
                </div>
            </Modal>

            {/* MODAL METAS */}
            <Modal isOpen={isGoalModalOpen} onClose={()=>setIsGoalModalOpen(false)} title={goalForm.id ? "Editar Meta" : "Nueva Meta"}>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                        <button onClick={()=>setGoalForm({...goalForm, type:'spending'})} className={`py-2 text-xs font-black uppercase rounded-xl transition-all ${goalForm.type==='spending'?'bg-white text-orange-500 shadow-sm':'text-slate-400'}`}>Límite Gasto</button>
                        <button onClick={()=>setGoalForm({...goalForm, type:'saving'})} className={`py-2 text-xs font-black uppercase rounded-xl transition-all ${goalForm.type==='saving'?'bg-white text-emerald-500 shadow-sm':'text-slate-400'}`}>Ahorro / Ingreso</button>
                    </div>

                    <Input label="Nombre de la Meta (Opcional)" placeholder="Ej: Sueldo Pastoral, Alquiler..." value={goalForm.label} onChange={e=>setGoalForm({...goalForm, label:e.target.value})}/>
                    <SmartSelect label="Categoría a Monitorear" options={categories} value={goalForm.category} onChange={v=>setGoalForm({...goalForm, category:v})}/>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2 uppercase font-bold">{goalForm.type==='spending' ? 'Límite Máximo' : 'Objetivo a Juntar'}</p>
                        <Input type="number" value={goalForm.amount} onChange={e=>setGoalForm({...goalForm, amount:e.target.value})} className="text-center text-4xl font-black bg-transparent border-none outline-none text-slate-800 placeholder-slate-300"/>
                    </div>

                    <div className="flex gap-3">
                        {goalForm.id && <button onClick={()=>handleDeleteGoal(goalForm.id)} className="p-4 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100"><Icon name="Trash" size={20}/></button>}
                        <Button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold" onClick={handleSaveGoal}>Guardar Meta</Button>
                    </div>
                </div>
            </Modal>

            {/* ELEMENTO OCULTO PARA PDF (Recuperado) */}
            {pdfData && (
                <div ref={printRef} style={{ display: 'none', width: '100mm', minHeight: '150mm', background: 'white', color: '#1e293b', padding: '0', fontFamily: 'sans-serif', position: 'relative' }}>
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
