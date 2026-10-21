const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://admin:StrongPassword123!@db:5432/clinic_management'
});

module.exports = pool;