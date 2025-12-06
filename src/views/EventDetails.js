// src/views/EventDetails.js
window.Views = window.Views || {};

window.Views.EventDetails = ({ isOpen, onClose, dateStr, worship, servers, ebd, youth }) => {
    const { useMemo } = React;
    // Acceso seguro a Utils
    const Utils = window.Utils || {};
    const { Modal, Button, Icon, Badge, formatDate } = Utils;

    // 1. Unificar datos de la fecha
    const dailyData = useMemo(() => {
        if (!dateStr) return null;
        // Búsqueda segura con arrays vacíos por defecto
        const w = (worship || []).find(i => i.date === dateStr);
        const s = (servers || []).find(i => i.date === dateStr);
        const e = (ebd || []).find(i => i.date === dateStr);
        const y = (youth || []).find(i => i.date === dateStr);
        return { worship: w, server: s, ebd: e, youth: y };
    }, [dateStr, worship, servers, ebd, youth]);

    // 2. Generador de PDF Profesional
    const generatePDF = () => {
        if (!window.jspdf) return alert("Error: Librería PDF no cargada");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Colores corporativos
        const blue = [37, 99, 235]; 
        const lightGray = [241, 245, 249];

        // --- ENCABEZADO ---
        doc.setFillColor(...blue);
        doc.rect(0, 0, 210, 35, 'F'); // Barra azul superior
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("ORDEN DEL DÍA", 15, 18);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        // Usamos window.Utils para formatear fecha
        doc.text(window.Utils.formatDate(dateStr, 'long').toUpperCase(), 15, 26);
        doc.text("CONQUISTADORES APP", 150, 22);

        let y = 50;

        // Función para dibujar secciones limpias
        const drawSection = (title, items) => {
            if (y > 250) { doc.addPage(); y = 20; }

            // Fondo del título
            doc.setFillColor(...lightGray);
            doc.roundedRect(10, y-6, 190, 10, 2, 2, 'F');
            
            // Texto del título
            doc.setTextColor(...blue);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(title.toUpperCase(), 15, y);
            y += 10;

            // Contenido
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            
            items.forEach(item => {
                if (!item.value) return;
                
                doc.setFont("helvetica", "bold");
                doc.text(`• ${item.label}:`, 20, y);
                
                doc.setFont("helvetica", "normal");
                // Ajuste de texto largo para que no se salga de la hoja
                const splitText = doc.splitTextToSize(String(item.value), 120);
                doc.text(splitText, 60, y);
                
                y += (splitText.length * 5) + 3; // Espacio dinámico
            });
            y += 8; // Separador de sección
        };

        // Sección SERVIDORES
        if (dailyData.server) {
            const assigns = dailyData.server.assignments || {};
            const staffList = Object.entries(assigns).map(([k, v]) => ({ label: k, value: v }));
            
            drawSection("Servidores & Orden", [
                { label: "Tipo", value: dailyData.server.type },
                { label: "Predicador", value: dailyData.server.preacher || "No asignado" },
                ...staffList
            ]);
        }

        // Sección ALABANZA
        if (dailyData.worship) {
            const w = dailyData.worship;
            // Convertir equipo a texto legible
            const teamStr = Object.entries(w.team || {}).map(([inst, name]) => `${inst}: ${name}`).join(' | ');

            drawSection("Ministerio de Alabanza", [
                { label: "Tema", value: w.theme || '--' },
                { label: "Equipo", value: teamStr },
                { label: "SETLIST", value: w.songList?.join(', ') || 'A definir' }
            ]);
        }

        // Sección EBD
        if (dailyData.ebd) {
            drawSection("Escuela Bíblica", [
                { label: "Tema", value: dailyData.ebd.details?.topic || '--' },
                { label: "Maestros", value: dailyData.ebd.assignments?.Maestro || '--' }
            ]);
        }

        // Sección JÓVENES
        if (dailyData.youth) {
            drawSection("Jóvenes", [
                { label: "Tema", value: dailyData.youth.details?.topic || '--' },
                { label: "Líder", value: dailyData.youth.assignments?.Lider || '--' }
            ]);
        }

        doc.save(`Programa_${dateStr}.pdf`);
    };

    if (!dailyData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Resumen: ${formatDate(dateStr, 'short')}`}>
            <div className="space-y-6">
                
                {/* Botón Descarga */}
                <div className="flex justify-end">
                    <Button variant="secondary" icon="Printer" onClick={generatePDF}>Descargar PDF</Button>
                </div>

                {/* VISUALIZACIÓN EN PANTALLA */}
                <div className="grid grid-cols-1 gap-4">
                    
                    {/* Tarjeta Principal (Título del día) */}
                    <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl text-center">
                        <h2 className="text-xl font-bold text-brand-900">
                            {dailyData.server?.type || dailyData.worship?.type || 'Actividad General'}
                        </h2>
                        {dailyData.server?.preacher && (
                            <div className="mt-2 inline-block bg-white px-3 py-1 rounded-full text-sm font-bold text-slate-700 shadow-sm border border-brand-100">
                                🎤 {dailyData.server.preacher}
                            </div>
                        )}
                    </div>

                    {/* Alabanza */}
                    {dailyData.worship && (
                        <div className="border border-slate-200 rounded-xl p-4">
                            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <Icon name="Music"/> Alabanza
                            </h4>
                            <p className="text-sm mb-2 text-slate-600">Tema: <strong>{dailyData.worship.theme}</strong></p>
                            <div className="flex flex-wrap gap-2">
                                {dailyData.worship.songList?.map((s, i) => <Badge key={i} type="default">🎵 {s}</Badge>)}
                            </div>
                        </div>
                    )}

                    {/* Servidores */}
                    {dailyData.server && (
                        <div className="border border-slate-200 rounded-xl p-4">
                            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <Icon name="Hand"/> Equipo
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(dailyData.server.assignments || {}).map(([k, v]) => (
                                    <div key={k} className="bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className="block text-[10px] text-slate-400 uppercase font-bold">{k}</span>
                                        <span className="font-medium text-slate-800">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EBD & Jóvenes */}
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
            </div>
        </Modal>
    );
};
