window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => {
    const { useState, useMemo, useEffect, useRef } = React;
    const Utils = window.Utils || {};
    const { Card, Button, Modal, Input, Select, DateFilter, formatCurrency, formatDate, Icon, SmartSelect, compressImage, Badge } = Utils;

    // --- ESTADOS ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tabView, setTabView] = useState('dashboard'); // 'dashboard', 'list', 'goals'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Selección Múltiple
    const [selectedIds, setSelectedIds] = useState([]);

    // Seguridad PIN
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [errorPin, setErrorPin] = useState(false);

    // Formulario
    const initialForm = { type: 'Culto', date: Utils.getLocalDate(), tithesCash: '', tithesTransfer: '', offeringsCash: '', offeringsTransfer: '', amount: '', category: 'General', method: 'Efectivo', notes: '', attachmentUrl: '' };
    const [form, setForm] = useState(initialForm);

    // Metas (Persistencia simple en localStorage para demo, idealmente en DB)
    const [goals, setGoals] = useState(() => JSON.parse(localStorage.getItem('finance_goals')) || {});
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [goalForm, setGoalForm] = useState({ category: '', amount: '' });

    // Referencias PDF
    const printRef = useRef(null);
    const [pdfData, setPdfData] = useState(null); // Datos para el PDF

    const categories = [
        { value: 'General', label: 'General / Varios', icon: 'Info' },
        { value: 'Mantenimiento', label: 'Infraestructura', icon: 'Briefcase' },
        { value: 'Honorarios', label: 'Honorarios', icon: 'Users' },
        { value: 'Alquiler', label: 'Alquiler', icon: 'Home' },
        { value: 'Ayuda Social', label: 'Ayuda Social', icon: 'Smile' },
        { value: 'Ministerios', label: 'Ministerios', icon: 'Music' },
        { value: 'Ofrenda Misionera', label: 'Misiones', icon: 'Globe' }
    ];

    // --- CÁLCULOS ---
    const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    // 1. Datos del Mes Seleccionado
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

    // 2. Totales del Mes
    const monthTotals = useMemo(() => {
        let incomes = 0, expenses = 0;
        monthlyData.forEach(f => {
            const val = safeNum(f.total || f.amount);
            if (val > 0) incomes += val;
            else expenses += Math.abs(val);
        });
        return { incomes, expenses, net: incomes - expenses };
    }, [monthlyData]);

    // 3. Saldos Globales (Histórico)
    const globalBalances = useMemo(() => {
        let cash = 0, bank = 0;
        if (finances) {
            finances.forEach(f => {
                let val = 0;
                if (f.type === 'Culto') {
                    const c = safeNum(f.tithesCash)+safeNum(f.offeringsCash);
                    const b = safeNum(f.tithesTransfer)+safeNum(f.offeringsTransfer);
                    cash += c; bank += b;
                } else {
                    val = safeNum(f.amount);
                    if (f.method === 'Banco') bank += val; else cash += val;
                }
            });
        }
        return { cash, bank, total: cash + bank };
    }, [finances]);

    // 4. Datos Gráficos
    const chartData = useMemo(() => {
        if (!finances) return { trend: [], pie: [] };
        const trendMap = {};
        // Últimos 6 meses
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
        // Pie Chart (Gastos por Categoría del mes)
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

    // --- CHART.JS ---
    const Chart = window.Chart; 
    const lineChartRef = useRef(null);
    const barChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const chartInstances = useRef({});

    useEffect(() => {
        if (tabView !== 'dashboard' || !Chart) return;
        Object.values(chartInstances.current).forEach(c => c.destroy());

        if (lineChartRef.current) {
            chartInstances.current.line = new Chart(lineChartRef.current, {
                type: 'line',
                data: {
                    labels: chartData.trend.map(d => d.label),
                    datasets: [
                        { label: 'Ingresos', data: chartData.trend.map(d => d.ingresos), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                        { label: 'Gastos', data: chartData.trend.map(d => d.gastos), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } }
            });
        }
        if (pieChartRef.current && chartData.pie.length > 0) {
            chartInstances.current.pie = new Chart(pieChartRef.current, {
                type: 'doughnut',
                data: {
                    labels: chartData.pie.map(d => d.name),
                    datasets: [{ data: chartData.pie.map(d => d.value), backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '70%' }
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

    // Selección Múltiple
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

    // PDF VIOLETA (Factura)
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

    // Metas
    const handleSaveGoal = () => {
        const newGoals = { ...goals, [goalForm.category]: safeNum(goalForm.amount) };
        setGoals(newGoals);
        localStorage.setItem('finance_goals', JSON.stringify(newGoals));
        setIsGoalModalOpen(false);
    };

    // Render Bloqueo
    if (userProfile?.role !== 'Pastor') return <div className="h-full flex items-center justify-center text-slate-500">Acceso Restringido</div>;
    if (isLocked) return (<div className="h-full flex flex-col items-center justify-center animate-enter"><div className="bg-white p-8 rounded-3xl shadow-soft max-w-sm w-full text-center border border-slate-100"><div className="bg-brand-100 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-brand-600 mb-6"><Icon name="Wallet" size={32}/></div><h2 className="text-2xl font-extrabold text-slate-800 mb-2">Billetera</h2><form onSubmit={handleUnlock}><input type="password" maxLength="4" className="text-center text-3xl font-bold w-full border-b-2 outline-none py-2" value={pinInput} onChange={e=>setPinInput(e.target.value)} placeholder="••••" /><Button className="w-full mt-4" onClick={handleUnlock}>Desbloquear</Button></form></div></div>);

    const renderAmount = (a) => showBalance ? formatCurrency(safeNum(a)) : "$ ••••••";

    return (
        <div className="space-y-8 fade-in pb-24 font-sans">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Tesorería</h2>
                    <button onClick={()=>setShowBalance(!showBalance)} className="text-slate-400 hover:text-brand-600"><Icon name={showBalance?"Search":"LogOut"}/></button>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200"><DateFilter currentDate={currentDate} onChange={setCurrentDate} /></div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        {['dashboard','list','goals'].map(t => (
                            <button key={t} onClick={()=>setTabView(t)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${tabView===t?'bg-brand-50 text-brand-600 shadow-sm':'text-slate-500 hover:bg-slate-50'}`}>{t==='dashboard'?'Panel':(t==='list'?'Movimientos':'Metas')}</button>
                        ))}
                    </div>
                    <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: Utils.getLocalDate()}); setIsModalOpen(true)}}>Nuevo</Button>
                </div>
            </div>

            {/* DASHBOARD */}
            {tabView === 'dashboard' && (
                <div className="space-y-6 animate-enter">
                    {/* Tarjetas Flotantes de Resumen */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-emerald-500 text-white p-6 rounded-3xl shadow-lg shadow-emerald-500/20 relative overflow-hidden group">
                            <div className="absolute right-4 top-4 opacity-20 group-hover:scale-110 transition-transform"><Icon name="ArrowUp" size={48}/></div>
                            <p className="text-emerald-100 text-xs font-bold uppercase mb-1">Ingresos (Mes)</p>
                            <h3 className="text-3xl font-black">{renderAmount(monthTotals.incomes)}</h3>
                        </div>
                        <div className="bg-rose-500 text-white p-6 rounded-3xl shadow-lg shadow-rose-500/20 relative overflow-hidden group">
                            <div className="absolute right-4 top-4 opacity-20 group-hover:scale-110 transition-transform"><Icon name="ArrowDown" size={48}/></div>
                            <p className="text-rose-100 text-xs font-bold uppercase mb-1">Gastos (Mes)</p>
                            <h3 className="text-3xl font-black">{renderAmount(monthTotals.expenses)}</h3>
                        </div>
                        <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
                            <div className="absolute right-4 top-4 opacity-20 group-hover:scale-110 transition-transform"><Icon name="Wallet" size={48}/></div>
                            <p className="text-indigo-100 text-xs font-bold uppercase mb-1">Balance Neto</p>
                            <h3 className="text-3xl font-black">{renderAmount(monthTotals.net)}</h3>
                        </div>
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 h-80">
                            <div className="flex justify-between mb-4"><h3 className="font-bold text-xs uppercase text-slate-500">Tendencia Semestral</h3></div>
                            <div className="h-64 w-full relative"><canvas ref={lineChartRef}></canvas></div>
                        </Card>
                        <Card className="h-80">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-4">Distribución Gastos</h3>
                            <div className="h-48 w-full relative flex justify-center">{chartData.pie.length > 0 ? <canvas ref={pieChartRef}></canvas> : <p className="text-xs text-slate-400 self-center">Sin datos</p>}</div>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center">{chartData.pie.slice(0,3).map((p,i)=><Badge key={i} type="default">{p.name}</Badge>)}</div>
                        </Card>
                    </div>

                    {/* Saldos Cuentas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <Card className="border-l-4 border-l-emerald-500 flex justify-between items-center"><span className="text-slate-500 font-bold text-sm">Caja Chica (Efec.)</span><span className="text-xl font-bold text-slate-800">{renderAmount(globalBalances.cash)}</span></Card>
                         <Card className="border-l-4 border-l-blue-500 flex justify-between items-center"><span className="text-slate-500 font-bold text-sm">Banco / Digital</span><span className="text-xl font-bold text-slate-800">{renderAmount(globalBalances.bank)}</span></Card>
                    </div>
                </div>
            )}

            {/* LISTA MOVIMIENTOS */}
            {tabView === 'list' && (
                <div className="space-y-4 animate-enter relative">
                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                        <Icon name="Search" size={16} className="text-slate-400 ml-2"/>
                        <input className="w-full bg-transparent border-none text-sm outline-none" placeholder="Buscar concepto..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    </div>

                    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4 w-10"><input type="checkbox" onChange={selectAll} checked={selectedIds.length === monthlyData.length && monthlyData.length > 0} className="rounded text-brand-600 focus:ring-brand-500"/></th>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Detalle</th>
                                    <th className="p-4 text-right">Monto</th>
                                    <th className="p-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {monthlyData.map(f => {
                                    const amount = safeNum(f.total||f.amount);
                                    return (
                                        <tr key={f.id} className={`hover:bg-slate-50 ${selectedIds.includes(f.id)?'bg-blue-50/50':''}`}>
                                            <td className="p-4"><input type="checkbox" checked={selectedIds.includes(f.id)} onChange={()=>toggleSelect(f.id)} className="rounded text-brand-600 focus:ring-brand-500"/></td>
                                            <td className="p-4 text-slate-500">{formatDate(f.date)}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{f.type==='Culto'?'Culto General':f.category}</div>
                                                <div className="text-xs text-slate-500">{f.notes || f.method}</div>
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold ${amount<0?'text-red-500':'text-emerald-500'}`}>{formatCurrency(amount)}</td>
                                            <td className="p-4"><button onClick={()=>handleExportPDF(f)} className="text-slate-400 hover:text-indigo-600"><Icon name="Printer" size={16}/></button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {monthlyData.length===0 && <div className="p-8 text-center text-slate-400">Sin movimientos.</div>}
                    </div>

                    {/* Barra Flotante Acciones Lote */}
                    {selectedIds.length > 0 && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-enter z-50">
                            <span className="text-sm font-bold">{selectedIds.length} seleccionados</span>
                            <div className="h-4 w-px bg-white/20"></div>
                            <button onClick={handleBulkDelete} className="text-red-400 hover:text-white flex items-center gap-1 text-xs font-bold"><Icon name="Trash" size={14}/> Eliminar</button>
                        </div>
                    )}
                </div>
            )}

            {/* METAS (PRESUPUESTO) */}
            {tabView === 'goals' && (
                <div className="space-y-6 animate-enter">
                    <div className="flex justify-end"><Button size="sm" onClick={()=>setIsGoalModalOpen(true)}>Definir Meta</Button></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categories.filter(c=>c.value!=='Ingreso').map(cat => {
                            const spent = Math.abs(safeNum(chartData.pie.find(p=>p.name===cat.value)?.value || 0));
                            const goal = goals[cat.value] || 0;
                            const pct = goal > 0 ? Math.min(100, Math.round((spent/goal)*100)) : 0;
                            const color = pct > 90 ? 'bg-red-500' : (pct > 70 ? 'bg-yellow-500' : 'bg-emerald-500');
                            
                            return (
                                <Card key={cat.value} className="relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Icon name={cat.icon} size={18}/></div>
                                            <h4 className="font-bold text-slate-800">{cat.label}</h4>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{pct}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                                        <div className={`h-full ${color} transition-all duration-1000`} style={{width: `${pct}%`}}></div>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 font-medium">Gastado: {formatCurrency(spent)}</span>
                                        <span className="text-slate-400">Meta: {formatCurrency(goal)}</span>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MODAL NUEVO */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Registrar">
                <div className="space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-2">
                        {['Culto','Gasto','Ingreso'].map(t=><button key={t} onClick={()=>setForm({...initialForm, type:t})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${form.type===t?'bg-white shadow text-brand-600':'text-slate-500'}`}>{t}</button>)}
                    </div>
                    <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                    
                    {form.type==='Culto' ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3"><Input label="Diezmos Efec." type="number" value={form.tithesCash} onChange={e=>setForm({...form, tithesCash:e.target.value})}/><Input label="Ofrendas Efec." type="number" value={form.offeringsCash} onChange={e=>setForm({...form, offeringsCash:e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-3"><Input label="Diezmos Dig." type="number" value={form.tithesTransfer} onChange={e=>setForm({...form, tithesTransfer:e.target.value})}/><Input label="Ofrendas Dig." type="number" value={form.offeringsTransfer} onChange={e=>setForm({...form, offeringsTransfer:e.target.value})}/></div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Monto" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} />
                                <Select label="Pago" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Efectivo</option><option>Banco</option></Select>
                            </div>
                            <SmartSelect label="Categoría" options={categories} value={form.category} onChange={v=>setForm({...form, category:v})}/>
                        </div>
                    )}
                    <Input label="Notas" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
                    <div className="flex gap-2"><label className="flex-1 p-3 border rounded-xl flex justify-center items-center gap-2 cursor-pointer hover:bg-slate-50"><Icon name="Camera"/> {isUploading?'...':(form.attachmentUrl?'Listo':'Foto')}<input type="file" className="hidden" onChange={handleImage}/></label></div>
                    <Button className="w-full" onClick={handleSave} disabled={isUploading}>Guardar</Button>
                </div>
            </Modal>

            <Modal isOpen={isGoalModalOpen} onClose={()=>setIsGoalModalOpen(false)} title="Definir Meta">
                <div className="space-y-4">
                    <SmartSelect label="Categoría" options={categories} value={goalForm.category} onChange={v=>setGoalForm({...goalForm, category:v})}/>
                    <Input label="Monto Límite Mensual" type="number" value={goalForm.amount} onChange={e=>setGoalForm({...goalForm, amount:e.target.value})}/>
                    <Button className="w-full" onClick={handleSaveGoal}>Guardar Meta</Button>
                </div>
            </Modal>

            {/* ELEMENTO OCULTO PARA PDF VIOLETA (FACTURA MODERNA) */}
            {pdfData && (
                <div ref={printRef} style={{ display: 'none', width: '100mm', height: '150mm', background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', color: 'white', padding: '20px', fontFamily: 'sans-serif', position: 'relative' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900', letterSpacing: '2px' }}>CONQUISTADORES</h1>
                        <p style={{ margin: 0, fontSize: '10px', opacity: 0.7 }}>COMPROBANTE DIGITAL</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '15px', backdropFilter: 'blur(10px)' }}>
                        <p style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '5px' }}>Monto Total</p>
                        <h2 style={{ fontSize: '32px', margin: '0 0 20px 0', fontWeight: 'bold' }}>{formatCurrency(pdfData.total || pdfData.amount)}</h2>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
                            <span style={{ opacity: 0.7 }}>Fecha</span>
                            <span style={{ fontWeight: 'bold' }}>{formatDate(pdfData.date)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
                            <span style={{ opacity: 0.7 }}>Concepto</span>
                            <span style={{ fontWeight: 'bold' }}>{pdfData.type==='Culto'?'Culto':pdfData.category}</span>
                        </div>
                        {pdfData.notes && <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '11px', fontStyle: 'italic' }}>"{pdfData.notes}"</div>}
                    </div>
                    <div style={{ position: 'absolute', bottom: '20px', left: '0', width: '100%', textAlign: 'center' }}>
                        <p style={{ fontSize: '9px', opacity: 0.5 }}>Emitido automáticamente por CDS App</p>
                    </div>
                </div>
            )}
        </div>
    );
};
