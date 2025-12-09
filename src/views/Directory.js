window.Views = window.Views || {};

window.Views.Directory = ({ members, addData, updateData, deleteData }) => {
    // 1. HOOKS
    const { useState, useMemo, useRef } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal, Select } = Utils;

    // 2. ESTADOS
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); // Para ver credencial
    const [isEditing, setIsEditing] = useState(false); // Para crear/editar
    const [isFlipped, setIsFlipped] = useState(false); // Efecto 3D
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Estado del Formulario
    const initialForm = { 
        id: '', name: '', role: 'Miembro', ministry: 'General', email: '', phone: '', 
        address: '', birthDate: '', emergencyContact: '', emergencyPhone: '', photo: '', joinedDate: '' 
    };
    const [form, setForm] = useState(initialForm);

    // Referencia oculta para generar el PDF limpio
    const printRef = useRef(null);

    // 3. HELPERS
    const getField = (item, ...keys) => {
        if(!item) return null;
        for (let key of keys) if (item[key] !== undefined) return item[key];
        return null;
    };

    const getPhoto = (photoUrl, name) => {
        if (photoUrl && photoUrl.length > 10) {
            // Fix para enlaces de Google Drive
            if (photoUrl.includes('drive.google.com')) {
                const idMatch = photoUrl.match(/[-\w]{25,}/);
                if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
            }
            return photoUrl;
        }
        // Avatar por defecto si no hay foto
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0f172a&color=cbd5e1&size=512&font-size=0.33`;
    };

    // Generador de ID Personalizado (CDS + Iniciales + Random)
    const generateCustomID = (name) => {
        if (!name) return 'CDS-0000';
        const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `CDS-${initials}-${randomNum}`;
    };

    const openWhatsApp = (phone, message = '') => {
        if (!phone) return Utils.notify('Sin número registrado', 'error');
        const p = phone.replace(/\D/g, ''); 
        window.open(`https://wa.me/${p}${message ? `?text=${encodeURIComponent(message)}` : ''}`, '_blank');
    };
    
    const makeCall = (phone) => {
        if (!phone) return Utils.notify('Sin número registrado', 'error');
        window.location.href = `tel:${phone.replace(/\D/g, '')}`;
    };

    const openMaps = (address) => {
        if (!address) return Utils.notify('Sin dirección registrada', 'error');
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    // 4. LÓGICA CRUD (Conectada a colección 'members')
    const handleEdit = (member) => {
        // Rellenar formulario con datos existentes o defaults
        setForm({
            id: member.id,
            name: getField(member, 'name', 'nombre') || '',
            role: getField(member, 'role', 'rol') || 'Miembro',
            ministry: getField(member, 'ministry', 'area', 'ministerio') || 'General',
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
        setForm({ ...initialForm, joinedDate: new Date().toISOString().split('T')[0] });
        setIsEditing(true);
    };

    const handleDelete = (id) => {
        if(!confirm("¿Estás seguro de eliminar a este miembro permanentemente?")) return;
        deleteData('members', id); // USAMOS LA COLECCIÓN CORRECTA 'members'
        if (selectedMember?.id === id) setSelectedMember(null);
        Utils.notify("Miembro eliminado");
    };

    const handleSave = () => {
        if (!form.name) return Utils.notify("El nombre es obligatorio", 'error');
        
        // 1. Limpieza de datos (undefined -> string vacío)
        const cleanData = {
            name: form.name || '',
            role: form.role || 'Miembro',
            ministry: form.ministry || 'General',
            email: form.email || '',
            phone: form.phone || '',
            address: form.address || '',
            birthDate: form.birthDate || '',
            emergencyContact: form.emergencyContact || '',
            emergencyPhone: form.emergencyPhone || '',
            photo: form.photo || '',
            joinedDate: form.joinedDate || '',
            // Si no tiene credentialId, lo generamos una sola vez
            credentialId: form.credentialId || generateCustomID(form.name)
        };

        if (form.id) {
            // EDITAR
            updateData('members', form.id, cleanData);
            // Actualizar vista modal si está abierta
            if(selectedMember && selectedMember.id === form.id) {
                setSelectedMember({ id: form.id, ...cleanData });
            }
            Utils.notify("Cambios guardados");
        } else {
            // CREAR
            cleanData.createdAt = new Date().toISOString();
            addData('members', cleanData);
            Utils.notify("Miembro registrado");
        }
        setIsEditing(false);
    };

    // Filtro de Búsqueda
    const filteredMembers = (members || []).filter(m => {
        const term = searchTerm.toLowerCase();
        const name = (m.name || '').toLowerCase();
        const role = (m.role || '').toLowerCase();
        return name.includes(term) || role.includes(term);
    });

    // 5. GENERADOR PDF (Usando referencia oculta plana)
    const downloadPDF = async () => {
        if (!selectedMember || !printRef.current) return;
        setIsDownloading(true);

        // Pequeño delay para asegurar que el DOM oculto se renderice
        setTimeout(async () => {
            try {
                const element = printRef.current;
                element.style.display = 'block'; // Mostrar temporalmente
                
                const opt = {
                    margin: 0,
                    filename: `Credencial_${selectedMember.name.replace(/\s+/g,'_')}.pdf`,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { scale: 4, useCORS: true, logging: false, backgroundColor: '#0f172a' },
                    jsPDF: { unit: 'mm', format: [54, 86], orientation: 'portrait' } // Tamaño CR80 exacto
                };
                
                await window.html2pdf().set(opt).from(element).save();
                
                element.style.display = 'none'; // Ocultar de nuevo
                Utils.notify("Credencial descargada");
            } catch (error) { 
                console.error(error); 
                Utils.notify("Error al generar PDF", 'error'); 
            }
            setIsDownloading(false);
        }, 500);
    };

    // --- TARJETA REUTILIZABLE (Componente Visual) ---
    // Este componente dibuja la credencial. Se usa para verla en pantalla (3D) y para imprimirla (Plana)
    const CardContent = ({ m, isFront }) => {
        if (!m) return null;
        
        const id = m.credentialId || generateCustomID(m.name); // Fallback si es viejo
        const name = m.name || 'Sin Nombre';
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        const role = m.role || 'Miembro';
        const ministry = m.ministry || 'General';
        const photo = getPhoto(m.photo, name);
        const expirationYear = new Date().getFullYear();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${m.id}`; // QR apunta al ID real de Firebase
        
        // Color Azul Oscuro Profundo (Tu "Dark Blue")
        const DARK_BG = "bg-[#0f172a]"; 

        if (isFront) {
            return (
                <div className="w-full h-full bg-white relative overflow-hidden flex flex-col items-center select-none font-sans">
                    
                    {/* PARTE SUPERIOR (BLANCA) */}
                    <div className="w-full h-[50%] bg-white relative pt-6 text-center z-10">
                        {/* Header */}
                        <div className="flex flex-col items-center">
                            <div className="h-1 w-8 bg-slate-200 rounded-full mb-1"></div>
                            <p className="text-[8px] font-black text-slate-400 tracking-[0.25em] uppercase">CONQUISTADORES</p>
                            <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Credencial Digital</h2>
                            <p className="text-[9px] font-bold text-slate-800">{expirationYear}</p>
                        </div>

                        {/* Foto Circular Grande (Superpuesta en el borde) */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-[60px] z-20">
                            <div className="w-[120px] h-[120px] rounded-full p-1 bg-white shadow-xl">
                                <img src={photo} className="w-full h-full object-cover rounded-full bg-slate-100" alt={name} crossOrigin="anonymous"/>
                            </div>
                        </div>
                    </div>

                    {/* PARTE INFERIOR (AZUL OSCURO - MISMO TONO QUE DORSO) */}
                    <div className={`w-full h-[50%] ${DARK_BG} relative flex flex-col items-center justify-end pb-4 px-5 z-0`}>
                        {/* Curva de Unión (Efecto visual) */}
                        <div className={`absolute top-[-1px] left-0 w-full h-12 ${DARK_BG} rounded-t-[50%] scale-x-150 -translate-y-1/2 z-0`}></div>

                        {/* Datos Texto */}
                        <div className="relative z-10 text-center mt-12 mb-auto">
                            <h1 className="text-xl font-black text-white leading-none mb-1 drop-shadow-md">{firstName}</h1>
                            <h2 className="text-lg font-bold text-blue-400 leading-tight mb-2 drop-shadow-md">{lastName}</h2>
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest border border-slate-600 px-3 py-1 rounded-full">{role}</span>
                        </div>

                        {/* Footer ID y QR */}
                        <div className="relative z-10 w-full bg-white/10 rounded-xl p-2 border border-white/5 flex items-center justify-between backdrop-blur-sm">
                            <div className="text-left pl-1">
                                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ID ÚNICO</p>
                                <p className="text-[10px] font-mono font-bold text-white tracking-widest uppercase">{id}</p>
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

        // DORSO (AZUL OSCURO SÓLIDO)
        return (
            <div className={`w-full h-full ${DARK_BG} relative overflow-hidden flex flex-col p-6 font-sans`}>
                {/* Fondo Sólido de Seguridad */}
                <div className={`absolute inset-0 ${DARK_BG} z-0`}></div>
                
                <div className="relative z-10 text-center mb-4 mt-2">
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-400 border border-white/10">
                        <Icon name="User" size={20}/>
                    </div>
                    <h3 className="font-bold text-white text-base tracking-wide">Datos de Contacto</h3>
                </div>

                <div className="relative z-10 flex-1 space-y-3">
                    {/* Botones */}
                    <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(m.phone)}} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg border border-emerald-500/30">
                        <Icon name="MessageCircle" size={14} /> Enviar WhatsApp
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={(e)=>{e.stopPropagation(); makeCall(m.phone)}} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-2 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2">
                            <Icon name="Phone" size={14} /> Llamar
                        </button>
                        <button onClick={(e)=>{e.stopPropagation(); openWhatsApp('5491136278857', `Hola, soy ${name}, quiero agendar una visita pastoral.`)}} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 py-2 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2">
                            <Icon name="Calendar" size={14} /> Agendar Visita
                        </button>
                    </div>

                    <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2 mt-2">
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
                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{members ? members.length : 0}</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400"/>
                        <input className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500" placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    </div>
                    <Button icon="Plus" onClick={handleNew}>Nuevo</Button>
                </div>
            </div>

            {/* Grid */}
            {filteredMembers.length > 0 ? (
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
                        <Input label="Nombre Completo" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Rol / Cargo</label>
                            <Select value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                                <option>Miembro</option><option>Líder</option><option>Pastor</option><option>Músico</option><option>Maestro</option><option>Diácono</option><option>Servidor</option>
                            </Select>
                        </div>
                    </div>
                    <Input label="Área / Ministerio" value={form.ministry} onChange={e=>setForm({...form, ministry:e.target.value})} placeholder="Ej: Alabanza, Jóvenes..." />
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="54911..." />
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
                                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-[9px] text-slate-400 flex items-center gap-1 z-50 bg-white/20 px-2 py-0.5 rounded-full"><Icon name="RotateCw" size={10} /> Girar</div>
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
                                {isDownloading ? 'Generando...' : 'Descargar Credencial'}
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
            }</style>
        </div>
    );
};
