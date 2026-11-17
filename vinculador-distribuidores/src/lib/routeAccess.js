// Compartido por el router y las pruebas de acceso directo.
export function routeAccess(auth, to) {
  const publicPage = ['/login', '/register'].includes(to.path)
  if (!auth.user) {return publicPage ? true : '/login'}
  if (auth.isGuest) {return publicPage || to.meta?.guestOk ? true : '/'}
  if (auth.needsProfile) {return to.path === '/completar-perfil' ? true : '/completar-perfil'}
  if (publicPage || to.path === '/completar-perfil') {return '/'}
  return true
}
