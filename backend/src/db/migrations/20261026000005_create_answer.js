// Table Answer exactly as in the ERD (specs/004 data-model.md): 2 to 4 answers of a question
// step, exactly one of them correct (FR-013).
export async function up(knex) {
  await knex.schema.createTable('Answer', (table) => {
    table.increments('id').primary()
    table.integer('courseStepId').unsigned().notNullable()
      .references('id').inTable('CourseStep')
    // At most 255 characters; an answer that is not filled in yet is '' (data-model.md).
    table.string('answerText', 255).notNullable()
    table.boolean('isCorrect').notNullable()
    // 0–3: the order A–D in the editor.
    table.tinyint('sortOrder').notNullable()
    // ERD field for order and branching (FR-08); always NULL in this feature.
    table.integer('nextCourseStepId').unsigned().nullable()
      .references('id').inTable('CourseStep').onDelete('SET NULL')
    table.index(['courseStepId', 'sortOrder'])
  })
}

export async function down(knex) {
  await knex.schema.dropTable('Answer')
}
