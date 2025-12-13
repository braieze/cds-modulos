window.Views = window.Views || {};

window.Views.Directory = ({ members, addData, updateData, deleteData, userProfile, setActiveTab }) => {
    // 1. HOOKS
    const { useState, useMemo, useRef, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal, Select, SmartSelect } = Utils;

    // 2. ESTADOS
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); 
    const [isEditing, setIsEditing] = useState(false); 
    const [isFlipped, setIsFlipped] = useState(false); 
    const [isDownloading, setIsDownloading] = useState(false);
    
    // --- LISTAS FIJAS ---
    const ROLES = ['Pastor', 'Líder', 'Servidor', 'Miembro'];
    const DEFAULT_AREAS = ['Alabanza', 'Ujieres', 'Jóvenes', 'Escuela Bíblica', 'Evangelismo', 'Matrimonios', 'Hombres', 'Mujeres', 'General'];
    
    const [customAreas, setCustomAreas] = useState([]);
    const [isAddingArea, setIsAddingArea] = useState(false);
    const [newAreaName, setNewAreaName] = useState("");

    const initialForm = { 
        id: '', name: '', role: 'Miembro', ministry: 'General', email: '', phone: '', 
        address: '', birthDate: '', emergencyContact: '', emergencyPhone: '', photo: '', joinedDate: '', credentialId: ''
    };
    const [form, setForm] = useState(initialForm);
    const printRef = useRef(null); 

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

    // ID ESTABLE
    const getStableID = (m) => {
        if (m.credentialId) return m.credentialId;
        const suffix = m.id ? m.id.substring(0, 4).toUpperCase() : 'TEMP';
        const initials = m.name ? m.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'XX';
        return `CDS-${initials}-${suffix}`;
    };

    const generateNewID = (name) => {
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
        if (!address || address === 'No registrada') return Utils.notify('Sin dirección registrada', 'error');
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    // --- ACCIÓN DE VISITA ---
    const handleScheduleVisit = (member) => {
        window.tempVisitMember = member;
        if (setActiveTab) {
            setActiveTab('visits');
        } else {
            Utils.notify("Navegación no disponible", "error");
        }
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
            joinedDate: getField(member, 'joinedDate', 'fechaIngreso') || '',
            credentialId: member.credentialId || '' 
        });
        setIsEditing(true);
        setIsAddingArea(false);
    };

    const handleNew = () => {
        setForm({ ...initialForm, joinedDate: new Date().toISOString().split('T')[0] });
        setIsEditing(true);
        setIsAddingArea(false);
    };

    const handleDelete = (id) => {
        if(!confirm("¿Estás seguro de eliminar a este miembro permanentemente?")) return;
        deleteData('members', id);
        if (selectedMember?.id === id) setSelectedMember(null);
        Utils.notify("Miembro eliminado");
    };

    const handleSave = () => {
        if (!form.name) return Utils.notify("Nombre obligatorio", 'error');
        
        const cleanData = {
            name: form.name,
            role: form.role,
            ministry: form.ministry,
            email: form.email,
            phone: form.phone,
            address: form.address,
            birthDate: form.birthDate,
            emergencyContact: form.emergencyContact,
            emergencyPhone: form.emergencyPhone,
            photo: form.photo,
            joinedDate: form.joinedDate,
            credentialId: form.credentialId || generateNewID(form.name)
        };

        if (form.id) {
            updateData('members', form.id, cleanData);
            if(selectedMember && selectedMember.id === form.id) {
                setSelectedMember({ id: form.id, ...cleanData });
            }
            Utils.notify("Datos actualizados");
        } else {
            cleanData.createdAt = new Date().toISOString();
            addData('members', cleanData);
            Utils.notify("Miembro creado");
        }
        setIsEditing(false);
    };

    const handleAddCustomArea = () => {
        if (newAreaName.trim()) {
            setCustomAreas([...customAreas, newAreaName.trim()]);
            setForm({...form, ministry: newAreaName.trim()});
            setNewAreaName("");
            setIsAddingArea(false);
        }
    };

    const filteredMembers = (members || []).filter(m => {
        const term = searchTerm.toLowerCase();
        return (m.name||'').toLowerCase().includes(term) || (m.role||'').toLowerCase().includes(term);
    });

    // 5. PDF
    const downloadPDF = async () => {
        if (!selectedMember || !printRef.current) return;
        setIsDownloading(true);

        setTimeout(async () => {
            try {
                let worker = window.html2pdf;
                if (!worker || typeof worker !== 'function') {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                        script.onload = resolve;
                        script.onerror = () => reject("Error al cargar script PDF");
                        document.head.appendChild(script);
                    });
                    worker = window.html2pdf;
                }

                const element = printRef.current;
                element.style.display = 'block'; 
                
                const opt = {
                    margin: 0,
                    filename: `Credencial_${selectedMember.name.replace(/\s+/g,'_')}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 4, useCORS: true, logging: false, backgroundColor: '#ffffff' },
                    jsPDF: { unit: 'mm', format: [54, 86], orientation: 'portrait' }
                };
                
                await worker().set(opt).from(element).save();
                Utils.notify("PDF Descargado");
                element.style.display = 'none'; 
            } catch (error) { 
                console.error("PDF Error:", error); 
                Utils.notify("Error al generar PDF.", 'error'); 
            } finally {
                setIsDownloading(false);
            }
        }, 500);
    };

    // --- DISEÑO DE TARJETA (SPLIT CON CORTE CIRCULAR) ---
    const CardContent = ({ m, isFront }) => {
        if (!m) return null;
        
        const id = getStableID(m);
        const nameParts = (m.name || 'Sin Nombre').split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        const role = m.role || 'Miembro';
        const photo = getPhoto(m.photo, m.name);
        const year = new Date().getFullYear();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${m.id}`;
        
        // Color Azul Oscuro Profundo
        const DARK_BG = "bg-[#0f172a]";

        if (isFront) {
            return (
                <div className="w-full h-full bg-white relative overflow-hidden flex flex-col items-center select-none font-sans" 
                     style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                    
                    {/* PARTE SUPERIOR (BLANCA) */}
                    <div className="w-full h-[45%] bg-white relative pt-8 text-center z-10 flex flex-col items-center">
                        <div className="w-8 h-1.5 bg-slate-200 rounded-full mb-2"></div>
                        <p className="text-[7px] font-black text-slate-400 tracking-[0.25em] uppercase mb-1">CONQUISTADORES</p>
                        <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Credencial Digital</h2>
                        <p className="text-[9px] font-bold text-slate-800 mt-0.5">{year}</p>
                    </div>

                    {/* FOTO CENTRAL CON EFECTO DE CORTE */}
                    <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                        <div className="w-[140px] h-[140px] rounded-full border-[8px] border-white bg-white shadow-xl overflow-hidden">
                            <img src={photo} className="w-full h-full object-cover rounded-full bg-slate-200" alt={m.name} crossOrigin="anonymous"/>
                        </div>
                    </div>

                    {/* PARTE INFERIOR (AZUL OSCURO SÓLIDO) */}
                    <div className={`w-full h-[55%] ${DARK_BG} relative flex flex-col items-center justify-end pb-6 px-5 z-0`}>
                        {/* Datos Texto */}
                        <div className="relative z-10 text-center mt-16 mb-auto w-full">
                            <h1 className="text-2xl font-black text-white leading-none mb-1 tracking-tight">{firstName}</h1>
                            <h2 className="text-xl font-bold text-blue-500 leading-tight mb-4">{lastName}</h2>
                            <span className="inline-block border border-slate-600 text-white px-6 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#1e293b]">
                                {role}
                            </span>
                        </div>

                        {/* Footer ID y QR */}
                        <div className="relative z-10 w-full bg-[#1e293b] rounded-xl p-3 border border-slate-700 flex items-center justify-between mt-2">
                            <div className="text-left">
                                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ID ÚNICO</p>
                                <p className="text-[11px] font-mono font-bold text-white tracking-widest uppercase">{id}</p>
                                <p className="text-[7px] font-bold text-blue-500 uppercase mt-0.5 tracking-wider">CDS MI CASA</p>
                            </div>
                            <div className="bg-white p-1 rounded-md">
                                <img src={qrUrl} className="w-10 h-10" alt="QR" crossOrigin="anonymous"/>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // DORSO (AZUL OSCURO SÓLIDO CON FONDO FORZADO)
        return (
            <div className={`w-full h-full ${DARK_BG} relative overflow-hidden flex flex-col p-6 font-sans text-white`} 
                 style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', WebkitTransform: 'rotateY(180deg)', backgroundColor: '#0f172a' }}>
                
                {/* Capa de Bloqueo Visual Extra */}
                <div className="absolute inset-0 bg-[#0f172a] z-[-1]" style={{ pointerEvents: 'none' }}></div>
                
                <div className="relative z-10 text-center mb-6 mt-4 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <h3 className="font-bold text-white text-sm tracking-[0.1em] uppercase">Información de Contacto</h3>
                </div>

                <div className="relative z-10 flex-1 space-y-4">
                    <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700 space-y-4 shadow-sm">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full border border-blue-500"></div>
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Teléfono</p>
                            </div>
                            <p className="text-sm font-medium text-white pl-4">{m.phone || 'No registrado'}</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full border border-blue-500"></div>
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Email</p>
                            </div>
                            <p className="text-xs font-medium text-white pl-4 truncate">{m.email || 'No registrado'}</p>
                        </div>
                        <div onClick={(e)=>{e.stopPropagation(); openMaps(m.address)}} className="cursor-pointer group">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full border border-blue-500"></div>
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Dirección</p>
                            </div>
                            <p className="text-xs font-medium text-white pl-4 leading-tight group-hover:text-blue-400 transition-colors">{m.address || 'No registrada'}</p>
                        </div>
                        
                        {/* SECCIÓN EMERGENCIA CON BOTÓN WHATSAPP */}
                        {(m.emergencyContact) && (
                            <div className="pt-3 border-t border-slate-700 mt-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full border border-red-500"></div>
                                    <p className="text-[8px] text-red-400 uppercase font-bold tracking-wider">Emergencia</p>
                                </div>
                                <div className="pl-4 flex justify-between items-center bg-red-900/10 p-2 rounded-lg border border-red-900/30">
                                    <div>
                                        <span className="text-xs font-bold text-white block">{m.emergencyContact}</span>
                                        <span className="text-[10px] text-slate-400">{m.emergencyPhone}</span>
                                    </div>
                                    {m.emergencyPhone && (
                                        <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(m.emergencyPhone)}} className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-md z-20 flex items-center justify-center" title="WhatsApp Emergencia">
                                            <Icon name="MessageCircle" size={16}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(m.phone)}} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20">
                        <Icon name="MessageCircle" size={16} /> Enviar WhatsApp
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={(e)=>{e.stopPropagation(); makeCall(m.phone)}} className="bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 transition-all">
                            <Icon name="Phone" size={14} /> Llamar
                        </button>
                        
                        {['Pastor', 'Líder', 'Servidor'].includes(userProfile?.role) && (
                            <button onClick={(e)=>{e.stopPropagation(); handleScheduleVisit(m)}} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 transition-all">
                                <Icon name="Calendar" size={14} /> Visita Pastoral
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="mt-auto text-center pt-4 border-t border-slate-800 relative z-10">
                    <p className="text-[7px] text-slate-500 font-bold tracking-widest">CDS MI CASA • {year}</p>
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
                    {userProfile?.role === 'Pastor' && (
                        <Button icon="Plus" onClick={handleNew}>Nuevo</Button>
                    )}
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
                        {userProfile?.role === 'Pastor' && (
                            <div className="flex flex-col gap-1 border-l border-slate-100 pl-2">
                                <button onClick={()=>handleEdit(member)} className="text-slate-400 hover:text-brand-600 p-1"><Icon name="Edit" size={14}/></button>
                                <button onClick={()=>handleDelete(member.id)} className="text-slate-400 hover:text-red-600 p-1"><Icon name="Trash" size={14}/></button>
                            </div>
                        )}
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
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                            Área / Ministerio
                            {userProfile?.role === 'Pastor' && !isAddingArea && (
                                <button onClick={()=>setIsAddingArea(true)} className="text-brand-600 hover:underline text-[10px] flex items-center gap-1">
                                    <Icon name="Plus" size={10}/> Nueva
                                </button>
                            )}
                        </label>
                        
                        {isAddingArea ? (
                            <div className="flex gap-2">
                                <input className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500" 
                                       placeholder="Nombre nueva área..." 
                                       value={newAreaName} 
                                       onChange={e=>setNewAreaName(e.target.value)} 
                                       autoFocus
                                />
                                <button onClick={handleAddCustomArea} className="bg-brand-600 text-white px-4 rounded-xl font-bold">OK</button>
                                <button onClick={()=>setIsAddingArea(false)} className="bg-slate-200 text-slate-500 px-3 rounded-xl"><Icon name="X" size={14}/></button>
                            </div>
                        ) : (
                            <Select value={form.ministry} onChange={e=>setForm({...form, ministry:e.target.value})}>
                                {DEFAULT_AREAS.concat(customAreas).map(a => <option key={a} value={a}>{a}</option>)}
                            </Select>
                        )}
                    </div>

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
                                <div className="absolute w-full h-full backface-hidden rounded-[24px] shadow-2xl overflow-hidden bg-white border border-slate-200" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                                    <CardContent m={selectedMember} isFront={true} />
                                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-[9px] text-slate-400 flex items-center gap-1 z-50 bg-white/20 px-2 py-0.5 rounded-full"><Icon name="RotateCw" size={10} /> Girar</div>
                                </div>
                                {/* Dorso - FONDO SÓLIDO AZUL OSCURO */}
                                <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-[24px] shadow-2xl overflow-hidden bg-[#0f172a] border border-slate-800" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', WebkitTransform: 'rotateY(180deg)', backgroundColor: '#0f172a' }}>
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
                .transform-style-3d { transform-style: preserve-3d; -webkit-transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); -webkit-transform: rotateY(180deg); }
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
};
