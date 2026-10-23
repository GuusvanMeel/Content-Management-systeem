<script>
// Who may see a video (specs/003 contracts/ui.md § Beschikbaarheid kiezen). Used in the upload
// dialog and in the video window. Value: { visibility, accessOrganisationIds }.

export const NO_ORGANISATION_MESSAGE = 'Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.'

/** "Selectief beschikbaar" needs at least one organisation (FR-004). */
export function isAvailabilityValid(value) {
  return value?.visibility !== 'selective' || (value.accessOrganisationIds ?? []).length > 0
}
</script>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  organisations: { type: Array, default: () => [] },
  // Unique per picker, so labels and radio groups of several pickers do not mix.
  idPrefix: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])

const OPTIONS = [
  { value: 'public', label: 'Algemeen beschikbaar', hint: 'Alle organisaties kunnen deze video zien.' },
  { value: 'selective', label: 'Selectief beschikbaar', hint: 'Alleen de organisaties die je kiest.' },
  { value: 'private', label: 'Alleen eigen organisatie', hint: 'Alleen jouw organisatie ziet deze video.' },
]
const FILTER_FROM = 10

const filter = ref('')
const chosen = computed(() => new Set(props.modelValue.accessOrganisationIds ?? []))
const noOthers = computed(() => props.organisations.length === 0)
const shown = computed(() => {
  const query = filter.value.trim().toLowerCase()
  return query ? props.organisations.filter((o) => o.name.toLowerCase().includes(query)) : props.organisations
})

function setVisibility(visibility) {
  emit('update:modelValue', { ...props.modelValue, visibility })
}

function toggle(id, on) {
  const ids = new Set(chosen.value)
  if (on) ids.add(id)
  else ids.delete(id)
  // Keep the order of the list, so the value does not depend on the order of clicking.
  const ordered = props.organisations.map((o) => o.id).filter((orgId) => ids.has(orgId))
  emit('update:modelValue', { ...props.modelValue, accessOrganisationIds: ordered })
}
</script>

<template>
  <fieldset class="availability" data-test="availability">
    <legend class="label">Beschikbaarheid</legend>
    <template v-for="option in OPTIONS" :key="option.value">
    <label class="option" :class="{ disabled: option.value === 'selective' && noOthers }">
      <input
        type="radio"
        :name="`${idPrefix}-visibility`"
        :value="option.value"
        :checked="modelValue.visibility === option.value"
        :disabled="option.value === 'selective' && noOthers"
        :data-test="`visibility-${option.value}`"
        @change="setVisibility(option.value)"
      />
      <span>
        <span class="option-label">{{ option.label }}</span>
        <span class="muted small">{{ option.value === 'selective' && noOthers ? 'Er zijn nog geen andere organisaties.' : option.hint }}</span>
      </span>
    </label>

    <!-- The organisations belong to "Selectief beschikbaar", so they are listed right below it. -->
    <div v-if="option.value === 'selective' && modelValue.visibility === 'selective'" class="organisations">
      <input
        v-if="organisations.length > FILTER_FROM"
        v-model="filter"
        class="input"
        type="search"
        placeholder="Zoek een organisatie"
        aria-label="Zoek een organisatie"
      />
      <div class="checks">
        <label v-for="organisation in shown" :key="organisation.id" class="check">
          <input
            type="checkbox"
            :checked="chosen.has(organisation.id)"
            :data-test="`organisation-${organisation.id}`"
            @change="toggle(organisation.id, $event.target.checked)"
          />
          {{ organisation.name }}
        </label>
      </div>
      <p v-if="!isAvailabilityValid(modelValue)" class="problem" role="alert" data-test="no-organisation">{{ NO_ORGANISATION_MESSAGE }}</p>
    </div>
    </template>
  </fieldset>
</template>

<style scoped>
.availability { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; min-width: 0; }
.label { font-size: 0.85rem; font-weight: 500; padding: 0; margin-bottom: 2px; }
.option { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.option > span { display: grid; }
.option.disabled { cursor: not-allowed; opacity: 0.6; }
.option input { margin-top: 3px; }
.option-label { font-size: 0.9rem; }
.organisations { display: grid; gap: 6px; margin-left: 24px; }
.checks { display: grid; gap: 4px; max-height: 160px; overflow-y: auto; }
.check { display: flex; gap: 8px; align-items: center; font-size: 0.9rem; cursor: pointer; }
.problem { margin: 0; color: var(--err); font-weight: 500; font-size: 0.85rem; }
</style>
