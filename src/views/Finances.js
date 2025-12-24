window.Views = window.Views || {};

window.Views.Finances = ({ finances = [], addData, updateData, deleteData, userProfile, setActiveTab }) => {
    const { useState, useMemo, useEffect, useRef } = React;
    const Utils = window.Utils || {};
    const { Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, Card, Badge, notify } = Utils;

    // --- ESTADOS ---
    // Navegación y Seguridad
    const [pin, setPin] = useState('');
    const [isLocked, setIsLocked] = useState(true);
    const [tab, setTab] = useState('dashboard'); // dashboard, list, tithers, funds
    
    // Filtros
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    // Modales y Formularios
    const [modalMode, setModalMode] = useState(null); // 'transaction', 'culto', 'fund'
    const [editingId, setEditingId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Estado para "Sobres/Fondos" (Persistente en LocalStorage para config, cálculos en vivo)
    const [fundsConfig, setFundsConfig] = useState(() => JSON.parse(localStorage.getItem('finance_funds_config')) || []);

    // Formularios
    const initialForm = { type: 'Ingreso', category: 'General', amount: '', method: 'Efectivo', notes: '', date: Utils.getLocalDate(), fundId: '', isRecurring: false };
    const [form, setForm] = useState(initialForm);

    const initialCulto = { date: Utils.getLocalDate(), offeringsCash: '', offeringsTransfer: '', tithesDetails: [] }; // tithesDetails: [{name, amount, method, prayer}]
    const [cultoForm, setCultoForm] = useState(initialCulto);
    
    // Auxiliares para carga de culto
    const [titherInput, setTitherInput] = useState({ name: '', amount: '', method: 'Efectivo', prayer: '' });

    // Formulario Fondos
    const [fundForm, setFundForm] = useState({ id: null, name: '', type: 'saving', target: '' }); // type: saving (acumular), limit (gasto max)

    // --- LÓGICA DE SEGURIDAD ---
    useEffect(() => {
        if (pin === '2367') { setIsLocked(false); setPin(''); }
        if (pin.length === 4 && pin !== '2367') { notify('PIN Incorrecto', 'error'); setPin(''); }
    }, [pin]);

    // --- CÁLCULOS Y MEMORIZACIÓN (El Cerebro) ---
    
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    // 1. Filtrar datos por Mes seleccionado
    const monthlyData = useMemo(() => {
        const m = currentDate.toISOString().slice(0, 7); // YYYY-MM
        return finances.filter(f => f.date && f.date.startsWith(m)).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate]);

    // 2. Balances Globales (Efectivo vs Banco vs Total)
    const balances = useMemo(() => {
        let cash = 0, bank = 0, income = 0, expense = 0;
        
        finances.forEach(f => {
            const val = safeNum(f.total || f.amount);
            
            // Lógica para detectar método en Cultos complejos
            if (f.type === 'Culto') {
                // Sumar ofrendas
                const offCash = safeNum(f.offeringsCash);
                const offBank = safeNum(f.offeringsTransfer);
                cash += offCash; bank += offBank;
                
                // Sumar diezmos detallados
                if (f.tithesDetails && Array.isArray(f.tithesDetails)) {
                    f.tithesDetails.forEach(t => {
                        const tVal = safeNum(t.amount);
                        if (t.method === 'Banco') bank += tVal; else cash += tVal;
                    });
                } else {
                    // Fallback para datos viejos
                    cash += safeNum(f.tithesCash);
                    bank += safeNum(f.tithesTransfer);
                }
                income += val;
            } else {
                // Ingresos/Gastos normales
                if (val > 0) income += val; else expense += Math.abs(val);
                
                if (f.method === 'Banco') bank += val; else cash += val;
            }
        });

        return { cash, bank, total: cash + bank, income, expense };
    }, [finances]);

    // 3. Totales del Mes Actual
    const monthStats = useMemo(() => {
        let inc = 0, exp = 0;
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            if (val > 0) inc += val; else exp += Math.abs(val);
        });
        return { income: inc, expense: exp, net: inc - exp, titheToAssembly: inc * 0.10 };
    }, [monthlyData]);

    // 4. Lógica de Diezmantes (Fuzzy Match & Agrupación)
    const tithersStats = useMemo(() => {
        const map = {};
        const normalize = (s) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("familia", "").replace("flia", "").trim() : "anonimo";

        finances.forEach(f => {
            if (f.type === 'Culto' && f.tithesDetails && Array.isArray(f.tithesDetails)) {
                f.tithesDetails.forEach(t => {
                    const key = normalize(t.name);
                    if (!map[key]) map[key] = { id: key, display: t.name, total: 0, count: 0, lastDate: f.date };
                    map[key].total += safeNum(t.amount);
                    map[key].count += 1;
                    if (f.date > map[key].lastDate) map[key].lastDate = f.date;
                    // Mantener el nombre más largo/completo como display
                    if (t.name.length > map[key].display.length) map[key].display = t.name;
                });
            }
        });
        return Object.values(map).sort((a,b) => b.total - a.total);
    }, [finances]);

    const tithersThisMonth = useMemo(() => {
        const m = currentDate.toISOString().slice(0, 7);
        let count = 0;
        const processed = new Set();
        monthlyData.forEach(f => {
            if(f.type === 'Culto' && f.tithesDetails) {
                f.tithesDetails.forEach(t => {
                    const name = t.name.toLowerCase().trim();
                    if(!processed.has(name)) { count++; processed.add(name); }
                });
            }
        });
        return count;
    }, [monthlyData]);

    // 5. Lógica de Fondos (Virtual Envelopes)
    const fundsStatus = useMemo(() => {
        return fundsConfig.map(fund => {
            let current = 0;
            // Sumar movimientos asignados a este fondo
            finances.forEach(f => {
                if (f.fundId === fund.id) {
                    current += Math.abs(safeNum(f.amount || f.total)); // Sumamos asignaciones
                }
                // También podríamos restar si se gasta DEL fondo, pero por ahora simplifiquemos:
                // Si es gasto y tiene fundId, resta al fondo? 
                // Asumiremos: Ingreso con fundId -> Suma al fondo. Gasto con fundId -> Resta del fondo.
                 if (f.fundId === fund.id) {
                    // Recalcular correctamente
                    // Si el movimiento original era positivo (ingreso), suma al fondo.
                    // Si era negativo (gasto), resta.
                    // PERO, safeNum ya trae el signo.
                    // current += safeNum(f.amount || f.total);  <-- Esto seria si asignamos directamete
                }
            });
            
            // Lógica simple solicitada: "Destinar plata". 
            // Vamos a calcular saldo basado en transacciones que explícitamente muevan a este fondo
            const balance = finances.reduce((acc, f) => f.fundId === fund.id ? acc + safeNum(f.amount || f.total) : acc, 0);

            // Si es tipo 'limit' (Presupuesto), el cálculo es cuánto se ha gastado.
            let spent = 0;
            if (fund.type === 'limit') {
                spent = finances.reduce((acc, f) => (f.fundId === fund.id && safeNum(f.total||f.amount) < 0) ? acc + Math.abs(safeNum(f.total||f.amount)) : acc, 0);
                return { ...fund, current: spent, isLimit: true };
            }

            return { ...fund, current: balance, isLimit: false };
        });
    }, [finances, fundsConfig]);


    // --- ACCIONES ---

    const handleSaveTransaction = async () => {
        if (!form.amount || parseFloat(form.amount) === 0) return notify("El monto es obligatorio", "error");
        
        const data = {
            ...form,
            amount: form.type === 'Gasto' ? -Math.abs(form.amount) : Math.abs(form.amount),
            total: form.type === 'Gasto' ? -Math.abs(form.amount) : Math.abs(form.amount),
            updatedAt: new Date().toISOString()
        };

        try {
            if (editingId) await updateData('finances', editingId, data);
            else await addData('finances', { ...data, createdAt: new Date().toISOString() });
            
            setModalMode(null);
            setForm(initialForm);
            setEditingId(null);
            notify("Movimiento registrado");
        } catch (e) { notify("Error al guardar", "error"); }
    };

    const handleSaveCulto = async () => {
        // Calcular totales finales
        const offCash = safeNum(cultoForm.offeringsCash);
        const offBank = safeNum(cultoForm.offeringsTransfer);
        const tithesTotal = cultoForm.tithesDetails.reduce((acc, t) => acc + safeNum(t.amount), 0);
        const total = offCash + offBank + tithesTotal;

        if (total === 0) return notify("El culto no puede estar en cero", "error");

        const data = {
            type: 'Culto',
            date: cultoForm.date,
            category: 'Culto General',
            offeringsCash: offCash,
            offeringsTransfer: offBank,
            tithesDetails: cultoForm.tithesDetails,
            total: total,
            updatedAt: new Date().toISOString()
        };

        try {
            if (editingId) await updateData('finances', editingId, data);
            else await addData('finances', { ...data, createdAt: new Date().toISOString() });
            
            setModalMode(null);
            setCultoForm(initialCulto);
            setEditingId(null);
            notify("Culto registrado exitosamente");
        } catch (e) { notify("Error al guardar culto", "error"); }
    };

    const addTitherToCulto = () => {
        if (!titherInput.name || !titherInput.amount) return notify("Nombre y monto requeridos", "error");
        setCultoForm(prev => ({
            ...prev,
            tithesDetails: [...prev.tithesDetails, { ...titherInput, id: Date.now() }]
        }));
        setTitherInput({ name: '', amount: '', method: 'Efectivo', prayer: '' });
    };

    const removeTither = (id) => {
        setCultoForm(prev => ({ ...prev, tithesDetails: prev.tithesDetails.filter(t => t.id !== id) }));
    };

    const handleDelete = async (id) => {
        try {
            await deleteData('finances', id);
            notify("Eliminado correctamente");
        } catch (e) { notify("Error al eliminar", "error"); }
    };

    const prepareEdit = (item) => {
        setEditingId(item.id);
        if (item.type === 'Culto') {
            setCultoForm({
                date: item.date,
                offeringsCash: item.offeringsCash || '',
                offeringsTransfer: item.offeringsTransfer || '',
                tithesDetails: item.tithesDetails || []
            });
            setModalMode('culto');
        } else {
            setForm({
                type: item.amount < 0 ? 'Gasto' : 'Ingreso',
                category: item.category,
                amount: Math.abs(item.amount),
                method: item.method,
                notes: item.notes,
                date: item.date,
                fundId: item.fundId || '',
                isRecurring: item.isRecurring || false
            });
            setModalMode('transaction');
        }
    };

    // Gestión de Fondos (LocalStorage)
    const saveFund = () => {
        if (!fundForm.name) return notify("Nombre requerido", "error");
        let newFunds;
        if (fundForm.id) {
            newFunds = fundsConfig.map(f => f.id === fundForm.id ? fundForm : f);
        } else {
            newFunds = [...fundsConfig, { ...fundForm, id: Date.now().toString() }];
        }
        setFundsConfig(newFunds);
        localStorage.setItem('finance_funds_config', JSON.stringify(newFunds));
        setModalMode(null);
        notify("Fondo guardado");
    };

    const deleteFund = (id) => {
        if(!confirm("¿Borrar este fondo?")) return;
        const newFunds = fundsConfig.filter(f => f.id !== id);
        setFundsConfig(newFunds);
        localStorage.setItem('finance_funds_config', JSON.stringify(newFunds));
    };

    // --- VISTAS RENDER ---

    if (isLocked) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl w-full max-w-sm text-center border border-white/10">
                    <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow text-white"><Icon name="Shield" size={32}/></div>
                    <h2 className="text-2xl font-bold text-white mb-2">Tesorería Bloqueada</h2>
                    <p className="text-slate-400 text-sm mb-6">Ingresa el PIN de acceso</p>
                    <div className="flex justify-center gap-4 mb-8">
                        {[0,1,2,3].map(i => <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < pin.length ? 'bg-brand-500 scale-125' : 'bg-white/20'}`}></div>)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={()=>setPin(p=>p.length<4?p+n:p)} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl transition-colors">{n}</button>)}
                        <div/>
                        <button onClick={()=>setPin(p=>p.length<4?p+'0':p)} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl transition-colors">0</button>
                        <button onClick={()=>setPin(p=>p.slice(0,-1))} className="h-14 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center"><Icon name="X"/></button>
                    </div>
                    <button onClick={() => setActiveTab('dashboard')} className="text-slate-400 text-sm hover:text-white font-medium flex items-center justify-center gap-2 w-full py-2">
                        <Icon name="ArrowRight" className="rotate-180" size={16}/> Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tesorería</h1>
                    <p className="text-slate-500 font-medium">Gestión financiera integral</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                    <Button variant="secondary" onClick={() => setIsLocked(true)} icon="Shield" size="sm">Bloquear</Button>
                </div>
            </div>

            {/* Navegación Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1 hide-scroll">
                {[
                    {id: 'dashboard', label: 'Resumen', icon: 'BarChart'},
                    {id: 'list', label: 'Movimientos', icon: 'List'},
                    {id: 'tithers', label: 'Diezmantes', icon: 'Users'},
                    {id: 'funds', label: 'Sobres/Fondos', icon: 'Briefcase'}
                ].map(t => (
                    <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${tab===t.id ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                        <Icon name={t.icon} size={18}/> {t.label}
                    </button>
                ))}
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 overflow-y-auto">
                
                {/* 1. DASHBOARD */}
                {tab === 'dashboard' && (
                    <div className="space-y-6 animate-enter">
                        {/* Balance Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <div className="relative z-10">
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Balance Global Disponible</p>
                                    <h2 className="text-5xl font-black mb-6 tracking-tight">{formatCurrency(balances.total)}</h2>
                                    <div className="flex gap-6">
                                        <div>
                                            <span className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase mb-1"><Icon name="DollarSign" size={14}/> Efectivo</span>
                                            <p className="text-xl font-bold">{formatCurrency(balances.cash)}</p>
                                        </div>
                                        <div>
                                            <span className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-1"><Icon name="CreditCard" size={14}/> Banco</span>
                                            <p className="text-xl font-bold">{formatCurrency(balances.bank)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-soft flex flex-col justify-center">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Icon name="Award" className="text-amber-500"/> Diezmo a la Asamblea</h3>
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center mb-2">
                                    <p className="text-xs text-amber-700 font-bold uppercase mb-1">El 10% de Ingresos del Mes</p>
                                    <p className="text-3xl font-black text-amber-600">{formatCurrency(monthStats.titheToAssembly)}</p>
                                </div>
                                <p className="text-center text-xs text-slate-400">Basado en ingresos: {formatCurrency(monthStats.income)}</p>
                            </div>
                        </div>

                        {/* Estadísticas Mensuales */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Ingresos (Mes)</p>
                                <p className="text-2xl font-black text-emerald-600">{formatCurrency(monthStats.income)}</p>
                            </Card>
                            <Card className="text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Gastos (Mes)</p>
                                <p className="text-2xl font-black text-red-500">{formatCurrency(monthStats.expense)}</p>
                            </Card>
                            <Card className="text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Neto (Mes)</p>
                                <p className={`text-2xl font-black ${monthStats.net >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{formatCurrency(monthStats.net)}</p>
                            </Card>
                            <Card className="text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Familias Diezmantes</p>
                                <p className="text-2xl font-black text-brand-600">{tithersThisMonth}</p>
                            </Card>
                        </div>
                    </div>
                )}

                {/* 2. LISTA DE MOVIMIENTOS */}
                {tab === 'list' && (
                    <div className="animate-enter">
                        <div className="flex justify-between items-center mb-4">
                            <Input placeholder="Buscar movimiento..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="max-w-xs" />
                            <div className="flex gap-2">
                                <Button onClick={() => { setModalMode('transaction'); setEditingId(null); setForm(initialForm); }} icon="Plus">Movimiento</Button>
                                <Button onClick={() => { setModalMode('culto'); setEditingId(null); setCultoForm(initialCulto); }} icon="Home" variant="secondary">Cargar Culto</Button>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                            {monthlyData.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">No hay movimientos en este mes.</div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {monthlyData.filter(f => f.category?.toLowerCase().includes(searchTerm.toLowerCase()) || f.notes?.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                                        const isIncome = safeNum(item.total||item.amount) > 0;
                                        return (
                                            <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${item.type==='Culto' ? 'bg-brand-100 text-brand-600' : (isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500')}`}>
                                                        <Icon name={item.type==='Culto'?'Home':(isIncome?'ArrowUp':'ArrowRight')} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{item.type==='Culto' ? 'Culto General' : item.category}</h4>
                                                        <p className="text-xs text-slate-500 flex items-center gap-2">
                                                            {formatDate(item.date)} • {item.method || 'Mixto'} 
                                                            {item.fundId && <Badge type="brand">Fondo Asignado</Badge>}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-4">
                                                    <div>
                                                        <p className={`font-bold font-mono ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(item.total || item.amount)}</p>
                                                        {item.type==='Culto' && <p className="text-[10px] text-slate-400">Ofrendas + Diezmos</p>}
                                                    </div>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={()=>prepareEdit(item)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><Icon name="Edit" size={16}/></button>
                                                        <button onClick={()=>handleDelete(item.id)} className="p-2 hover:bg-red-100 rounded-lg text-red-500"><Icon name="Trash" size={16}/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. DIEZMANTES */}
                {tab === 'tithers' && (
                    <div className="animate-enter space-y-6">
                        <Card>
                            <h3 className="font-bold text-lg mb-4 text-slate-800">Historial de Fidelidad</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                                            <th className="py-3 pl-4 font-bold">Familia / Persona</th>
                                            <th className="py-3 font-bold text-center">Frecuencia</th>
                                            <th className="py-3 font-bold text-right">Último Aporte</th>
                                            <th className="py-3 pr-4 font-bold text-right">Total Acumulado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {tithersStats.map(t => (
                                            <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="py-3 pl-4 font-bold text-slate-700 capitalize">{t.display}</td>
                                                <td className="py-3 text-center"><Badge>{t.count} veces</Badge></td>
                                                <td className="py-3 text-right text-slate-500">{formatDate(t.lastDate)}</td>
                                                <td className="py-3 pr-4 text-right font-mono font-bold text-emerald-600">{formatCurrency(t.total)}</td>
                                            </tr>
                                        ))}
                                        {tithersStats.length === 0 && <tr><td colSpan="4" className="py-8 text-center text-slate-400">No hay registros de diezmos detallados aún.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {/* 4. SOBRES / FONDOS */}
                {tab === 'funds' && (
                    <div className="animate-enter">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-slate-800">Sobres y Presupuestos</h3>
                            <Button size="sm" icon="Plus" onClick={()=>{setFundForm({id:null, name:'', type:'saving', target:''}); setModalMode('fund')}}>Crear Fondo</Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fundsStatus.map(f => (
                                <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all group relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-3 rounded-xl ${f.type==='saving' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                                                <Icon name={f.type==='saving'?'Briefcase':'AlertCircle'} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{f.name}</h4>
                                                <p className="text-xs text-slate-500 uppercase font-bold">{f.type==='saving'?'Acumulativo':'Límite de Gasto'}</p>
                                            </div>
                                        </div>
                                        <button onClick={()=>deleteFund(f.id)} className="text-slate-300 hover:text-red-500"><Icon name="Trash" size={16}/></button>
                                    </div>
                                    
                                    <div className="mb-2">
                                        <p className="text-2xl font-black text-slate-800">{formatCurrency(f.current)}</p>
                                        {f.target && <p className="text-xs text-slate-400">Meta: {formatCurrency(f.target)}</p>}
                                    </div>
                                    
                                    {f.target && (
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${f.type==='saving'?'bg-indigo-500':'bg-orange-500'}`} style={{width: `${Math.min((f.current/f.target)*100, 100)}%`}}></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* --- MODALES --- */}

            {/* MODAL TRANSACCIÓN (Ingreso/Gasto) */}
            <Modal isOpen={modalMode === 'transaction'} onClose={()=>setModalMode(null)} title={editingId ? "Editar Movimiento" : "Nuevo Movimiento"}>
                <div className="space-y-4">
                    <div className="bg-slate-100 p-1 rounded-xl flex">
                        {['Ingreso','Gasto'].map(t => (
                            <button key={t} onClick={()=>setForm({...form, type:t})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.type===t ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}>{t}</button>
                        ))}
                    </div>
                    <Input label="Fecha" type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
                    <Input label="Monto" type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="font-mono text-lg font-bold" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Categoría" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
                            <option>General</option><option>Alquiler</option><option>Servicios</option><option>Mantenimiento</option><option>Ayuda Social</option><option>Ofrenda Misionera</option><option>Ministerios</option><option>Honorarios</option><option>Varios</option>
                        </Select>
                        <Select label="Método" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}>
                            <option>Efectivo</option><option>Banco</option>
                        </Select>
                    </div>
                    <div className="bg-brand-50 p-4 rounded-xl border border-brand-100">
                        <label className="text-xs font-bold text-brand-700 uppercase mb-2 block">Asignar a Fondo/Sobre (Opcional)</label>
                        <select className="w-full bg-white border border-brand-200 rounded-lg p-2 text-sm" value={form.fundId} onChange={e=>setForm({...form, fundId:e.target.value})}>
                            <option value="">-- Ninguno --</option>
                            {fundsConfig.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <p className="text-[10px] text-brand-600 mt-1">Si seleccionas uno, el dinero se sumará/restará virtualmente a este sobre.</p>
                    </div>
                    <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} />
                    <Button onClick={handleSaveTransaction} className="w-full mt-4">Guardar</Button>
                </div>
            </Modal>

            {/* MODAL CULTO COMPLETO */}
            <Modal isOpen={modalMode === 'culto'} onClose={()=>setModalMode(null)} title="Registro de Culto">
                <div className="space-y-6">
                    <Input type="date" value={cultoForm.date} onChange={e=>setCultoForm({...cultoForm, date:e.target.value})} />
                    
                    {/* Sección 1: Ofrendas */}
                    <Card className="bg-slate-50 border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Icon name="DollarSign" size={16}/> Ofrendas Generales</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Efectivo" type="number" placeholder="0" value={cultoForm.offeringsCash} onChange={e=>setCultoForm({...cultoForm, offeringsCash:e.target.value})} />
                            <Input label="Transferencia" type="number" placeholder="0" value={cultoForm.offeringsTransfer} onChange={e=>setCultoForm({...cultoForm, offeringsTransfer:e.target.value})} />
                        </div>
                    </Card>

                    {/* Sección 2: Diezmos Detallados */}
                    <Card className="bg-indigo-50 border-indigo-100">
                        <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><Icon name="Users" size={16}/> Detalle de Diezmos</h4>
                        
                        {/* Input para agregar */}
                        <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm mb-4 space-y-3">
                            <Input placeholder="Nombre Familia / Persona" value={titherInput.name} onChange={e=>setTitherInput({...titherInput, name:e.target.value})} />
                            <div className="flex gap-2">
                                <Input type="number" placeholder="Monto" value={titherInput.amount} onChange={e=>setTitherInput({...titherInput, amount:e.target.value})} className="flex-1" />
                                <select className="bg-slate-100 rounded-xl px-3 text-sm font-bold text-slate-600 outline-none" value={titherInput.method} onChange={e=>setTitherInput({...titherInput, method:e.target.value})}>
                                    <option>Efectivo</option><option>Banco</option>
                                </select>
                            </div>
                            <Input placeholder="Pedido de Oración (Opcional)" value={titherInput.prayer} onChange={e=>setTitherInput({...titherInput, prayer:e.target.value})} />
                            <Button onClick={addTitherToCulto} size="sm" variant="secondary" className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50">Agregar a la Lista</Button>
                        </div>

                        {/* Lista temporal */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {cultoForm.tithesDetails.length === 0 && <p className="text-center text-xs text-indigo-400 py-2">Sin diezmos cargados aún.</p>}
                            {cultoForm.tithesDetails.map((t, idx) => (
                                <div key={t.id || idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-indigo-50 shadow-sm text-sm">
                                    <div>
                                        <span className="font-bold text-slate-700 block">{t.name}</span>
                                        <span className="text-xs text-slate-400">{t.method} {t.prayer && `• Oración: ${t.prayer}`}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-indigo-600">{formatCurrency(t.amount)}</span>
                                        <button onClick={()=>removeTither(t.id)} className="text-red-400 hover:text-red-600"><Icon name="X" size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Resumen Total */}
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-900 text-white rounded-xl">
                        <span className="font-bold uppercase text-xs">Total Culto</span>
                        <span className="font-black text-xl">
                            {formatCurrency(safeNum(cultoForm.offeringsCash) + safeNum(cultoForm.offeringsTransfer) + cultoForm.tithesDetails.reduce((a,b)=>a+safeNum(b.amount),0))}
                        </span>
                    </div>

                    <Button onClick={handleSaveCulto} className="w-full">Guardar Culto Completo</Button>
                </div>
            </Modal>

            {/* MODAL FONDOS */}
            <Modal isOpen={modalMode === 'fund'} onClose={()=>setModalMode(null)} title="Configurar Fondo">
                <div className="space-y-4">
                    <Input label="Nombre del Sobre/Fondo" placeholder="Ej: Ahorro Templo, Jóvenes..." value={fundForm.name} onChange={e=>setFundForm({...fundForm, name:e.target.value})} />
                    <Select label="Tipo" value={fundForm.type} onChange={e=>setFundForm({...fundForm, type:e.target.value})}>
                        <option value="saving">Ahorro / Acumulativo</option>
                        <option value="limit">Límite de Gasto / Presupuesto</option>
                    </Select>
                    <Input label="Meta / Límite (Opcional)" type="number" value={fundForm.target} onChange={e=>setFundForm({...fundForm, target:e.target.value})} />
                    <Button onClick={saveFund} className="w-full">Guardar Configuración</Button>
                </div>
            </Modal>

        </div>
    );
};
