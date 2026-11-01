// Datos de prueba para Sun Finder: 12 proveedores, 4 clientes, 2 socios, 36 posts y calificaciones.
// Uso (desde la raíz del proyecto):
//   node --env-file=../.env scripts/seed.mjs --dry-run   # solo muestra el plan, sin tocar la base
//   node --env-file=../.env scripts/seed.mjs             # ejecuta de verdad (se puede repetir sin duplicar)
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry-run')
const env = name => process.env[name]?.trim()
const EMAIL_USER = DRY ? env('SEED_EMAIL_USER') || 'demo' : env('SEED_EMAIL_USER')
const PASSWORD = env('SEED_PASSWORD')

// ---------- Datos ----------
const TRANSVERSAL_TEXT = {
  mayoreo: 'Precios especiales por volumen.',
  personalizado: 'Adaptamos el producto o servicio a tu medida.',
  'entrega-rapida': 'Entrega en 48 horas.',
  ecologico: 'Procesos y materiales de bajo impacto ambiental.',
  local: 'Trabajamos con proveedores locales de la región.',
  nacional: 'Cobertura en todo el país.',
}

// Cada combinación mezcla 2-3 etiquetas transversales; se reparten cíclicamente entre los 36 posts
const COMBOS = [
  ['mayoreo', 'ecologico'], ['local', 'ecologico'], ['mayoreo', 'local', 'personalizado'],
  ['nacional', 'entrega-rapida'], ['entrega-rapida', 'personalizado'], ['nacional', 'personalizado', 'entrega-rapida'],
  ['mayoreo', 'nacional'], ['ecologico', 'entrega-rapida'], ['local', 'personalizado'],
  ['personalizado', 'nacional'], ['mayoreo', 'ecologico', 'local'], ['entrega-rapida', 'local', 'personalizado'],
]

// [etiqueta de subcategoría, título, descripción]
const SECTORS = {
  alimentos: { nature: 'bien', subs: [
    ['panaderia', 'Panadería y repostería industrial', 'Pan, pasteles y masas congeladas para restaurantes, cafeterías y tiendas.'],
    ['lacteos', 'Lácteos y derivados', 'Leche, quesos y yogur con cadena de frío garantizada.'],
    ['bebidas', 'Bebidas y jugos embotellados', 'Jugos, aguas saborizadas y bebidas para distribución en comercios.'],
  ] },
  construccion: { nature: 'bien', subs: [
    ['cemento', 'Cemento y concreto premezclado', 'Cemento, mortero y concreto para obra con entrega programada.'],
    ['herreria', 'Herrería y estructuras metálicas', 'Puertas, rejas y estructuras de acero fabricadas a medida.'],
    ['acabados', 'Acabados y recubrimientos', 'Pisos, azulejos y pintura para obra nueva y remodelación.'],
  ] },
  empaque: { nature: 'bien', subs: [
    ['cajas', 'Cajas de cartón corrugado', 'Cajas y separadores en distintos gramajes para envío y almacenaje.'],
    ['plastico', 'Envases y bolsas de plástico', 'Bolsas, frascos y películas para empaque de producto.'],
    ['etiquetas', 'Etiquetas y adhesivos', 'Etiquetas impresas, rollos y cintas para identificación de producto.'],
  ] },
  tecnologia: { nature: 'ambos', subs: [
    ['software', 'Desarrollo de software a medida', 'Aplicaciones web y sistemas de gestión para empresas.'],
    ['hardware', 'Equipo de cómputo y redes', 'Servidores, laptops y equipo de red para oficinas.'],
    ['soporte-ti', 'Soporte técnico y mesa de ayuda', 'Mantenimiento de infraestructura y atención a usuarios.'],
  ] },
  transporte: { nature: 'servicio', subs: [
    ['paqueteria', 'Paquetería y mensajería', 'Envíos de paquetes con rastreo y recolección programada.'],
    ['carga-pesada', 'Transporte de carga pesada', 'Traslado de mercancía en tráileres y plataformas.'],
    ['almacenaje', 'Almacenaje y distribución', 'Bodegas, inventario y distribución de última milla.'],
  ] },
  salud: { nature: 'bien', subs: [
    ['limpieza', 'Productos de limpieza e higiene', 'Desinfectantes, jabones y artículos de higiene institucional.'],
    ['equipo-medico', 'Equipo e instrumental médico', 'Material y equipo para consultorios, clínicas y laboratorios.'],
    ['desechables', 'Desechables y material de protección', 'Guantes, cubrebocas y material desechable para uso clínico.'],
  ] },
}

const PROVIDER_NAMES = [
  ['alimentos', 'Yesterday'], ['alimentos', 'Blackbird'],
  ['construccion', 'Thunderstruck'], ['construccion', 'Wonderwall'],
  ['empaque', 'Hallelujah'], ['empaque', 'Fireflies'],
  ['tecnologia', 'Radioactive'], ['tecnologia', 'Starman'],
  ['transporte', 'Highwaystar'], ['transporte', 'Runaway'],
  ['salud', 'Sunflower'], ['salud', 'Lifeonmars'],
]
const CLIENT_NAMES = ['Hotelcalifornia', 'Bohemian', 'Jolene', 'Paranoid']
const PARTNER_NAMES = ['Imagine', 'Hurt']

// Gustos de los dos clientes que califican (el resto queda sin historial para probar el feed "en frío")
const TASTES = {
  cli01: { positive: ['mayoreo', 'local', 'ecologico'], negative: ['nacional', 'entrega-rapida'], likeSub: ['panaderia'], dislikeSub: ['paqueteria'] },
  cli02: { positive: ['nacional', 'entrega-rapida'], negative: ['mayoreo', 'local', 'ecologico'], likeSub: ['paqueteria'], dislikeSub: ['panaderia'] },
}
const MAX_PER_SIGN = 8

// ---------- Plan (puro: no toca la red) ----------
const pad = n => String(n).padStart(2, '0')
const email = key => `${EMAIL_USER}+${key}@gmail.com`

function buildPlan() {
  const providers = PROVIDER_NAMES.map(([sector, name], i) => ({ key: `prov${pad(i + 1)}`, role: 'proveedor', name, sector }))
  const clients = CLIENT_NAMES.map((name, i) => ({ key: `cli${pad(i + 1)}`, role: 'cliente', name }))
  const partners = PARTNER_NAMES.map((name, i) => ({ key: `soc${pad(i + 1)}`, role: 'socio', name }))

  const posts = providers.flatMap((provider, p) => SECTORS[provider.sector].subs.map(([sub, title, text], j) => {
    const transversals = COMBOS[(p * 3 + j) % COMBOS.length]
    return {
      key: `${provider.key}|${j}`, providerKey: provider.key, title, sub, transversals,
      description: `${text} ${transversals.map(t => TRANSVERSAL_TEXT[t]).join(' ')}`,
      tags: [...transversals, sub],
    }
  }))

  const reactions = {}
  for (const [clientKey, taste] of Object.entries(TASTES)) {
    const used = new Set()
    const rows = []
    const add = (post, interested) => {
      if (used.has(post.key)) return
      used.add(post.key)
      rows.push({ postKey: post.key, interested })
    }
    const hits = (post, set) => post.transversals.some(t => set.includes(t))
    const pick = (set, other) => posts
      .filter(post => !used.has(post.key) && hits(post, set) && !hits(post, other))
      .filter((_, n) => n % 2 === 0)   // salta de dos en dos para repartir entre categorías
      .slice(0, MAX_PER_SIGN)

    posts.filter(post => taste.likeSub.includes(post.sub)).forEach(post => add(post, true))
    posts.filter(post => taste.dislikeSub.includes(post.sub)).forEach(post => add(post, false))
    pick(taste.positive, taste.negative).forEach(post => add(post, true))
    pick(taste.negative, taste.positive).forEach(post => add(post, false))
    reactions[clientKey] = rows
  }
  return { providers, clients, partners, posts, reactions }
}

function projectedScores(plan, clientKey) {
  const byKey = new Map(plan.posts.map(post => [post.key, post]))
  const scores = {}
  for (const { postKey, interested } of plan.reactions[clientKey]) {
    for (const tag of byKey.get(postKey).tags) scores[tag] = (scores[tag] ?? 0) + (interested ? 1 : -1)
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1])
}

function printPlan(plan) {
  console.log(`Plan: ${plan.providers.length} proveedores, ${plan.clients.length} clientes, ${plan.partners.length} socios, ${plan.posts.length} posts`)
  for (const key of Object.keys(plan.reactions)) {
    const rows = plan.reactions[key]
    const likes = rows.filter(r => r.interested).length
    console.log(`\n${key}: ${likes} "me interesa" y ${rows.length - likes} "no me interesa". Puntajes esperados:`)
    console.log(projectedScores(plan, key).map(([tag, score]) => `${tag} ${score > 0 ? '+' : ''}${score}`).join(', '))
  }
}

// ---------- Ejecución real ----------
const check = ({ error }, where) => { if (error) throw new Error(`${where}: ${error.message}`) }

async function main() {
  const plan = buildPlan()
  if (DRY) { printPlan(plan); return }

  const url = env('SUPABASE_URL')
  const secret = env('SUPABASE_SECRET_KEY')
  if (!url || !secret || !EMAIL_USER || !PASSWORD) {
    throw new Error('Faltan variables en el .env: SUPABASE_URL, SUPABASE_SECRET_KEY, SEED_EMAIL_USER, SEED_PASSWORD')
  }
  if (PASSWORD.length < 6) throw new Error('SEED_PASSWORD debe tener al menos 6 caracteres')

  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  console.log(`Proyecto: ${new URL(url).host}`)

  // Rubros: deben existir y estar activos
  const sectorIds = [...new Set(plan.providers.map(p => p.sector))]
  const { data: sectors, error: sectorError } = await db.from('sectors').select('id, name, active').in('id', sectorIds)
  check({ error: sectorError }, 'leer sectors')
  const sectorName = Object.fromEntries((sectors ?? []).filter(s => s.active).map(s => [s.id, s.name]))
  const missing = sectorIds.filter(id => !sectorName[id])
  if (missing.length > 0) throw new Error(`Rubros inexistentes o inactivos: ${missing.join(', ')}`)

  // Usuarios (auth) + perfiles
  async function findUser(address) {
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
      check({ error }, 'listar usuarios')
      const found = data.users.find(u => u.email?.toLowerCase() === address.toLowerCase())
      if (found || data.users.length < 200) return found
    }
  }
  async function ensureUser(account) {
    const address = email(account.key)
    const { data, error } = await db.auth.admin.createUser({
      email: address, password: PASSWORD, email_confirm: true, user_metadata: { full_name: account.name },
    })
    if (!error) return data.user.id
    const existing = await findUser(address)
    if (!existing) throw new Error(`crear ${address}: ${error.message}`)
    check(await db.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true }), `actualizar ${address}`)
    return existing.id
  }

  const accounts = [...plan.providers, ...plan.clients, ...plan.partners]
  const ids = {}
  for (const account of accounts) {
    ids[account.key] = await ensureUser(account)
    const bio = account.role === 'proveedor'
      ? `${account.name}: empresa especializada en ${sectorName[account.sector].toLowerCase()}.`
      : account.role === 'cliente' ? 'Empresa que busca proveedores confiables.' : 'Empresa que compra y vende; actúa como intermediario.'
    check(await db.from('profiles').upsert({ id: ids[account.key], full_name: account.name, role: account.role, bio }, { onConflict: 'id' }), `perfil ${account.key}`)
  }
  for (const provider of plan.providers) {
    check(await db.from('provider_classifications').upsert({
      profile_id: ids[provider.key], nature: SECTORS[provider.sector].nature, sector_id: provider.sector, updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' }), `clasificación ${provider.key}`)
  }
  console.log(`Cuentas listas: ${accounts.length}`)

  // Etiquetas
  const tagNames = [...new Set(plan.posts.flatMap(post => post.tags))]
  const { data: tags, error: tagError } = await db.from('tags').upsert(tagNames.map(name => ({ name })), { onConflict: 'name' }).select('id, name')
  check({ error: tagError }, 'etiquetas')
  const tagId = Object.fromEntries(tags.map(t => [t.name, t.id]))

  // Posts (se omiten los que ya existen: mismo autor y título)
  const providerIds = plan.providers.map(p => ids[p.key])
  const { data: existing, error: existingError } = await db.from('posts').select('id, author_id, title').in('author_id', providerIds)
  check({ error: existingError }, 'leer posts')
  const postId = {}
  const known = new Map((existing ?? []).map(p => [`${p.author_id}|${p.title}`, p.id]))
  const toInsert = []
  for (const post of plan.posts) {
    const found = known.get(`${ids[post.providerKey]}|${post.title}`)
    if (found) postId[post.key] = found
    else toInsert.push(post)
  }
  if (toInsert.length > 0) {
    const { data, error } = await db.from('posts')
      .insert(toInsert.map(p => ({ author_id: ids[p.providerKey], title: p.title, description: p.description })))
      .select('id, author_id, title')
    check({ error }, 'insertar posts')
    for (const row of data) {
      const post = toInsert.find(p => ids[p.providerKey] === row.author_id && p.title === row.title)
      postId[post.key] = row.id
    }
  }
  check(await db.from('post_tags').upsert(
    plan.posts.flatMap(post => post.tags.map(tag => ({ post_id: postId[post.key], tag_id: tagId[tag] }))),
    { onConflict: 'post_id,tag_id', ignoreDuplicates: true },
  ), 'etiquetas de posts')
  console.log(`Posts: ${toInsert.length} nuevos, ${plan.posts.length - toInsert.length} ya existían`)

  // Reacciones: el trigger de la base calcula user_tag_scores
  for (const [clientKey, rows] of Object.entries(plan.reactions)) {
    check(await db.from('reactions').upsert(
      rows.map(r => ({ post_id: postId[r.postKey], user_id: ids[clientKey], interested: r.interested })),
      { onConflict: 'post_id,user_id' },
    ), `reacciones ${clientKey}`)
  }

  // Resumen
  console.log('\nCuentas (contraseña común: la de SEED_PASSWORD):')
  console.table(accounts.map(a => ({ correo: email(a.key), rol: a.role, nombre: a.name })))
  for (const clientKey of Object.keys(plan.reactions)) {
    const { data, error } = await db.from('user_tag_scores').select('score, tags(name)').eq('user_id', ids[clientKey]).order('score', { ascending: false })
    if (error) { console.log(`\nNo se pudo leer user_tag_scores de ${clientKey}: ${error.message}`); continue }
    console.log(`\nPuntajes reales de ${email(clientKey)}:`)
    console.log(data.map(r => `${r.tags?.name} ${r.score > 0 ? '+' : ''}${r.score}`).join(', '))
  }
}

main().catch(error => { console.error(`\nError: ${error.message}`); process.exit(1) })