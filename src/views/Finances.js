// src/views/Finances.js
window.Views = window.Views || {};

window.Views.Finances = ({ finances, addData, userProfile }) => { // Recibimos userProfile para validar rol
    const { useState, useMemo } = React;
    const { Card, Button, Badge, Modal, Input, Select, MonthNav, formatCurrency, formatDate, Icon } = window.Utils;

    // 1. SEGURIDAD: Solo el Pastor puede ver esto
    if (userProfile.role !== 'Pastor') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="bg-red-100 p-4 rounded-full text-red-500 mb-4">
                    <Icon name="LogOut" size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Acceso Restringido</h2>
                <p className="text-slate-500 mt-2 max-w-md">
                    El módulo de Tesorería contiene información sensible y es exclusivo para el rol Pastoral.
                </p>
            </div>
        );
    }

    // Estado local
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAdding, setIsAdding] = useState(false);
    
    // Formulario inicial
    const initialForm = { type: 'Culto', date: new Date().toISOString().split('T')[0], tithes: '', offerings: '', amount: '', notes: '', tithersCount: '' };
    const [form, setForm] = useState(initialForm);

    // 2. FILTRADO POR MES (Chips)
    const monthlyFinances = useMemo(() => {
        const selectedMonth = currentDate.toISOString().slice(0, 7); // "2023-10"
        return finances.filter(f => f.date && f.date.startsWith(selectedMonth));
    }, [finances, currentDate]);

    // 3. ESTADÍSTICAS DEL MES
    const stats = useMemo(() => {
        return monthlyFinances.reduce((acc, curr) => {
            const val = Number(curr.total || 0);
            if (val > 0) acc.income += val;
            if (val < 0) acc.expense += Math.abs(val);
            if (curr.type === 'Culto') acc.tithers += Number(curr.tithersCount || 0);
            return acc;
        }, { income: 0, expense: 0, tithers: 0 });
    }, [monthlyFinances]);

    // 4. GUARDADO CON LÓGICA DE DIEZMOS/OFRENDAS
    const handleSave = () => {
        // Cálculos
        let totalAmount = 0;
        let finalData = { ...form };

        if (form.type === 'Culto') {
            const t = Number(form.tithes || 0);
            const o = Number(form.offerings || 0);
            totalAmount = t + o;
            
            finalData.tithes = t;
            finalData.offerings = o;
            finalData.tithersCount = Number(form.tithersCount || 0);
            finalData.total = totalAmount; // Total positivo
        } else if (form.type === 'Gasto') {
            totalAmount = Number(form.amount || 0);
            finalData.total = -Math.abs(totalAmount); // Total negativo
        } else {
            // Ingreso vario
            totalAmount = Number(form.amount || 0);
            finalData.total = Math.abs(totalAmount); // Total positivo
        }

        if (totalAmount === 0 && form.type !== 'Culto') {
            alert("El monto no puede ser cero.");
            return;
        }

        addData('finances', finalData);
        setIsAdding(false);
        setForm(initialForm);
    };

    return (
        <div className="space-y-6 fade-in">
            {/* Header y Botón */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Tesorería</h2>
                    <p className="text-slate-500 text-sm">Gestión de caja y movimientos</p>
                </div>
                <Button icon="Plus" onClick={()=>{setForm({...initialForm, date: new Date().toISOString().split('T')[0]}); setIsAdding(true);}}>
                    Registrar Movimiento
                </Button>
            </div>

            {/* Navegación por Meses */}
            <MonthNav currentDate={currentDate} onMonthChange={setCurrentDate} />

            {/* Tarjetas de Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-emerald-50 border-emerald-100">
                    <div className="flex items-center gap-3 mb-2 text-emerald-700">
                        <Icon name="DollarSign" />
                        <span className="text-xs font-bold uppercase tracking-wider">Ingresos (Mes)</span>
                    </div>
                    <p className="text-3xl font-extrabold text-emerald-900">{formatCurrency(stats.income)}</p>
                </Card>
                <Card className="bg-red-50 border-red-100">
                    <div className="flex items-center gap-3 mb-2 text-red-700">
                        <Icon name="Briefcase" /> {/* Usando Briefcase como icono genérico de gasto si no hay otro */}
                        <span className="text-xs font-bold uppercase tracking-wider">Gastos (Mes)</span>
                    </div>
                    <p className="text-3xl font-extrabold text-red-900">{formatCurrency(stats.expense)}</p>
                </Card>
                <Card className="bg-blue-50 border-blue-100">
                    <div className="flex items-center gap-3 mb-2 text-blue-700">
                        <Icon name="Users" />
                        <span className="text-xs font-bold uppercase tracking-wider">Diezmantes</span>
                    </div>
                    <p className="text-3xl font-extrabold text-blue-900">{stats.tithers}</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">Personas fieles este mes</p>
                </Card>
            </div>

            {/* Tabla de Movimientos */}
            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Detalle</th>
                                <th className="p-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {monthlyFinances.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400 italic">
                                        No hay movimientos registrados en {formatDate(currentDate, 'month')}.
                                    </td>
                                </tr>
                            ) : (
                                monthlyFinances.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(f => (
                                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-medium text-slate-700 whitespace-nowrap">
                                            {formatDate(f.date)}
                                        </td>
                                        <td className="p-4">
                                            <Badge type={f.type === 'Gasto' ? 'danger' : (f.type === 'Culto' ? 'brand' : 'success')}>
                                                {f.type}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            <div className="font-medium">{f.notes || 'Sin notas'}</div>
                                            {f.type === 'Culto' && (
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {formatCurrency(f.tithes || 0)} Diezmos + {formatCurrency(f.offerings || 0)} Ofrendas
                                                </div>
                                            )}
                                        </td>
                                        <td className={`p-4 text-right font-mono font-bold text-base ${f.total < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {formatCurrency(f.total)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal de Registro */}
            <Modal isOpen={isAdding} onClose={()=>setIsAdding(false)} title="Registrar Movimiento">
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Tipo de Movimiento" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                            <option value="Culto">Cierre de Culto</option>
                            <option value="Ingreso">Otro Ingreso</option>
                            <option value="Gasto">Gasto / Salida</option>
                        </Select>
                        <Input type="date" label="Fecha" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
                    </div>

                    {/* Campos Dinámicos según Tipo */}
                    {form.type === 'Culto' ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                            <h4 className="font-bold text-slate-700 text-sm uppercase">Desglose del Servicio</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Total Diezmos" 
                                    type="number" 
                                    placeholder="$ 0" 
                                    value={form.tithes} 
                                    onChange={e=>setForm({...form, tithes:e.target.value})} 
                                />
                                <Input 
                                    label="Total Ofrendas" 
                                    type="number" 
                                    placeholder="$ 0" 
                                    value={form.offerings} 
                                    onChange={e=>setForm({...form, offerings:e.target.value})} 
                                />
                            </div>
                            <div className="border-t border-slate-200 pt-4">
                                <Input 
                                    label="Cantidad de Sobres (Diezmantes)" 
                                    type="number" 
                                    placeholder="Ej. 15" 
                                    value={form.tithersCount} 
                                    onChange={e=>setForm({...form, tithersCount:e.target.value})} 
                                    className="bg-white"
                                />
                                <p className="text-xs text-slate-400 mt-1 ml-1">Número de personas que diezmaron hoy.</p>
                            </div>
                        </div>
                    ) : (
                        <Input 
                            label="Monto Total" 
                            type="number" 
                            placeholder="$ 0.00" 
                            value={form.amount} 
                            onChange={e=>setForm({...form, amount:e.target.value})} 
                            className="text-lg"
                        />
                    )}

                    <Input 
                        label="Notas / Descripción" 
                        placeholder={form.type === 'Gasto' ? 'Ej. Compra de artículos de limpieza' : 'Detalles adicionales...'} 
                        value={form.notes} 
                        onChange={e=>setForm({...form, notes:e.target.value})} 
                    />

                    <div className="pt-2">
                        <Button className="w-full py-4 text-base" onClick={handleSave}>Guardar Registro</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
