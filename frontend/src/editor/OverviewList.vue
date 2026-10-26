<script setup>
// Variant "Lijst": all steps as a flat list, the start step first, then top to bottom on the
// canvas (specs/004 research R9). Clicking a step opens it on the canvas.
import { useEditor } from './context'
import { nodeLabel } from '../lib/course'
import Icon from '../components/Icon.vue'

const ed = useEditor()
</script>

<template>
  <div class="overview">
    <div class="sheet">
      <header>
        <h2>{{ ed.course.name || 'Naamloze cursus' }}</h2>
        <p class="muted">{{ ed.course.description }}</p>
      </header>
      <ol v-if="ed.ordered.length" class="steps">
        <li v-for="n in ed.ordered" :key="n.id">
          <button class="step" @click="ed.open(n.id)">
            <Icon :name="n.type === 'video' ? 'film' : 'question'" :size="15" />
            <span class="label" :class="{ empty: n.type === 'video' ? !n.videoId : !n.question }">{{ nodeLabel(n, ed.stepVideos) }}</span>
            <span v-if="ed.course.startId === n.id" class="tag tag-start">Start</span>
          </button>
        </li>
      </ol>
      <p v-else class="muted">Nog geen onderdelen.</p>
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
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.step {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 8px;
  border-radius: var(--r-sm);
  cursor: pointer;
  color: var(--muted);
}
.step:hover { background: var(--brand-soft); }
.label { color: var(--fg); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.label.empty { color: var(--faint); }
@media (max-width: 600px) { .overview { padding: 16px; } .sheet { padding: 16px; } }
</style>
