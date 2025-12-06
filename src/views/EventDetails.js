// src/views/EventDetails.js
window.Views = window.Views || {};

window.Views.EventDetails = ({ isOpen, onClose, dateStr, worship, servers, ebd, youth }) => {
    const { useMemo } = React;
    const { Modal, Button, Icon, Badge, formatDate } = window.Utils;

    const dailyData = useMemo(() => {
        if (!dateStr) return null;
        // Búsqueda segura
        const w = (worship||[]).find(i => i.date === dateStr);
        const s = (servers||[]).find(i => i.date === dateStr);
        const e = (ebd||[]).find(i => i.date === dateStr);
        const y = (youth||[]).find(i => i.date === dateStr);
        return { worship: w, server: s, ebd: e, youth: y };
    }, [dateStr, worship, servers, ebd, youth]);

    const generatePDF = () => {
        if (!window.jspdf) return window.Utils.notify("Error PDF", "error");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); 
        doc.text("PROGRAMA DE ACTIVIDAD", 15, 20);
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); 
        doc.text(window.Utils.formatDate(dateStr, 'long').toUpperCase(), 15, 28);

        let y = 50;
        const drawSection = (title, items) => {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFillColor(240, 240, 240); doc.rect(15, y-5, 180, 8, 'F');
            doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
            doc.text(title, 18, y); y += 10;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10);
            items.forEach(i => {
                doc.text(`• ${i}`, 20, y); y += 6;
            });
            y += 5;
        };

        if(dailyData.server) {
            const list = Object.entries(dailyData.server.assignments||{}).map(([k,v]) => `${k}: ${v}`);
            drawSection("SERVIDORES", [`Tipo: ${dailyData.server.type}`, `Predica: ${dailyData.server.preacher||'--'}`, ...list]);
        }
        if(dailyData.worship) {
            drawSection("ALABANZA", [`Tema: ${dailyData.worship.theme}`, `Canciones: ${dailyData.worship.songList?.join(', ')||'--'}`]);
        }
        
        doc.save(`Programa_${dateStr}.pdf`);
    };

    if (!dailyData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalle: ${formatDate(dateStr, 'short')}`}>
            <div className="space-y-6">
                <div className="flex justify-end"><Button variant="secondary" icon="Printer" onClick={generatePDF}>PDF</Button></div>
                <div className="grid gap-4">
                    {/* Tarjeta Principal */}
                    <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl text-center">
                        <h2 className="text-xl font-bold text-brand-900">{dailyData.server?.type || dailyData.worship?.type || 'Actividad'}</h2>
                        {dailyData.server?.preacher && <p className="text-brand-700 mt-1 font-medium">🎤 {dailyData.server.preacher}</p>}
                    </div>
                    {/* Alabanza */}
                    {dailyData.worship && (
                        <div className="border border-slate-200 rounded-xl p-4">
                            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Icon name="Music"/> Alabanza</h4>
                            <p className="text-sm mb-2">Tema: {dailyData.worship.theme}</p>
                            <div className="flex flex-wrap gap-2">{dailyData.worship.songList?.map((s,i)=><Badge key={i}>{s}</Badge>)}</div>
                        </div>
                    )}
                    {/* Servidores */}
                    {dailyData.server && (
                        <div className="border border-slate-200 rounded-xl p-4">
                            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Icon name="Hand"/> Equipo</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(dailyData.server.assignments||{}).map(([k,v])=>(<div key={k}><span className="text-slate-500">{k}:</span> <b>{v}</b></div>))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
