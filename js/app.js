/**
 * Main App — orquestador. Conecta los eventos de la UI con Storage, métricas y el servicio de Gemini.
 */

import {
    getLeads, getLeadById, saveLead, updateLead, deleteLead,
    seedDemoLeads, isStorageAvailable, StorageError
} from './storage.js';
import { computeMetrics, distributionSegments } from './metrics.js';
import { createCardHTML, renderEmptyState, renderMetrics, renderSegmented, showToast, ICONS } from './ui.js';
import {
    analyzeLeadWithGemini, draftOutreachWithGemini, extractLeadFromConversation,
    getStoredApiKey, setStoredApiKey, CANALES, TONOS
} from './gemini.js';

/* ------------------------------ DOM ------------------------------ */

const form = document.getElementById('lead-form');
const inputId = document.getElementById('lead-id');
const inputName = document.getElementById('lead-name');
const inputCourse = document.getElementById('lead-course');
const inputNotes = document.getElementById('lead-notes');
const formTitle = document.getElementById('form-title');
const submitLabel = document.getElementById('submit-label');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const seedBtn = document.getElementById('seed-btn');
const autoScore = document.getElementById('auto-score');

const pasteInput = document.getElementById('paste-input');
const pasteBtn = document.getElementById('paste-btn');
const pasteBtnLabel = document.getElementById('paste-btn-label');
const pasteStatus = document.getElementById('paste-status');

const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const apiKeyStatus = document.getElementById('api-key-status');

const board = document.getElementById('board');
const metricsPanel = document.getElementById('metrics');

const modal = document.getElementById('outreach-modal');
const modalLead = document.getElementById('outreach-lead');
const modalCanal = document.getElementById('outreach-canal');
const modalTono = document.getElementById('outreach-tono');
const modalGenerate = document.getElementById('outreach-generate');
const modalGenerateLabel = document.getElementById('outreach-generate-label');
const modalOutput = document.getElementById('outreach-output');
const modalSubjectRow = document.getElementById('outreach-subject-row');
const modalSubject = document.getElementById('outreach-subject');
const modalMessage = document.getElementById('outreach-message');
const modalHook = document.getElementById('outreach-hook');
const modalCopy = document.getElementById('outreach-copy');
const modalSave = document.getElementById('outreach-save');
const modalClose = document.getElementById('outreach-close');
const modalStatus = document.getElementById('outreach-status');

const columns = {
    unscored: document.getElementById('col-unscored'),
    Baja: document.getElementById('col-low'),
    Media: document.getElementById('col-medium'),
    Alta: document.getElementById('col-high')
};

const counters = {
    unscored: document.getElementById('count-unscored'),
    Baja: document.getElementById('count-low'),
    Media: document.getElementById('count-medium'),
    Alta: document.getElementById('count-high')
};

const EMPTY_TEXTS = {
    unscored: 'Sin prospectos por calificar.',
    Baja: 'Nada aquí todavía.',
    Media: 'Nada aquí todavía.',
    Alta: 'Nada aquí todavía.'
};

const ERROR_MESSAGES = {
    API_KEY_MISSING: 'Ingresa tu API Key de Gemini arriba a la derecha.',
    API_KEY_INVALID: 'API Key inválida, expirada o sin permisos. Genera otra en Google AI Studio.',
    NOTES_TOO_SHORT: 'Las notas deben tener al menos 10 caracteres para poder analizar.',
    CONVERSATION_TOO_SHORT: 'Pega una conversación más larga: con menos de 40 caracteres no hay nada que extraer.',
    RATE_LIMIT_EXCEEDED: 'Cuota superada (429). Se reintentó varias veces; espera un minuto y vuelve a intentar.',
    MODEL_NOT_FOUND: 'El modelo de Gemini no está disponible para esta API Key.',
    JSON_PARSE_ERROR: 'La IA devolvió una respuesta que no es JSON válido. Intenta de nuevo.',
    INVALID_SCHEMA: 'La IA respondió con un formato inesperado. Intenta de nuevo.',
    EMPTY_RESPONSE: 'La IA no devolvió contenido. Intenta de nuevo.',
    RESPONSE_TRUNCATED: 'La respuesta se cortó por longitud. Acorta las notas.',
    CONTENT_BLOCKED: 'El contenido fue bloqueado por los filtros de seguridad de Gemini.',
    BAD_REQUEST: 'La petición a Gemini fue rechazada. Revisa la consola para el detalle.',
    SERVER_ERROR: 'Los modelos de Gemini están sobrecargados (503). Ya se reintentó con backoff y con modelos alternativos: espera un minuto y vuelve a intentar.',
    TIMEOUT: 'La petición tardó demasiado (30s) y se canceló.',
    NETWORK_ERROR: 'Sin conexión con la API de Gemini. Revisa tu internet.',
    STORAGE_FULL: 'El almacenamiento del navegador está lleno. Borra algunos leads.',
    STORAGE_UNAVAILABLE: 'Este navegador tiene el almacenamiento bloqueado. Desactiva el modo restringido.'
};

/** IDs de leads que están siendo analizados ahora mismo. */
const analyzing = new Set();

/** Estado del asistente de primer contacto. */
const composer = { leadId: null, canal: 'WhatsApp', tono: 'Cercano', generando: false };

/** Procedencia de la ficha que está cargada en el formulario, si vino de una conversación. */
let extraccion = null;

/* ------------------------------ Errores ------------------------------ */

function reportError(error, fallback = 'Ocurrió un error inesperado.') {
    console.error(error);
    showToast(ERROR_MESSAGES[error?.code] || ERROR_MESSAGES[error?.message] || fallback, 'error');
}

/* ------------------------------ API Key ------------------------------ */

function refreshApiKeyStatus() {
    const hasKey = Boolean(getStoredApiKey());
    apiKeyStatus.textContent = hasKey ? 'Clave activa' : 'Sin clave';
    apiKeyStatus.className = `text-xs whitespace-nowrap ${hasKey ? 'text-gold-500 font-semibold' : 'text-ink-faint'}`;
}

function persistApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        showToast('Ingresa una API Key válida.', 'warning');
        return;
    }
    if (!setStoredApiKey(key)) {
        showToast('No se pudo guardar la clave: el navegador bloquea sessionStorage.', 'error');
        return;
    }
    refreshApiKeyStatus();
    showToast('API Key guardada solo para esta sesión del navegador.', 'success');
}

saveKeyBtn.addEventListener('click', persistApiKey);
apiKeyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        persistApiKey();
    }
});

function resolveApiKey() {
    return getStoredApiKey() || apiKeyInput.value.trim();
}

/* ------------------------------ Render ------------------------------ */

function renderBoard() {
    const leads = getLeads();
    const buckets = { unscored: [], Baja: [], Media: [], Alta: [] };

    for (const lead of leads) {
        if (lead.estado === 'calificado' && buckets[lead.probabilidad]) {
            buckets[lead.probabilidad].push(lead);
        } else {
            buckets.unscored.push(lead);
        }
    }

    for (const [key, column] of Object.entries(columns)) {
        const grupo = buckets[key];
        column.innerHTML = grupo.length
            ? grupo.map(createCardHTML).join('')
            : renderEmptyState(EMPTY_TEXTS[key]);
        counters[key].textContent = String(grupo.length);
    }

    const metrics = computeMetrics(leads);
    metricsPanel.innerHTML = renderMetrics(metrics, distributionSegments(metrics));

    // Repinta el spinner de los leads que quedaron analizándose durante el re-render.
    for (const id of analyzing) {
        setCardLoading(id, true);
    }
}

function analyzeButtonFor(id) {
    const card = board.querySelector(`[data-id="${CSS.escape(id)}"]`);
    return card?.querySelector('[data-action="analyze"]') ?? null;
}

function setCardLoading(id, isLoading, label = 'Analizando...') {
    const button = analyzeButtonFor(id);
    if (!button) return;

    button.disabled = isLoading;
    if (isLoading) {
        button.innerHTML = `${ICONS.spinner}<span>${label}</span>`;
    }
}

/** Feedback mientras el servicio reintenta por sobrecarga (503) o cuota (429). */
function setCardRetrying(id, { attempt, switchingTo }) {
    const label = switchingTo
        ? 'Probando modelo alternativo...'
        : `Sobrecargado, reintentando (${attempt + 1})...`;
    setCardLoading(id, true, label);
}

/* ------------------------------ Formulario ------------------------------ */

function enterEditMode(lead) {
    inputId.value = lead.id;
    inputName.value = lead.nombre;
    inputCourse.value = lead.curso;
    inputNotes.value = lead.notas;
    formTitle.textContent = `Editando: ${lead.nombre}`;
    submitLabel.textContent = 'Guardar cambios';
    cancelEditBtn.classList.remove('hidden');
    inputName.focus();
}

function exitEditMode() {
    form.reset();
    inputId.value = '';
    formTitle.textContent = 'Nuevo Prospecto';
    submitLabel.textContent = 'Guardar Lead';
    cancelEditBtn.classList.add('hidden');
    autoScore.checked = true;
    extraccion = null;
}

cancelEditBtn.addEventListener('click', () => {
    exitEditMode();
    pasteStatus.textContent = '';
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = {
        nombre: inputName.value.trim(),
        curso: inputCourse.value.trim(),
        notas: inputNotes.value.trim()
    };

    if (!data.nombre || !data.curso || !data.notas) {
        showToast('Completa nombre, curso y notas.', 'warning');
        return;
    }

    const editando = Boolean(inputId.value);
    const calificarAhora = autoScore.checked;
    const procedencia = extraccion;
    let nuevoId = null;

    try {
        if (editando) {
            updateLead(inputId.value, data);
            showToast('Prospecto actualizado.', 'success');
        } else {
            const creado = saveLead({
                ...data,
                origen: procedencia ? 'conversacion' : 'manual',
                canalOrigen: procedencia?.canal ?? null
            });
            nuevoId = creado.id;
            showToast('Prospecto registrado.', 'success');
        }

        exitEditMode();
        if (procedencia) {
            pasteInput.value = '';
            pasteStatus.textContent = '';
        }
        renderBoard();
    } catch (error) {
        reportError(error, 'No se pudo guardar el prospecto.');
        return;
    }

    // Se califica después de guardar, para que la tarjeta ya exista y muestre el spinner.
    if (nuevoId && calificarAhora) {
        await analyzeLead(nuevoId);
    }
});

/* ------------------------------ Captura desde conversación ------------------------------ */

const ETIQUETAS_FALTANTES = {
    nombre: 'el nombre',
    curso: 'el curso',
    senales: 'las señales comerciales'
};

pasteBtn.addEventListener('click', async () => {
    const apiKey = resolveApiKey();
    if (!apiKey) {
        showToast(ERROR_MESSAGES.API_KEY_MISSING, 'error');
        apiKeyInput.focus();
        return;
    }

    pasteBtn.disabled = true;
    pasteBtnLabel.textContent = 'Extrayendo...';
    pasteStatus.className = 'text-[11px] text-ink-faint mt-2 leading-relaxed';
    pasteStatus.textContent = 'Gemini está leyendo la conversación.';

    try {
        const ficha = await extractLeadFromConversation(pasteInput.value, apiKey, {
            onProgress: ({ switchingTo }) => {
                pasteStatus.textContent = switchingTo
                    ? 'Modelo sobrecargado, probando uno alternativo...'
                    : 'Modelo sobrecargado, reintentando...';
            }
        });

        inputName.value = ficha.nombre;
        inputCourse.value = ficha.curso;
        inputNotes.value = ficha.notas;
        extraccion = { canal: ficha.canal, confianza: ficha.confianza };

        const pendientes = ficha.faltantes.map((campo) => ETIQUETAS_FALTANTES[campo] || campo);
        const hayDudas = pendientes.length > 0 || ficha.confianza === 'Baja';

        pasteStatus.className = `text-[11px] mt-2 leading-relaxed ${hayDudas ? 'text-gold-500' : 'text-grape-300'}`;
        pasteStatus.textContent = pendientes.length
            ? `Ficha lista (confianza ${ficha.confianza}). No pude determinar ${pendientes.join(' ni ')}: complétalo antes de guardar.`
            : `Ficha lista (confianza ${ficha.confianza}). Revísala y guarda.`;

        // El foco va al primer campo que quedó vacío, que es el que hay que completar a mano.
        const vacio = [inputName, inputCourse, inputNotes].find((campo) => !campo.value.trim());
        (vacio || inputName).focus();

        showToast(`Ficha extraída desde ${ficha.canal}.`, 'success');
    } catch (error) {
        reportError(error, 'No se pudo leer la conversación.');
        pasteStatus.className = 'text-[11px] text-coral-500 mt-2 leading-relaxed';
        pasteStatus.textContent = 'No se pudo extraer. Revisa el aviso y vuelve a intentar.';
    } finally {
        pasteBtn.disabled = false;
        pasteBtnLabel.textContent = 'Extraer con IA';
    }
});

seedBtn.addEventListener('click', () => {
    try {
        seedDemoLeads();
        renderBoard();
        showToast('Se cargaron 3 leads de ejemplo.', 'success');
    } catch (error) {
        reportError(error, 'No se pudieron cargar los ejemplos.');
    }
});

/* ------------------------------ Asistente de primer contacto ------------------------------ */

function renderComposerControls() {
    modalCanal.innerHTML = renderSegmented(CANALES, composer.canal, 'canal');
    modalTono.innerHTML = renderSegmented(TONOS, composer.tono, 'tono');
}

function showDraft(draft) {
    modalOutput.classList.remove('hidden');
    modalOutput.classList.add('flex');
    modalSubject.value = draft.asunto || '';
    modalMessage.value = draft.mensaje || '';
    modalHook.textContent = draft.gancho ? `Gancho usado: ${draft.gancho}` : '';
    modalHook.classList.toggle('hidden', !draft.gancho);
    modalSubjectRow.classList.toggle('hidden', draft.canal !== 'Email');
    modalGenerateLabel.textContent = 'Volver a redactar';
}

function hideDraft() {
    modalOutput.classList.add('hidden');
    modalOutput.classList.remove('flex');
    modalGenerateLabel.textContent = 'Redactar con IA';
}

function openComposer(lead) {
    composer.leadId = lead.id;
    // Si el lead se capturó desde una conversación, se responde por el mismo canal.
    composer.canal = lead.mensajeCanal
        || (CANALES.includes(lead.canalOrigen) ? lead.canalOrigen : 'WhatsApp');
    composer.tono = lead.mensajeTono || 'Cercano';

    modalLead.textContent = `${lead.nombre} · ${lead.curso} · prioridad ${lead.probabilidad} (${lead.score}/100)`;
    modalStatus.textContent = '';
    renderComposerControls();

    if (lead.mensaje) {
        showDraft({
            asunto: lead.mensajeAsunto,
            mensaje: lead.mensaje,
            gancho: lead.mensajeGancho,
            canal: lead.mensajeCanal
        });
    } else {
        hideDraft();
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modalGenerate.focus();
}

function closeComposer() {
    composer.leadId = null;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

modalClose.addEventListener('click', closeComposer);

modal.addEventListener('click', (event) => {
    if (event.target === modal) closeComposer();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeComposer();
});

for (const group of [modalCanal, modalTono]) {
    group.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-value]');
        if (!button) return;
        composer[button.dataset.group] = button.dataset.value;
        renderComposerControls();
        // El asunto solo aplica a email.
        if (!modalOutput.classList.contains('hidden')) {
            modalSubjectRow.classList.toggle('hidden', composer.canal !== 'Email');
        }
    });
}

modalGenerate.addEventListener('click', async () => {
    const lead = getLeadById(composer.leadId);
    if (!lead) {
        closeComposer();
        return;
    }

    const apiKey = resolveApiKey();
    if (!apiKey) {
        showToast(ERROR_MESSAGES.API_KEY_MISSING, 'error');
        return;
    }

    composer.generando = true;
    modalGenerate.disabled = true;
    modalGenerateLabel.textContent = 'Redactando...';
    modalStatus.textContent = 'Gemini está escribiendo el mensaje.';

    try {
        const draft = await draftOutreachWithGemini(
            lead,
            { canal: composer.canal, tono: composer.tono },
            apiKey,
            {
                onProgress: ({ switchingTo }) => {
                    modalStatus.textContent = switchingTo
                        ? 'Modelo sobrecargado, probando uno alternativo...'
                        : 'Modelo sobrecargado, reintentando...';
                }
            }
        );

        updateLead(lead.id, {
            mensaje: draft.mensaje,
            mensajeAsunto: draft.asunto,
            mensajeCanal: draft.canal,
            mensajeTono: draft.tono,
            mensajeGancho: draft.gancho,
            mensajeEn: new Date().toISOString()
        });

        showDraft(draft);
        modalStatus.textContent = `Redactado con ${draft.modelo}.`;
        renderBoard();
    } catch (error) {
        reportError(error, 'No se pudo redactar el mensaje.');
        modalStatus.textContent = 'No se pudo redactar. Revisa el aviso y vuelve a intentar.';
        modalGenerateLabel.textContent = 'Redactar con IA';
    } finally {
        composer.generando = false;
        modalGenerate.disabled = false;
    }
});

/** Guarda las ediciones manuales que el vendedor haya hecho sobre el borrador. */
function persistComposerEdits() {
    if (!composer.leadId) return;
    updateLead(composer.leadId, {
        mensaje: modalMessage.value.trim(),
        mensajeAsunto: modalSubject.value.trim(),
        mensajeCanal: composer.canal,
        mensajeTono: composer.tono
    });
}

modalSave.addEventListener('click', () => {
    try {
        persistComposerEdits();
        renderBoard();
        showToast('Mensaje guardado en el lead.', 'success');
    } catch (error) {
        reportError(error, 'No se pudo guardar el mensaje.');
    }
    closeComposer();
});

modalCopy.addEventListener('click', async () => {
    const texto = composer.canal === 'Email' && modalSubject.value.trim()
        ? `${modalSubject.value.trim()}\n\n${modalMessage.value}`
        : modalMessage.value;

    try {
        await navigator.clipboard.writeText(texto);
        showToast('Mensaje copiado al portapapeles.', 'success');
    } catch (error) {
        // Sin permisos de portapapeles: al menos dejamos el texto seleccionado.
        modalMessage.select();
        showToast('No se pudo copiar solo: el texto quedó seleccionado.', 'warning');
    }

    try {
        persistComposerEdits();
        renderBoard();
    } catch (error) {
        reportError(error, 'No se pudo guardar el mensaje.');
    }
});

/* ------------------------------ Calificación ------------------------------ */

/**
 * Califica un lead con Gemini y persiste el resultado.
 * Lo usan tanto el botón de la tarjeta como el guardado automático tras extraer una conversación.
 * @returns {Promise<boolean>} si quedó calificado
 */
async function analyzeLead(id) {
    const lead = getLeadById(id);
    if (!lead || analyzing.has(id)) return false;

    const apiKey = resolveApiKey();
    if (!apiKey) {
        showToast(ERROR_MESSAGES.API_KEY_MISSING, 'error');
        apiKeyInput.focus();
        return false;
    }

    analyzing.add(id);
    setCardLoading(id, true);

    try {
        const result = await analyzeLeadWithGemini(lead.curso, lead.notas, apiKey, {
            onProgress: (info) => setCardRetrying(id, info)
        });

        updateLead(id, {
            score: result.score,
            probabilidad: result.probabilidad,
            argumento: result.argumento,
            estado: 'calificado',
            notasModificadas: false,
            vecesAnalizado: (lead.vecesAnalizado || 0) + 1,
            analizadoEn: new Date().toISOString()
        });

        showToast(`${lead.nombre}: prioridad ${result.probabilidad} (${result.score}/100)`, 'success');
        return true;
    } catch (error) {
        reportError(error, 'No se pudo completar el análisis.');
        return false;
    } finally {
        analyzing.delete(id);
        renderBoard();
    }
}

/* ------------------------------ Acciones de las tarjetas ------------------------------ */
/* Delegación de eventos: un solo listener para todo el tablero, sobrevive a los re-renders. */

board.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !board.contains(button)) return;

    const card = button.closest('[data-id]');
    if (!card) return;

    const id = card.dataset.id;
    const action = button.dataset.action;
    const lead = getLeadById(id);

    if (!lead) {
        showToast('Ese prospecto ya no existe.', 'warning');
        renderBoard();
        return;
    }

    if (action === 'delete') {
        if (!window.confirm(`¿Eliminar a ${lead.nombre}? Esta acción no se puede deshacer.`)) return;
        try {
            deleteLead(id);
            if (inputId.value === id) exitEditMode();
            if (composer.leadId === id) closeComposer();
            renderBoard();
            showToast('Prospecto eliminado.', 'info');
        } catch (error) {
            reportError(error, 'No se pudo eliminar el prospecto.');
        }
        return;
    }

    if (action === 'edit') {
        enterEditMode(lead);
        return;
    }

    if (action === 'outreach') {
        openComposer(lead);
        return;
    }

    if (action === 'analyze') {
        await analyzeLead(id);
    }
});

/* Atajo del panel: "Contactar ahora" abre el asistente del lead elegido. */
metricsPanel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="focus-lead"]');
    if (!button) return;

    const lead = getLeadById(button.dataset.id);
    if (!lead) {
        renderBoard();
        return;
    }
    openComposer(lead);
});

/* ------------------------------ Arranque ------------------------------ */

function init() {
    if (!isStorageAvailable()) {
        showToast(ERROR_MESSAGES.STORAGE_UNAVAILABLE, 'error');
    }

    const storedKey = getStoredApiKey();
    if (storedKey) apiKeyInput.value = storedKey;
    refreshApiKeyStatus();
    renderComposerControls();

    try {
        renderBoard();
    } catch (error) {
        reportError(error, 'No se pudo cargar el tablero.');
    }
}

// Los módulos ES6 son diferidos: el DOM ya está listo cuando esto corre.
init();

export { renderBoard, ERROR_MESSAGES, StorageError };
