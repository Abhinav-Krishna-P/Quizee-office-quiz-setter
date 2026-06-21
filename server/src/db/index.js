import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const pool = new pg.Pool({
  connectionString,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

export const query = (text, params) => pool.query(text, params);

export const initDb = async () => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('Database initialized successfully.');

    // Seed default admin if none exists
    const adminCheck = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCheck.rows[0].count, 10) === 0) {
      // Create a default admin: admin@officequiz.com / admin123
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO admins (email, password_hash) VALUES ($1, $2)',
        ['admin@officequiz.com', hash]
      );
      console.log('Default admin seeded: admin@officequiz.com / admin123');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};


export default pool;
