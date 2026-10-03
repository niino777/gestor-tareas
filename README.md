# Hecho · Gestor de tareas > *De pendiente a hecho.*


Aplicación web para **crear, editar, completar y organizar tareas**, desarrollada con HTML5, CSS3 y JavaScript moderno (ES6+), con Bootstrap 5 para la interfaz. Proyecto del curso **Front End Trainee**.

🔗 **Demo:** https://niino777.github.io/gestor-tareas/

[Vista de la aplicación](docs/captura.png)

## Funcionalidades

- **Tareas completas:** crear, editar, eliminar y marcar como hechas, con descripción, fecha límite opcional, **color** y **etiqueta** (para agrupar por tipo: Estudio, Casa, Trabajo…).
- **Búsqueda y filtros:** búsqueda mientras escribes, filtro por estado (todas, pendientes, hechas) y filtro por etiqueta.
- **Hora y fecha de Chile** en la barra superior, junto a una **alerta de pendientes** que se resalta cuando hay tareas por hacer.
- **Cuenta regresiva** en vivo de las tareas con fecha límite; las vencidas se marcan en rojo. La fecha límite no puede ser anterior a la hora actual de Chile.
- **Exportar a calendario:** cada tarea con fecha puede abrirse en **Google Calendar** o descargarse como archivo **.ics** (Apple Calendar, Outlook y otros).
- **Avisos:** notificación (dentro de la página y, si lo autorizas, del navegador) cuando una tarea vence en menos de 30 minutos.
- **Modo claro / oscuro** con un interruptor animado. Recuerda tu elección y usa la preferencia de tu sistema la primera vez.
- **Importar tareas de ejemplo** desde una API externa.
- **Datos guardados** en el navegador: al recargar no se pierde nada.
- **Responsiva:** funciona en celular, tablet y escritorio.

## Estructura del proyecto

```
gestor-tareas/
├── index.html            # Estructura semántica, modal y plantilla de tarea
├── css/
│   └── styles.css        # Paleta, modo oscuro y estilos propios
├── js/
│   └── app.js            # Clases, lógica, eventos, API y exportación
├── img/
│   ├── logo.png          # Logo de la marca Hecho
│   └── favicon.png
├── docs/
│   └── justificacion.md  # Informe técnico del proyecto
└── README.md
```

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML5, CSS3, JavaScript (ES6+) | Base del proyecto, sin frameworks de JavaScript |
| [Bootstrap 5.3](https://getbootstrap.com) | Grilla responsiva, formulario, modal, menús y modo oscuro (`data-bs-theme`) |
| [Bootstrap Icons](https://icons.getbootstrap.com) | Íconos de la interfaz |
| [JSONPlaceholder](https://jsonplaceholder.typicode.com) | API de prueba: importar (GET) y enviar (POST) tareas |
| [WorldTimeAPI](https://worldtimeapi.org) | Ajuste del reloj de Chile (si no responde, se usa la hora del dispositivo) |
| `localStorage` | Guardado de tareas y del tema elegido |


## Buenas prácticas aplicadas

- HTML semántico y accesible: `nav`, `main`, `section`, etiquetas asociadas a cada campo, `aria-live`, `aria-label` en botones de ícono y foco visible.
- Seguridad: el texto del usuario se inserta con `textContent`, nunca con `innerHTML`.
- Código organizado en tres bloques (modelo, API, interfaz), con funciones pequeñas y comentarios.
- CSS con variables en `:root` y paleta tomada del logo; se respeta `prefers-reduced-motion`.