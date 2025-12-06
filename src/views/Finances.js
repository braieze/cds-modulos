// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    const { useState, useMemo } = React;
    const { Card, Button, Badge, Modal, Input, Select, MonthNav, formatCurrency, formatDate, Icon, SmartSelect } = window.Utils;
    const { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = window.Recharts || {};

    // 1. SEGURIDAD: Solo Pastor
    if (userProfile.role !== 'Pastor') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="bg-red-100 p-4 rounded-full text-red-500 mb-4"><Icon name="LogOut" size={40} /></div>
                <h2 className="text-2xl font-bold text-slate-800">Acceso Restringido</h2>
                <p className="text-slate-500 mt-2 max-w-md">El módulo de Tesorería es exclusivo para el rol Pastoral.</p>
            </div>
        );
    }

    // -- ESTADOS --
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tabView, setTabView] = useState('dashboard'); // dashboard | list
    
    // Formulario
    const initialForm = { 
        type: 'Culto', 
        date: new Date().toISOString().split('T')[0], 
        
        // Campos Culto
        tithesCash: '', tithesTransfer: '',
        offeringsCash: '', offeringsTransfer: '',
        tithersCount: '',
        
        // Campos Gasto/Ingreso
        amount: '', 
        category: 'General', 
        method: 'Efectivo', // 'Efectivo' | 'Banco'
        
        notes: '' 
    };
    const [form, setForm] = useState(initialForm);

    // Opciones para SmartSelect
    const categories = [
        { value: 'General', label: 'General / Varios' },
        { value: 'Mantenimiento', label: 'Infraestructura y Mantenimiento' },
        { value: 'Honorarios', label: 'Honorarios y Viáticos' },
        { value: 'Ministerios', label: 'Ministerios (Niños, Jóvenes, etc)' },
        { value: 'Ayuda Social', label: 'Ayuda Social' },
        { value: 'Alquiler', label: 'Alquiler y Servicios' },
        { value: 'Ofrenda Misionera', label: 'Ofrenda Misionera' }
    ];

    // -- CÁLCULOS INTELIGENTES (El Cerebro Financiero) --
    
    // 1. Saldos Globales (Históricos)
    const globalBalances = useMemo(() => {
        let cash = 0;
        let bank = 0;

        finances.forEach(f => {
            if (f.type === 'Culto') {
                cash += (Number(f.tithesCash || 0) + Number(f.offeringsCash || 0));
                bank += (Number(f.tithesTransfer || 0) + Number(f.offeringsTransfer || 0));
            } else {
                const val = Number(f.amount || 0); // Ya viene con signo negativo si es gasto
                if (f.method === 'Banco') bank += val;
                else cash += val; // Default a Efectivo
            }
        });

        return { cash, bank, total: cash + bank };
    }, [finances]);

    // 2. Datos del Mes Seleccionado
    const monthlyData = useMemo(() => {
        const monthStr = currentDate.toISOString().slice(0, 7);
        return finances.filter(f => f.date && f.date.startsWith(monthStr)).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [finances, currentDate]);

    // 3. Métricas del Mes
    const monthlyStats = useMemo(() => {
        let income = 0, expense = 0, tithers = 0;
        
        monthlyData.forEach(f => {
            // Ingresos/Gastos
            let totalMov = 0;
            if (f.type === 'Culto') {
                totalMov = (Number(f.tithesCash||0) + Number(f.tithesTransfer||0) + Number(f.offeringsCash||0) + Number(f.offeringsTransfer||0));
                tithers += Number(f.tithersCount || 0);
            } else {
                totalMov = Number(f.amount || 0);
            }

            if (totalMov > 0) income += totalMov;
            else expense += Math.abs(totalMov);
        });

        return { income, expense, tithers, balance: income - expense };
    }, [monthlyData]);

    // 4. Datos para Gráficos
    const chartData = useMemo(() => {
        // A. Tendencia (Últimos 6 meses)
        const trendMap = {};
        for(let i=5; i>=0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toISOString().slice(0, 7); // YYYY-MM
            trendMap[key] = { name: window.Utils.formatDate(d, 'month'), ingresos: 0, gastos: 0 };
        }

        finances.forEach(f => {
            const key = f.date.slice(0, 7);
            if (trendMap[key]) {
                let val = 0;
                if(f.type === 'Culto') val = (Number(f.tithesCash||0) + Number(f.tithesTransfer||0) + Number(f.offeringsCash||0) + Number(f.offeringsTransfer||0));
                else val = Number(f.amount || 0);

                if (val > 0) trendMap[key].ingresos += val;
                else trendMap[key].gastos += Math.abs(val);
            }
        });

        // B. Distribución Gastos (Mes Actual)
        const pieMap = {};
        monthlyData.filter(f => f.type === 'Gasto').forEach(f => {
            const cat = f.category || 'General';
            pieMap[cat] = (pieMap[cat] || 0) + Math.abs(Number(f.amount));
        });
        const pieData = Object.entries(pieMap).map(([name, value]) => ({ name, value }));

        return { trend: Object.values(trendMap), pie: pieData };
    }, [finances, monthlyData]);


    // -- MANEJO DE GUARDADO --
    const handleSave = () => {
        let finalData = { 
            type: form.type, 
            date: form.date, 
            notes: form.notes,
            category: form.category,
            createdAt: new Date().toISOString()
        };

        if (form.type === 'Culto') {
            const tc = Number(form.tithesCash || 0);
            const tt = Number(form.tithesTransfer || 0);
            const oc = Number(form.offeringsCash || 0);
            const ot = Number(form.offeringsTransfer || 0);
            
            if((tc+tt+oc+ot) === 0) return window.Utils.notify("El total no puede ser 0", "error");

            finalData = { ...finalData, tithesCash: tc, tithesTransfer: tt, offeringsCash: oc, offeringsTransfer: ot, tithersCount: Number(form.tithersCount || 0), total: (tc+tt+oc+ot) };
        } else {
            const amt = Number(form.amount || 0);
            if(amt === 0) return window.Utils.notify("Monto requerido", "error");
            
            finalData.amount = form.type === 'Gasto' ? -Math.abs(amt) : Math.abs(amt);
            finalData.method = form.method; // Efectivo o Banco
            finalData.total = finalData.amount;
        }

        addData('finances', finalData);
        setIsModalOpen(false);
        setForm(initialForm);
        window.Utils.notify("Movimiento registrado correctamente");
    };

    // Colores Gráfico Torta
    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#6366f1'];

    return (
        <div className="space-y-8 fade-in">
            {/* 1. HEADER & ACCIONES */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Billetera Digital</h2>
                    <p className="text-slate-500 text-sm">Gestión financiera inteligente</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                        <button onClick={()=>setTabView('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tabView==='dashboard'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Dashboard</button>
                        <button onClick={()=>setTabView('list')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tabView==='list'?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500'}`}>Movimientos</button>
                    </div>
                    <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: new Date().toISOString().split('T')[0]}); setIsModalOpen(true);}}>Nuevo</Button>
                </div>
            </div>

            {/* 2. TARJETAS DE SALDO (BILLETERA) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* SALDO TOTAL */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="Wallet" size={80}/></div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Patrimonio Total</p>
                    <h3 className="text-3xl font-extrabold">{formatCurrency(globalBalances.total)}</h3>
                    <div className="mt-4 flex gap-2">
                        <Badge type="default">Balance Global</Badge>
                    </div>
                </div>

                {/* CAJA CHICA */}
                <Card className="border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Caja Chica (Efectivo)</p>
                            <h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(globalBalances.cash)}</h3>
                        </div>
                        <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><Icon name="DollarSign" /></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Dinero físico disponible</p>
                </Card>

                {/* BANCO */}
                <Card className="border-l-4 border-l-brand-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Banco / Digital</p>
                            <h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(globalBalances.bank)}</h3>
                        </div>
                        <div className="bg-brand-100 text-brand-600 p-2 rounded-lg"><Icon name="Briefcase" /></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Transferencias y Cuentas</p>
                </Card>
            </div>

            {/* 3. VISTA DASHBOARD (GRÁFICOS) */}
            {tabView === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
                    {/* Gráfico de Tendencia */}
                    <Card className="lg:col-span-2">
                        <h3 className="font-bold text-slate-800 mb-4">Flujo de Caja (6 Meses)</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData.trend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" tick={{fontSize:10}} axisLine={false} tickLine={false} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)'}} />
                                    <Legend />
                                    <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} dot={{r:4}} name="Ingresos" />
                                    <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={3} dot={{r:4}} name="Gastos" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Gráfico de Torta */}
                    <Card>
                        <h3 className="font-bold text-slate-800 mb-4">Distribución de Gastos (Este Mes)</h3>
                        <div className="h-64 w-full relative">
                            {chartData.pie.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={chartData.pie} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {chartData.pie.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs italic">Sin gastos este mes</div>
                            )}
                            {/* Centro del Donut */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Total</span>
                                    <div className="text-xl font-bold text-slate-800">{formatCurrency(monthlyStats.expense)}</div>
                                </div>
                            </div>
                        </div>
                        {/* Leyenda manual pequeña */}
                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                            {chartData.pie.map((e, i) => (
                                <div key={i} className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: PIE_COLORS[i % PIE_COLORS.length]}}></div>
                                    {e.name}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}

            {/* 4. VISTA MOVIMIENTOS (LISTA DETALLADA) */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Movimientos del Mes</h3>
                    <MonthNav currentDate={currentDate} onMonthChange={setCurrentDate} />
                </div>

                <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Concepto</th>
                                <th className="p-4">Origen</th>
                                <th className="p-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {monthlyData.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Sin movimientos.</td></tr>}
                            {monthlyData.map(f => {
                                // Determinar icono de origen
                                const isBank = f.method === 'Banco' || (f.type === 'Culto' && (f.tithesTransfer > 0 || f.offeringsTransfer > 0));
                                const isCash = f.method === 'Efectivo' || (f.type === 'Culto' && (f.tithesCash > 0 || f.offeringsCash > 0));
                                const isMixed = isBank && isCash;

                                return (
                                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 whitespace-nowrap text-slate-600">{formatDate(f.date)}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{f.type === 'Culto' ? 'Cierre de Culto' : f.category}</div>
                                            <div className="text-xs text-slate-500">{f.notes || (f.type==='Culto' ? `${f.tithersCount} diezmantes` : 'Sin notas')}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                {isCash && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100"><Icon name="DollarSign" size={10}/> Efec</span>}
                                                {isBank && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100"><Icon name="Briefcase" size={10}/> Banco</span>}
                                            </div>
                                        </td>
                                        <td className={`p-4 text-right font-mono font-bold ${(f.total || f.amount) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {formatCurrency(f.total || f.amount)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 5. MODAL DE REGISTRO INTELIGENTE */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Registrar Movimiento">
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                    {/* Selector de Tipo */}
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Tipo" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                            <option value="Culto">Cierre de Culto</option>
                            <option value="Gasto">Gasto / Salida</option>
                            <option value="Ingreso">Otro Ingreso</option>
                        </Select>
                        <Input type="date" label="Fecha" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
                    </div>

                    {/* FORMULARIO CULTO (Desglose Completo) */}
                    {form.type === 'Culto' && (
                        <div className="space-y-4">
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                <h4 className="font-bold text-emerald-800 text-xs uppercase mb-3 flex items-center gap-2"><Icon name="DollarSign" size={14}/> Efectivo (Alfolí)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Diezmos Efectivo" type="number" placeholder="$ 0" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})} />
                                    <Input label="Ofrendas Efectivo" type="number" placeholder="$ 0" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})} />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-blue-800 text-xs uppercase mb-3 flex items-center gap-2"><Icon name="Briefcase" size={14}/> Banco / Digital</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Diezmos Transf." type="number" placeholder="$ 0" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})} />
                                    <Input label="Ofrendas Transf." type="number" placeholder="$ 0" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})} />
                                </div>
                            </div>

                            <div className="pt-2">
                                <Input label="Cantidad de Diezmantes (Sobres)" type="number" placeholder="Ej. 12" value={form.tithersCount} onChange={e=>setForm({...form, tithersCount:e.target.value})} />
                            </div>
                        </div>
                    )}

                    {/* FORMULARIO GASTO/INGRESO */}
                    {form.type !== 'Culto' && (
                        <div className="space-y-4">
                            <Input label="Monto Total" type="number" placeholder="$ 0.00" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="text-lg" />
                            
                            <SmartSelect 
                                label="Categoría" 
                                options={categories} 
                                value={form.category} 
                                onChange={val=>setForm({...form, category:val})} 
                            />

                            <Select label="Método de Pago" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}>
                                <option value="Efectivo">Caja Chica (Efectivo)</option>
                                <option value="Banco">Banco / Transferencia</option>
                            </Select>
                        </div>
                    )}

                    <Input label="Notas Adicionales" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Detalles..." />

                    <div className="pt-2">
                        <Button className="w-full" onClick={handleSave}>Guardar Movimiento</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
