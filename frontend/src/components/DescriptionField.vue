<script setup>
// Optional description with a "N tekens over" counter (specs/003 FR-020, FR-021, contracts/ui.md
// § Beschrijving invullen). Counted in code points like the server; typing past the maximum is not
// possible, and pasted text that does not fit is cut off with a visible message.
import { computed, ref } from 'vue'
import { characterCount, limitCharacters } from '../lib/textLength'

const props = defineProps({
  modelValue: { type: String, default: '' },
  max: { type: Number, default: 1000 },
  id: { type: String, required: true },
  rows: { type: Number, default: 3 },
  // Also used for other counted texts, such as the name and description of a course (specs/004).
  label: { type: String, default: 'Beschrijving' },
  optional: { type: Boolean, default: true },
  multiline: { type: Boolean, default: true },
  invalid: { type: Boolean, default: false },
  subject: { type: String, default: 'De beschrijving' },
  testId: { type: String, default: 'description' },
})
const emit = defineEmits(['update:modelValue'])

const cutOff = ref(false)
const remaining = computed(() => props.max - characterCount(props.modelValue))
const counterText = computed(() => (remaining.value === 1 ? '1 teken over' : `${remaining.value} tekens over`))
const atLimit = computed(() => remaining.value <= 0)

function onInput(event) {
  const raw = event.target.value
  const limited = limitCharacters(raw, props.max)
  cutOff.value = limited !== raw
  // Keep the field and the value the same, also when nothing changed for Vue.
  event.target.value = limited
  emit('update:modelValue', limited)
}
</script>

<template>
  <div class="description-field">
    <label class="label" :for="id">{{ label }} <span v-if="optional" class="muted">(optioneel)</span></label>
    <textarea
      v-if="multiline"
      :id="id"
      class="input"
      :class="{ invalid }"
      :rows="rows"
      :value="modelValue"
      :aria-describedby="`${id}-counter`"
      :data-test="testId"
      @input="onInput"
    ></textarea>
    <input
      v-else
      :id="id"
      class="input"
      :class="{ invalid }"
      :value="modelValue"
      :aria-describedby="`${id}-counter`"
      :data-test="testId"
      @input="onInput"
    />
    <span :id="`${id}-counter`" class="counter" :class="{ limit: atLimit }" aria-live="polite" :data-test="`${testId}-counter`">
      {{ counterText }}
    </span>
    <span v-if="cutOff && atLimit" class="problem" role="alert" :data-test="`${testId}-cut`">
      {{ subject }} mag maximaal {{ max }} tekens zijn; de rest is niet overgenomen.
    </span>
  </div>
</template>

<style scoped>
.description-field { display: grid; gap: 4px; }
.label { font-size: 0.85rem; font-weight: 500; }
textarea { resize: vertical; min-height: 60px; font: inherit; }
.counter { font-size: 0.85rem; color: var(--muted); }
.counter.limit { color: var(--err); font-weight: 600; }
.problem { color: var(--err); font-weight: 500; font-size: 0.85rem; }
</style>
