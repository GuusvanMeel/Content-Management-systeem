<script setup>
// Small inline icon set (stroke icons, 24px grid).
const props = defineProps({ name: String, size: { type: [Number, String], default: 16 } })
const P = {
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4.5v15l12.5-7.5z',
  film: 'M3 5h18v14H3zM7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4',
  question: 'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.2-1.5 2.3M12 17.5h.01M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  finish: 'M5 21V4M5 4h14v9H5M9 4v9M13 4v9M5 8.5h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 3 2 20h20L12 3zM12 10v4.5M12 17.5h.01',
  info: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zM12 11v6M12 7.5h.01',
  left: 'M15 18l-6-6 6-6',
  down: 'M6 9l6 6 6-6',
  right: 'M9 6l6 6-6 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  cloud: 'M12 13v8M8.5 16.5 12 13l3.5 3.5M20 16.6A5 5 0 0 0 17.5 7h-1.3A8 8 0 1 0 4 15.3',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  layout: 'M4 4h6v6H4zM14 14h6v6h-6zM7 10v4h7M17 10V4',
  zoomin: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomout: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3M8 11h6',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  panel: 'M3 4h18v16H3zM15 4v16',
  canvas: 'M5 4h6v5H5zM13 15h6v5h-6zM8 9v3.5h8V15',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  globe: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zM2.5 12h19M12 2.5c2.5 2.6 3.8 5.8 3.8 9.5s-1.3 6.9-3.8 9.5c-2.5-2.6-3.8-5.8-3.8-9.5S9.5 5.1 12 2.5z',
  headset: 'M3 10.5c0-1.7 1.3-3 3-3h12c1.7 0 3 1.3 3 3v4c0 1.7-1.3 3-3 3h-3l-1.5-2h-3L9 17.5H6c-1.7 0-3-1.3-3-3z',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  logout: 'M15 4h4v16h-4M10 16l4-4-4-4M14 12H3',
  restart: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5',
  skip: 'M5 5v14l9-7zM18 5v14',
  building: 'M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18',
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    style="flex-shrink: 0"
  >
    <path :d="P[name] ?? P.info" :fill="name === 'play' || name === 'skip' ? 'currentColor' : 'none'" />
  </svg>
</template>
