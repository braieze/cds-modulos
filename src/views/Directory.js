// src/views/Directory.js
window.Views = window.Views || {};

window.Views.Directory = ({ members, addData, updateData, deleteData }) => {
    const { useState } = React;
    const { Button, Icon, Modal, Input, Select, Card, Badge } = window.Utils;

    const [editing, setEditing] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const initialForm = { name: '', email: '', phone: '', age: '', address: '', role: 'Miembro', ministry: 'General', skills: '' }; // Added skills
    const [formData, setFormData] = useState(initialForm);

    const openModal = (m = null) => { setEditing(m); setFormData(m || initialForm); setIsModalOpen(true); };
    const handleSave = () => {
        if (!formData.name) return window.Utils.notify("Nombre requerido", "error");
        const data = { ...formData, photo: formData.photo || `https://ui-avatars.com/api/?name=${formData.name}&background=random` };
        editing ? updateData('members', editing.id, data) : addData('members', { ...data, status: 'Activo' });
        setIsModalOpen(false);
    };

    const filtered = members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Directorio</h2>
                <div className="flex gap-2"><Input placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-40 md:w-64" /><Button icon="Plus" onClick={()=>openModal()}>Nuevo</Button></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filtered.map(m => (
                    <Card key={m.id} className="relative group hover:border-brand-300">
                        <button onClick={()=>openModal(m)} className="absolute top-4 right-4 text-slate-300 hover:text-brand-600"><Icon name="Edit" size={16}/></button>
                        <div className="flex items-center gap-4">
                            <img src={m.photo} className="w-12 h-12 rounded-full bg-slate-100"/>
                            <div><h3 className="font-bold text-slate-900">{m.name}</h3><Badge type="brand">{m.role}</Badge></div>
                        </div>
                        <div className="mt-3 text-sm text-slate-500 space-y-1">
                            {m.phone && <div className="flex items-center gap-2"><Icon name="Smile" size={14}/> {m.phone}</div>}
                            {m.skills && <div className="flex items-center gap-2 text-brand-600"><Icon name="Music" size={14}/> {m.skills}</div>}
                        </div>
                    </Card>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title={editing ? "Editar" : "Nuevo"}>
                <div className="space-y-4">
                    <Input label="Nombre" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Rol" value={formData.role} onChange={e=>setFormData({...formData, role:e.target.value})}><option>Miembro</option><option>Líder</option><option>Pastor</option></Select>
                        <Select label="Ministerio" value={formData.ministry} onChange={e=>setFormData({...formData, ministry:e.target.value})}><option>General</option><option>Alabanza</option><option>Servidores</option><option>EBD</option></Select>
                    </div>
                    <Input label="Habilidades / Instrumentos" value={formData.skills} onChange={e=>setFormData({...formData, skills:e.target.value})} placeholder="Ej. Guitarra, Voz, Maestro" />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Teléfono" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} />
                        <Input label="Email" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} />
                    </div>
                    <Button className="w-full" onClick={handleSave}>Guardar</Button>
                </div>
            </Modal>
        </div>
    );
};
