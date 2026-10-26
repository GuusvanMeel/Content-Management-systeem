<script setup>
// Edit form for one step. Used in the dialog (Canvas) and in the side panel (Canvas + paneel).
// Steps are not linked in this feature: no "Daarna" and no target per answer (FR-024).
import { computed } from 'vue'
import { useEditor } from './context'
import { addAnswer, removeAnswer, setCorrect } from '../lib/course'
import { LETTERS } from '../lib/util'
import { limitCharacters } from '../lib/textLength'
import Icon from '../components/Icon.vue'
import DescriptionField from '../components/DescriptionField.vue'
import VideoPicker from './VideoPicker.vue'

const props = defineProps({ node: Object })
const emit = defineEmits(['deleted'])
const ed = useEditor()

const isStart = computed(() => ed.course.startId === props.node.id)
const lostNotice = computed(() => !props.node.videoId && ed.lostVideoNotices.has(props.node.id))

async function remove() {
  if (await ed.removeNode(props.node.id)) emit('deleted')
}
const idp = computed(() => 'f-' + props.node.id)

// Limits of FR-026, counted like the server (code points).
const TEXT_MAX = 1000
const ANSWER_MAX = 255

/** The server's message for a field of this step after a failed save, if any. */
const stepIndex = computed(() => ed.course.nodes.indexOf(ed.course.nodes.find((n) => n.id === props.node.id)))
const errorAt = (field) => ed.fieldErrors[`steps.${stepIndex.value}.${field}`]

function setAnswerText(answer, event) {
  const limited = limitCharacters(event.target.value, ANSWER_MAX)
  event.target.value = limited
  answer.text = limited
}
</script>

<template>
  <div class="form">
    <div v-if="node.type === 'video'" class="field">
      <span class="label">Video</span>
      <p v-if="lostNotice" class="hint err" data-test="lost-video">Deze video is niet meer beschikbaar en kan niet worden teruggezet.</p>
      <VideoPicker :node="node" :id-base="idp + '-video'" />
      <p v-if="errorAt('videoId')" class="hint err">{{ errorAt('videoId') }}</p>
      <!-- FR-020c: the step stays, without a video. -->
      <button v-if="node.videoId" class="btn btn-sm btn-ghost remove-video" data-test="remove-video" @click="ed.clearVideo(node)">
        Video weghalen
      </button>
    </div>

    <template v-else>
      <DescriptionField
        :id="idp + '-q'"
        v-model="node.question"
        label="Vraag"
        subject="De vraag"
        test-id="question"
        :max="TEXT_MAX"
        :optional="false"
        :rows="2"
        :invalid="!!errorAt('questionText')"
      />
      <div class="field">
        <span class="label">Antwoorden</span>
        <p class="hint">Vink het goede antwoord aan.</p>
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
            <input
              :id="idp + '-a-' + a.id"
              :value="a.text"
              class="input"
              :class="{ invalid: !!errorAt(`answers.${i}.answerText`) }"
              :placeholder="`Antwoord ${LETTERS[i]}`"
              data-test="answer"
              @input="setAnswerText(a, $event)"
            />
            <button v-if="node.answers.length > 2" class="icon-btn" :aria-label="`Antwoord ${LETTERS[i]} verwijderen`" @click="removeAnswer(node, a.id)">
              <Icon name="x" :size="15" />
            </button>
          </div>
        </div>
        <button v-if="node.answers.length < 4" class="btn btn-sm btn-ghost add" data-test="add-answer" @click="addAnswer(node)"><Icon name="plus" :size="14" />Antwoord toevoegen</button>
        <p v-if="errorAt('answers')" class="hint err">{{ errorAt('answers') }}</p>
      </div>
      <!-- FR-017: only question steps have feedback. -->
      <DescriptionField
        :id="idp + '-feedback'"
        v-model="node.feedback"
        label="Feedback"
        subject="De feedback"
        test-id="feedback"
        :max="TEXT_MAX"
        :rows="2"
        :invalid="!!errorAt('feedback')"
      />
      <p class="hint feedback-hint">Wat de cursist na het antwoorden ziet.</p>
    </template>

    <div class="actions">
      <label class="start">
        <input type="checkbox" :checked="isStart" data-test="start" @change="ed.setStart($event.target.checked ? node.id : null)" />
        Startonderdeel
      </label>
      <button class="btn btn-sm btn-danger" data-test="remove-step" @click="remove">Verwijderen</button>
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
.add { justify-self: start; margin-left: -8px; }
.remove-video { justify-self: start; margin-left: -8px; }
.feedback-hint { margin-top: -12px; }
.start { display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer; }
.start input { accent-color: var(--brand); }
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
</style>
