// src/Utils.js
window.Utils = {};

// ==========================================
// 1. SISTEMA DE ICONOS (Completo)
// ==========================================
window.Utils.Icon = ({ name, size = 20, className = "" }) => {
    const icons = {
        Home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
        Menu: <React.Fragment><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></React.Fragment>,
        X: <React.Fragment><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></React.Fragment>,
        Plus: <React.Fragment><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></React.Fragment>,
        Trash: <React.Fragment><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></React.Fragment>,
        Edit: <React.Fragment><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></React.Fragment>,
        LogOut: <React.Fragment><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></React.Fragment>,
        ChevronLeft: <polyline points="15 18 9 12 15 6"/>,
        ChevronRight: <polyline points="9 18 15 12 9 6"/>,
        ChevronDown: <polyline points="6 9 12 15 18 9"/>,
        Search: <React.Fragment><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></React.Fragment>,
        Check: <polyline points="20 6 9 17 4 12"/>,
        AlertCircle: <React.Fragment><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></React.Fragment>,
        
        // Ministerios
        Users: <React.Fragment><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></React.Fragment>,
        Wallet: <React.Fragment><path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></React.Fragment>,
        Music: <React.Fragment><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></React.Fragment>,
        Book: <React.Fragment><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></React.Fragment>,
        BookOpen: <React.Fragment><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></React.Fragment>,
        Smile: <React.Fragment><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></React.Fragment>,
        Bell: <React.Fragment><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></React.Fragment>,
        Calendar: <React.Fragment><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></React.Fragment>,
        Hand: <React.Fragment><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></React.Fragment>,
        Mail: <React.Fragment><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></React.Fragment>,
        Clipboard: <React.Fragment><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></React.Fragment>,
        Briefcase: <React.Fragment><rect x="2" y="7" width="20" height="14" rx="2" ry="2" transform="translate(0 -2)"/></React.Fragment>,
        DollarSign: <React.Fragment><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></React.Fragment>,
        Info: <React.Fragment><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></React.Fragment>
    };
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            {icons[name] || <circle cx="12" cy="12" r="10"/>}
        </svg>
    );
};

// ==========================================
// 2. HELPERS DE FORMATO
// ==========================================
window.Utils.formatDate = (d, fmt = 'short') => {
    if(!d) return '';
    const date = new Date(d);
    if(d.length === 10) date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    
    if(fmt === 'long') return date.toLocaleDateString('es-AR', { weekday:'long', day: 'numeric', month: 'long' });
    if(fmt === 'month') return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};

window.Utils.formatTime = (t) => t ? t : '--:--';
window.Utils.formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);

// ==========================================
// 3. COMPONENTES UI: NOTIFICACIONES (TOASTS)
// ==========================================
window.Utils.notify = (message, type = 'success') => {
    // Despacha un evento personalizado que ToastContainer escuchará
    const event = new CustomEvent('app-toast', { detail: { message, type, id: Date.now() } });
    window.dispatchEvent(event);
};

window.Utils.ToastContainer = () => {
    const { useState, useEffect } = React;
    const { Icon } = window.Utils;
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handler = (e) => {
            const newToast = e.detail;
            setToasts(prev => [...prev, newToast]);
            // Auto eliminar después de 3s
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== newToast.id));
            }, 3500);
        };
        window.addEventListener('app-toast', handler);
        return () => window.removeEventListener('app-toast', handler);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className={`toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold ${
                    t.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-slate-900 border-slate-800 text-white'
                }`}>
                    <Icon name={t.type === 'error' ? 'AlertCircle' : 'Check'} size={18} />
                    {t.message}
                </div>
            ))}
        </div>
    );
};

// ==========================================
// 4. COMPONENTES UI: NAVEGACIÓN Y CARGA
// ==========================================

// SKELETON (Carga)
window.Utils.Skeleton = ({ className = "h-4 w-full" }) => (
    <div className={`skeleton-pulse rounded-lg bg-slate-200 ${className}`}></div>
);

// MONTH CAROUSEL (Navegación Mensual Pro)
window.Utils.MonthCarousel = ({ currentDate, onMonthChange }) => {
    const { React, useMemo } = window;
    const { Icon } = window.Utils;
    const scrollRef = React.useRef(null);

    const monthChips = useMemo(() => {
        const chips = [];
        for(let i=-6; i<=6; i++) { // Rango ampliado
            const d = new Date();
            d.setMonth(d.getMonth() + i);
            chips.push(d);
        }
        return chips;
    }, []);

    const scroll = (direction) => {
        if(scrollRef.current) {
            scrollRef.current.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
        }
    };

    return (
        <div className="relative group mb-6">
            {/* Flechas PC */}
            <button onClick={()=>scroll('left')} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur p-1 rounded-full shadow-sm border border-slate-200 text-slate-500 hover:text-brand-600 hover:scale-110 transition-all">
                <Icon name="ChevronLeft" size={20}/>
            </button>
            <button onClick={()=>scroll('right')} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur p-1 rounded-full shadow-sm border border-slate-200 text-slate-500 hover:text-brand-600 hover:scale-110 transition-all">
                <Icon name="ChevronRight" size={20}/>
            </button>

            {/* Contenedor Scroll */}
            <div ref={scrollRef} className="flex overflow-x-auto gap-2 py-2 px-1 hide-scroll scroll-smooth snap-x">
                {monthChips.map((d, i) => {
                    const isActive = d.toISOString().slice(0,7) === new Date(currentDate).toISOString().slice(0,7);
                    return (
                        <button 
                            key={i} 
                            onClick={() => onMonthChange(d)}
                            className={`snap-center flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border shadow-sm ${
                                isActive 
                                ? 'bg-brand-600 text-white border-brand-600 shadow-brand-500/30 scale-105' 
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                            {window.Utils.formatDate(d, 'month')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ==========================================
// 5. COMPONENTES UI: INPUTS INTELIGENTES
// ==========================================

// SMART SELECT (Buscador)
window.Utils.SmartSelect = ({ label, options, value, onChange, placeholder = "Seleccionar..." }) => {
    const { useState, useEffect, useRef } = React;
    const { Icon } = window.Utils;
    
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef(null);

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedLabel = options.find(o => o.value === value)?.label || "";

    return (
        <div className="relative" ref={wrapperRef}>
            {label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}
            
            {/* Input Trigger */}
            <div 
                onClick={() => { setIsOpen(!isOpen); setSearch(""); }}
                className={`w-full bg-white border cursor-pointer text-slate-900 font-medium rounded-xl px-4 py-3 flex justify-between items-center transition-all shadow-input ${isOpen ? 'ring-2 ring-brand-500 border-brand-500' : 'border-slate-300 hover:border-slate-400'}`}
            >
                <span className={!value ? "text-slate-400" : ""}>{value ? selectedLabel : placeholder}</span>
                <Icon name="ChevronDown" size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-enter">
                    <div className="p-2 border-b border-slate-50 bg-slate-50">
                        <div className="flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg">
                            <Icon name="Search" size={14} className="text-slate-400 mr-2"/>
                            <input 
                                autoFocus
                                className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                                placeholder="Buscar..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div 
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`px-3 py-2.5 rounded-lg text-sm cursor-pointer flex justify-between items-center ${value === opt.value ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                                {opt.label}
                                {value === opt.value && <Icon name="Check" size={14}/>}
                            </div>
                        )) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-400">No se encontraron resultados</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// INPUT ALTO CONTRASTE
window.Utils.Input = ({ label, type="text", value, onChange, placeholder, className="" }) => (
    <div className={className}>
        {label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}
        <input 
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-input placeholder:text-slate-400 outline-none"
        />
    </div>
);

// SELECT ALTO CONTRASTE (Nativo)
window.Utils.Select = ({ label, value, onChange, children, className="" }) => (
    <div className={className}>
        {label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}
        <div className="relative">
            <select 
                value={value}
                onChange={onChange}
                className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-input outline-none appearance-none"
            >
                {children}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
        </div>
    </div>
);

// ==========================================
// 6. COMPONENTES GENÉRICOS (LEGACY)
// ==========================================
window.Utils.Card = ({ children, className = "", onClick }) => (
    <div onClick={onClick} className={`bg-white rounded-2xl p-6 shadow-soft border border-slate-100 transition-all ${className}`}>
        {children}
    </div>
);

window.Utils.Badge = ({ children, type = 'default' }) => {
    const styles = { 
        default: "bg-slate-100 text-slate-600", 
        success: "bg-emerald-100 text-emerald-700", 
        warning: "bg-amber-100 text-amber-700", 
        danger: "bg-red-100 text-red-700", 
        brand: "bg-brand-100 text-brand-700", 
        blue: "bg-blue-100 text-blue-700" 
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[type] || styles.default}`}>{children}</span>;
};

window.Utils.Button = ({ children, onClick, variant = 'primary', icon, className = "", disabled=false }) => {
    const { Icon } = window.Utils;
    const variants = {
        primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-glow",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
        danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
        ghost: "bg-transparent text-slate-500 hover:bg-slate-100"
    };
    return (
        <button disabled={disabled} onClick={onClick} className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}>
            {icon && <Icon name={icon} size={18} />}{children}
        </button>
    );
};

window.Utils.Modal = ({ isOpen, onClose, title, children }) => {
    const { Icon } = window.Utils;
    const { useEffect } = React;
    
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);
    
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-enter">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Icon name="X" /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

// (Mantener Accordion por compatibilidad)
window.Utils.Accordion = ({ title, subtitle, badge, children, isOpen, onToggle }) => {
    const { Icon } = window.Utils;
    return (
        <div className={`border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-lg ring-1 ring-brand-500/20 bg-white' : 'bg-slate-50 hover:bg-white'}`}>
            <div className="p-4 cursor-pointer flex justify-between items-center" onClick={onToggle}>
                <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-10 rounded-full ${badge ? badge : 'bg-brand-500'}`}></div>
                    <div>
                        <h4 className="font-bold text-slate-800">{title}</h4>
                        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
                    </div>
                </div>
                <Icon name="ChevronDown" className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-white animate-enter">
                    {children}
                </div>
            )}
        </div>
    );
};
