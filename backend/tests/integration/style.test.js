import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { logosDir } from '../../src/modules/style/styleService.js'
import { PNG_BYTES } from '../helpers/images.js'
import { agentWithSession, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'

let organisation
let agent

beforeEach(async () => {
  await resetDatabase()
  organisation = await createOrganisationRow()
  agent = (await agentWithSession({ organisationId: organisation.id })).agent
})

const uploadPng = () => agent.put('/api/organisation/style/logo').attach('logo', PNG_BYTES, 'logo.png')
const logoFiles = () => (existsSync(logosDir()) ? readdirSync(logosDir()) : [])
const styleRow = () => db('OrganisationStyle').where({ organisationId: organisation.id }).first()

describe('house style (FR-023 – FR-025)', () => {
  it('uses the default style when nothing is set', async () => {
    const res = await agent.get('/api/organisation/style')
    expect(res.body).toEqual({
      primaryColour: { value: '#2C4A6E', isDefault: true },
      secondaryColour: { value: '#9AA9BC', isDefault: true },
      logo: { url: '/default-logo.svg', isDefault: true },
    })
  })

  it('stores colours in upper case and keeps other parts at default', async () => {
    const res = await agent.put('/api/organisation/style').send({ primaryColour: '#0055a4' })
    expect(res.status).toBe(200)
    expect(res.body.primaryColour).toEqual({ value: '#0055A4', isDefault: false })
    expect(res.body.secondaryColour.isDefault).toBe(true)
    expect((await styleRow()).primaryColour).toBe('#0055A4')
  })

  it('rejects invalid colours', async () => {
    for (const value of ['red', '#12345', '#GGGGGG']) {
      const res = await agent.put('/api/organisation/style').send({ primaryColour: value })
      expect(res.status, value).toBe(400)
      expect(res.body.error.fields.primaryColour).toBeTruthy()
    }
  })

  it('removes the row when all parts are back to default', async () => {
    await agent.put('/api/organisation/style').send({ primaryColour: '#0055A4' })
    const res = await agent.put('/api/organisation/style').send({ primaryColour: null })
    expect(res.body.primaryColour.isDefault).toBe(true)
    expect(await styleRow()).toBeUndefined()
  })

  it('uploads, replaces and removes a logo on disk', async () => {
    const first = await uploadPng()
    expect(first.status).toBe(200)
    expect(first.body.logo.url).toMatch(/^\/media\/logos\/[0-9a-f-]{36}\.png$/)
    expect(logoFiles()).toEqual([path.basename(first.body.logo.url)])

    const second = await uploadPng()
    expect(logoFiles()).toEqual([path.basename(second.body.logo.url)])

    const removed = await agent.delete('/api/organisation/style/logo')
    expect(removed.body.logo).toEqual({ url: '/default-logo.svg', isDefault: true })
    expect(logoFiles()).toEqual([])
  })

  it('rejects a too large or invalid logo and keeps the previous one', async () => {
    const first = await uploadPng()

    const tooLarge = await agent
      .put('/api/organisation/style/logo')
      .attach('logo', Buffer.concat([PNG_BYTES, Buffer.alloc(3 * 1024 * 1024)]), 'big.png')
    expect(tooLarge.status).toBe(413)
    expect(tooLarge.body.error).toEqual({ code: 'logo_too_large', message: 'Het logo mag maximaal 2 MB zijn.' })

    const invalid = await agent.put('/api/organisation/style/logo').attach('logo', Buffer.from('not an image'), 'fake.png')
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('invalid_logo')

    const current = await agent.get('/api/organisation/style')
    expect(current.body.logo.url).toBe(first.body.logo.url)
    expect(logoFiles()).toEqual([path.basename(first.body.logo.url)])
  })

  it('resets the whole style', async () => {
    await agent.put('/api/organisation/style').send({ primaryColour: '#0055A4', secondaryColour: '#FFD100' })
    await uploadPng()

    const res = await agent.delete('/api/organisation/style')
    expect(res.body.primaryColour.isDefault).toBe(true)
    expect(res.body.logo.isDefault).toBe(true)
    expect(await styleRow()).toBeUndefined()
    expect(logoFiles()).toEqual([])
  })
})
