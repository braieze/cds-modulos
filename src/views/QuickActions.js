// src/views/QuickActions.js
window.Views = window.Views || {};

window.Views.QuickActions = ({ userProfile, setActiveTab, setOpenModalName }) => { // setOpenModalName es un prop opcional si queremos abrir modales directos
    const { useState } = React;
    const { Icon } = window.Utils;

    const [isOpen, setIsOpen] = useState(false);

    if (!userProfile) return null;

    const actions = [];

    // Acciones para Pastor
    if (userProfile.role === 'Pastor') {
        actions.push({ label: 'Registrar Caja', icon: 'Wallet', color: 'bg-emerald-500', action: () => setActiveTab('finances') });
        actions.push({ label: 'Nuevo Devocional', icon: 'Book', color: 'bg-purple-500', action: () => setActiveTab('blog') });
        actions.push({ label: 'Enviar Aviso', icon: 'Mail', color: 'bg-blue-500', action: () => setActiveTab('messages') });
    }

    // Acciones para Líderes
    if (['Pastor', 'Líder'].includes(userProfile.role)) {
        actions.push({ label: 'Planificar Evento', icon: 'Calendar', color: 'bg-orange-500', action: () => setActiveTab('calendar') });
    }

    // Acciones Generales (Para todos los que sirven)
    if (userProfile.ministry !== 'General') {
        actions.push({ label: 'Ver mis Turnos', icon: 'Clipboard', color: 'bg-slate-700', action: () => setActiveTab('dashboard') });
    }

    if (actions.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* Menú Desplegable */}
            {isOpen && (
                <div className="flex flex-col gap-3 mb-2 animate-enter">
                    {actions.map((act, i) => (
                        <button 
                            key={i} 
                            onClick={() => { act.action(); setIsOpen(false); }}
                            className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all group"
                        >
                            <span className="text-sm font-bold text-slate-700">{act.label}</span>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md ${act.color}`}>
                                <Icon name={act.icon} size={18} />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Botón Principal (FAB) */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-glow flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 ${isOpen ? 'bg-slate-800 rotate-45' : 'bg-brand-600'}`}
            >
                <Icon name="Plus" size={28} />
            </button>
        </div>
    );
};
