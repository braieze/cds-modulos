// src/views/Directory.js
window.Views = window.Views || {};

window.Views.Directory = ({ userProfile }) => {
    // 1. HOOKS
    const { useState, useMemo } = React;
    const Utils = window.Utils || {};
    const { Button, Modal, Input, Icon } = Utils;

    // 2. ESTADOS
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); // Para el modal de credencial
    const [isFlipped, setIsFlipped] = useState(false); // Para el efecto 3D

    // 3. DATOS DE EJEMPLO (Si no hay base de datos aún, usamos estos)
    // En el futuro, esto vendrá de tus props 'members' o 'directory'
    const initialMembers = [
        { 
            id: 'MEM-001', 
            name: 'Braian Gomez', 
            role: 'Pastor General', 
            photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', 
            phone: '5491112345678', 
            bloodGroup: 'O+', 
            emergencyContact: 'María Gomez', 
            emergencyPhone: '5491187654321',
            joinedDate: '2020-03-15'
        },
        { 
            id: 'MEM-002', 
            name: 'Leonardo F.', 
            role: 'Líder de Jóvenes', 
            photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', 
            phone: '5491122334455', 
            bloodGroup: 'A-', 
            emergencyContact: 'Padres', 
            emergencyPhone: '5491199887766',
            joinedDate: '2021-06-10'
        },
        { 
            id: 'MEM-003', 
            name: 'Carla Ruiz', 
            role: 'Maestra Escuela B.', 
            photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', 
            phone: '5491155556666', 
            bloodGroup: 'B+', 
            emergencyContact: 'Esposo', 
            emergencyPhone: '5491144443333',
            joinedDate: '2022-01-20'
        }
    ];

    const [members] = useState(initialMembers);

    // 4. FILTRADO
    const filteredMembers = useMemo(() => {
        return members.filter(m => 
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            m.role.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [members, searchTerm]);

    // 5. HELPER PARA WHATSAPP
    const openWhatsApp = (phone) => {
        const p = phone.replace(/\D/g,''); // Solo números
        window.open(`https://wa.me/${p}`, '_blank');
    };

    // --- RENDERIZADO DE LA CREDENCIAL (La parte visual compleja) ---
    const renderCredential = (member) => {
        if (!member) return null;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${member.id}`;

        return (
            <div className="perspective-1000 w-[320px] h-[500px] cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`relative w-full h-full duration-700 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* --- FRENTE (FRONT) --- */}
                    <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col items-center pt-8 pb-4 px-6">
                        {/* Agujero para cinta (Estético) */}
                        <div className="absolute top-4 w-12 h-3 bg-slate-200 rounded-full mx-auto left-0 right-0 shadow-inner"></div>
                        <div className="absolute top-[-20px] w-24 h-24 bg-brand-50 rounded-full blur-3xl opacity-50"></div>

                        {/* Encabezado */}
                        <div className="text-center mb-6 z-10">
                            <h3 className="text-xs font-black tracking-[0.2em] text-slate-400 uppercase">Conquistadores</h3>
                            <div className="h-1 w-8 bg-brand-500 mx-auto mt-2 rounded-full"></div>
                        </div>

                        {/* Foto */}
                        <div className="w-32 h-32 rounded-2xl p-1 bg-gradient-to-tr from-brand-400 to-indigo-500 shadow-lg mb-4">
                            <img src={member.photo} className="w-full h-full object-cover rounded-xl bg-white" alt={member.name} />
                        </div>

                        {/* Info Principal */}
                        <div className="text-center space-y-1 mb-6">
                            <h2 className="text-2xl font-extrabold text-slate-800 leading-tight">{member.name}</h2>
                            <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded-full uppercase tracking-wide">
                                {member.role}
                            </span>
                        </div>

                        {/* Footer con QR */}
                        <div className="mt-auto flex items-center justify-between w-full bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="text-left">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">ID Miembro</p>
                                <p className="text-sm font-mono font-bold text-slate-600">{member.id}</p>
                            </div>
                            <img src={qrUrl} className="w-12 h-12 mix-blend-multiply opacity-80" alt="QR" />
                        </div>
                        
                        {/* Indicador de giro */}
                        <div className="absolute bottom-2 text-[10px] text-slate-400 flex items-center gap-1 animate-pulse">
                            <Icon name="RotateCw" size={10} /> Tocar para girar
                        </div>
                    </div>

                    {/* --- DORSO (BACK) --- */}
                    <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-800 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 relative">
                         {/* Decoración de fondo */}
                         <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500 rounded-full blur-[50px] opacity-20"></div>
                         <div className="absolute top-4 w-12 h-3 bg-slate-700 rounded-full mx-auto left-0 right-0 shadow-inner"></div>

                         <div className="mt-8 text-center mb-8">
                            <Icon name="Shield" size={32} className="mx-auto text-brand-400 mb-2"/>
                            <h3 className="font-bold text-lg">Información Segura</h3>
                            <p className="text-xs text-slate-400">Solo para uso interno</p>
                         </div>

                         <div className="space-y-6 z-10">
                            {/* Datos Médicos */}
                            <div className="bg-white/5 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                                <div className="flex items-center gap-2 mb-3 text-red-400 font-bold text-xs uppercase tracking-wider">
                                    <Icon name="Heart" size={12}/> Salud / Emergencia
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-slate-400">Grupo Sanguíneo</p>
                                        <p className="font-bold text-lg">{member.bloodGroup || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400">Contacto</p>
                                        <p className="font-bold text-sm truncate">{member.emergencyContact}</p>
                                    </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-white/10">
                                    <p className="text-[10px] text-slate-400">Tel. Emergencia</p>
                                    <a href={`tel:${member.emergencyPhone}`} className="text-white font-mono hover:text-red-400 transition-colors block">{member.emergencyPhone || '-'}</a>
                                </div>
                            </div>

                            {/* Botón WhatsApp */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); openWhatsApp(member.phone); }}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                            >
                                <Icon name="MessageCircle" /> Enviar WhatsApp
                            </button>
                         </div>

                         <div className="mt-auto text-center">
                             <p className="text-[10px] text-slate-500">Miembro desde {member.joinedDate}</p>
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- VISTA PRINCIPAL ---
    return (
        <div className="space-y-8 fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-extrabold text-slate-800">Directorio</h2>
                <div className="relative w-full md:w-72">
                    <Icon name="Search" size={18} className="absolute left-3 top-3 text-slate-400"/>
                    <input 
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm" 
                        placeholder="Buscar por nombre o rol..." 
                        value={searchTerm} 
                        onChange={e=>setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            {/* Grid de Personas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMembers.map(member => (
                    <div 
                        key={member.id} 
                        onClick={() => { setSelectedMember(member); setIsFlipped(false); }}
                        className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer flex items-center gap-4"
                    >
                        <img src={member.photo} className="w-14 h-14 rounded-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 truncate group-hover:text-brand-600 transition-colors">{member.name}</h4>
                            <p className="text-xs text-slate-500 truncate">{member.role}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500">
                            <Icon name="ChevronRight" size={16} />
                        </div>
                    </div>
                ))}
            </div>

            {filteredMembers.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="Users" size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>No se encontraron miembros.</p>
                </div>
            )}

            {/* Modal de Credencial */}
            {selectedMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop con desenfoque */}
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    
                    {/* Contenedor del efecto 3D */}
                    <div className="relative z-10 animate-enter">
                        {renderCredential(selectedMember)}
                        
                        {/* Botón cerrar flotante */}
                        <button 
                            onClick={() => setSelectedMember(null)}
                            className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-6 py-2 rounded-full font-bold shadow-lg hover:bg-slate-100 transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Estilos CSS necesarios para el Flip 3D (Inyectados inline para no tocar tu archivo CSS) */}
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
};
