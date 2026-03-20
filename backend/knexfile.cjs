const path = require('path');

const connection = process.env.DATABASE_URL;
if (!connection) {
  throw new Error('DATABASE_URL is required for Knex migrations');
}

const migrationsDir = path.join(__dirname, 'migrations');

const common = {
  client: 'pg',
  connection,
  migrations: {
    directory: migrationsDir,
    extension: 'cjs',
    loadExtensions: ['.cjs'],
  },
};

module.exports = {
  development: { ...common },
  production: { ...common },
  test: { ...common },
};
