<script setup>
import { useAuth } from '../stores/auth'

const auth = useAuth()
</script>

<template>
  <div class="page narrow">
    <div class="page-head"><h1>Welkom, {{ auth.organisation?.name }}</h1></div>
    <section class="card">
      <p class="muted">Kies waar je verder wilt werken.</p>
      <div class="links">
        <RouterLink to="/courses" class="btn btn-primary">Cursussen</RouterLink>
        <RouterLink to="/videos" class="btn">Video’s</RouterLink>
        <RouterLink to="/settings/style" class="btn">Huisstijl</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.card > p { margin-top: 0; }
.links { display: flex; gap: 8px; flex-wrap: wrap; }
.links a { text-decoration: none; }
</style>
