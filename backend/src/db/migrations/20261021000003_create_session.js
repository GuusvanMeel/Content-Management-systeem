export async function up(knex) {
  await knex.schema.createTable('Session', (table) => {
    table.increments('id').primary()
    // SHA-256 (hex) of the cookie token; the token itself is never stored.
    table.specificType('tokenHash', 'char(64)').notNullable().unique()
    table.integer('administratorId').unsigned().nullable()
      .references('id').inTable('Administrator').onDelete('CASCADE')
    table.integer('organisationId').unsigned().nullable().index()
      .references('id').inTable('Organisation')
    table.datetime('createdAt').notNullable()
    // Sliding timeout: valid while lastActivityAt >= UTC_TIMESTAMP() - timeout (FR-019).
    table.datetime('lastActivityAt').notNullable().index()
  })
  await knex.raw(
    'ALTER TABLE `Session` ADD CONSTRAINT `Session_owner_check` ' +
      'CHECK ((`administratorId` IS NULL) <> (`organisationId` IS NULL))',
  )
}

export async function down(knex) {
  await knex.schema.dropTable('Session')
}
