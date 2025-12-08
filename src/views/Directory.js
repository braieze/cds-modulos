// src/views/Directory.js
window.Views = window.Views || {};

window.Views.Directory = ({ members, directory, userProfile }) => {
    // 1. HOOKS Y UTILIDADES
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Icon } = Utils;

    // 2. ESTADOS
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); // Modal de credencial
    const [isFlipped, setIsFlipped] = useState(false); // Efecto 3D

    // 3. UNIFICACIÓN DE DATOS
    // Aceptamos 'members' o 'directory' para asegurar compatibilidad con tu App.js
    const dataList = Array.isArray(members) ? members : (Array.isArray(directory) ? directory : []);

    // 4. HELPER INTELIGENTE DE DATOS
    // Esto busca el dato correcto aunque el campo tenga nombres distintos en tu base de datos
    const getField = (item, ...keys) => {
        for (let key of keys) {
            if (item[key]) return item[key];
        }
        return null;
    };

    // Filtro de búsqueda
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

    // Calcular edad
    const calculateAge = (dateString) => {
        if (!dateString) return '-';
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return isNaN(age) ? '-' : age;
    };

    // Abrir WhatsApp
    const openWhatsApp = (phone) => {
        if (!phone) return;
        const p = phone.replace(/\D/g, ''); // Limpiar caracteres no numéricos
        window.open(`https://wa.me/${p}`, '_blank');
    };

    // Obtener foto o avatar
    const getPhoto = (photoUrl, name) => {
        if (photoUrl) return photoUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=f1f5f9&color=64748b&size=128`;
    };

    // --- RENDERIZADO DE LA CREDENCIAL ---
    const renderCredential = (m) => {
        if (!m) return null;

        // Extracción segura de datos usando el helper
        const id = m.id || 'ID-000';
        const name = getField(m, 'name', 'nombre') || 'Sin Nombre';
        const role = getField(m, 'role', 'rol', 'cargo') || 'Miembro';
        const photo = getPhoto(getField(m, 'photo', 'foto', 'avatar', 'img'), name);
        const birthDate = getField(m, 'birthDate', 'fechaNacimiento', 'nacimiento', 'dob');
        const age = calculateAge(birthDate);
        const blood = getField(m, 'bloodGroup', 'grupoSanguineo', 'sangre') || '-';
        const phone = getField(m, 'phone', 'telefono', 'celular', 'whatsapp');
        const email = getField(m, 'email', 'correo', 'mail');
        const address = getField(m, 'address', 'direccion', 'domicilio', 'localidad');
        const emerContact = getField(m, 'emergencyContact', 'contactoEmergencia', 'contacto_emergencia');
        const emerPhone = getField(m, 'emergencyPhone', 'telefonoEmergencia', 'telefono_emergencia');
        const joined = getField(m, 'joinedDate', 'fechaIngreso', 'createdAt') || '-';

        // QR con ID para futuros módulos
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;

        return (
            <div className="perspective-1000 w-[320px] h-[520px] cursor-pointer group select-none" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* --- FRENTE --- */}
                    <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col items-center pt-8 pb-4 px-6">
                        {/* Diseño superior */}
                        <div className="absolute top-4 w-12 h-3 bg-slate-200 rounded-full mx-auto left-0 right-0 shadow-inner"></div>
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl"></div>
                        
                        <div className="text-center mb-5 z-10">
                            <h3 className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">CREDENTIAL</h3>
                            <div className="h-1 w-6 bg-brand-500 mx-auto mt-2 rounded-full"></div>
                        </div>

                        <div className="w-32 h-32 rounded-2xl p-1 bg-gradient-to-br from-brand-400 to-indigo-500 shadow-xl mb-4">
                            <img src={photo} className="w-full h-full object-cover rounded-xl bg-white" alt={name} onError={(e) => e.target.src = getPhoto(null, name)}/>
                        </div>

                        <div className="text-center space-y-1 mb-2 w-full">
                            <h2 className="text-2xl font-extrabold text-slate-800 leading-tight truncate px-2">{name}</h2>
                            <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 text-[10px] font-bold rounded-full uppercase tracking-wider shadow-sm border border-brand-100">
                                {role}
                            </span>
                        </div>

                        <div className="mt-auto w-full bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                            <div className="text-left overflow-hidden">
                                <p className="text-[9px] text-slate-400 font-bold uppercase">ID ÚNICO</p>
                                <p className="text-xs font-mono font-bold text-slate-600 truncate">{id}</p>
                            </div>
                            <div className="shrink-0 bg-white p-1 rounded-lg border border-slate-100">
                                <img src={qrUrl} className="w-12 h-12 mix-blend-multiply opacity-90" alt="QR" />
                            </div>
                        </div>
                        
                        <div className="absolute bottom-1.5 text-[9px] text-slate-400 flex items-center gap-1 animate-pulse">
                            <Icon name="RefreshCw" size={10} /> Tocar para girar
                        </div>
                    </div>

                    {/* --- DORSO --- */}
                    <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 relative border border-slate-700">
                         <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-brand-600 rounded-full blur-[60px] opacity-20"></div>
                         <div className="absolute top-4 w-12 h-3 bg-slate-800 rounded-full mx-auto left-0 right-0 shadow-inner"></div>

                         <div className="mt-6 text-center mb-6">
                            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-brand-400 border border-white/10">
                                <Icon name="UserCheck" size={20}/>
                            </div>
                            <h3 className="font-bold text-base">Ficha Personal</h3>
                         </div>

                         <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 z-10">
                            {/* Datos Básicos */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Edad</p>
                                    <p className="font-bold text-sm">{age !== '-' ? age + ' años' : '-'}</p>
                                </div>
                                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Sangre</p>
                                    <div className="flex items-center gap-1">
                                        <Icon name="Droplet" size={10} className="text-red-400"/>
                                        <p className="font-bold text-sm">{blood}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Contacto */}
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase">Email</p>
                                    <p className="text-xs font-medium text-slate-200 break-all">{email || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase">Dirección</p>
                                    <p className="text-xs font-medium text-slate-200">{address || '-'}</p>
                                </div>
                            </div>

                            {/* Emergencia (Destacado) */}
                            {(emerContact || emerPhone) && (
                                <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                                    <p className="text-[9px] text-red-300 font-bold uppercase flex items-center gap-1 mb-1">
                                        <Icon name="AlertCircle" size={10}/> Emergencia
                                    </p>
                                    <p className="text-xs font-bold text-white">{emerContact || 'Contacto no esp.'}</p>
                                    {emerPhone && <a href={`tel:${emerPhone}`} className="text-xs text-red-200 hover:text-white transition-colors block mt-1">{emerPhone}</a>}
                                </div>
                            )}

                            {/* WhatsApp Action */}
                            {phone && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openWhatsApp(phone); }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 mt-2"
                                >
                                    <Icon name="MessageCircle" size={16} /> Contactar WhatsApp
                                </button>
                            )}
                         </div>

                         <div className="mt-3 pt-3 border-t border-white/5 text-center">
                             <p className="text-[9px] text-slate-500">Miembro desde: {joined.toString().slice(0,10)}</p>
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- VISTA PRINCIPAL (LISTA) ---
    return (
        <div className="space-y-6 fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-4 rounded-3xl border border-slate-100 shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-100 text-brand-600 p-2 rounded-xl">
                        <Icon name="Users" size={24}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 leading-tight">Directorio</h2>
                        <p className="text-xs text-slate-500 font-bold">{dataList.length} Miembros registrados</p>
                    </div>
                </div>
                <div className="relative w-full md:w-64 group">
                    <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-brand-500 transition-colors"/>
                    <input 
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm" 
                        placeholder="Buscar por nombre, rol..." 
                        value={searchTerm} 
                        onChange={e=>setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            {/* Grid de Miembros */}
            {filteredMembers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMembers.map(member => {
                        const name = getField(member, 'name', 'nombre') || 'Sin nombre';
                        const role = getField(member, 'role', 'rol', 'cargo') || 'Miembro';
                        const photo = getPhoto(getField(member, 'photo', 'foto', 'avatar', 'img'), name);
                        const phone = getField(member, 'phone', 'telefono', 'celular');

                        return (
                            <div 
                                key={member.id || Math.random()} 
                                onClick={() => { setSelectedMember(member); setIsFlipped(false); }}
                                className="group bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer flex items-center gap-3"
                            >
                                <div className="relative">
                                    <img src={photo} className="w-12 h-12 rounded-xl object-cover bg-slate-100" alt={name}/>
                                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${phone ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-brand-600 transition-colors">{name}</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide truncate">{role}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                    <Icon name="CreditCard" size={14} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <Icon name="Search" size={24} className="opacity-20"/>
                    </div>
                    <p className="font-bold text-sm">No encontramos a nadie.</p>
                    <p className="text-xs">Intenta con otro nombre.</p>
                </div>
            )}

            {/* Modal - Credencial */}
            {selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="relative z-10 animate-enter flex flex-col items-center gap-6">
                        {renderCredential(selectedMember)}
                        <button 
                            onClick={() => setSelectedMember(null)}
                            className="bg-white text-slate-800 px-6 py-2.5 rounded-full font-bold shadow-2xl hover:bg-slate-50 transition-transform active:scale-95 text-xs flex items-center gap-2"
                        >
                            <Icon name="X" size={14}/> Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Estilos CSS Inline para 3D */}
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
