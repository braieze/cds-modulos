window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, updateData, deleteData, userProfile, setActiveTab: setMainTab }) => {
    const { useState, useMemo, useEffect, useRef } = React;
    const Utils = window.Utils || {};
    const { Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, Badge } = Utils;

    // --- ESTADOS ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tabView, setTabView] = useState('dashboard'); // dashboard, list, tithers, funds
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // UI States
    const [showBalance, setShowBalance] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [expandedId, setExpandedId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);

    // SEGURIDAD PIN (ACTUALIZADO A 2367)
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
        titheEnvelopes: [], // Array de { family, amount, prayer }
        
        // OTROS
        amount: '', 
        category: 'General', 
        method: 'Efectivo', 
        notes: '', 
        attachmentUrl: '',
        
        // Transferencia de Fondos
        fromFund: 'General',
        toFund: ''
    };
    const [form, setForm] = useState(initialForm);

    // Estado para agregar un sobre individualmente en el modal
    const [tempEnvelope, setTempEnvelope] = useState({ family: '', amount: '', prayer: '' });

    // FONDOS / METAS (Simulados con persistencia local por ahora)
    const [funds, setFunds] = useState(() => {
        const saved = localStorage.getItem('church_funds_v1');
        return saved ? JSON.parse(saved) : [{ id: 'general', name: 'Caja General', balance: 0, icon: 'Wallet', color: 'bg-indigo-500' }];
    });

    useEffect(() => {
        localStorage.setItem('church_funds_v1', JSON.stringify(funds));
    }, [funds]);

    // --- HELPERS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const blurClass = showBalance ? '' : 'filter blur-md select-none transition-all duration-500';

    // 1. Datos del Mes
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
                return true;
            })
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate, searchTerm]);

    // 2. Totales y Diezmo Nacional (10%)
    const stats = useMemo(() => {
        let incomes = 0, expenses = 0, grossTithes = 0;
        
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            if (val > 0) {
                incomes += val;
                // Si es culto, sumamos los diezmos para estadística
                if(f.type === 'Culto' && f.titheEnvelopes) {
                    f.titheEnvelopes.forEach(e => grossTithes += safeNum(e.amount));
                }
            } else {
                expenses += Math.abs(val);
            }
        });

        // Diezmo para Asamblea (10% de los ingresos brutos)
        const nationalTithe = incomes * 0.10;

        return { incomes, expenses, net: incomes - expenses, nationalTithe, grossTithes };
    }, [monthlyData]);

    // 3. Saldos Globales (Caja vs Banco)
    const balances = useMemo(() => {
        let cash = 0, bank = 0;
        (finances || []).forEach(f => {
            if (f.type === 'Culto') {
                // Sumar sobres (normalmente efectivo) + ofrenda efectivo
                let envelopesTotal = (f.titheEnvelopes || []).reduce((acc, curr) => acc + safeNum(curr.amount), 0);
                cash += envelopesTotal + safeNum(f.offeringsCash);
                bank += safeNum(f.offeringsTransfer);
            } else {
                const val = safeNum(f.amount); 
                if (f.method === 'Banco') bank += val; else cash += val;
            }
        });
        return { cash, bank, total: cash + bank };
    }, [finances]);

    // 4. Análisis de Diezmadores (Histórico Global)
    const tithersAnalysis = useMemo(() => {
        const map = {};
        (finances || []).forEach(f => {
            if (f.type === 'Culto' && f.titheEnvelopes) {
                f.titheEnvelopes.forEach(env => {
                    const name = env.family || 'Anónimo';
                    if (!map[name]) map[name] = { name, total: 0, count: 0, lastDate: f.date, requests: [] };
                    map[name].total += safeNum(env.amount);
                    map[name].count += 1;
                    if (f.date > map[name].lastDate) map[name].lastDate = f.date;
                    if (env.prayer) map[name].requests.push({ date: f.date, text: env.prayer });
                });
            }
        });
        return Object.values(map).sort((a,b) => b.total - a.total);
    }, [finances]);

    // --- LOGICA DE PIN ---
    useEffect(() => {
        if (isLocked) setTimeout(() => pinInputRef.current?.focus(), 100);
        if (pinInput.length === 4) {
            if (pinInput === '2367') { // CLAVE ACTUALIZADA
                setIsLocked(false);
                setErrorPin(false);
            } else {
                setErrorPin(true);
                Utils.notify("PIN Incorrecto", "error");
                setPinInput('');
            }
        }
    }, [isLocked, pinInput]);

    const handleVirtualKey = (n) => {
        setPinInput(prev => (prev + n).slice(0, 4));
        pinInputRef.current?.focus();
    };

    // --- CRUD OPERACIONES ---
    const handleAddEnvelope = () => {
        if (!tempEnvelope.amount) return;
        setForm(prev => ({
            ...prev,
            titheEnvelopes: [...prev.titheEnvelopes, { ...tempEnvelope, id: Date.now() }]
        }));
        setTempEnvelope({ family: '', amount: '', prayer: '' });
    };

    const removeEnvelope = (idx) => {
        setForm(prev => ({
            ...prev,
            titheEnvelopes: prev.titheEnvelopes.filter((_, i) => i !== idx)
        }));
    };

    const handleEdit = (item) => {
        setForm({
            ...initialForm,
            ...item,
            titheEnvelopes: item.titheEnvelopes || []
        });
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if(!confirm(`¿Eliminar ${selectedIds.length} registros?`)) return;
        const batch = window.db.batch();
        selectedIds.forEach(id => batch.delete(window.db.collection('finances').doc(id)));
        await batch.commit();
        setSelectedIds([]);
        Utils.notify("Eliminados");
    };

    const handleSave = async () => {
        // Validación Básica
        if (!form.date) return Utils.notify("Falta fecha", "error");

        let payload = { ...form };
        let totalAmount = 0;

        if (form.type === 'Culto') {
            // 1. Sumar Sobres
            const envelopesTotal = form.titheEnvelopes.reduce((acc, curr) => acc + safeNum(curr.amount), 0);
            // 2. Sumar Ofrendas (Corrección de Bug)
            const offCash = safeNum(form.offeringsCash);
            const offTrans = safeNum(form.offeringsTransfer);
            
            totalAmount = envelopesTotal + offCash + offTrans;
            
            if (totalAmount === 0) return Utils.notify("El total no puede ser 0", "error");
            
            payload.total = totalAmount; // Para compatibilidad
            payload.amount = totalAmount;
            payload.category = 'Culto General';
            payload.method = 'Mixto'; 
        
        } else if (form.type === 'Transferencia') {
            // Lógica de movimiento de fondos
            totalAmount = safeNum(form.amount);
            if (!form.toFund) return Utils.notify("Selecciona destino", "error");
            payload.category = `Transferencia: ${form.fromFund} -> ${form.toFund}`;
            payload.amount = 0; // No afecta el balance global neto
        } else {
            // Gasto o Ingreso Vario
            totalAmount = safeNum(form.amount);
            if (totalAmount === 0) return Utils.notify("Monto requerido", "error");
            
            // Si es gasto, guardar negativo
            payload.amount = form.type === 'Gasto' ? -Math.abs(totalAmount) : Math.abs(totalAmount);
            payload.total = payload.amount;
        }

        try {
            if (form.id) {
                await updateData('finances', form.id, payload);
            } else {
                await addData('finances', payload);
            }
            setIsModalOpen(false);
            setForm(initialForm);
            Utils.notify("Operación Guardada");
        } catch (e) {
            console.error(e);
            Utils.notify("Error al guardar", "error");
        }
    };

    // --- GESTIÓN DE FONDOS ---
    const handleAddFund = () => {
        const name = prompt("Nombre del Nuevo Fondo (ej: Construcción):");
        if (name) {
            setFunds([...funds, { id: Date.now(), name, balance: 0, icon: 'Archive', color: 'bg-slate-500' }]);
        }
    };

    // --- RENDER ---
    
    // 1. PANTALLA DE BLOQUEO
    if (isLocked) return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617] animate-enter">
            {/* Botón Volver de Emergencia */}
            <button onClick={() => setMainTab && setMainTab('dashboard')} className="absolute top-6 left-6 text-slate-400 flex items-center gap-2 hover:text-white transition-colors">
                <Icon name="ChevronLeft"/> Volver al Inicio
            </button>

            <div className="relative bg-white/5 backdrop-blur-2xl p-8 rounded-[32px] shadow-2xl border border-white/10 max-w-sm w-full text-center">
                <div className={`bg-indigo-500 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-lg transition-all ${errorPin ? 'animate-shake bg-red-500' : ''}`}>
                    <Icon name={errorPin ? "AlertCircle" : "Lock"} size={28}/>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Tesoreria</h2>
                <p className="text-slate-400 text-sm mb-6">Ingresa el PIN (2367)</p>
                
                <input ref={pinInputRef} type="number" pattern="[0-9]*" className="opacity-0 absolute top-0 left-0 w-full h-full" value={pinInput} onChange={e => setPinInput(e.target.value.slice(0,4))} onBlur={() => setTimeout(() => pinInputRef.current?.focus(), 100)}/>

                <div className="flex justify-center gap-4 mb-8">
                    {[0, 1, 2, 3].map(i => (<div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pinInput.length ? 'bg-indigo-500 scale-110 shadow-[0_0_10px_#6366f1]' : 'bg-white/10'}`}></div>))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[1,2,3,4,5,6,7,8,9].map(n => (<button key={n} onClick={() => handleVirtualKey(n)} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl border border-white/5 active:scale-95 transition-all">{n}</button>))}
                    <div/>
                    <button onClick={() => handleVirtualKey(0)} className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xl border border-white/5">0</button>
                    <button onClick={() => setPinInput(p=>p.slice(0,-1))} className="h-14 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center"><Icon name="Delete" size={20}/></button>
                </div>
            </div>
        </div>
    );

    // 2. INTERFAZ PRINCIPAL
    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans -m-4 sm:-m-8 pb-32 relative overflow-hidden selection:bg-indigo-500/30">
            {/* Background Effects */}
            <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none"></div>
            
            <div className="relative z-10 p-4 sm:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMainTab && setMainTab('dashboard')} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><Icon name="ChevronLeft"/></button>
                        
                        <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-3 rounded-2xl text-white shadow-xl"><Icon name="Wallet" size={24}/></div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Tesoreria</h2>
                            <p className="text-slate-400 text-sm font-medium">Gestión Integral</p>
                        </div>
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

                {/* VISTA 1: DASHBOARD RESUMEN */}
                {tabView === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
                        {/* Balance Principal */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900 to-[#0f172a] rounded-[32px] p-8 relative overflow-hidden shadow-2xl border border-white/10">
                            <div className="relative z-10">
                                <span className="text-indigo-200 text-xs font-bold uppercase tracking-widest border border-indigo-500/30 px-3 py-1 rounded-full bg-indigo-500/10">Balance Total</span>
                                <h3 className={`text-5xl sm:text-6xl font-black text-white mt-4 mb-2 tracking-tight ${blurClass}`}>{showBalance ? formatCurrency(balances.total) : '$ •••••••'}</h3>
                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-2 mb-2 text-emerald-400"><Icon name="DollarSign" size={16}/> <span className="text-xs font-bold uppercase">Caja (Efectivo)</span></div><span className={`text-xl font-bold text-white ${blurClass}`}>{showBalance ? formatCurrency(balances.cash) : '••••'}</span></div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-2 mb-2 text-blue-400"><Icon name="CreditCard" size={16}/> <span className="text-xs font-bold uppercase">Banco / Digital</span></div><span className={`text-xl font-bold text-white ${blurClass}`}>{showBalance ? formatCurrency(balances.bank) : '••••'}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Tarjeta del 10% (Asamblea de Dios) */}
                        <div className="bg-[#1e293b]/50 backdrop-blur-md border border-white/10 rounded-[32px] p-6 relative overflow-hidden flex flex-col justify-center">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
                            <div className="flex items-center gap-2 mb-4 text-purple-400">
                                <Icon name="TrendingUp" size={20}/>
                                <h3 className="font-bold uppercase tracking-wider text-xs">Diezmo Nacional (10%)</h3>
                            </div>
                            <p className="text-slate-400 text-xs mb-2">Correspondiente a Ingresos de {formatDate(currentDate.toISOString(), 'long').split(' ')[2]}</p>
                            <h2 className={`text-4xl font-black text-white mb-4 ${blurClass}`}>{showBalance ? formatCurrency(stats.nationalTithe) : '••••'}</h2>
                            <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20 text-xs text-purple-200">
                                <span className="block font-bold mb-1">Cálculo:</span>
                                Total Ingresos ({formatCurrency(stats.incomes)}) x 10%
                            </div>
                        </div>
                    </div>
                )}

                {/* VISTA 2: LISTADO MOVIMIENTOS */}
                {tabView === 'list' && (
                    <div className="animate-enter space-y-4">
                        {monthlyData.length === 0 ? <div className="text-center py-20 text-slate-500">Sin movimientos este mes.</div> : (
                            monthlyData.map(f => {
                                const isIncome = safeNum(f.amount) > 0;
                                const isCulto = f.type === 'Culto';
                                return (
                                    <div key={f.id} className="bg-white/5 border border-white/5 hover:border-white/20 p-4 rounded-2xl flex items-center gap-4 transition-all group">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${isCulto ? 'bg-purple-500/20 text-purple-400' : (isIncome ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')}`}>
                                            <Icon name={isCulto ? 'Church' : (isIncome ? 'TrendingUp' : 'ShoppingBag')}/>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between">
                                                <h4 className="font-bold text-white truncate">{isCulto ? 'Culto General' : f.category}</h4>
                                                <span className={`font-mono font-bold ${isIncome ? 'text-emerald-400' : 'text-rose-400'} ${blurClass}`}>{formatCurrency(f.amount)}</span>
                                            </div>
                                            <div className="flex justify-between mt-1 text-xs text-slate-500">
                                                <span>{formatDate(f.date)} • {f.method}</span>
                                                <span className="italic truncate max-w-[150px]">{f.notes}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={()=>handleEdit(f)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20"><Icon name="Edit" size={16}/></button>
                                            <button onClick={()=>{setSelectedIds([f.id]); handleDelete()}} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><Icon name="Trash" size={16}/></button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* VISTA 3: DIEZMANTES */}
                {tabView === 'tithers' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-enter">
                        <div className="lg:col-span-2 bg-[#1e293b] p-6 rounded-[32px] border border-white/10 mb-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">Fidelidad de la Iglesia</h3>
                                <p className="text-slate-400 text-sm">Historial acumulado de familias diezmantes</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-xs text-slate-500 uppercase font-bold">Total Familias</span>
                                <span className="text-2xl font-black text-indigo-400">{tithersAnalysis.length}</span>
                            </div>
                        </div>
                        {tithersAnalysis.map((t, i) => (
                            <div key={i} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white">{t.name.charAt(0)}</div>
                                        <div>
                                            <h4 className="font-bold text-white">{t.name}</h4>
                                            <p className="text-xs text-slate-400">Último: {formatDate(t.lastDate)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`block font-mono font-bold text-emerald-400 ${blurClass}`}>{formatCurrency(t.total)}</span>
                                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-300">{t.count} veces</span>
                                    </div>
                                </div>
                                {t.requests.length > 0 && (
                                    <div className="bg-black/20 p-3 rounded-xl mt-2">
                                        <p className="text-[10px] font-bold text-indigo-300 uppercase mb-1">Últimas Peticiones</p>
                                        {t.requests.slice(-2).map((r, ri) => (
                                            <p key={ri} className="text-xs text-slate-300 truncate">• {r.text}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* VISTA 4: FONDOS */}
                {tabView === 'funds' && (
                    <div className="animate-enter">
                        <div className="flex justify-end mb-6"><Button onClick={handleAddFund} icon="Plus">Crear Fondo</Button></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {funds.map(fund => (
                                <div key={fund.id} className="bg-[#1e293b] border border-white/10 p-6 rounded-[32px] relative overflow-hidden group">
                                    <div className={`absolute top-0 right-0 w-24 h-24 ${fund.color} opacity-10 rounded-full blur-2xl -mr-8 -mt-8`}></div>
                                    <div className="relative z-10">
                                        <div className={`w-12 h-12 rounded-2xl ${fund.color} flex items-center justify-center text-white mb-4 shadow-lg`}><Icon name={fund.icon || 'Archive'}/></div>
                                        <h3 className="text-xl font-bold text-white">{fund.name}</h3>
                                        <p className="text-slate-400 text-sm mb-6">Fondo Acumulado</p>
                                        <div className="flex justify-between items-end">
                                            <span className={`text-2xl font-mono font-bold text-white ${blurClass}`}>{formatCurrency(fund.balance)}</span>
                                            <button className="text-xs font-bold text-indigo-400 hover:text-white transition-colors">Ver Historial</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL PRINCIPAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Operación">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                    {/* Selector de Tipo */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                        {['Culto', 'Gasto', 'Ingreso'].map(t => (
                            <button key={t} onClick={() => setForm({ ...initialForm, type: t })} className={`py-2 text-xs font-black uppercase rounded-lg transition-all ${form.type === t ? 'bg-white text-indigo-900 shadow' : 'text-slate-400'}`}>{t}</button>
                        ))}
                    </div>
                    
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />

                    {/* FORMULARIO CULTO (COMPLEJO) */}
                    {form.type === 'Culto' ? (
                        <div className="space-y-6">
                            {/* Sección Ofrendas */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Icon name="Gift" size={14}/> Ofrendas (Sueltas)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Efectivo" type="number" placeholder="$0" value={form.offeringsCash} onChange={e => setForm({ ...form, offeringsCash: e.target.value })} />
                                    <Input label="Digital / Banco" type="number" placeholder="$0" value={form.offeringsTransfer} onChange={e => setForm({ ...form, offeringsTransfer: e.target.value })} />
                                </div>
                            </div>

                            {/* Sección Diezmos (Sobres) */}
                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Icon name="Mail" size={14}/> Sobres de Diezmo</h4>
                                
                                {/* Input para agregar sobre */}
                                <div className="flex flex-col gap-3 mb-4 bg-white p-3 rounded-xl shadow-sm">
                                    <Input placeholder="Apellido Familia" value={tempEnvelope.family} onChange={e => setTempEnvelope({ ...tempEnvelope, family: e.target.value })} className="text-sm" />
                                    <div className="flex gap-2">
                                        <Input type="number" placeholder="Monto" value={tempEnvelope.amount} onChange={e => setTempEnvelope({ ...tempEnvelope, amount: e.target.value })} className="flex-1" />
                                        <Button size="sm" onClick={handleAddEnvelope} disabled={!tempEnvelope.amount}><Icon name="Plus"/></Button>
                                    </div>
                                    <Input placeholder="Petición de Oración..." value={tempEnvelope.prayer} onChange={e => setTempEnvelope({ ...tempEnvelope, prayer: e.target.value })} className="text-xs" />
                                </div>

                                {/* Lista de Sobres Cargados */}
                                <div className="space-y-2">
                                    {form.titheEnvelopes.map((env, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-indigo-100 text-sm">
                                            <div>
                                                <span className="font-bold text-indigo-900 block">{env.family || 'Anónimo'}</span>
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
                                <div className="mt-4 text-right">
                                    <span className="text-xs font-bold text-indigo-400 uppercase mr-2">Total Diezmos:</span>
                                    <span className="text-xl font-black text-indigo-700">{formatCurrency(form.titheEnvelopes.reduce((a, b) => a + safeNum(b.amount), 0))}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // FORMULARIO GASTO / INGRESO
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Monto" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="font-mono text-xl font-bold" />
                                <Select label="Método" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option>Efectivo</option><option>Banco</option></Select>
                            </div>
                            <SmartSelect label="Categoría" options={[{ value: 'General', label: 'General' }, { value: 'Mantenimiento', label: 'Mantenimiento' }, { value: 'Honorarios', label: 'Honorarios' }, { value: 'Ayuda Social', label: 'Ayuda Social' }]} value={form.category} onChange={v => setForm({ ...form, category: v })} />
                        </>
                    )}

                    <Input label="Notas / Detalles" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    
                    <Button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl mt-4" onClick={handleSave}>Guardar Operación</Button>
                </div>
            </Modal>
        </div>
    );
};
