const { Pool } = require('pg');
require('dotenv').config();

// Railway te da la variable DATABASE_URL automáticamente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido por Railway para conexiones seguras
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};