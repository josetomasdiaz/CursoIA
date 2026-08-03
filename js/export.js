/**
 * Exportación del embudo a Excel.
 *
 * La construcción de los datos es pura y está separada de la escritura del archivo,
 * para poder probarla sin navegador. Si SheetJS no cargó (CDN caído, sin conexión),
 * se cae con gracia a un CSV con separador punto y coma, que es lo que espera
 * el Excel en español.
 */

import { ETAPAS } from './storage.js';

const CABECERA_PROSPECTOS = [
    'Nombre', 'Curso de interés', 'Etapa', 'Prioridad', 'Score',
    'Argumento de la IA', 'Notas', 'Origen', 'Canal de origen',
    'Mensaje redactado', 'Canal del mensaje', 'Veces analizado',
    'Creado', 'Calificado', 'Último cambio de etapa'
];

/** Fecha legible para Excel. Devuelve cadena vacía si no hay dato. */
function fecha(valor) {
    if (!valor) return '';
    const d = typeof valor === 'number' ? new Date(valor) : new Date(String(valor));
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()} ${hh}:${mi}`;
}

/** Una fila por prospecto, en el orden de CABECERA_PROSPECTOS. */
export function filasProspectos(leads) {
    return [...leads]
        .sort((a, b) => (b.score || 0) - (a.score || 0) || a.createdAt - b.createdAt)
        .map((lead) => [
            lead.nombre || '',
            lead.curso || '',
            lead.etapa || 'Nuevo',
            lead.estado === 'calificado' ? (lead.probabilidad || '') : 'Sin calificar',
            Number.isFinite(lead.score) ? lead.score : '',
            lead.argumento || '',
            lead.notas || '',
            lead.origen === 'conversacion' ? 'Conversación' : 'Manual',
            lead.canalOrigen || '',
            lead.mensaje ? 'Sí' : 'No',
            lead.mensajeCanal || '',
            lead.vecesAnalizado || 0,
            fecha(lead.createdAt),
            fecha(lead.analizadoEn),
            fecha(lead.etapaEn)
        ]);
}

/** Hoja de resumen: indicadores, embudo por etapa y distribución por prioridad. */
export function filasResumen(metrics) {
    const filas = [
        ['EduLead AI — Resumen del embudo'],
        ['Generado', fecha(Date.now())],
        [],
        ['Indicador', 'Valor'],
        ['Prospectos totales', metrics.total],
        ['Calificados por IA', metrics.calificados],
        ['Sin calificar', metrics.sinCalificar],
        ['Cobertura de IA (%)', metrics.cobertura],
        ['Score promedio', metrics.scorePromedio === null ? 'Sin datos' : metrics.scorePromedio],
        ['Capturados desde conversación', metrics.desdeConversacion],
        ['Con mensaje redactado', metrics.contactados],
        ['Esperando contacto', metrics.pendientesContacto],
        ['Inscritos', metrics.inscritos],
        ['Conversión a inscrito (%)', metrics.conversion],
        [],
        ['Etapa', 'Prospectos']
    ];

    for (const etapa of ETAPAS) {
        filas.push([etapa, metrics.porEtapa[etapa] || 0]);
    }

    filas.push([], ['Prioridad', 'Prospectos']);
    for (const prioridad of ['Alta', 'Media', 'Baja']) {
        filas.push([prioridad, metrics.porPrioridad[prioridad] || 0]);
    }

    return filas;
}

/** Nombre de archivo con la fecha, para que no se pisen las descargas. */
export function nombreArchivo(extension) {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `embudo-edulead-${stamp}.${extension}`;
}

/** Escapa un valor para CSV con separador punto y coma. */
function celdaCSV(valor) {
    const texto = String(valor ?? '');
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function construirCSV(filas) {
    return filas.map((fila) => fila.map(celdaCSV).join(';')).join('\r\n');
}

function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Se libera en el siguiente tick: si se revoca de inmediato, Safari cancela la descarga.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Descarga el detalle del embudo.
 * @returns {'xlsx'|'csv'} el formato que se alcanzó a generar
 */
export function descargarEmbudo(leads, metrics) {
    const prospectos = [CABECERA_PROSPECTOS, ...filasProspectos(leads)];
    const resumen = filasResumen(metrics);

    const XLSX = typeof window !== 'undefined' ? window.XLSX : undefined;

    if (XLSX?.utils) {
        const libro = XLSX.utils.book_new();

        const hojaResumen = XLSX.utils.aoa_to_sheet(resumen);
        hojaResumen['!cols'] = [{ wch: 32 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

        const hojaProspectos = XLSX.utils.aoa_to_sheet(prospectos);
        hojaProspectos['!cols'] = [
            { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 7 },
            { wch: 46 }, { wch: 60 }, { wch: 13 }, { wch: 14 },
            { wch: 10 }, { wch: 14 }, { wch: 8 },
            { wch: 17 }, { wch: 17 }, { wch: 17 }
        ];
        hojaProspectos['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: CABECERA_PROSPECTOS.length - 1, r: prospectos.length - 1 } }) };
        hojaProspectos['!freeze'] = { xSplit: 0, ySplit: 1 };
        XLSX.utils.book_append_sheet(libro, hojaProspectos, 'Prospectos');

        XLSX.writeFile(libro, nombreArchivo('xlsx'));
        return 'xlsx';
    }

    // Respaldo: un CSV que Excel en español abre en columnas sin pedir nada.
    const contenido = construirCSV([...resumen, [], [], ...prospectos]);
    descargarBlob(new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' }), nombreArchivo('csv'));
    return 'csv';
}
