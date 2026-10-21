export async function up(knex) {
  await knex.schema.createTable('AdminActionLog', (table) => {
    table.increments('id').primary()
    table.integer('administratorId').unsigned().notNullable()
      .references('id').inTable('Administrator')
    // Stays valid because organisations are only soft-deleted.
    table.integer('organisationId').unsigned().notNullable()
      .references('id').inTable('Organisation')
    table.enu('action', ['create', 'update', 'delete', 'passwordReset']).notNullable()
    // Old and new values, never passwords or hashes (FR-027).
    table.json('details').nullable()
    table.datetime('createdAt').notNullable().index()
  })
}

export async function down(knex) {
  await knex.schema.dropTable('AdminActionLog')
}
