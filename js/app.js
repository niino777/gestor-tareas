'use strict';

/*  MODELO (POO) */

/** Representa una tarea individual. */
class Tarea {
  constructor({
    id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    descripcion,
    estado = 'pendiente',
    fechaCreacion = new Date().toISOString(),
    fechaLimite = null,
    etiqueta = '',
    color = '#5B8CFF',
  }) {
    Object.assign(this, { id, descripcion, estado, fechaCreacion, fechaLimite, etiqueta, color });
  }

  get completada() {
    return this.estado === 'completada';
  }

  /** Cambia entre 'pendiente' y 'completada'. */
  alternarEstado() {
    this.estado = this.completada ? 'pendiente' : 'completada';
  }
}

/** Administra la lista de tareas y su persistencia en localStorage. */
class GestorTareas {
  #clave = 'gestor-tareas:v1';

  constructor() {
    this.tareas = this.#cargar();
  }

  #cargar() {
    try {
      const datos = JSON.parse(localStorage.getItem(this.#clave) ?? '[]');
      return datos.map((d) => new Tarea(d));
    } catch (error) {
      console.error('No se pudieron leer las tareas guardadas:', error);
      return [];
    }
  }

  #guardar() {
    localStorage.setItem(this.#clave, JSON.stringify(this.tareas));
  }

  buscar(id) {
    return this.tareas.find((t) => t.id === id);
  }

  agregar(datos) {
    const tarea = new Tarea({ ...datos });
    this.tareas = [tarea, ...this.tareas];
    this.#guardar();
    return tarea;
  }

  /** Agrega varias tareas a la vez usando un parámetro rest (...lista). */
  agregarVarias(...lista) {
    return lista.map((datos) => this.agregar(datos));
  }

  editar(id, cambios) {
    Object.assign(this.buscar(id) ?? {}, cambios);
    this.#guardar();
  }

  alternar(id) {
    this.buscar(id)?.alternarEstado();
    this.#guardar();
  }

  eliminar(id) {
    this.tareas = this.tareas.filter((t) => t.id !== id);
    this.#guardar();
  }

  filtrar({ estado = 'todas', texto = '', etiqueta = '' } = {}) {
    const consulta = texto.trim().toLowerCase();
    return this.tareas.filter(
      (t) =>
        (estado === 'todas' || t.estado === estado) &&
        (!etiqueta || t.etiqueta === etiqueta) &&
        t.descripcion.toLowerCase().includes(consulta)
    );
  }

  /** Etiquetas distintas en uso (para el filtro y las sugerencias). */
  get etiquetas() {
    return [...new Set(this.tareas.map((t) => t.etiqueta).filter(Boolean))];
  }

  get pendientes() {
    return this.tareas.filter((t) => !t.completada).length;
  }
}

/* API EXTERNA (fetch + async/await + try/catch) */
const API_URL = 'https://jsonplaceholder.typicode.com/todos';

const pedirJson = async (url, opciones) => {
  const respuesta = await fetch(url, opciones);
  if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
  return respuesta.json();
};

const obtenerEjemplos = async () => {
  const datos = await pedirJson(`${API_URL}?_limit=5`);
  return datos.map(({ title, completed }) => ({
    descripcion: title.slice(0, 80),
    estado: completed ? 'completada' : 'pendiente',
  }));
};

const enviarTarea = ({ descripcion, estado }) =>
  pedirJson(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: descripcion, completed: estado === 'completada' }),
  });

/* INTERFAZ (DOM y eventos) */
const gestor = new GestorTareas();
const filtro = { estado: 'todas', texto: '', etiqueta: '' };
const RETARDO_AVISO_MS = 2000;
let idEnEdicion = null;

const $ = (selector) => document.querySelector(selector);
const el = {
  form: $('#form-tarea'), modal: $('#modal-tarea'), tituloModal: $('#titulo-modal'),
  descripcion: $('#descripcion'), fechaLimite: $('#fechaLimite'), etiqueta: $('#etiqueta'),
  sugerencias: $('#lista-etiquetas'), filtroEtiqueta: $('#filtro-etiqueta'),
  error: $('#error-descripcion'), errorFecha: $('#error-fecha'), caracteres: $('#caracteres'),
  guardar: $('#btn-guardar'), importar: $('#btn-importar'), busqueda: $('#busqueda'),
  lista: $('#lista'), vacio: $('#vacio'), detalle: $('#detalle'),
  contador: $('#contador'), contadorTexto: $('#contador-texto'),
  reloj: $('#reloj'), fecha: $('#fecha-hoy'), aviso: $('#aviso'),
  plantilla: $('#tpl-tarea'), tema: $('#btn-tema'),
  avisos: $('#btn-avisos'), textoAvisos: $('#texto-avisos'),
};
const modal = bootstrap.Modal.getOrCreateInstance(el.modal);
const formatoCreacion = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' });

/* ---- Hora de Chile: zona America/Santiago (maneja el horario de verano) ---- */
const ZONA = 'America/Santiago';
let desfaseMs = 0; // diferencia entre servidor horario y reloj del dispositivo
const ahora = () => new Date(Date.now() + desfaseMs);
const formatoHora = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, timeStyle: 'medium', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short' });
const formatoPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Hora "de pared" de Chile en ms, para comparar con la fecha escrita en el formulario. */
const marcaChile = () => {
  const p = Object.fromEntries(formatoPartes.formatToParts(ahora()).map(({ type, value }) => [type, value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
};
const aTexto = (ms) => new Date(ms).toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:mm'
const aMarca = (texto) => {
  const [y, m, d, h, min] = texto.split(/[-T:]/);
  return Date.UTC(y, m - 1, d, h, min);
};

/** Texto "vence en ..."; devuelve null si ya venció. */
const tiempoRestante = (fechaLimite) => {
  const ms = aMarca(fechaLimite) - marcaChile();
  if (ms <= 0) return null;
  const [d, h, m, s] = [86400000, 3600000, 60000, 1000].map((u, i, arr) =>
    Math.floor((ms % (arr[i - 1] ?? Infinity)) / u)
  );
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min ${s} s`;
};

const pintarReloj = () => {
  const f = ahora();
  el.reloj.textContent = formatoHora.format(f);
  el.fecha.textContent = formatoDia.format(f);
};

/** Ajusta el reloj con un servidor horario; si falla, se usa la hora del dispositivo. */
const sincronizarHora = async () => {
  try {
    const { unixtime } = await pedirJson(`https://worldtimeapi.org/api/timezone/${ZONA}`);
    desfaseMs = unixtime * 1000 - Date.now();
  } catch (error) {
    console.warn('Se usa la hora del dispositivo:', error.message);
  }
  pintarReloj();
};

/* ---- Avisos (setTimeout) ---- */
let temporizadorAviso;
const mostrarAviso = (mensaje) => {
  el.aviso.textContent = mensaje;
  el.aviso.classList.add('is-visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.aviso.classList.remove('is-visible'), 3000);
};

/* ---- Render ---- */
const pintarPlazo = (li, tarea) => {
  const plazo = li.querySelector('.tarea__plazo');
  const restante = tarea.fechaLimite && !tarea.completada ? tiempoRestante(tarea.fechaLimite) : null;
  const vencida = Boolean(tarea.fechaLimite) && !tarea.completada && !restante;
  plazo.textContent = tarea.completada ? 'Hecha' : vencida ? 'Vencida' : restante ? `Vence en ${restante}` : '';
  li.classList.toggle('is-vencida', vencida);
};

const pintarEtiquetas = () => {
  const etiquetas = gestor.etiquetas;
  el.sugerencias.replaceChildren(...etiquetas.map((e) => new Option(e)));
  el.filtroEtiqueta.replaceChildren(new Option('Todas las etiquetas', ''), ...etiquetas.map((e) => new Option(e, e)));
  filtro.etiqueta = etiquetas.includes(filtro.etiqueta) ? filtro.etiqueta : '';
  el.filtroEtiqueta.value = filtro.etiqueta;
};

const renderizar = () => {
  pintarEtiquetas();
  const visibles = gestor.filtrar(filtro);
  const fragmento = document.createDocumentFragment();

  visibles.forEach((tarea) => {
    const li = el.plantilla.content.firstElementChild.cloneNode(true);
    li.dataset.id = tarea.id;
    li.style.setProperty('--color-tarea', tarea.color);
    li.classList.toggle('is-completada', tarea.completada);
    li.querySelector('.tarea__texto').textContent = tarea.descripcion; // textContent evita inyección de HTML
    li.querySelector('.tarea__check').checked = tarea.completada;
    const badge = li.querySelector('.tarea__etiqueta');
    badge.hidden = !tarea.etiqueta;
    badge.textContent = tarea.etiqueta;
    pintarPlazo(li, tarea);
    const calendario = li.querySelector('.tarea__calendario');
    calendario.hidden = !tarea.fechaLimite || tarea.completada;
    if (!calendario.hidden) li.querySelector('[data-accion="google"]').href = urlGoogleCalendar(tarea);
    fragmento.append(li);
  });

  el.lista.replaceChildren(fragmento);
  el.vacio.hidden = visibles.length > 0;
  const n = gestor.pendientes;
  el.contadorTexto.textContent = n ? `${n} ${n === 1 ? 'pendiente' : 'pendientes'}` : 'Todo al día';
  el.contador.classList.toggle('is-activa', n > 0);
};

/* ---- Modal: nueva tarea / editar ---- */
const salirDeEdicion = () => {
  idEnEdicion = null;
  el.form.reset();
  el.caracteres.textContent = '0';
  el.error.textContent = el.errorFecha.textContent = '';
  el.tituloModal.textContent = 'Nueva tarea';
  el.guardar.textContent = 'Agregar tarea';
};
el.modal.addEventListener('hidden.bs.modal', salirDeEdicion);
el.modal.addEventListener('shown.bs.modal', () => el.descripcion.focus());

el.form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const descripcion = el.descripcion.value.trim();
  if (!descripcion) {
    el.error.textContent = 'Escribe una descripción para la tarea.';
    el.descripcion.focus();
    return;
  }
  el.error.textContent = '';
  const fechaLimite = el.fechaLimite.value || null;
  const original = gestor.buscar(idEnEdicion)?.fechaLimite;
  if (fechaLimite && fechaLimite !== original && aMarca(fechaLimite) <= marcaChile()) {
    el.errorFecha.textContent = 'La fecha límite debe ser posterior a la hora actual de Chile.';
    el.fechaLimite.focus();
    return;
  }
  const datos = {
    descripcion, fechaLimite,
    etiqueta: el.etiqueta.value.trim(),
    color: el.form.elements.color.value,
  };

  if (idEnEdicion) {
    gestor.editar(idEnEdicion, datos);
    avisadas.delete(idEnEdicion); // si cambió la fecha, puede volver a avisar
    modal.hide();
    renderizar();
    mostrarAviso('Tarea actualizada');
    return;
  }

  const tarea = gestor.agregar(datos);
  modal.hide();
  renderizar();

  // Sincronización simulada con la API: no bloquea la interfaz si falla.
  let mensaje;
  try {
    await enviarTarea(tarea);
    mensaje = `Tarea "${tarea.descripcion}" guardada también en la API`;
  } catch (error) {
    mensaje = 'Guardada en tu navegador (la API no respondió)';
    console.error(error);
  }
  // Notificación diferida: aparece 2 segundos después de terminar la sincronización.
  setTimeout(() => mostrarAviso(mensaje), RETARDO_AVISO_MS);
});

/* ---- keyup: contador de caracteres y búsqueda en vivo ---- */
el.descripcion.addEventListener('keyup', () => {
  el.caracteres.textContent = el.descripcion.value.length;
});
el.busqueda.addEventListener('keyup', () => {
  filtro.texto = el.busqueda.value;
  renderizar();
});
el.filtroEtiqueta.addEventListener('change', () => {
  filtro.etiqueta = el.filtroEtiqueta.value;
  renderizar();
});

/* ---- Filtros por estado ---- */
document.querySelector('.filtros').addEventListener('click', ({ target }) => {
  const boton = target.closest('.filtro');
  if (!boton) return;
  document.querySelectorAll('.filtro').forEach((b) => {
    b.classList.toggle('active', b === boton);
    b.setAttribute('aria-pressed', b === boton);
  });
  filtro.estado = boton.dataset.filtro;
  renderizar();
});

/* ---- Lista: delegación de eventos (un solo listener para todos los <li>) ---- */
el.lista.addEventListener('click', ({ target }) => {
  const li = target.closest('.tarea');
  if (!li) return;
  const { id } = li.dataset;
  const boton = target.closest('[data-accion]');

  if (target.matches('.tarea__check')) {
    gestor.alternar(id);
    renderizar();
  } else if (boton?.dataset.accion === 'eliminar') {
    gestor.eliminar(id);
    renderizar();
    mostrarAviso('Tarea eliminada');
  } else if (boton?.dataset.accion === 'ics') {
    descargarIcs(gestor.buscar(id));
  } else if (boton?.dataset.accion === 'editar') {
    const tarea = gestor.buscar(id);
    idEnEdicion = id;
    el.descripcion.value = tarea.descripcion;
    el.fechaLimite.value = tarea.fechaLimite ?? '';
    el.etiqueta.value = tarea.etiqueta;
    el.form.elements.color.value = tarea.color;
    el.caracteres.textContent = tarea.descripcion.length;
    el.tituloModal.textContent = 'Editar tarea';
    el.guardar.textContent = 'Guardar cambios';
    modal.show();
  }
});

/* ---- mouseover: muestra la fecha de creación ---- */
el.lista.addEventListener('mouseover', ({ target }) => {
  const li = target.closest('.tarea');
  if (!li) return;
  const { fechaCreacion } = gestor.buscar(li.dataset.id);
  el.detalle.textContent = `Creada el ${formatoCreacion.format(new Date(fechaCreacion))}`;
});

/* ---- Importar ejemplos desde la API (GET) ---- */
el.importar.addEventListener('click', async () => {
  el.importar.disabled = true;
  try {
    const ejemplos = await obtenerEjemplos();
    gestor.agregarVarias(...ejemplos); // spread al llamar, rest al recibir
    renderizar();
    mostrarAviso(`${ejemplos.length} tareas importadas`);
  } catch (error) {
    mostrarAviso('No se pudo conectar con la API. Intenta de nuevo.');
    console.error(error);
  } finally {
    el.importar.disabled = false;
  }
});

/* ---- Atajos de fecha y mínimo según la hora de Chile ---- */
el.fechaLimite.addEventListener('focus', () => { el.fechaLimite.min = aTexto(marcaChile()); });
document.querySelector('.atajos').addEventListener('click', ({ target }) => {
  const boton = target.closest('[data-atajo]');
  if (!boton) return;
  const base = marcaChile();
  const valores = {
    hora: aTexto(base + 3600000),
    manana: `${aTexto(base + 86400000).slice(0, 10)}T09:00`,
    semana: aTexto(base + 604800000),
  };
  el.fechaLimite.value = valores[boton.dataset.atajo];
  el.errorFecha.textContent = '';
});

/* ---- Exportar a calendario (Google Calendar y archivo .ics) ---- */
const DURACION_MS = 3600000; // cada evento dura 1 hora
const aCalendario = (ms) => `${aTexto(ms).replace(/[-:]/g, '')}00`; // 'YYYYMMDDTHHmm00'

const urlGoogleCalendar = (tarea) => {
  const inicio = aMarca(tarea.fechaLimite);
  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: tarea.descripcion,
    dates: `${aCalendario(inicio)}/${aCalendario(inicio + DURACION_MS)}`,
    details: tarea.etiqueta ? `Etiqueta: ${tarea.etiqueta}. Creada con Hecho.` : 'Creada con Hecho.',
    ctz: ZONA,
  });
  return `https://calendar.google.com/calendar/render?${parametros}`;
};

const crearIcs = (tarea) => {
  const inicio = aMarca(tarea.fechaLimite);
  const titulo = tarea.descripcion.replace(/[,;]/g, '\\$&'); // en .ics, la coma y el punto y coma se escapan
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hecho//Gestor de tareas//ES',
    'BEGIN:VEVENT',
    `UID:${tarea.id}@hecho`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
    `DTSTART:${aCalendario(inicio)}`, // hora "flotante": el calendario la lee en la zona del dispositivo
    `DTEND:${aCalendario(inicio + DURACION_MS)}`,
    `SUMMARY:${titulo}`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
};

const descargarIcs = (tarea) => {
  const archivo = new Blob([crearIcs(tarea)], { type: 'text/calendar;charset=utf-8' });
  const enlace = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(archivo),
    download: 'tarea-hecho.ics',
  });
  enlace.click();
  URL.revokeObjectURL(enlace.href);
};

/* ---- Avisos: notificación del navegador (solo funciona con la pestaña abierta) ---- */
const MINUTOS_AVISO = 30;
const avisadas = new Set(); // ids de tareas ya avisadas en esta sesión
const hayNotificaciones = 'Notification' in window;

const actualizarBotonAvisos = () => {
  const permiso = Notification.permission;
  el.textoAvisos.textContent =
    permiso === 'granted' ? 'Avisos activados' : permiso === 'denied' ? 'Avisos bloqueados' : 'Activar avisos';
  el.avisos.disabled = permiso !== 'default';
};

el.avisos.addEventListener('click', async () => {
  await Notification.requestPermission();
  actualizarBotonAvisos();
});

/** Avisa de las tareas que vencen dentro de los próximos 30 minutos. */
const revisarVencimientos = () => {
  gestor.tareas.forEach((tarea) => {
    if (tarea.completada || !tarea.fechaLimite || avisadas.has(tarea.id)) return;
    const faltan = aMarca(tarea.fechaLimite) - marcaChile();
    if (faltan <= 0 || faltan > MINUTOS_AVISO * 60000) return;
    avisadas.add(tarea.id);
    const texto = `"${tarea.descripcion}" vence en ${tiempoRestante(tarea.fechaLimite)}`;
    mostrarAviso(texto); // aviso dentro de la página (siempre)
    if (hayNotificaciones && Notification.permission === 'granted') {
      new Notification('Hecho: tarea por vencer', { body: texto, icon: 'img/favicon.png' });
    }
  });
};

/* ---- Modo oscuro: Bootstrap 5.3 lo soporta con data-bs-theme ---- */
const aplicarTema = (tema) => {
  document.documentElement.dataset.bsTheme = tema;
  el.tema.setAttribute('aria-pressed', tema === 'dark');
  el.tema.setAttribute('aria-label', tema === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro');
  try { localStorage.setItem('hecho:tema', tema); } catch (error) { console.warn(error); }
};
el.tema.addEventListener('click', () =>
  aplicarTema(document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark')
);

/* ---- Cada segundo: reloj y cuentas regresivas (setInterval) ---- */
setInterval(() => {
  pintarReloj();
  revisarVencimientos();
  el.lista.querySelectorAll('.tarea').forEach((li) => pintarPlazo(li, gestor.buscar(li.dataset.id)));
}, 1000);

aplicarTema(document.documentElement.dataset.bsTheme);
pintarReloj();
sincronizarHora();
if (hayNotificaciones) actualizarBotonAvisos();
else el.avisos.hidden = true;
renderizar();
