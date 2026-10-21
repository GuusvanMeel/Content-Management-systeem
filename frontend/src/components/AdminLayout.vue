<script setup>
// Shell of the admin environment; always in the default house style (FR-026).
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { useStyle } from '../stores/style'
import { defaultStyle } from '../config/defaultStyle'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

onMounted(() => useStyle().applyDefault())

async function logout() {
  router.push(await auth.logout())
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink to="/admin" class="topbar-org">
        <span class="logo-tile"><img :src="defaultStyle.logoUrl" alt="" /></span>
        <span class="topbar-name">Beheer</span>
      </RouterLink>
      <nav class="nav" aria-label="Beheermenu">
        <RouterLink to="/admin" :class="{ on: route.path === '/admin' || route.path.startsWith('/admin/organisations') }">
          Organisaties
        </RouterLink>
        <RouterLink to="/admin/log" active-class="on">Logboek</RouterLink>
      </nav>
      <span class="topbar-user">{{ auth.username }}</span>
      <button class="topbar-logout" @click="logout">Uitloggen</button>
    </header>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.logo-tile { display: inline-flex; height: 28px; background: #fff; border-radius: 6px; padding: 3px; }
.logo-tile img { height: 100%; width: auto; }
.topbar-user { opacity: 0.8; font-size: 0.9rem; }
</style>
