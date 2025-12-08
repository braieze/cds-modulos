// src/views/Directory.js
window.Views = window.Views || {};

window.Views.Directory = ({ members, directory, userProfile }) => {
    // 1. HOOKS Y UTILIDADES
    const { useState, useMemo, useRef } = React;
    const Utils = window.Utils || {};
    const { Icon } = Utils;

    // 2. ESTADOS
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); // Modal de credencial
    const [isFlipped, setIsFlipped] = useState(false); // Efecto 3D
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Referencia para la impresión PDF
    const cardRef = useRef(null);

    // 3. UNIFICACIÓN DE DATOS
    const dataList = Array.isArray(members) ? members : (Array.isArray(directory) ? directory : []);

    // 4. HELPER DE DATOS (Para compatibilidad)
    const getField = (item, ...keys) => {
        for (let key of keys) {
            if (item[key]) return item[key];
        }
        return null;
    };

    // Filtro
    const filteredMembers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return dataList.filter(m => {
            const name = getField(m, 'name', 'nombre') || '';
            const role = getField(m, 'role', 'rol', 'cargo') || '';
            const email = getField(m, 'email', 'correo') || '';
            return name.toLowerCase().includes(term) || 
                   role.toLowerCase().includes(term) ||
                   email.toLowerCase().includes(term);
        });
    }, [dataList, searchTerm]);

    // Helpers de Formato
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
        if (photoUrl) return photoUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=f1f5f9&color=64748b&size=256`;
    };

    const openWhatsApp = (phone) => {
        if (!phone) return;
        const p = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${p}`, '_blank');
    };

    // --- DESCARGA PDF ---
    const downloadPDF = async () => {
        if (!selectedMember || !cardRef.current) return;
        setIsDownloading(true);
        // Aseguramos que se vea el frente para la foto principal
        setIsFlipped(false); 

        setTimeout(async () => {
            try {
                if (!window.html2pdf) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                const element = cardRef.current;
                const opt = {
                    margin: 0,
                    filename: `Credencial_${selectedMember.name || 'Conquistadores'}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
                    jsPDF: { unit: 'mm', format: [55, 88], orientation: 'portrait' } 
                };

                await window.html2pdf().set(opt).from(element).save();

            } catch (error) {
                console.error("Error PDF", error);
                alert("Error al generar PDF. Intenta de nuevo.");
            }
            setIsDownloading(false);
        }, 500); // Pequeña espera para asegurar renderizado
    };

    // --- RENDER CREDENCIAL (DISEÑO ORIGINAL) ---
    const renderCredential = (m) => {
        if (!m) return null;

        const id = m.id || 'ID-000';
        const name = getField(m, 'name', 'nombre') || 'Sin Nombre';
        const role = getField(m, 'role', 'rol', 'cargo') || 'Miembro';
        const photo = getPhoto(getField(m, 'photo', 'foto', 'avatar', 'img'), name);
        const birthDate = getField(m, 'birthDate', 'fechaNacimiento', 'nacimiento', 'dob');
        const age = calculateAge(birthDate);
        const blood = getField(m, 'bloodGroup', 'grupoSanguineo', 'sangre') || '-';
        const email = getField(m, 'email', 'correo', 'mail');
        const phone = getField(m, 'phone', 'telefono', 'celular');
        const emerContact = getField(m, 'emergencyContact', 'contactoEmergencia');
        const emerPhone = getField(m, 'emergencyPhone', 'telefonoEmergencia');
        const address = getField(m, 'address', 'direccion', 'domicilio');
        const joined = getField(m, 'joinedDate', 'fechaIngreso', 'createdAt');

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;

        return (
            <div className="perspective-1000 w-[320px] h-[520px] cursor-pointer group select-none relative" onClick={() => !isDownloading && setIsFlipped(!isFlipped)}>
                <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* --- FRENTE (DISEÑO ORIGINAL LIMPIO) --- */}
                    <div ref={!isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col items-center pt-8 pb-4 px-6">
                        
                        {/* Decoración Superior */}
                        <div className="absolute top-4 w-12 h-3 bg-slate-200 rounded-full mx-auto left-0 right-0 shadow-inner"></div>
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-50 rounded-full blur-3xl opacity-60"></div>
                        <div className="absolute top-20 -left-10 w-20 h-20 bg-indigo-50 rounded-full blur-2xl opacity-60"></div>

                        {/* Logo / Encabezado */}
                        <div className="text-center mb-6 z-10">
                            <h3 className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">CONQUISTADORES</h3>
                            <div className="h-1 w-8 bg-brand-500 mx-auto mt-2 rounded-full"></div>
                        </div>

                        {/* Foto Principal */}
                        <div className="relative w-36 h-36 mb-5">
                            <div className="absolute inset-0 bg-gradient-to-tr from-brand-400 to-indigo-500 rounded-full blur-sm opacity-40 animate-pulse"></div>
                            <div className="relative w-full h-full rounded-full p-1 bg-gradient-to-tr from-brand-400 to-indigo-500 shadow-xl">
                                <img src={photo} className="w-full h-full object-cover rounded-full bg-white border-2 border-white" alt={name} onError={(e) => e.target.src = getPhoto(null, name)}/>
                            </div>
                        </div>

                        {/* Info Principal */}
                        <div className="text-center space-y-1 mb-2 w-full z-10">
                            <h2 className="text-2xl font-extrabold text-slate-800 leading-tight px-1 truncate">{name}</h2>
                            <div className="flex flex-col items-center gap-1">
                                <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-brand-100 shadow-sm">
                                    {role}
                                </span>
                                {/* EDAD AGREGADA AL FRENTE */}
                                {age && (
                                    <span className="text-[10px] text-slate-400 font-bold">
                                        {age} Años
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Footer (QR & ID) */}
                        <div className="mt-auto w-full bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 z-10">
                            <div className="text-left overflow-hidden">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">ID Miembro</p>
                                <p className="text-sm font-mono font-black text-slate-700 truncate">{id}</p>
                            </div>
                            <div className="shrink-0 bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
                                <img src={qrUrl} className="w-12 h-12 mix-blend-multiply opacity-90" alt="QR" />
                            </div>
                        </div>
                        
                        <div className="absolute bottom-1.5 text-[9px] text-slate-300 flex items-center gap-1">
                            <Icon name="RotateCw" size={10} />
                        </div>
                    </div>

                    {/* --- DORSO (DISEÑO ORIGINAL OSCURO) --- */}
                    <div ref={isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-800 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 relative border border-slate-700">
                         {/* Decoración Fondo */}
                         <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-600 rounded-full blur-[80px] opacity-20"></div>
                         <div className="absolute top-4 w-12 h-3 bg-slate-700 rounded-full mx-auto left-0 right-0 shadow-inner"></div>

                         <div className="mt-6 text-center mb-6 relative z-10">
                            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-brand-400 border border-white/10 backdrop-blur-sm">
                                <Icon name="Shield" size={20}/>
                            </div>
                            <h3 className="font-bold text-base tracking-wide">Información Privada</h3>
                         </div>

                         <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 z-10">
                            
                            {/* Grupo Sanguíneo y Fecha */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Sangre</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Icon name="Droplet" size={12} className="text-red-400"/>
                                        <p className="font-bold text-sm">{blood}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Ingreso</p>
                                    <p className="font-bold text-sm mt-0.5">{joined ? new Date(joined).getFullYear() : '-'}</p>
                                </div>
                            </div>

                            {/* Datos de Contacto */}
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1"><Icon name="Mail" size={10}/> Email</p>
                                    <p className="text-xs font-medium text-slate-200 break-all mt-0.5">{email || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase flex items-center gap-1"><Icon name="MapPin" size={10}/> Dirección</p>
                                    <p className="text-xs font-medium text-slate-200 mt-0.5 leading-tight">{address || '-'}</p>
                                </div>
                            </div>

                            {/* Emergencia */}
                            {(emerContact || emerPhone) && (
                                <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                                    <p className="text-[9px] text-red-300 font-bold uppercase flex items-center gap-1 mb-1">
                                        <Icon name="AlertTriangle" size={10}/> Contacto Emergencia
                                    </p>
                                    <p className="text-xs font-bold text-white">{emerContact || 'No especificado'}</p>
                                    {emerPhone && <a href={`tel:${emerPhone}`} className="text-xs text-red-200 hover:text-white transition-colors block mt-0.5 font-mono">{emerPhone}</a>}
                                </div>
                            )}

                            {/* Botón WhatsApp */}
                            {phone && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openWhatsApp(phone); }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 mt-2"
                                >
                                    <Icon name="MessageCircle" size={14} /> Contactar WhatsApp
                                </button>
                            )}
                         </div>

                         <div className="mt-3 pt-3 border-t border-white/5 text-center">
                             <p className="text-[9px] text-slate-500">Documento interno de uso exclusivo.</p>
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- VISTA PRINCIPAL ---
    return (
        <div className="space-y-6 fade-in pb-20">
            {/* Header Lista */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-4 rounded-3xl border border-slate-100 shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-100 text-brand-600 p-2 rounded-xl">
                        <Icon name="Users" size={24}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 leading-tight">Directorio</h2>
                        <p className="text-xs text-slate-500 font-bold">{dataList.length} Miembros</p>
                    </div>
                </div>
                <div className="relative w-full md:w-64 group">
                    <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-brand-500 transition-colors"/>
                    <input 
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm" 
                        placeholder="Buscar..." 
                        value={searchTerm} 
                        onChange={e=>setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            {/* Grid */}
            {filteredMembers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMembers.map(member => {
                        const name = getField(member, 'name', 'nombre') || 'Sin nombre';
                        const role = getField(member, 'role', 'rol', 'cargo') || 'Miembro';
                        const photo = getPhoto(getField(member, 'photo', 'foto', 'avatar', 'img'), name);
                        
                        return (
                            <div 
                                key={member.id || Math.random()} 
                                onClick={() => { setSelectedMember(member); setIsFlipped(false); }}
                                className="group bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer flex items-center gap-3"
                            >
                                <img src={photo} className="w-12 h-12 rounded-xl object-cover bg-slate-100" alt={name}/>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-brand-600">{name}</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{role}</p>
                                </div>
                                <Icon name="CreditCard" size={16} className="text-slate-300 group-hover:text-brand-500"/>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="Search" size={32} className="mx-auto mb-2 opacity-20"/>
                    <p className="text-sm">Sin resultados.</p>
                </div>
            )}

            {/* Modal */}
            {selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="relative z-10 animate-enter flex flex-col items-center gap-6">
                        
                        {renderCredential(selectedMember)}
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setSelectedMember(null)}
                                className="bg-white text-slate-800 px-5 py-2.5 rounded-full font-bold shadow-lg hover:bg-slate-50 transition-transform active:scale-95 text-xs flex items-center gap-2"
                            >
                                <Icon name="X" size={14}/> Cerrar
                            </button>
                            <button 
                                onClick={downloadPDF}
                                disabled={isDownloading}
                                className="bg-brand-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg hover:bg-brand-500 transition-transform active:scale-95 text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
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
