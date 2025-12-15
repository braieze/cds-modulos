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
    // Agregamos fields para allocation (destinar a meta) y recurring (fijo)
    const initialForm = { 
        type: 'Culto', date: Utils.getLocalDate(), 
        tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', 
        amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '',
        isRecurring: false, allocateToGoalId: '', allocationAmount: ''
    };
    const [form, setForm] = useState(initialForm);

    // Metas (Persistencia Local v3 para soportar acumulado manual)
    const [goals, setGoals] = useState(() => JSON.parse(localStorage.getItem('finance_goals_v3')) || []);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [goalForm, setGoalForm] = useState({ id: null, category: '', amount: '', type: 'spending', label: '', currentSaved: 0 });

    // Referencias Gráficos
    const printRef = useRef(null);
    const [pdfData, setPdfData] = useState(null);
    // Chart Refs
    const chartRefs = {
        projection: useRef(null),
        breakdown: useRef(null),
        daily: useRef(null),
        trend: useRef(null)
    };
    const chartInstances = useRef({});

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

    // --- HELPERS & CALCULOS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const blurClass = showBalance ? '' : 'filter blur-md select-none transition-all duration-500';

    // 1. Datos Mensuales
    const monthlyData = useMemo(() => {
        if (!finances) return [];
        const m = currentDate.toISOString().slice(0, 7);
        return finances
            .filter(f => f.date && f.date.startsWith(m))
            .filter(f => {
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return (f.category||'').toLowerCase().includes(term) || (f.notes||'').toLowerCase().includes(term);
                }
                if (filterType === 'income') return safeNum(f.total || f.amount) > 0;
                if (filterType === 'expense') return safeNum(f.total || f.amount) < 0;
                if (filterType === 'recurring') return f.isRecurring === true;
                return true;
            })
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate, searchTerm, filterType]);

    // 2. Totales Mensuales
    const monthTotals = useMemo(() => {
        let incomes = 0, expenses = 0;
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            if (val > 0) incomes += val; else expenses += Math.abs(val);
        });
        return { incomes, expenses, net: incomes - expenses };
    }, [monthlyData]);

    // 3. Saldos Globales Reales (Histórico Completo)
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

    // 4. Datos para Gráficos
    const chartData = useMemo(() => {
        if (!finances) return null;
        
        // A. Breakdown (Torta) - Solo Gastos Mes Actual
        const pieMap = {};
        monthlyData.filter(f => safeNum(f.total||f.amount) < 0).forEach(f => {
            const c = f.category || 'General';
            pieMap[c] = (pieMap[c] || 0) + Math.abs(safeNum(f.total||f.amount));
        });

        // B. Daily (Barras) - Ingresos vs Gastos por día
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const dailyLabels = Array.from({length: daysInMonth}, (_, i) => i + 1);
        const dailyIncome = new Array(daysInMonth).fill(0);
        const dailyExpense = new Array(daysInMonth).fill(0);
        
        monthlyData.forEach(f => {
            const d = parseInt(f.date.slice(8, 10)) - 1;
            const val = safeNum(f.total || f.amount);
            if(d >= 0 && d < daysInMonth) {
                if(val > 0) dailyIncome[d] += val;
                else dailyExpense[d] += Math.abs(val);
            }
        });

        // C. Projection (Lineal) - Acumulado del mes + Proyección
        const cumulative = [];
        let runningTotal = 0;
        // Orden ascendente para el gráfico
        const sortedMonth = [...monthlyData].sort((a,b) => new Date(a.date) - new Date(b.date));
        sortedMonth.forEach(f => {
             runningTotal += safeNum(f.total || f.amount);
             cumulative.push(runningTotal);
        });
        // Proyección simple: promedio diario * días restantes
        const today = new Date();
        const isCurrentMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
        let projection = null;
        if (isCurrentMonth && cumulative.length > 0) {
            const daysPassed = today.getDate();
            const avgDaily = runningTotal / daysPassed;
            const projectedEnd = runningTotal + (avgDaily * (daysInMonth - daysPassed));
            projection = { current: runningTotal, end: projectedEnd };
        }

        return { 
            pie: { labels: Object.keys(pieMap), data: Object.values(pieMap) },
            daily: { labels: dailyLabels, income: dailyIncome, expense: dailyExpense },
            projection
        };
    }, [monthlyData, currentDate, finances]);

    // --- CHARTS EFFECTS ---
    useEffect(() => {
        const Chart = window.Chart;
        if ((tabView !== 'stats' && tabView !== 'dashboard') || !Chart || !chartData) return;
        
        Chart.defaults.color = '#94a3b8'; 
        Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
        
        // Limpiar instancias previas
        Object.values(chartInstances.current).forEach(c => c && c.destroy());

        // 1. Projection Chart (En Tab Stats)
        if (chartRefs.projection.current && tabView === 'stats') {
            const ctx = chartRefs.projection.current.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Indigo
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

            const dataPoints = chartData.daily.income.map((inc, i) => inc - chartData.daily.expense[i]); // Net daily roughly
            // Simplificado para proyección: Usamos una línea recta desde 0 hasta el total actual
            
            chartInstances.current.projection = new Chart(chartRefs.projection.current, {
                type: 'line',
                data: {
                    labels: ['Inicio', 'Hoy', 'Fin de Mes (Est.)'],
                    datasets: [{
                        label: 'Balance Proyectado',
                        data: [0, monthTotals.net, chartData.projection ? chartData.projection.end : monthTotals.net],
                        borderColor: '#818cf8',
                        borderDash: [5, 5],
                        fill: true,
                        backgroundColor: gradient,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // 2. Breakdown Pie (En Tab Stats)
        if (chartRefs.breakdown.current && tabView === 'stats') {
            chartInstances.current.breakdown = new Chart(chartRefs.breakdown.current, {
                type: 'doughnut',
                data: {
                    labels: chartData.pie.labels,
                    datasets: [{
                        data: chartData.pie.data,
                        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'],
                        borderWidth: 0,
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } }
            });
        }

        // 3. Daily Bars (En Dashboard o Stats)
        const dailyRef = tabView === 'dashboard' ? chartRefs.trend : chartRefs.daily; // Reutilizamos ref para dashboard
        if (dailyRef && dailyRef.current) {
            chartInstances.current.daily = new Chart(dailyRef.current, {
                type: 'bar',
                data: {
                    labels: chartData.daily.labels,
                    datasets: [
                        { label: 'Ingreso', data: chartData.daily.income, backgroundColor: '#10b981', borderRadius: 4 },
                        { label: 'Gasto', data: chartData.daily.expense, backgroundColor: '#f43f5e', borderRadius: 4 }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, display: false } },
                    plugins: { legend: { display: false } }
                }
            });
        }

        return () => Object.values(chartInstances.current).forEach(c => c && c.destroy());
    }, [chartData, tabView, monthTotals]);


    // --- ACCIONES ---
    const handleUnlock = (e) => { e.preventDefault(); if (pinInput === '1234') { setIsLocked(false); setErrorPin(false); } else { setErrorPin(true); setPinInput(''); } };
    const toggleSelect = (id) => { if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id)); else setSelectedIds(prev => [...prev, id]); };
    const selectAll = () => { if (selectedIds.length === monthlyData.length) setSelectedIds([]); else setSelectedIds(monthlyData.map(d => d.id)); };
    
    const handleBulkDelete = async () => {
        if(!confirm(`¿ELIMINAR ${selectedIds.length} ELEMENTOS?`)) return;
        const batch = window.db.batch();
        selectedIds.forEach(id => batch.delete(window.db.collection('finances').doc(id)));
        await batch.commit();
        setSelectedIds([]);
        Utils.notify("Eliminados correctamente");
    };

    const handleSave = () => { 
        let f = {...form, createdAt: new Date().toISOString() };
        
        // Validación y Calculo de Totales
        if(form.type==='Culto') {
            const t = safeNum(form.tithesCash)+safeNum(form.tithesTransfer)+safeNum(form.offeringsCash)+safeNum(form.offeringsTransfer);
            if(t===0) return Utils.notify("Total 0 no permitido", "error");
            f.total = t; f.category = 'Culto';
        } else {
            const a = safeNum(form.amount); if(a===0) return Utils.notify("Monto requerido", "error");
            const v = Math.abs(a); f.amount = form.type==='Gasto'?-v:v; f.total = f.amount;
        }

        // Lógica de Asignación a Meta (Sobres)
        if ((form.type === 'Ingreso' || form.type === 'Culto') && form.allocateToGoalId && safeNum(form.allocationAmount) > 0) {
            const goalId = form.allocateToGoalId;
            const allocAmount = safeNum(form.allocationAmount);
            // Actualizar Meta Localmente
            const updatedGoals = goals.map(g => {
                if (g.id === goalId) {
                    return { ...g, currentSaved: (g.currentSaved || 0) + allocAmount };
                }
                return g;
            });
            setGoals(updatedGoals);
            localStorage.setItem('finance_goals_v3', JSON.stringify(updatedGoals));
            f.notes = (f.notes || '') + ` [Asignado $${allocAmount} a Meta]`;
        }

        addData('finances', f); 
        setIsModalOpen(false); 
        setForm(initialForm); 
        Utils.notify("Registrado con éxito");
    };

    // --- PDF & CSV ---
    const handleExportCSV = () => {
        const headers = ["ID", "Fecha", "Tipo", "Categoría", "Monto", "Método", "Nota"];
        const rows = monthlyData.map(f => [
            f.id, f.date, f.type, f.category || 'Culto', safeNum(f.total || f.amount), f.method, `"${(f.notes || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `Reporte_${currentDate.toISOString().slice(0,7)}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleExportPDF = (item) => {
        setPdfData(item);
        setTimeout(async () => {
            const el = printRef.current; el.style.display = 'block';
            if (window.html2pdf) await window.html2pdf().set({ margin:0, filename:`Recibo.pdf`, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:3, useCORS:true}, jsPDF:{unit:'mm',format:[100,150]} }).from(el).save();
            el.style.display = 'none';
        }, 500);
    };

    // --- METAS ---
    const handleSaveGoal = () => {
        let newGoals;
        const gData = { ...goalForm, currentSaved: safeNum(goalForm.currentSaved) };
        if (goalForm.id) newGoals = goals.map(g => g.id === goalForm.id ? { ...g, ...gData, id: goalForm.id } : g);
        else newGoals = [...goals, { ...gData, id: Date.now().toString() }];
        setGoals(newGoals);
        localStorage.setItem('finance_goals_v3', JSON.stringify(newGoals));
        setIsGoalModalOpen(false);
    };
    
    const handleDeleteGoal = (id) => {
        if(!confirm("¿Borrar meta?")) return;
        const newGoals = goals.filter(g => g.id !== id);
        setGoals(newGoals);
        localStorage.setItem('finance_goals_v3', JSON.stringify(newGoals));
        setIsGoalModalOpen(false);
    };

    const getGoalProgress = (goal) => {
        const target = safeNum(goal.amount);
        let current = 0;
        
        if (goal.type === 'saving') {
            // Para ahorro, usamos el valor acumulado manualmente ("Sobre")
            current = safeNum(goal.currentSaved);
        } else {
            // Para gasto, sumamos los gastos reales del mes
            monthlyData.forEach(f => {
                const val = safeNum(f.total || f.amount);
                if (val < 0 && (f.category === goal.category || (goal.category === 'Culto' && f.type === 'Culto'))) {
                    current += Math.abs(val);
                }
            });
        }
        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        return { current, target, pct };
    };
    
    // Calcular "Dinero en Sobres" vs "Dinero Libre"
    const totalAllocated = goals.filter(g => g.type === 'saving').reduce((acc, g) => acc + safeNum(g.currentSaved), 0);
    const freeBalance = globalBalances.total - totalAllocated;

    // --- RENDER ---
    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-500">Acceso Restringido</div>;
    
    if (isLocked) return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050511] animate-enter">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black pointer-events-none"></div>
            <div className="relative bg-white/5 backdrop-blur-2xl p-8 rounded-[32px] shadow-2xl border border-white/10 max-w-sm w-full text-center">
                <div className="bg-indigo-500 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/50"><Icon name="Lock" size={28}/></div>
                <h2 className="text-2xl font-black text-white mb-6">Finanzas</h2>
                <form onSubmit={handleUnlock}>
                    <input type="password" maxLength="4" autoFocus className="opacity-0 absolute" value={pinInput} onChange={e=>setPinInput(e.target.value)} />
                    <div className="grid grid-cols-3 gap-3">
                        {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} type="button" onClick={()=>setPinInput(p=> (p+n).slice(0,4))} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl border border-white/5">{n}</button>)}
                        <div/>
                        <button type="button" onClick={()=>setPinInput(p=> (p+0).slice(0,4))} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl border border-white/5">0</button>
                        <button type="button" onClick={()=>setPinInput(p=>p.slice(0,-1))} className="h-14 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/10"><Icon name="Delete" size={20}/></button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans -m-4 sm:-m-8 pb-32 relative overflow-hidden selection:bg-indigo-500/30">
            {/* Ambient Background */}
            <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none"></div>
            <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[150px] pointer-events-none"></div>

            <div className="relative z-10 p-4 sm:p-8 max-w-7xl mx-auto">
                {/* HEADER */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-500/20"><Icon name="Wallet" size={24}/></div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Panel Financiero</h2>
                            <p className="text-slate-400 text-sm font-medium">Gestión Integral</p>
                        </div>
                        <button onClick={()=>setShowBalance(!showBalance)} className="ml-2 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors"><Icon name={showBalance?"Eye":"EyeOff"} size={18}/></button>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="text-slate-300 [&>select]:bg-transparent [&>select]:text-white [&>select]:border-none [&>select]:font-bold [&>select]:outline-none px-2"><DateFilter currentDate={currentDate} onChange={setCurrentDate} /></div>
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                        {['dashboard','stats','list','goals'].map(t => (
                            <button key={t} onClick={()=>setTabView(t)} 
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative overflow-hidden ${tabView===t?'text-white shadow-lg':'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                {tabView===t && <div className="absolute inset-0 bg-indigo-600 opacity-80"></div>}
                                <span className="relative z-10 capitalize">{t === 'dashboard' ? 'Resumen' : t === 'stats' ? 'Gráficos' : t === 'list' ? 'Movimientos' : 'Metas'}</span>
                            </button>
                        ))}
                        <button onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}} className="bg-white text-indigo-950 p-2 rounded-xl hover:bg-indigo-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] active:scale-95 ml-1"><Icon name="Plus" size={18}/></button>
                    </div>
                </div>

                {/* DASHBOARD */}
                {tabView === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
                        {/* 1. Main Balance Card (Restaurada Full) */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900 to-[#0f172a] rounded-[32px] p-8 relative overflow-hidden shadow-2xl border border-white/10 group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/30 transition-all duration-700"></div>
                            
                            <div className="relative z-10">
                                <span className="text-indigo-200 text-xs font-bold uppercase tracking-widest border border-indigo-500/30 px-3 py-1 rounded-full bg-indigo-500/10">Balance Total</span>
                                <h3 className={`text-5xl sm:text-6xl font-black text-white mt-4 mb-2 tracking-tight ${blurClass}`}>{showBalance ? formatCurrency(globalBalances.total) : '$ •••••••'}</h3>
                                <p className="text-slate-400 text-sm mb-8">Saldo acumulado disponible</p>

                                {/* Desglose Efectivo vs Banco */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-emerald-400">
                                            <Icon name="DollarSign" size={16}/> <span className="text-xs font-bold uppercase">Efectivo (Caja)</span>
                                        </div>
                                        <span className={`text-xl font-bold text-white ${blurClass}`}>{showBalance ? formatCurrency(globalBalances.cash) : '••••'}</span>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-blue-400">
                                            <Icon name="CreditCard" size={16}/> <span className="text-xs font-bold uppercase">Banco / Digital</span>
                                        </div>
                                        <span className={`text-xl font-bold text-white ${blurClass}`}>{showBalance ? formatCurrency(globalBalances.bank) : '••••'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Monthly Summary Bars */}
                        <div className="flex flex-col gap-4">
                            <div className="flex-1 bg-[#1e293b]/50 backdrop-blur-md border border-white/10 rounded-[32px] p-6 relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-20 h-full bg-emerald-500/10 skew-x-12"></div>
                                <div className="flex justify-between items-end relative z-10">
                                    <div>
                                        <span className="text-emerald-400 text-xs font-bold uppercase block mb-1">Ingresos (Mes)</span>
                                        <span className={`text-2xl font-black text-white ${blurClass}`}>{showBalance ? formatCurrency(monthTotals.incomes) : '••••'}</span>
                                    </div>
                                    <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400"><Icon name="ArrowUp" size={20}/></div>
                                </div>
                                <div className="mt-4 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" style={{width: '70%'}}></div>
                                </div>
                            </div>

                            <div className="flex-1 bg-[#1e293b]/50 backdrop-blur-md border border-white/10 rounded-[32px] p-6 relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-20 h-full bg-rose-500/10 skew-x-12"></div>
                                <div className="flex justify-between items-end relative z-10">
                                    <div>
                                        <span className="text-rose-400 text-xs font-bold uppercase block mb-1">Gastos (Mes)</span>
                                        <span className={`text-2xl font-black text-white ${blurClass}`}>{showBalance ? formatCurrency(monthTotals.expenses) : '••••'}</span>
                                    </div>
                                    <div className="p-3 bg-rose-500/20 rounded-xl text-rose-400"><Icon name="ArrowDown" size={20}/></div>
                                </div>
                                <div className="mt-4 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div className="h-full bg-rose-500 shadow-[0_0_10px_#f43f5e]" style={{width: '40%'}}></div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Daily Trend Chart (Mini) */}
                        <div className="lg:col-span-3 bg-[#0f172a]/40 backdrop-blur-md border border-white/5 rounded-[32px] p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-white font-bold flex items-center gap-2"><Icon name="BarChart" size={16} className="text-indigo-400"/> Actividad Diaria</h4>
                                <span className="text-xs text-slate-500 uppercase font-bold">Últimos 30 días</span>
                            </div>
                            <div className={`h-40 w-full ${blurClass}`}>
                                <canvas ref={chartRefs.trend}></canvas>
                            </div>
                        </div>
                    </div>
                )}

                {/* STATS VIEW (NUEVA PESTAÑA) */}
                {tabView === 'stats' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-enter">
                        {/* Gráfico 1: Proyección */}
                        <div className="bg-[#1e293b]/50 border border-white/10 rounded-[32px] p-6">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Icon name="TrendingUp" className="text-indigo-400"/> Proyección de Cierre</h4>
                            <div className={`h-64 ${blurClass}`}><canvas ref={chartRefs.projection}></canvas></div>
                            <p className="text-center text-xs text-slate-400 mt-4">Estimación basada en el flujo actual del mes.</p>
                        </div>

                        {/* Gráfico 2: Breakdown */}
                        <div className="bg-[#1e293b]/50 border border-white/10 rounded-[32px] p-6">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Icon name="PieChart" className="text-pink-400"/> Distribución de Gastos</h4>
                            <div className={`h-64 flex justify-center ${blurClass}`}><canvas ref={chartRefs.breakdown}></canvas></div>
                        </div>

                        {/* Gráfico 3: Comparativa Diaria */}
                        <div className="lg:col-span-2 bg-[#1e293b]/50 border border-white/10 rounded-[32px] p-6">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Icon name="Activity" className="text-emerald-400"/> Flujo Diario (Ingresos vs Gastos)</h4>
                            <div className={`h-64 ${blurClass}`}><canvas ref={chartRefs.daily}></canvas></div>
                        </div>
                    </div>
                )}

                {/* LIST VIEW */}
                {tabView === 'list' && (
                    <div className="animate-enter space-y-6">
                        <div className="sticky top-0 z-40 bg-[#020617]/90 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                                    <div className="relative w-full md:max-w-md">
                                        <Icon name="Search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                        <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all" 
                                            placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                                    {[ {id:'all',l:'Todo'}, {id:'income',l:'Ingresos'}, {id:'expense',l:'Gastos'}, {id:'recurring',l:'Fijos'} ].map(f => (
                                        <button key={f.id} onClick={()=>setFilterType(f.id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${filterType===f.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-transparent border-white/10 text-slate-400 hover:bg-white/5'}`}>{f.l}</button>
                                    ))}
                                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                                    <button onClick={handleExportCSV} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2"><Icon name="Download" size={16}/> CSV</button>
                                    <button onClick={selectAll} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-2"><Icon name="CheckSquare" size={16}/> {selectedIds.length>0?'Nada':'Todo'}</button>
                                </div>
                            </div>
                        </div>

                        {monthlyData.length === 0 ? <div className="text-center py-20 opacity-50"><p>Sin movimientos</p></div> : (
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
                                                <div onClick={(e)=>e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(f.id)} className="w-5 h-5 rounded border-slate-600 bg-slate-800/50 checked:bg-indigo-500 cursor-pointer"/></div>
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner flex-shrink-0 ${isIncome ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                    <Icon name={f.type==='Culto'?'Church':(categories.find(c=>c.value===f.category)?.icon || 'Hash')} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-white font-bold truncate">{f.type==='Culto'?'Culto General':f.category}</h4>
                                                            {f.isRecurring && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">FIJO</span>}
                                                        </div>
                                                        <span className={`font-mono font-bold ${isIncome?'text-emerald-400':'text-rose-400'} ${blurClass}`}>{showBalance ? formatCurrency(amount) : '••••'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-1">
                                                        <p className="text-slate-500 text-xs truncate max-w-[200px]">{f.notes || f.method}</p>
                                                        <span className="text-slate-600 text-[10px] font-medium uppercase tracking-wide">{formatDate(f.date)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`bg-black/20 border-t border-white/5 transition-all duration-300 ${isExpanded ? 'max-h-48 opacity-100 p-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                                <div className="flex justify-end gap-3"><button onClick={(e)=>{e.stopPropagation(); handleExportPDF(f)}} className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex gap-2"><Icon name="Printer" size={14}/> Imprimir PDF</button></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* GOALS VIEW (Sobres Digitales) */}
                {tabView === 'goals' && (
                    <div className="animate-enter space-y-6">
                        {/* Resumen de Sobres */}
                        <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-6 rounded-[32px] border border-white/10">
                            <h3 className="text-white font-bold mb-4">Distribución de Fondos</h3>
                            <div className="flex gap-8">
                                <div>
                                    <span className="text-slate-400 text-xs uppercase font-bold">Total Asignado (Sobres)</span>
                                    <p className={`text-2xl font-black text-emerald-400 ${blurClass}`}>{formatCurrency(totalAllocated)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs uppercase font-bold">Total Libre</span>
                                    <p className={`text-2xl font-black text-white ${blurClass}`}>{formatCurrency(freeBalance)}</p>
                                </div>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full mt-4 overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{width: `${(totalAllocated/globalBalances.total)*100}%`}}></div>
                            </div>
                        </div>

                        <div className="flex justify-end"><button onClick={()=>setIsGoalModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"><Icon name="PlusCircle" size={18}/> Crear Meta/Sobre</button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {goals.map(g => {
                                const { current, target, pct } = getGoalProgress(g);
                                const isSaving = g.type === 'saving';
                                const colorClass = isSaving ? 'text-emerald-400' : 'text-orange-400';
                                const barColor = isSaving ? '#10b981' : '#f97316';
                                
                                return (
                                    <div key={g.id} className="bg-white/5 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-3 rounded-2xl ${isSaving?'bg-emerald-500/20':'bg-orange-500/20'} ${colorClass}`}><Icon name={isSaving?'Archive':'AlertCircle'} size={24}/></div>
                                                <div>
                                                    <h4 className="text-white font-bold">{g.label || g.category}</h4>
                                                    <p className="text-slate-500 text-xs uppercase font-bold">{isSaving ? 'Sobre de Ahorro' : 'Límite de Gasto'}</p>
                                                </div>
                                            </div>
                                            {isSaving && <button onClick={()=>handleDeleteGoal(g.id)} className="text-slate-600 hover:text-red-400"><Icon name="Trash" size={16}/></button>}
                                        </div>
                                        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden mb-4"><div className="absolute h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor, boxShadow: `0 0 15px ${barColor}` }}></div></div>
                                        <div className="flex justify-between text-xs font-bold text-slate-400"><span>{isSaving?'Guardado':'Gastado'}: <span className={`text-white ${blurClass}`}>{formatCurrency(current)}</span></span><span>Meta: {formatCurrency(target)}</span></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ACTION BAR FIXED */}
            {selectedIds.length > 0 && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-xl border border-white/20 p-2 rounded-full flex gap-4 shadow-2xl"><span className="text-white font-bold px-4 py-2">{selectedIds.length} seleccionados</span><button onClick={handleBulkDelete} className="bg-red-500 text-white px-6 rounded-full font-bold flex items-center gap-2"><Icon name="Trash2" size={18}/> Eliminar</button></div>}

            {/* MODAL REGISTRO + ALLOCATION */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nueva Operación">
                <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                        {['Culto','Gasto','Ingreso'].map(t=><button key={t} onClick={()=>setForm({...initialForm, type:t})} className={`py-2 text-xs font-black uppercase rounded-lg transition-all ${form.type===t?'bg-white text-indigo-900 shadow':'text-slate-400'}`}>{t}</button>)}
                    </div>
                    <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                    
                    {form.type==='Culto' ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-xs font-bold text-slate-400 uppercase block mb-2">Efectivo</span><div className="grid grid-cols-2 gap-3"><Input label="Diezmos" type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/><Input label="Ofrendas" type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/></div></div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-xs font-bold text-slate-400 uppercase block mb-2">Digital</span><div className="grid grid-cols-2 gap-3"><Input label="Diezmos" type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/><Input label="Ofrendas" type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/></div></div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4"><Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="font-mono text-xl font-bold"/><Select label="Método" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select></div>
                            <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/>
                            {form.type === 'Gasto' && (
                                <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 cursor-pointer" onClick={()=>setForm({...form, isRecurring: !form.isRecurring})}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${form.isRecurring ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{form.isRecurring && <Icon name="Check" size={12} className="text-white"/>}</div>
                                    <span className="text-sm font-bold text-indigo-900">¿Es un Gasto Fijo Mensual?</span>
                                </div>
                            )}
                        </>
                    )}

                    {/* ALLOCATION LOGIC (DESTINAR A META) */}
                    {(form.type === 'Ingreso' || form.type === 'Culto') && goals.some(g=>g.type==='saving') && (
                         <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <p className="text-xs font-bold text-emerald-600 uppercase mb-2">¿Destinar parte a un Sobre/Meta?</p>
                            <div className="flex gap-2 mb-2">
                                <select className="w-full p-2 rounded-lg border border-emerald-200 text-sm" value={form.allocateToGoalId} onChange={e=>setForm({...form, allocateToGoalId:e.target.value})}>
                                    <option value="">-- No Asignar --</option>
                                    {goals.filter(g=>g.type==='saving').map(g=><option key={g.id} value={g.id}>{g.label || g.category}</option>)}
                                </select>
                            </div>
                            {form.allocateToGoalId && <Input label="Monto a Destinar" type="number" value={form.allocationAmount} onChange={e=>setForm({...form, allocationAmount:e.target.value})} />}
                         </div>
                    )}

                    <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
                    <div className="flex gap-3"><label className={`flex-1 p-3 border-2 border-dashed rounded-xl flex justify-center items-center gap-2 cursor-pointer ${form.attachmentUrl?'border-emerald-500 bg-emerald-50 text-emerald-600':'border-slate-300'}`}><Icon name="Camera" size={18}/><input type="file" className="hidden" onChange={handleImage}/></label></div>
                    <Button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl" onClick={handleSave}>Guardar Operación</Button>
                </div>
            </Modal>

            {/* MODAL METAS */}
            <Modal isOpen={isGoalModalOpen} onClose={()=>setIsGoalModalOpen(false)} title="Nueva Meta / Sobre">
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button onClick={()=>setGoalForm({...goalForm, type:'spending'})} className={`py-2 text-xs font-black uppercase rounded-lg ${goalForm.type==='spending'?'bg-white text-orange-500 shadow':'text-slate-400'}`}>Límite Gasto</button>
                        <button onClick={()=>setGoalForm({...goalForm, type:'saving'})} className={`py-2 text-xs font-black uppercase rounded-lg ${goalForm.type==='saving'?'bg-white text-emerald-500 shadow':'text-slate-400'}`}>Sobre Ahorro</button>
                    </div>
                    <Input label="Nombre (ej: Sueldo Pastor)" value={goalForm.label} onChange={e=>setGoalForm({...goalForm, label:e.target.value})}/>
                    <SmartSelect label="Categoría" options={categories} value={goalForm.category} onChange={v=>setGoalForm({...goalForm, category:v})}/>
                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200"><p className="text-xs text-slate-500 mb-2 uppercase font-bold">Monto Objetivo</p><Input type="number" value={goalForm.amount} onChange={e=>setGoalForm({...goalForm, amount:e.target.value})} className="text-center text-4xl font-black bg-transparent border-none outline-none text-slate-800"/></div>
                    {/* Campo para saldo inicial manual en ahorro */}
                    {goalForm.type === 'saving' && <Input label="Saldo Inicial en el Sobre" type="number" value={goalForm.currentSaved} onChange={e=>setGoalForm({...goalForm, currentSaved:e.target.value})} />}
                    <Button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold" onClick={handleSaveGoal}>Crear</Button>
                </div>
            </Modal>

            {/* PDF HIDDEN */}
            {pdfData && <div ref={printRef} style={{display:'none',width:'100mm',background:'white',padding:'30px',color:'#1e293b'}}>
                <div style={{background:'#4f46e5',height:'5px',marginBottom:'20px'}}></div>
                <h1 style={{fontSize:'18px',fontWeight:'900',color:'#4f46e5'}}>CONQUISTADORES</h1>
                <p style={{fontSize:'10px',color:'#94a3b8'}}>COMPROBANTE OFICIAL</p>
                <div style={{margin:'30px 0',textAlign:'center'}}><h2 style={{fontSize:'36px',fontWeight:'900'}}>{formatCurrency(pdfData.total||pdfData.amount)}</h2></div>
                <div style={{borderTop:'1px dashed #e2e8f0',paddingTop:'10px',fontSize:'12px'}}><p><strong>Fecha:</strong> {formatDate(pdfData.date)}</p><p><strong>Concepto:</strong> {pdfData.category}</p><p><strong>Notas:</strong> {pdfData.notes}</p></div>
            </div>}
        </div>
    );
};
