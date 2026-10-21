<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { defaultStyle } from '../config/defaultStyle'
import { safeRedirect } from '../lib/redirect'
import { useAuth } from '../stores/auth'
import { useStyle } from '../stores/style'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

const NOTICES = { expired: 'Je sessie is verlopen. Log opnieuw in.', logout: 'Je bent uitgelogd.' }
const notice = computed(() => NOTICES[route.query.reason] ?? '')

onMounted(() => useStyle().applyDefault())

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.loginAdmin(username.value, password.value)
    router.replace(safeRedirect(route.query.redirect, { admin: true }) ?? '/admin')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <form class="auth-card" @submit.prevent="submit">
      <img :src="defaultStyle.logoUrl" alt="" class="auth-logo" />
      <h1>Inloggen als beheerder</h1>
      <p v-if="notice" class="notice" role="status">{{ notice }}</p>

      <div class="field">
        <label for="admin-username">Gebruikersnaam</label>
        <input id="admin-username" v-model="username" class="input" autocomplete="username" required autofocus />
      </div>
      <div class="field">
        <label for="admin-password">Wachtwoord</label>
        <input id="admin-password" v-model="password" type="password" class="input" autocomplete="current-password" required />
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" :disabled="busy">Inloggen</button>
    </form>
  </div>
</template>
