export async function up(knex) {
  await knex.schema.createTable('OrganisationStyle', (table) => {
    table.increments('id').primary()
    // Unique: an organisation has 0 or 1 style.
    table.integer('organisationId').unsigned().notNullable().unique()
      .references('id').inTable('Organisation')
    // '#RRGGBB' in upper case; NULL = default value.
    table.specificType('primaryColour', 'char(7)').nullable()
    table.specificType('secondaryColour', 'char(7)').nullable()
    // File name in <UPLOADS_DIR>/logos/ (UUID + .png/.jpg/.svg); NULL = default logo.
    table.string('logoImage', 255).nullable()
  })
}

export async function down(knex) {
  await knex.schema.dropTable('OrganisationStyle')
}
