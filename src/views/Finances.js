window.Views = window.Views || {};

window.Views.Finances = ({ finances = [], addData, updateData, userProfile, setActiveTab }) => {
    // --- 1. HOOKS Y UTILIDADES ---
    const { useState, useEffect, useMemo, useRef } = React;
    const Utils = window.Utils || {};
    const { Button, Input, Select, Icon, Card, Badge, Modal, formatCurrency, formatDate, notify } = Utils;

    // --- 2. ESTADOS ---
    const [isLocked, setIsLocked] = useState(true);
    const [pin, setPin] = useState("");
    const [tab, setTab] = useState('overview'); // overview, incomes, expenses, funds, donors
    
    // Formularios y Modales
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showFundModal, setShowFundModal] = useState(false);
    
    // Estado para Ingreso Complejo (Sobres)
    const initialIncome = {
        date: new Date().toISOString().slice(0, 16),
        type: 'Culto', // Culto, Evento, Donación
        concept: 'Culto General',
        looseCash: 0, // Ofrenda Suelta Efectivo
        looseTransfer: 0, // Ofrenda Suelta Transferencia
        envelopes: [], // { name, amount, method, request }
        destinyFund: 'General' // A qué fondo va el dinero
    };
    const [incomeForm, setIncomeForm] = useState(initialIncome);
    
    // Estado para Gasto
    const initialExpense = {
        date: new Date().toISOString().slice(0, 16),
        amount: '',
        concept: '',
        fund: 'General', // De qué fondo sale
        method: 'Efectivo',
        notes: ''
    };
    const [expenseForm, setExpenseForm] = useState(initialExpense);

    // Estado para Configuración de Fondos
    const [fundForm, setFundForm] = useState({ name: '', type: 'positive', target: 0, current: 0 }); // type: positive (ahorro), negative (presupuesto)

    // Filtros CRM
    const [donorFilter, setDonorFilter] = useState('month'); // month, year, all

    // Referencias para Gráficos
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    // --- 3. LÓGICA DE SEGURIDAD ---
    const handleUnlock = () => {
        if (pin === "2367") setIsLocked(false);
        else notify("PIN Incorrecto", "error");
    };

    // --- 4. PROCESAMIENTO DE DATOS (INTELIGENCIA) ---

    // A. Separar Configuración de Movimientos Reales
    const { movements, fundSettings } = useMemo(() => {
        const movs = finances.filter(f => f.type !== 'fund_setting');
        const settings = finances.filter(f => f.type === 'fund_setting');
        
        // Si no hay fondos configurados, crear el General por defecto en memoria
        if (!settings.find(s => s.name === 'General')) {
            settings.push({ id: 'default-gen', name: 'General', type: 'positive', current: 0 });
        }
        return { movements: movs, fundSettings: settings };
    }, [finances]);

    // B. Calcular Totales Globales
    const stats = useMemo(() => {
        const now = new Date();
        let incomeMonth = 0;
        let expenseMonth = 0;
        let totalBalance = 0;
        let cashBalance = 0;
        let bankBalance = 0;

        movements.forEach(m => {
            const amount = parseFloat(m.total || m.amount || 0);
            const isIncome = amount > 0;
            const isThisMonth = new Date(m.date).getMonth() === now.getMonth() && new Date(m.date).getFullYear() === now.getFullYear();

            totalBalance += amount;
            
            // Desglose por método (aproximado para resumen rápido)
            if (m.method === 'Banco' || m.looseTransfer > 0) bankBalance += amount;
            else cashBalance += amount;

            if (isThisMonth) {
                if (isIncome) incomeMonth += amount;
                else expenseMonth += Math.abs(amount);
            }
        });

        return { incomeMonth, expenseMonth, totalBalance, cashBalance, bankBalance, nationalTithe: incomeMonth * 0.10 };
    }, [movements]);

    // C. CRM de Diezmantes (Normalización de Nombres)
    const donors = useMemo(() => {
        const map = {};
        const normalize = (name) => {
            return name.toLowerCase()
                .replace('flia', '')
                .replace('familia', '')
                .replace('.', '')
                .trim();
        };

        const now = new Date();
        
        movements.forEach(mov => {
            if (mov.envelopes && Array.isArray(mov.envelopes)) {
                // Filtro de Tiempo
                const movDate = new Date(mov.date);
                let passFilter = true;
                if (donorFilter === 'month') passFilter = movDate.getMonth() === now.getMonth() && movDate.getFullYear() === now.getFullYear();
                if (donorFilter === 'year') passFilter = movDate.getFullYear() === now.getFullYear();

                if (passFilter) {
                    mov.envelopes.forEach(env => {
                        const rawName = env.name || "Anónimo";
                        const key = normalize(rawName);
                        const amount = parseFloat(env.amount || 0);

                        if (!map[key]) {
                            map[key] = { 
                                displayName: rawName.replace(/\b\w/g, l => l.toUpperCase()), // Capitalizar
                                total: 0, 
                                count: 0, 
                                lastDate: mov.date,
                                requests: [] 
                            };
                        }
                        
                        map[key].total += amount;
                        map[key].count += 1;
                        if (new Date(mov.date) > new Date(map[key].lastDate)) map[key].lastDate = mov.date;
                        if (env.request) map[key].requests.push({ date: mov.date, text: env.request });
                    });
                }
            }
        });

        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [movements, donorFilter]);

    // --- 5. LÓGICA DE FORMULARIOS ---

    const addEnvelope = () => {
        setIncomeForm(prev => ({
            ...prev,
            envelopes: [...prev.envelopes, { id: Date.now(), name: '', amount: '', method: 'Efectivo', request: '' }]
        }));
    };

    const updateEnvelope = (id, field, value) => {
        setIncomeForm(prev => ({
            ...prev,
            envelopes: prev.envelopes.map(e => e.id === id ? { ...e, [field]: value } : e)
        }));
    };

    const removeEnvelope = (id) => {
        setIncomeForm(prev => ({
            ...prev,
            envelopes: prev.envelopes.filter(e => e.id !== id)
        }));
    };

    const calculateIncomeTotal = () => {
        const loose = parseFloat(incomeForm.looseCash || 0) + parseFloat(incomeForm.looseTransfer || 0);
        const envs = incomeForm.envelopes.reduce((sum, env) => sum + parseFloat(env.amount || 0), 0);
        return loose + envs;
    };

    const handleSaveIncome = async () => {
        const total = calculateIncomeTotal();
        if (total <= 0) return notify("El monto debe ser mayor a 0", "error");

        const newMov = {
            ...incomeForm,
            total: total,
            category: 'Ingreso', // Interno para lógica
            createdAt: new Date().toISOString()
        };

        try {
            await addData('finances', newMov);
            notify("Ingreso registrado con éxito");
            setShowIncomeModal(false);
            setIncomeForm(initialIncome);
        } catch (e) {
            console.error(e);
            notify("Error al guardar", "error");
        }
    };

    const handleSaveExpense = async () => {
        if (!expenseForm.amount || !expenseForm.concept) return notify("Faltan datos", "error");
        
        const newMov = {
            ...expenseForm,
            amount: -Math.abs(parseFloat(expenseForm.amount)), // Siempre negativo
            total: -Math.abs(parseFloat(expenseForm.amount)),
            category: 'Gasto',
            type: 'Gasto',
            createdAt: new Date().toISOString()
        };

        try {
            await addData('finances', newMov);
            notify("Gasto registrado");
            setShowExpenseModal(false);
            setExpenseForm(initialExpense);
        } catch (e) { notify("Error al guardar", "error"); }
    };

    const handleSaveFund = async () => {
        if(!fundForm.name) return notify("Nombre requerido", "error");
        try {
            await addData('finances', { ...fundForm, type: 'fund_setting', createdAt: new Date().toISOString() });
            notify("Fondo creado");
            setShowFundModal(false);
        } catch(e) { notify("Error", "error"); }
    };

    const deleteMovement = async (id) => {
        // En DataLogic se usa confirm nativo, aquí lo invocamos
        await window.DataLogic.deleteData('finances', id);
    };

    // --- 6. GRÁFICOS (Chart.js) ---
    useEffect(() => {
        if (tab === 'overview' && chartRef.current && movements.length > 0) {
            if (chartInstance.current) chartInstance.current.destroy();
            
            // Agrupar por mes (últimos 6 meses)
            const months = {};
            const labels = [];
            const dataIncome = [];
            const dataExpense = [];
            
            for(let i=5; i>=0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = `${d.getMonth()+1}/${d.getFullYear()}`;
                months[key] = { inc: 0, exp: 0 };
                labels.push(formatDate(d).slice(3)); // Mostrar solo MM/AAAA
            }

            movements.forEach(m => {
                const d = new Date(m.date);
                const key = `${d.getMonth()+1}/${d.getFullYear()}`;
                if (months[key]) {
                    const val = parseFloat(m.total || 0);
                    if (val > 0) months[key].inc += val;
                    else months[key].exp += Math.abs(val);
                }
            });

            Object.values(months).forEach(v => {
                dataIncome.push(v.inc);
                dataExpense.push(v.exp);
            });

            const ctx = chartRef.current.getContext('2d');
            chartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(months), // Usar keys simples
                    datasets: [
                        { label: 'Ingresos', data: dataIncome, backgroundColor: '#10b981', borderRadius: 4 },
                        { label: 'Gastos', data: dataExpense, backgroundColor: '#f43f5e', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
                }
            });
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [tab, movements]);


    // --- 7. VISTAS RENDERIZADAS ---

    if (isLocked) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-white p-6 animate-enter z-50 fixed inset-0">
                <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-slate-700">
                    <div className="bg-brand-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                        <Icon name="Shield" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Tesorería</h2>
                    <p className="text-slate-400 mb-6 text-sm">Ingresa el PIN de seguridad</p>
                    
                    <div className="flex justify-center gap-2 mb-6">
                        {[1, 2, 3, 4].map((_, i) => (
                            <div key={i} className={`w-4 h-4 rounded-full transition-all ${pin.length > i ? 'bg-brand-500 scale-110' : 'bg-slate-600'}`}></div>
                        ))}
                    </div>

                    <input 
                        type="password" 
                        value={pin} 
                        onChange={(e) => setPin(e.target.value)} 
                        maxLength={4}
                        className="w-full bg-slate-700 border-none text-center text-2xl tracking-[0.5em] font-bold rounded-xl py-4 mb-6 focus:ring-2 focus:ring-brand-500 text-white outline-none"
                        placeholder="••••"
                        autoFocus
                    />
                    
                    <Button onClick={handleUnlock} className="w-full py-4 text-lg shadow-glow">Desbloquear</Button>
                    
                    <button onClick={() => { if(setActiveTab) setActiveTab('dashboard'); else window.location.reload(); }} className="mt-6 text-slate-500 text-sm font-bold hover:text-white transition-colors flex items-center justify-center gap-2">
                        <Icon name="ChevronLeft" size={16}/> Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 animate-enter">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><Icon name="Wallet"/></div>
                    <div>
                        <h1 className="font-bold text-lg text-slate-800 leading-tight">Tesorería</h1>
                        <p className="text-xs text-slate-500 font-medium">Gestión Financiera</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="danger" size="sm" onClick={() => setIsLocked(true)} icon="Shield">Bloquear</Button>
                </div>
            </header>

            {/* Tabs de Navegación */}
            <div className="px-4 pt-4 pb-2 bg-white border-b border-slate-100 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                    {[
                        { id: 'overview', label: 'Resumen', icon: 'List' },
                        { id: 'incomes', label: 'Ingresos', icon: 'ArrowUp' },
                        { id: 'expenses', label: 'Egresos', icon: 'ArrowRight' },
                        { id: 'funds', label: 'Fondos', icon: 'Briefcase' },
                        { id: 'donors', label: 'Diezmantes', icon: 'Users' }
                    ].map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === t.id ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Icon name={t.icon} size={16}/> {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                
                {/* --- VISTA RESUMEN --- */}
                {tab === 'overview' && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                        {/* Tarjetas Superiores */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-slate-900 text-white border-none shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="Wallet" size={80}/></div>
                                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Balance Total</h3>
                                <p className="text-3xl font-black">{formatCurrency(stats.totalBalance)}</p>
                                <div className="mt-4 flex gap-4 text-xs font-medium text-slate-300">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Efec: {formatCurrency(stats.cashBalance)}</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Bco: {formatCurrency(stats.bankBalance)}</span>
                                </div>
                            </Card>

                            <Card className="bg-white border-l-4 border-l-emerald-500">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-slate-500 text-xs font-bold uppercase">Ingresos (Mes)</h3>
                                        <p className="text-2xl font-bold text-emerald-600 mt-1">+{formatCurrency(stats.incomeMonth)}</p>
                                    </div>
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Icon name="ArrowUp"/></div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500">Diezmo Nacional (10%)</span>
                                    <Badge type="warning">{formatCurrency(stats.nationalTithe)}</Badge>
                                </div>
                            </Card>

                            <Card className="bg-white border-l-4 border-l-rose-500">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-slate-500 text-xs font-bold uppercase">Gastos (Mes)</h3>
                                        <p className="text-2xl font-bold text-rose-600 mt-1">-{formatCurrency(stats.expenseMonth)}</p>
                                    </div>
                                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><Icon name="ArrowRight"/></div>
                                </div>
                                <div className="mt-3 text-xs text-slate-400 font-medium">
                                    Controla tus fondos de presupuesto.
                                </div>
                            </Card>
                        </div>

                        {/* Gráfico */}
                        <Card>
                            <h3 className="font-bold text-slate-800 mb-4">Flujo de Caja (6 Meses)</h3>
                            <div className="h-64">
                                <canvas ref={chartRef}></canvas>
                            </div>
                        </Card>

                        {/* Movimientos Recientes */}
                        <div>
                            <h3 className="font-bold text-slate-800 mb-3 text-lg">Últimos Movimientos</h3>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {movements.slice(0, 5).map(m => (
                                    <div key={m.id} className="p-4 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${m.total > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                <Icon name={m.total > 0 ? 'ArrowUp' : 'ArrowRight'} size={18}/>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{m.concept || m.type}</p>
                                                <p className="text-xs text-slate-500">{formatDate(m.date, 'full')} • {m.fund || m.destinyFund || 'General'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${m.total > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{m.total > 0 ? '+' : ''}{formatCurrency(m.total)}</p>
                                            <button onClick={() => deleteMovement(m.id)} className="text-xs text-red-300 hover:text-red-500 ml-2 mt-1"><Icon name="Trash" size={12}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


                {/* --- VISTA INGRESOS --- */}
                {tab === 'incomes' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">Historial de Ingresos</h2>
                            <Button icon="Plus" onClick={() => setShowIncomeModal(true)} className="shadow-lg shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700">Nuevo Ingreso</Button>
                        </div>
                        <div className="space-y-3">
                            {movements.filter(m => parseFloat(m.total) > 0).map(m => (
                                <Card key={m.id} className="hover:border-emerald-200 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl h-fit"><Icon name="ArrowUp" size={24}/></div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">{m.concept}</h3>
                                                <p className="text-sm text-slate-500 font-medium mb-2">{formatDate(m.date, 'full')} • {m.type}</p>
                                                
                                                {/* Desglose Rápido */}
                                                <div className="flex gap-2 text-xs">
                                                    {(m.looseCash > 0 || m.looseTransfer > 0) && <Badge>Ofrenda: {formatCurrency((parseFloat(m.looseCash)||0) + (parseFloat(m.looseTransfer)||0))}</Badge>}
                                                    {m.envelopes?.length > 0 && <Badge type="brand">Sobres: {m.envelopes.length}</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xl font-black text-emerald-600">+{formatCurrency(m.total)}</span>
                                            <button onClick={() => deleteMovement(m.id)} className="text-slate-400 hover:text-red-500 mt-2 p-1"><Icon name="Trash" size={16}/></button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- VISTA EGRESOS --- */}
                {tab === 'expenses' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">Historial de Gastos</h2>
                            <Button icon="ArrowRight" onClick={() => setShowExpenseModal(true)} className="shadow-lg shadow-rose-200 bg-rose-600 hover:bg-rose-700">Registrar Gasto</Button>
                        </div>
                        <div className="space-y-3">
                            {movements.filter(m => parseFloat(m.total) < 0).map(m => (
                                <Card key={m.id} className="hover:border-rose-200 transition-colors">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-4 items-center">
                                            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl"><Icon name="ShoppingBag" size={24}/></div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">{m.concept}</h3>
                                                <p className="text-sm text-slate-500 font-medium">{formatDate(m.date, 'full')} • {m.fund}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xl font-black text-rose-600">{formatCurrency(m.total)}</span>
                                            <button onClick={() => deleteMovement(m.id)} className="text-slate-400 hover:text-red-500 mt-2 p-1"><Icon name="Trash" size={16}/></button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- VISTA FONDOS --- */}
                {tab === 'funds' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">Fondos & Presupuestos</h2>
                            <Button icon="Plus" onClick={() => setShowFundModal(true)}>Nuevo Fondo</Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Fondos de Ahorro */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Ahorros / Acumulación</h3>
                                {fundSettings.filter(f => f.type === 'positive').map(fund => (
                                    <Card key={fund.id} className="bg-white border-l-4 border-l-brand-500">
                                        <div className="flex justify-between mb-2">
                                            <h4 className="font-bold text-slate-800">{fund.name}</h4>
                                            <span className="font-bold text-brand-600">{formatCurrency(fund.current || 0)}</span>
                                        </div>
                                        {/* Barra de progreso simulada basada en movimientos reales vs meta */}
                                        <div className="w-full bg-slate-100 rounded-full h-2">
                                            <div className="bg-brand-500 h-2 rounded-full" style={{width: `${Math.min(((fund.current||0)/(fund.target||1))*100, 100)}%`}}></div>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">Meta: {formatCurrency(fund.target || 0)}</p>
                                    </Card>
                                ))}
                            </div>

                            {/* Fondos de Presupuesto */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Presupuestos / Límites</h3>
                                {fundSettings.filter(f => f.type === 'negative').map(fund => (
                                    <Card key={fund.id} className="bg-white border-l-4 border-l-rose-500">
                                        <div className="flex justify-between mb-2">
                                            <h4 className="font-bold text-slate-800">{fund.name}</h4>
                                            {/* Aquí deberíamos calcular cuánto se ha gastado de este fondo */}
                                            <span className="font-bold text-rose-600">{formatCurrency(fund.target || 0)}</span>
                                        </div>
                                        <p className="text-xs text-slate-500">Límite mensual asignado.</p>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- VISTA DIEZMANTES (CRM) --- */}
                {tab === 'donors' && (
                    <div className="max-w-5xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <h2 className="text-2xl font-bold text-slate-800">Inteligencia de Diezmantes</h2>
                            <div className="flex bg-white p-1 rounded-lg border shadow-sm">
                                {[{id:'month',l:'Este Mes'},{id:'year',l:'Este Año'},{id:'all',l:'Histórico'}].map(f => (
                                    <button key={f.id} onClick={()=>setDonorFilter(f.id)} className={`px-4 py-1.5 text-sm font-bold rounded-md ${donorFilter===f.id?'bg-slate-800 text-white':'text-slate-500'}`}>{f.l}</button>
                                ))}
                            </div>
                        </div>

                        {/* Indicador KPI */}
                        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-brand-600 text-white border-none">
                                <h3 className="opacity-80 text-sm font-bold">Total Familias Activas</h3>
                                <p className="text-4xl font-black mt-2">{donors.length}</p>
                            </Card>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                                    <tr>
                                        <th className="p-4">Familia / Diezmante</th>
                                        <th className="p-4">Frecuencia</th>
                                        <th className="p-4">Última Vez</th>
                                        <th className="p-4 text-right">Total Aportado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {donors.map((d, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{d.displayName}</div>
                                                {d.requests.length > 0 && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs italic">"{d.requests[d.requests.length-1].text}"</div>}
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                <Badge type={d.count > 2 ? 'success' : 'default'}>{d.count} veces</Badge>
                                            </td>
                                            <td className="p-4 text-sm text-slate-500">{formatDate(d.lastDate)}</td>
                                            <td className="p-4 text-right font-bold text-emerald-600">{formatCurrency(d.total)}</td>
                                        </tr>
                                    ))}
                                    {donors.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">No hay datos para este periodo.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {/* --- MODAL INGRESO (CEREBRO DE TESORERÍA) --- */}
            <Modal isOpen={showIncomeModal} onClose={() => setShowIncomeModal(false)} title="Registrar Ingreso">
                <div className="space-y-6">
                    {/* 1. Datos Generales */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="datetime-local" label="Fecha" value={incomeForm.date} onChange={e => setIncomeForm({...incomeForm, date: e.target.value})} />
                        <Select label="Fondo Destino" value={incomeForm.destinyFund} onChange={e => setIncomeForm({...incomeForm, destinyFund: e.target.value})}>
                            {fundSettings.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Tipo" value={incomeForm.type} onChange={e => setIncomeForm({...incomeForm, type: e.target.value})}>
                            <option value="Culto">Culto</option>
                            <option value="Evento">Evento</option>
                            <option value="Donación">Donación</option>
                        </Select>
                        <Input label="Concepto" placeholder="Ej: Culto Domingo Noche" value={incomeForm.concept} onChange={e => setIncomeForm({...incomeForm, concept: e.target.value})} />
                    </div>

                    {/* 2. Ofrendas Sueltas */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Icon name="List" size={16}/> Ofrendas Sueltas (Anónimo)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input type="number" label="Efectivo" placeholder="$0" value={incomeForm.looseCash} onChange={e => setIncomeForm({...incomeForm, looseCash: e.target.value})} />
                            <Input type="number" label="Transferencia" placeholder="$0" value={incomeForm.looseTransfer} onChange={e => setIncomeForm({...incomeForm, looseTransfer: e.target.value})} />
                        </div>
                    </div>

                    {/* 3. Sobres Detallados */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2"><Icon name="Users" size={16}/> Sobres / Diezmos</h4>
                            <Button size="sm" variant="secondary" onClick={addEnvelope} icon="Plus">Agregar Sobre</Button>
                        </div>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {incomeForm.envelopes.map((env, idx) => (
                                <div key={env.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-enter relative group">
                                    <div className="grid grid-cols-12 gap-2 mb-2">
                                        <div className="col-span-5"><Input placeholder="Familia / Nombre" value={env.name} onChange={e => updateEnvelope(env.id, 'name', e.target.value)} className="py-2 text-sm"/></div>
                                        <div className="col-span-4"><Input type="number" placeholder="$ Monto" value={env.amount} onChange={e => updateEnvelope(env.id, 'amount', e.target.value)} className="py-2 text-sm font-bold text-emerald-600"/></div>
                                        <div className="col-span-3">
                                            <select className="w-full bg-slate-50 border rounded-lg p-2 text-xs" value={env.method} onChange={e => updateEnvelope(env.id, 'method', e.target.value)}>
                                                <option>Efectivo</option>
                                                <option>Banco</option>
                                            </select>
                                        </div>
                                    </div>
                                    <Input placeholder="Petición de oración..." value={env.request} onChange={e => updateEnvelope(env.id, 'request', e.target.value)} className="py-2 text-xs bg-slate-50"/>
                                    <button onClick={() => removeEnvelope(env.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="X" size={12}/></button>
                                </div>
                            ))}
                            {incomeForm.envelopes.length === 0 && <div className="text-center text-slate-400 text-sm py-4 italic border-2 border-dashed rounded-xl">No hay sobres cargados aún.</div>}
                        </div>
                    </div>

                    {/* Totalizador */}
                    <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                        <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Total Final</span>
                        <span className="text-2xl font-black text-emerald-400">{formatCurrency(calculateIncomeTotal())}</span>
                    </div>

                    <Button className="w-full py-3 text-lg shadow-xl shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveIncome}>Guardar Ingreso</Button>
                </div>
            </Modal>

            {/* --- MODAL GASTO --- */}
            <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Registrar Gasto">
                <div className="space-y-4">
                    <Input type="number" label="Monto" placeholder="$0.00" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="text-xl font-bold text-rose-600"/>
                    <Input label="Concepto / Detalle" placeholder="Ej: Pago de Luz" value={expenseForm.concept} onChange={e => setExpenseForm({...expenseForm, concept: e.target.value})} />
                    
                    <div className="grid grid-cols-2 gap-4">
                         <Select label="Sale del Fondo" value={expenseForm.fund} onChange={e => setExpenseForm({...expenseForm, fund: e.target.value})}>
                            {fundSettings.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                        </Select>
                        <Select label="Método Pago" value={expenseForm.method} onChange={e => setExpenseForm({...expenseForm, method: e.target.value})}>
                            <option>Efectivo</option>
                            <option>Banco / Transferencia</option>
                            <option>Tarjeta</option>
                        </Select>
                    </div>
                    
                    <Input type="datetime-local" label="Fecha" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
                    
                    <Button className="w-full bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-200" onClick={handleSaveExpense}>Registrar Salida</Button>
                </div>
            </Modal>

            {/* --- MODAL NUEVO FONDO --- */}
            <Modal isOpen={showFundModal} onClose={() => setShowFundModal(false)} title="Configurar Fondo">
                <div className="space-y-4">
                    <Input label="Nombre del Fondo" placeholder="Ej: Pro-Templo" value={fundForm.name} onChange={e => setFundForm({...fundForm, name: e.target.value})} />
                    <Select label="Tipo de Fondo" value={fundForm.type} onChange={e => setFundForm({...fundForm, type: e.target.value})}>
                        <option value="positive">Ahorro / Acumulación (Quiero juntar dinero)</option>
                        <option value="negative">Presupuesto / Gasto (Límite para gastar)</option>
                    </Select>
                    <Input type="number" label={fundForm.type === 'positive' ? "Meta Objetivo ($)" : "Límite Mensual ($)"} value={fundForm.target} onChange={e => setFundForm({...fundForm, target: e.target.value})} />
                    <Button className="w-full" onClick={handleSaveFund}>Crear Fondo</Button>
                </div>
            </Modal>

        </div>
    );
};
