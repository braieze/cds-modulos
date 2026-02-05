window.Sidebar = ({ activeTab, onTabChange, isOpen, toggleSidebar }) => {
    const { Icon } = window.Utils;

    const menuItems = [
        { id: 'dashboard', label: 'Inicio', icon: 'Home' },
        { id: 'calendar', label: 'Calendario', icon: 'Calendar' }, // Lo subimos de prioridad
        { id: 'announcements', label: 'Anuncios', icon: 'Bell' }, // Nuevo Tablón
        { id: 'directory', label: 'Miembros', icon: 'Users' },
        { id: 'pastoral', label: 'Pastoral', icon: 'Heart' },
        { id: 'finances', label: 'Tesorería', icon: 'DollarSign' }, // Intocable por ahora
        // { id: 'tasks', label: 'Actividades', icon: 'List' }, // Lo agregaremos luego
    ];

    return (
        <>
            {/* Overlay móvil */}
            {isOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={toggleSidebar}></div>}

            <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#0f172a] border-r border-white/10 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
                <div className="p-6 flex items-center gap-3 border-b border-white/10">
                    <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Icon name="Church" className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg tracking-tight">Conquistadores</h1>
                        <p className="text-slate-400 text-xs font-medium">Panel de Líderes</p>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { onTabChange(item.id); if(window.innerWidth < 1024) toggleSidebar(); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                                activeTab === item.id 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            <Icon name={item.icon} className={`transition-colors ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                            <span className="font-medium text-sm">{item.label}</span>
                            {item.id === 'announcements' && <span className="ml-auto w-2 h-2 rounded-full bg-red-500"></span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button onClick={() => window.location.reload()} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white p-2 text-xs transition-colors">
                        <Icon name="LogOut" size={14}/> Cerrar Sesión
                    </button>
                </div>
            </aside>
        </>
    );
};
