// src/Utils.js
(function() {
    window.Utils = window.Utils || {};
    const { React } = window;
    const { useState, useEffect, useRef, useMemo } = React;

    // --- 1. ICONOS ---
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
            Info: <React.Fragment><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></React.Fragment>,
            Image: <React.Fragment><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></React.Fragment>,
            Printer: <React.Fragment><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></React.Fragment>,
            Clock: <React.Fragment><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></React.Fragment>,
            MessageCircle: <React.Fragment><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></React.Fragment>
        };
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                {icons[name] || <circle cx="12" cy="12" r="10"/>}
            </svg>
        );
    };

    // --- 2. HELPERS ---
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

    // --- 3. TOASTS ---
    window.Utils.notify = (message, type = 'success') => {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type, id: Date.now() } }));
    };
    window.Utils.ToastContainer = () => {
        const { useState, useEffect } = React;
        const { Icon } = window.Utils;
        const [toasts, setToasts] = useState([]);
        useEffect(() => {
            const handler = (e) => {
                const t = e.detail;
                setToasts(p => [...p, t]);
                setTimeout(() => setToasts(p => p.filter(i => i.id !== t.id)), 3500);
            };
            window.addEventListener('app-toast', handler);
            return () => window.removeEventListener('app-toast', handler);
        }, []);
        if(!toasts.length) return null;
        return (
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold ${t.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-slate-900 border-slate-800 text-white'}`}>
                        <Icon name={t.type === 'error' ? 'AlertCircle' : 'Check'} size={18} /> {t.message}
                    </div>
                ))}
            </div>
        );
    };

    // --- 4. DATE FILTER (Selector Robusto) ---
    window.Utils.DateFilter = ({ currentDate, onChange }) => {
        const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const handleMonth = (e) => {
            const d = new Date(currentDate);
            d.setMonth(parseInt(e.target.value));
            onChange(d);
        };

        const handleYear = (e) => {
            const d = new Date(currentDate);
            d.setFullYear(parseInt(e.target.value));
            onChange(d);
        };

        return (
            <div className="flex gap-2 mb-4">
                <div className="relative">
                    <select value={month} onChange={handleMonth} className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold py-2 pl-4 pr-8 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none shadow-sm cursor-pointer hover:bg-slate-50">
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
                <div className="relative">
                    <select value={year} onChange={handleYear} className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold py-2 pl-4 pr-8 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none shadow-sm cursor-pointer hover:bg-slate-50">
                        {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>
        );
    };
    // Alias para compatibilidad con vistas anteriores
    window.Utils.MonthNav = window.Utils.DateFilter;
    window.Utils.MonthCarousel = window.Utils.DateFilter;

    // --- 5. COMPONENTES UI ---
    window.Utils.Input = ({ label, type="text", value, onChange, placeholder, className="" }) => (
        <div className={className}>
            {label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}
            <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-input placeholder:text-slate-400 outline-none" />
        </div>
    );

    window.Utils.Select = ({ label, value, onChange, children, className="" }) => (
        <div className={className}>
            {label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}
            <div className="relative">
                <select value={value} onChange={onChange} className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-input outline-none appearance-none">{children}</select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></div>
            </div>
        </div>
    );

    window.Utils.SmartSelect = ({ label, options, value, onChange, placeholder = "Seleccionar..." }) => {
        const { Icon } = window.Utils;
        const [isOpen, setIsOpen] = useState(false);
        const [search, setSearch] = useState("");
        const wrapperRef = useRef(null);
        useEffect(() => {
            const h = (e) => { if(wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false); };
            document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
        }, []);
        const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
        return (
            <div className="relative" ref={wrapperRef}>
                {label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}
                <div onClick={()=>{setIsOpen(!isOpen); setSearch("");}} className={`w-full bg-white border cursor-pointer text-slate-900 font-medium rounded-xl px-4 py-3 flex justify-between items-center transition-all shadow-input ${isOpen?'ring-2 ring-brand-500 border-brand-500':'border-slate-300 hover:border-slate-400'}`}>
                    <span className={!value?"text-slate-400":""}>{options.find(o=>o.value===value)?.label || placeholder}</span>
                    <Icon name="ChevronDown" size={16} className={`text-slate-400 transition-transform ${isOpen?'rotate-180':''}`}/>
                </div>
                {isOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-enter">
                        <div className="p-2 border-b border-slate-50 bg-slate-50"><div className="flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg"><Icon name="Search" size={14} className="text-slate-400 mr-2"/><input autoFocus className="w-full text-sm outline-none bg-transparent placeholder-slate-400" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
                        <div className="max-h-48 overflow-y-auto p-1">
                            {filtered.length ? filtered.map(o => (<div key={o.value} onClick={()=>{onChange(o.value); setIsOpen(false);}} className={`px-3 py-2.5 rounded-lg text-sm cursor-pointer flex justify-between items-center ${value===o.value?'bg-brand-50 text-brand-700 font-bold':'text-slate-700 hover:bg-slate-50'}`}>{o.label}{value===o.value&&<Icon name="Check" size={14}/>}</div>)) : <div className="px-3 py-4 text-center text-xs text-slate-400">Sin resultados</div>}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    window.Utils.Card = ({ children, className = "", onClick }) => (<div onClick={onClick} className={`bg-white rounded-2xl p-6 shadow-soft border border-slate-100 transition-all ${className}`}>{children}</div>);
    window.Utils.Badge = ({ children, type = 'default' }) => { const s = { default: "bg-slate-100 text-slate-600", success: "bg-emerald-100 text-emerald-700", warning: "bg-amber-100 text-amber-700", danger: "bg-red-100 text-red-700", brand: "bg-brand-100 text-brand-700", blue: "bg-blue-100 text-blue-700" }; return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${s[type] || s.default}`}>{children}</span>; };
    window.Utils.Button = ({ children, onClick, variant = 'primary', icon, className = "", disabled=false }) => { const { Icon } = window.Utils; const v = { primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-glow", secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50", danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100", ghost: "bg-transparent text-slate-500 hover:bg-slate-100" }; return (<button disabled={disabled} onClick={onClick} className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${className}`}>{icon && <Icon name={icon} size={18} />}{children}</button>); };
    window.Utils.Modal = ({ isOpen, onClose, title, children }) => { const { Icon } = window.Utils; useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : 'unset'; return () => { document.body.style.overflow = 'unset'; }; }, [isOpen]); if (!isOpen) return null; return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-enter"><div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10"><h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{title}</h3><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Icon name="X" /></button></div><div className="p-6">{children}</div></div></div>); };
    window.Utils.Skeleton = ({ className = "h-4 w-full" }) => (<div className={`skeleton-pulse rounded-lg bg-slate-200 ${className}`}></div>);
    window.Utils.compressImage = (file) => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width; canvas.width = (scaleSize < 1) ? MAX_WIDTH : img.width; canvas.height = (scaleSize < 1) ? img.height * scaleSize : img.height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.7)); }; }; reader.onerror = error => reject(error); }); };

})();
