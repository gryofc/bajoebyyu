import type { APIRoute } from 'astro';
import { getPool } from '../../lib/db';
import itemsData from '../../recipes/item.json';
import bcrypt from 'bcryptjs';

export const GET: APIRoute = async () => {
  const diagnostics: string[] = [];
  let connectionSuccess = false;
  let itemsTableCreated = false;
  let usersTableCreated = false;
  let itemsSeedStatus = 'skipped';
  let usersSeedStatus = 'skipped';
  let totalItemsInDb = 0;
  let totalUsersInDb = 0;
  let dbError = null;

  try {
    diagnostics.push('1. Attempting to connect to database using connection pool...');
    const pool = getPool();
    const connection = await pool.getConnection();
    diagnostics.push('   Connection acquired successfully!');
    connectionSuccess = true;

    // --- Migrate Items Table ---
    diagnostics.push('2. Creating items table if it does not exist...');
    const createItemsTableQuery = `
      CREATE TABLE IF NOT EXISTS items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shop_id BIGINT NULL,
        item_id BIGINT NULL,
        name VARCHAR(255) NOT NULL,
        url TEXT NULL,
        aff_url TEXT NOT NULL,
        image_url TEXT NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        discount_pct INT NULL,
        rating FLOAT NULL,
        sold_count INT NULL,
        location VARCHAR(255) NULL,
        is_mall TINYINT(1) NULL,
        currency VARCHAR(10) DEFAULT 'IDR',
        original_price DECIMAL(15, 2) NULL,
        rating_count INT NULL,
        category VARCHAR(255) NOT NULL,
        isNew TINYINT(1) NULL,
        tkp_url TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await connection.query(createItemsTableQuery);
    diagnostics.push('   Table "items" verified/created successfully!');
    itemsTableCreated = true;

    // --- Migrate Users Table ---
    diagnostics.push('3. Recreating users table with updated schema...');
    // Drop table first to ensure the exact requested schema is applied
    await connection.query('DROP TABLE IF EXISTS users');
    const createUsersTableQuery = `
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await connection.query(createUsersTableQuery);
    diagnostics.push('   Table "users" re-created successfully!');
    usersTableCreated = true;

    // --- Seed Items ---
    diagnostics.push('4. Checking if items exist in the database...');
    const [countItemsRows]: any = await connection.query('SELECT COUNT(*) as count FROM items');
    const itemsCount = countItemsRows[0].count;
    diagnostics.push(`   Current record count in "items" table: ${itemsCount}`);

    if (itemsCount === 0) {
      diagnostics.push('   Seeding items table with data from item.json...');
      const insertQuery = `
        INSERT INTO items (
          shop_id, item_id, name, url, aff_url, image_url, price, 
          discount_pct, rating, sold_count, location, is_mall, 
          currency, original_price, rating_count, category, isNew, tkp_url
        ) VALUES ?
      `;

      const values = itemsData.map((item: any) => [
        item.shop_id !== null ? BigInt(item.shop_id) : null,
        item.item_id !== null ? BigInt(item.item_id) : null,
        item.name,
        item.url || null,
        item.aff_url,
        item.image_url,
        item.price,
        item.discount_pct !== null ? item.discount_pct : null,
        item.rating !== null ? item.rating : null,
        item.sold_count !== null ? item.sold_count : null,
        item.location || null,
        item.is_mall ? 1 : 0,
        item.currency || 'IDR',
        item.original_price !== null ? item.original_price : null,
        item.rating_count !== null ? item.rating_count : null,
        item.category,
        item.isNew ? 1 : 0,
        item.tkp_url || null
      ]);

      await connection.query(insertQuery, [values]);
      diagnostics.push(`   Successfully seeded ${values.length} items!`);
      itemsSeedStatus = `success (seeded ${values.length} items)`;
      totalItemsInDb = values.length;
    } else {
      diagnostics.push('   Items table is already seeded. Skipping item seed.');
      itemsSeedStatus = 'skipped (data already exists)';
      totalItemsInDb = itemsCount;
    }

    // --- Seed Default Admin User ---
    diagnostics.push('5. Checking if users exist in the database...');
    const [countUsersRows]: any = await connection.query('SELECT COUNT(*) as count FROM users');
    const usersCount = countUsersRows[0].count;
    diagnostics.push(`   Current record count in "users" table: ${usersCount}`);

    if (usersCount === 0) {
      diagnostics.push('   Seeding default administrator account...');
      const defaultUser = 'admin';
      const defaultEmail = 'admin@byyu.com';
      const defaultPass = 'admin123';
      const hashedPassword = bcrypt.hashSync(defaultPass, 10);

      await connection.query(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [defaultUser, defaultEmail, hashedPassword]
      );
      
      diagnostics.push(`   Successfully seeded default user "${defaultUser}" with password "${defaultPass}" (encrypted) and email "${defaultEmail}"!`);
      usersSeedStatus = 'success (seeded default admin)';
      totalUsersInDb = 1;
    } else {
      diagnostics.push('   Users table is updated but data already exists. Skipping user seed.');
      usersSeedStatus = 'skipped (data already exists)';
      totalUsersInDb = usersCount;
    }

    // --- Migrate & Seed Blogs Table ---
    diagnostics.push('6. Recreating blogs table...');
    await connection.query('DROP TABLE IF EXISTS blogs');
    const createBlogsTableQuery = `
      CREATE TABLE blogs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        content TEXT NULL,
        status VARCHAR(50) DEFAULT 'Published',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await connection.query(createBlogsTableQuery);
    diagnostics.push('   Table "blogs" recreated successfully!');

    diagnostics.push('7. Seeding default blogs...');
    const seedBlogsQuery = `
      INSERT INTO blogs (title, category, status, created_at) VALUES
      ('Onyx Cashmere Overcoat', 'Product Update', 'Published', '2026-05-22 14:20:00'),
      ('The Philosophy of Minimalism', 'Blog Post', 'Draft', '2026-05-21 09:12:00'),
      ('Italian Leather Weekend Bag', 'Stock Update', 'Published', '2026-05-20 18:45:00'),
      ('Winter Collection Editorial', 'Blog Post', 'Published', '2026-05-19 11:30:00')
    `;
    await connection.query(seedBlogsQuery);
    diagnostics.push('   Successfully seeded default blogs!');

    connection.release();
  } catch (err: any) {
    dbError = err.message;
    diagnostics.push(`[ERROR] Database initialization failed: ${err.message}`);
    console.error('[db-init] Error initializing database:', err);
  }

  const responseBody = {
    status: connectionSuccess && itemsTableCreated && usersTableCreated ? 'success' : 'error',
    databaseConnection: connectionSuccess ? 'connected' : 'failed',
    tablesCreated: {
      items: itemsTableCreated ? 'verified_or_created' : 'failed',
      users: usersTableCreated ? 'verified_or_created' : 'failed'
    },
    seeding: {
      items: itemsSeedStatus,
      users: usersSeedStatus
    },
    recordsInDb: {
      items: totalItemsInDb,
      users: totalUsersInDb
    },
    error: dbError,
    diagnostics: diagnostics
  };

  return new Response(JSON.stringify(responseBody, null, 2), {
    status: responseBody.status === 'success' ? 200 : 500,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
