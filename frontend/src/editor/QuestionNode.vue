<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useEditor } from './context'
import { LETTERS } from '../lib/util'
import Icon from '../components/Icon.vue'

const props = defineProps({ node: Object })
const ed = useEditor()
const issues = computed(() => ed.validation.byNode[props.node.id] ?? [])
const selected = computed(() => ed.selectedId === props.node.id)
const isStart = computed(() => ed.course.startId === props.node.id)
const seg = (i) => ({ left: (i / props.node.answers.length) * 100 + '%', width: 100 / props.node.answers.length + '%' })
</script>

<template>
  <div class="qnode" :class="{ selected, invalid: issues.length }">
    <Handle id="in" type="target" :position="Position.Top" :connectable-start="false" class="h-in" />
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
    <span v-if="issues.length" class="problem">{{ issues[0].msg }}</span>
    <Handle
      v-for="(a, i) in node.answers"
      :id="'a-' + a.id"
      :key="a.id"
      type="source"
      :position="Position.Bottom"
      class="h-ans"
      :class="{ first: i === 0, last: i === node.answers.length - 1 }"
      :style="seg(i)"
      :title="`Sleep om antwoord ${LETTERS[i]} te verbinden`"
    ><span class="box">{{ LETTERS[i] }}</span></Handle>
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
  padding: 10px 12px 26px;
  display: grid;
  gap: 6px;
}
.qnode.selected { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand), var(--shadow); }
.qnode.invalid:not(.selected) { border-color: var(--err); }
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
.problem { font-size: 0.8rem; color: var(--err); }
.problem::before { content: '● '; font-size: 0.7em; vertical-align: 1px; }

/* Incoming: see VideoNode.vue. Outgoing: one square handle per answer letter. */
.h-in.vue-flow__handle {
  top: 0;
  left: 0;
  right: 0;
  width: auto;
  height: 10px;
  min-height: 0;
  transform: none;
  border: 0;
  border-radius: 10px 10px 0 0;
  background: transparent;
}
:global(.canvas.is-connecting .vue-flow__handle.h-in) { height: 100%; border-radius: 10px; z-index: 2; }
.h-in.vue-flow__handle.valid {
  background: color-mix(in srgb, var(--brand) 10%, transparent);
  box-shadow: inset 0 4px 0 var(--brand);
}
/* Each answer owns its share of the bottom strip plus its letter box below it. */
.h-ans.vue-flow__handle {
  top: auto;
  bottom: -15px;
  height: 37px;
  min-height: 0;
  transform: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: crosshair;
}
.h-ans.vue-flow__handle::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 22px;
  transition: background 0.12s, box-shadow 0.12s;
}
.h-ans.first::before { border-bottom-left-radius: 10px; }
.h-ans.last::before { border-bottom-right-radius: 10px; }
.h-ans.vue-flow__handle:hover::before {
  background: color-mix(in srgb, var(--brand-2) 18%, transparent);
  box-shadow: inset 0 -4px 0 var(--brand-2);
}
.box {
  position: absolute;
  left: 50%;
  top: 22px;
  width: 34px;
  height: 30px;
  transform: translate(-50%, -50%);
  border-radius: 7px;
  border: 1.5px solid var(--brand-2);
  background: var(--surface);
  color: var(--fg);
  font-size: 0.85rem;
  font-weight: 600;
  display: grid;
  place-items: center;
  box-shadow: var(--shadow);
  pointer-events: none;
  transition: background 0.12s, color 0.12s;
}
.h-ans.vue-flow__handle:hover .box { background: var(--brand-2); color: var(--brand-2-ink); }
</style>
