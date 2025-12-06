// src/views/EventDetails.js
window.Views = window.Views || {};

window.Views.EventDetails = ({ isOpen, onClose, dateStr, worship, servers, ebd, youth }) => {
    const { useMemo } = React;
    const { Modal, Button, Icon, Badge, formatDate } = window.Utils;

    const dailyData = useMemo(() => {
        if (!dateStr) return null;
        const w = worship.find(i => i.date === dateStr);
        const s = servers.find(i => i.date === dateStr);
        const e = ebd.find(i => i.date === dateStr);
        const y = youth.find(i => i.date === dateStr);
        return { worship: w, server: s, ebd: e, youth: y };
    }, [dateStr, worship, servers, ebd, youth]);

    const generatePDF = () => {
        if (!window.jspdf) return window.Utils.notify("Librería PDF no cargada", "error");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const primaryColor = [37, 99, 235]; 
        
        doc.setFillColor(...primaryColor); doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("ORDEN DEL DÍA", 14, 20);
        doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text(formatDate(dateStr, 'long').toUpperCase(), 14, 28);
        
        let y = 55;
        const drawSection = (title, lines) => {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFillColor(241, 245, 249); doc.roundedRect(10, y - 6, 190, 10, 2, 2, 'F');
            doc.setTextColor(...primaryColor); doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(title.toUpperCase(), 14, y); y += 10;
            doc.setTextColor(0, 0, 0); doc.setFontSize(11);
            lines.forEach(line => { doc.setFont("helvetica", line.isBold ? "bold" : "normal"); doc.text(`• ${line.text}`, 18, y); y += 7; });
            y += 5;
        };

        if (dailyData.server) drawSection("Servidores", [{ text: `Tipo: ${dailyData.server.type}`, isBold: true }, { text: `Predicador: ${dailyData.server.preacher || 'No asignado'}`, isBold: true }, { text: `Recepción: ${dailyData.server.assignments?.['Recepción'] || '--'}`, isBold: false }, { text: `Altar: ${dailyData.server.assignments?.['Altar'] || '--'}`, isBold: false }]);
        if (dailyData.worship) drawSection("Alabanza", [{ text: `Tema: ${dailyData.worship.theme}`, isBold: true }, { text: `Vocal: ${dailyData.worship.team?.Vocal || '--'}`, isBold: false }, { text: `Setlist: ${dailyData.worship.songList?.join(', ') || 'N/A'}`, isBold: false }]);
        
        doc.save(`Programa_${dateStr}.pdf`);
    };

    if (!dailyData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Resumen: ${formatDate(dateStr, 'short')}`}>
            <div className="space-y-6">
                <div className="flex justify-end"><Button variant="secondary" icon="Clipboard" onClick={generatePDF}>PDF</Button></div>
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl text-center"><h2 className="text-xl font-bold text-brand-900">{dailyData.server?.type || 'Actividad General'}</h2>{dailyData.server?.preacher && <p className="text-brand-700 mt-1 font-medium">🎤 {dailyData.server.preacher}</p>}</div>
                    {dailyData.worship && <div className="border border-slate-200 rounded-xl p-4"><h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Icon name="Music"/> Alabanza</h4><p className="text-sm mb-2">Tema: <strong>{dailyData.worship.theme}</strong></p><div className="flex flex-wrap gap-2">{dailyData.worship.songList?.map((s, i) => <Badge key={i} type="default">{s}</Badge>)}</div></div>}
                    {dailyData.server && <div className="border border-slate-200 rounded-xl p-4"><h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Icon name="Hand"/> Equipo</h4><div className="grid grid-cols-2 gap-2 text-sm">{Object.entries(dailyData.server.assignments || {}).map(([k, v]) => (<div key={k}><span className="text-slate-500">{k}:</span> <span className="font-medium">{v}</span></div>))}</div></div>}
                </div>
            </div>
        </Modal>
    );
};
