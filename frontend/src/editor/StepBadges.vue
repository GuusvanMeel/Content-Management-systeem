<script setup>
// What a block shows at a glance (specs/005 FR-022): "Start", "Einde" (derived, FR-005) and the
// first message of the completeness check with a dot: orange "nog te doen", red after a click on
// "Opslaan als concept" (FR-022a). The number of incoming connections is only a tooltip on the
// block (verbeterronde 005, punt 5).
import { computed } from 'vue'
import { useEditor } from './context'
import { isEnd } from '../lib/course'

const props = defineProps({ node: Object })
const ed = useEditor()
const isStart = computed(() => ed.course.startId === props.node.id)
const end = computed(() => isEnd(props.node))
const issue = computed(() => ed.issues.byNode[props.node.id]?.[0] ?? null)
const flagged = computed(() => !!issue.value && ed.isFlagged(issue.value))
</script>

<template>
  <div v-if="isStart || end" class="tags" data-test="badges">
    <span v-if="isStart" class="tag tag-start">Start</span>
    <span v-if="end" class="tag tag-end" data-test="end">Einde</span>
  </div>
  <span v-if="issue" class="issue" :class="{ flagged }" data-test="issue">{{ issue.msg }}</span>
</template>

<style scoped>
.tags { display: flex; gap: 4px; flex-wrap: wrap; }
.issue { font-size: 0.8rem; color: var(--todo); line-height: 1.3; }
.issue::before { content: '● '; font-size: 0.8em; }
.issue.flagged { color: var(--err); }
</style>
