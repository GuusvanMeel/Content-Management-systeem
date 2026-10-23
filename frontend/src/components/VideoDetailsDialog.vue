<script setup>
// Video window over the library (specs/003 contracts/ui.md § Videovenster, FR-012, FR-012a).
// Everyone who sees a video can view it; only the owner can edit or delete it (FR-014).
import { computed, onMounted, reactive, ref } from 'vue'
import { deleteVideo, getVideo, listOtherOrganisations, updateVideo } from '../api/videos'
import { formatDate, formatDurationHms, formatSize } from '../lib/format'
import { confirmDialog, toast } from '../lib/ui'
import { confirmationText, countLosingAccess } from '../lib/videoAccess'
import AvailabilityPicker, { isAvailabilityValid } from './AvailabilityPicker.vue'
import DescriptionField from './DescriptionField.vue'
import Modal from './Modal.vue'
import OwnerPill from './OwnerPill.vue'

const props = defineProps({
  videoId: { type: Number, required: true },
  descriptionMaxLength: { type: Number, default: 1000 },
})
// `changed`: the library must reload (saved, deleted, or the video is no longer available).
// `filter-owner`: the pill of another organisation was clicked; the library filters on it (FR-025b).
const emit = defineEmits(['close', 'changed', 'filter-owner'])

const NOT_AVAILABLE = 'Deze video is niet meer beschikbaar.'
const VISIBILITY_TEXT = {
  public: 'Algemeen beschikbaar',
  private: 'Alleen eigen organisatie',
}

const video = ref(null)
const loadError = ref('')
const editing = ref(false)
const busy = ref(false)
const organisations = ref([])
const form = reactive({ name: '', description: '', availability: { visibility: 'private', accessOrganisationIds: [] } })
const fieldErrors = ref({})
const formError = ref('')

const isOwn = computed(() => video.value?.owner.isOwn === true)
const availabilityText = computed(() => {
  const v = video.value
  if (!v?.visibility) return ''
  if (v.visibility !== 'selective') return VISIBILITY_TEXT[v.visibility]
  const names = (v.accessOrganisations ?? []).map((o) => o.name)
  return names.length > 0
    ? `Selectief beschikbaar: ${names.join(', ')}`
    : 'Selectief beschikbaar: geen organisaties meer gekozen. Alleen jouw organisatie ziet deze video.'
})
const canSave = computed(() => !busy.value && isAvailabilityValid(form.availability))

function gone() {
  video.value = null
  editing.value = false
  loadError.value = NOT_AVAILABLE
  emit('changed')
}

onMounted(async () => {
  try {
    video.value = await getVideo(props.videoId)
  } catch (err) {
    if (err.status === 404) gone()
    else loadError.value = err.message
  }
})

const currentAvailability = () => ({
  visibility: video.value.visibility,
  accessOrganisationIds: (video.value.accessOrganisations ?? []).map((o) => o.id),
})

async function startEditing() {
  form.name = video.value.name
  form.description = video.value.description ?? ''
  form.availability = currentAvailability()
  fieldErrors.value = {}
  formError.value = ''
  editing.value = true
  try {
    organisations.value = await listOtherOrganisations()
  } catch {
    organisations.value = []
  }
}


async function save() {
  if (!canSave.value) return
  // Ask first when organisations lose access; widening is saved straight away (FR-017a).
  const lost = countLosingAccess(currentAvailability(), form.availability, organisations.value.map((o) => o.id))
  if (lost > 0) {
    const ok = await confirmDialog({ title: 'Beschikbaarheid beperken?', body: confirmationText(lost), confirmLabel: 'Wijzigen' })
    if (!ok) return
  }
  busy.value = true
  fieldErrors.value = {}
  formError.value = ''
  try {
    video.value = await updateVideo(props.videoId, {
      name: form.name,
      description: form.description,
      visibility: form.availability.visibility,
      accessOrganisationIds: form.availability.visibility === 'selective' ? form.availability.accessOrganisationIds : [],
    })
    editing.value = false
    toast('Wijzigingen opgeslagen')
    emit('changed')
  } catch (err) {
    if (err.status === 404) gone()
    else if (Object.keys(err.fields ?? {}).length > 0) fieldErrors.value = err.fields
    else formError.value = err.message
  } finally {
    busy.value = false
  }
}

async function remove() {
  const ok = await confirmDialog({
    title: 'Video verwijderen?',
    body: `“${video.value.name}” verdwijnt uit de videobibliotheek.`,
    confirmLabel: 'Verwijderen',
    danger: true,
  })
  if (!ok) return
  try {
    await deleteVideo(props.videoId)
    toast('Video verwijderd')
    emit('changed')
    emit('close')
  } catch (err) {
    if (err.status === 404) gone()
    else toast(err.message)
  }
}
</script>

<template>
  <Modal :title="video?.name ?? 'Video'" width="640px" @close="emit('close')">
    <p v-if="loadError" class="error" role="alert" data-test="load-error">{{ loadError }}</p>

    <div v-else-if="video && !editing" class="view" data-test="view">
      <img class="th" :src="video.thumbnailUrl" :alt="video.name" />
      <p class="owner"><OwnerPill :owner="video.owner" @filter="emit('filter-owner', $event)" /></p>
      <p v-if="video.description" class="description" data-test="description">{{ video.description }}</p>
      <dl class="facts">
        <dt>Duur</dt><dd>{{ formatDurationHms(video.durationSeconds) }}</dd>
        <dt>Grootte</dt><dd>{{ formatSize(video.fileSizeBytes) }}</dd>
        <dt>Geüpload op</dt><dd>{{ formatDate(video.uploadedAt) }}</dd>
        <template v-if="isOwn">
          <dt>Beschikbaarheid</dt><dd data-test="availability-text">{{ availabilityText }}</dd>
        </template>
      </dl>
    </div>

    <form v-else-if="video && editing" id="video-edit-form" class="edit" novalidate @submit.prevent="save">
      <label class="label" for="video-edit-name">Naam</label>
      <input id="video-edit-name" v-model="form.name" class="input" maxlength="255" data-test="edit-name" />
      <span v-if="fieldErrors.name" class="problem" role="alert">{{ fieldErrors.name }}</span>

      <DescriptionField v-model="form.description" class="spaced" id="video-edit-description" :max="descriptionMaxLength" :rows="4" />
      <span v-if="fieldErrors.description" class="problem" role="alert">{{ fieldErrors.description }}</span>

      <AvailabilityPicker v-model="form.availability" class="spaced" :organisations="organisations" id-prefix="video-edit" />
      <span v-if="fieldErrors.accessOrganisationIds || fieldErrors.visibility" class="problem" role="alert">
        {{ fieldErrors.accessOrganisationIds ?? fieldErrors.visibility }}
      </span>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
    </form>

    <template #foot>
      <template v-if="editing">
        <!-- FR-012a: cancelling closes the window without changing anything. -->
        <button type="button" class="btn btn-ghost" @click="emit('close')">Annuleren</button>
        <button type="submit" form="video-edit-form" class="btn btn-primary" :disabled="!canSave">Opslaan</button>
      </template>
      <template v-else>
        <template v-if="video && isOwn">
          <button type="button" class="btn btn-danger" @click="remove">Verwijderen</button>
          <button type="button" class="btn" @click="startEditing">Wijzigen</button>
        </template>
        <button type="button" class="btn btn-primary" @click="emit('close')">Sluiten</button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.view, .edit { display: grid; gap: 8px; }
.th { width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: var(--r); background: var(--surface-2); }
.owner { margin: 0; }
/* Line breaks of the description are kept; it is never rendered as HTML. */
.description { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 4px 0 0; font-size: 0.9rem; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; }
.label { font-size: 0.85rem; font-weight: 500; }
.spaced { margin-top: 8px; }
.problem { color: var(--err); font-weight: 500; font-size: 0.85rem; }
.error { padding: 8px 14px; border-radius: var(--r); background: var(--err-soft); color: var(--err); margin: 0; }
</style>
