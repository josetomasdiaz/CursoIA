/**
 * Importación de reportes de interacción (CSV o Excel).
 *
 * Todo aquí es puro: recibe texto o filas y devuelve leads listos para guardar.
 * Sin DOM y sin localStorage, para poder probarlo con archivos reales.
 *
 * El formato de referencia es el reporte de interacción de Mine-Class:
 * Nombre, Email, Teléfono, Programas, Tipo, Descargas, Primera interacción,
 * Última interacción, Origen. Pero el mapeo va por alias, así que tolera
 * variaciones de nombre de columna y orden.
 */

/** Alias aceptados por campo, ya normalizados (sin acentos, en minúscula). */
const ALIAS = {
    nombre: ['nombre', 'nombre completo', 'nombres', 'name', 'full name', 'prospecto', 'contacto'],
    curso: ['programas', 'programa', 'curso', 'curso de interes', 'cursos', 'diplomado', 'interes'],
    email: ['email', 'correo', 'correo electronico', 'e-mail', 'mail'],
    telefono: ['telefono', 'fono', 'celular', 'movil', 'phone', 'whatsapp'],
    tipo: ['tipo', 'tipo de programa', 'categoria'],
    descargas: ['descargas', 'descargas de material', 'downloads'],
    primeraInteraccion: ['primera interaccion', 'primer contacto', 'fecha primera interaccion'],
    ultimaInteraccion: ['ultima interaccion', 'ultimo contacto', 'fecha ultima interaccion'],
    origen: ['origen', 'fuente', 'source', 'canal', 'utm source'],
    notas: ['notas', 'notas de interaccion', 'observaciones', 'comentarios', 'detalle']
};

/** Quita acentos, espacios de sobra y mayúsculas, para comparar encabezados. */
export function normalizar(texto) {
    return String(texto ?? '')
        .replace(/^﻿/, '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

/** Detecta el separador mirando la primera línea: coma, punto y coma o tabulación. */
export function detectarSeparador(primeraLinea) {
    const candidatos = [',', ';', '\t'];
    let mejor = ',';
    let max = -1;

    for (const sep of candidatos) {
        // Se cuentan solo los separadores fuera de comillas.
        let dentro = false;
        let cuenta = 0;
        for (const char of primeraLinea) {
            if (char === '"') dentro = !dentro;
            else if (char === sep && !dentro) cuenta += 1;
        }
        if (cuenta > max) { max = cuenta; mejor = sep; }
    }
    return mejor;
}

/**
 * Parser de CSV escrito a mano: respeta comillas, separadores dentro de comillas,
 * comillas escapadas ("") y saltos de línea dentro de un campo.
 * @returns {string[][]}
 */
export function parseDelimitado(texto) {
    const limpio = String(texto ?? '').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!limpio.trim()) return [];

    const sep = detectarSeparador(limpio.split('\n')[0]);
    const filas = [];
    let fila = [];
    let campo = '';
    let dentro = false;

    for (let i = 0; i < limpio.length; i++) {
        const char = limpio[i];

        if (dentro) {
            if (char === '"') {
                if (limpio[i + 1] === '"') { campo += '"'; i += 1; }
                else dentro = false;
            } else {
                campo += char;
            }
            continue;
        }

        if (char === '"') dentro = true;
        else if (char === sep) { fila.push(campo); campo = ''; }
        else if (char === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
        else campo += char;
    }

    fila.push(campo);
    filas.push(fila);

    // Se descartan las filas totalmente vacías, que abundan al final de los archivos.
    return filas.filter((f) => f.some((c) => String(c).trim() !== ''));
}

/** Empareja cada encabezado con un campo interno. Devuelve { campo: índice }. */
export function mapearEncabezados(encabezados) {
    const mapa = {};
    encabezados.forEach((titulo, indice) => {
        const norm = normalizar(titulo);
        for (const [campo, alias] of Object.entries(ALIAS)) {
            if (mapa[campo] === undefined && alias.includes(norm)) mapa[campo] = indice;
        }
    });
    return mapa;
}

/**
 * Redacta las notas que va a leer la IA a partir de las señales del reporte.
 *
 * Deliberadamente NO incluye email ni teléfono: son datos personales que no
 * aportan nada al scoring y que no hay razón para enviar a un tercero.
 */
export function componerNotas(registro) {
    const partes = [];

    if (registro.curso) {
        partes.push(registro.tipo
            ? `Interesado en ${registro.curso} (${registro.tipo}).`
            : `Interesado en ${registro.curso}.`);
    }

    if (registro.origen) partes.push(`Llegó por ${registro.origen}.`);

    const descargas = Number(registro.descargas);
    if (Number.isFinite(descargas) && descargas > 0) {
        partes.push(descargas === 1
            ? 'Descargó material del programa una vez.'
            : `Descargó material del programa ${descargas} veces.`);
    }

    if (registro.primeraInteraccion && registro.ultimaInteraccion) {
        partes.push(registro.primeraInteraccion === registro.ultimaInteraccion
            ? `Interactuó una sola vez, el ${registro.primeraInteraccion}.`
            : `Primera interacción el ${registro.primeraInteraccion} y última el ${registro.ultimaInteraccion}, o sea que volvió.`);
    } else if (registro.primeraInteraccion) {
        partes.push(`Primera interacción el ${registro.primeraInteraccion}.`);
    }

    partes.push('Importado desde el reporte de interacción: sin conversación registrada todavía.');
    return partes.join(' ');
}

/**
 * Convierte filas crudas (de CSV o de una hoja de Excel) en leads.
 * @param {Array<Array<any>>} filas la primera fila son los encabezados
 * @returns {{leads: Array<object>, ignoradas: Array<{fila:number, motivo:string}>, columnas: string[]}}
 */
export function mapearFilas(filas) {
    if (!Array.isArray(filas) || filas.length < 2) {
        return { leads: [], ignoradas: [], columnas: [] };
    }

    const encabezados = filas[0].map((h) => String(h ?? ''));
    const mapa = mapearEncabezados(encabezados);
    const leads = [];
    const ignoradas = [];

    if (mapa.nombre === undefined) {
        return { leads: [], ignoradas: [{ fila: 1, motivo: 'No se encontró una columna de nombre' }], columnas: encabezados };
    }

    const valor = (fila, campo) => {
        const i = mapa[campo];
        return i === undefined ? '' : String(fila[i] ?? '').trim();
    };

    for (let f = 1; f < filas.length; f++) {
        const fila = filas[f];
        const registro = {
            nombre: valor(fila, 'nombre'),
            curso: valor(fila, 'curso'),
            email: valor(fila, 'email'),
            telefono: valor(fila, 'telefono'),
            tipo: valor(fila, 'tipo'),
            descargas: valor(fila, 'descargas'),
            primeraInteraccion: valor(fila, 'primeraInteraccion'),
            ultimaInteraccion: valor(fila, 'ultimaInteraccion'),
            origen: valor(fila, 'origen'),
            notas: valor(fila, 'notas')
        };

        if (!registro.nombre) {
            ignoradas.push({ fila: f + 1, motivo: 'Sin nombre' });
            continue;
        }

        leads.push({
            nombre: registro.nombre,
            curso: registro.curso || 'Sin programa indicado',
            // Si el archivo ya trae notas propias se respetan; si no, se redactan.
            notas: registro.notas || componerNotas(registro),
            email: registro.email || null,
            telefono: registro.telefono || null,
            tipo: registro.tipo || null,
            descargas: Number.isFinite(Number(registro.descargas)) && registro.descargas !== '' ? Number(registro.descargas) : null,
            primeraInteraccion: registro.primeraInteraccion || null,
            ultimaInteraccion: registro.ultimaInteraccion || null,
            origen: registro.origen || null,
            origenCarga: 'importado'
        });
    }

    return { leads, ignoradas, columnas: encabezados };
}

/** Atajo para archivos CSV: texto crudo a leads. */
export function importarCSV(texto) {
    return mapearFilas(parseDelimitado(texto));
}
