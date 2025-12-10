window.Views = window.Views || {};

window.Views.EventDetails = ({ isOpen, onClose, dateStr, worship, servers, ebd, youth }) => {
    const { useMemo } = React;
    const Utils = window.Utils || {};
    const { Modal, Button, Icon, Badge, formatDate } = Utils;

    // Recolectar TODO lo que pasa ese día
    const dailyEvents = useMemo(() => {
        if (!dateStr) return [];
        let list = [];
        
        // Helper para agregar
        const add = (arr, type, color, titleKey) => {
            if(!arr) return;
            arr.filter(i => i.date === dateStr).forEach(item => {
                list.push({
                    ...item,
                    category: type,
                    color: color,
                    displayTitle: item[titleKey] || item.title || item.theme || item.type
                });
            });
        };

        add(worship, 'Alabanza', 'bg-purple-100 text-purple-800', 'theme');
        add(servers, 'Servidores', 'bg-blue-100 text-blue-800', 'type');
        add(ebd, 'EBD', 'bg-green-100 text-green-800', 'title');
        add(youth, 'Jóvenes', 'bg-yellow-100 text-yellow-800', 'title');

        return list.sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    }, [dateStr, worship, servers, ebd, youth]);

    // Generar PDF
    const generatePDF = () => {
        if (!window.jspdf) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text("CRONOGRAMA DEL DÍA", 14, 18);
        doc.setFontSize(10);
        doc.text(Utils.formatDate(dateStr, 'long').toUpperCase(), 14, 25);

        let y = 40;

        dailyEvents.forEach(ev => {
            if (y > 270) { doc.addPage(); y = 20; }
            
            // Título Evento
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y-5, 182, 8, 'F');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(`${ev.time || '--:--'} - ${ev.category.toUpperCase()}: ${ev.displayTitle}`, 16, y);
            y += 8;

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            
            // Detalles según tipo
            let details = [];
            if(ev.assignments) Object.entries(ev.assignments).forEach(([k,v]) => details.push(`${k}: ${v}`));
            if(ev.team) Object.entries(ev.team).forEach(([k,v]) => details.push(`${k}: ${Array.isArray(v)?v.join(', '):v}`));
            if(ev.details) Object.entries(ev.details).forEach(([k,v]) => details.push(`${k}: ${v}`));

            details.forEach(d => {
                doc.text(`• ${d}`, 20, y);
                y += 5;
            });
            y += 5;
        });

        doc.save(`Cronograma_${dateStr}.pdf`);
    };

    if (!dateStr) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Agenda: ${formatDate(dateStr)}`}>
            <div className="space-y-6">
                
                {dailyEvents.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 italic">No hay eventos registrados para este día.</div>
                ) : (
                    dailyEvents.map((ev, i) => (
                        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className={`px-4 py-2 flex justify-between items-center ${ev.color.split(' ')[0]}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded bg-white/50 ${ev.color.split(' ')[1]}`}>{ev.time}</span>
                                    <h3 className={`font-bold ${ev.color.split(' ')[1]}`}>{ev.category}</h3>
                                </div>
                            </div>
                            <div className="p-4 bg-white">
                                <h4 className="font-bold text-lg text-slate-800 mb-3">{ev.displayTitle}</h4>
                                
                                {/* Renderizado Dinámico de Detalles */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                                    {/* Alabanza */}
                                    {ev.team && Object.entries(ev.team).map(([k,v]) => v && (
                                        <div key={k}><span className="font-bold text-slate-500 text-xs uppercase">{k}:</span> <span className="text-slate-700">{Array.isArray(v)?v.join(', '):v}</span></div>
                                    ))}
                                    {/* Servidores */}
                                    {ev.assignments && Object.entries(ev.assignments).map(([k,v]) => v && (
                                        <div key={k}><span className="font-bold text-slate-500 text-xs uppercase">{k}:</span> <span className="text-slate-700">{v}</span></div>
                                    ))}
                                    {/* Detalles Extra */}
                                    {ev.details && Object.entries(ev.details).map(([k,v]) => v && (
                                        <div key={k}><span className="font-bold text-slate-500 text-xs uppercase">{k}:</span> <span className="text-slate-700">{v}</span></div>
                                    ))}
                                </div>

                                {ev.links && (
                                    <div className="mt-3 pt-2 border-t border-slate-100">
                                        <a href={ev.links} target="_blank" className="text-xs text-blue-500 hover:underline flex items-center gap-1"><Icon name="Link" size={12}/> Ver Material Adjunto</a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}

                <div className="flex justify-end pt-2">
                    <Button variant="secondary" icon="Printer" onClick={generatePDF} disabled={dailyEvents.length===0}>Descargar PDF</Button>
                </div>
            </div>
        </Modal>
    );
};
