# Menú de tareas: evaluación y alcance

Fecha: 18 de noviembre de 2026. Rama: `feat/session-idle-5-days`, PR #24.
Versión propuesta: 0.12.7. Producción no modificada.

La referencia aportada corresponde a la ventana de una tarea, no a una tarjeta
de métricas del dashboard. Se revisaron la documentación oficial de ClickUp y
los componentes, servicios y permisos reales de este fork.

| Opción de ClickUp | Estado comprobado en SAV3 | Decisión |
| --- | --- | --- |
| Ampliar/restaurar | El botón no tenía handler. | Implementado: alterna modal y área completa sin desmontar el editor. Escape restaura primero. |
| Copiar vínculo | Existía la navegación `?task=`, pero no la acción en la card. | Implementado para tarea o subtarea con su Lista real. |
| Copiar ID | No estaba en el menú. | Implementado junto a copiar vínculo. |
| Nueva pestaña | No estaba en el menú. | Implementado como enlace nativo. |
| Favorito | Los favoritos actuales son de Listas, no de tareas. | Recomendada siguiente etapa: favoritos personales de tareas con acceso desde la barra lateral. No guardar como preferencia compartida. |
| Seguir/dejar de seguir | Existe edición de Watchers en la card. No hay operación personal separada en el menú. | Recomendada: endpoint idempotente que agregue/quite sólo al usuario actual, sin reemplazar seguidores ajenos. |
| Recordármelo | Ya existían formulario, persistencia e Inbox/scheduler. | Agregado acceso desde el menú al formulario existente. La entrega automática sigue dependiendo del scheduler y requiere comprobación operativa. |
| Mover a | Endpoint y menú ya existían. | Se conserva para raíces y destinos editables. No se ofrece mover una subtarea sola ni un árbol de más de dos niveles: el endpoint actual sólo migra hijos directos. |
| Agregar a otras Listas | El modelo usa una Lista principal por tarea. | Etapa posterior: relación muchos-a-muchos, reglas de permisos, estados, búsqueda y conteos. No simularla duplicando tareas. |
| Combinar | No hay servicio de merge. | Postergar: requiere previsualización y reglas para comentarios, adjuntos, campos, historia y recuperación. |
| Duplicar | Ya estaba implementado. | Se conserva con permisos. La copia actual no incluye comentarios, adjuntos ni el árbol de subtareas. No se declara paridad total. |
| Convertir en | Se crean subtareas, pero no existe conversión de tareas existentes en Lista/subtarea. | Etapa posterior: validación de ciclos, descendientes y permisos. |
| Campos personalizados | El administrador y los controles ya funcionan. | Accesos nuevos para ver la sección y administrar campos cuando corresponde. |
| Plantillas | Guardar y aplicar ya existen; la administración está restringida en el servidor. | Se conserva guardar desde la card sólo para administradores con edición. Aplicación desde el selector existente de la Lista. |
| Relaciones | Existen dependencias; no relaciones arbitrarias completas. | Acceso desde menú a las dependencias actuales. No rotularlas como relaciones genéricas. |
| Historial de descripción | La actividad conserva cambios recientes con antes/después, pero no hay historial dedicado con restauración. | Recomendada etapa siguiente: revisiones durables, paginación y restauración con control de concurrencia. |
| Tipo de tarea | Se representa con un campo personalizado importado en las Listas que lo tienen. | Se sigue editando en Campos personalizados. Un sistema de tipos nativos requiere diseño y migración; no agregar nombres sin respaldo. |
| Sincronizar fechas con subtareas | Hay fechas editables y Gantt; no sincronización automática equivalente. | Postergar hasta definir desplazamientos, excepciones y conflictos con edición manual. |
| Imprimir | No hay formato específico de impresión de una tarea. | Útil en una etapa posterior. Requiere vista imprimible; no imprimir toda la aplicación por error. |
| Enviar correo a tarea | El correo saliente no provee una dirección entrante por tarea ni procesamiento de respuestas. | Postergar. Requiere recepción, autenticación del remitente y manejo de adjuntos; configurar Resend saliente no basta. |
| Archivar | Ya existe el atributo y la mutación; no estaba en este menú. | Acceso agregado con confirmación; permite desarchivar una tarea accesible por enlace. |
| Eliminar | Ya existe papelera y restauración administrativa. | Acceso agregado con confirmación y validación de permisos de todo el árbol. |
| Compartir y permisos | El administrador gestiona ACL por recursos en Settings. | Copiar vínculo agregado. Editor contextual de permisos recomendado aparte; compartir el enlace no concede acceso. |

## Qué entrega esta implementación

La expansión cambia sólo el contenedor: conserva la instancia del editor, sus
borradores y la tarea abierta. No utiliza la API de fullscreen del navegador.
En móvil el contenido principal y los detalles usan scroll vertical conjunto;
en escritorio conservan sus áreas de scroll.

El vínculo contiene sólo `/l/<listId>?task=<taskId>`, sin filtros, tokens o hash
de la URL actual. Si el navegador no permite escribir al portapapeles, aparece
un diálogo con el texto seleccionable. El aviso de éxito se muestra únicamente
cuando la escritura termina correctamente.

La redirección al login conserva el destino. Login por contraseña y el acceso
del propietario con ChatGPT vuelven a esa ruta, validada para impedir destinos
externos o rutas de autenticación. El Worker sigue autenticando y autorizando
cada petición: un vínculo no convierte una tarea privada en pública.

Las capacidades del menú se calculan en el servidor por tarea, Lista y árbol de
descendientes. Los lectores conservan copiar/abrir/consultar; los comandos de
modificación requieren los permisos correspondientes. Los destinos de movimiento
también se filtran por edición. No se cambian ACL ni audiencias.

## Prioridad propuesta para una próxima etapa

1. Favoritos personales de tareas y seguir/dejar de seguir por usuario.
2. Historial durable de descripciones con restauración.
3. Compartir/permisos contextual, reutilizando el modelo de acceso existente.
4. Impresión específica y movimiento completo de jerarquías profundas.
5. Tipos nativos, múltiples Listas, conversiones y merge, según uso real.
6. Correo entrante y sincronización de fechas sólo después de definir sus reglas.

Estas opciones se evaluaron; no se presentan como implementadas.

## Fuentes oficiales

- https://help.clickup.com/hc/en-us/articles/34908401465111-Task-settings-menu
- https://help.clickup.com/hc/en-us/articles/29665520762647-Task-layouts
- https://help.clickup.com/hc/en-us/articles/6309805229463-Find-a-task-URL

## Verificación

Pruebas de enlaces y retorno seguro; portapapeles permitido/denegado/no disponible;
control de expansión; política de capacidades; integración D1 de detalle por
permisos y Worker compilado para redirección y denegación de tareas privadas.
El preview administrado volvió a servir el login sin estilos. Quedan pendientes
las pruebas visuales reales de los menús, foco, móvil y teclado en navegador.
