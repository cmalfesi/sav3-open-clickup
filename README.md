# SAV3 · Open ClickUp — código de producción v7

Esta copia exporta el código de la versión 7 publicada en Sites, commit
`7be2c1b5b5a947dc6e21aa0229124ce49679c6d8`, sobre el upstream
`goshops-com/open-clickup` (`fd92240fbcec674afed5096b61f9414d16d1b653`).

Incluye ingreso por contraseña, invitaciones, roles, Settings, permisos por
recurso, dashboards básicos, navegación corregida y adaptación a D1/R2.
El envío de invitaciones por correo sigue siendo manual. La versión 6 evita
volver a mostrar la pantalla de importación al navegar por espacios ya restaurados.

La versión 7 agrupa lecturas D1, actualiza tareas sin recargar la lista completa,
muestra guardados pendientes y revierte cambios rechazados.

## Código y datos

El código de la aplicación coincide con ese commit de producción. Los datos
privados del backup, documentos, adjuntos y la identidad del despliegue no forman
parte de este repositorio público. No se ha migrado la base de datos de producción.
`PRODUCTION_SOURCE.json` registra qué archivos coinciden con producción y qué
archivos se excluyeron o adaptaron para distribuir el código.

No mezcles el historial privado de Sites: contiene datos del respaldo.

## Abrir en VS Code

Desde una copia del repositorio, abrí la carpeta raíz (la que contiene
`package.json`). No necesitás instalar dependencias para leer o editar archivos.
Para compilar, usá Node 22.13+ y la versión de pnpm fijada en `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm prepare:data
pnpm prisma:generate
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

Los ejemplos contienen datos sintéticos. Para iniciar una instancia utilizable
hace falta inicializar D1 y sus cuentas; el build por sí solo no crea usuarios,
contraseñas ni recupera la base de producción. El acceso del propietario en
producción sigue vinculado a Sites. No hay una contraseña predeterminada.

## Importar un respaldo autorizado

Mantené el respaldo extraído fuera del checkout:

```bash
python3 scripts/import-clickup-backup.py --backup /ruta/absoluta/al/respaldo --project "$PWD"
```

Ese comando escribe archivos locales privados ignorados por Git. No cambia el
esquema: aplicá siempre las migraciones Drizzle comprometidas antes de restaurar
los datos. No uses `git add -f` para incorporar los archivos del respaldo.

## Publicación

Esta entrega sincroniza código, sin volver a desplegar ni cambiar producción.
Un despliegue posterior requiere configurar el Site de destino y sus bindings.
No subas credenciales a Git. La publicación no importa automáticamente datos,
usuarios activos, contraseñas ni sesiones desde otra instancia.

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

Compartir un dashboard no comparte las tareas: cada usuario ve sus propios datos autorizados. El panel permite actualización manual, individual por tarjeta o automática cada 30 segundos, pausada durante la edición. El historial identifica al autor de cada revisión; una versión desactualizada no puede sobrescribir otra más reciente. Archivar un panel es reversible desde Mostrar archivados.


### Controles de las tarjetas

Las tarjetas muestran sus acciones al pasar el mouse, enfocar con teclado o abrir el menú. En móvil y con puntero táctil permanecen visibles. El menú ⋯ permite actualizar, ampliar, configurar, duplicar, mover (en edición) y eliminar una tarjeta, según tus permisos. Las modificaciones entran al borrador y se conservan con **Guardar cambios**; **Descartar** permite revertirlas. El icono de filtro muestra cuántos criterios propios tiene la tarjeta.

En **Ajustes → Fondo de la tarjeta** se elige un color independiente del gráfico. **Usar tema** restaura el fondo del tema claro/oscuro; el texto de una tarjeta con fondo personalizado se adapta para mantener contraste. La barra del dashboard utiliza controles compactos.


### Indicadores compactos

En **⋯ → Ajustes**, los indicadores permiten alturas **Micro (1 unidad)**, **Pequeña (2)** y **Reducida (3)**, además de las alturas anteriores. El mínimo anterior era 4 unidades. Los gráficos y las tablas conservan su mínimo de 4. En la misma ventana, **Tamaño del indicador (px)** permite elegir entre 16 y 128 px. La cifra se reduce automáticamente si no cabe; los indicadores más compactos muestran el detalle de cantidad de tareas en su etiqueta accesible y tooltip. El tamaño, la fuente y los filtros se conservan al guardar o duplicar.
