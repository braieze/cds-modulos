window.Views = window.Views || {};

window.Views.Directory = ({ members, directory, addData, updateData, deleteData }) => {
    // 1. HOOKS Y UTILIDADES
    const { useState, useMemo, useRef, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal } = Utils;

    // 2. ESTADOS
    const [localMembers, setLocalMembers] = useState([]);
    
    useEffect(() => {
        const incoming = Array.isArray(members) ? members : (Array.isArray(directory) ? directory : []);
        setLocalMembers(incoming);
    }, [members, directory]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const initialForm = { 
        id: '', name: '', role: 'Miembro', email: '', phone: '', 
        address: '', birthDate: '', emergencyContact: '', emergencyPhone: '', photo: '', joinedDate: '' 
    };
    const [form, setForm] = useState(initialForm);

    const cardRef = useRef(null);

    // 3. HELPERS
    const getField = (item, ...keys) => {
        for (let key of keys) if (item[key]) return item[key];
        return null;
    };

    const getPhoto = (photoUrl, name) => {
        if (photoUrl && photoUrl.length > 5) return photoUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=e2e8f0&color=475569&size=512`;
    };

    const openWhatsApp = (phone) => {
        if (!phone) return Utils.notify('Sin número de WhatsApp', 'error');
        const p = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${p}`, '_blank');
    };
    
    const makeCall = (phone) => {
        if (!phone) return Utils.notify('Sin número de teléfono', 'error');
        window.open(`tel:${phone}`, '_self');
    };

    const openMaps = (address) => {
        if (!address) return Utils.notify('Sin dirección registrada', 'error');
        const q = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
    };

    // 4. LÓGICA CRUD
    const handleEdit = (member) => {
        setForm({
            id: member.id,
            name: getField(member, 'name', 'nombre') || '',
            role: getField(member, 'role', 'rol') || 'Miembro',
            email: getField(member, 'email', 'correo') || '',
            phone: getField(member, 'phone', 'telefono', 'celular') || '',
            address: getField(member, 'address', 'direccion') || '',
            birthDate: getField(member, 'birthDate', 'fechaNacimiento') || '',
            emergencyContact: getField(member, 'emergencyContact', 'contactoEmergencia') || '',
            emergencyPhone: getField(member, 'emergencyPhone', 'telefonoEmergencia') || '',
            photo: getField(member, 'photo', 'foto') || '',
            joinedDate: getField(member, 'joinedDate', 'fechaIngreso') || ''
        });
        setIsEditing(true);
    };

    const handleNew = () => {
        setForm({ ...initialForm, id: Date.now().toString(36), joinedDate: new Date().toISOString().split('T')[0] });
        setIsEditing(true);
    };

    const handleDelete = (id) => {
        if(!confirm("¿Estás seguro de eliminar a este miembro?")) return;
        if (typeof deleteData === 'function') deleteData('directory', id);
        setLocalMembers(prev => prev.filter(m => m.id !== id));
        if (selectedMember?.id === id) setSelectedMember(null);
        Utils.notify("Miembro eliminado");
    };

    const handleSave = () => {
        if (!form.name) return Utils.notify("El nombre es obligatorio", 'error');
        const memberData = { ...form };
        const exists = localMembers.find(m => m.id === form.id);

        if (exists) {
            if (typeof updateData === 'function') updateData('directory', form.id, memberData);
            setLocalMembers(prev => prev.map(m => m.id === form.id ? memberData : m));
            Utils.notify("Datos actualizados");
        } else {
            if (!memberData.id) memberData.id = Date.now().toString(36);
            if (typeof addData === 'function') addData('directory', memberData);
            setLocalMembers(prev => [...prev, memberData]);
            Utils.notify("Miembro registrado");
        }
        setIsEditing(false);
    };

    const filteredMembers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return localMembers.filter(m => {
            const name = getField(m, 'name', 'nombre') || '';
            const role = getField(m, 'role', 'rol') || '';
            return name.toLowerCase().includes(term) || role.toLowerCase().includes(term);
        });
    }, [localMembers, searchTerm]);

    // PDF GENERATOR
    const downloadPDF = async () => {
        if (!selectedMember || !cardRef.current) return;
        setIsDownloading(true);
        setIsFlipped(false); 

        setTimeout(async () => {
            try {
                if (!window.html2pdf) {
                    await new Promise((resolve) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                        script.onload = resolve;
                        document.head.appendChild(script);
                    });
                }
                const opt = {
                    margin: 0,
                    filename: `Credencial_${selectedMember.name.replace(/\s+/g,'_')}.pdf`,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { scale: 3, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: [55, 88], orientation: 'portrait' } 
                };
                await window.html2pdf().set(opt).from(cardRef.current).save();
                Utils.notify("PDF descargado con éxito");
            } catch (error) { console.error(error); Utils.notify("Error al generar PDF", 'error'); }
            setIsDownloading(false);
        }, 800);
    };

    const renderCredential = (m) => {
        if (!m) return null;
        const id = m.id || '---';
        const name = getField(m, 'name', 'nombre') || 'Sin Nombre';
        const role = getField(m, 'role', 'rol') || 'Miembro';
        const photo = getPhoto(getField(m, 'photo', 'foto'), name);
        
        const email = getField(m, 'email', 'correo');
        const phone = getField(m, 'phone', 'telefono');
        const address = getField(m, 'address', 'direccion');
        const emerContact = getField(m, 'emergencyContact', 'contactoEmergencia');
        const emerPhone = getField(m, 'emergencyPhone', 'telefonoEmergencia');
        
        const expirationYear = new Date().getFullYear();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;

        return (
            <div className="perspective-1000 w-[340px] h-[540px] cursor-pointer group select-none relative font-poppins" onClick={() => !isDownloading && setIsFlipped(!isFlipped)}>
                <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* --- FRENTE (ESTILO PREMIUM ID) --- */}
                    <div ref={!isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden rounded-[24px] shadow-2xl overflow-hidden flex flex-col z-20 bg-white">
                        
                        {/* Agujero Superior */}
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-10 h-2 bg-slate-800 rounded-full z-50"></div>

                        {/* 1. SECCIÓN SUPERIOR (CLARA) */}
                        <div className="h-[210px] bg-slate-50 relative pt-12 text-center z-10">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">CONQUISTADORES</p>
                            <h1 className="text-xl font-medium text-blue-600 tracking-tight leading-none mb-1">Credencial Digital</h1>
                            <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">{expirationYear}</h2>

                            {/* Foto Flotante Superpuesta */}
                            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[75px] w-[150px] h-[150px] bg-slate-50 rounded-full flex items-center justify-center shadow-[0_0_0_10px_#f8fafc] z-20">
                                <div className="w-[140px] h-[140px] rounded-full overflow-hidden relative bg-white">
                                    <img src={photo} className="w-full h-full object-cover" alt={name} onError={(e) => e.target.src = getPhoto(null, name)}/>
                                </div>
                            </div>
                        </div>

                        {/* 2. SECCIÓN INFERIOR (OSCURA/AZUL PROFUNDO) */}
                        <div className="flex-1 bg-[#030816] relative pt-[90px] flex flex-col items-center overflow-hidden z-0">
                            
                            {/* Decoración Tech (Barras de unión) */}
                            <div className="absolute top-[-3px] left-0 w-[60px] h-[6px] bg-blue-600 z-10"></div>
                            <div className="absolute top-[-3px] right-0 w-[40px] h-[6px] bg-blue-600 z-10"></div>

                            {/* Marca de Agua (Watermark Outline) */}
                            <div className="absolute bottom-10 -left-10 text-[120px] font-black italic text-transparent pointer-events-none opacity-20" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.1)' }}>
                                ID
                            </div>
                            <div className="absolute top-10 -right-10 text-[100px] font-black italic text-transparent pointer-events-none opacity-20 rotate-90" style={{ WebkitTextStroke: '1px rgba(37,99,235,0.2)' }}>
                                2025
                            </div>

                            {/* Datos del Usuario */}
                            <div className="relative z-10 text-center w-full px-6">
                                <h2 className="text-[26px] font-bold text-[#1d6df2] leading-tight mb-1 truncate drop-shadow-lg">{name}</h2>
                                <p className="text-[15px] font-light text-slate-300 uppercase tracking-wider mb-6">{role}</p>

                                {/* Footer con QR y Vencimiento */}
                                <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
                                    <div className="text-left">
                                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-1">ID ÚNICO</p>
                                        <p className="text-xs font-mono font-bold text-white tracking-widest">{id.slice(0,8).toUpperCase()}</p>
                                        <p className="text-[8px] text-brand-400 font-bold uppercase mt-1">Vence: Dic {expirationYear}</p>
                                    </div>
                                    <div className="bg-white p-1 rounded-lg">
                                        <img src={qrUrl} className="w-12 h-12" alt="QR" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Decoración Geométrica Inferior */}
                            <div className="mt-auto mb-4 flex items-end justify-center gap-1 opacity-80">
                                <div className="w-1.5 h-6 bg-white transform -skew-x-[20deg]"></div>
                                <div className="w-1.5 h-4 bg-[#1d6df2] transform -skew-x-[20deg]"></div>
                                <div className="w-10 h-0.5 bg-[#1d6df2] mb-[2px]"></div>
                            </div>

                            <div className="absolute bottom-2 text-[9px] text-slate-600 flex items-center gap-1"><Icon name="RotateCw" size={10} /></div>
                        </div>
                    </div>

                    {/* --- DORSO (MANTENIDO IGUAL) --- */}
                    <div ref={isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-900 text-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col p-6 relative border border-slate-700 z-20">
                         <div className="absolute inset-0 bg-slate-900 -z-10"></div>
                         <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-600 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                         <div className="absolute top-6 left-1/2 -translate-x-1/2 w-10 h-2 bg-slate-700 rounded-full"></div>

                         <div className="mt-8 text-center mb-6 relative z-10">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-brand-400 border border-white/10 backdrop-blur-sm shadow-lg">
                                <Icon name="User" size={24}/>
                            </div>
                            <h3 className="font-bold text-lg tracking-wide">Contacto Privado</h3>
                         </div>

                         <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4 z-10">
                            {/* Botones */}
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(phone)}} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg border border-emerald-500/30">
                                    <Icon name="MessageCircle" size={16} /> WhatsApp
                                </button>
                                <button onClick={(e)=>{e.stopPropagation(); makeCall(phone)}} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg border border-blue-500/30">
                                    <Icon name="Phone" size={16} /> Llamar
                                </button>
                            </div>

                            {/* Datos */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1 mb-1"><Icon name="Phone" size={10}/> Teléfono Móvil</p>
                                    <p className="text-sm font-medium text-white font-mono tracking-wide">{phone || 'No registrado'}</p>
                                </div>
                                <div onClick={(e)=>{e.stopPropagation(); openMaps(address)}} className={`cursor-pointer hover:opacity-80 ${!address && 'pointer-events-none'}`}>
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1 mb-1"><Icon name="MapPin" size={10}/> Dirección</p>
                                    <p className={`text-xs font-medium leading-relaxed ${address ? 'text-blue-300 underline decoration-blue-300/50' : 'text-slate-500'}`}>{address || 'Sin dirección'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1 mb-1"><Icon name="Mail" size={10}/> Email</p>
                                    <p className="text-xs font-medium text-slate-200 break-all">{email || '-'}</p>
                                </div>
                            </div>

                            {(emerContact || emerPhone) && (
                                <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 mt-2">
                                    <p className="text-[9px] text-red-300 font-bold uppercase flex items-center gap-1 mb-1">
                                        <Icon name="AlertTriangle" size={10}/> Emergencia
                                    </p>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs font-bold text-white">{emerContact}</p>
                                        {emerPhone && <a href={`tel:${emerPhone}`} onClick={(e)=>e.stopPropagation()} className="text-xs text-red-200 hover:text-white bg-red-500/20 px-2 py-1 rounded font-mono transition-colors">{emerPhone}</a>}
                                    </div>
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- VISTA PRINCIPAL ---
    return (
        <div className="space-y-6 fade-in pb-24 font-poppins">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,800&display=swap');
                .font-poppins { font-family: 'Poppins', sans-serif; }
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Directorio</h2>
                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{localMembers.length}</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400"/>
                        <input className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500" placeholder="Buscar miembro..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    </div>
                    <Button icon="UserPlus" onClick={handleNew}>Nuevo</Button>
                </div>
            </div>

            {/* Grid */}
            {filteredMembers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMembers.map(member => {
                        const name = getField(member, 'name', 'nombre') || 'Sin nombre';
                        const role = getField(member, 'role', 'rol') || 'Miembro';
                        const photo = getPhoto(getField(member, 'photo', 'foto'), name);
                        return (
                            <div key={member.id} className="group bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all flex items-center gap-3 relative">
                                <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedMember(member); setIsFlipped(false); }}>
                                    <img src={photo} className="w-12 h-12 rounded-xl object-cover bg-slate-100" alt={name}/>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-brand-600">{name}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{role}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 border-l border-slate-100 pl-2">
                                    <button onClick={()=>handleEdit(member)} className="text-slate-400 hover:text-brand-600 p-1"><Icon name="Edit" size={14}/></button>
                                    <button onClick={()=>handleDelete(member.id)} className="text-slate-400 hover:text-red-600 p-1"><Icon name="Trash" size={14}/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="Users" size={32} className="mx-auto mb-2 opacity-20"/>
                    <p className="text-sm">No hay miembros.</p>
                </div>
            )}

            {/* Modal CREAR / EDITAR */}
            <Modal isOpen={isEditing} onClose={()=>setIsEditing(false)} title={form.id && localMembers.find(m=>m.id===form.id) ? "Editar Miembro" : "Nuevo Miembro"}>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex justify-center mb-4">
                        <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group cursor-pointer">
                            {form.photo ? <img src={form.photo} className="w-full h-full object-cover" /> : <Icon name="Camera" className="text-slate-400"/>}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-white font-bold">Pegar URL abajo</span>
                            </div>
                        </div>
                    </div>
                    
                    <Input label="URL Foto" value={form.photo} onChange={e=>setForm({...form, photo:e.target.value})} placeholder="https://..." />
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Nombre" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Rol</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                                <option>Miembro</option><option>Líder</option><option>Pastor</option><option>Músico</option><option>Maestro</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input type="date" label="Nacimiento" value={form.birthDate} onChange={e=>setForm({...form, birthDate:e.target.value})} />
                        <Input type="date" label="Fecha Ingreso" value={form.joinedDate} onChange={e=>setForm({...form, joinedDate:e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="549..." />
                        <Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
                    </div>
                    <Input label="Dirección" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Emergencia</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Contacto" value={form.emergencyContact} onChange={e=>setForm({...form, emergencyContact:e.target.value})} />
                            <Input label="Teléfono" value={form.emergencyPhone} onChange={e=>setForm({...form, emergencyPhone:e.target.value})} />
                        </div>
                    </div>
                    <Button className="w-full mt-4" onClick={handleSave}>Guardar Datos</Button>
                </div>
            </Modal>

            {/* Modal CREDENCIAL */}
            {selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="relative z-10 animate-enter flex flex-col items-center gap-6">
                        {renderCredential(selectedMember)}
                        <div className="flex gap-3">
                            <button onClick={() => setSelectedMember(null)} className="bg-white text-slate-800 px-5 py-2.5 rounded-full font-bold shadow-lg hover:bg-slate-50 transition-transform active:scale-95 text-xs flex items-center gap-2">
                                <Icon name="X" size={14}/> Cerrar
                            </button>
                            <button onClick={downloadPDF} disabled={isDownloading} className="bg-brand-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg hover:bg-brand-500 transition-transform active:scale-95 text-xs flex items-center gap-2 disabled:opacity-50">
                                {isDownloading ? <Icon name="Loader" className="animate-spin" size={14}/> : <Icon name="Download" size={14}/>}
                                {isDownloading ? 'Generando...' : 'Descargar PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


