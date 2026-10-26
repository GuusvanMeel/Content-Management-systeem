// Table CourseStep exactly as in the ERD (specs/004 data-model.md): a video step or a question
// step of a course version. The kind is fixed when the step is created (FR-011).
export async function up(knex) {
  await knex.schema.createTable('CourseStep', (table) => {
    table.increments('id').primary()
    table.integer('courseVersionId').unsigned().notNullable()
      .references('id').inTable('CourseVersion')
    // At most one start step per version (FR-018); checked by the application.
    table.boolean('isStart').notNullable()
    table.enu('stepType', ['video', 'question']).notNullable()
    // ERD field; always NULL in this feature (FR-017).
    table.text('description').nullable()
    // Question steps only; empty = NULL (FR-017).
    table.text('feedback').nullable()
    // Video steps only; NULL = no video chosen yet. Kept when the video is soft deleted (FR-016).
    table.integer('videoId').unsigned().nullable()
      .references('id').inTable('Video')
    // Question steps only; an empty question is stored as '' (data-model.md).
    table.text('questionText').nullable()
    // ERD field for order and branching (FR-08); always NULL in this feature.
    table.integer('nextCourseStepId').unsigned().nullable()
      .references('id').inTable('CourseStep').onDelete('SET NULL')
    table.integer('positionX').notNullable()
    table.integer('positionY').notNullable()
    table.index(['courseVersionId'])
    table.index(['videoId'])
  })
  // Safety net for FR-012 / FR-013 (research R4); the application checks the same rules first.
  await knex.raw(`
    ALTER TABLE CourseStep ADD CONSTRAINT CourseStep_kind_check CHECK (
      (stepType = 'video' AND questionText IS NULL AND feedback IS NULL)
      OR (stepType = 'question' AND videoId IS NULL)
    )
  `)
}

export async function down(knex) {
  await knex.schema.dropTable('CourseStep')
}
