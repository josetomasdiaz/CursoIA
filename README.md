Markdown
# EduLead AI — CRM Estático con Lead Scoring Inteligente

**EduLead AI** es una Single Page Application (SPA) estática en JavaScript Vanilla diseñada para optimizar la conversión en equipos de ventas de bootcamps. Permite registrar prospectos (leads) y calificarlos semánticamente utilizando la API de **Google Gemini** para priorizar a los prospectos con mayor intención de compra en un tablero Kanban.

Proyecto desarrollado para el bootcamp por **José Tomás Díaz** y **Claudio Valenzuela**. Evaluado por **Felipe Cuevas**.

---

## 🚀 Características Principales

- **Tablero Kanban Dinámico:** Organiza prospectos en 4 columnas (*Sin calificar*, *Prioridad Baja*, *Prioridad Media*, *Prioridad Alta*) con codificación de colores optimizada para legibilidad.
- **Lead Scoring Semántico (IA):** Analiza el contexto, presupuesto y urgencia expresados en las notas de la conversación usando `gemini-1.5-flash` y devuelve una calificación estructurada en JSON (`score` 1-100, `probabilidad` y `argumento`).
- **Persistencia Local y Seeding:** Estado guardado en `localStorage` con carga automática de datos iniciales (*mock data*) en la primera vista.
- **Flujo CRUD Completo & Re-calificación:** Permite crear, editar y eliminar leads. Si se modifican las notas de un lead ya evaluado, el sistema reactiva el análisis para re-calcular su puntuación.
- **Zero Build Tools:** Construido 100% en HTML5, TailwindCSS (CDN) y JavaScript ES6 Modular nativo. Funciona sin dependencias de Node.js ni empaquetadores (Vite/Webpack).

---

## 🔒 Advertencia de Seguridad y API Key

> **IMPORTANTE PARA LA EVALUACIÓN:**
> Esta aplicación corre íntegramente en el navegador del cliente (Frontend Estático). Por seguridad y para evitar la exposición de secretos en repositorios públicos:
> 1. **NUNCA** se debe commitear una API Key de Gemini al código fuente o al repositorio.
> 2. La aplicación incluye una barra de configuración superior donde el evaluador debe ingresar su propia **Gemini API Key**.
> 3. La clave se almacena exclusivamente en `sessionStorage` (se destruye al cerrar la pestaña) y se envía de forma directa a los servidores de Google mediante HTTPS.

---

## 🛠️ Arquitectura del Proyecto

```text
edulead-ai/
├── index.html          # Interfaz SPA, layout Tailwind y estructura Kanban
├── css/
│   └── styles.css      # Ajustes CSS menores y animaciones
├── js/
│   ├── app.js          # Orquestador principal y delegación de eventos DOM
│   ├── ui.js           # Generación de HTML dinámico, estilos y sistema Toast
│   ├── storage.js      # Controlador de localStorage (CRUD y seeding inicial)
│   └── gemini.js       # Cliente HTTP de Gemini REST API (v1beta)
└── README.md           # Documentación técnica y guía de uso
