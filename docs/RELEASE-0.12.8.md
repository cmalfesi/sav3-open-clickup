# 0.12.8 — Usuarios editables y asignaciones sin acceso

Estado: publicación a producción autorizada por el usuario el 27 de noviembre de 2026.
La versión guardada de Sites registra el resultado del despliegue y su fuente exacta.

## Uso

En Configuración → Usuarios:

- Editar usuario permite cambiar “Nombre y apellido” y el rol global de cuentas
  activas o sin acceso. Se conservan el email, la identidad y las asignaciones.
- Agregar una persona → Sin acceso (solo asignaciones) crea un miembro visible
  para repartir trabajo. No envía emails ni crea contraseñas o sesiones.
- La alternativa Enviar invitación mantiene el circuito de activación existente
  y permite asignar trabajo antes de que la persona ingrese por primera vez.
- Una referencia del respaldo se incorpora al equipo sin acceso al guardar desde
  Editar usuario, conservando su ID. Una invitación posterior usa el mismo ID.
- El propietario puede designar administradores. Miembro e Invitado conservan
  sus permisos actuales; los permisos propios y del propietario están protegidos.

Los miembros sin acceso aparecen en los selectores de tareas/subtareas,
asignación masiva, checklist y reglas de asignación. Los selectores de responsables
y de edición masiva los identifican como “Sin acceso”. Recibir trabajo no concede
lectura de esa tarea, login ni notificaciones. Al activarse, la persona verá solo
los recursos autorizados. No se crean nuevas clases de elementos asignables.

Cambiar nombre o rol no cierra sesiones activas. Revocar acceso sí las invalida.
Modificar permisos de una invitación pendiente revoca ese enlace: debe crearse
una nueva invitación para activar la cuenta con la política actual. Editar solo
el nombre o guardar sin cambios conserva el enlace.

## Datos y publicación posterior

Migración 0013, solo de datos: incorpora invitaciones antiguas todavía válidas al
directorio, sin habilitar cuentas ni reemplazar membresías existentes. No elimina
usuarios/tareas ni modifica contraseñas. No agrega dependencias ni nuevas tablas.
El usuario autorizó aplicar esta migración al publicar esta versión.
El código de la rama no implica que los cambios estén activos en el sitio.

## Validación

224 pruebas en 38 archivos, TypeScript, build de producción y pruebas del Worker
compilado correctos. Las pruebas aisladas recorren edición de perfil/rol, altas
sin acceso, directorio, asignación real a tarea/checklist y rechazo del login de
usuarios deshabilitados. Se mantienen las regresiones de sesiones, permisos,
adjuntos, links, columnas y subtareas. Lint sin errores, con una advertencia
preexistente de efectos en Configuración.

QA visual, móvil, touch y teclado pendiente: el preview administrado sigue
mostrando HTML de login sin estilos. No se usaron usuarios reales ni se enviaron
invitaciones reales para probar.

Ver [ADR 0029](decisions/0029-user-profiles-and-inactive-assignment.md).
