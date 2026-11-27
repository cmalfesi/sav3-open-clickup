# 0.12.9 — Etiquetas compactas en las tareas

Corrección visual solicitada el 27 de noviembre de 2026 a partir de la captura de
ClickUp original. La publicación está incluida en el pedido de corregir el sitio.

- Las etiquetas mantienen una sola línea y 16 px de alto; los nombres largos usan
  puntos suspensivos y conservan el nombre completo al pasar el mouse.
- Lista muestra hasta dos etiquetas y un contador exacto +N para las restantes.
  El resumen se adapta al ancho de Name sin aumentar la altura de la fila.
- Un clic, Enter o Espacio abre un popover con todos los nombres completos.
  Escape cierra y devuelve el foco. El clic no abre accidentalmente la tarea.
- Las etiquetas importadas con el gris genérico #656f7d reciben colores de
  presentación estables por nombre. Los colores hex específicos se conservan;
  el texto usa blanco o negro según contraste. La misma apariencia se reutiliza
  en Board y en el selector de etiquetas para evitar inconsistencias.

No cambia los datos de las etiquetas, asociaciones a tareas, filtros, permisos
ni sesiones. No agrega dependencias, endpoints o migraciones. El popover es de
consulta; la edición existente sigue disponible dentro de la tarea.

## Validación

230 pruebas en 39 archivos, TypeScript y build de producción correctos; lint
sin errores, con advertencia anterior en el efecto de Lista. El Worker compilado
se comprueba antes de publicar y la CI de GitHub verifica el conjunto completo.

Se probó en navegador el componente real ListView con datos ficticios y el CSS
compilado, servido como fixture local aislada: Name de 600 y 240 px, contenedor
estrecho de 360 px, temas claro/oscuro, apertura por clic y Enter, Escape y retorno
de foco, listado completo de cinco etiquetas y ausencia de apertura de tarea.
Las filas conservaron 41 px de alto y los chips 16 px en ambos anchos. La fixture
no se incorpora al proyecto publicado. No equivale a probar un teléfono físico
ni una sesión real de Oportunidades; esas verificaciones permanecen pendientes.

Referencia: [ADR 0030](decisions/0030-compact-task-tags.md).
