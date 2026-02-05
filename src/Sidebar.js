window.Sidebar = ({ activeTab, onTabChange, isOpen, toggleSidebar, userProfile }) => {
    const { Icon } = window.Utils || {};

    // 1. Menú Principal
    const mainItems = [
        { id: 'dashboard', label: 'Inicio', icon: 'Home' },
        { id: 'calendar', label: 'Calendario', icon: 'Calendar' },
        { id: 'blog', label: 'Devocionales', icon: 'Book' }, // ¡Restaurado!
        { id: 'announcements', label: 'Anuncios', icon: 'Bell' },
    ];

    // 2. Menú de Gestión
    const managementItems = [
        { id: 'directory', label: 'Directorio', icon: 'Users' },
        { id: 'finances', label: 'Tesorería', icon: 'Wallet', role: 'Pastor' },
        { id: 'pastoral', label: 'Pastoral', icon: 'Heart', role: ['Pastor', 'Líder'] },
    ];

    // Helper de permisos
    const showMinistry = (ministryName) => {
        if (!userProfile) return false;
        if (userProfile.role === 'Pastor') return true; 
        return userProfile.ministry === ministryName; 
    };

    return (
        <React.Fragment>
            {/* Overlay para móviles */}
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/20 z-20 lg:hidden backdrop-blur-sm transition-opacity" onClick={toggleSidebar}></div>
            )}

            {/* SIDEBAR (DISEÑO BLANCO / LIGHT) */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-30 
                w-64 bg-white border-r border-slate-200 shadow-xl lg:shadow-none
                transform transition-transform duration-300 ease-in-out flex flex-col 
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Cabecera */}
                <div className="p-6 flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        {Icon ? <Icon name="Church" /> : <span>✝</span>}
                    </div>
                    <div>
                        <h1 className="text-slate-800 font-extrabold text-lg tracking-tight leading-tight">Conquistadores</h1>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Panel de Líderes</p>
                    </div>
                </div>

                {/* Menú Scrollable */}
                <nav className="flex-1 overflow-y-auto py-2 px-4 space-y-6 hide-scroll">
                    
                    {/* Principal */}
                    <div className="space-y-1">
                        {mainItems.map((item) => (
                            <button 
                                key={item.id} 
                                onClick={() => { onTabChange(item.id); if(window.innerWidth < 1024) toggleSidebar(); }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-bold text-sm
                                    ${activeTab === item.id 
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }
                                `}
                            >
                                {Icon && <Icon name={item.icon} className={activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />}
                                <span>{item.label}</span>
                                {item.id === 'announcements' && <span className="ml-auto w-2 h-2 rounded-full bg-red-500"></span>}
                            </button>
                        ))}
                    </div>

                    {/* Ministerios */}
                    <div>
                        <div className="px-2 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ministerios</div>
                        <div className="space-y-1">
                            {showMinistry('Alabanza') && (
                                <button onClick={() => { onTabChange('worship'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${activeTab === 'worship' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-purple-50 hover:text-purple-700'}`}>
                                    {Icon && <Icon name="Music" />} <span>Alabanza</span>
                                </button>
                            )}
                            {showMinistry('EBD') && (
                                <button onClick={() => { onTabChange('ebd'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${activeTab === 'ebd' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-orange-50 hover:text-orange-700'}`}>
                                    {Icon && <Icon name="BookOpen" />} <span>Escuela Bíblica</span>
                                </button>
                            )}
                            {showMinistry('Jóvenes') && (
                                <button onClick={() => { onTabChange('youth'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${activeTab === 'youth' ? 'bg-yellow-500 text-white shadow-md' : 'text-slate-500 hover:bg-yellow-50 hover:text-yellow-700'}`}>
                                    {Icon && <Icon name="Smile" />} <span>Jóvenes</span>
                                </button>
                            )}
                            {showMinistry('Servidores') && (
                                <button onClick={() => { onTabChange('servers'); if(window.innerWidth < 1024) toggleSidebar(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${activeTab === 'servers' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                                    {Icon && <Icon name="Hand" />} <span>Servidores</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Gestión */}
                    <div>
                        <div className="px-2 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión</div>
                        <div className="space-y-1">
                            {managementItems.map((item) => {
                                if (item.role && userProfile?.role !== 'Pastor' && !Array.isArray(item.role) && item.role !== userProfile?.role) return null;
                                if (Array.isArray(item.role) && !item.role.includes(userProfile?.role)) return null;
                                
                                return (
                                    <button key={item.id} onClick={() => { onTabChange(item.id); if(window.innerWidth < 1024) toggleSidebar(); }}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-bold text-sm
                                            ${activeTab === item.id 
                                                ? 'bg-slate-800 text-white shadow-md' 
                                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                            }
                                        `}
                                    >
                                        {Icon && <Icon name={item.icon} />}
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </nav>

                {/* Footer / Logout */}
                <div className="p-4 border-t border-slate-100">
                    <button onClick={() => window.location.reload()} className="w-full flex items-center gap-3 text-slate-400 hover:text-red-500 hover:bg-red-50 p-3 rounded-xl text-xs font-bold transition-all">
                        {Icon && <Icon name="LogOut" size={16}/>} Cerrar Sesión
                    </button>
                </div>
            </aside>
        </React.Fragment>
    );
};
