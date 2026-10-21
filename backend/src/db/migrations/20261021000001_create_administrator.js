export async function up(knex) {
  await knex.schema.createTable('Administrator', (table) => {
    table.increments('id').primary()
    // Trimmed, 3–100 characters; only created through scripts/create-admin.js.
    table.string('username', 100).notNullable().unique()
    // argon2id hash; the password itself is 10–128 characters (FR-013).
    table.string('passwordHash', 255).notNullable()
  })
}

export async function down(knex) {
  await knex.schema.dropTable('Administrator')
}
