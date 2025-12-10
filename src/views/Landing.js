window.Views = window.Views || {};

window.Views.Landing = ({ onEnterSystem }) => {
    const { useState, useEffect } = React;
    const Utils = window.Utils || {};
    const { Icon } = Utils;

    const [scrolled, setScrolled] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Detectar scroll para el navbar
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Datos Mock para la web
    const events = [
        { day: 'DOM', date: '10:00 AM', title: 'Reunión General', desc: 'Un tiempo de adoración y palabra para toda la familia.' },
        { day: 'MIE', date: '20:00 PM', title: 'Escuela de Vida', desc: 'Profundizando en las escrituras y el discipulado.' },
        { day: 'SAB', date: '18:00 PM', title: 'Reunión de Jóvenes', desc: 'Energía, música y amigos conectados con Dios.' }
    ];

    return (
        <div className="font-sans text-slate-800 bg-white selection:bg-brand-100 selection:text-brand-900">
            
            {/* --- NAVBAR --- */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg ${scrolled ? 'bg-brand-600 text-white' : 'bg-white text-brand-600'}`}>
                            C
                        </div>
                        <span className={`font-extrabold text-xl tracking-tight ${scrolled ? 'text-slate-800' : 'text-white'}`}>
                            CONQUISTADORES
                        </span>
                    </div>

                    {/* Menú Desktop */}
                    <div className={`hidden md:flex items-center gap-8 font-bold text-sm ${scrolled ? 'text-slate-600' : 'text-white/90'}`}>
                        <a href="#inicio" className="hover:text-brand-500 transition-colors">INICIO</a>
                        <a href="#nosotros" className="hover:text-brand-500 transition-colors">NOSOTROS</a>
                        <a href="#ministerios" className="hover:text-brand-500 transition-colors">MINISTERIOS</a>
                        <a href="#radio" className="hover:text-brand-500 transition-colors flex items-center gap-2"><Icon name="Radio" size={14}/> RADIO</a>
                    </div>

                    {/* Botón Acceso Sistema */}
                    <button 
                        onClick={onEnterSystem}
                        className={`px-6 py-2.5 rounded-full font-bold text-xs transition-all transform hover:scale-105 shadow-lg flex items-center gap-2 ${scrolled ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-900 hover:bg-slate-100'}`}
                    >
                        <Icon name="User" size={14}/>
                        ACCESO LÍDERES
                    </button>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <header id="inicio" className="relative h-screen flex items-center justify-center overflow-hidden">
                {/* Fondo Video/Imagen */}
                <div className="absolute inset-0 bg-slate-900">
                    <img 
                        src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?ixlib=rb-4.0.3&auto=format&fit=crop&w=2073&q=80" 
                        className="w-full h-full object-cover opacity-60"
                        alt="Worship Background"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white"></div>
                </div>

                <div className="relative z-10 text-center px-6 max-w-4xl mt-10">
                    <p className="text-brand-300 font-bold tracking-[0.3em] uppercase mb-4 animate-enter">Bienvenidos a casa</p>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight drop-shadow-2xl animate-enter">
                        Un lugar para <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-blue-200">Crecer y Creer.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
                        Somos una familia apasionada por Jesús. Nuestra misión es conectar personas con el propósito de Dios para sus vidas.
                    </p>
                    <div className="flex flex-col md:flex-row gap-4 justify-center">
                        <button className="bg-brand-600 text-white px-8 py-4 rounded-full font-bold text-sm hover:bg-brand-500 transition-all shadow-glow hover:shadow-brand-500/50">
                            PLANEA TU VISITA
                        </button>
                        <button onClick={() => window.location.href='#radio'} className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-full font-bold text-sm hover:bg-white hover:text-brand-900 transition-all flex items-center justify-center gap-2">
                            <Icon name="Play" size={16} fill="currentColor"/> VER EN VIVO
                        </button>
                    </div>
                </div>
            </header>

            {/* --- SECCIÓN HORARIOS & EVENTOS --- */}
            <section id="horarios" className="py-20 relative -mt-20 z-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {events.map((ev, i) => (
                            <div key={i} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 hover:-translate-y-2 transition-transform duration-300 group">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-brand-50 text-brand-700 font-black text-xs px-3 py-1 rounded-lg tracking-wider">{ev.day}</span>
                                    <span className="text-slate-400 font-bold text-sm">{ev.date}</span>
                                </div>
                                <h3 className="text-2xl font-extrabold text-slate-800 mb-2 group-hover:text-brand-600 transition-colors">{ev.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{ev.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- SECCIÓN RADIO --- */}
            <section id="radio" className="py-20 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/20 rounded-full blur-[80px]"></div>
                
                <div className="max-w-5xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border border-red-500/20">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> En el aire
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black mb-4">Radio Conquistadores</h2>
                        <p className="text-slate-400 text-lg mb-8">Música que edifica, palabra que transforma. Acompáñanos las 24 horas del día.</p>
                        
                        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                            <button 
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all transform hover:scale-105 ${isPlaying ? 'bg-red-500' : 'bg-brand-600'}`}
                            >
                                <Icon name={isPlaying ? "Pause" : "Play"} size={24} fill="currentColor" />
                            </button>
                            <div className="flex-1">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Ahora suena</p>
                                <p className="font-bold text-white">Tu Fidelidad - Marcos Witt</p>
                            </div>
                            <div className="flex gap-1 items-end h-8">
                                {[1,2,3,4,5].map(n => (
                                    <div key={n} className={`w-1 bg-brand-500 rounded-full ${isPlaying ? 'animate-pulse' : 'h-2'}`} style={{height: isPlaying ? `${Math.random() * 24 + 4}px` : '4px', animationDuration: `${Math.random() * 0.5 + 0.5}s`}}></div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 relative">
                         <img 
                            src="https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                            className="rounded-3xl shadow-2xl border-4 border-white/10 rotate-3 hover:rotate-0 transition-transform duration-500"
                        />
                    </div>
                </div>
            </section>

            {/* --- SECCIÓN MINISTRIOS --- */}
            <section id="ministerios" className="py-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-bold text-brand-600 uppercase tracking-widest mb-2">Nuestros Espacios</h2>
                        <h3 className="text-3xl md:text-4xl font-black text-slate-900">Hay un lugar para ti</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { name: 'Niños', img: 'https://images.unsplash.com/photo-1502086223501-6e3861d85b37?auto=format&fit=crop&w=500&q=80' },
                            { name: 'Jóvenes', img: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=500&q=80' },
                            { name: 'Mujeres', img: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?auto=format&fit=crop&w=500&q=80' },
                            { name: 'Hombres', img: 'https://images.unsplash.com/photo-1552642986-ccb41e7059e7?auto=format&fit=crop&w=500&q=80' }
                        ].map((m, i) => (
                            <div key={i} className="relative group rounded-2xl overflow-hidden h-80 cursor-pointer">
                                <img src={m.img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                                <div className="absolute bottom-6 left-6">
                                    <h4 className="text-2xl font-bold text-white mb-1">{m.name}</h4>
                                    <p className="text-white/80 text-sm flex items-center gap-1 group-hover:translate-x-2 transition-transform">Ver más <Icon name="ArrowRight" size={14}/></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="bg-white border-t border-slate-100 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
                            <span className="font-extrabold text-lg text-slate-900">CONQUISTADORES</span>
                        </div>
                        <p className="text-slate-500 mb-6 max-w-sm">
                            Una iglesia comprometida con llevar el mensaje de esperanza a cada rincón de nuestra ciudad.
                        </p>
                        <div className="flex gap-4">
                            {['Instagram', 'Facebook', 'Youtube'].map(s => (
                                <a key={s} href="#" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-brand-600 hover:text-white transition-colors">
                                    <Icon name={s === 'Youtube' ? 'Video' : 'Share2'} size={18}/>
                                </a>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 mb-6">Contacto</h4>
                        <ul className="space-y-4 text-slate-500 text-sm">
                            <li className="flex items-start gap-3">
                                <Icon name="MapPin" size={18} className="text-brand-600 shrink-0"/>
                                <span>Calle 154 N° 3540,<br/>Berazategui, Buenos Aires</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Icon name="Phone" size={18} className="text-brand-600 shrink-0"/>
                                <span>+54 9 11 1234-5678</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Icon name="Mail" size={18} className="text-brand-600 shrink-0"/>
                                <span>contacto@cds.church</span>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 mb-6">Horarios</h4>
                        <ul className="space-y-2 text-slate-500 text-sm">
                            <li className="flex justify-between"><span>Domingos</span> <span className="font-bold text-slate-700">10:00 AM</span></li>
                            <li className="flex justify-between"><span>Miércoles</span> <span className="font-bold text-slate-700">20:00 PM</span></li>
                            <li className="flex justify-between"><span>Sábados</span> <span className="font-bold text-slate-700">18:00 PM</span></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400">
                    <p>&copy; 2025 Iglesia Conquistadores. Todos los derechos reservados.</p>
                    <p>Desarrollado con ❤️ para el Reino.</p>
                </div>
            </footer>
        </div>
    );
};
