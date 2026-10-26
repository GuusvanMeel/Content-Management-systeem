// Table OrganisationCourse exactly as in the ERD (specs/004 data-model.md): which organisation
// has a course. In this feature every course has one row, its owner.
export async function up(knex) {
  await knex.schema.createTable('OrganisationCourse', (table) => {
    // Always taken from the session, never from input (FR-002, FR-003).
    table.integer('organisationId').unsigned().notNullable()
      .references('id').inTable('Organisation')
    table.integer('courseId').unsigned().notNullable()
      .references('id').inTable('Course')
    // Always true in this feature; shared courses (FR-12) will add rows with false.
    table.boolean('isOwner').notNullable()
    table.datetime('addedAt').notNullable()
    table.primary(['organisationId', 'courseId'])
    table.index(['courseId'])
  })
}

export async function down(knex) {
  await knex.schema.dropTable('OrganisationCourse')
}
