window.Views = window.Views || {};

window.Views.Directory = ({ userProfile }) => {
    // 1. HOOKS
    const { useState, useMemo, useRef, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal } = Utils;

    // 2. ESTADOS
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Formulario
    const initialForm = { 
        name: '', role: 'Miembro', area: 'General', email: '', phone: '', 
        address: '', birthDate: '', emergencyContact: '', emergencyPhone: '', photo: '', joinedDate: '' 
    };
    const [form, setForm] = useState(initialForm);
    const [formId, setFormId] = useState(null);

    // Referencias
    const printRef = useRef(null); // Referencia oculta para PDF

    // 3. CONEXIÓN DIRECTA A FIREBASE (CRUCIAL PARA QUE GUARDE)
    useEffect(() => {
        if (!window.db) {
            console.error("Error crítico: No hay conexión a Firebase (window.db es undefined).");
            setLoading(false);
            return;
        }

        // Escuchar cambios en tiempo real
        const unsubscribe = window.db.collection('directory').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMembers(data);
            setLoading(false);
        }, error => {
            console.error("Error Firebase:", error);
            Utils.notify("Error de conexión", "error");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 4. HELPERS
    const getPhoto = (photoUrl, name) => {
        if (photoUrl && photoUrl.length > 10) {
            // Intento de fix para Google Drive
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

    const openWhatsApp = (phone, message = '') => {
        if (!phone) return Utils.notify('Sin número', 'error');
        const p = phone.replace(/\D/g, ''); 
        window.open(`https://wa.me/${p}${message ? `?text=${encodeURIComponent(message)}` : ''}`, '_blank');
    };
    
    const makeCall = (phone) => {
        if (!phone) return Utils.notify('Sin número', 'error');
        window.location.href = `tel:${phone.replace(/\D/g, '')}`;
    };

    const openMaps = (address) => {
        if (!address) return Utils.notify('Sin dirección', 'error');
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    // 5. CRUD DIRECTO (GUARDA SÍ O SÍ)
    const handleEdit = (member) => {
        setForm({
            name: member.name || '',
            role: member.role || 'Miembro',
            area: member.area || 'General',
            email: member.email || '',
            phone: member.phone || '',
            address: member.address || '',
            birthDate: member.birthDate || '',
            emergencyContact: member.emergencyContact || '',
            emergencyPhone: member.emergencyPhone || '',
            photo: member.photo || '',
            joinedDate: member.joinedDate || ''
        });
        setFormId(member.id);
        setIsEditing(true);
    };

    const handleNew = () => {
        setForm({ ...initialForm, joinedDate: new Date().toISOString().split('T')[0] });
        setFormId(null);
        setIsEditing(true);
    };

    const handleDelete = async (id) => {
        if(!confirm("¿Eliminar definitivamente?")) return;
        try {
            await window.db.collection('directory').doc(id).delete();
            Utils.notify("Eliminado");
            if (selectedMember?.id === id) setSelectedMember(null);
        } catch (e) {
            console.error(e);
            Utils.notify("Error al eliminar", "error");
        }
    };

    const handleSave = async () => {
        if (!form.name) return Utils.notify("Nombre obligatorio", 'error');
        
        // Limpiamos datos undefined
        const cleanData = Object.keys(form).reduce((acc, key) => {
            acc[key] = form[key] === undefined ? '' : form[key];
            return acc;
        }, {});

        // ID Personalizado
        if (!cleanData.credentialId) {
            cleanData.credentialId = generateCustomID(cleanData.name);
        }

        try {
            if (formId) {
                // UPDATE
                await window.db.collection('directory').doc(formId).update(cleanData);
                if(selectedMember && selectedMember.id === formId) setSelectedMember({id: formId, ...cleanData});
                Utils.notify("Guardado");
            } else {
                // CREATE
                cleanData.createdAt = new Date().toISOString();
                await window.db.collection('directory').add(cleanData);
                Utils.notify("Creado");
            }
            setIsEditing(false);
        } catch (e) {
            console.error("Error guardando:", e);
            Utils.notify("Error al guardar. Revisa la consola.", "error");
        }
    };

    const filteredMembers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return members.filter(m => {
            const name = m.name || '';
            const role = m.role || '';
            const area = m.area || '';
            return name.toLowerCase().includes(term) || role.toLowerCase().includes(term) || area.toLowerCase().includes(term);
        });
    }, [members, searchTerm]);

    // 6. PDF GENERATOR (USANDO ELEMENTO OCULTO PARA QUE NO SALGA BLANCO)
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
                element.style.display = 'block'; // Mostrar solo para la foto
                
                const opt = {
                    margin: 0,
                    filename: `Credencial_${selectedMember.name.replace(/\s+/g,'_')}.pdf`,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { 
                        scale: 4, 
                        useCORS: true, 
                        logging: false,
                        allowTaint: true 
                    },
                    jsPDF: { unit: 'mm', format: [54, 86], orientation: 'portrait' } 
                };
                
                await window.html2pdf().set(opt).from(element).save();
                element.style.display = 'none'; // Ocultar
                Utils.notify("PDF Descargado");
            } catch (error) { 
                console.error(error); 
                Utils.notify("Error PDF (Posible bloqueo de imagen)", 'error'); 
            }
            setIsDownloading(false);
        }, 500);
    };

    // --- TARJETA VISUAL (DISEÑO SOLICITADO) ---
    const CardContent = ({ m, isFront }) => {
        if (!m) return null;
        
        const id = m.credentialId || 'CDS-0000';
        const name = m.name || 'Sin Nombre';
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        const role = m.role || 'Miembro';
        const area = m.area || 'General';
        const photo = getPhoto(m.photo, name);
        const expirationYear = new Date().getFullYear();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${m.id}`;
        
        // Color Azul Oscuro Profundo
        const DARK_BG = "bg-[#0f172a]"; 

        if (isFront) {
            return (
                <div className="w-full h-full bg-white relative overflow-hidden flex flex-col items-center select-none">
                    
                    {/* --- PARTE SUPERIOR (BLANCA) --- */}
                    <div className="w-full h-[55%] bg-white relative pt-6 text-center z-10">
                        {/* Header */}
                        <div className="flex flex-col items-center mb-1">
                            <div className="h-1 w-8 bg-slate-200 rounded-full mb-2"></div>
                            <p className="text-[9px] font-black text-slate-400 tracking-[0.25em] uppercase">CONQUISTADORES</p>
                            <h2 className="text-base font-bold text-blue-600 uppercase tracking-wider mt-0.5">Credencial Digital</h2>
                            <p className="text-[10px] font-bold text-slate-800">{expirationYear}</p>
                        </div>

                        {/* Foto Circular (Superpuesta en el borde) */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-[65px] z-20">
                            <div className="w-[140px] h-[140px] rounded-full p-1.5 bg-white shadow-xl shadow-slate-400/20">
                                <img src={photo} className="w-full h-full object-cover rounded-full bg-slate-100" alt={name} crossOrigin="anonymous"/>
                            </div>
                        </div>
                    </div>

                    {/* --- PARTE INFERIOR (AZUL OSCURO) --- */}
                    <div className={`w-full h-[45%] ${DARK_BG} relative flex flex-col items-center justify-end pb-5 px-6 z-0`}>
                        {/* Curva de Unión */}
                        <div className="absolute top-[-1px] left-0 w-full h-12 bg-[#0f172a] rounded-t-[50%] scale-x-150 -translate-y-1 z-0"></div>

                        {/* Datos Texto */}
                        <div className="relative z-10 text-center mt-10 mb-auto">
                            <h1 className="text-2xl font-bold text-white leading-none mb-1 drop-shadow-md">{firstName}</h1>
                            <h2 className="text-xl font-bold text-blue-400 leading-tight mb-2 drop-shadow-md">{lastName}</h2>
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest border border-slate-600 px-3 py-1 rounded-full">{role} - {area}</span>
                        </div>

                        {/* Footer ID y QR */}
                        <div className="relative z-10 w-full bg-white/5 rounded-xl p-2 border border-white/10 flex items-center justify-between backdrop-blur-sm">
                            <div className="text-left pl-1">
                                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ID ÚNICO</p>
                                <p className="text-xs font-mono font-bold text-white tracking-widest">{id}</p>
                                <p className="text-[7px] font-bold text-blue-400 uppercase mt-0.5 tracking-wider">CDS MI CASA</p>
                            </div>
                            <div className="bg-white p-1 rounded-md">
                                <img src={qrUrl} className="w-10 h-10" alt="QR" crossOrigin="anonymous"/>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // DORSO
        return (
            <div className={`w-full h-full ${DARK_BG} relative overflow-hidden flex flex-col p-6`}>
                {/* FONDO SOLIDO DE SEGURIDAD */}
                <div className={`absolute inset-0 ${DARK_BG} z-0`}></div>
                
                <div className="relative z-10 text-center mb-4 mt-2">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-400 border border-white/10">
                        <Icon name="User" size={24}/>
                    </div>
                    <h3 className="font-bold text-white text-base tracking-wide">Datos de Contacto</h3>
                </div>

                <div className="relative z-10 flex-1 space-y-3">
                    {/* Botones */}
                    <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(m.phone)}} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg border border-emerald-500/30">
                        <Icon name="MessageCircle" size={16} /> Enviar WhatsApp
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={(e)=>{e.stopPropagation(); makeCall(m.phone)}} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2">
                            <Icon name="Phone" size={14} /> Llamar
                        </button>
                        <button onClick={(e)=>{e.stopPropagation(); openWhatsApp('5491136278857', `Hola, soy ${name}, quiero agendar una visita pastoral.`)}} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2">
                            <Icon name="Calendar" size={14} /> Agendar Visita
                        </button>
                    </div>

                    <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2 mt-1">
                        <div>
                            <p className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">Teléfono</p>
                            <p className="text-sm text-slate-200 font-mono">{m.phone || 'No registrado'}</p>
                        </div>
                        <div onClick={(e)=>{e.stopPropagation(); openMaps(m.address)}} className={m.address ? "cursor-pointer group" : ""}>
                            <p className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">Dirección</p>
                            <p className={`text-xs text-slate-200 leading-tight ${m.address ? 'group-hover:text-blue-400 transition-colors' : ''}`}>{m.address || 'No registrada'}</p>
                        </div>
                        {(m.emergencyContact || m.emergencyPhone) && (
                            <div className="pt-2 border-t border-white/5">
                                <p className="text-[8px] text-red-400 font-bold uppercase flex items-center gap-1 mb-1">
                                    <Icon name="AlertTriangle" size={10}/> En caso de emergencia
                                </p>
                                <p className="text-xs font-bold text-white">{m.emergencyContact}</p>
                                <p className="text-xs text-red-300 font-mono tracking-wide">{m.emergencyPhone}</p>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="mt-auto text-center pt-3 border-t border-white/5 relative z-10">
                    <p className="text-[8px] text-slate-500">CDS MI CASA • {expirationYear}</p>
                </div>
            </div>
        );
    };

    // --- RENDERIZADO PRINCIPAL ---
    return (
        <div className="space-y-6 fade-in pb-24 font-sans text-slate-800">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Directorio</h2>
                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{members.length}</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400"/>
                        <input className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500" placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    </div>
                    <Button icon="UserPlus" onClick={handleNew}>Nuevo</Button>
                </div>
            </div>

            {loading && <div className="text-center py-10 text-slate-400">Cargando base de datos...</div>}

            {/* Grid */}
            {!loading && filteredMembers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMembers.map(member => {
                        const photo = getPhoto(member.photo, member.name);
                        return (
                            <div key={member.id} className="group bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all flex items-center gap-3 relative">
                                <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedMember(member); setIsFlipped(false); }}>
                                    <img src={photo} className="w-12 h-12 rounded-xl object-cover bg-slate-100" alt={member.name} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-brand-600">{member.name}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{member.role}</p>
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
            ) : (!loading &&
                <div className="text-center py-12 text-slate-400">
                    <Icon name="Users" size={32} className="mx-auto mb-2 opacity-20"/>
                    <p className="text-sm">No se encontraron miembros.</p>
                </div>
            )}

            {/* Modal CREAR / EDITAR */}
            <Modal isOpen={isEditing} onClose={()=>setIsEditing(false)} title={formId ? "Editar Miembro" : "Nuevo Miembro"}>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <Input label="Link Foto (URL o Drive)" value={form.photo} onChange={e=>setForm({...form, photo:e.target.value})} placeholder="https://..." />
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Nombre Completo" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Rol / Cargo</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                                <option>Miembro</option><option>Líder</option><option>Pastor</option><option>Músico</option><option>Maestro</option><option>Diácono</option><option>Servidor</option>
                            </select>
                        </div>
                    </div>
                    <Input label="Área / Ministerio" value={form.area} onChange={e=>setForm({...form, area:e.target.value})} placeholder="Ej: Alabanza, Jóvenes, Niños" />
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="Ej: 54911..." />
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
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Input type="date" label="Nacimiento" value={form.birthDate} onChange={e=>setForm({...form, birthDate:e.target.value})} />
                        <Input type="date" label="Ingreso" value={form.joinedDate} onChange={e=>setForm({...form, joinedDate:e.target.value})} />
                    </div>
                    <Button className="w-full mt-4" onClick={handleSave}>Guardar Datos</Button>
                </div>
            </Modal>

            {/* ELEMENTO OCULTO PARA PDF (CALIDAD HD - SOLO FRENTE - PLANO) */}
            {selectedMember && (
                <div ref={printRef} style={{ display: 'none', width: '340px', height: '540px' }}>
                    <CardContent m={selectedMember} isFront={true} />
                </div>
            )}

            {/* Modal CREDENCIAL (Vista en pantalla con giro 3D) */}
            {selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="relative z-10 animate-enter flex flex-col items-center gap-6">
                        
                        {/* Contenedor 3D */}
                        <div className="perspective-1000 w-[320px] h-[520px] cursor-pointer group select-none relative" onClick={() => !isDownloading && setIsFlipped(!isFlipped)}>
                            <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                                
                                {/* Frente */}
                                <div className="absolute w-full h-full backface-hidden rounded-[24px] shadow-2xl overflow-hidden bg-white border border-slate-200">
                                    <CardContent m={selectedMember} isFront={true} />
                                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-[9px] text-white/50 flex items-center gap-1 z-50 bg-black/20 px-2 py-0.5 rounded-full"><Icon name="RotateCw" size={10} /> Girar</div>
                                </div>
                                
                                {/* Dorso */}
                                <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-[24px] shadow-2xl overflow-hidden bg-[#0f172a] border border-slate-800">
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
                                {isDownloading ? 'Generando...' : 'Descargar PDF (Solo Frente)'}
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
