export function validatePost(value, isOffer) {
  const title = value.title.trim()
  const description = value.description.trim()
  const tags = [...new Set(value.tags.map(tag => String(tag).trim()).filter(Boolean))]
  if (title.length < 3 || title.length > 160) {throw new Error('El título debe tener entre 3 y 160 caracteres.')}
  if (description.length < 10 || description.length > 5000) {throw new Error('La descripción debe tener entre 10 y 5000 caracteres.')}
  if (tags.length > 10 || tags.some(tag => tag.length > 50)) {throw new Error('Usa hasta 10 etiquetas de máximo 50 caracteres.')}
  if (isOffer && (!['bien', 'servicio'].includes(value.nature) || !value.sectorId)) {throw new Error('Selecciona la naturaleza y el rubro de esta oferta.')}
  return { p_title: title, p_description: description, p_tags: tags, p_nature: isOffer ? value.nature : null, p_sector_id: isOffer ? value.sectorId : null }
}

export async function createPost(client, payload) {
  const { data, error } = await client.rpc('create_classified_post', payload)
  if (error) {throw Object.assign(new Error(error.code === 'PGRST202'
    ? 'La publicación de ofertas todavía no está habilitada. Contacta al equipo.'
    : 'No se pudo guardar la publicación. Revisa los datos e intenta de nuevo.'), { code: error.code })}
  return data
}

export async function saveReaction(client, postId, userId, interested) {
  const { data, error } = await client.from('reactions').upsert({ post_id: postId, user_id: userId, interested }, { onConflict: 'post_id,user_id' }).select('interested').single()
  if (error) {throw new Error('No se pudo guardar tu reacción. Intenta de nuevo.')}
  return data.interested
}

export async function removePost(client, postId, userId) {
  const { data, error } = await client.from('posts').delete().eq('id', postId).eq('author_id', userId).select('id')
  if (error || !data?.length) {throw new Error('No se pudo eliminar la publicación. Recarga e intenta de nuevo.')}
}

export async function candidateOffers(client, { query = '', nature = null, sectorId = null } = {}) {
  const { data, error } = await client.rpc('candidate_offers', { p_query: query, p_nature: nature || null, p_sector_id: sectorId || null, p_limit: 12 })
  if (error) {throw new Error(error.code === 'PGRST202' ? 'La búsqueda de ofertas todavía no está habilitada.' : 'No se pudieron buscar las ofertas. Intenta de nuevo.')}
  return data ?? []
}
