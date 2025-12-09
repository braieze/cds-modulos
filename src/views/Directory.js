window.Views = window.Views || {};

window.Views.Directory = ({ members, directory, addData, updateData, deleteData }) => {
    // 1. HOOKS
    const { useState, useMemo, useRef, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal } = Utils;

    // 2. ESTADOS
    const [localMembers, setLocalMembers] = useState([]);
    
    // Sincronización con Base de Datos
    useEffect(() => {
        // Combinamos members o directory según lo que llegue de App.js
        const incoming = Array.isArray(members) ? members : (Array.isArray(directory) ? directory : []);
        setLocalMembers(incoming);
    }, [members, directory]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Formulario (Agregado campo 'area')
    const initialForm = { 
        id: '', name: '', role: 'Miembro', area: 'General', email: '', phone: '', 
        address: '', birthDate: '', emergencyContact: '', emergencyPhone: '', photo: '', joinedDate: '' 
    };
    const [form, setForm] = useState(initialForm);

    const printRef = useRef(null); // Referencia oculta para PDF HD

    // 3. HELPERS
    const getField = (item, ...keys) => {
        for (let key of keys) if (item[key]) return item[key];
        return null;
    };

    const getPhoto = (photoUrl, name) => {
        if (photoUrl && photoUrl.length > 5) {
            // Fix para Google Drive
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

    // Funciones de Contacto Corregidas
    const openWhatsApp = (phone, message = '') => {
        if (!phone) return Utils.notify('Sin número registrado', 'error');
        const p = phone.replace(/\D/g, ''); // Limpiar todo lo que no sea número
        const url = `https://wa.me/${p}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
        window.open(url, '_blank');
    };
    
    const makeCall = (phone) => {
        if (!phone) return Utils.notify('Sin número registrado', 'error');
        const p = phone.replace(/\D/g, '');
        window.location.href = `tel:${p}`;
    };

    const openMaps = (address) => {
        if (!address) return Utils.notify('Sin dirección registrada', 'error');
        const q = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
    };

    // 4. LÓGICA CRUD (Persistencia Firebase)
    const handleEdit = (member) => {
        setForm({
            id: member.id,
            name: getField(member, 'name', 'nombre') || '',
            role: getField(member, 'role', 'rol') || 'Miembro',
            area: getField(member, 'area', 'ministerio') || 'General',
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
        if(!confirm("¿Estás seguro de eliminar a este miembro permanentemente?")) return;
        
        // Llamada a la BD
        if (typeof deleteData === 'function') {
            deleteData('directory', id);
            Utils.notify("Eliminando...");
        } else {
            Utils.notify("Error: No hay conexión a BD", "error");
        }
        
        // Optimistic UI update
        setLocalMembers(prev => prev.filter(m => m.id !== id));
        if (selectedMember?.id === id) setSelectedMember(null);
    };

    const handleSave = () => {
        if (!form.name) return Utils.notify("El nombre es obligatorio", 'error');
        
        // LIMPIEZA DE DATOS (Crucial para Firebase)
        // Convertimos undefined a string vacíos
        const cleanData = {
            name: form.name || '',
            role: form.role || 'Miembro',
            area: form.area || 'General',
            email: form.email || '',
            phone: form.phone || '',
            address: form.address || '',
            birthDate: form.birthDate || '',
            emergencyContact: form.emergencyContact || '',
            emergencyPhone: form.emergencyPhone || '',
            photo: form.photo || '',
            joinedDate: form.joinedDate || '',
            updatedAt: new Date().toISOString()
        };

        const isNew = !form.id;
        const id = form.id || generateCustomID(form.name);
        
        // Objeto final con ID
        const finalPayload = { ...cleanData, id };

        if (!isNew) {
            // EDITAR
            if (typeof updateData === 'function') {
                updateData('directory', id, finalPayload);
                Utils.notify("Guardando cambios...");
            }
            // Actualizar estado local
            setLocalMembers(prev => prev.map(m => m.id === id ? finalPayload : m));
            if(selectedMember && selectedMember.id === id) setSelectedMember(finalPayload);
        } else {
            // CREAR
            finalPayload.createdAt = new Date().toISOString();
            if (typeof addData === 'function') {
                addData('directory', finalPayload);
                Utils.notify("Creando miembro...");
            }
            setLocalMembers(prev => [...prev, finalPayload]);
        }
        setIsEditing(false);
    };

    const filteredMembers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return localMembers.filter(m => {
            const name = getField(m, 'name', 'nombre') || '';
            const role = getField(m, 'role', 'rol') || '';
            const area = getField(m, 'area') || '';
            return name.toLowerCase().includes(term) || role.toLowerCase().includes(term) || area.toLowerCase().includes(term);
        });
    }, [localMembers, searchTerm]);

    // 5. GENERADOR PDF (Calidad HD)
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
                element.style.display = 'block'; // Mostrar para captura
                
                const opt = {
                    margin: 0,
                    filename: `Credencial_${selectedMember.name.replace(/\s+/g,'_')}.pdf`,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { scale: 4, useCORS: true, logging: false, backgroundColor: '#0f172a' },
                    // Tamaño exacto tarjeta CR80 (54mm x 86mm)
                    jsPDF: { unit: 'mm', format: [54, 86], orientation: 'portrait' } 
                };
                
                await window.html2pdf().set(opt).from(element).save();
                element.style.display = 'none'; // Ocultar
                Utils.notify("Credencial descargada");
            } catch (error) { 
                console.error(error); 
                Utils.notify("Error al generar PDF", 'error'); 
            }
            setIsDownloading(false);
        }, 500);
    };

    // --- TARJETA REUTILIZABLE (Vista y Print) ---
    const CardContent = ({ m, isFront }) => {
        if (!m) return null;
        
        // Datos
        const id = m.id || generateCustomID(m.name);
        const name = getField(m, 'name', 'nombre') || 'Sin Nombre';
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        const role = getField(m, 'role', 'rol') || 'Miembro';
        const area = getField(m, 'area') || 'General';
        const photo = getPhoto(getField(m, 'photo', 'foto'), name);
        const expirationYear = new Date().getFullYear();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;
        
        // Datos Privados
        const email = getField(m, 'email', 'correo');
        const phone = getField(m, 'phone', 'telefono');
        const address = getField(m, 'address', 'direccion');
        const emerContact = getField(m, 'emergencyContact', 'contactoEmergencia');
        const emerPhone = getField(m, 'emergencyPhone', 'telefonoEmergencia');

        // Color Base (Azul Oscuro Profundo)
        const BASE_COLOR = "bg-[#0f172a]";

        if (isFront) {
            return (
                <div className={`w-full h-full ${BASE_COLOR} relative overflow-hidden flex flex-col items-center border-4 border-slate-800`}>
                    
                    {/* Fondo y Efectos */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f172a] to-[#1e1b4b] z-0"></div>
                    <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="absolute top-1/3 -left-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none"></div>

                    {/* Header */}
                    <div className="relative z-10 w-full pt-8 px-5 flex flex-col items-center">
                        <p className="text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase mb-2">CONQUISTADORES</p>
                        <h2 className="text-sm font-black text-white uppercase tracking-widest border-b-2 border-brand-500 pb-1">CDS MI CASA</h2>
                    </div>

                    {/* Foto Central */}
                    <div className="relative z-10 mt-6 mb-4">
                        {/* Anillos decorativos */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] border border-blue-500/30 rounded-full animate-pulse"></div>
                        <div className="w-[140px] h-[140px] rounded-full p-1 bg-gradient-to-tr from-brand-500 to-indigo-600 shadow-2xl shadow-black/60">
                            <img src={photo} className="w-full h-full object-cover rounded-full bg-slate-800 border-2 border-slate-900" alt={name} crossOrigin="anonymous"/>
                        </div>
                        {/* Badge ROL */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-600 to-brand-500 text-white px-4 py-1 rounded-full shadow-lg border border-brand-400/50">
                            <span className="text-[10px] font-black uppercase tracking-widest">{role}</span>
                        </div>
                    </div>

                    {/* Datos Principales */}
                    <div className="relative z-10 text-center px-4 mb-auto mt-2">
                        <h1 className="text-2xl font-black text-white leading-none mb-1 drop-shadow-lg">{firstName}</h1>
                        <h2 className="text-xl font-bold text-slate-300 leading-tight mb-2">{lastName}</h2>
                        
                        {/* Área */}
                        <p className="text-[9px] font-bold text-brand-300 uppercase tracking-widest bg-brand-900/30 px-3 py-1 rounded-lg inline-block border border-brand-500/20">
                            {area}
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="relative z-10 w-full px-6 pb-6 pt-3 flex items-end justify-between mt-2">
                        <div className="text-left">
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">VENCIMIENTO</p>
                            <p className="text-base font-black text-white tracking-wider">DIC {expirationYear}</p>
                        </div>
                        <div className="bg-white p-1 rounded-lg shadow-lg">
                            <img src={qrUrl} className="w-12 h-12" alt="QR" crossOrigin="anonymous"/>
                        </div>
                    </div>
                </div>
            );
        }

        // DORSO
        return (
            <div className={`w-full h-full ${BASE_COLOR} relative overflow-hidden flex flex-col p-6 border-4 border-slate-800`}>
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] to-[#0f172a] z-0"></div>
                
                <div className="relative z-10 text-center mb-6 mt-4">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-brand-400 border border-white/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                        <Icon name="User" size={24}/>
                    </div>
                    <h3 className="font-bold text-white text-lg tracking-wide">Contacto</h3>
                </div>

                <div className="flex-1 space-y-4 relative z-10">
                    {/* Botones Grandes */}
                    <div className="grid grid-cols-1 gap-3">
                        <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(phone, `Hola ${name}, te escribo desde la App Conquistadores.`)}} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/50">
                            <Icon name="MessageCircle" size={16} /> Enviar WhatsApp
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={(e)=>{e.stopPropagation(); makeCall(phone)}} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2">
                                <Icon name="Phone" size={14} /> Llamar
                            </button>
                            <button onClick={(e)=>{e.stopPropagation(); openWhatsApp('5491100000000', `Hola, quiero agendar una visita con ${name}.`)}} className="bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 border border-brand-500/30 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2">
                                <Icon name="Calendar" size={14} /> Agendar Visita
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-3 mt-2">
                        <div>
                            <p className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">Dirección</p>
                            <div onClick={(e)=>{e.stopPropagation(); openMaps(address)}} className={address ? "cursor-pointer group" : ""}>
                                <p className={`text-xs text-slate-200 leading-tight ${address ? 'group-hover:text-blue-400 transition-colors' : ''}`}>{address || 'No registrada'}</p>
                            </div>
                        </div>
                        {(emerContact || emerPhone) && (
                            <div className="pt-2 border-t border-white/5">
                                <p className="text-[8px] text-red-400 font-bold uppercase flex items-center gap-1 mb-1">
                                    <Icon name="AlertTriangle" size={10}/> En caso de emergencia
                                </p>
                                <p className="text-xs font-bold text-white">{emerContact}</p>
                                <p className="text-xs text-red-300 font-mono tracking-wide">{emerPhone}</p>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="mt-auto text-center pt-4 border-t border-white/5">
                    <p className="text-[8px] text-slate-600">CDS MI CASA • 2025</p>
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
                        <Input label="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="549..." />
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

            {/* ELEMENTO OCULTO PARA PDF (CALIDAD HD - SOLO FRENTE - TAMAÑO TARJETA) */}
            {selectedMember && (
                <div ref={printRef} style={{ display: 'none', width: '340px', height: '540px' }}>
                    <CardContent m={selectedMember} isFront={true} />
                </div>
            )}

            {/* Modal CREDENCIAL (Vista en pantalla con giro) */}
            {selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="relative z-10 animate-enter flex flex-col items-center gap-6">
                        
                        <div className="perspective-1000 w-[320px] h-[520px] cursor-pointer group select-none relative" onClick={() => !isDownloading && setIsFlipped(!isFlipped)}>
                            <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                                
                                <div className="absolute w-full h-full backface-hidden rounded-[24px] shadow-2xl overflow-hidden bg-slate-900 border-4 border-slate-800">
                                    <CardContent m={selectedMember} isFront={true} />
                                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-[9px] text-slate-500 flex items-center gap-1 z-50 bg-slate-800/80 px-2 py-0.5 rounded-full"><Icon name="RotateCw" size={10} /> Girar</div>
                                </div>
                                
                                <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-[24px] shadow-2xl overflow-hidden bg-slate-900 border-4 border-slate-800">
                                    {/* Capa Bloqueo Visual */}
                                    <div className="absolute inset-0 bg-[#0f172a] z-[-1]"></div> 
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
                                {isDownloading ? 'Generando...' : 'Descargar Credencial'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
