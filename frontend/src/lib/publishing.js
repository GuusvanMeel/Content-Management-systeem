import { useApp } from '../stores/app'
import { confirmDialog, toast } from './ui'

export function usePublishing() {
  const app = useApp()

  async function publishCourse(course) {
    if (!app.validation(course).canPublish) return false
    const ok = await confirmDialog({
      title: 'Cursus publiceren?',
      body: course.publishedVersion
        ? 'Headsets krijgen de nieuwe versie bij de volgende keer dat ze verbinden.'
        : 'De cursus wordt beschikbaar op de headsets van je organisatie.',
      confirmLabel: 'Publiceren',
    })
    if (!ok) return false
    app.publish(course)
    toast('Gepubliceerd')
    return true
  }

  async function unpublishCourse(course) {
    const ok = await confirmDialog({
      title: 'Publicatie intrekken?',
      body: 'De cursus verdwijnt van de headsets. Je kunt hem later opnieuw publiceren.',
      confirmLabel: 'Intrekken',
      danger: true,
    })
    if (!ok) return false
    app.unpublish(course)
    toast('Publicatie ingetrokken')
    return true
  }

  return { publishCourse, unpublishCourse }
}
