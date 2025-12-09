// src/views/Directory.js
window.Views = window.Views || {};

window.Views.Directory = ({ members, directory, addData, updateData, deleteData }) => {
    // 1. HOOKS Y UTILIDADES
    const { useState, useMemo, useRef, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon, Button, Input, Modal } = Utils;

    // 2. ESTADOS
    // Datos: Priorizamos las props, sino usamos un estado local vacío
    const [localMembers, setLocalMembers] = useState([]);
    
    // Sincronizar con props al cargar
    useEffect(() => {
        const incoming = Array.isArray(members) ? members : (Array.isArray(directory) ? directory : []);
        setLocalMembers(incoming);
    }, [members, directory]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); // Para ver credencial
    const [isEditing, setIsEditing] = useState(false); // Para el modal de edición/creación
    const [isFlipped, setIsFlipped] = useState(false); // Efecto 3D
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Estado del Formulario
    const initialForm = { 
        id: '', name: '', role: 'Miembro', email: '', phone: '', 
        address: '', birthDate: '', emergencyContact: '', emergencyPhone: '', photo: '' 
    };
    const [form, setForm] = useState(initialForm);

    // Referencia PDF
    const cardRef = useRef(null);

    // 3. HELPERS
    const getField = (item, ...keys) => {
        for (let key of keys) if (item[key]) return item[key];
        return null;
    };

    const calculateAge = (dateString) => {
        if (!dateString) return null;
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return isNaN(age) ? null : age;
    };

    const getPhoto = (photoUrl, name) => {
        if (photoUrl && photoUrl.length > 5) return photoUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=f1f5f9&color=64748b&size=256`;
    };

    const openWhatsApp = (phone) => {
        if (!phone) return;
        const p = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${p}`, '_blank');
    };

    const openMaps = (address) => {
        if (!address) return;
        const q = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
    };

    // 4. LÓGICA CRUD
    const handleEdit = (member) => {
        // Mapear datos del miembro al formulario (normalizando nombres de campos)
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
            photo: getField(member, 'photo', 'foto') || ''
        });
        setIsEditing(true);
    };

    const handleNew = () => {
        setForm({ ...initialForm, id: Date.now().toString(36) }); // ID temporal simple
        setIsEditing(true);
    };

    const handleDelete = (id) => {
        if(!confirm("¿Estás seguro de eliminar a este miembro?")) return;
        
        // Si existe la función prop deleteData, la usamos
        if (typeof deleteData === 'function') {
            deleteData('directory', id); // Asumiendo que la colección se llama directory
        }
        // Actualizamos localmente para feedback inmediato
        setLocalMembers(prev => prev.filter(m => m.id !== id));
        if (selectedMember?.id === id) setSelectedMember(null);
    };

    const handleSave = () => {
        if (!form.name) return alert("El nombre es obligatorio");

        const memberData = { ...form };
        
        // Determinar si es Crear o Editar
        const exists = localMembers.find(m => m.id === form.id);

        if (exists) {
            // EDITAR
            if (typeof updateData === 'function') updateData('directory', form.id, memberData);
            setLocalMembers(prev => prev.map(m => m.id === form.id ? memberData : m));
        } else {
            // CREAR
            // Si no hay ID (caso raro), generamos uno
            if (!memberData.id) memberData.id = Date.now().toString(36);
            if (typeof addData === 'function') addData('directory', memberData);
            setLocalMembers(prev => [...prev, memberData]);
        }
        
        setIsEditing(false);
    };

    // Filtro
    const filteredMembers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return localMembers.filter(m => {
            const name = getField(m, 'name', 'nombre') || '';
            const role = getField(m, 'role', 'rol') || '';
            return name.toLowerCase().includes(term) || role.toLowerCase().includes(term);
        });
    }, [localMembers, searchTerm]);

    // --- DESCARGA PDF ---
    const downloadPDF = async () => {
        if (!selectedMember || !cardRef.current) return;
        setIsDownloading(true);
        setIsFlipped(false); // Forzar frente

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
                    filename: `Credencial_${selectedMember.name}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: [55, 88], orientation: 'portrait' } 
                };
                await window.html2pdf().set(opt).from(cardRef.current).save();
            } catch (error) { console.error(error); alert("Error al generar PDF"); }
            setIsDownloading(false);
        }, 500);
    };

    // --- RENDERIZADO DE LA CREDENCIAL ---
    const renderCredential = (m) => {
        if (!m) return null;
        const id = m.id || '---';
        const name = getField(m, 'name', 'nombre') || 'Sin Nombre';
        const role = getField(m, 'role', 'rol') || 'Miembro';
        const photo = getPhoto(getField(m, 'photo', 'foto'), name);
        const age = calculateAge(getField(m, 'birthDate', 'fechaNacimiento'));
        const email = getField(m, 'email', 'correo');
        const phone = getField(m, 'phone', 'telefono');
        const address = getField(m, 'address', 'direccion');
        const emerContact = getField(m, 'emergencyContact', 'contactoEmergencia');
        const emerPhone = getField(m, 'emergencyPhone', 'telefonoEmergencia');
        
        // Fecha de Vencimiento (Fin del año actual)
        const expirationYear = new Date().getFullYear();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;

        return (
            <div className="perspective-1000 w-[320px] h-[520px] cursor-pointer group select-none relative" onClick={() => !isDownloading && setIsFlipped(!isFlipped)}>
                <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* --- FRENTE --- */}
                    <div ref={!isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col items-center pt-8 pb-4 px-6">
                        
                        {/* Decoración */}
                        <div className="absolute top-4 w-12 h-3 bg-slate-200 rounded-full mx-auto left-0 right-0 shadow-inner"></div>
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-50 rounded-full blur-3xl opacity-60"></div>
                        <div className="absolute top-20 -left-10 w-20 h-20 bg-indigo-50 rounded-full blur-2xl opacity-60"></div>

                        {/* Encabezado */}
                        <div className="text-center mb-6 z-10">
                            <h3 className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">CONQUISTADORES</h3>
                            <div className="h-1 w-8 bg-brand-500 mx-auto mt-2 rounded-full"></div>
                        </div>

                        {/* Foto */}
                        <div className="relative w-36 h-36 mb-5">
                            <div className="absolute inset-0 bg-gradient-to-tr from-brand-400 to-indigo-500 rounded-full blur-sm opacity-40 animate-pulse"></div>
                            <div className="relative w-full h-full rounded-full p-1 bg-gradient-to-tr from-brand-400 to-indigo-500 shadow-xl">
                                <img src={photo} className="w-full h-full object-cover rounded-full bg-white border-2 border-white" alt={name} onError={(e) => e.target.src = getPhoto(null, name)}/>
                            </div>
                            {/* Edad Flotante */}
                            {age && (
                                <div className="absolute bottom-0 right-0 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white shadow-sm">
                                    {age} AÑOS
                                </div>
                            )}
                        </div>

                        {/* Info Principal */}
                        <div className="text-center space-y-1 mb-2 w-full z-10">
                            <h2 className="text-2xl font-extrabold text-slate-800 leading-tight px-1 truncate">{name}</h2>
                            <span className="inline-block px-4 py-1 bg-brand-50 text-brand-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-brand-100 shadow-sm">
                                {role}
                            </span>
                        </div>

                        {/* Footer */}
                        <div className="mt-auto w-full bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 z-10">
                            <div className="text-left overflow-hidden">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Vencimiento</p>
                                <p className="text-sm font-bold text-slate-700">DIC {expirationYear}</p>
                            </div>
                            <div className="shrink-0 bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
                                <img src={qrUrl} className="w-12 h-12 mix-blend-multiply opacity-90" alt="QR" />
                            </div>
                        </div>
                        <div className="absolute bottom-1.5 text-[9px] text-slate-300 flex items-center gap-1"><Icon name="RotateCw" size={10} /></div>
                    </div>

                    {/* --- DORSO --- */}
                    <div ref={isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-800 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 relative border border-slate-700">
                         <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-600 rounded-full blur-[80px] opacity-20"></div>
                         <div className="absolute top-4 w-12 h-3 bg-slate-700 rounded-full mx-auto left-0 right-0 shadow-inner"></div>

                         <div className="mt-6 text-center mb-6 relative z-10">
                            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-brand-400 border border-white/10 backdrop-blur-sm">
                                <Icon name="User" size={20}/>
                            </div>
                            <h3 className="font-bold text-base tracking-wide">Datos de Contacto</h3>
                         </div>

                         <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4 z-10">
                            
                            {/* Contacto Directo */}
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-3">
                                <div onClick={(e)=>{e.stopPropagation(); openWhatsApp(phone)}} className="cursor-pointer hover:opacity-80">
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1"><Icon name="Phone" size={10}/> Teléfono</p>
                                    <p className="text-sm font-medium text-white mt-0.5">{phone || 'No registrado'}</p>
                                </div>
                                <div onClick={(e)=>{e.stopPropagation(); openMaps(address)}} className="cursor-pointer hover:opacity-80">
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1"><Icon name="MapPin" size={10}/> Dirección</p>
                                    <p className="text-xs font-medium text-blue-200 mt-0.5 leading-tight underline decoration-blue-200/50">{address || 'Sin dirección'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1"><Icon name="Mail" size={10}/> Email</p>
                                    <p className="text-xs font-medium text-slate-200 break-all mt-0.5">{email || '-'}</p>
                                </div>
                            </div>

                            {/* Emergencia (Opcional) */}
                            {(emerContact || emerPhone) && (
                                <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                                    <p className="text-[9px] text-red-300 font-bold uppercase flex items-center gap-1 mb-1">
                                        <Icon name="AlertTriangle" size={10}/> En caso de emergencia
                                    </p>
                                    <p className="text-xs font-bold text-white">{emerContact}</p>
                                    {emerPhone && <a href={`tel:${emerPhone}`} className="text-xs text-red-200 hover:text-white transition-colors block mt-0.5 font-mono">{emerPhone}</a>}
                                </div>
                            )}

                            {/* Botón Agendar Visita */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); Utils.notify('Función Visita: Próximamente'); }}
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 mt-2"
                            >
                                <Icon name="Calendar" size={14} /> Agendar Visita
                            </button>
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- VISTA PRINCIPAL ---
    return (
        <div className="space-y-6 fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800">Directorio</h2>
                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{localMembers.length}</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400"/>
                        <input 
                            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500" 
                            placeholder="Buscar miembro..." 
                            value={searchTerm} 
                            onChange={e=>setSearchTerm(e.target.value)} 
                        />
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
                            <div 
                                key={member.id} 
                                className="group bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all flex items-center gap-3 relative"
                            >
                                {/* Área click para ver credencial */}
                                <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedMember(member); setIsFlipped(false); }}>
                                    <img src={photo} className="w-12 h-12 rounded-xl object-cover bg-slate-100" alt={name}/>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-brand-600">{name}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{role}</p>
                                    </div>
                                </div>
                                
                                {/* Acciones (Editar/Borrar) */}
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
                    
                    <Input label="URL Foto (Opcional)" value={form.photo} onChange={e=>setForm({...form, photo:e.target.value})} placeholder="https://..." />

                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Nombre Completo" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Rol</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                                <option>Miembro</option>
                                <option>Líder</option>
                                <option>Pastor</option>
                                <option>Músico</option>
                                <option>Maestro</option>
                                <option>Diácono</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input type="date" label="Fecha Nacimiento" value={form.birthDate} onChange={e=>setForm({...form, birthDate:e.target.value})} />
                        <Input label="Teléfono / WhatsApp" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="Ej: 54911..." />
                    </div>

                    <Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
                    <Input label="Dirección Completa" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="Calle 123, Ciudad" />

                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Datos de Emergencia (Opcional)</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Nombre Contacto" value={form.emergencyContact} onChange={e=>setForm({...form, emergencyContact:e.target.value})} />
                            <Input label="Teléfono Emergencia" value={form.emergencyPhone} onChange={e=>setForm({...form, emergencyPhone:e.target.value})} />
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

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
};


