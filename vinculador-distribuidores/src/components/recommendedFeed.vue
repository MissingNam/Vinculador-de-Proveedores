<template>
  <div
    ref="scroller"
    aria-label="Publicaciones recomendadas"
    class="reco-scroller"
    tabindex="0"
    @scroll.passive="onScroll"
  >
    <div v-if="store.loading" class="reco-slide">
      <div class="text-center ma-auto" role="status">
        <v-progress-circular aria-label="Cargando recomendaciones" indeterminate />
        <p class="mt-2">Buscando recomendaciones…</p>
      </div>
    </div>

    <div v-else-if="store.error" class="reco-slide">
      <v-alert class="reco-card" type="error">
        {{ store.error }}
        <v-btn variant="text" @click="start">Reintentar</v-btn>
      </v-alert>
    </div>

    <template v-else>
      <div v-for="post in store.items" :key="post.id" class="reco-slide">
        <PostCard class="reco-card" :post="post" />
      </div>

      <div v-if="store.noMore" class="reco-slide">
        <v-alert class="reco-card" type="info" variant="tonal">
          No hay más recomendaciones por ahora.
        </v-alert>
      </div>
    </template>
  </div>
</template>

<script setup>
  import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import PostCard from '@/components/PostCard.vue'
  import { useRecommendationsStore } from '@/stores/recommendations'

  const store = useRecommendationsStore()
  const scroller = ref(null)
  let settleTimer
  let scrolling = false
  let idleWaiters = []

  // Altura exacta del slide (puede ser fraccionaria; clientHeight la redondea)
  const slideHeight = () => scroller.value?.getBoundingClientRect().height || 0

  // Posición ABSOLUTA del post activo: no depende de lo que el navegador ya haya ajustado
  function pinToActive() {
    const el = scroller.value
    const height = slideHeight()
    if (el && height) el.scrollTo({ top: store.activeIndex * height, behavior: 'instant' })
  }

  async function start() {
    await store.init()
    await nextTick()
    pinToActive()
  }

  function onScroll() {
    scrolling = true
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      scrolling = false
      onSettled()
      flushIdle()
    }, 120)
  }

  // El store espera esta promesa antes de modificar la lista
  function waitIdle() {
    return scrolling ? new Promise(resolve => idleWaiters.push(resolve)) : Promise.resolve()
  }

  function flushIdle() {
    idleWaiters.forEach(resolve => resolve())
    idleWaiters = []
  }

  function onSettled() {
    const el = scroller.value
    const height = slideHeight()
    if (!el || !height || store.loading || store.items.length === 0) return

    const raw = Math.round(el.scrollTop / height)
    const idx = Math.min(raw, store.items.length - 1) // el slide final no es un post
    const diff = idx - store.activeIndex
    if (diff === 0) return
    console.log('settled', Math.round(el.scrollTop / height), store.activeIndex)

    store.activeIndex = idx
    for (let i = 0; i < Math.abs(diff); i++) {
      store.advance(Math.sign(diff), waitIdle).then(async changed => {
        if (!changed) return
        await nextTick()
        pinToActive()
      })
    }
  }

  onMounted(start)
  watch(() => store.resets, start)
  onBeforeUnmount(() => {
    clearTimeout(settleTimer)
    flushIdle() // que ninguna tarea del store se quede esperando
  })
</script>

<style scoped>
  .reco-scroller {
    height: calc(100dvh - var(--v-layout-top, 128px));
    overflow-y: auto;
    overflow-anchor: none;          /* evita que el navegador "compense" por su cuenta */
    overscroll-behavior-y: contain;
    scroll-snap-type: y mandatory;
  }

  .reco-slide {
    height: 100%;
    display: flex;
    overflow-y: auto;               /* si un post es más alto que la pantalla, se desplaza dentro */
    padding: 16px;
    scroll-snap-align: start;
    scroll-snap-stop: always;       /* no deja saltarse posts de un golpe */
  }

  .reco-card {
    margin: auto;                   /* centra sin recortar el borde superior si desborda */
    width: 100%;
    max-width: 700px;
  }
</style>