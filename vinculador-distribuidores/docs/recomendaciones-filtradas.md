# S3-02: recomendaciones por naturaleza y rubro

## Tareas implementadas

| OpenProject | Implementación |
| --- | --- |
| 3789 | Variante de `recommend_posts` con `p_nature` y `p_sector_id`. Ambos filtros son opcionales en la interfaz y se combinan con AND. |
| 3790 | La RPC devuelve clasificación, coincidencias y puntajes por etiqueta del usuario actual. |
| 3791 | `PostCard` muestra “Por qué aparece”, con naturaleza, rubro y etiquetas afines cuando corresponda. |
| 3792 | Mensaje específico cuando no hay coincidencias, acción para limpiar filtros y estado de error separado. |

## Decisiones de alcance

- Las publicaciones (`posts`) no tienen naturaleza ni rubro propios. Los filtros usan `provider_classifications` de su autor. Una empresa que ofrece `ambos` coincide con bienes o servicios; esto no clasifica individualmente cada publicación de esa empresa.
- El catálogo es `sectors`. El filtro solo ofrece rubros activos. No se deduce la clasificación a partir de etiquetas.
- Un autor sin clasificación puede aparecer sin filtros, pero no cumple un filtro de naturaleza o rubro. Los clientes normalmente no tienen clasificación: al explorar clientes, un filtro de clasificación puede dejar solo socios o ningún resultado.
- Se conserva el filtro de rol (incluidos socios), la exclusión de publicaciones propias, las reacciones “No me interesa”, el umbral de afinidad y el orden aleatorio existentes.
- La afinidad sigue siendo `sum(score * abs(score)) / sum(abs(score))`, con cero cuando no hay puntajes. Solo se leen los puntajes del usuario de la sesión.
- No se filtra después de recibir la ventana: PostgreSQL filtra antes del límite, para no perder coincidencias fuera de las primeras nueve publicaciones.
- Los controles aparecen en Recomendaciones, cuando no hay búsqueda por texto o etiquetas. La búsqueda manual de publicaciones y el listado de necesidades conservan su funcionamiento independiente.
- Los filtros permanecen durante la sesión al navegar o cambiar el rol explorado. Cambiar de cuenta los limpia. No se guardan como preferencias permanentes ni en la URL.

## Activación en Supabase

En la base existente, el administrador debe ejecutar **solo**:

`supabase/migrations/202611030001_recommend_posts_filters.sql`

La migración es transaccional y repetible. No cambia tablas ni datos de usuarios. Crea una variante de seis argumentos, con `p_nature` y `p_sector_id` obligatorios en la llamada (pueden ser `null`). Conserva la variante antigua de cuatro argumentos para no romper clientes anteriores y recarga la caché de PostgREST.

La nueva función usa `SECURITY INVOKER`, respeta RLS, exige sesión y solo concede ejecución a `authenticated` y `service_role`. No solicita claves administrativas en el navegador.

No ejecutar de nuevo `202610190001_classification_needs.sql` en la base que ya contiene estas tablas. Ese archivo se recuperó del respaldo local porque faltaba en `main` y las pruebas de clasificación lo necesitan. Tampoco ejecutar el volcado completo de la rama `Migrations` sobre una base ya poblada: el equipo debe reconciliar ese historial antes de usar un flujo automático de migraciones.

### Antes de activar el SQL

El feed sin filtros puede seguir usando la RPC anterior. Al elegir naturaleza o rubro se informa que la función aún no está habilitada: nunca se ignoran silenciosamente los filtros ni se confunde ese error con “sin coincidencias”.

### Después de activar el SQL

1. Iniciar sesión y abrir Recomendaciones sin texto ni etiquetas de búsqueda.
2. Elegir naturaleza y rubro. Verificar que todas las tarjetas correspondan a empresas con esa clasificación; `ambos` cumple bienes o servicios.
3. Revisar “Por qué aparece” y el desglose de afinidad existente.
4. Cambiar de filtro mientras carga y desplazarse entre tarjetas: no deben reaparecer resultados del filtro anterior.
5. Probar una combinación sin publicaciones elegibles y usar “Limpiar filtros”.
6. Confirmar que publicaciones propias o marcadas “No me interesa” no aparecen.

## Validación local

```sh
pnpm test:recommendations
pnpm test:classification
pnpm build
```

Las pruebas nuevas ejecutan SQL en PostgreSQL local mediante PGlite, verifican las peticiones del SDK y renderizan componentes Vue/Vuetify. Cubren filtros independientes/combinados, `ambos`, rubros inactivos, resultados vacíos, exclusiones, roles, afinidad, RLS, permisos, compatibilidad con la RPC anterior, cancelación y respuestas tardías.

`tests/fixtures/recommendations-schema.sql` contiene un extracto de la rama `Migrations` en `35bcd8756d2a0a7ccf58046206269af7ac13dbee`, archivo `20261102231428_remote_schema.sql`, utilizado solo en pruebas. No es un instalador de la base.

El renderizado automatizado no sustituye la revisión visual en navegador ni la validación de la RPC en el proyecto remoto después de que el administrador aplique el SQL.

Resultado de esta entrega: 18 pruebas de recomendaciones y 20 de clasificación/necesidades aprobadas; lint de los módulos nuevos y modificados de recomendaciones aprobado; compilación de producción correcta. La consulta remota de la nueva firma devolvió `PGRST202`: su activación sigue pendiente. La inspección visual en Opera fue bloqueada por la herramienta al no poder determinar la URL de forma fiable; no se completó esa revisión.
