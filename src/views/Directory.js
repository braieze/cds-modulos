window.Views = window.Views || {};

window.Views.Directory = ({ members, addData, updateData, deleteData }) => {
    // 1. HOOKS
    const { useState, useMemo, useRef, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal, Select } = Utils;

    // 2. ESTADOS
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); 
    const [isEditing, setIsEditing] = useState(false); 
    const [isFlipped, setIsFlipped] = useState(false); 
    const [isDownloading, setIsDownloading] = useState(false);
    
    const initialForm = { 
        id: '', name: '', role: 'Miembro', ministry: 'General', email: '', phone: '', 
        address: '', birthDate: '', emergencyContact: '', emergencyPhone: '', photo: '', joinedDate: '' 
    };
    const [form, setForm] = useState(initialForm);

    const printRef = useRef(null); // Referencia oculta para el PDF

    // 3. HELPERS
    const getField = (item, ...keys) => {
        if(!item) return null;
        for (let key of keys) if (item[key] !== undefined) return item[key];
        return null;
    };

    const getPhoto = (photoUrl, name) => {
        if (photoUrl && photoUrl.length > 10) {
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

    // 4. CRUD
    const handleEdit = (member) => {
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
        if(!confirm("¿Eliminar miembro?")) return;
        deleteData('members', id);
        if (selectedMember?.id === id) setSelectedMember(null);
        Utils.notify("Miembro eliminado");
    };

    const handleSave = () => {
        if (!form.name) return Utils.notify("Nombre obligatorio", 'error');
        
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
            credentialId: form.credentialId || generateCustomID(form.name)
        };

        if (form.id) {
            updateData('members', form.id, cleanData);
            if(selectedMember && selectedMember.id === form.id) setSelectedMember({ id: form.id, ...cleanData });
            Utils.notify("Actualizado");
        } else {
            cleanData.createdAt = new Date().toISOString();
            addData('members', cleanData);
            Utils.notify("Creado");
        }
        setIsEditing(false);
    };

    const filteredMembers = (members || []).filter(m => {
        const term = searchTerm.toLowerCase();
        return (m.name||'').toLowerCase().includes(term) || (m.role||'').toLowerCase().includes(term);
    });

    // 5. PDF ROBUSTO (Carga Dinámica Segura)
    const downloadPDF = async () => {
        if (!selectedMember || !printRef.current) return;
        setIsDownloading(true);

        try {
            // Asegurar carga de librería
            if (!window.html2pdf) {
                console.log("Cargando librería PDF...");
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject("Error al cargar script PDF");
                    document.head.appendChild(script);
                });
            }

            // Esperar un momento a que el script se inicialice
            await new Promise(r => setTimeout(r, 500));

            const element = printRef.current;
            element.style.display = 'block'; // Mostrar temporalmente
            
            const opt = {
                margin: 0,
                filename: `Credencial_${selectedMember.name.replace(/\s+/g,'_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 4, 
                    useCORS: true, 
                    logging: false,
                    backgroundColor: '#ffffff' // Fondo base blanco
                },
                jsPDF: { unit: 'mm', format: [54, 86], orientation: 'portrait' }
            };
            
            if (window.html2pdf) {
                await window.html2pdf().set(opt).from(element).save();
                Utils.notify("PDF Descargado");
            } else {
                alert("Error: La librería PDF no está disponible.");
            }
            
            element.style.display = 'none'; // Ocultar
        } catch (error) { 
            console.error("PDF Error:", error); 
            Utils.notify("Error al generar PDF. Intenta de nuevo.", 'error'); 
        } finally {
            setIsDownloading(false);
        }
    };

    // --- TARJETA VISUAL (DISEÑO SPLIT) ---
    const CardContent = ({ m, isFront }) => {
        if (!m) return null;
        
        const id = m.credentialId || generateCustomID(m.name);
        const nameParts = (m.name || 'Sin Nombre').split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        const role = m.role || 'Miembro';
        const ministry = m.ministry || 'General';
        const photo = getPhoto(m.photo, m.name);
        const year = new Date().getFullYear();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${m.id}`;
        
        // Color Azul Oscuro Profundo (El mismo de atrás)
        const DARK_BG = "bg-[#0f172a]"; // Slate 900 personalizado

        if (isFront) {
            return (
                <div className="w-full h-full bg-white relative overflow-hidden flex flex-col items-center select-none font-sans">
                    
                    {/* --- PARTE SUPERIOR (BLANCA) --- */}
                    {/* Ocupa el 60% para dejar espacio a la foto y textos superiores */}
                    <div className="w-full h-[55%] bg-white relative pt-8 text-center z-10 flex flex-col items-center">
                        {/* Header */}
                        <div className="mb-1">
                            <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto mb-2"></div>
                            <p className="text-[8px] font-black text-slate-400 tracking-[0.25em] uppercase mb-1">CONQUISTADORES</p>
                            <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Credencial Digital</h2>
                            <p className="text-[9px] font-bold text-slate-800">{year}</p>
                        </div>
                    </div>

                    {/* FOTO CENTRAL (FLOTANTE) */}
                    {/* Posicionada absolutamente para estar ENTRE las dos secciones */}
                    <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                        <div className="w-[140px] h-[140px] rounded-full p-1.5 bg-white shadow-xl shadow-slate-900/20">
                            <img src={photo} className="w-full h-full object-cover rounded-full bg-slate-100 border-2 border-slate-50" alt={m.name} crossOrigin="anonymous"/>
                        </div>
                    </div>

                    {/* --- PARTE INFERIOR (AZUL OSCURO) --- */}
                    {/* Ocupa el resto, fondo sólido oscuro */}
                    <div className={`w-full h-[45%] ${DARK_BG} relative flex flex-col items-center justify-end pb-6 px-5 z-0`}>
                        
                        {/* Curva de Unión (Efecto Visual) */}
                        {/* Esto crea la onda suave entre el blanco y el azul */}
                        <div className={`absolute top-[-1px] left-0 w-full h-16 ${DARK_BG} rounded-t-[50%] scale-x-150 -translate-y-1/2 z-0`}></div>

                        {/* Datos Texto (Sobre fondo oscuro) */}
                        <div className="relative z-10 text-center mt-12 mb-auto w-full">
                            <h1 className="text-2xl font-black text-white leading-none mb-1 drop-shadow-md">{firstName}</h1>
                            <h2 className="text-xl font-bold text-blue-400 leading-tight mb-3 drop-shadow-md">{lastName}</h2>
                            
                            {/* Badge ROL */}
                            <span className="inline-block bg-slate-800 border border-slate-600 text-white px-5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                                {role}
                            </span>
                        </div>

                        {/* Footer ID y QR */}
                        <div className="relative z-10 w-full bg-white/5 rounded-xl p-2.5 border border-white/10 flex items-center justify-between backdrop-blur-sm mt-2">
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
            <div className={`w-full h-full ${DARK_BG} relative overflow-hidden flex flex-col p-6 font-sans text-white`}>
                <div className={`absolute inset-0 ${DARK_BG} z-0`}></div>
                
                <div className="relative z-10 text-center mb-6 mt-4">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-400 border border-white/10 shadow-lg">
                        <Icon name="User" size={22}/>
                    </div>
                    <h3 className="font-bold text-white text-base tracking-wide uppercase">Contacto</h3>
                </div>

                <div className="relative z-10 flex-1 space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-white/10 space-y-3 backdrop-blur-sm">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                            <div className="text-blue-400"><Icon name="Phone" size={14}/></div>
                            <div className="flex-1">
                                <p className="text-[8px] text-slate-400 uppercase font-bold">Teléfono</p>
                                <p className="text-sm font-mono">{m.phone || 'No registrado'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                            <div className="text-blue-400"><Icon name="Mail" size={14}/></div>
                            <div className="flex-1">
                                <p className="text-[8px] text-slate-400 uppercase font-bold">Email</p>
                                <p className="text-xs truncate">{m.email || 'No registrado'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-blue-400"><Icon name="MapPin" size={14}/></div>
                            <div className="flex-1 cursor-pointer" onClick={(e)=>{e.stopPropagation(); openMaps(m.address)}}>
                                <p className="text-[8px] text-slate-400 uppercase font-bold">Dirección</p>
                                <p className="text-xs leading-tight underline decoration-slate-600">{m.address || 'No registrada'}</p>
                            </div>
                        </div>
                    </div>

                    {(m.emergencyContact || m.emergencyPhone) && (
                        <div className="bg-red-900/20 p-3 rounded-xl border border-red-500/20 flex items-center gap-3">
                            <div className="text-red-400"><Icon name="AlertTriangle" size={16}/></div>
                            <div>
                                <p className="text-[8px] text-red-300 font-bold uppercase mb-0.5">Emergencia</p>
                                <p className="text-xs font-bold text-white">{m.emergencyContact}</p>
                                <p className="text-xs text-red-200 font-mono">{m.emergencyPhone}</p>
                            </div>
                        </div>
                    )}

                    {/* Botones de Acción */}
                    <div className="grid grid-cols-2 gap-3 mt-auto">
                        <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(m.phone)}} className="col-span-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg border border-emerald-400/30">
                            <Icon name="MessageCircle" size={16} /> Enviar WhatsApp
                        </button>
                        <button onClick={(e)=>{e.stopPropagation(); makeCall(m.phone)}} className="bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 transition-all">
                            <Icon name="Phone" size={14} /> Llamar
                        </button>
                        <button onClick={(e)=>{e.stopPropagation(); openWhatsApp('5491136278857', `Hola, soy ${firstName}, quiero agendar una visita.`)}} className="bg-slate-700/50 hover:bg-slate-600 text-slate-300 border border-slate-500/30 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 transition-all">
                            <Icon name="Calendar" size={14} /> Visita
                        </button>
                    </div>
                </div>
                
                <div className="mt-auto text-center pt-3 border-t border-white/10 relative z-10">
                    <p className="text-[8px] text-slate-500">CDS MI CASA • {year}</p>
                </div>
            </div>
        );
    };

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMembers.map(member => (
                    <div key={member.id} className="group bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all flex items-center gap-3 relative">
                        <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedMember(member); setIsFlipped(false); }}>
                            <img src={getPhoto(member.photo, member.name)} className="w-12 h-12 rounded-xl object-cover bg-slate-100" alt={member.name}/>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 text-sm truncate">{member.name}</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{member.role}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 border-l border-slate-100 pl-2">
                            <button onClick={()=>handleEdit(member)} className="text-slate-400 hover:text-brand-600 p-1"><Icon name="Edit" size={14}/></button>
                            <button onClick={()=>handleDelete(member.id)} className="text-slate-400 hover:text-red-600 p-1"><Icon name="Trash" size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal CRUD */}
            <Modal isOpen={isEditing} onClose={()=>setIsEditing(false)} title={form.id ? "Editar Miembro" : "Nuevo Miembro"}>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <Input label="Link Foto (Drive o URL)" value={form.photo} onChange={e=>setForm({...form, photo:e.target.value})} placeholder="https://..." />
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Nombre Completo" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Rol</label>
                            <Select value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                                <option>Miembro</option><option>Líder</option><option>Pastor</option><option>Músico</option><option>Maestro</option><option>Servidor</option>
                            </Select>
                        </div>
                    </div>
                    <Input label="Área / Ministerio" value={form.ministry} onChange={e=>setForm({...form, ministry:e.target.value})} placeholder="Ej: Alabanza, Jóvenes..." />
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
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
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Input type="date" label="Nacimiento" value={form.birthDate} onChange={e=>setForm({...form, birthDate:e.target.value})} />
                        <Input type="date" label="Ingreso" value={form.joinedDate} onChange={e=>setForm({...form, joinedDate:e.target.value})} />
                    </div>
                    <Button className="w-full mt-4" onClick={handleSave}>Guardar Datos</Button>
                </div>
            </Modal>

            {/* PDF OCULTO (PLANO) */}
            {selectedMember && (
                <div ref={printRef} style={{ display: 'none', width: '340px', height: '540px' }}>
                    <CardContent m={selectedMember} isFront={true} />
                </div>
            )}

            {/* Modal CREDENCIAL (3D) */}
            {selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="relative z-10 animate-enter flex flex-col items-center gap-6">
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
            `}</style>
        </div>
    );
};
