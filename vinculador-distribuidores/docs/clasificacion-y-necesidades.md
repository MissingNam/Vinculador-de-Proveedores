# Clasificación del proveedor y necesidades estructuradas

Implementación de HU-C3′ (3494) y HU-C4′ (3495), basada en los títulos de OpenProject. No se proporcionaron criterios de aceptación; las decisiones siguientes son propuestas de implementación, sujetas a revisión del equipo.

## Alcance por tarea

| Tarea | Implementación |
| --- | --- |
| 3498 — Taxonomía de rubro | Catálogo compartido `sectors` con diez rubros iniciales y opción de desactivarlos. |
| 3499 — Campos de clasificación en perfil | Una clasificación por proveedor/socio: naturaleza y rubro principal. Relación uno a uno `provider_classifications` con el perfil existente. |
| 3500 — Formulario de clasificación | Sección editable en Mi perfil; selección de naturaleza y rubro del catálogo. |
| 3501 — Guardado y lectura | Persistencia en Supabase, lectura en el perfil propio y el de otros usuarios; control de autor y de versiones. |
| 3502 — Migración: entidad necesidad | Tabla `needs`, restricciones, índices, estados y permisos incluidos en la migración. |
| 3503 — Formulario adaptativo bien/servicio | Cantidad/unidad/entrega para bienes; modalidad/alcance/fechas para servicios. |
| 3504 — Selector de rubro | El formulario y los filtros usan el catálogo compartido. |
| 3505 — Editar y cerrar necesidad | Solo el autor, mientras esté abierta; confirmación antes de cerrar; historial de cerradas. |
| 3506 — Datos de prueba clasificados | Ejemplos sintéticos de bienes y servicios, usados en pruebas locales, y comando opcional para cargarlos en un proyecto de desarrollo. |

## Decisiones propuestas

- **Naturaleza del proveedor:** bienes, servicios o ambos. Solo proveedores y socios tienen esta sección; un cliente puede registrar necesidades sin clasificarse como proveedor.
- **Rubro:** uno principal por perfil y uno por necesidad. Catálogo inicial plano: alimentos, construcción, empaque, industria, mantenimiento, tecnología, transporte, servicios profesionales, salud y otros. No se presenta como una clasificación oficial ni como un catálogo aprobado por el equipo.
- **Etiquetas:** se conservan como búsqueda libre; no se convierten automáticamente en rubros.
- **Necesidades:** entidad independiente de las publicaciones. Todos los roles autenticados pueden solicitar bienes o servicios. No se modifican el algoritmo de recomendaciones ni las reacciones a publicaciones.
- **Ubicación:** país, estado/región y ciudad obligatorios, sin domicilio exacto ni geolocalización. En un servicio remoto corresponde a la ubicación del solicitante.
- **Presupuesto:** rango total, mínimo mayor o igual a cero y máximo positivo, hasta dos decimales; monedas MXN y USD. No es precio unitario ni compromiso de contratación.
- **Bienes:** cantidad positiva con hasta tres decimales, unidad de texto y fecha deseada de entrega opcional.
- **Servicios:** presencial, remoto o híbrido; alcance obligatorio; fechas opcionales. Si hay fecha final, debe haber inicio y ser igual o posterior. Se permiten fechas pasadas para mantener registros históricos editables.
- **Cierre:** definitivo en esta versión. La necesidad desaparece del listado abierto, sigue disponible para su autor en Mis necesidades y no puede editarse ni reabrirse. No hay borrado desde la app.
- **Seguridad:** lectura con sesión iniciada; solo el autor inserta/edita sus registros. RLS y permisos por columna en Supabase. Los rubros se administran desde la base, no desde el formulario. Un rubro desactivado se conserva para mostrar registros anteriores.
- **Edición simultánea:** los guardados incluyen la fecha de la versión leída; una ventana antigua no sobrescribe cambios más recientes.

## Activación en Supabase

La clave publicable del navegador no puede crear tablas. Una persona con acceso administrativo al proyecto debe ejecutar **una vez**, en **SQL Editor**, el contenido completo de:

`supabase/migrations/202610190001_classification_needs.sql`

La migración agrega `sectors`, `provider_classifications` y `needs` con sus reglas, sin alterar datos ni políticas de perfiles y publicaciones existentes. Se ejecuta en una transacción. Si ya existen tablas con esos nombres, revisar su estructura antes de continuar; no borrarlas para forzar la instalación. No enviar contraseñas de la base ni claves `service_role` al chat o al repositorio.

Después de que SQL Editor confirme el éxito, instalar dependencias con `pnpm install --frozen-lockfile` e iniciar con `pnpm dev` desde esta carpeta. Hasta activar la migración, las pantallas nuevas muestran un mensaje de función no habilitada; las búsquedas existentes no dependen de las tablas nuevas.

## Uso

1. Como proveedor o socio, abrir Mi perfil → Clasificación del proveedor → Completar clasificación. Guardar, recargar y verificar también desde otra cuenta.
2. Abrir Necesidades desde el icono del portapapeles o elegir Necesidades en el buscador.
3. Elegir Nueva necesidad y completar los campos. Los campos específicos cambian al elegir bienes o servicios.
4. Usar los filtros de texto, naturaleza y rubro. Mis necesidades permite filtrar también abiertas/cerradas. Los filtros quedan en la URL.
5. Abrir una necesidad propia para editarla o cerrarla. Las cuentas ajenas solo ven el detalle de las abiertas.

## Pruebas

`pnpm run test:classification` ejecuta pruebas sin credenciales ni acceso a la base compartida:

- Validación y transformación de formularios; eliminación de campos del tipo anterior al cambiar naturaleza.
- Migración real en PostgreSQL local con PGlite: lectura/escritura, restricciones, rubros inactivos, versiones, cierre y acceso entre usuarios y roles.
- Serialización de peticiones mediante el SDK real de Supabase con respuestas simuladas, incluidos filtros, paginación y conflictos.
- Renderizado de componentes Vue/Vuetify para los dos formularios y regresión de la tarjeta de perfil.

Estas pruebas no sustituyen aplicar la migración y comprobar el flujo completo en el proyecto Supabase. El renderizado automático no es una revisión visual en navegador. `pnpm run build` comprueba la compilación.

Las pruebas anteriores `pnpm run test:search` siguen dependiendo del conjunto compartido: necesitan perfiles sin publicaciones. También detectaron etiquetas existentes con espacios en sus extremos; estos pendientes son anteriores a esta implementación.

## Datos de prueba opcionales

`tests/fixtures/classified-needs.js` contiene dos ejemplos sintéticos completos. Las pruebas de base los guardan en una base efímera que se elimina al terminar. Para verlos en la app, después de activar la migración, usar una cuenta de pruebas en un proyecto de desarrollo:

```powershell
$env:ALLOW_TEST_DATA = 'yes'
$env:SEARCH_TEST_EMAIL = 'correo-de-tu-cuenta-de-pruebas'
$env:SEARCH_TEST_PASSWORD = 'contraseña-de-tu-cuenta-de-pruebas'
pnpm run seed:needs
Remove-Item Env:ALLOW_TEST_DATA,Env:SEARCH_TEST_EMAIL,Env:SEARCH_TEST_PASSWORD
```

El comando crea dos necesidades marcadas `[PRUEBA]`, con el autor autenticado. Si ya existen títulos iguales para ese autor, no los duplica. No cambia clasificaciones existentes ni inserta datos en cuentas ajenas. No se ejecuta automáticamente ni durante las pruebas. Las necesidades de ejemplo se pueden cerrar desde la app.

## Comprobación manual después de activar

- Guardar clasificación, recargar y verla desde otro usuario.
- Crear una necesidad de cada naturaleza; comprobar rubro, ubicación, presupuesto y campos específicos tras recargar.
- Editar una necesidad y cambiar su naturaleza; comprobar que no quedan campos de la naturaleza anterior.
- Abrir el mismo registro en dos ventanas: guardar en una y verificar el aviso de conflicto en la otra.
- Intentar editar una necesidad ajena mediante su URL: debe impedirlo.
- Cerrar una necesidad propia: desaparece del listado abierto, aparece en Mis necesidades → Cerradas y ya no ofrece edición.
- Comprobar escritorio y móvil, navegación atrás/adelante y búsquedas de publicaciones/perfiles.

Referencias técnicas: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y [API de PGlite](https://pglite.dev/docs/api).
