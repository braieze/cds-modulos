window.Sidebar = ({ activeTab, onTabChange, isOpen, toggleSidebar, userProfile }) => {
    const { Icon } = window.Utils || {};

    // 1. Menú Principal (General)
    const mainItems = [
        { id: 'dashboard', label: 'Inicio', icon: 'Home' },
        { id: 'calendar', label: 'Calendario', icon: 'Calendar' },
        { id: 'announcements', label: 'Anuncios', icon: 'Bell' },
    ];

    // 2. Menú de Gestión (Administrativo)
    const managementItems = [
        { id: 'directory', label: 'Directorio', icon: 'Users' },
        { id: 'finances', label: 'Tesorería', icon: 'DollarSign', role: 'Pastor' }, // Solo Pastor
        { id: 'pastoral', label: 'Pastoral', icon: 'Heart', role: ['Pastor', 'Líder'] },
    ];

    // 3. Helper para saber si mostrar un ministerio
    const showMinistry = (ministryName) => {
        if (!userProfile) return false;
        if (userProfile.role === 'Pastor') return true; // Pastor ve todo
        return userProfile.ministry === ministryName; // El líder ve su ministerio
    };

    return (
        <React.Fragment>
            {/* Overlay móvil */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={toggleSidebar}></div>
            )}

            <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#0f172a] border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                {/* Cabecera */}
                <div className="p-6 flex items-center gap-3 border-b border-white/10">
                    <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        {Icon ? <Icon name="Church" className="text-white" /> : <span>✝</span>}
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg tracking-tight">Conquistadores</h1>
                        <p className="text-slate-400 text-xs font-medium">Panel de Líderes</p>
                    </div>
                </div>

                {/* Scroll Area */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
                    
                    {/* Sección Principal */}
                    <div className="space-y-1">
                        {mainItems.map((item) => (
                            <button key={item.id} onClick={() => { onTabChange(item.id); if(window.innerWidth < 1024) toggleSidebar(); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                {Icon && <Icon name={item.icon} />}
                                <span className="font-medium text-sm">{item.label}</span>
                                {item.id === 'announcements' && <span className="ml-auto w-2 h-2 rounded-full bg-red-500"></span>}
                            </button>
                        ))}
                    </div>

                    {/* Sección Ministerios (RESTAURADA) */}
                    <div>
                        <div className="px-4 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ministerios</div>
                        <div className="space-y-1">
                            {/* ALABANZA (Siempre visible para el equipo) */}
                            {showMinistry('Alabanza') && (
                                <button onClick={() => { onTabChange('worship'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'worship' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                    {Icon && <Icon name="Music" />} <span className="font-medium text-sm">Alabanza</span>
                                </button>
                            )}
                            
                            {/* EBD */}
                            {showMinistry('EBD') && (
                                <button onClick={() => { onTabChange('ebd'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'ebd' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                    {Icon && <Icon name="BookOpen" />} <span className="font-medium text-sm">Escuela Bíblica</span>
                                </button>
                            )}

                            {/* JÓVENES */}
                            {showMinistry('Jóvenes') && (
                                <button onClick={() => { onTabChange('youth'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'youth' ? 'bg-yellow-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                    {Icon && <Icon name="Smile" />} <span className="font-medium text-sm">Jóvenes</span>
                                </button>
                            )}

                            {/* SERVIDORES */}
                            {showMinistry('Servidores') && (
                                <button onClick={() => { onTabChange('servers'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'servers' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                    {Icon && <Icon name="Hand" />} <span className="font-medium text-sm">Servidores</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sección Gestión */}
                    <div>
                        <div className="px-4 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Gestión</div>
                        <div className="space-y-1">
                            {managementItems.map((item) => {
                                // Filtro de seguridad simple
                                if (item.role && userProfile?.role !== 'Pastor' && !item.role.includes(userProfile?.role)) return null;
                                
                                return (
                                    <button key={item.id} onClick={() => { onTabChange(item.id); if(window.innerWidth < 1024) toggleSidebar(); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                        {Icon && <Icon name={item.icon} />}
                                        <span className="font-medium text-sm">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button onClick={() => window.location.reload()} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-3 rounded-xl text-xs font-bold transition-all">
                        {Icon && <Icon name="LogOut" size={16}/>} Cerrar Sesión
                    </button>
                </div>
            </aside>
        </React.Fragment>
    );
};
