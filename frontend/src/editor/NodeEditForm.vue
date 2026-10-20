<script setup>
// Edit form for one part. Used in the dialog (Canvas) and in the side panel (Canvas + paneel).
import { computed } from 'vue'
import { useEditor } from './context'
import { nodeLabel, addAnswer, removeAnswer, setCorrect } from '../lib/course'
import { LETTERS } from '../lib/util'
import Icon from '../components/Icon.vue'
import VideoPicker from './VideoPicker.vue'

const props = defineProps({ node: Object })
const emit = defineEmits(['deleted'])
const ed = useEditor()

const issues = computed(() => ed.validation.byNode[props.node.id] ?? [])
const bad = (field) => issues.value.some((i) => i.field === field)
const isStart = computed(() => ed.course.startId === props.node.id)
const idp = computed(() => 'f-' + props.node.id)
const video = computed(() => ed.app.videosById[props.node.videoId])

const targets = computed(() =>
  ed.ordered
    .filter((n) => n.id !== props.node.id || props.node.type === 'question')
    .map((n) => ({ id: n.id, label: (n.type === 'question' ? 'Vraag: ' : '') + nodeLabel(n, ed.app.videosById) })),
)
function setTarget(handle, value) {
  value ? ed.connect(props.node.id, handle, value) : ed.disconnect(props.node.id, handle)
}
</script>

<template>
  <div class="form">
    <template v-if="node.type === 'video'">
      <div class="field">
        <span class="label">Video</span>
        <VideoPicker v-model="node.videoId" :invalid="bad('video')" :id-base="idp + '-video'" />
      </div>
      <div class="field">
        <label :for="idp + '-title'">Titel</label>
        <input :id="idp + '-title'" v-model="node.title" class="input" :placeholder="video?.name ?? 'Titel van dit onderdeel'" />
      </div>
      <div class="field">
        <label :for="idp + '-next'">Daarna</label>
        <select :id="idp + '-next'" class="select" :value="node.next ?? ''" @change="setTarget('next', $event.target.value)">
          <option value="">Einde van de cursus</option>
          <option v-for="t in targets" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </div>
    </template>

    <template v-else>
      <div class="field">
        <label :for="idp + '-q'">Vraag</label>
        <textarea :id="idp + '-q'" v-model="node.question" class="textarea" rows="2" :class="{ invalid: bad('question') }" />
      </div>
      <div class="field">
        <span class="label">Antwoorden</span>
        <p class="hint">Vink het goede antwoord aan en kies waar elk antwoord heen gaat.</p>
        <div class="answers">
          <div v-for="(a, i) in node.answers" :key="a.id" class="answer">
            <input
              :id="idp + '-c-' + a.id"
              type="radio"
              class="radio"
              :name="idp + '-correct'"
              :checked="a.correct"
              :aria-label="`Antwoord ${LETTERS[i]} is goed`"
              @change="setCorrect(node, a.id)"
            />
            <input :id="idp + '-a-' + a.id" v-model="a.text" class="input" :class="{ invalid: bad('answer:' + a.id) }" :placeholder="`Antwoord ${LETTERS[i]}`" />
            <button v-if="node.answers.length > 2" class="icon-btn" :aria-label="`Antwoord ${LETTERS[i]} verwijderen`" @click="removeAnswer(node, a.id)">
              <Icon name="x" :size="15" />
            </button>
            <select
              :id="idp + '-t-' + a.id"
              class="select target"
              :class="{ invalid: bad('target:' + a.id), unset: !a.target }"
              :value="a.target ?? ''"
              :aria-label="`Na antwoord ${LETTERS[i]}`"
              @change="setTarget('a-' + a.id, $event.target.value)"
            >
              <option value="" disabled>Gaat naar…</option>
              <option v-for="t in targets" :key="t.id" :value="t.id">→ {{ t.label }}</option>
            </select>
          </div>
        </div>
        <button v-if="node.answers.length < 4" class="btn btn-sm btn-ghost add" @click="addAnswer(node)"><Icon name="plus" :size="14" />Antwoord toevoegen</button>
      </div>
    </template>

    <div class="actions">
      <span v-if="isStart" class="muted small">Dit is het startpunt</span>
      <button v-else class="btn btn-sm" @click="ed.setStart(node.id)">Maak startpunt</button>
      <button class="btn btn-sm btn-danger" @click="ed.removeNode(node.id); emit('deleted')">Verwijderen</button>
    </div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 18px; }
.answers { display: grid; gap: 12px; }
.answer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 6px 8px;
  align-items: center;
}
.radio { margin: 0; width: 16px; height: 16px; accent-color: var(--brand); }
.target { grid-column: 2 / 3; min-height: 32px; padding: 4px 8px; font-size: 0.85rem; color: var(--muted); }
.target.unset { color: var(--faint); }
.add { justify-self: start; margin-left: -8px; }
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
</style>
