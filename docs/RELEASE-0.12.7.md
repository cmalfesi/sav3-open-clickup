# 0.12.7 — Sesiones, columnas y cards de tareas

Publicación autorizada por el usuario el 18 de noviembre de 2026.
Repositorio: `cmalfesi/sav3-open-clickup`, PR #24.

## Cambios

- Sesiones locales con cinco días desde la última actividad comunicada, renovables
  con uso real. Incluye cookie persistente, suspensión del equipo, reloj y reintento
  de respuestas perdidas. Sondeos y pestañas inactivas no renuevan el plazo.
- Anchos ajustables en Lista y Tabla, guardados por usuario, Lista y vista. Name
  comienza en 600 px; las demás columnas usan defaults según el tipo de dato.
  Arrastrar, teclado, reset y cancelación; los títulos largos no estiran la grilla.
- Cards de tareas ampliables/restaurables sin desmontar el editor; Escape restaura
  primero. Ajuste del scroll en pantallas pequeñas.
- Copiar vínculo/ID y abrir en otra pestaña; fallback manual de portapapeles.
  Los vínculos conservan su destino al pasar por el login y requieren autorización.
- Accesos a funciones existentes de campos, dependencias, recordatorios, duplicado,
  movimiento y plantillas, según permisos por recurso. Archivar/desarchivar y
  eliminar a papelera con confirmación. Movimiento profundo no ofrecido cuando
  el endpoint existente no soporta toda la jerarquía.
- Evaluación de las opciones de ClickUp y las funciones propuestas para otra etapa.

## Sesiones y carga de la nueva versión

El plazo es de cinco días de inactividad, no siete. Una sesión anterior de doce
horas que siga válida puede renovarse con la siguiente señal de actividad del
nuevo frontend. Una sesión que ya venció necesita un nuevo ingreso. Refrescar la
página carga el cliente actualizado; la publicación no borra ni revoca sesiones.
El servidor conserva el control del vencimiento y las revocaciones.

La identidad externa del propietario con ChatGPT y los tokens API/MCP mantienen
sus propias políticas. No hay migración de esquema, carga de respaldo, cambios
de permisos/audiencia, rotación de credenciales ni modificación masiva de datos.

## Validación

215 pruebas en 38 archivos; TypeScript, compilación de producción y Worker
compilado correctos. La CI del código funcional pasó antes de la autorización.
El paquete se genera desde el mismo código verificado y las notas de publicación.
El Worker comprueba login/renovación, permisos, vínculos, anchos y regresiones de
adjuntos, checklist y subtareas. Lint sin errores; quedan advertencias anteriores
de efectos/navegación en archivos existentes.

La prueba visual de menús, foco, mobile, touch y teclado en navegador continúa
pendiente: el preview administrado sirve HTML sin estilos ni cliente operativo.
Esta limitación ya se informó antes de la autorización de publicación.

El resultado del despliegue y su fuente exacta se registran en la versión guardada
de Sites. La versión 0.12.6 anterior se conserva como referencia de recuperación.

## Referencias

- [Sesiones](decisions/0026-five-day-idle-sessions.md)
- [Anchos personales](decisions/0027-personal-column-widths.md)
- [Acciones de cards](decisions/0028-task-card-actions.md)
- [Evaluación del menú](product/task-card-menu-evaluation.md)
