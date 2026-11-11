# Access model

The public entry page is separate from the protected workspace. The Worker runs
before static assets and authorizes restored attachments, SSR documents, API
routes and MCP using the existing verified Site identity. Imported user records
do not grant access. Only the current owner is enabled until membership and
additional identity providers are configured.

Direct Google SSO is not configured. Do not describe the ChatGPT sign-in button
as Google SSO. A Google application and a compatible identity integration must
be configured before enabling it.

# SAV3 · Open ClickUp Lab

Private trial fork of goshops-com/open-clickup at fd92240fbcec674afed5096b61f9414d16d1b653, configured from the ClickUp backup dated 2026-10-30. The deployment uses Sites authentication, D1 and R2. It does not connect to or modify the original ClickUp workspace.

Open the private Site while signed in to initialize the resumable restore. Imported people are attribution/assignment records, not active logins. Password signup, login and the upstream development impersonation endpoint are disabled. The Site is restricted to its owner.

The source repository's `IMPORT_REPORT.json` records coverage and differences. Native dashboard widgets, original ACLs, advanced view configuration and unsupported field behavior are not claimed to be restored. Historical recurrence is not activated. Task types use a custom dropdown.

The Site exposes owner-authorized MCP tools for preparing the copy, reading workspace and tasks, creating/updating tasks and adding comments. Publishing with the MCP capability creates the Site's personal plugin. No separate API key is required.

Verification: generated schema and seed are validated together, including foreign keys, record counts and idempotency. Typecheck, build and the applicable upstream unit tests must pass. Managed preview requires a real ChatGPT identity; do not introduce an authentication bypass for preview.

## Custom Field Manager

Open **Campos personalizados** from a List toolbar, a Space menu, a custom field
column header, a dropdown selector or a dashboard toolbar. Create a field or add
an existing one to a Space or List. Space fields are inherited by current and
future Lists. Dashboards use fields from their source Lists.

The editor supports the existing field types, names, descriptions, option labels,
colors and order, and shared locations. Editing a shared definition updates all
its locations. Administrators can manage Space fields. Members need edit access
to every explicit List location. Used options must be cleared from tasks before
removal, and simultaneous definition edits are checked using revisions.

## Upstream documentation

<div align="center">

# Open ClickUp

**The open-source, self-hostable project management platform.**

Hierarchy, five views, custom fields, real-time collaboration and dark mode — own your data, no per-seat pricing.

[![CI](https://github.com/goshops-com/open-clickup/actions/workflows/ci.yml/badge.svg)](https://github.com/goshops-com/open-clickup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7b68ee.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg)
![React](https://img.shields.io/badge/React-19-149eca.svg)
![Postgres](https://img.shields.io/badge/Postgres-16-336791.svg)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-2ecd6f.svg)](CONTRIBUTING.md)

</div>

![List view](screenshots/list.png)

---

## Why Open ClickUp

- **Self-hostable** — run it on your own infrastructure with a single Postgres database. Your data stays yours.
- **No per-seat pricing** — invite the whole team; it's MIT-licensed and free.
- **Familiar, fast UX** — the workflows you already know (lists, boards, sprints) with instant, optimistic interactions and live updates.
- **Hackable** — a clean, modern, fully-typed codebase you can extend or embed.

## ✨ Features

**Hierarchy** — Workspaces → Spaces → Folders → Lists → Tasks → Subtasks, with inline create / rename / delete.

**5 views** (per list, each with its own saved configuration):
- **List** — grouped, inline-editable, drag-to-reorder, custom-field columns
- **Board** — Kanban with drag-and-drop, collapsible columns, WIP limits
- **Calendar** — month & week views, drag tasks to reschedule
- **Gantt** — timeline with start→due bars you can drag/resize, plus dependency arrows
- **Table** — spreadsheet-style grid with multi-select

**Tasks** — rich-text descriptions, custom statuses, priorities, multiple assignees, start/due dates, tags, **custom fields** (text, number, dropdown, labels, date, checkbox, rating…), subtasks, **checklists**, **time tracking** (estimates + live timer), **dependencies** (waiting-on / blocking), **recurring** tasks, **file attachments**, watchers, duplicate, and move-between-lists.

**Collaboration** — threaded **comments** with **@mentions**, emoji reactions, edit/delete and resolve; an **Inbox** with notifications (mentions, assignments, comments); a per-task **activity timeline**; and live updates over SSE.

**Productivity** — filter / sort / **group-by** (status · assignee · priority) on every view, a **⌘K command palette**, keyboard shortcuts, **multi-select + bulk actions**, **task templates**, **favorites**, a "My Work" home, a status-workflow editor, **dark mode**, and a mobile-responsive layout.

**Built to run in production** — email/password **auth with server-side sessions** (scrypt-hashed), **role-based permissions**, a fully **Zod-validated** API, security headers + auth rate limiting, a `/api/health` probe, a one-command **Docker** self-host, and unit + e2e tests in CI.

![My Work](screenshots/home.png)

| Board | Calendar | Gantt (with dependencies) |
|---|---|---|
| ![Board](screenshots/board.png) | ![Calendar](screenshots/calendar.png) | ![Gantt](screenshots/gantt.png) |

| Task detail | Command palette (⌘K) | Dark mode |
|---|---|---|
| ![Task modal](screenshots/task-modal.png) | ![Command palette](screenshots/command-palette.png) | ![Dark mode](screenshots/dark-mode.png) |

---

## 🧰 Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) · React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL + [Prisma 7](https://www.prisma.io) (pg driver adapter) |
| Data fetching | TanStack Query (optimistic updates) |
| Realtime | Server-Sent Events |
| Drag & drop | dnd-kit |
| UI primitives | Radix UI |
| Rich text | Tiptap |
| Validation | Zod |

---

## 🚀 Getting started

**Prerequisites:** Node 20+, pnpm, Docker (for Postgres).

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres (localhost:5544)
docker compose up -d

# 3. Configure env, run migrations, seed demo data
cp .env.example .env
pnpm prisma migrate dev
pnpm db:seed

# 4. Run the dev server
pnpm dev
```

Open **http://localhost:3000** and log in with the seeded account (or create your own):

```
email:    santiago@clickuppp.dev
password: password
```

## 🐳 Self-hosting

**Docker (app + database, one command):**

```bash
docker compose -f docker-compose.prod.yml up --build
# → http://localhost:3000  (migrations run automatically on boot)

# optional: load sample data
docker compose -f docker-compose.prod.yml exec app pnpm db:seed
```

**Or run the Node server directly:**

```bash
pnpm build && pnpm start
```

Set `DATABASE_URL` to your Postgres instance and run `pnpm prisma migrate deploy` on deploy. The app runs anywhere Node 20+ runs (a VM, a container, or any Node host); point it at a managed or self-run Postgres. Real-time uses in-process pub/sub — for multiple instances behind a load balancer, swap it for Redis pub/sub (see `lib/events.ts`).

A `GET /api/health` endpoint returns `200` when the database is reachable (`503` otherwise) for load-balancer and uptime checks; the Docker app container uses it as its healthcheck.

---

## 📜 Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm db:seed` | Seed sample workspace, users, spaces, tasks |
| `pnpm db:reset` | Reset the database and re-seed |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm lint` | Lint |

---

## 🗂️ Project structure

```
app/
  (app)/            # authenticated app shell + routes (list pages)
  login/            # login / signup page
  api/              # REST route handlers (Zod-validated) + SSE stream
components/
  views/            # list · board · calendar · gantt · table + filters
  menus/            # status · priority · assignee · date · tag controls
  task/             # task modal + checklists
  sidebar/          # workspace navigation tree
  ui/               # avatars, rich editor, primitives, theme toggle
lib/
  db.ts             # Prisma client (pg adapter)
  auth.ts           # sessions + scrypt passwords
  events.ts         # realtime pub/sub
  queries.ts        # shared include shapes + payload types
  grouping.ts       # group-by logic
  view-state.ts     # filters / sort / group-by
prisma/
  schema.prisma     # data model
  seed.ts           # demo data
```

---

## 🗺️ Roadmap

Future work is tracked as **[GitHub Issues labeled `roadmap`](https://github.com/goshops-com/open-clickup/issues?q=is%3Aissue+label%3Aroadmap)** — e.g. dashboards, automations, a public API + webhooks, Redis-backed real-time for multi-instance, S3 storage, SSO, docs/wiki, and more. Good entry points carry the `good first issue` label.

## 🤝 Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

**Building with an AI agent (or want the project's engineering guide)?** Start at
**[AGENTS.md](AGENTS.md)**, which links to the product vision, the engineering
principles, the end-to-end workflow, and the [decision records](docs/decisions/).

---

## 📄 License

[MIT](LICENSE) © Santiago Cotto and contributors.

<sub>ClickUp® is a trademark of its respective owner; this is an independent project and is not affiliated with or endorsed by ClickUp.</sub>

### Equipo SAV3: invitaciones y permisos

En **Configuración → Usuarios**, el propietario o un administrador crea una
invitación indicando email, rol y recursos compartidos. El enlace vence en siete
días y funciona una sola vez. La persona abre el enlace y elige nombre y
contraseña de al menos doce caracteres. No hay registro público abierto.

El envío es **manual**: copiá el enlace o usá «Enviar desde mi correo». No hay
proveedor de correo transaccional configurado y el sitio no afirma que el email
haya sido enviado. Si se pierde el enlace, creá otra invitación; la anterior se
revoca. Para recuperar una cuenta, revocá su acceso y volvé a invitarla. El acceso
nativo del propietario con ChatGPT sigue disponible.

Roles de esta implementación: propietario y administrador con acceso global;
miembro con permisos heredados o directos; invitado de solo lectura. Solo el
propietario puede designar administradores. Los usuarios importados del backup
conservan su autoría, pero necesitan una invitación para acceder.

Los niveles directos son ver, comentar, editar y sin acceso, por espacio, lista,
tarea o dashboard. Las tareas heredan de su lista y las subtareas de su tarea
padre. Un permiso directo reemplaza el heredado. «Recurso privado» corta la
herencia. Una tarea compartida individualmente aparece dentro de una navegación
mínima a su lista, sin revelar las demás tareas. Administradores y propietario
pueden revisar todos los recursos, incluidos los privados.

Los dashboards ofrecen conteos de tareas visibles, completadas y pendientes.
Su permiso de visualización nunca amplía el acceso a las tareas fuente. No son
el constructor completo de widgets de ClickUp. Documentos recuperados, informe
del backup, plantillas globales y MCP quedan reservados a administradores y
propietario en esta versión. Cambios estructurales que afectarían tareas privadas
requieren permiso de edición sobre esas tareas también.

Las sesiones locales vencen a las doce horas; cambiar permisos o revocar acceso
cierra las sesiones. Las cuentas nuevas se activan por invitación y sus permisos
se validan en cada solicitud. El stream de cambios se renueva cada minuto.

## Colaboración y conexiones personales

En Configuración → Conexiones LLM, cada persona puede crear una conexión con vencimiento y alcance de lectura o escritura. Se muestra el token una sola vez; puede revocarse sin afectar otras conexiones. Los permisos sobre espacios, listas y tareas se verifican en cada operación.

- ChatGPT/Codex: plugin del sitio, endpoint `/mcp`, identidad de Sites con el mismo email de la cuenta activada.
- Otros clientes MCP HTTP que acepten un encabezado Bearer: `/api/integrations/mcp`.
- API REST de tareas: `GET /api/tasks/{id}`, `POST /api/tasks`, `PATCH /api/tasks/{id}`, `POST /api/tasks/{id}/comments`, con `Authorization: Bearer <token personal>` y JSON. La API usa camelCase (`listId`, `statusId`); las herramientas MCP usan snake_case (`list_id`, `status_id`).
- Al reemplazar una descripción por REST, enviar `expectedDescription` con el HTML previamente leído. En MCP usar `expected_description`. Un conflicto devuelve error y requiere revisar la versión actual.

Inbox incluye menciones, asignaciones, comentarios y respuestas, con filtros y preferencias por usuario. Para mencionar a alguien en la web, seleccionar la persona en el menú `@`; en MCP, usar `mention_user_ids`. Solo se notifican destinatarios con acceso a la tarea. No hay envío de correo ni push.

Los cambios de otros usuarios se ofrecen mediante un aviso de cinco segundos; «Actualizar» refresca los datos de la vista sin una recarga completa. Si se oculta, queda «Cambios pendientes». Los borradores o guardados en curso deben resolverse antes de actualizar. La detección consulta cambios cada cinco segundos mientras la página está visible.

## Dashboards configurables

Desde Dashboards → Nuevo dashboard se crea un panel vacío. También se puede agregar desde una lista con + Vista → Dashboard configurable. La ubicación del panel y sus listas fuente son independientes.

En Editar dashboard, agregá tarjetas de indicadores, barras, torta, líneas, lista de tareas o actividad. Cada tarjeta permite elegir un cálculo, agrupación, tamaño, color y filtros. Los filtros del panel y de la tarjeta se combinan. Arrastrá desde el asa o usá los controles de posición; el tamaño también se cambia en Configurar. Guardar cambios conserva la configuración; Descartar cambios vuelve a la última revisión guardada.

Las agrupaciones soportan estados, responsables, prioridades, etiquetas, listas, fechas y campos personalizados. Los cálculos incluyen conteos, suma, promedio, mínimo, máximo y porcentaje de tareas completadas. Los campos vacíos no se convierten en cero. Al hacer clic en un indicador o grupo se pueden abrir las tareas correspondientes.

Compartir un dashboard no comparte las tareas: cada usuario ve sus propios datos autorizados. El panel permite actualización manual, individual por tarjeta o automática cada 30 segundos, pausada durante la edición. El historial identifica al autor de cada revisión; una versión desactualizada no puede sobrescribir otra más reciente. Archivar un panel es reversible desde Mostrar archivados. Desde el listado de Dashboards, su creador o un administrador también puede eliminarlo definitivamente previa confirmación. Se eliminan sus vistas y configuración, y se conservan las tareas y listas fuente.


### Controles de las tarjetas

Las tarjetas muestran sus acciones al pasar el mouse, enfocar con teclado o abrir el menú. En móvil y con puntero táctil permanecen visibles. El menú ⋯ permite actualizar, ampliar, configurar, duplicar, mover (en edición) y eliminar una tarjeta, según tus permisos. Las modificaciones entran al borrador y se conservan con **Guardar cambios**; **Descartar** permite revertirlas. El icono de filtro muestra cuántos criterios propios tiene la tarjeta.

En **Ajustes → Fondo de la tarjeta** se elige un color independiente del gráfico. **Usar tema** restaura el fondo del tema claro/oscuro; el texto de una tarjeta con fondo personalizado se adapta para mantener contraste. La barra del dashboard utiliza controles compactos.


### Indicadores compactos

En **⋯ → Ajustes**, los indicadores permiten alturas **Micro (1 unidad)**, **Pequeña (2)** y **Reducida (3)**, además de las alturas anteriores. El mínimo anterior era 4 unidades. Los gráficos y las tablas conservan su mínimo de 4. En la misma ventana, **Tamaño del indicador (px)** permite elegir entre 16 y 128 px. La cifra se reduce automáticamente si no cabe; los indicadores más compactos muestran el detalle de cantidad de tareas en su etiqueta accesible y tooltip. El tamaño, la fuente y los filtros se conservan al guardar o duplicar.


### Identificación en el navegador

Open ClickUp usa el símbolo original de SAV3 sobre un fondo ámbar como favicon, para distinguirlo del resto de las pestañas SAV3. Incluye SVG, PNG de respaldo, ICO y un icono para accesos directos en iOS.


### Vistas personales con guardado automático

Cada usuario conserva una configuración independiente por lista y por vista. Se recuerdan los grupos expandidos/comprimidos de Lista, Tabla y Board, las subtareas abiertas en Lista, filtros, orden, agrupación, la última vista elegida en cada lista y el mes/semana del Calendario. Un enlace con `?view=` abre esa vista explícita. Los valores compartidos existentes se usan como configuración inicial hasta que cada persona elige los propios.

Las preferencias se guardan en la cuenta y pueden recuperarse en otro dispositivo después de sincronizar. Los cambios pendientes también se guardan localmente, cuando el navegador lo permite, para reintentarlos al volver o recuperar conexión. Si falla el guardado se muestra **Guardado personal pendiente** con un botón de reintento. Estas preferencias no cambian tareas ni la configuración del resto del equipo; incluso un invitado puede recordar su presentación sin ganar permisos de edición. La composición y los filtros del dashboard configurable siguen su flujo explícito de edición/guardado compartido.

## SAV3 0.12.0

Operational configuration now includes advanced custom fields, normal view creation/duplication,
content search, bulk editing, richer templates, recoverable task/dashboard deletion, portable
backups, audit, reminders, rules, stage history, exports and expanded API/MCP integration.
See [the release and activation guide](docs/RELEASE-0.12.0.md) for exact behavior,
provider configuration, scheduling verification, recovery and limits.

## SAV3 0.12.1 · Acceso y recuperación

Login y Mi cuenta permiten mostrar/ocultar cada contraseña con el ojo; comienzan ocultas y el botón no envía el formulario. La recuperación incluye solicitud/reenvío por email, enlace de un uso con vigencia de 30 minutos, confirmación de contraseña, errores y regreso al login. Reset también ofrece el ojo y permite solicitar un enlace nuevo. Los tokens se retiran de la URL al abrir la página y no se guardan en el navegador.

Para activar el envío en Sites, configurar como secreto `RESEND_API_KEY` y el remitente verificado `MAIL_FROM` en el entorno del sitio. Sin esta configuración, la solicitud informa que el correo no está disponible; no crea ni muestra un enlace de recuperación públicamente. Las pruebas del proveedor utilizan un mock, no verifican entrega real.

## SAV3 0.12.2 · Adjuntos

Los adjuntos raster JPG/JPEG, PNG, GIF y WebP muestran miniatura y se amplían en un diálogo con cierre por Escape y descarga del original. Los demás archivos se descargan con su nombre y extensión originales, sin conversión. Los controles de descarga permanecen visibles también con teclado y touch.

La entrega autenticada `/api/files/{id}` reconoce las firmas de imagen, incluso si un adjunto previo fue guardado como `application/octet-stream`. También sirve los adjuntos importados de `/restored-files/` con los mismos permisos de tarea. `?download=1` fuerza la descarga con nombre UTF-8 y alternativa ASCII. La detección lee solo el principio del stream y conserva todos los bytes; no modifica adjuntos históricos. SVG/HTML no se visualizan inline.

## SAV3 0.12.3 · Recuperación por superadmin

En Configuración → Usuarios, solo el propietario (superadmin / OWNER) puede usar **Generar contraseña** para una cuenta activa. Tras confirmar, se genera una clave aleatoria de 24 caracteres, se guarda solo su hash y se muestra una sola vez. Se revocan las sesiones, conexiones API, enlaces de recuperación e invitaciones pendientes de esa cuenta. No se modifican sus permisos ni se habilitan identidades importadas inactivas. La persona puede cambiarla desde Mi cuenta. No se impone un cambio obligatorio al ingresar.

La recuperación por superadmin no requiere email. Para el autoservicio desde Login siguen siendo necesarios `RESEND_API_KEY` y un `MAIL_FROM` verificado en Sites; no son el correo/contraseña del usuario. No guardar claves de proveedor en el repositorio ni enviarlas por chat.
