<script setup>
// Organisation logo. On the coloured top bar (onBrand) the light version of the logo is used when there is one.
import { computed } from 'vue'
const props = defineProps({ org: Object, branding: Object, size: { type: Number, default: 32 }, onBrand: Boolean })
const src = computed(() => (props.onBrand ? props.branding?.logoOnBrand : null) ?? props.branding?.logo ?? null)
const tile = computed(() => props.onBrand && !props.branding?.logoOnBrand && props.branding?.logo)
const initials = computed(() =>
  (props.org?.name ?? '?')
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join(''),
)
</script>

<template>
  <span v-if="src" class="logo" :class="{ tile }" :style="{ height: size + 'px' }">
    <img :src="src" :alt="`Logo ${org?.name}`" />
  </span>
  <span v-else class="initials" :class="{ 'on-brand': onBrand }" :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.4 + 'px' }" aria-hidden="true">{{ initials }}</span>
</template>

<style scoped>
.logo { display: inline-flex; align-items: center; flex-shrink: 0; }
.logo img { height: 100%; width: auto; max-width: 160px; object-fit: contain; display: block; }
.logo.tile { background: #fff; border-radius: 6px; padding: 3px; }
.initials { display: inline-grid; place-items: center; border-radius: 6px; background: var(--brand); color: var(--brand-ink); font-weight: 600; flex-shrink: 0; }
.initials.on-brand { background: var(--brand-ink); color: var(--brand); }
</style>
