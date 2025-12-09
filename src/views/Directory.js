window.Views = window.Views || {};

window.Views.Directory = ({ members, directory, addData, updateData, deleteData }) => {
    // 1. HOOKS
    const { useState, useMemo, useRef, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal } = Utils;

    // 2. ESTADOS
    const [localMembers, setLocalMembers] = useState([]);
    
    // Sincronizar datos entrantes
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

    // Referencia para el PDF (Elemento Oculto de Alta Calidad)
    const printRef = useRef(null);

    // 3. HELPERS
    const getField = (item, ...keys) => {
        for (let key of keys) if (item[key]) return item[key];
        return null;
    };

    const getPhoto = (photoUrl, name) => {
        if (photoUrl && photoUrl.length > 5) {
            // Fix Google Drive Links
            if (photoUrl.includes('drive.google.com')) {
                const idMatch = photoUrl.match(/[-\w]{25,}/);
                if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
            }
            return photoUrl;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0f172a&color=cbd5e1&size=512&font-size=0.33`;
    };

    const generateCustomID = (name) => {
        if (!name) return 'CDS-0000';
        const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `CDS-${initials}-${randomNum}`;
    };

    const openWhatsApp = (phone) => {
        if (!phone) return Utils.notify('Sin número', 'error');
        const p = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${p}`, '_blank');
    };
    
    const makeCall = (phone) => {
        if (!phone) return Utils.notify('Sin número', 'error');
        window.open(`tel:${phone}`, '_self');
    };

    const openMaps = (address) => {
        if (!address) return Utils.notify('Sin dirección', 'error');
        const q = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
    };

    // 4. CRUD LÓGICA (CORREGIDA)
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
        setForm({ ...initialForm, id: '', joinedDate: new Date().toISOString().split('T')[0] });
        setIsEditing(true);
    };

    const handleDelete = (id) => {
        if(!confirm("¿Eliminar miembro?")) return;
        if (typeof deleteData === 'function') deleteData('directory', id);
        setLocalMembers(prev => prev.filter(m => m.id !== id));
        if (selectedMember?.id === id) setSelectedMember(null);
        Utils.notify("Miembro eliminado");
    };

    const handleSave = () => {
        if (!form.name) return Utils.notify("Nombre obligatorio", 'error');
        
        let memberData = {
            ...form,
            id: form.id || generateCustomID(form.name), // Generar ID si es nuevo
            emergencyContact: form.emergencyContact || '', // Asegurar campo vacío string
            emergencyPhone: form.emergencyPhone || '',
            address: form.address || '',
            photo: form.photo || ''
        };

        const exists = localMembers.find(m => m.id === form.id);

        if (exists) {
            if (typeof updateData === 'function') updateData('directory', form.id, memberData);
            setLocalMembers(prev => prev.map(m => m.id === form.id ? memberData : m));
            // Actualizar modal abierto en tiempo real
            if(selectedMember && selectedMember.id === form.id) setSelectedMember(memberData);
            Utils.notify("Actualizado correctamente");
        } else {
            if (typeof addData === 'function') addData('directory', memberData);
            setLocalMembers(prev => [...prev, memberData]);
            Utils.notify("Creado correctamente");
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

    // PDF GENERATOR (SOLUCIONADO: USA REFERENCIA PLANA)
    const downloadPDF = async () => {
        if (!selectedMember || !printRef.current) return;
        setIsDownloading(true);

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
                
                const element = printRef.current;
                // Hacer visible temporalmente para la captura
                element.style.display = 'block'; 
                
                const opt = {
                    margin: 0,
                    filename: `Credencial_${selectedMember.name.replace(/\s+/g,'_')}.pdf`,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { scale: 3, useCORS: true, logging: false, backgroundColor: '#0f172a' },
                    jsPDF: { unit: 'mm', format: [55, 88], orientation: 'portrait' } 
                };
                
                await window.html2pdf().set(opt).from(element).save();
                
                // Ocultar de nuevo
                element.style.display = 'none';
                Utils.notify("PDF descargado");
            } catch (error) { 
                console.error(error); 
                Utils.notify("Error PDF", 'error'); 
            }
            setIsDownloading(false);
        }, 300);
    };

    // COMPONENTE DE TARJETA (Reutilizable para Vista y PDF)
    const CardContent = ({ m, isFront }) => {
        if (!m) return null;
        const id = m.id || generateCustomID(m.name);
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

        if (isFront) {
            return (
                <div className="w-full h-full bg-slate-900 relative overflow-hidden flex flex-col items-center border border-slate-700">
                    {/* Fondo Dark Blue Elegante */}
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 z-0"></div>
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute top-1/3 -left-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    {/* Header */}
                    <div className="relative z-10 w-full pt-6 px-4 text-center">
                        <p className="text-[9px] font-bold text-slate-400 tracking-[0.3em] uppercase mb-1">CONQUISTADORES</p>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{expirationYear}</h3>
                    </div>

                    {/* Foto Central con Anillo */}
                    <div className="relative z-10 mt-6 mb-4">
                        <div className="w-40 h-40 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-2xl shadow-blue-900/50">
                            <img src={photo} className="w-full h-full object-cover rounded-full bg-slate-800 border-4 border-slate-900" alt={name} crossOrigin="anonymous"/>
                        </div>
                        {/* Badge Rol */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 border border-blue-500/30 text-blue-400 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                            {role}
                        </div>
                    </div>

                    {/* Nombre y ID */}
                    <div className="relative z-10 text-center px-4 mb-auto">
                        <h1 className="text-2xl font-black text-white leading-tight mb-1 drop-shadow-md">{name}</h1>
                        <p className="text-[10px] font-mono text-slate-500">{id}</p>
                    </div>

                    {/* Footer QR */}
                    <div className="relative z-10 w-full px-6 pb-6 pt-4 mt-2 border-t border-white/5 bg-white/5 backdrop-blur-sm flex items-center justify-between">
                        <div className="text-left">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">VALIDÉZ</p>
                            <p className="text-xs font-bold text-white">DIC {expirationYear}</p>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg shadow-inner">
                            <img src={qrUrl} className="w-12 h-12" alt="QR" crossOrigin="anonymous"/>
                        </div>
                    </div>
                </div>
            );
        }

        // DORSO
        return (
            <div className="w-full h-full bg-slate-900 relative overflow-hidden flex flex-col p-6 border border-slate-700">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-slate-900 z-0"></div>
                
                <div className="relative z-10 text-center mb-6 mt-4">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-400 border border-white/10">
                        <Icon name="User" size={24}/>
                    </div>
                    <h3 className="font-bold text-white text-base tracking-wide">Datos Personales</h3>
                </div>

                <div className="relative z-10 space-y-4 flex-1">
                    {/* Botones */}
                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(phone)}} className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all">
                            <Icon name="MessageCircle" size={14} /> WhatsApp
                        </button>
                        <button onClick={(e)=>{e.stopPropagation(); makeCall(phone)}} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all">
                            <Icon name="Phone" size={14} /> Llamar
                        </button>
                    </div>

                    <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                        <div>
                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Teléfono</p>
                            <p className="text-sm text-slate-200 font-mono">{phone || '-'}</p>
                        </div>
                        <div onClick={(e)=>{e.stopPropagation(); openMaps(address)}} className={address ? "cursor-pointer hover:opacity-80" : ""}>
                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Dirección</p>
                            <p className={`text-xs text-slate-200 leading-tight ${address ? 'underline decoration-slate-600' : ''}`}>{address || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Email</p>
                            <p className="text-xs text-slate-200 break-all">{email || '-'}</p>
                        </div>
                    </div>

                    {(emerContact || emerPhone) && (
                        <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                            <p className="text-[9px] text-red-400 font-bold uppercase flex items-center gap-1 mb-1">
                                <Icon name="AlertTriangle" size={10}/> Emergencia
                            </p>
                            <p className="text-xs font-bold text-white">{emerContact}</p>
                            {emerPhone && <a href={`tel:${emerPhone}`} onClick={(e)=>e.stopPropagation()} className="text-xs text-red-300 block mt-0.5 font-mono">{emerPhone}</a>}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // --- RENDERIZADO PRINCIPAL ---
    return (
        <div className="space-y-6 fade-in pb-24 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Directorio</h2>
                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{localMembers.length}</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400"/>
                        <input className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500" placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
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
                                    <img src={photo} className="w-12 h-12 rounded-xl object-cover bg-slate-100" alt={name} />
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
            <Modal isOpen={isEditing} onClose={()=>setIsEditing(false)} title={form.id ? "Editar Miembro" : "Nuevo Miembro"}>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <Input label="Link Foto (Drive o URL)" value={form.photo} onChange={e=>setForm({...form, photo:e.target.value})} placeholder="https://..." />
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
                        <Input label="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
                        <Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
                    </div>
                    <Input label="Dirección" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Emergencia (Opcional)</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Contacto" value={form.emergencyContact} onChange={e=>setForm({...form, emergencyContact:e.target.value})} />
                            <Input label="Teléfono" value={form.emergencyPhone} onChange={e=>setForm({...form, emergencyPhone:e.target.value})} />
                        </div>
                    </div>
                    <Button className="w-full mt-4" onClick={handleSave}>Guardar Datos</Button>
                </div>
            </Modal>

            {/* ELEMENTO OCULTO SOLO PARA IMPRESIÓN PDF */}
            {selectedMember && (
                <div ref={printRef} style={{ display: 'none', width: '320px', height: '520px' }}>
                    <CardContent m={selectedMember} isFront={true} />
                </div>
            )}

            {/* Modal CREDENCIAL (Vista en pantalla) */}
            {selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="relative z-10 animate-enter flex flex-col items-center gap-6">
                        
                        {/* Tarjeta Giratoria */}
                        <div className="perspective-1000 w-[320px] h-[520px] cursor-pointer group select-none relative" onClick={() => !isDownloading && setIsFlipped(!isFlipped)}>
                            <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                                {/* Frente */}
                                <div className="absolute w-full h-full backface-hidden rounded-[20px] shadow-2xl overflow-hidden">
                                    <CardContent m={selectedMember} isFront={true} />
                                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-[9px] text-slate-500/50 flex items-center gap-1 z-50"><Icon name="RotateCw" size={10} /> Girar</div>
                                </div>
                                {/* Dorso */}
                                <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-[20px] shadow-2xl overflow-hidden">
                                    <CardContent m={selectedMember} isFront={false} />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSelectedMember(null)} className="bg-white text-slate-800 px-5 py-2.5 rounded-full font-bold shadow-lg hover:bg-slate-50 text-xs flex items-center gap-2">
                                <Icon name="X" size={14}/> Cerrar
                            </button>
                            <button onClick={downloadPDF} disabled={isDownloading} className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg hover:bg-blue-500 text-xs flex items-center gap-2 disabled:opacity-50">
                                {isDownloading ? <Icon name="Loader" className="animate-spin" size={14}/> : <Icon name="Download" size={14}/>}
                                {isDownloading ? 'Generando...' : 'Descargar PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
};


