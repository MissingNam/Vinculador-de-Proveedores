<template>
  <v-card class="mb-3" variant="outlined">
    <v-card-title class="text-wrap">{{ result.id }} · {{ result.title }}</v-card-title>
    <v-card-subtitle>Fuente: {{ result.source }} · Resultado web</v-card-subtitle>
    <v-card-text>{{ result.content }}</v-card-text>
    <v-card-actions><v-btn :href="result.url" rel="noopener noreferrer" target="_blank">Consultar fuente <v-icon end icon="mdi-open-in-new" /></v-btn></v-card-actions>
  </v-card>
</template>
<script setup>
  defineProps({ result: { type: Object, required: true } })
</script>
