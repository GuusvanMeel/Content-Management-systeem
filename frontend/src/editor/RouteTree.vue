<script setup>
// One level of the route overview (specs/005 FR-024), from the prototype. Questions branch into
// their answers.
import { useEditor } from './context'
import { nodeLabel } from '../lib/course'
import Icon from '../components/Icon.vue'

defineOptions({ name: 'RouteTree' })
defineProps({ items: Array })
const ed = useEditor()
const label = (n) => nodeLabel(n, ed.stepVideos)
const thumb = (n) => (n.videoId ? ed.stepVideos[n.videoId]?.thumbnailUrl : null)
const problem = (n) => ed.issues.byNode[n.id]?.[0]
</script>

<template>
  <ol class="route">
    <li v-for="(it, k) in items" :key="k">
      <button v-if="it.kind === 'node'" class="step" @click="ed.open(it.node.id)">
        <span v-if="it.node.type === 'video'" class="th" :style="thumb(it.node) ? { backgroundImage: `url(${thumb(it.node)})` } : null"></span>
        <span v-else class="qbox"><Icon name="question" :size="16" /></span>
        <span class="text">
          <span class="lbl">{{ label(it.node) }}</span>
          <span v-if="problem(it.node)" class="problem" :class="{ flagged: ed.isFlagged(problem(it.node)) }">{{ problem(it.node).msg }}</span>
        </span>
        <span v-if="ed.course.startId === it.node.id" class="tag tag-start">Start</span>
      </button>
      <span v-else-if="it.kind === 'end'" class="leaf"><span class="tag tag-end">Einde</span></span>
      <button v-else-if="it.kind === 'ref'" class="leaf link" @click="ed.open(it.node.id)">Verder bij “{{ label(it.node) }}”</button>
      <span v-else-if="it.kind === 'open'" class="leaf problem">Nog niet verbonden</span>
      <div v-else-if="it.kind === 'branch'" class="branches">
        <div v-for="b in it.branches" :key="b.answer.id" class="branch">
          <span class="ans">
            {{ b.letter }}. {{ b.answer.text || 'Leeg antwoord' }}
            <Icon v-if="b.answer.correct" name="check" :size="14" class="ok" />
          </span>
          <RouteTree :items="b.items" />
        </div>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.route { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.step {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 6px 8px;
  border-radius: var(--r-sm);
  cursor: pointer;
}
.step:hover { background: var(--brand-soft); }
.th { width: 72px; aspect-ratio: 2 / 1; border-radius: 4px; background: var(--surface-2) center / cover; flex-shrink: 0; }
.qbox {
  width: 72px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--brand-2) 35%, var(--line-strong));
  background: var(--brand-2-soft);
  color: var(--brand-2);
  flex-shrink: 0;
}
.text { display: grid; flex: 1; min-width: 0; }
.lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.problem { color: var(--todo); font-size: 0.85rem; }
.problem.flagged { color: var(--err); }
.leaf { display: block; padding: 4px 8px 4px 92px; font-size: 0.9rem; color: var(--muted); }
.link { border: 0; background: transparent; cursor: pointer; text-align: left; }
.link:hover { color: var(--fg); text-decoration: underline; }
.branches { display: grid; gap: 10px; margin: 4px 0 8px 44px; }
.branch { border-left: 2px solid color-mix(in srgb, var(--brand) 35%, var(--line)); padding-left: 16px; display: grid; gap: 4px; }
.ans { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 500; color: var(--muted); padding: 2px 0; }
.ok { color: var(--ok); }
</style>
