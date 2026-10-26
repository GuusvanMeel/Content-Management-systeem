<script setup>
// The course-level result of the completeness check in the editor bar (specs/005 FR-023):
// "n nog te doen" with the messages grouped per type, or "Cursus is compleet". Orange, or red once
// a message was there at a click on "Opslaan als concept" (FR-022a). It never blocks saving.
// Groups can be folded; they start open when there are fewer than 5 points (verbeterronde 005,
// punt 6). The course-level group stands apart from the groups about steps.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useEditor } from './context'
import { findNode, nodeLabel } from '../lib/course'
import { groupIssues } from '../lib/completeness'
import Icon from '../components/Icon.vue'

const OPEN_BELOW = 5
const ed = useEditor()
const open = ref(false)
const root = ref(null)
const issues = computed(() => ed.issues.issues)
const groups = computed(() => groupIssues(issues.value))
const courseGroups = computed(() => groups.value.filter((g) => g.courseLevel))
const stepGroups = computed(() => groups.value.filter((g) => !g.courseLevel))
const anyFlagged = computed(() => issues.value.some((issue) => ed.isFlagged(issue)))
const label = computed(() => `${issues.value.length} nog te doen`)

// Folded groups by key; reset each time the list opens.
const folded = ref(new Set())
watch(open, (isOpen) => {
  if (isOpen) folded.value = issues.value.length < OPEN_BELOW ? new Set() : new Set(groups.value.map((g) => g.key))
})
function toggle(key) {
  const next = new Set(folded.value)
  next.has(key) ? next.delete(key) : next.add(key)
  folded.value = next
}

/** The step a message is about, so a row says which block it means. */
function stepName(issue) {
  const node = issue.nodeId && findNode(ed.course, issue.nodeId)
  if (!node) return ''
  return (node.type === 'question' ? 'Vraag: ' : '') + nodeLabel(node, ed.stepVideos)
}

/** Brings the step of a message into view; course-level messages show the whole canvas. */
function pick(issue) {
  open.value = false
  if (issue.nodeId) ed.open(issue.nodeId)
  else ed.focusRequest = { id: null, t: Date.now() }
}
const close = (e) => root.value && !root.value.contains(e.target) && (open.value = false)
onMounted(() => window.addEventListener('mousedown', close))
onBeforeUnmount(() => window.removeEventListener('mousedown', close))
</script>

<template>
  <span v-if="!issues.length" class="complete" data-test="complete"><Icon name="check" :size="15" />Cursus is compleet</span>
  <div v-else ref="root" class="todo-anchor">
    <button class="btn btn-ghost todo-btn" :class="{ flagged: anyFlagged }" data-test="todo" @click="open = !open">{{ label }}</button>
    <div v-if="open" class="pop" data-test="todo-list">
      <p class="muted small">Nog te doen voordat de cursus af is. Opslaan als concept kan altijd.</p>
      <template v-for="(list, part) in [courseGroups, stepGroups]" :key="part">
        <section v-for="group in list" :key="group.key" class="group" :class="{ course: group.courseLevel }" :data-group="group.key">
          <button class="group-head" :aria-expanded="!folded.has(group.key)" data-test="group-head" @click="toggle(group.key)">
            <Icon :name="folded.has(group.key) ? 'right' : 'down'" :size="14" />
            <span class="group-label">{{ group.label }}</span>
            <span class="count">{{ group.issues.length }}</span>
          </button>
          <div v-if="!folded.has(group.key)" class="rows">
            <button
              v-for="issue in group.issues"
              :key="issue.id"
              class="pop-item"
              :class="{ flagged: ed.isFlagged(issue) }"
              data-test="todo-item"
              @click="pick(issue)"
            >
              <span v-if="stepName(issue)" class="step">{{ stepName(issue) }}</span>
              <span class="msg">{{ issue.msg }}</span>
            </button>
          </div>
        </section>
        <hr v-if="part === 0 && courseGroups.length && stepGroups.length" class="split" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.complete { display: inline-flex; align-items: center; gap: 6px; color: var(--ok); font-size: 0.9rem; font-weight: 500; padding: 0 6px; }
.todo-anchor { position: relative; }
.todo-btn { color: var(--todo); }
.todo-btn.flagged { color: var(--err); }
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 340px;
  max-height: 65vh;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow-lg);
  padding: 12px;
  display: grid;
  gap: 6px;
  z-index: 40;
}
.group { display: grid; gap: 2px; }
.group.course { background: var(--surface-2); border-radius: var(--r-sm); padding: 4px; }
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 4px 6px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  text-align: left;
}
.group-head:hover { background: var(--surface-2); }
.group-label { flex: 1; }
.count { font-size: 0.75rem; font-weight: 600; padding: 0 7px; border-radius: 999px; background: var(--todo-soft); color: var(--todo); }
.rows { display: grid; gap: 1px; padding-left: 18px; }
.pop-item {
  display: grid;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--todo);
}
.pop-item:hover { background: var(--todo-soft); }
.pop-item.flagged { color: var(--err); }
.pop-item.flagged:hover { background: var(--err-soft); }
.step { font-size: 0.78rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg { font-size: 0.88rem; }
.split { border: 0; border-top: 1px solid var(--line); margin: 4px 0; }
</style>
