// src/views/Directory.js
window.Views = window.Views || {};

window.Views.Directory = ({ members, addData, updateData }) => {
    const { useState } = React;
    const { Button, Icon, Modal, Card } = window.Utils;

    const [editing, setEditing] = useState(null); 
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({});

    const openModal = (member = null) => {
        setEditing(member);
        setFormData(member || { name: '', role: 'Miembro', ministry: 'General', email: '', phone: '', age: '', location: '', gender: 'M' });
        setIsOpen(true);
    };

    const handleSave = () => {
        const dataToSave = {
            ...formData,
            photo: formData.photo || `https://ui-avatars.com/api/?name=${formData.name}&background=random`,
        };
        
        if (editing) {
            updateData('members', editing.id, dataToSave);
        } else {
            addData('members', { ...dataToSave, status: 'Activo', visitHistory: [] });
        }
        setIsOpen(false);
    };

    const filtered = members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
                <input className="input-modern max-w-xs" placeholder="Buscar miembro..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <Button icon="Plus" onClick={()=>openModal()}>Nuevo Miembro</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(m => (
                    <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative group">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>openModal(m)} className="p-1 bg-slate-100 rounded text-slate-600 hover:text-brand-600"><Icon name="Edit" size={14}/></button>
                        </div>
                        <div className="flex items-center gap-4">
                            <img src={m.photo} className="w-14 h-14 rounded-full object-cover bg-slate-100"/>
                            <div>
                                <h3 className="font-bold text-slate-800">{m.name}</h3>
                                <p className="text-xs text-brand-600 font-bold">{m.role} • {m.ministry}</p>
                                <p className="text-xs text-slate-400 mt-1">{m.phone || 'Sin cel'}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <Modal isOpen={isOpen} onClose={()=>setIsOpen(false)} title={editing ? "Editar Miembro" : "Nuevo Miembro"}>
                <div className="space-y-4">
                    <div><label className="label-modern">Nombre Completo</label><input className="input-modern" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="label-modern">Rol</label>
                        <select className="input-modern" value={formData.role} onChange={e=>setFormData({...formData, role:e.target.value})}>
                            {['Pastor','Líder','Servidor General','Miembro'].map(r=><option key={r}>{r}</option>)}
                        </select></div>
                        <div><label className="label-modern">Ministerio</label>
                        <select className="input-modern" value={formData.ministry} onChange={e=>setFormData({...formData, ministry:e.target.value})}>
                            {['Pastoral','Alabanza','EBD','Jóvenes','General','Adolescentes','Servidores'].map(m=><option key={m}>{m}</option>)}
                        </select></div>
                    </div>
                    <div><label className="label-modern">Email</label><input type="email" className="input-modern" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} /></div>
                    <Button className="w-full mt-4" onClick={handleSave}>Guardar Cambios</Button>
                </div>
            </Modal>
        </div>
    );
};
