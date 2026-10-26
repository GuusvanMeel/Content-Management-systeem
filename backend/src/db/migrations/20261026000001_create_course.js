// Table Course exactly as in the ERD (specs/004 data-model.md). Name and description live in
// CourseVersion; ownership goes through OrganisationCourse.
export async function up(knex) {
  await knex.schema.createTable('Course', (table) => {
    table.increments('id').primary()
    // ERD field for the course library (FR-12); always NULL in this feature.
    table.integer('parentCourseId').unsigned().nullable()
      .references('id').inTable('Course')
    // ERD field for the course library (FR-12); always false in this feature.
    table.boolean('isSharedInLibrary').notNullable().defaultTo(false)
    table.datetime('createdAt').notNullable()
    // Set on create, save and delete; the course list is sorted on it.
    table.datetime('updatedAt').notNullable()
    // NULL = active; set = soft deleted (constitution V).
    table.datetime('deletedAt').nullable()
    table.index(['deletedAt', 'updatedAt'])
  })
}

export async function down(knex) {
  await knex.schema.dropTable('Course')
}
