// Table VideoAccess exactly as in the ERD (specs/003 data-model.md): which organisations may see a
// video with visibility 'selective'. It only holds rows for such videos; Video itself is unchanged.
export async function up(knex) {
  await knex.schema.createTable('VideoAccess', (table) => {
    table.integer('videoId').unsigned().notNullable()
      .references('id').inTable('Video')
    table.integer('organisationId').unsigned().notNullable()
      .references('id').inTable('Organisation')
    table.primary(['videoId', 'organisationId'])
    // Looking up "videos shared with me" (research R2).
    table.index(['organisationId'])
  })
}

export async function down(knex) {
  await knex.schema.dropTable('VideoAccess')
}
