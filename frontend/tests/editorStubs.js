// Vue Flow's Handle needs a canvas around it; blocks mounted on their own get a plain stand-in
// with the same class and slot, so tests can still count and read the connection points.
export const HandleStub = {
  name: 'Handle',
  props: ['id', 'type', 'position'],
  template: '<div class="vue-flow__handle" :data-handle="id"><slot /></div>',
}

export const editorStubs = { Handle: HandleStub }
