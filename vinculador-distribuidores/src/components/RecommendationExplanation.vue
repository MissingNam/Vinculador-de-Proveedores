<template>
  <div v-if="reasons.length > 0" aria-label="Por qué se recomienda esta publicación" class="mt-4 pa-3 bg-surface-light rounded">
    <p class="text-subtitle-2 mb-1">Por qué aparece</p>
    <p v-for="reason in reasons" :key="reason" class="text-body-2">{{ reason }}</p>
  </div>
</template>

<script setup>
  import { computed } from 'vue'
  import { recommendationReasons } from '@/lib/recommendations'
  const props = defineProps({ post: { type: Object, required: true } })
  const reasons = computed(() => recommendationReasons(props.post))
</script>
