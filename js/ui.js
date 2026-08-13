/**
 * UI/View — iconos, estilos por prioridad, toasts y plantilla de tarjeta.
 * No toca localStorage ni la API: solo produce HTML y feedback visual.
 *
 * Paleta corporativa: coral #ED5543, amarillo #FBC80C, morado #2F0558,
 * fondo #020202 y superficies #0C0C0C. Los tokens viven en tailwind.config, en index.html.
 */

import { ETAPAS } from './storage.js';

export const ICONS = {
    plus: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>`,
    sparkles: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>`,
    trash: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`,
    pencil: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`,
    spinner: `<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`,
    message: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>`
};

/**
 * Mapeo semántico de la paleta:
 * - Alta   -> coral, el color de acción de la marca. Lead caliente, contactar ya.
 * - Media  -> amarillo, atención sin urgencia.
 * - Baja   -> morado corporativo, frío y desprioritizado.
 * - Sin calificar -> neutro, todavía no dice nada.
 * El morado #2F0558 es muy oscuro para texto sobre negro, así que se usa como relleno
 * y se acompaña del tono derivado grape-300 (#A17BC7) para texto y bordes.
 */
export const PRIORITY_STYLES = {
    'Sin calificar': {
        card: 'border-l-ink-faint',
        accent: 'text-ink-muted',
        badge: 'bg-raised text-ink-muted',
        dot: 'bg-ink-faint'
    },
    Baja: {
        card: 'border-l-grape-300',
        accent: 'text-grape-300',
        badge: 'bg-grape-500 text-ink',
        dot: 'bg-grape-300'
    },
    Media: {
        card: 'border-l-gold-500',
        accent: 'text-gold-500',
        badge: 'bg-gold-500 text-night',
        dot: 'bg-gold-500'
    },
    Alta: {
        card: 'border-l-coral-500',
        accent: 'text-coral-500',
        badge: 'bg-coral-500 text-night',
        dot: 'bg-coral-500'
    }
};

/**
 * Estilos por etapa del proceso. Deliberadamente más sobrios que los de prioridad:
 * la etapa es un dato administrativo, la prioridad es la señal que hay que mirar.
 */
export const STAGE_STYLES = {
    'Nuevo': { accent: 'text-ink-muted', dot: 'bg-ink-faint', badge: 'bg-raised text-ink-muted' },
    'Contactado': { accent: 'text-grape-300', dot: 'bg-grape-300', badge: 'bg-grape-900 text-grape-200' },
    'En conversación': { accent: 'text-gold-500', dot: 'bg-gold-500', badge: 'bg-gold-900 text-gold-300' },
    'Inscrito': { accent: 'text-coral-500', dot: 'bg-coral-500', badge: 'bg-coral-900 text-coral-200' },
    'Perdido': { accent: 'text-ink-faint', dot: 'bg-line', badge: 'bg-raised text-ink-faint' }
};

/** Identificador seguro para usar en el DOM a partir del nombre de una etapa. */
export function slug(texto) {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Definición de las dos vistas del tablero.
 * La de prioridad conserva los ids originales para no romper nada que dependa de ellos.
 */
export const VISTAS = {
    prioridad: [
        { key: 'unscored', titulo: 'Sin calificar', colId: 'col-unscored', countId: 'count-unscored', estilo: PRIORITY_STYLES['Sin calificar'], vacio: 'Sin prospectos por calificar.' },
        { key: 'Baja', titulo: 'Prioridad Baja', colId: 'col-low', countId: 'count-low', estilo: PRIORITY_STYLES.Baja, vacio: 'Nada aquí todavía.' },
        { key: 'Media', titulo: 'Prioridad Media', colId: 'col-medium', countId: 'count-medium', estilo: PRIORITY_STYLES.Media, vacio: 'Nada aquí todavía.' },
        { key: 'Alta', titulo: 'Prioridad Alta', colId: 'col-high', countId: 'count-high', estilo: PRIORITY_STYLES.Alta, vacio: 'Nada aquí todavía.' }
    ],
    etapa: ETAPAS.map((etapa) => ({
        key: etapa,
        titulo: etapa,
        colId: `col-etapa-${slug(etapa)}`,
        countId: `count-etapa-${slug(etapa)}`,
        estilo: STAGE_STYLES[etapa],
        vacio: 'Nadie en esta etapa.'
    }))
};

/**
 * Estructura de las columnas del tablero.
 * Se generan desde la configuración para que agregar una etapa no exija tocar el HTML,
 * y para que las columnas repartan el ancho disponible en vez de medir 320px fijos.
 */
export function renderColumns(columnas, { soltable = false } = {}) {
    return columnas.map((col) => `
        <div class="flex-1 basis-0 min-w-[13.5rem] flex flex-col bg-surface border border-line rounded-xl overflow-hidden">
            <div class="px-3.5 py-3 border-b border-line flex justify-between items-center gap-2">
                <span class="flex items-center gap-2 font-bold text-sm ${col.estilo.accent} truncate">
                    <span class="w-2 h-2 rounded-full ${col.estilo.dot} shrink-0"></span>
                    <span class="truncate">${escapeHTML(col.titulo)}</span>
                </span>
                <span id="${col.countId}" class="${col.estilo.badge} text-xs font-bold px-2 py-0.5 rounded-full tabular-nums shrink-0">0</span>
            </div>
            <div id="${col.colId}"
                 ${soltable ? `data-col-key="${escapeHTML(col.key)}"` : ''}
                 class="p-2.5 flex-1 overflow-y-auto flex flex-col gap-2.5 border-2 border-transparent rounded-b-xl transition-colors">
            </div>
        </div>
    `).join('');
}

/** Clases que marcan la columna sobre la que se va a soltar la tarjeta. */
export const DROP_ACTIVO = ['border-coral-500', 'bg-coral-900/20'];

/** Solo dígitos, para armar el enlace de WhatsApp desde un teléfono con formato libre. */
export function soloDigitos(telefono) {
    return String(telefono ?? '').replace(/\D/g, '');
}

/**
 * Bloque de datos que vienen del reporte de interacción y no se editan a mano.
 * Se muestra en el panel del lead para poder rescatarlos después.
 */
export function renderDatosReporte(lead) {
    const filas = [
        ['Origen del lead', lead.origen],
        ['Tipo de programa', lead.tipo],
        ['Descargas', Number.isFinite(lead.descargas) ? String(lead.descargas) : null],
        ['Primera interacción', lead.primeraInteraccion],
        ['Última interacción', lead.ultimaInteraccion]
    ].filter(([, valor]) => valor);

    if (!filas.length) return '';

    const acciones = [];
    if (lead.email) {
        acciones.push(`<a href="mailto:${encodeURIComponent(lead.email)}" class="text-grape-300 hover:text-ink underline underline-offset-2">Escribir correo</a>`);
    }
    if (soloDigitos(lead.telefono).length >= 8) {
        acciones.push(`<a href="https://wa.me/${soloDigitos(lead.telefono)}" target="_blank" rel="noopener noreferrer" class="text-grape-300 hover:text-ink underline underline-offset-2">Abrir WhatsApp</a>`);
    }

    return `
        <div class="bg-raised border border-line rounded-lg px-3 py-2.5">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2">Datos del reporte</p>
            <dl class="flex flex-col gap-1">
                ${filas.map(([etiqueta, valor]) => `
                    <div class="flex justify-between gap-3 text-[11px]">
                        <dt class="text-ink-faint shrink-0">${escapeHTML(etiqueta)}</dt>
                        <dd class="text-ink-muted text-right break-words">${escapeHTML(valor)}</dd>
                    </div>`).join('')}
            </dl>
            ${acciones.length ? `<div class="flex flex-wrap gap-3 mt-2.5 text-[11px]">${acciones.join('')}</div>` : ''}
        </div>
    `;
}

/** Escapa texto del usuario: sin esto, un "<" en las notas rompe el tablero. */
export function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Notificación flotante.
 * Coral = error, amarillo = advertencia, morado = confirmación, superficie = info.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const styles = {
        success: 'bg-grape-500 text-ink border border-grape-300',
        error: 'bg-coral-500 text-night border border-coral-300',
        warning: 'bg-gold-500 text-night border border-gold-300',
        info: 'bg-raised text-ink border border-line'
    };

    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl shadow-2xl shadow-black/60 text-sm font-semibold transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2 max-w-sm ${styles[type] || styles.info}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/* ------------------------------ Panel de métricas ------------------------------ */

function kpiCard(label, value, hint, accent = 'text-ink') {
    return `
        <div class="bg-raised border border-line rounded-xl px-4 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">${escapeHTML(label)}</p>
            <p class="text-2xl font-extrabold tabular-nums leading-tight mt-1 ${accent}">${escapeHTML(value)}</p>
            <p class="text-[11px] text-ink-faint mt-0.5">${escapeHTML(hint)}</p>
        </div>
    `;
}

/**
 * Panel de indicadores del embudo.
 * @param {object} metrics salida de computeMetrics
 * @param {Array<{prioridad:string, cantidad:number, porcentaje:number}>} segments
 */
export function renderMetrics(metrics, segments) {
    if (!metrics.total) {
        return `<div class="bg-surface border border-dashed border-line rounded-xl px-5 py-4 text-xs text-ink-faint text-center">
                    Registra tu primer prospecto y aquí verás el estado de tu cartera.
                </div>`;
    }

    const barra = segments.length
        ? `<div class="flex h-2.5 rounded-full overflow-hidden bg-raised">
               ${segments.map((s) => {
                   const styles = PRIORITY_STYLES[s.prioridad] || PRIORITY_STYLES['Sin calificar'];
                   return `<div class="${styles.dot}" style="width:${s.porcentaje}%" title="${escapeHTML(s.prioridad)}: ${s.cantidad}"></div>`;
               }).join('')}
           </div>
           <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
               ${segments.map((s) => {
                   const styles = PRIORITY_STYLES[s.prioridad] || PRIORITY_STYLES['Sin calificar'];
                   return `<span class="flex items-center gap-1.5 text-[11px] text-ink-muted">
                               <span class="w-2 h-2 rounded-full ${styles.dot}"></span>
                               ${escapeHTML(s.prioridad)} · <span class="tabular-nums font-semibold">${s.cantidad}</span>
                           </span>`;
               }).join('')}
           </div>`
        : `<p class="text-[11px] text-ink-faint">Todavía no hay leads calificados: analiza uno para ver la distribución.</p>`;

    const siguientes = metrics.siguientes.length
        ? metrics.siguientes.map((lead) => {
              const styles = PRIORITY_STYLES[lead.probabilidad] || PRIORITY_STYLES['Sin calificar'];
              return `<button type="button" data-action="focus-lead" data-id="${escapeHTML(lead.id)}"
                          class="flex items-center gap-2 bg-raised border border-line hover:border-coral-500 rounded-lg pl-2 pr-3 py-1.5 transition text-left">
                          <span class="w-1.5 h-1.5 rounded-full ${styles.dot}"></span>
                          <span class="text-xs font-semibold text-ink">${escapeHTML(lead.nombre)}</span>
                          <span class="text-[11px] ${styles.accent} tabular-nums font-bold">${lead.score}</span>
                      </button>`;
          }).join('')
        : `<span class="text-[11px] text-ink-faint">Nadie en espera: todos los leads calificados ya tienen mensaje.</span>`;

    // Embudo por etapa: barras horizontales proporcionales al total de la cartera.
    const mayorEtapa = Math.max(1, ...ETAPAS.map((etapa) => metrics.porEtapa[etapa] || 0));
    const embudo = ETAPAS.map((etapa) => {
        const cantidad = metrics.porEtapa[etapa] || 0;
        const estilo = STAGE_STYLES[etapa];
        return `
            <div class="flex items-center gap-3">
                <span class="w-32 shrink-0 text-xs ${estilo.accent} truncate">${escapeHTML(etapa)}</span>
                <div class="flex-1 h-2 bg-raised rounded-full overflow-hidden">
                    <div class="h-full ${estilo.dot} rounded-full" style="width:${Math.round((cantidad / mayorEtapa) * 100)}%"></div>
                </div>
                <span class="w-6 text-right text-xs font-bold tabular-nums text-ink-muted">${cantidad}</span>
            </div>`;
    }).join('');

    return `
        <div class="flex flex-col gap-5">
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
                ${kpiCard('Prospectos', String(metrics.total), [
                    `${metrics.sinCalificar} sin calificar`,
                    metrics.desdeConversacion ? `${metrics.desdeConversacion} desde chat` : null,
                    metrics.importados ? `${metrics.importados} importados` : null
                ].filter(Boolean).join(' · '))}
                ${kpiCard('Cobertura IA', `${metrics.cobertura}%`, `${metrics.calificados} calificados`, 'text-grape-300')}
                ${kpiCard('Score promedio', metrics.scorePromedio === null ? '--' : String(metrics.scorePromedio), 'sobre 100', 'text-gold-500')}
                ${kpiCard('Por contactar', String(metrics.pendientesContacto), `${metrics.contactados} con mensaje listo`, 'text-coral-500')}
                ${kpiCard('Inscritos', String(metrics.inscritos), `${metrics.conversion}% de conversión`, 'text-coral-500')}
            </div>

            <div class="grid lg:grid-cols-2 gap-4">
                <div class="bg-surface border border-line rounded-xl p-5">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-3">Embudo por etapa</p>
                    <div class="flex flex-col gap-2.5">${embudo}</div>
                </div>

                <div class="bg-surface border border-line rounded-xl p-5 flex flex-col gap-4">
                    <div>
                        <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2">Distribución por prioridad</p>
                        ${barra}
                    </div>
                    <div>
                        <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2">Contactar ahora</p>
                        <div class="flex flex-wrap gap-2">${siguientes}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/** Botones tipo segmented control para el canal y el tono del mensaje. */
export function renderSegmented(options, selected, group) {
    return options.map((option) => {
        const activo = option === selected;
        const clases = activo
            ? 'bg-coral-500 text-night border-coral-500'
            : 'bg-raised text-ink-muted border-line hover:text-ink hover:border-ink-faint';
        return `<button type="button" data-group="${escapeHTML(group)}" data-value="${escapeHTML(option)}"
                    aria-pressed="${activo}"
                    class="flex-1 text-xs font-semibold px-2.5 py-2 rounded-lg border transition ${clases}">
                    ${escapeHTML(option)}
                </button>`;
    }).join('');
}

export function renderEmptyState(text) {
    return `<p class="text-xs text-ink-faint text-center py-8 px-4 border border-dashed border-line rounded-lg">${escapeHTML(text)}</p>`;
}

/**
 * HTML de una tarjeta de lead.
 * @param {object} lead
 * @param {{arrastrable?: boolean}} opciones arrastrable solo en la vista por etapa:
 *        la prioridad la calcula la IA, así que no es algo que se mueva a mano.
 */
export function createCardHTML(lead, { arrastrable = false } = {}) {
    const calificado = lead.estado === 'calificado' && lead.probabilidad;
    const category = calificado ? lead.probabilidad : 'Sin calificar';
    const styles = PRIORITY_STYLES[category] || PRIORITY_STYLES['Sin calificar'];
    const needsAnalysis = lead.estado === 'no_calificado' || lead.notasModificadas;

    const scoreBlock = calificado
        ? `<div class="flex items-center gap-2 mb-2.5">
               <span class="inline-flex items-baseline gap-1 ${styles.badge} text-xs px-2.5 py-1 rounded-md font-extrabold tabular-nums">
                   ${lead.score}<span class="font-semibold opacity-70">/100</span>
               </span>
               <span class="text-[11px] font-bold uppercase tracking-wider ${styles.accent}">${escapeHTML(lead.probabilidad)}</span>
           </div>
           <p class="text-ink-muted italic bg-raised px-3 py-2 rounded-lg border border-line text-xs leading-relaxed mb-3">"${escapeHTML(lead.argumento)}"</p>`
        : `<p class="text-sm text-ink-muted line-clamp-3 mb-3 leading-relaxed">${escapeHTML(lead.notas)}</p>
           <span class="inline-block ${styles.badge} text-xs px-2.5 py-1 rounded-md font-bold mb-3">Sin score</span>`;

    const warningBlock = lead.notasModificadas
        ? `<span class="flex items-center gap-1.5 text-[11px] text-gold-500 font-semibold mb-2.5">
               <span class="w-1.5 h-1.5 rounded-full bg-gold-500"></span> Notas modificadas desde el último análisis
           </span>`
        : '';

    const analyzeBlock = needsAnalysis
        ? `<button type="button" data-action="analyze" class="w-full bg-raised border border-line text-ink text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-coral-500 hover:text-night hover:border-coral-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-raised disabled:hover:text-ink transition">
               ${ICONS.sparkles}<span>${lead.notasModificadas ? 'Re-analizar' : 'Analizar con IA'}</span>
           </button>`
        : '';

    // Datos que trae el reporte de interacción. Solo se muestran si existen.
    const senales = [];
    if (lead.origen) senales.push(lead.origen);
    if (Number.isFinite(lead.descargas) && lead.descargas > 0) senales.push(`${lead.descargas} descarga${lead.descargas === 1 ? '' : 's'}`);
    if (lead.ultimaInteraccion) senales.push(`últ. ${lead.ultimaInteraccion}`);

    // El contacto se muestra como enlaces: un clic escribe el correo o abre WhatsApp.
    const enlaces = [];
    if (lead.email) {
        enlaces.push(`<a href="mailto:${encodeURIComponent(lead.email)}" title="${escapeHTML(lead.email)}" class="text-[11px] text-ink-muted hover:text-gold-500 underline underline-offset-2 truncate">${escapeHTML(lead.email)}</a>`);
    }
    if (lead.telefono) {
        const digitos = soloDigitos(lead.telefono);
        enlaces.push(digitos.length >= 8
            ? `<a href="https://wa.me/${digitos}" target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp" class="text-[11px] text-ink-muted hover:text-gold-500 underline underline-offset-2">${escapeHTML(lead.telefono)}</a>`
            : `<span class="text-[11px] text-ink-muted">${escapeHTML(lead.telefono)}</span>`);
    }

    const datosBlock = enlaces.length || senales.length
        ? `<div class="mb-2.5 flex flex-col gap-1">
               ${enlaces.length ? `<div class="flex flex-col gap-0.5 min-w-0">${enlaces.join('')}</div>` : ''}
               ${senales.length ? `<div class="flex flex-wrap gap-1">${senales.map((s) => `<span class="text-[10px] bg-raised border border-line text-ink-faint px-1.5 py-0.5 rounded">${escapeHTML(s)}</span>`).join('')}</div>` : ''}
           </div>`
        : '';

    // Primer contacto: solo tiene sentido ofrecerlo cuando el lead ya está priorizado.
    const outreachBlock = calificado && !lead.notasModificadas
        ? `<button type="button" data-action="outreach" class="w-full mt-2 ${lead.mensaje
                ? 'bg-grape-900 border border-grape-400 text-grape-200 hover:bg-grape-500 hover:text-ink'
                : 'bg-raised border border-line text-ink hover:bg-gold-500 hover:text-night hover:border-gold-500'
           } text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition">
               ${ICONS.message}<span>${lead.mensaje ? 'Ver mensaje' : 'Redactar contacto'}</span>
           </button>`
        : '';

    // La etapa es editable desde la propia tarjeta: mover un lead no debería costar más de un clic.
    const etapaActual = ETAPAS.includes(lead.etapa) ? lead.etapa : 'Nuevo';
    const estiloEtapa = STAGE_STYLES[etapaActual];
    const etapaBlock = `
        <label class="flex items-center gap-1.5 mt-2.5 cursor-pointer">
            <span class="sr-only">Etapa de ${escapeHTML(lead.nombre)}</span>
            <span class="w-1.5 h-1.5 rounded-full ${estiloEtapa.dot} shrink-0"></span>
            <select data-action="etapa" class="bg-transparent text-[11px] font-semibold ${estiloEtapa.accent} border-0 p-0 pr-4 focus:outline-none focus:ring-0 cursor-pointer hover:underline underline-offset-2">
                ${ETAPAS.map((etapa) => `<option value="${escapeHTML(etapa)}" class="bg-surface text-ink"${etapa === etapaActual ? ' selected' : ''}>${escapeHTML(etapa)}</option>`).join('')}
            </select>
        </label>`;

    const metaBlock = calificado && lead.vecesAnalizado > 1
        ? `<p class="text-[11px] text-ink-faint mt-1.5">Analizado ${lead.vecesAnalizado} veces</p>`
        : '';

    return `
        <article ${arrastrable ? 'draggable="true"' : ''}
                 class="bg-surface hover:bg-raised rounded-xl p-4 border border-line border-l-[3px] ${styles.card} group transition-colors duration-200 ${arrastrable ? 'cursor-grab active:cursor-grabbing' : ''}"
                 data-id="${escapeHTML(lead.id)}">
            <div class="flex justify-between items-start mb-1.5 gap-2">
                <h3 class="font-bold text-ink break-words leading-tight">${escapeHTML(lead.nombre)}</h3>
                <div class="card-actions flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity gap-0.5 shrink-0">
                    <button type="button" data-action="edit" class="text-ink-faint hover:text-gold-500 p-1 rounded transition" title="Editar" aria-label="Editar">${ICONS.pencil}</button>
                    <button type="button" data-action="delete" class="text-ink-faint hover:text-coral-500 p-1 rounded transition" title="Borrar" aria-label="Borrar">${ICONS.trash}</button>
                </div>
            </div>
            <p class="text-[11px] text-ink-faint mb-2.5 font-semibold uppercase tracking-wide">${escapeHTML(lead.curso)}</p>
            ${datosBlock}
            ${scoreBlock}
            ${warningBlock}
            ${analyzeBlock}
            ${outreachBlock}
            ${etapaBlock}
            ${metaBlock}
        </article>
    `;
}
