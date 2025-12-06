// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    const { useState, useMemo, useEffect } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Badge, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage } = Utils;
    
    // Acceso seguro a Recharts
    const Recharts = window.Recharts || null;
    const { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = Recharts || {};

    // 1. SEGURIDAD DE ACCESO (PIN)
    // Estado para controlar si está bloqueado
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    // Validar Rol primero (Seguridad Nivel 1)
    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-400 italic"><Icon name="LogOut" className="mr-2"/> Acceso restringido a Pastoral.</div>;

    // Pantalla de Bloqueo (Seguridad Nivel 2)
    if (isLocked) {
        const handleUnlock = (e) => {
            e.preventDefault();
            // PIN DE ACCESO: 1234 (Cámbialo aquí si deseas)
            if (pinInput === '1234') {
                setIsLocked(false);
                setErrorPin(false);
            } else {
                setErrorPin(true);
                setPinInput('');
            }
        };

        return (
            <div className="h-full flex flex-col items-center justify-center animate-enter">
                <div className="bg-white p-8 rounded-3xl shadow-soft max-w-sm w-full text-center border border-slate-100">
                    <div className="bg-brand-100 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-brand-600 mb-6">
                        <Icon name="Wallet" size={32}/>
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Billetera Digital</h2>
                    <p className="text-slate-500 mb-6 text-sm">Ingresa el PIN de seguridad para ver los saldos.</p>
                    
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <input 
                            type="password" 
                            inputMode="numeric" 
                            maxLength="4"
                            className="text-center text-3xl tracking-[0.5em] font-bold w-full border-b-2 border-slate-200 focus:border-brand-500 outline-none py-2 transition-colors text-slate-800 placeholder-slate-200" 
                            placeholder="••••" 
                            value={pinInput}
                            autoFocus
                            onChange={e => setPinInput(e.target.value)}
                        />
                        {errorPin && <p className="text-red-500 text-xs font-bold">PIN Incorrecto</p>}
                        <Button className="w-full justify-center py-3 mt-4" onClick={handleUnlock}>Desbloquear</Button>
                    </form>
                </div>
            </div>
        );
    }

    // -- LÓGICA DE LA BILLETERA (Una vez desbloqueada) --
    
    // Estados
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard'); // 'dashboard' | 'activity'
    const [showBalance, setShowBalance] = useState(true); // Ocultar/Mostrar $$$
    const [receiptModal, setReceiptModal] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [filterType, setFilterType] = useState('all'); // 'all', 'in', 'out'

    // Formulario Nuevo Movimiento
    const initialForm = { 
        type: 'Culto', date: Utils.getLocalDate(), 
        tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', tithersCount: '', 
        amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' 
    };
    const [form, setForm] = useState(initialForm);

    const categories = [
        { value: 'General', label: 'General / Varios' },
        { value: 'Mantenimiento', label: 'Infraestructura' },
        { value: 'Honorarios', label: 'Honorarios' },
        { value: 'Alquiler', label: 'Alquiler/Servicios' },
        { value: 'Ayuda Social', label: 'Ayuda Social' },
        { value: 'Ministerios', label: 'Ministerios' },
        { value: 'Ofrenda Misionera', label: 'Ofrenda Misionera' }
    ];

    // CÁLCULOS DE SALDO (Globales)
    const globalBalances = useMemo(() => {
        let cash = 0, bank = 0;
        finances.forEach(f => {
            if (f.type === 'Culto') { 
                cash += (Number(f.tithesCash||0) + Number(f.offeringsCash||0)); 
                bank += (Number(f.tithesTransfer||0) + Number(f.offeringsTransfer||0)); 
            } else { 
                const val = Number(f.amount||0); // amount ya tiene signo
                if (f.method === 'Banco') bank += val; else cash += val; 
            }
        });
        return { cash, bank, total: cash + bank };
    }, [finances]);

    // DATOS DEL MES SELECCIONADO
    const monthlyData = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return finances
            .filter(f => f.date && f.date.startsWith(monthStr))
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate]);

    // DATOS PARA GRÁFICOS (Filtrados por mes actual)
    const chartData = useMemo(() => {
        if (!Recharts) return { area: [], pie: [] };
        
        // 1. Gráfico de Área (Flujo del mes día a día)
        // Agrupar por día del mes seleccionado
        const daysMap = {};
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        
        // Inicializar días
        for(let i=1; i<=daysInMonth; i++) {
            daysMap[i] = { day: i, ingreso: 0, egreso: 0 };
        }

        monthlyData.forEach(f => {
            const day = new Date(f.date).getDate(); // Ojo: timezone fix needed if string
            // Simple parse para asegurar día local
            const [y, m, d] = f.date.split('-').map(Number);
            
            if (daysMap[d]) {
                let valIn = 0, valOut = 0;
                if (f.type === 'Culto') {
                    valIn = (Number(f.tithesCash||0)+Number(f.tithesTransfer||0)+Number(f.offeringsCash||0)+Number(f.offeringsTransfer||0));
                } else {
                    const amt = Number(f.amount||0);
                    if (amt > 0) valIn = amt; else valOut = Math.abs(amt);
                }
                daysMap[d].ingreso += valIn;
                daysMap[d].egreso += valOut;
            }
        });
        // Filtrar solo días hasta hoy (para no mostrar ceros futuros) o mostrar todo el mes
        const areaData = Object.values(daysMap);

        // 2. Gráfico de Torta (Gastos por Categoría del mes)
        const pieMap = {};
        monthlyData.filter(f => (f.amount < 0)).forEach(f => { // Solo gastos
            const cat = f.category || 'General';
            pieMap[cat] = (pieMap[cat] || 0) + Math.abs(Number(f.amount));
        });
        const pieData = Object.entries(pieMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value);

        return { area: areaData, pie: pieData };
    }, [monthlyData, currentDate, Recharts]);

    // MANEJADORES
    const handleImage = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsUploading(true);
        try {
            const base64 = await compressImage(file);
            setForm(p => ({ ...p, attachmentUrl: base64 }));
            Utils.notify("Comprobante cargado");
        } catch(err) { Utils.notify("Error al cargar", "error"); }
        setIsUploading(false);
    };

    const handleSave = () => {
        let final = { ...form, createdAt: new Date().toISOString() };
        
        if(form.type === 'Culto') {
            const total = Number(form.tithesCash||0)+Number(form.tithesTransfer||0)+Number(form.offeringsCash||0)+Number(form.offeringsTransfer||0);
            if(total===0) return Utils.notify("El total no puede ser 0", "error");
            final.total = total;
            final.category = 'Culto';
        } else {
            const amt = Number(form.amount||0);
            if(amt===0) return Utils.notify("Monto requerido", "error");
            // Asegurar signo correcto
            final.amount = form.type==='Gasto' ? -Math.abs(amt) : Math.abs(amt);
            final.total = final.amount;
        }

        addData('finances', final); 
        setIsModalOpen(false); 
        setForm(initialForm); 
        Utils.notify("Movimiento registrado");
    };

    const generateFixed = () => {
        if(!confirm("¿Generar gastos fijos del mes?")) return;
        const fixed = [
            { type: 'Gasto', category: 'Alquiler', amount: -50000, method: 'Banco', notes: 'Alquiler Templo', date: Utils.getLocalDate() },
            { type: 'Gasto', category: 'Mantenimiento', amount: -5000, method: 'Efectivo', notes: 'Limpieza', date: Utils.getLocalDate() }
        ];
        fixed.forEach(f => addData('finances', { ...f, total: f.amount, createdAt: new Date().toISOString() }));
        Utils.notify("Gastos generados");
    };

    // Colores para gráficos
    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

    // Render Saldo Oculto/Visible
    const renderAmount = (amount) => showBalance ? formatCurrency(amount) : "$ ••••••";

    return (
        <div className="space-y-8 fade-in pb-24">
            {/* HEADER BILLETERA */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Mi Billetera</h2>
                    <button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400 hover:text-brand-600 transition-colors">
                        <Icon name={showBalance ? "Search" : "LogOut"} size={20} /> {/* Usando iconos disponibles como ojo */}
                    </button>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={()=>setTabView('dashboard')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${tabView==='dashboard'?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>Resumen</button>
                    <button onClick={()=>setTabView('activity')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${tabView==='activity'?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>Actividad</button>
                </div>
            </div>

            {/* TARJETAS DE SALDO (Siempre visibles) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total */}
                <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>
                    <p className="text-brand-100 text-xs font-bold uppercase tracking-widest mb-1">Saldo Total</p>
                    <h3 className="text-4xl font-black tracking-tight">{renderAmount(globalBalances.total)}</h3>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="bg-white/20 px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur">AR$ Peso Argentino</span>
                    </div>
                </div>

                {/* Caja Chica */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-soft flex flex-col justify-between relative group hover:border-emerald-200 transition-all">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Efectivo</p>
                            <h3 className="text-2xl font-extrabold text-slate-800">{renderAmount(globalBalances.cash)}</h3>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl"><Icon name="DollarSign" size={24}/></div>
                    </div>
                    <div className="h-1 w-full bg-slate-50 mt-4 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-3/4"></div>
                    </div>
                </div>

                {/* Banco */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-soft flex flex-col justify-between relative group hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Banco / Digital</p>
                            <h3 className="text-2xl font-extrabold text-slate-800">{renderAmount(globalBalances.bank)}</h3>
                        </div>
                        <div className="bg-blue-50 text-blue-600 p-3 rounded-xl"><Icon name="Briefcase" size={24}/></div>
                    </div>
                    <div className="h-1 w-full bg-slate-50 mt-4 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-1/2"></div>
                    </div>
                </div>
            </div>

            {/* --- VISTA DASHBOARD (Gráficos) --- */}
            {tabView === 'dashboard' && (
                <div className="space-y-6 animate-enter">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800">Análisis Financiero</h3>
                        <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                    </div>

                    {/* Estado Vacío si no hay datos */}
                    {monthlyData.length === 0 && (
                        <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <Icon name="Wallet" size={48} className="text-slate-300 mx-auto mb-4"/>
                            <p className="text-slate-500 font-medium mb-4">No hay movimientos en este mes para graficar.</p>
                            <button onClick={window.DataLogic.generateDemoFinances} className="text-brand-600 font-bold hover:underline text-sm">
                                Generar datos de prueba (Oct/Nov)
                            </button>
                        </div>
                    )}

                    {/* Gráficos (Solo si hay datos y Recharts) */}
                    {monthlyData.length > 0 && Recharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Flujo de Caja (Área) */}
                            <Card className="lg:col-span-2 h-80">
                                <h4 className="font-bold text-sm text-slate-500 uppercase mb-4">Flujo Diario ({formatDate(currentDate.toISOString().slice(0,10), 'month')})</h4>
                                <ResponsiveContainer width="100%" height="90%">
                                    <AreaChart data={chartData.area}>
                                        <defs>
                                            <linearGradient id="colorIng" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                            <linearGradient id="colorEgr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="day" tick={{fontSize:10}} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}/>
                                        <Area type="monotone" dataKey="ingreso" stroke="#10b981" fillOpacity={1} fill="url(#colorIng)" strokeWidth={3} />
                                        <Area type="monotone" dataKey="egreso" stroke="#ef4444" fillOpacity={1} fill="url(#colorEgr)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Card>

                            {/* Distribución (Donut) */}
                            <Card className="h-80 flex flex-col">
                                <h4 className="font-bold text-sm text-slate-500 uppercase mb-4">Gastos por Categoría</h4>
                                <div className="flex-1 relative">
                                    {chartData.pie.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={chartData.pie} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {chartData.pie.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : <div className="flex h-full items-center justify-center text-slate-400 text-xs italic">Sin gastos</div>}
                                    
                                    {/* Centro del Donut */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center">
                                            <div className="text-xs text-slate-400 font-bold">TOTAL</div>
                                            <div className="text-lg font-bold text-slate-800">{formatCurrency(chartData.pie.reduce((a,b)=>a+b.value,0))}</div>
                                        </div>
                                    </div>
                                </div>
                                {/* Leyenda */}
                                <div className="mt-2 flex flex-wrap gap-2 justify-center overflow-y-auto max-h-20 hide-scroll">
                                    {chartData.pie.map((e, i) => (
                                        <div key={i} className="flex items-center gap-1 text-[10px] bg-slate-50 px-2 py-1 rounded-full">
                                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: PIE_COLORS[i % PIE_COLORS.length]}}></div>
                                            {e.name}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {/* --- VISTA ACTIVIDAD (Lista) --- */}
            {tabView === 'activity' && (
                <div className="space-y-4 animate-enter">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <DateFilter currentDate={currentDate} onChange={setCurrentDate} />
                            {/* Filtros Rápidos */}
                            <div className="flex bg-slate-100 p-1 rounded-lg ml-2">
                                <button onClick={()=>setFilterType('all')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${filterType==='all'?'bg-white shadow-sm text-slate-800':'text-slate-500'}`}>Todos</button>
                                <button onClick={()=>setFilterType('in')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${filterType==='in'?'bg-white shadow-sm text-emerald-600':'text-slate-500'}`}>Ingresos</button>
                                <button onClick={()=>setFilterType('out')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${filterType==='out'?'bg-white shadow-sm text-red-600':'text-slate-500'}`}>Gastos</button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={generateFixed} className="text-xs text-slate-500 hover:text-brand-600 font-bold flex items-center gap-1 px-3 py-2 border rounded-xl hover:bg-slate-50 transition-colors">
                                <Icon name="Plus" size={12}/> Gastos Fijos
                            </button>
                            <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true);}}>Movimiento</Button>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                                    <tr>
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4">Concepto</th>
                                        <th className="p-4">Origen</th>
                                        <th className="p-4 text-right">Monto</th>
                                        <th className="p-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {monthlyData.filter(f => {
                                        if(filterType === 'in') return (f.total || f.amount) > 0;
                                        if(filterType === 'out') return (f.total || f.amount) < 0;
                                        return true;
                                    }).map(f => {
                                        const isIncome = (f.total || f.amount) > 0;
                                        const isCash = f.method === 'Efectivo' || (f.type === 'Culto' && (Number(f.tithesCash)>0 || Number(f.offeringsCash)>0));
                                        const isBank = f.method === 'Banco' || (f.type === 'Culto' && (Number(f.tithesTransfer)>0 || Number(f.offeringsTransfer)>0));
                                        
                                        return (
                                            <tr key={f.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-4 whitespace-nowrap text-slate-500 font-medium text-xs">{formatDate(f.date)}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                            <Icon name={f.type === 'Culto' ? 'Home' : (isIncome ? 'Plus' : 'Wallet')} size={14}/>
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800">{f.type === 'Culto' ? 'Cierre de Culto' : f.category}</div>
                                                            <div className="text-xs text-slate-400 line-clamp-1">{f.notes || (f.type==='Culto' ? `${f.tithersCount} diezmantes` : '')}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex gap-1">
                                                        {isCash && <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 flex items-center gap-1"><Icon name="DollarSign" size={10}/> Efec</span>}
                                                        {isBank && <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 flex items-center gap-1"><Icon name="Briefcase" size={10}/> Dig</span>}
                                                    </div>
                                                </td>
                                                <td className={`p-4 text-right font-mono font-bold ${isIncome ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                    {isIncome ? '+' : ''}{formatCurrency(f.total || f.amount)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {f.attachmentUrl && (
                                                        <button onClick={()=>setReceiptModal(f.attachmentUrl)} className="text-slate-300 hover:text-brand-600 transition-colors">
                                                            <Icon name="Image" size={16}/>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {monthlyData.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Sin movimientos registrados.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CARGA */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Nuevo Movimiento">
                <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
                    {/* Tabs internos */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 mb-4">
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
                                    <Input label="Diezmos" type="number" placeholder="$ 0" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})} />
                                    <Input label="Ofrendas" type="number" placeholder="$ 0" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})} />
                                </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-blue-800 text-xs uppercase mb-3 flex items-center gap-2"><Icon name="Briefcase" size={14}/> Banco / Digital</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Diezmos" type="number" placeholder="$ 0" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})} />
                                    <Input label="Ofrendas" type="number" placeholder="$ 0" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})} />
                                </div>
                            </div>
                            <Input label="Sobres de Diezmo (Cantidad)" type="number" value={form.tithersCount} onChange={e=>setForm({...form, tithersCount:e.target.value})} placeholder="Ej. 12" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <span className="absolute left-4 top-9 text-slate-400 font-bold">$</span>
                                <Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="pl-6" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})} />
                                <Select label="Método" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option value="Efectivo">Efectivo</option><option value="Banco">Banco</option></Select>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Detalles adicionales..." />
                        
                        {/* Adjunto */}
                        <label className="block w-full cursor-pointer border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-brand-300 hover:bg-brand-50 transition-all group">
                            <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-brand-500">
                                <Icon name="Image" size={24} />
                                <span className="text-xs font-bold">{isUploading ? 'Subiendo...' : (form.attachmentUrl ? 'Cambiar Comprobante' : 'Adjuntar Comprobante')}</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImage} disabled={isUploading} />
                        </label>
                        {form.attachmentUrl && <div className="text-center"><span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">¡Imagen lista!</span></div>}
                    </div>

                    <div className="pt-2">
                        <Button className="w-full py-3 shadow-lg shadow-brand-500/20" onClick={handleSave} disabled={isUploading}>Registrar Operación</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Comprobante */}
            <Modal isOpen={!!receiptModal} onClose={()=>setReceiptModal(null)} title="Comprobante">
                <img src={receiptModal} className="w-full rounded-xl shadow-lg" />
            </Modal>
        </div>
    );
};
