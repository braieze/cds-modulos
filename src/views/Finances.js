window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, updateData, deleteData, userProfile, setActiveTab: setMainTab }) => {
    const { useState, useMemo, useEffect, useRef } = React;
    const Utils = window.Utils || {};
    const { Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, Badge } = Utils;

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
    const [selectedIds, setSelectedIds] = useState([]);

    // Seguridad PIN (ACTUALIZADO A 2367)
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);
    const pinInputRef = useRef(null);

    // --- FORMULARIO PRINCIPAL ---
    const initialForm = { 
        id: null,
        type: 'Culto', 
        date: Utils.getLocalDate(), 
        
        // CULTO - DETALLE
        offeringsCash: '', 
        offeringsTransfer: '',
        titheEnvelopes: [], // Array de { family, amount, prayer, method }
        
        // OTROS
        amount: '', 
        category: 'General', 
        method: 'Efectivo', 
        notes: '', 
        attachmentUrl: '',
        isRecurring: false, 
        allocateToGoalId: '', 
        allocationAmount: ''
    };
    const [form, setForm] = useState(initialForm);

    // Estado temporal para agregar sobre en el modal (Con método de pago individual)
    const [tempEnvelope, setTempEnvelope] = useState({ family: '', amount: '', prayer: '', method: 'Efectivo' });

    // FONDOS (Antes Goals) - Persistencia en localStorage por ahora
    const [goals, setGoals] = useState(() => JSON.parse(localStorage.getItem('finance_goals_v3')) || []);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [goalForm, setGoalForm] = useState({ id: null, label: '', category: '', amount: '', type: 'saving', currentSaved: 0 });

    // Referencias
    const printRef = useRef(null);
    const [pdfData, setPdfData] = useState(null);
    
    // Chart Refs
    const chartRefs = { projection: useRef(null), breakdown: useRef(null), daily: useRef(null), trend: useRef(null) };
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

    // --- HELPERS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const blurClass = showBalance ? '' : 'filter blur-md select-none transition-all duration-500';

    // Normalizador de Familias (Gomez Salcedo === Salcedo Gomez)
    const normalizeFamilyName = (name) => {
        if(!name) return 'Anónimo';
        // Quitar "Flia", "Familia", espacios extra y ordenar palabras alfabéticamente
        const clean = name.toLowerCase().replace(/flia\.?|familia/g, '').trim();
        return clean.split(/\s+/).sort().join(' ');
    };

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

    // 2. Totales
    const monthTotals = useMemo(() => {
        let incomes = 0, expenses = 0;
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            if (val > 0) incomes += val; else expenses += Math.abs(val);
        });
        return { incomes, expenses, net: incomes - expenses };
    }, [monthlyData]);

    // 3. Saldos Globales
    const globalBalances = useMemo(() => {
        let cash = 0, bank = 0;
        if (finances) {
            finances.forEach(f => {
                if (f.type === 'Culto') {
                    cash += safeNum(f.tithesCash) + safeNum(f.offeringsCash);
                    bank += safeNum(f.tithesTransfer) + safeNum(f.offeringsTransfer);
                } else {
                    const val = safeNum(f.amount);
                    if (f.method === 'Banco') bank += val; else cash += val;
                }
            });
        }
        return { cash, bank, total: cash + bank };
    }, [finances]);

    // 4. Análisis Diezmantes Mejorado
    const [titherFilter, setTitherFilter] = useState('month'); // 'all', 'year', 'month'
    
    const tithersAnalysis = useMemo(() => {
        const map = {};
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);
        const currentYear = now.getFullYear();

        (finances || []).forEach(f => {
            if (f.type === 'Culto' && f.titheEnvelopes) {
                // Aplicar Filtro de Tiempo
                if (titherFilter === 'month' && !f.date.startsWith(currentMonth)) return;
                if (titherFilter === 'year' && new Date(f.date).getFullYear() !== currentYear) return;

                f.titheEnvelopes.forEach(env => {
                    // Usar ID único basado en nombre normalizado para agrupar
                    const rawName = env.family || 'Anónimo';
                    const key = normalizeFamilyName(rawName);
                    
                    if (!map[key]) map[key] = { 
                        id: key, 
                        displayName: rawName, // Guardamos el último nombre usado para mostrar
                        total: 0, 
                        count: 0, 
                        lastDate: f.date, 
                        requests: [] 
                    };
                    
                    map[key].total += safeNum(env.amount);
                    map[key].count += 1;
                    if (f.date > map[key].lastDate) {
                        map[key].lastDate = f.date;
                        map[key].displayName = rawName; // Actualizar nombre al más reciente
                    }
                    if (env.prayer) map[key].requests.push({ date: f.date, text: env.prayer });
                });
            }
        });
        return Object.values(map).sort((a,b) => b.total - a.total);
    }, [finances, titherFilter]);

    // --- GRÁFICOS (RESTAURADOS) ---
    const chartData = useMemo(() => {
        if (!finances) return null;
        const pieMap = {};
        monthlyData.filter(f => safeNum(f.total||f.amount) < 0).forEach(f => {
            const c = f.category || 'General';
            pieMap[c] = (pieMap[c] || 0) + Math.abs(safeNum(f.total||f.amount));
        });
        
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const dailyLabels = Array.from({length: daysInMonth}, (_, i) => i + 1);
        const dailyIncome = new Array(daysInMonth).fill(0);
        const dailyExpense = new Array(daysInMonth).fill(0);
        
        monthlyData.forEach(f => {
            const d = parseInt(f.date.slice(8, 10)) - 1;
            const val = safeNum(f.total || f.amount);
            if(d >= 0 && d < daysInMonth) {
                if(val > 0) dailyIncome[d] += val; else dailyExpense[d] += Math.abs(val);
            }
        });

        // Proyección
        const cumulative = [];
        let runningTotal = 0;
        [...monthlyData].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(f => {
             runningTotal += safeNum(f.total || f.amount);
             cumulative.push(runningTotal);
        });
        const today = new Date();
        let projection = null;
        if (today.getMonth() === currentDate.getMonth() && cumulative.length > 0) {
            const daysPassed = today.getDate();
            const avgDaily = runningTotal / daysPassed;
            projection = { current: runningTotal, end: runningTotal + (avgDaily * (daysInMonth - daysPassed)) };
        }

        return { pie: { labels: Object.keys(pieMap), data: Object.values(pieMap) }, daily: { labels: dailyLabels, income: dailyIncome, expense: dailyExpense }, projection };
    }, [monthlyData, currentDate, finances]);

    useEffect(() => {
        const Chart = window.Chart;
        if ((tabView !== 'stats' && tabView !== 'dashboard') || !Chart || !chartData) return;
        Chart.defaults.color = '#94a3b8'; Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
        Object.values(chartInstances.current).forEach(c => c && c.destroy());

        if (chartRefs.projection.current && tabView === 'stats') {
            const ctx = chartRefs.projection.current.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
            chartInstances.current.projection = new Chart(chartRefs.projection.current, {
                type: 'line', data: { labels: ['Inicio', 'Hoy', 'Fin'], datasets: [{ label: 'Proyección', data: [0, monthTotals.net, chartData.projection?.end || monthTotals.net], borderColor: '#818cf8', fill: true, backgroundColor: gradient }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }
        if (chartRefs.breakdown.current && tabView === 'stats') {
            chartInstances.current.breakdown = new Chart(chartRefs.breakdown.current, {
                type: 'doughnut', data: { labels: chartData.pie.labels, datasets: [{ data: chartData.pie.data, backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } }
            });
        }
        const dailyRef = tabView === 'dashboard' ? chartRefs.trend : chartRefs.daily;
        if (dailyRef && dailyRef.current) {
            chartInstances.current.daily = new Chart(dailyRef.current, {
                type: 'bar', data: { labels: chartData.daily.labels, datasets: [{ label: 'Ingreso', data: chartData.daily.income, backgroundColor: '#10b981', borderRadius: 4 }, { label: 'Gasto', data: chartData.daily.expense, backgroundColor: '#f43f5e', borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, display: false } }, plugins: { legend: { display: false } } }
            });
        }
        return () => Object.values(chartInstances.current).forEach(c => c && c.destroy());
    }, [chartData, tabView, monthTotals]);

    // --- PIN LOGIC ---
    useEffect(() => {
        if (isLocked) setTimeout(() => pinInputRef.current?.focus(), 100);
        if (pinInput.length === 4) {
            if (pinInput === '2367') { setIsLocked(false); setErrorPin(false); } 
            else { setErrorPin(true); Utils.notify("PIN Incorrecto", "error"); setPinInput(''); }
        }
    }, [isLocked, pinInput]);
    const handleVirtualKey = (n) => { setPinInput(prev => (prev + n).slice(0, 4)); pinInputRef.current?.focus(); };

    // --- ACCIONES ---
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

    const handleImage = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        setIsUploading(true);
        try {
            let result;
            if (Utils.compressImage) result = await Utils.compressImage(file);
            else { const reader = new FileReader(); reader.readAsDataURL(file); result = await new Promise(r => reader.onloadend = () => r(reader.result)); }
            setForm(prev => ({ ...prev, attachmentUrl: result }));
            Utils.notify("Imagen adjuntada");
        } catch (error) { Utils.notify("Error imagen", "error"); } finally { setIsUploading(false); }
    };

    // --- SAVE LOGIC REESCRITA ---
    const handleSave = async () => {
        if (!form.date) return Utils.notify("Falta fecha", "error");

        let payload = { ...form };
        let totalAmount = 0;

        if (form.type === 'Culto') {
            // 1. Sumar Sobres por método
            let tithesC = 0;
            let tithesT = 0;
            
            form.titheEnvelopes.forEach(e => {
                if (e.method === 'Banco') tithesT += safeNum(e.amount);
                else tithesC += safeNum(e.amount);
            });

            // 2. Sumar Ofrendas Sueltas
            const offC = safeNum(form.offeringsCash);
            const offT = safeNum(form.offeringsTransfer);

            // 3. Totales Calculados
            payload.tithesCash = tithesC;
            payload.tithesTransfer = tithesT;
            payload.offeringsCash = offC;
            payload.offeringsTransfer = offT;
            
            totalAmount = tithesC + tithesT + offC + offT;
            
            if (totalAmount === 0) return Utils.notify("El total no puede ser 0", "error");
            
            payload.total = totalAmount;
            payload.amount = totalAmount;
            payload.category = 'Culto General';
            payload.method = 'Mixto'; 
        
        } else {
            totalAmount = safeNum(form.amount);
            if (totalAmount === 0) return Utils.notify("Monto requerido", "error");
            payload.amount = form.type === 'Gasto' ? -Math.abs(totalAmount) : Math.abs(totalAmount);
            payload.total = payload.amount;
        }

        try {
            if (form.id) await updateData('finances', form.id, payload);
            else await addData('finances', payload);
            
            setIsModalOpen(false);
            setForm(initialForm);
            Utils.notify("Operación Guardada");
        } catch (e) {
            console.error(e);
            Utils.notify("Error al guardar", "error");
        }
    };

    // --- FONDOS ---
    const handleSaveGoal = () => {
        let newGoals;
        const gData = { ...goalForm, currentSaved: safeNum(goalForm.currentSaved) };
        if (goalForm.id) newGoals = goals.map(g => g.id === goalForm.id ? { ...g, ...gData } : g);
        else newGoals = [...goals, { ...gData, id: Date.now().toString() }];
        setGoals(newGoals);
        localStorage.setItem('finance_goals_v3', JSON.stringify(newGoals));
        setIsGoalModalOpen(false);
    };
    
    const handleDeleteGoal = (id) => {
        if(!confirm("¿Borrar fondo?")) return;
        const newGoals = goals.filter(g => g.id !== id);
        setGoals(newGoals);
        localStorage.setItem('finance_goals_v3', JSON.stringify(newGoals));
    };

    const getGoalProgress = (goal) => {
        const target = safeNum(goal.amount);
        let current = safeNum(goal.currentSaved); // Base manual
        // Aquí podrías agregar lógica para sumar movimientos automáticos si quisieras
        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        return { current, target, pct };
    };

    // --- SUB-HANDLERS ---
    const handleAddEnvelope = () => {
        if (!tempEnvelope.amount) return;
        setForm(prev => ({
            ...prev,
            titheEnvelopes: [...prev.titheEnvelopes, { ...tempEnvelope, id: Date.now() }]
        }));
        setTempEnvelope({ family: '', amount: '', prayer: '', method: 'Efectivo' });
    };

    const handleEditEnvelope = (idx, field, value) => {
        const updated = [...form.titheEnvelopes];
        updated[idx] = { ...updated[idx], [field]: value };
        setForm(prev => ({ ...prev, titheEnvelopes: updated }));
    };

    const removeEnvelope = (idx) => {
        setForm(prev => ({ ...prev, titheEnvelopes: prev.titheEnvelopes.filter((_, i) => i !== idx) }));
    };

    const handleExportPDF = (item) => {
        setPdfData(item);
        setTimeout(async () => {
            const el = printRef.current; el.style.display = 'block';
            if (window.html2pdf) await window.html2pdf().set({ margin:0, filename:`Recibo_${item.id}.pdf`, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:3, useCORS:true}, jsPDF:{unit:'mm',format:[100,150]} }).from(el).save();
            el.style.display = 'none';
        }, 500);
    };

    // --- RENDER ---
    if (isLocked) return (
        <div onClick={handleBackgroundClick} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050511] animate-enter cursor-pointer">
            <button onClick={() => setMainTab && setMainTab('dashboard')} className="absolute top-6 left-6 text-slate-400 flex items-center gap-2 hover:text-white transition-colors z-50">
                <Icon name="ChevronLeft"/> Volver
            </button>
            <div className="relative bg-white/5 backdrop-blur-2xl p-8 rounded-[32px] shadow-2xl border border-white/10 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                <div className={`bg-indigo-500 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-lg transition-all ${errorPin ? 'animate-shake bg-red-500' : ''}`}><Icon name="Lock" size={28}/></div>
                <h2 className="text-2xl font-black text-white mb-2">Tesoreria</h2>
                <p className="text-slate-400 text-sm mb-6">Ingresa PIN (2367)</p>
                <input ref={pinInputRef} type="number" className="opacity-0 absolute top-0 left-0 w-full h-full" value={pinInput} onChange={e => setPinInput(e.target.value.slice(0,4))} onBlur={() => setTimeout(() => pinInputRef.current?.focus(), 100)}/>
                <div className="flex justify-center gap-4 mb-8">{[0, 1, 2, 3].map(i => (<div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pinInput.length ? 'bg-indigo-500 scale-110 shadow-[0_0_10px_#6366f1]' : 'bg-white/10'}`}></div>))}</div>
                <div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(n => (<button key={n} onClick={() => handleVirtualKey(n)} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl border border-white/5 active:scale-95 transition-all">{n}</button>))}
                    <div/><button onClick={() => handleVirtualKey(0)} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl">0</button><button onClick={() => setPinInput(p=>p.slice(0,-1))} className="h-14 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center"><Icon name="Delete" size={20}/></button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans -m-4 sm:-m-8 pb-32 relative overflow-hidden selection:bg-indigo-500/30">
            <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none"></div>
            <div className="relative z-10 p-4 sm:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMainTab && setMainTab('dashboard')} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><Icon name="ChevronLeft"/></button>
                        <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-3 rounded-2xl text-white shadow-xl"><Icon name="Wallet" size={24}/></div>
                        <div><h2 className="text-2xl font-black text-white tracking-tight">Tesoreria</h2><p className="text-slate-400 text-sm font-medium">Gestión Integral</p></div>
                        <button onClick={()=>setShowBalance(!showBalance)} className="ml-2 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white"><Icon name={showBalance?"Eye":"EyeOff"} size={18}/></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="text-slate-300 px-2"><DateFilter currentDate={currentDate} onChange={setCurrentDate} /></div>
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                        {['dashboard','list','tithers','funds'].map(t => (
                            <button key={t} onClick={()=>setTabView(t)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative overflow-hidden ${tabView===t?'text-white shadow-lg':'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                {tabView===t && <div className="absolute inset-0 bg-indigo-600 opacity-80"></div>}
                                <span className="relative z-10 capitalize">{t === 'dashboard' ? 'Resumen' : t === 'list' ? 'Movimientos' : t === 'tithers' ? 'Diezmantes' : 'Fondos'}</span>
                            </button>
                        ))}
                        <button onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}} className="bg-white text-indigo-950 p-2 rounded-xl hover:bg-indigo-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] ml-1"><Icon name="Plus" size={18}/></button>
                    </div>
                </div>

                {/* VISTA 1: DASHBOARD */}
                {tabView === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900 to-[#0f172a] rounded-[32px] p-8 relative overflow-hidden shadow-2xl border border-white/10">
                            <div className="relative z-10">
                                <span className="text-indigo-200 text-xs font-bold uppercase tracking-widest border border-indigo-500/30 px-3 py-1 rounded-full bg-indigo-500/10">Balance Total</span>
                                <h3 className={`text-5xl sm:text-6xl font-black text-white mt-4 mb-2 tracking-tight ${blurClass}`}>{showBalance ? formatCurrency(globalBalances.total) : '$ •••••••'}</h3>
                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-2 mb-2 text-emerald-400"><Icon name="DollarSign" size={16}/> <span className="text-xs font-bold uppercase">Caja</span></div><span className={`text-xl font-bold text-white ${blurClass}`}>{showBalance ? formatCurrency(globalBalances.cash) : '••••'}</span></div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-2 mb-2 text-blue-400"><Icon name="CreditCard" size={16}/> <span className="text-xs font-bold uppercase">Banco</span></div><span className={`text-xl font-bold text-white ${blurClass}`}>{showBalance ? formatCurrency(globalBalances.bank) : '••••'}</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#1e293b]/50 backdrop-blur-md border border-white/10 rounded-[32px] p-6 relative overflow-hidden flex flex-col justify-center">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
                            <div className="flex items-center gap-2 mb-4 text-purple-400"><Icon name="TrendingUp" size={20}/><h3 className="font-bold uppercase tracking-wider text-xs">Diezmo Nacional (10%)</h3></div>
                            <h2 className={`text-4xl font-black text-white mb-4 ${blurClass}`}>{showBalance ? formatCurrency(stats.nationalTithe) : '••••'}</h2>
                            <p className="text-xs text-slate-400">Sobre Ingresos: {formatCurrency(stats.incomes)}</p>
                        </div>
                        <div className="lg:col-span-3 bg-[#0f172a]/40 backdrop-blur-md border border-white/5 rounded-[32px] p-6">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Icon name="BarChart" className="text-indigo-400"/> Flujo Diario</h4>
                            <div className={`h-40 w-full ${blurClass}`}><canvas ref={chartRefs.trend}></canvas></div>
                        </div>
                    </div>
                )}

                {/* VISTA 2: LISTADO */}
                {tabView === 'list' && (
                    <div className="animate-enter space-y-4">
                        {monthlyData.length === 0 ? <div className="text-center py-20 text-slate-500">Sin movimientos.</div> : monthlyData.map(f => (
                            <div key={f.id} className="bg-white/5 border border-white/5 hover:border-white/20 p-4 rounded-2xl flex items-center gap-4 transition-all group">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${f.type==='Culto'?'bg-purple-500/20 text-purple-400':(safeNum(f.amount)>0?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400')}`}><Icon name={f.type==='Culto'?'Church':(safeNum(f.amount)>0?'TrendingUp':'ShoppingBag')}/></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between"><h4 className="font-bold text-white truncate">{f.type==='Culto'?'Culto General':f.category}</h4><span className={`font-mono font-bold ${safeNum(f.amount)>0?'text-emerald-400':'text-rose-400'} ${blurClass}`}>{formatCurrency(f.amount)}</span></div>
                                    <div className="flex justify-between mt-1 text-xs text-slate-500"><span>{formatDate(f.date)} • {f.method}</span><span className="italic truncate max-w-[150px]">{f.notes}</span></div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>handleEdit(f)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20"><Icon name="Edit" size={16}/></button>
                                    <button onClick={(e)=>{e.stopPropagation(); handleExportPDF(f)}} className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30"><Icon name="Printer" size={16}/></button>
                                    <button onClick={()=>{setSelectedIds([f.id]); handleDelete()}} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><Icon name="Trash" size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* VISTA 3: DIEZMANTES MEJORADA */}
                {tabView === 'tithers' && (
                    <div className="animate-enter space-y-6">
                        <div className="flex justify-end gap-2">
                            <button onClick={()=>setTitherFilter('month')} className={`px-3 py-1 rounded-full text-xs font-bold ${titherFilter==='month'?'bg-indigo-600 text-white':'bg-white/10 text-slate-400'}`}>Este Mes</button>
                            <button onClick={()=>setTitherFilter('year')} className={`px-3 py-1 rounded-full text-xs font-bold ${titherFilter==='year'?'bg-indigo-600 text-white':'bg-white/10 text-slate-400'}`}>Este Año</button>
                            <button onClick={()=>setTitherFilter('all')} className={`px-3 py-1 rounded-full text-xs font-bold ${titherFilter==='all'?'bg-indigo-600 text-white':'bg-white/10 text-slate-400'}`}>Histórico</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tithersAnalysis.map((t, i) => (
                                <div key={i} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white">{t.displayName.charAt(0)}</div>
                                            <div><h4 className="font-bold text-white">{t.displayName}</h4><p className="text-xs text-slate-400">Último: {formatDate(t.lastDate)}</p></div>
                                        </div>
                                        <div className="text-right"><span className={`block font-mono font-bold text-emerald-400 ${blurClass}`}>{formatCurrency(t.total)}</span><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-300">{t.count} veces</span></div>
                                    </div>
                                    {t.requests.length > 0 && (
                                        <div className="bg-black/20 p-3 rounded-xl mt-2"><p className="text-[10px] font-bold text-indigo-300 uppercase mb-1">Últimas Peticiones</p>{t.requests.slice(-2).map((r, ri) => <p key={ri} className="text-xs text-slate-300 truncate">• {r.text}</p>)}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VISTA 4: FONDOS (DISEÑO MEJORADO) */}
                {tabView === 'funds' && (
                    <div className="animate-enter">
                        <div className="flex justify-end mb-6"><Button onClick={()=>setIsGoalModalOpen(true)} icon="Plus">Nuevo Fondo</Button></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {funds.map(fund => {
                                const { current, target, pct } = getGoalProgress(fund);
                                return (
                                    <div key={fund.id} className="bg-[#1e293b] border border-white/10 p-6 rounded-[32px] relative overflow-hidden group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`w-12 h-12 rounded-2xl ${fund.type==='saving'?'bg-emerald-500':'bg-orange-500'} flex items-center justify-center text-white shadow-lg`}><Icon name={fund.type==='saving'?'Archive':'AlertCircle'}/></div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={()=>{setGoalForm(fund); setIsGoalModalOpen(true)}} className="text-slate-400 hover:text-white"><Icon name="Edit" size={16}/></button>
                                                <button onClick={()=>handleDeleteGoal(fund.id)} className="text-slate-400 hover:text-red-500"><Icon name="Trash" size={16}/></button>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-1">{fund.label}</h3>
                                        <p className="text-slate-400 text-xs uppercase font-bold mb-4">{fund.category} • {fund.type==='saving'?'Ahorro':'Presupuesto'}</p>
                                        <div className="relative h-2 bg-white/10 rounded-full mb-2"><div className={`absolute h-full rounded-full ${fund.type==='saving'?'bg-emerald-500':'bg-orange-500'}`} style={{width: `${Math.min(pct,100)}%`}}></div></div>
                                        <div className="flex justify-between text-xs font-bold text-slate-300"><span>Actual: {formatCurrency(current)}</span><span>Meta: {formatCurrency(target)}</span></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* VISTA 5: ESTADÍSTICAS (RESTAURADA) */}
                {tabView === 'stats' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-enter">
                        <div className="bg-[#1e293b]/50 border border-white/10 rounded-[32px] p-6"><h4 className="text-white font-bold mb-4">Proyección Mensual</h4><div className={`h-64 ${blurClass}`}><canvas ref={chartRefs.projection}></canvas></div></div>
                        <div className="bg-[#1e293b]/50 border border-white/10 rounded-[32px] p-6"><h4 className="text-white font-bold mb-4">Distribución Gastos</h4><div className={`h-64 ${blurClass}`}><canvas ref={chartRefs.breakdown}></canvas></div></div>
                    </div>
                )}
            </div>

            {/* MODAL REGISTRO (CON SOBRES Y OFRENDAS) */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Operación">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 pb-4">
                    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                        {['Culto', 'Gasto', 'Ingreso'].map(t => (<button key={t} onClick={() => setForm({ ...initialForm, type: t })} className={`py-2 text-xs font-black uppercase rounded-lg transition-all ${form.type === t ? 'bg-white text-indigo-900 shadow' : 'text-slate-400'}`}>{t}</button>))}
                    </div>
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />

                    {form.type === 'Culto' ? (
                        <div className="space-y-6">
                            {/* Ofrendas Sueltas */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Icon name="Gift" size={14}/> Ofrendas Sueltas</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Efectivo" type="number" placeholder="$0" value={form.offeringsCash} onChange={e => setForm({ ...form, offeringsCash: e.target.value })} />
                                    <Input label="Digital" type="number" placeholder="$0" value={form.offeringsTransfer} onChange={e => setForm({ ...form, offeringsTransfer: e.target.value })} />
                                </div>
                            </div>

                            {/* Sobres de Diezmo */}
                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Icon name="Mail" size={14}/> Sobres de Diezmo</h4>
                                
                                <div className="flex flex-col gap-2 mb-4 bg-white p-3 rounded-xl shadow-sm border border-indigo-100">
                                    <Input placeholder="Familia (ej: Perez Garcia)" value={tempEnvelope.family} onChange={e => setTempEnvelope({ ...tempEnvelope, family: e.target.value })} className="text-sm font-bold" />
                                    <div className="flex gap-2">
                                        <div className="flex-1"><Input type="number" placeholder="$ Monto" value={tempEnvelope.amount} onChange={e => setTempEnvelope({ ...tempEnvelope, amount: e.target.value })} /></div>
                                        <div className="w-1/3"><Select value={tempEnvelope.method} onChange={e => setTempEnvelope({ ...tempEnvelope, method: e.target.value })}><option>Efectivo</option><option>Banco</option></Select></div>
                                    </div>
                                    <Input placeholder="Petición..." value={tempEnvelope.prayer} onChange={e => setTempEnvelope({ ...tempEnvelope, prayer: e.target.value })} className="text-xs" />
                                    <Button size="sm" onClick={handleAddEnvelope} disabled={!tempEnvelope.amount} className="mt-1">Agregar Sobre</Button>
                                </div>

                                <div className="space-y-2">
                                    {form.titheEnvelopes.map((env, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-indigo-100 text-sm shadow-sm">
                                            <div>
                                                <span className="font-bold text-indigo-900 block">{env.family || 'Anónimo'} <span className="text-[9px] text-slate-400 font-normal bg-slate-100 px-1 rounded">{env.method}</span></span>
                                                <span className="text-xs text-slate-500">{env.prayer}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-slate-700">{formatCurrency(env.amount)}</span>
                                                <button onClick={() => removeEnvelope(idx)} className="text-red-400 hover:text-red-600"><Icon name="X" size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {form.titheEnvelopes.length === 0 && <p className="text-center text-xs text-indigo-300 italic">No hay sobres cargados aún.</p>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Monto" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="font-mono text-xl font-bold" />
                                <Select label="Método" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option>Efectivo</option><option>Banco</option></Select>
                            </div>
                            <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v => setForm({ ...form, category: v })} />
                        </>
                    )}
                    
                    <Input label="Notas / Detalles" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    <Button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl mt-4" onClick={handleSave} disabled={isUploading}>{isUploading ? 'Subiendo...' : 'Guardar Operación'}</Button>
                </div>
            </Modal>

            {/* MODAL FONDOS */}
            <Modal isOpen={isGoalModalOpen} onClose={()=>setIsGoalModalOpen(false)} title="Gestión de Fondo">
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button onClick={()=>setGoalForm({...goalForm, type:'saving'})} className={`py-2 text-xs font-black uppercase rounded-lg ${goalForm.type==='saving'?'bg-white text-emerald-600 shadow':'text-slate-400'}`}>Ahorro (+)</button>
                        <button onClick={()=>setGoalForm({...goalForm, type:'spending'})} className={`py-2 text-xs font-black uppercase rounded-lg ${goalForm.type==='spending'?'bg-white text-orange-600 shadow':'text-slate-400'}`}>Presupuesto (-)</button>
                    </div>
                    <Input label="Nombre del Fondo" placeholder="Ej: Construcción Templo" value={goalForm.label} onChange={e=>setGoalForm({...goalForm, label:e.target.value})}/>
                    <SmartSelect label="Categoría Relacionada" options={categories} value={goalForm.category} onChange={v=>setGoalForm({...goalForm, category:v})}/>
                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2 uppercase font-bold">Monto Objetivo / Límite</p>
                        <Input type="number" value={goalForm.amount} onChange={e=>setGoalForm({...goalForm, amount:e.target.value})} className="text-center text-3xl font-black bg-transparent border-none outline-none text-slate-800"/>
                    </div>
                    {goalForm.type === 'saving' && <Input label="Saldo Inicial (Manual)" type="number" value={goalForm.currentSaved} onChange={e=>setGoalForm({...goalForm, currentSaved:e.target.value})} />}
                    <Button className="w-full" onClick={handleSaveGoal}>Guardar Fondo</Button>
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
