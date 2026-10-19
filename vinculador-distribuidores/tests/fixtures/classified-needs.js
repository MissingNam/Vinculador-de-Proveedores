// Synthetic data; no real accounts, emails or private information.
export const goodsNeed = {
  title: 'Cajas de cartón para envíos',
  description: 'Buscamos cajas nuevas de cartón corrugado para preparar pedidos de productos locales.',
  nature: 'bien', sector_id: 'empaque', country: 'México', region: 'Baja California', city: 'Tijuana',
  budget_min: 1500, budget_max: 2500, currency: 'MXN', quantity: 100, unit: 'piezas', delivery_date: '',
  service_mode: '', service_scope: '', start_date: '', end_date: '',
}

export const serviceNeed = {
  title: 'Mantenimiento preventivo de computadoras',
  description: 'Se necesita revisión, limpieza y diagnóstico de cinco equipos de oficina.',
  nature: 'servicio', sector_id: 'tecnologia', country: 'México', region: 'Baja California', city: 'Tijuana',
  budget_min: 2000, budget_max: 4000, currency: 'MXN', quantity: '', unit: '', delivery_date: '',
  service_mode: 'presencial', service_scope: 'Entregar cinco equipos revisados y un informe de diagnóstico por equipo.',
  start_date: '', end_date: '',
}

export const classifiedExamples = [goodsNeed, serviceNeed]
