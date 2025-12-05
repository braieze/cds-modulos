// src/Utils.js
window.Utils = {};

// --- ICONOS ---
window.Utils.Icon = ({ name, size = 20, className = "" }) => {
    const icons = {
        Home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
        Users: <React.Fragment><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></React.Fragment>,
        Wallet: <React.Fragment><path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></React.Fragment>,
        Music: <React.Fragment><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></React.Fragment>,
        Book: <React.Fragment><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></React.Fragment>,
        Smile: <React.Fragment><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></React.Fragment>,
        Bell: <React.Fragment><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></React.Fragment>,
        Calendar: <React.Fragment><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></React.Fragment>,
        LogOut: <React.Fragment><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></React.Fragment>,
        Plus: <React.Fragment><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></React.Fragment>,
        X: <React.Fragment><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></React.Fragment>,
        Menu: <React.Fragment><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></React.Fragment>,
        Trash: <React.Fragment><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></React.Fragment>,
        Edit: <React.Fragment><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></React.Fragment>,
        Hand: <React.Fragment><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></React.Fragment>,
        Mail: <React.Fragment><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></React.Fragment>,
        Clipboard: <React.Fragment><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></React.Fragment>,
        ChevronLeft: <polyline points="15 18 9 12 15 6" />,
        ChevronRight: <polyline points="9 18 15 12 9 6" />
    };
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            {icons[name] || <circle cx="12" cy="12" r="10"/>}
        </svg>
    );
};

// --- FORMATTERS ---
window.Utils.formatDate = (d) => {
    if(!d) return '';
    const date = new Date(d);
    if(d.length === 10) date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};
window.Utils.formatTime = (t) => t ? t : '--:--';
window.Utils.formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);

// --- COMPONENTES UI ---
window.Utils.Card = ({ children, className = "" }) => <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 ${className}`}>{children}</div>;

window.Utils.Badge = ({ children, type = 'default' }) => {
    const styles = { default: "bg-slate-100 text-slate-600", success: "bg-emerald-100 text-emerald-700", warning: "bg-amber-100 text-amber-700", danger: "bg-red-100 text-red-700", brand: "bg-brand-100 text-brand-700", blue: "bg-blue-100 text-blue-700" };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[type] || styles.default}`}>{children}</span>;
};

window.Utils.Button = ({ children, onClick, variant = 'primary', icon, className = "", disabled=false }) => {
    const { Icon } = window.Utils;
    const styles = { primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30", secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50", danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100" };
    return <button disabled={disabled} onClick={onClick} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}>{icon && <Icon name={icon} size={18} />}{children}</button>;
};

window.Utils.Modal = ({ isOpen, onClose, title, children }) => {
    const { Icon } = window.Utils;
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Icon name="X" /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};
