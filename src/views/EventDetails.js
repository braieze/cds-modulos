// src/views/EventDetails.js
window.Views = window.Views || {};

window.Views.EventDetails = ({ isOpen, onClose, dateStr, worship, servers, ebd, youth, profile }) => {
    const { useMemo } = React;
    const { Modal, Button, Icon, Badge, formatDate } = window.Utils;

    // 1. Cruzar datos de todas las colecciones para esta fecha
    const dailyData = useMemo(() => {
        if (!dateStr) return null;
        
        // Buscar coincidencia exacta de fecha (YYYY-MM-DD)
        const w = worship.find(i => i.date === dateStr);
        const s = servers.find(i => i.date === dateStr);
        const e = ebd.find(i => i.date === dateStr);
        const y = youth.find(i => i.date === dateStr);

        return { worship: w, server: s, ebd: e, youth: y };
    }, [dateStr, worship, servers, ebd, youth]);

    // 2. Generar PDF (Orden de Culto)
    const generatePDF = () => {
        if (!window.jspdf) return alert("Error al cargar librería PDF");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Encabezado
        doc.setFontSize(18);
        doc.text(`Orden del Día: ${formatDate(dateStr, 'long')}`, 14, 20);
        doc.setFontSize(10);
        doc.text("Generado desde Conquistadores App", 14, 26);
        
        let yPos = 40;

        const addSection = (title, content) => {
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(title, 14, yPos);
            yPos += 8;
            doc.setFontSize(11);
            doc.setTextColor(80, 80, 80);
            content.forEach(line => {
                doc.text(`• ${line}`, 14, yPos);
                yPos += 6;
            });
            yPos += 10; // Espacio entre secciones
        };

        // Alabanza
        if (dailyData.worship) {
            const w = dailyData.worship;
            const lines = [
                `Tema: ${w.theme || 'N/A'}`,
                `Líder/Vocal: ${w.team?.Vocal || '--'}`,
                `Canciones: ${w.songList?.join(', ') || 'Sin definir'}`
            ];
            addSection("🎵 Ministerio de Alabanza", lines);
        }

        // Servidores
        if (dailyData.server) {
            const s = dailyData.server;
            const lines = [
                `Tipo: ${s.type}`,
                `Predicador: ${s.preacher || 'No asignado'}`,
                `Recepción: ${s.assignments?.['Recepción'] || '--'}`,
                `Altar: ${s.assignments?.['Altar'] || '--'}`
            ];
            addSection("👋 Servidores & Orden", lines);
        }

        // EBD
        if (dailyData.ebd) {
            addSection("📚 Escuela Bíblica", [`Tema: ${dailyData.ebd.title}`, `Maestros: ${dailyData.ebd.assignments?.Maestro || '--'}`]);
        }

        doc.save(`Orden_Culto_${dateStr}.pdf`);
    };

    if (!dailyData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalle Global: ${formatDate(dateStr, 'short')}`}>
            <div className="space-y-6">
                
                {/* Botón de Acción */}
                <div className="flex justify-end">
                    <Button variant="secondary" icon="Clipboard" onClick={generatePDF}>Descargar PDF</Button>
                </div>

                {/* 1. SECCIÓN CENTRAL (Predicador y Tema) */}
                <div className="bg-brand-50 border border-brand-100 p-4 rounded-2xl text-center">
                    <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">Actividad Principal</span>
                    <h2 className="text-xl font-extrabold text-brand-900 mt-1">
                        {dailyData.server?.type || dailyData.worship?.type || 'Actividad General'}
                    </h2>
                    {dailyData.server?.preacher && (
                        <div className="mt-2 inline-block bg-white px-3 py-1 rounded-full text-sm font-bold text-slate-700 shadow-sm border border-brand-100">
                            🎤 Predica: {dailyData.server.preacher}
                        </div>
                    )}
                </div>

                {/* 2. ALABANZA */}
                {dailyData.worship ? (
                    <div className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3 text-purple-700 font-bold">
                            <Icon name="Music" /> <span>Alabanza</span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2"><strong>Tema:</strong> {dailyData.worship.theme}</p>
                        <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                            {dailyData.worship.songList?.map((s, i) => <div key={i}>🎵 {s}</div>) || "Sin canciones"}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(dailyData.worship.team || {}).map(([k,v]) => v && v.length>0 && (
                                <Badge key={k} type="default">{k}: {v}</Badge>
                            ))}
                        </div>
                    </div>
                ) : <p className="text-center text-slate-400 text-xs italic">Sin datos de Alabanza</p>}

                {/* 3. SERVIDORES */}
                {dailyData.server ? (
                    <div className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3 text-blue-700 font-bold">
                            <Icon name="Hand" /> <span>Servidores</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(dailyData.server.assignments || {}).map(([k,v]) => v && (
                                <div key={k} className="bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">{k}</span>
                                    <span className="text-sm font-medium text-slate-800">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : <p className="text-center text-slate-400 text-xs italic">Sin datos de Servidores</p>}

                {/* 4. MINISTERIOS (EBD / Jóvenes) */}
                <div className="grid grid-cols-2 gap-4">
                    {dailyData.ebd && (
                        <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                            <div className="flex items-center gap-1 text-green-700 font-bold text-xs mb-1"><Icon name="BookOpen" size={14}/> EBD</div>
                            <p className="text-sm font-bold">{dailyData.ebd.title}</p>
                        </div>
                    )}
                    {dailyData.youth && (
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                            <div className="flex items-center gap-1 text-orange-700 font-bold text-xs mb-1"><Icon name="Smile" size={14}/> Jóvenes</div>
                            <p className="text-sm font-bold">{dailyData.youth.title}</p>
                        </div>
                    )}
                </div>

            </div>
        </Modal>
    );
};
