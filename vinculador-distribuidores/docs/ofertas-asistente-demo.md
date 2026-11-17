# Ofertas clasificadas y asistente — 16 de noviembre de 2026

## Estado y tareas

Carpeta del escritorio actualizada mediante fast-forward a origin/main `72520ee`.
Se integraron contactos, acceso como invitado, Google OAuth y las migraciones compartidas; el avance anterior de recomendaciones ya estaba integrado en main.
La rama de trabajo se conserva: `feat/recomendaciones-naturaleza-rubro`. Estos cambios nuevos todavía no se han confirmado ni subido.

| Tarea | Implementación |
| --- | --- |
| 3999 | Proveedores y socios publican con naturaleza y rubro propios. Cliente conserva publicación general. Validación e imagen opcional. |
| 4000 | Etiquetas y chips de clasificación enlazan a búsqueda. Filtros por oferta se combinan con texto y etiqueta y quedan en la URL. |
| 3998 | RPC `candidate_offers`: ofertas clasificadas, rubros activos, palabras clave y filtros combinados, con RLS y límite de 30. |
| 3996 | Tavily desde Edge Function, opción web explícita, hasta cinco resultados y manejo de fallos. |
| 3997 | Tarjetas externas con título, extracto, dominio y enlace original. Separadas de perfiles internos. |
| 4001 | Gemini desde Edge Function: resumen con identificadores O1/W1 y contexto acotado; claves solo en servidor. |
| 4006 | Guardado transaccional de post y etiquetas; reacción solo cambia al confirmarse; eliminación verifica resultado y conserva errores visibles. |
| 4007 | Guardas compartidas y pruebas de acceso directo; navegación oculta acciones a invitados; inicialización de sesión sin suscripciones duplicadas. Guion de demo abajo. |

**Pendiente de activación remota:** aplicar los dos SQL nuevos, configurar secretos y desplegar la Edge Function. Las pruebas locales no certifican las claves, cuotas ni el despliegue remoto.

## Decisiones funcionales

- `posts.nature` es `bien` o `servicio`; `posts.sector_id` referencia `sectors.id`. La clasificación de una oferta no modifica `provider_classifications`.
- Los posts históricos quedan sin clasificación. Siguen en el feed y búsquedas generales, pero no aparecen como ofertas clasificadas hasta que exista una oferta nueva clasificada. No se inventa su naturaleza a partir de la empresa.
- Los filtros de recomendaciones anteriores siguen usando **la empresa** y ahora lo dicen expresamente. El panel **Buscar por clasificación de la oferta** filtra los campos del post.
- La búsqueda de ofertas usa todas las palabras como subcadenas literales (sin expansión semántica ni normalización de acentos). Conviene escribir “cajas cartón”, no una conversación larga.
- La búsqueda web usa consulta, naturaleza y rubro como términos; no puede garantizar que la clasificación de una página externa sea correcta. Las fuentes se muestran sin presentarlas como proveedores verificados.
- El asistente consulta primero las ofertas internas. Gemini y Tavily se activan con casillas; ambas están apagadas inicialmente. Si no hay claves o un proveedor falla, las ofertas internas siguen disponibles.
- No se publican ofertas, cambian perfiles ni contacta proveedores mediante IA.
- Máximo 10 solicitudes externas por cuenta cada ventana fija de 10 minutos. El contador se controla en PostgreSQL, no en memoria de una instancia.
- El resumen puede contener errores: se muestra como generado por IA y las fuentes originales permanecen accesibles.
- Si se pierde la respuesta de una publicación, revisar Mi empresa antes de reintentar. La transacción puede haber finalizado. No hay una cola de reintentos automáticos.
- Las imágenes rechazadas por un error confirmado de base de datos se intentan limpiar; si la red falla y no se conoce el resultado, se conservan para no romper una publicación guardada.

## Instrucciones para el administrador

Proyecto: `kxdxkwtthzkmsebnuhbi`.

1. En SQL Editor, ejecutar en este orden:
   - `supabase/migrations/202611160001_offer_classification_assistant.sql`
   - `supabase/migrations/202611160002_offer_recommendation_cards.sql`

   Ambos son transaccionales y repetibles. No ejecutar de nuevo los dumps históricos ni usar `db reset` en la base compartida. La segunda migración amplía el JSON de tarjetas sin eliminar las dos variantes existentes de `recommend_posts`.

2. En Edge Functions → Secrets, configurar:
   - `TAVILY_API_KEY`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`: nombre exacto de un modelo disponible para esa cuenta.
   - `APP_ORIGINS`: orígenes permitidos separados por coma, sin ruta ni barra final. Para desarrollo: `http://127.0.0.1:3000,http://localhost:3000,http://localhost:5173`. Añadir el dominio HTTPS real al publicar.

   No usar prefijo `VITE_` para estas claves. No guardarlas en Git ni enviarlas al navegador. La función utiliza `SUPABASE_URL` y `SUPABASE_ANON_KEY` del entorno de Supabase; no necesita `service_role`.

3. Desde la carpeta `vinculador-distribuidores`, con una cuenta administradora autenticada en la CLI:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase functions deploy supplier-assistant --project-ref kxdxkwtthzkmsebnuhbi
   ```

   Enviar al administrador la carpeta `supabase/functions/supplier-assistant/` y `supabase/config.toml`, además de los dos SQL. La configuración apunta al archivo JavaScript `index.js`.
   `verify_jwt = false` desactiva únicamente la validación del gateway: el handler exige Bearer token, lo valida mediante `auth.getUser` y rechaza invitados antes de consultar APIs. Las consultas se hacen con el JWT del usuario y respetan RLS.

4. Activar el frontend actualizado después de aplicar SQL. Probar primero con búsqueda interna y después habilitar cada API. Sin SQL, las lecturas que incluyen la relación de rubro todavía no están disponibles.

Documentación utilizada: [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search), [Gemini generateContent](https://ai.google.dev/api/generate-content), [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [secretos de Edge Functions](https://supabase.com/docs/guides/functions/secrets).

## Pruebas y demo

Comandos locales:

```bash
pnpm test:offers
pnpm test:recommendations
pnpm test:classification
pnpm build
```

Las pruebas usan PostgreSQL local en memoria, el SDK real con transporte simulado, el handler real con respuestas de APIs simuladas y renderizado de componentes Vue/Vuetify. No insertan datos en Supabase.

Guion para la demo tras activar el backend:

1. Iniciar sesión como proveedor o socio. Publicar “Cajas de cartón para embalaje”, naturaleza Bienes, rubro Empaque y embalaje, etiqueta “cartón”. Confirmar su aparición en Mi empresa.
2. Publicar una oferta de Servicios con otro título y rubro activo. No usar la cuenta cliente para validar el formulario de proveedor.
3. Desde Descubre oportunidades, abrir el panel de clasificación de oferta. Combinar “cartón”, Bienes y Empaque. Abrir y quitar los chips. Recargar la URL y comprobar que se mantienen los filtros.
4. Elegir una combinación sin coincidencias y comprobar el mensaje. Las publicaciones históricas no se clasifican automáticamente.
5. Entrar al Asistente. Buscar “cartón” con opciones externas desactivadas: solo fuentes internas. Activar Tavily y luego Gemini; comprobar dominios originales y referencias O1/W1 del resumen.
6. Si una API no está configurada, comprobar el aviso y que los resultados internos sigan visibles. No confundir “sin resultados” con un error del servicio.
7. Con una cuenta distinta al autor, guardar una reacción, recargar y verificarla. Repetir/cambiar reacción; el botón no debe afirmar éxito cuando falla el guardado.
8. El autor elimina únicamente la publicación de demo con confirmación; desaparece al confirmar la base. Otro usuario no debe poder eliminarla.
9. Cerrar sesión y abrir `/publicar`, `/perfil` y `/asistente`: redirección al login. Como invitado, redirección al inicio; el feed, empresas y necesidades siguen accesibles.
10. Revisar en pantalla estrecha y escritorio; completar el flujo de perfil tras Google OAuth con la cuenta correspondiente.

No dar por cerrada la validación remota hasta completar estos pasos con SQL, claves y Edge Function desplegados.

## Verificación de esta entrega local

- 22 pruebas nuevas de ofertas, Edge Function, permisos, rutas y componentes aprobadas.
- Pruebas anteriores de clasificación y recomendaciones aprobadas después de actualizar el texto del filtro por empresa.
- Compilación de producción y revisión de formato Git correctas; ESLint pasó en los módulos, pantallas y pruebas revisados.
- Pantalla del asistente revisada en el navegador con la cuenta existente, incluidas navegación estrecha y opciones externas apagadas. La consulta real mostró correctamente que la RPC de ofertas aún no está habilitada.
- No se ejecutaron los SQL nuevos ni se desplegó la Edge Function en Supabase. Tavily/Gemini se comprobaron con respuestas simuladas, no con claves reales. No se crearon publicaciones de demo en la base compartida.
- Se usaron las dependencias ya instaladas para las pruebas y compilación. La sincronización de pnpm encontró una restricción de enlaces simbólicos de Windows; no se añadieron dependencias ni se modificó el lockfile. Antes de desplegar desde otro equipo, ejecutar pnpm install --frozen-lockfile normalmente.
- En móvil, Publicar y Mi empresa están en el menú de cuenta para que la barra inferior no se desborde.
