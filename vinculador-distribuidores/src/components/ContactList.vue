<template>
  <ul class="contact-list">
    <li v-for="contact in contacts" :key="contact.id" class="d-flex flex-wrap align-center ga-2 mb-2">
      <v-icon class="text-muted" :icon="contactIcon(contact.kind)" size="small" />
      <span v-if="contact.label" class="text-muted">{{ contact.label }}:</span>

      <a
        v-if="contactHref(contact.kind, contact.value)"
        class="text-break"
        :href="contactHref(contact.kind, contact.value)"
        rel="noopener noreferrer"
        :target="contact.kind === 'otro' ? '_blank' : undefined"
      >{{ contact.value }}</a>
      <span v-else class="text-break">{{ contact.value }}</span>

      <!-- El estado se indica con texto e ícono, no solo con color -->
      <v-chip
        v-if="showVisibility"
        :color="contact.is_public ? 'secondary' : 'muted'"
        :prepend-icon="contact.is_public ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
        size="x-small"
        variant="tonal"
      >{{ contact.is_public ? 'Público' : 'Privado' }}</v-chip>
    </li>
  </ul>
</template>

<script setup>
  import { contactHref, contactIcon } from '@/lib/contacts'

  defineProps({
    contacts: { type: Array, required: true },
    showVisibility: { type: Boolean, default: false },
  })
</script>

<style scoped>
  .contact-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
</style>