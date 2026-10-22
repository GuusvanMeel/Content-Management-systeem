// Table Video exactly as in the ERD (specs/002 data-model.md). No status, failure reason or
// upload progress: a row only exists after a successful verification. VideoAccess (FR-14) is
// not created yet.
export async function up(knex) {
  await knex.schema.createTable('Video', (table) => {
    table.increments('id').primary()
    // Always taken from the session, never from input (FR-021, FR-022).
    table.integer('ownerOrganisationId').unsigned().notNullable()
      .references('id').inTable('Organisation')
    table.string('name', 255).notNullable()
    // ERD field for later; always NULL in this feature.
    table.text('description').nullable()
    // videos/<organisationId>/<uuid>.mp4, relative to VIDEOS_DIR (research R2).
    table.string('storageKey', 500).notNullable().unique()
    // thumbnails/<organisationId>/<uuid>.jpg; always set in this feature.
    table.string('thumbnailStorageKey', 500).nullable()
    table.bigInteger('fileSizeBytes').notNullable()
    // Whole seconds; always set in this feature.
    table.integer('durationSeconds').nullable()
    // Always 'private' in this feature; choosing it belongs to FR-14.
    table.enu('visibility', ['public', 'selective', 'private']).notNullable()
    // UTC: the moment the verification succeeded and the row was inserted.
    table.datetime('uploadedAt').notNullable()
    // NULL = in the library; set = soft deleted (constitution V).
    table.datetime('deletedAt').nullable()
    table.index(['ownerOrganisationId', 'deletedAt', 'uploadedAt'])
  })
}

export async function down(knex) {
  await knex.schema.dropTable('Video')
}
