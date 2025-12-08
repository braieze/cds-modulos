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
    
    // Referencia para la impresión
    const cardRef = useRef(null);

    // 3. DATOS
    const dataList = Array.isArray(members) ? members : (Array.isArray(directory) ? directory : []);

    // 4. HELPER DE DATOS
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

    // --- FUNCIÓN DE DESCARGA PDF ---
    const downloadPDF = async () => {
        if (!selectedMember || !cardRef.current) return;
        setIsDownloading(true);

        try {
            // Cargar librería dinámicamente si no existe
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
                filename: `Credencial_${selectedMember.name || 'Miembro'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: true },
                jsPDF: { unit: 'mm', format: [55, 88], orientation: 'portrait' } // Tamaño tarjeta estándar CR80
            };

            // Hack: Renderizar el lado frontal y trasero secuencialmente para el PDF o simplemente el visible
            // Para simplificar, generaremos un PDF de la vista actual (Frente o Dorso)
            // Lo ideal para impresión es descargar ambos lados. 
            // Aquí descargaremos lo que el usuario está viendo actualmente.
            await window.html2pdf().set(opt).from(element).save();

        } catch (error) {
            console.error("Error generando PDF", error);
            alert("Hubo un error al generar el PDF. Intenta nuevamente.");
        }
        setIsDownloading(false);
    };

    // --- RENDERIZADO DE LA CREDENCIAL ---
    const renderCredential = (m) => {
        if (!m) return null;

        const id = m.id || 'ID-000';
        const name = getField(m, 'name', 'nombre') || 'Sin Nombre';
        // Dividir nombre en dos líneas si es muy largo para el estilo visual
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

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

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;

        return (
            <div className="perspective-1000 w-[320px] h-[510px] cursor-pointer group select-none relative" onClick={() => !isDownloading && setIsFlipped(!isFlipped)}>
                
                {/* Contenedor Giratorio */}
                <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* --- FRENTE (Estilo AdvertHive adaptado) --- */}
                    <div ref={!isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100">
                        
                        {/* 1. Header & Agujero Lanyard */}
                        <div className="relative pt-6 px-6 pb-2 flex justify-between items-start z-20">
                            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">CONQUISTADORES</span>
                            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase opacity-50">2025</span>
                            
                            {/* Agujero virtual */}
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-200 rounded-full shadow-inner"></div>
                            {/* Gancho metálico decorativo */}
                            <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-4 h-8 border-x-2 border-b-2 border-slate-300 rounded-b-full z-0"></div>
                        </div>

                        {/* 2. Nombres Grandes */}
                        <div className="px-6 mt-2 z-20">
                            <h2 className="text-4xl font-black text-slate-800 leading-[0.9] tracking-tight">{firstName}</h2>
                            <h2 className="text-4xl font-black text-brand-600 leading-[0.9] tracking-tight">{lastName}</h2>
                            
                            {/* Badge de Rol con Icono */}
                            <div className="mt-3 inline-flex items-center gap-2">
                                <div className="bg-amber-500 text-white p-1 rounded-full">
                                    <Icon name="ArrowRight" size={12} strokeWidth={4} />
                                </div>
                                <span className="font-bold text-slate-600 uppercase tracking-wider text-sm">{role}</span>
                            </div>
                        </div>

                        {/* 3. Elementos Decorativos Geométricos */}
                        <div className="absolute top-32 left-6 flex gap-1 z-10">
                            <div className="w-8 h-8 rounded-full bg-brand-600"></div>
                            <div className="w-8 h-16 rounded-b-full rounded-t-none bg-amber-500 -mt-8"></div> {/* Semicírculo */}
                        </div>

                        {/* 4. Foto Estilo Tarjeta */}
                        <div className="absolute top-36 right-[-20px] w-48 h-56 bg-slate-100 rounded-3xl overflow-hidden shadow-lg border-4 border-white z-10 rotate-[-2deg]">
                            <img src={photo} className="w-full h-full object-cover" alt={name} onError={(e) => e.target.src = getPhoto(null, name)}/>
                            
                            {/* Sticker "Edad" sobre la foto */}
                            {age && (
                                <div className="absolute bottom-2 left-2 bg-amber-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-md border-2 border-white rotate-12">
                                    {age}
                                </div>
                            )}
                        </div>

                        {/* 5. Footer (QR & ID) */}
                        <div className="mt-auto p-6 z-20 bg-gradient-to-t from-white via-white to-transparent">
                            <div className="flex items-end gap-4">
                                <div className="p-1 bg-brand-50 rounded-xl border border-brand-100">
                                    <img src={qrUrl} className="w-16 h-16 mix-blend-multiply opacity-90" alt="QR" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-brand-600 uppercase mb-0.5">#ID Miembro</p>
                                    <p className="text-lg font-mono font-black text-slate-700 leading-none">{id}</p>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Email Contact</p>
                                <p className="text-xs font-bold text-slate-600 truncate">{email || 'sin@email.com'}</p>
                            </div>
                        </div>
                        
                        {/* Indicador de giro */}
                        <div className="absolute bottom-2 right-4 text-[9px] text-slate-300 flex items-center gap-1 z-30">
                            <Icon name="RefreshCw" size={10} /> Voltear
                        </div>
                    </div>

                    {/* --- DORSO (Estilo Términos y Condiciones) --- */}
                    <div ref={isFlipped ? cardRef : null} className="absolute w-full h-full backface-hidden rotate-y-180 bg-brand-700 text-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col p-8 relative">
                         
                        {/* Agujero Lanyard Reverso */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-3 bg-brand-800 rounded-full shadow-inner"></div>
                        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-4 h-8 border-x-2 border-b-2 border-brand-600 rounded-b-full"></div>

                        <div className="mt-8 mb-6">
                            <h3 className="font-bold text-2xl leading-tight">Datos <br/><span className="text-amber-400">Privados</span></h3>
                            <div className="h-1 w-12 bg-white mt-2"></div>
                        </div>

                        <div className="flex-1 space-y-6">
                            {/* Ítems numerados como "Reglas" */}
                            <div className="flex gap-4 items-start">
                                <span className="font-mono text-amber-400 font-bold text-lg opacity-80">01.</span>
                                <div>
                                    <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Contacto Personal</p>
                                    <p className="font-medium text-sm leading-tight">{phone || 'No registrado'}</p>
                                    <p className="text-xs opacity-60 mt-1">{address || 'Sin dirección'}</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <span className="font-mono text-amber-400 font-bold text-lg opacity-80">02.</span>
                                <div>
                                    <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Grupo Sanguíneo</p>
                                    <p className="font-medium text-sm">{blood}</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <span className="font-mono text-red-400 font-bold text-lg opacity-80">03.</span>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-red-200 mb-1">Emergencia</p>
                                    <p className="font-medium text-sm">{emerContact || 'Sin contacto'}</p>
                                    <p className="font-mono text-xs text-red-200 mt-1">{emerPhone}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto flex justify-between items-end border-t border-brand-500 pt-4">
                            <div>
                                <div className="w-8 h-8 bg-amber-500 rounded-full mb-2"></div>
                                <p className="text-[9px] opacity-60">Iglesia Conquistadores</p>
                            </div>
                            <div className="w-8 h-8 bg-white rounded-full"></div>
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

            {/* Modal Credencial */}
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
                        {isDownloading && <p className="text-white text-xs animate-pulse">Prepara la credencial en posición correcta antes de descargar...</p>}
                    </div>
                </div>
            )}

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
};
