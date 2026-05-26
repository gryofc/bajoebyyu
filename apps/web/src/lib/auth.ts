import bcrypt from 'bcryptjs';
import { getPool, ensureDbInitialized } from './db';

/**
 * Verifies user credentials against the MySQL database.
 * If database connection fails (or is offline), it falls back to standard developer credentials
 * to ensure that local development is uninterrupted and fully testable.
 */
export async function verifyUser(username: string, pass: string): Promise<{ success: boolean; fallback: boolean; error?: string }> {
  try {
    // Run automated DB schema checks and migrations
    await ensureDbInitialized();
    
    const pool = getPool();
    
    // Attempt database-backed validation
    const [rows]: any = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (rows && rows.length > 0) {
      const user = rows[0];
      const match = await bcrypt.compare(pass, user.password);
      if (match) {
        return { success: true, fallback: false };
      }
    }
    
    return { success: false, fallback: false, error: 'Invalid username or password' };
  } catch (error: any) {
    console.warn(`[Auth Warning] Database-backed validation failed: ${error.message}. Running fallback validator.`);
    
    // Safe fallback verification (for local development and offline database states)
    if (username === 'admin' && pass === 'admin123') {
      return { success: true, fallback: true };
    }
    
    return { success: false, fallback: true, error: 'Invalid credentials (fallback mode)' };
  }
}
