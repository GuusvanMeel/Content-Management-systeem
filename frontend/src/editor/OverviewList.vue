<script setup>
// Variant "Lijst": the route written out from the start (specs/005 FR-024), from the prototype.
// Questions branch into their answers; a loop shows "Verder bij …"; a question without any next
// step is an end; steps that cannot be reached are listed apart. Clicking a step opens it.
import { computed } from 'vue'
import { useEditor } from './context'
import { findNode, nodeLabel } from '../lib/course'
import { LETTERS } from '../lib/util'
import RouteTree from './RouteTree.vue'

const ed = useEditor()

const route = computed(() => {
  const seen = new Set()
  const walk = (id) => {
    const items = []
    while (id) {
      const n = findNode(ed.course, id)
      if (!n) break
      if (seen.has(id)) {
        items.push({ kind: 'ref', node: n })
        break
      }
      seen.add(id)
      items.push({ kind: 'node', node: n })
      if (n.type === 'question') {
        if (n.answers.some((a) => a.target)) {
          items.push({
            kind: 'branch',
            branches: n.answers.map((a, i) => ({ answer: a, letter: LETTERS[i], items: a.target ? walk(a.target) : [{ kind: 'open' }] })),
          })
        } else items.push({ kind: 'end' })
        break
      }
      if (!n.next) items.push({ kind: 'end' })
      id = n.next
    }
    return items
  }
  const items = ed.course.startId ? walk(ed.course.startId) : []
  return { items, loose: ed.course.nodes.filter((n) => !seen.has(n.id)) }
})
</script>

<template>
  <div class="overview">
    <div class="sheet">
      <header>
        <h2>{{ ed.course.name || 'Naamloze cursus' }}</h2>
        <p class="muted">{{ ed.course.description }}</p>
      </header>
      <RouteTree v-if="route.items.length" :items="route.items" />
      <p v-else class="muted" data-test="no-start">Nog geen startonderdeel.</p>
      <section v-if="route.loose.length" class="loose" data-test="unreachable">
        <h3>Niet bereikbaar</h3>
        <button v-for="n in route.loose" :key="n.id" class="loose-item" @click="ed.open(n.id)">
          {{ (n.type === 'question' ? 'Vraag: ' : '') + nodeLabel(n, ed.stepVideos) }}
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overview { overflow: auto; padding: 32px 24px 64px; }
.sheet {
  max-width: 760px;
  margin: 0 auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 24px;
  display: grid;
  gap: 20px;
}
header { display: grid; gap: 6px; padding: 0 8px; }
header p { max-width: 62ch; }
.loose { display: grid; gap: 4px; border-top: 1px solid var(--line); padding: 16px 8px 0; }
.loose h3 { color: var(--muted); font-weight: 500; }
.loose-item { border: 0; background: transparent; text-align: left; padding: 4px 0; cursor: pointer; }
.loose-item:hover { text-decoration: underline; }
@media (max-width: 600px) { .overview { padding: 16px; } .sheet { padding: 16px; } }
</style>
