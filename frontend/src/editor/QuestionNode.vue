<script setup>
// A question step on the canvas. No connection handles: steps are not linked in this feature.
import { computed } from 'vue'
import { useEditor } from './context'
import { LETTERS } from '../lib/util'
import Icon from '../components/Icon.vue'

const props = defineProps({ node: Object })
const ed = useEditor()
const selected = computed(() => ed.selectedId === props.node.id)
const isStart = computed(() => ed.course.startId === props.node.id)
</script>

<template>
  <div class="qnode" :class="{ selected }">
    <div class="head">
      <span class="kind"><Icon name="question" :size="13" />Vraag</span>
      <span v-if="isStart" class="tag tag-start">Start</span>
    </div>
    <strong class="q" :class="{ empty: !node.question }">{{ node.question || 'Nieuwe vraag' }}</strong>
    <ul class="answers">
      <li v-for="(a, i) in node.answers" :key="a.id">
        <span class="l">{{ LETTERS[i] }}</span>
        <span class="at" :class="{ empty: !a.text }">{{ a.text || 'Antwoord' }}</span>
        <Icon v-if="a.correct" name="check" :size="14" class="ok" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.qnode {
  position: relative;
  width: 240px;
  background: var(--brand-2-soft);
  border: 1px solid color-mix(in srgb, var(--brand-2) 35%, var(--line-strong));
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 10px 12px 12px;
  display: grid;
  gap: 6px;
}
.qnode.selected { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand), var(--shadow); }
.head { display: flex; align-items: center; gap: 6px; }
.kind { display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--muted); font-weight: 500; }
.kind :deep(svg) { color: var(--brand-2-ink); background: var(--brand-2); border-radius: 50%; padding: 2px; width: 18px; height: 18px; }
.q { font-size: 0.9rem; font-weight: 500; line-height: 1.3; }
.q.empty { color: var(--faint); font-weight: 400; }
.answers { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
.answers li { display: flex; gap: 8px; align-items: center; font-size: 0.82rem; }
.l { width: 18px; color: var(--muted); font-weight: 600; flex-shrink: 0; }
.at { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.at.empty { color: var(--faint); }
.ok { color: var(--ok); flex-shrink: 0; }

</style>
