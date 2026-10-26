// Table CourseVersion exactly as in the ERD (specs/004 data-model.md). The draft is the version
// without publishedAt; in this feature every course has exactly one version, the draft.
export async function up(knex) {
  await knex.schema.createTable('CourseVersion', (table) => {
    table.increments('id').primary()
    table.integer('courseId').unsigned().notNullable()
      .references('id').inTable('Course')
    // 1 for the draft in this feature; versions (FR-11) come later.
    table.integer('versionNumber').notNullable()
    // Required, trimmed, at most 255 characters (FR-001, FR-026).
    table.string('name', 255).notNullable()
    // Required, trimmed, at most 1000 characters (FR-001, FR-026).
    table.text('description').notNullable()
    // NULL = draft (open version); always NULL in this feature (FR-008).
    table.datetime('publishedAt').nullable()
    table.unique(['courseId', 'versionNumber'])
  })
}

export async function down(knex) {
  await knex.schema.dropTable('CourseVersion')
}
