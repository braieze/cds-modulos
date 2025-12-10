(function() {
    window.Utils = window.Utils || {};
    const { useState, useEffect, useRef } = React;

    // --- TOASTS ---
    let toastListener = null;
    const notify = (msg, type = 'success') => {
        if (toastListener) toastListener(msg, type);
        else console.log("Toast:", msg);
    };

    const ToastContainer = () => {
        const [toasts, setToasts] = useState([]);
        useEffect(() => {
            const h = (e) => { 
                const t = e.detail; 
                setToasts(p => [...p, t]); 
                setTimeout(() => setToasts(p => p.filter(i => i.id !== t.id)), 3000); 
            };
            window.addEventListener('app-toast', h);
            toastListener = (m, t) => window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: m, type: t, id: Date.now() } }));
            return () => { window.removeEventListener('app-toast', h); toastListener = null; };
        }, []);
        if (!toasts.length) return null;
        return (
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold animate-enter ${t.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-slate-900 border-slate-800 text-white'}`}>
                        {t.message}
                    </div>
                ))}
            </div>
        );
    };

    // --- ICONOS ---
    const Icon = ({ name, size = 20, className = "" }) => {
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
            MessageCircle: <React.Fragment><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></React.Fragment>,
            Paperclip: <React.Fragment><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></React.Fragment>,
            Download: <React.Fragment><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></React.Fragment>,
            MapPin: <React.Fragment><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></React.Fragment>,
            Phone: <React.Fragment><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></React.Fragment>,
            User: <React.Fragment><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></React.Fragment>,
            Shield: <React.Fragment><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></React.Fragment>,
            Megaphone: <React.Fragment><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></React.Fragment>,
            Link: <React.Fragment><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></React.Fragment>,
            Eye: <React.Fragment><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></React.Fragment>,
            AlertTriangle: <React.Fragment><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></React.Fragment>,
            UserPlus: <React.Fragment><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></React.Fragment>,
            List: <React.Fragment><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></React.Fragment>,
            Play: <polygon points="5 3 19 12 5 21 5 3"/>,
            Radio: <React.Fragment><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></React.Fragment>,
            Share2: <React.Fragment><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></React.Fragment>,
            Video: <React.Fragment><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></React.Fragment>,
            RotateCw: <React.Fragment><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></React.Fragment>,
            ArrowRight: <React.Fragment><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></React.Fragment>,
            ArrowUp: <React.Fragment><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></React.Fragment>,
            Award: <React.Fragment><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></React.Fragment>,
            Send: <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        };
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                {icons[name] || <circle cx="12" cy="12" r="10"/>}
            </svg>
        );
    };

    // --- HELPERS LÓGICOS EXPORTADOS ---
    const parseLocalDate = (dateStr) => {
        if (!dateStr) return new Date();
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);

    const formatTime = (t) => t ? t : '--:--';

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
            reader.onerror = reject;
        });
    };

    // --- COMPONENTES UI ---
    const Button = ({ children, onClick, variant = 'primary', icon, className = "", disabled=false, size='md' }) => {
        const v = { primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-glow", secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50", danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100" };
        const s = { sm: "px-3 py-1.5 text-xs", md: "px-5 py-3 text-sm" };
        return (<button disabled={disabled} onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`}>{icon && <Icon name={icon} size={size==='sm'?14:18} />}{children}</button>);
    };

    const Input = ({ label, type="text", value, onChange, placeholder, className="" }) => (<div className={className}>{label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}<input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400" /></div>);
    
    const Select = ({ label, value, onChange, children, className="" }) => (<div className={className}>{label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}<div className="relative"><select value={value} onChange={onChange} className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 pr-10 outline-none appearance-none focus:ring-2 focus:ring-brand-500">{children}</select><div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Icon name="ChevronDown" size={16}/></div></div></div>);
    
    const Card = ({ children, className = "", onClick }) => (<div onClick={onClick} className={`bg-white rounded-2xl p-6 shadow-soft border border-slate-100 transition-all ${className}`}>{children}</div>);
    
    const Badge = ({ children, type = 'default' }) => { const s = { default: "bg-slate-100 text-slate-600", success: "bg-emerald-100 text-emerald-700", warning: "bg-amber-100 text-amber-700", brand: "bg-brand-100 text-brand-700", blue: "bg-blue-100 text-blue-700", danger: "bg-red-100 text-red-700" }; return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${s[type] || s.default}`}>{children}</span>; };
    
    const Modal = ({ isOpen, onClose, title, children }) => { 
        useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : 'unset'; return () => { document.body.style.overflow = 'unset'; }; }, [isOpen]); 
        if (!isOpen) return null; 
        return (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col relative animate-enter"><div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white"><h3 className="font-extrabold text-xl text-slate-800 tracking-tight">{title}</h3><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"><Icon name="X" /></button></div><div className="p-6 overflow-y-auto custom-scrollbar">{children}</div></div></div>); 
    };

    const DateFilter = ({ currentDate, onChange }) => {
        const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        return (
            <div className="flex gap-2 mb-4 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
                <button onClick={()=>{const d=new Date(currentDate);d.setMonth(d.getMonth()-1);onChange(d)}} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Icon name="ChevronLeft" size={16}/></button>
                <div className="px-4 py-2 font-bold text-slate-700 text-sm flex items-center">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</div>
                <button onClick={()=>{const d=new Date(currentDate);d.setMonth(d.getMonth()+1);onChange(d)}} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Icon name="ChevronRight" size={16}/></button>
            </div>
        );
    };

    const SmartSelect = ({ label, options, value, onChange, placeholder = "Seleccionar..." }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [search, setSearch] = useState("");
        const wrapperRef = useRef(null);
        useEffect(() => { const h = (e) => { if(wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
        const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
        return (
            <div className="relative" ref={wrapperRef}>
                {label && <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5 ml-1">{label}</label>}
                <div onClick={()=>{setIsOpen(!isOpen); setSearch("");}} className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-xl px-4 py-3 flex justify-between items-center cursor-pointer focus:ring-2 focus:ring-brand-500">
                    <span className={!value?"text-slate-400":""}>{value ? options.find(o=>o.value===value)?.label || value : placeholder}</span>
                    <Icon name="ChevronDown" size={16} className="text-slate-400"/>
                </div>
                {isOpen && (<div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-enter"><div className="p-2 bg-slate-50"><input autoFocus className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">{filtered.length ? filtered.map(o => (<div key={o.value} onClick={()=>{onChange(o.value); setIsOpen(false);}} className="px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-brand-50 hover:text-brand-700 flex justify-between items-center transition-colors">{o.label}</div>)) : <div className="p-2 text-center text-xs text-slate-400">Sin resultados</div>}</div></div>)}
            </div>
        );
    };

    window.Utils = { 
        ...window.Utils, 
        Icon, Button, Input, Modal, Select, DateFilter, SmartSelect, ToastContainer, notify, 
        formatCurrency, formatDate, formatTime, getLocalDate, compressImage, Card, Badge, parseLocalDate
    };
})();
