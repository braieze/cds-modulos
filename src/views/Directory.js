// src/views/Directory.js
window.Views = window.Views || {};

window.Views.Directory = ({ members, addData, updateData, deleteData }) => {
    const { useState } = React;
    const { Button, Icon, Modal, Input, Select, Card, Badge } = window.Utils;

    const [editing, setEditing] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estado inicial del formulario con TODOS los campos requeridos
    const initialForm = { 
        name: '', 
        email: '', 
        phone: '', 
        age: '', 
        address: '', 
        location: '', 
        role: 'Miembro', 
        ministry: 'General',
        gender: 'M'
    };
    const [formData, setFormData] = useState(initialForm);

    const openModal = (member = null) => {
        setEditing(member);
        setFormData(member || initialForm);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if(window.confirm("¿Estás seguro de eliminar a este miembro? Esta acción no se puede deshacer.")) {
            deleteData('members', id);
        }
    };

    const handleSave = () => {
        // Validación simple
        if (!formData.name || !formData.role) {
            alert("El nombre y el rol son obligatorios.");
            return;
        }

        const dataToSave = {
            ...formData,
            // Si no tiene foto, generamos un avatar con sus iniciales
            photo: formData.photo || `https://ui-avatars.com/api/?name=${formData.name}&background=random&color=fff`,
            updatedAt: new Date().toISOString()
        };
        
        if (editing) {
            updateData('members', editing.id, dataToSave);
        } else {
            addData('members', { 
                ...dataToSave, 
                status: 'Activo', 
                createdAt: new Date().toISOString() 
            });
        }
        setIsModalOpen(false);
    };

    // Filtrado
    const filtered = members.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 fade-in">
            {/* Cabecera y Buscador */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Directorio de Miembros</h2>
                    <p className="text-slate-500 text-sm">{members.length} personas registradas</p>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                    <Input 
                        placeholder="Buscar por nombre, rol..." 
                        value={searchTerm} 
                        onChange={e=>setSearchTerm(e.target.value)} 
                        className="w-full md:w-64"
                    />
                    <Button icon="Plus" onClick={()=>openModal()}>Nuevo</Button>
                </div>
            </div>

            {/* Grid de Tarjetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(m => (
                    <Card key={m.id} className="relative group hover:border-brand-300 transition-colors">
                        {/* Botones de acción flotantes (visibles al hacer hover) */}
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>openModal(m)} className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors" title="Editar">
                                <Icon name="Edit" size={16}/>
                            </button>
                            <button onClick={()=>handleDelete(m.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Eliminar">
                                <Icon name="Trash" size={16}/>
                            </button>
                        </div>

                        <div className="flex items-start gap-4">
                            <img src={m.photo} alt={m.name} className="w-14 h-14 rounded-full object-cover bg-slate-100 border border-slate-200"/>
                            <div>
                                <h3 className="font-bold text-slate-900 leading-tight">{m.name}</h3>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    <Badge type="brand">{m.role}</Badge>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{m.ministry}</p>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Icon name="Mail" size={14} className="text-slate-400"/>
                                <span className="truncate">{m.email || 'Sin email'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Icon name="Smile" size={14} className="text-slate-400"/>
                                <span>{m.phone || 'Sin teléfono'}</span>
                            </div>
                            {m.address && (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Icon name="Home" size={14} className="text-slate-400"/>
                                    <span className="truncate">{m.address}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
            
            {/* Modal de Edición/Creación */}
            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title={editing ? "Editar Miembro" : "Registrar Persona"}>
                <div className="space-y-4">
                    <Input label="Nombre Completo *" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="Ej. Juan Pérez" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Rol *" value={formData.role} onChange={e=>setFormData({...formData, role:e.target.value})}>
                            <option>Miembro</option>
                            <option>Servidor General</option>
                            <option>Líder</option>
                            <option>Pastor</option>
                        </Select>
                        <Select label="Ministerio Principal" value={formData.ministry} onChange={e=>setFormData({...formData, ministry:e.target.value})}>
                            <option>General</option>
                            <option>Pastoral</option>
                            <option>Alabanza</option>
                            <option>Servidores</option>
                            <option>EBD</option>
                            <option>Jóvenes</option>
                            <option>Adolescentes</option>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Email (Login)" type="email" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} placeholder="usuario@gmail.com" />
                        <Input label="Teléfono" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} placeholder="+54 11..." />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input label="Edad" type="number" value={formData.age} onChange={e=>setFormData({...formData, age:e.target.value})} />
                        <Select label="Sexo" value={formData.gender} onChange={e=>setFormData({...formData, gender:e.target.value})}>
                            <option value="M">Masc</option>
                            <option value="F">Fem</option>
                        </Select>
                        <Input label="Localidad" value={formData.location} onChange={e=>setFormData({...formData, location:e.target.value})} />
                    </div>

                    <Input label="Dirección / Domicilio" value={formData.address} onChange={e=>setFormData({...formData, address:e.target.value})} placeholder="Calle y Altura" />

                    <div className="pt-4">
                        <Button className="w-full" onClick={handleSave}>Guardar Datos</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
