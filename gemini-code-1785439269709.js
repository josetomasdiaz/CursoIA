import { getLeads, saveLead, updateLead, deleteLead } from './storage.js';
import { createCardHTML } from './ui.js';

// Referencias del DOM
const form = document.getElementById('lead-form');
const inputId = document.getElementById('lead-id');
const inputName = document.getElementById('lead-name');
const inputCourse = document.getElementById('lead-course');
const inputNotes = document.getElementById('lead-notes');

// Contenedores de columnas
const columns = {
    'unscored': document.getElementById('col-unscored'),
    'Baja': document.getElementById('col-low'),
    'Media': document.getElementById('col-medium'),
    'Alta': document.getElementById('col-high')
};

// Renderizado inicial
function renderBoard() {
    // Limpiar columnas
    Object.values(columns).forEach(col => col.innerHTML = '');
    
    const leads = getLeads();
    
    leads.forEach(lead => {
        const cardHTML = createCardHTML(lead);
        
        if (lead.estado === 'no_calificado') {
            columns['unscored'].insertAdjacentHTML('beforeend', cardHTML);
        } else {
            // Cae en Alta, Media o Baja
            columns[lead.probabilidad]?.insertAdjacentHTML('beforeend', cardHTML);
        }
    });

    attachCardEvents();
}

// Eventos internos de las tarjetas
function attachCardEvents() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.group');
            const id = card.dataset.id;
            
            if (window.confirm('¿Estás seguro de eliminar este prospecto? No podrás recuperarlo.')) {
                deleteLead(id);
                renderBoard();
            }
        });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.group');
            const id = card.dataset.id;
            const lead = getLeads().find(l => l.id === id);
            
            if (lead) {
                inputId.value = lead.id;
                inputName.value = lead.nombre;
                inputCourse.value = lead.curso;
                inputNotes.value = lead.notas;
            }
        });
    });

    // EVENTO FASE 3: Aquí se conectará Gemini
    document.querySelectorAll('.btn-analyze').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const card = e.target.closest('.group');
            const id = card.dataset.id;
            
            // TODO: Integración con Gemini.js (Dev B)
            console.log(`Listo para enviar a Gemini el lead: ${id}`);
            // 1. Mostrar Spinner
            // 2. await gemini.analyzeLead(notas)
            // 3. updateLead(id, { estado: 'calificado', score: X, probabilidad: Y, ... })
            // 4. renderBoard()
        });
    });
}

// Manejo del formulario (Crear / Editar)
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = inputId.value;
    const data = {
        nombre: inputName.value,
        curso: inputCourse.value,
        notas: inputNotes.value
    };

    if (id) {
        updateLead(id, data);
    } else {
        saveLead(data);
    }

    form.reset();
    inputId.value = '';
    renderBoard();
});

// Inicializar la app reemplazando los mocks con datos reales (si los hay)
document.addEventListener('DOMContentLoaded', () => {
    renderBoard();
});