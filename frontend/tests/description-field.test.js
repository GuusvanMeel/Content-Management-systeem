import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import DescriptionField from '../src/components/DescriptionField.vue'

// specs/003 FR-021, contracts/ui.md § Beschrijving invullen.

function mountField(initial = '', max = 1000) {
  const value = ref(initial)
  const wrapper = mount(DescriptionField, {
    props: { modelValue: value.value, max, id: 'd', 'onUpdate:modelValue': (v) => wrapper.setProps({ modelValue: v }) },
  })
  return wrapper
}

const counter = (wrapper) => wrapper.find('[data-test="description-counter"]')

describe('DescriptionField', () => {
  it('shows "N tekens over" and "1 teken over"', async () => {
    const wrapper = mountField()
    expect(counter(wrapper).text()).toBe('1000 tekens over')
    await wrapper.find('textarea').setValue('a'.repeat(999))
    expect(counter(wrapper).text()).toBe('1 teken over')
  })

  it('counts an emoji as one character, like the server', async () => {
    const wrapper = mountField()
    await wrapper.find('textarea').setValue('😀😀')
    expect(counter(wrapper).text()).toBe('998 tekens over')
  })

  it('turns red at 0 and keeps the text at the maximum', async () => {
    const wrapper = mountField('', 10)
    await wrapper.find('textarea').setValue('a'.repeat(10))
    expect(counter(wrapper).text()).toBe('0 tekens over')
    expect(counter(wrapper).classes()).toContain('limit')
    expect(wrapper.find('[data-test="description-cut"]').exists()).toBe(false)

    await wrapper.find('textarea').setValue('a'.repeat(11))
    expect(wrapper.find('textarea').element.value).toBe('a'.repeat(10))
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['a'.repeat(10)])
    expect(wrapper.find('[data-test="description-cut"]').text()).toBe(
      'De beschrijving mag maximaal 10 tekens zijn; de rest is niet overgenomen.',
    )
  })

  it('hides the red state and the message once the text is shorter again', async () => {
    const wrapper = mountField('', 10)
    await wrapper.find('textarea').setValue('a'.repeat(15))
    await wrapper.find('textarea').setValue('a'.repeat(5))
    expect(counter(wrapper).classes()).not.toContain('limit')
    expect(wrapper.find('[data-test="description-cut"]').exists()).toBe(false)
  })

  it('links the counter to the field for screen readers', () => {
    const wrapper = mountField()
    expect(wrapper.find('textarea').attributes('aria-describedby')).toBe('d-counter')
    expect(counter(wrapper).attributes('id')).toBe('d-counter')
  })
})
