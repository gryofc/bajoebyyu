import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fallbackItems from '../recipes/item.json';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BLOGS_JSON_PATH = path.resolve(__dirname, '../recipes/blogs.json');

let pool: mysql.Pool | null = null;
let isInitialized = false;
let initializingPromise: Promise<void> | null = null;

export function getPool() {
  if (!pool) {
    const DB_HOST = import.meta.env?.DB_HOST || process.env?.DB_HOST || 'localhost';
    const DB_USER = import.meta.env?.DB_USER || process.env?.DB_USER || 'root';
    const DB_PASSWORD = import.meta.env?.DB_PASSWORD || process.env?.DB_PASSWORD || '';
    const DB_NAME = import.meta.env?.DB_NAME || process.env?.DB_NAME || 'bajoebyyu';
    const DB_PORT = parseInt(import.meta.env?.DB_PORT || process.env?.DB_PORT || '3306', 10);

    console.log(`[Database] Initializing MySQL connection pool for ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);

    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 5000, // 5 seconds timeout so it fails quickly if blocked
    });
  }
  return pool;
}

export async function ensureDbInitialized(): Promise<void> {
  if (isInitialized) return;
  if (initializingPromise) return initializingPromise;

  initializingPromise = (async () => {
    try {
      console.log('[Database] Running automatic connection checks and migrations...');
      const connectionPool = getPool();
      
      // Acquire a connection to test and run migrations
      const connection = await connectionPool.getConnection();
      
      try {
        // 1. Create items table if it doesn't exist
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

        // 2. Create users table if it doesn't exist
        const createUsersTableQuery = `
          CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await connection.query(createUsersTableQuery);

        // 3. Seed items table if it has 0 items
        const [countItemsRows]: any = await connection.query('SELECT COUNT(*) as count FROM items');
        if (countItemsRows && countItemsRows[0] && countItemsRows[0].count === 0) {
          console.log('[Database] Items table is empty. Executing automatic items seed from item.json...');
          const insertQuery = `
            INSERT INTO items (
              shop_id, item_id, name, url, aff_url, image_url, price, 
              discount_pct, rating, sold_count, location, is_mall, 
              currency, original_price, rating_count, category, isNew, tkp_url
            ) VALUES ?
          `;
          const values = fallbackItems.map((item: any) => [
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
          console.log(`[Database] Successfully seeded ${values.length} clothing items.`);
        }

        // 4. Seed default admin user if users table has 0 users
        const [countUsersRows]: any = await connection.query('SELECT COUNT(*) as count FROM users');
        if (countUsersRows && countUsersRows[0] && countUsersRows[0].count === 0) {
          console.log('[Database] Users table is empty. Seeding default administrator account...');
          const defaultUser = 'admin';
          const defaultEmail = 'admin@byyu.com';
          const defaultPass = 'admin123';
          const hashedPassword = bcrypt.hashSync(defaultPass, 10);
          await connection.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [defaultUser, defaultEmail, hashedPassword]
          );
          console.log(`[Database] Seeded default user "${defaultUser}" successfully.`);
        }

        // 5. Create blogs table if it doesn't exist
        const createBlogsTableQuery = `
          CREATE TABLE IF NOT EXISTS blogs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(255) NOT NULL,
            content TEXT NULL,
            status VARCHAR(50) DEFAULT 'Published',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await connection.query(createBlogsTableQuery);

        // 6. Seed default blogs if empty or containing old seed
        const [oldSeedCheck]: any = await connection.query('SELECT COUNT(*) as count FROM blogs WHERE title = ?', ['Onyx Cashmere Overcoat']);
        const [totalCountCheck]: any = await connection.query('SELECT COUNT(*) as count FROM blogs');
        const needsSeeding = totalCountCheck[0].count === 0 || oldSeedCheck[0].count > 0;
        
        if (needsSeeding) {
          console.log('[Database] Seeding 20 high-quality streetwear/fashion Indonesian blog posts...');
          // Clean existing old seeded/mock entries to prevent duplicates and ensure a fresh set
          await connection.query('DELETE FROM blogs WHERE title IN (?, ?, ?, ?) OR id <= 4', [
            'Onyx Cashmere Overcoat',
            'The Philosophy of Minimalism',
            'Italian Leather Weekend Bag',
            'Winter Collection Editorial'
          ]);
          
          // Seed the 20 new high-quality streetwear/fashion blog entries
          const seedBlogsQuery = `
            INSERT INTO blogs (title, category, content, status, created_at) VALUES ?
          `;
          const blogValues = [
            [
              'Evolusi Streetwear di Indonesia: Dari Komunitas Subkultur ke Kiblat Fashion',
              'THEORY',
              'Streetwear di Indonesia telah menempuh perjalanan panjang dari sekadar tren subkultur komunitas skateboard dan musik independen menjadi pilar utama industri fashion modern. Desain dengan siluet oversized, detail grafis minimalis, dan pesan orisinalitas kini mendominasi panggung gaya perkotaan. Artikel ini mengupas bagaimana brand lokal sukses memadukan estetika global dengan sensitivitas budaya nusantara, menciptakan identitas baru yang berani dan relevan.',
              'Published',
              '2026-05-22 14:00:00'
            ],
            [
              'Minimalisme Brutalis: Mengapa Kaos Oversized Tetap Mendominasi Tren',
              'THEORY',
              'Tren oversized t-shirt bukan sekadar kenyamanan sementara, melainkan sebuah pernyataan estetika brutalism yang menekankan proporsi ekstrem dan kejujuran bentuk. Tanpa lekukan tubuh yang menonjol, pakaian oversized memberikan kebebasan bergerak sekaligus menciptakan siluet arsitektural yang kuat bagi pemakainya. Temukan alasan mengapa potongan longgar tetap menjadi raja di lemari pakaian minimalis Anda.',
              'Published',
              '2026-05-21 16:30:00'
            ],
            [
              'Panduan Memilih Bahan Katun Heavyweight Terbaik untuk Kaos Streetwear Premium',
              'SUSTAINABILITY',
              'Kualitas pakaian streetwear kelas atas sangat ditentukan oleh pemilihan material kain. Kain katun heavyweight dengan gramasi berkisar antara 200 gsm hingga 240 gsm menawarkan struktur siluet boxy yang kokoh serta ketahanan luar biasa meskipun dicuci berulang kali. Ketahui perbedaan karakteristik pintalan benang combed dan carded agar Anda tidak salah berinvestasi pada produk fashion berkualitas premium.',
              'Published',
              '2026-05-20 11:15:00'
            ],
            [
              'Konstruksi Ruang Ganti Minimalis: Merancang Wardrobe Estetik dengan Konsep AD7ERclo',
              'INTERIORS',
              'Menata ruang penyimpanan pakaian pribadi membutuhkan pendekatan arsitektural yang matang untuk menghadirkan ketenangan visual. Melalui integrasi material beton ekspos, gantungan stainless steel industri, serta pencahayaan linear yang lembut, ruang ganti Anda dapat diubah menjadi galeri seni mini. Pelajari panduan praktis penataan baju dengan skema warna terorganisasi demi kepuasan visual harian.',
              'Published',
              '2026-05-19 09:45:00'
            ],
            [
              'Eksplorasi Monokrom dalam Fotografi Streetwear Jalanan Jakarta',
              'PHOTOGRAPHY',
              'Fotografi streetwear monokrom adalah metode terbaik untuk menangkap kontras tajam antara siluet pakaian modern dengan brutalnya arsitektur kota Jakarta. Cahaya matahari tropis yang terik menciptakan bayangan geometris tegas pada dinding beton galeri dan gedung tua, menonjolkan tekstur pakaian tanpa distraksi warna. Mari pelajari teknik komposisi shadow and light untuk memperkuat portofolio fashion editorial Anda.',
              'Published',
              '2026-05-18 17:20:00'
            ],
            [
              'Slow Fashion di Indonesia: Langkah Nyata Menuju Industri Gaya yang Berkelanjutan',
              'SUSTAINABILITY',
              'Konsumsi pakaian yang cepat rusak membebani kelestarian bumi kita. Konsep slow fashion hadir mengajak kita semua untuk memilih kualitas di atas kuantitas. Dengan memproduksi pakaian dalam volume kecil, menggunakan bahan serat alami organik yang ramah lingkungan, serta memastikan kesejahteraan pekerja lokal, industri kreatif tanah air kini bergeser menuju era fashion yang lebih bertanggung jawab dan etis.',
              'Published',
              '2026-05-17 10:00:00'
            ],
            [
              'Psikologi Warna Hitam: Kekuatan Tersembunyi dalam Desain Busana Avant-Garde',
              'THEORY',
              'Warna hitam melambangkan misteri, otoritas, dan keheningan mutlak. Dalam ranah mode avant-garde, ketiadaan warna memaksa mata untuk sepenuhnya fokus pada detail konstruksi jahitan, tekstur kain, dan keunikan siluet potongan baju. Pahami mengapa desainer legendaris dunia selalu memilih palet hitam untuk menyampaikan pesan-pesan filosofis yang paling mendalam.',
              'Published',
              '2026-05-16 14:10:00'
            ],
            [
              'Menghidupkan Kembali Estetika Brutalisme dalam Arsitektur Ritel Fashion Modern',
              'INTERIORS',
              'Brutalisme arsitektur yang mengandalkan kejujuran tekstur beton mentah kini menjadi elemen interior terfavorit bagi butik ritel streetwear global. Suasana klinis, dingin, dan luas memberikan ruang bagi koleksi pakaian untuk tampil menonjol sebagai fokus utama pameran. Temukan rahasia di balik perpaduan material semen ekspos, kaca, dan logam dalam melahirkan pengalaman belanja premium.',
              'Published',
              '2026-05-15 11:30:00'
            ],
            [
              'Seni Bermain Siluet: Oversized Outerwear untuk Proporsi Tubuh Asia',
              'THEORY',
              'Menggunakan luaran bermodel oversized sering kali menjadi tantangan tersendiri bagi orang Asia dengan postur tubuh sedang. Kunci utamanya terletak pada teknik layering dan keseimbangan proporsi tubuh atas dan bawah. Memadukan mantel bersiluet boxy dengan celana bersiluet lurus (straight-cut pants) akan memberikan ilusi tinggi badan yang seimbang sekaligus mempertahankan impresi gaya street fashion yang modern.',
              'Published',
              '2026-05-14 15:50:00'
            ],
            [
              'Fotografi Lookbook: Teknik Pencahayaan Studio untuk Produk Fashion Monokrom',
              'PHOTOGRAPHY',
              'Menciptakan lookbook komersial yang memikat memerlukan kontrol pencahayaan yang sangat presisi untuk menonjolkan keunikan garmen monokromatik. Penggunaan teknik softbox searah dan reflektor abu-abu dapat memunculkan gradasi gelap terang yang dramatis pada lipatan pakaian hitam dan putih. Dapatkan panduan lengkap mengatur setup lighting studio agar detail produk Anda terlihat tajam dan profesional.',
              'Published',
              '2026-05-13 13:20:00'
            ],
            [
              'Pentingnya Upcycling: Mengubah Sisa Bahan Katun Menjadi Aksesori Premium',
              'SUSTAINABILITY',
              'Upcycling adalah seni mentransformasikan limbah kain produksi menjadi barang baru dengan nilai estetika yang jauh lebih tinggi. Daripada membiarkan potongan kain katun heavyweight terbuang di tempat pembuangan akhir, pengrajin lokal mendesain ulang sisa bahan menjadi tas jinjing minimalis, topi bucket serbaguna, hingga strap kamera. Inilah perwujudan nyata sirkular ekonomi dalam dunia fashion kreatif.',
              'Published',
              '2026-05-12 09:10:00'
            ],
            [
              'Desain Interior Butik Minimalis: Menghadirkan Suasana Galeri Seni di Ruang Ritel',
              'INTERIORS',
              'Showroom fashion modern bukan lagi sekadar tempat bertransaksi jual beli, melainkan ruang kontemplasi artistik bagi para pelanggan. Dengan meminimalkan jumlah gantungan baju dan memanfaatkan konsep pencahayaan museum, setiap pakaian yang digantung diperlakukan layaknya karya seni berharga tinggi. Simak filosofi desain ritel modern yang mengutamakan kualitas pengalaman spasial.',
              'Published',
              '2026-05-11 16:40:00'
            ],
            [
              'Sejarah Gaya Cargo Pants: Dari Perlengkapan Militer Hingga Ikon Streetwear',
              'THEORY',
              'Celana kargo yang awalnya dirancang untuk kebutuhan prajurit militer Inggris pada dekade 1930-an kini telah berevolusi menjadi salah satu fashion item wajib bagi pecinta streetwear modern. Fleksibilitas kantong utilitas dipadukan dengan material katun ripstop premium menciptakan fungsionalitas tingkat tinggi yang sangat dicintai oleh generasi muda yang aktif di area perkotaan.',
              'Published',
              '2026-05-10 10:15:00'
            ],
            [
              'Evolusi Kultur Sneakers dalam Melengkapi Estetika Oversized Fit',
              'THEORY',
              'Sneakers tidak pernah bisa dipisahkan dari perkembangan kultur pakaian streetwear global. Sepatu dengan sol tebal (chunky sneakers) atau siluet klasik minimalis berbahan kulit premium bertindak sebagai jangkar visual yang sempurna untuk menyangga potongan celana longgar. Temukan panduan praktis memadukan model sepatu kasual favorit demi menyempurnakan outfit oversized harian Anda.',
              'Published',
              '2026-05-09 14:00:00'
            ],
            [
              'Bagaimana Cara Merawat Pakaian Katun Heavyweight Agar Awet dan Tidak Menyusut',
              'SUSTAINABILITY',
              'Membeli kaos katun premium berkualitas tinggi adalah langkah investasi gaya jangka panjang, namun perawatan yang salah dapat merusak struktur serat kain. Gunakan air dingin saat mencuci, hindari mesin pengering bersuhu panas tinggi, dan jemur pakaian secara horizontal untuk menghindari peregangan bahu baju. Rawat koleksi katun heavyweight kesayangan Anda agar tetap kokoh bertahun-tahun.',
              'Published',
              '2026-05-08 08:30:00'
            ],
            [
              'Menangkap Karakter Kain Melalui Lensa Makro: Fotografi Detail Tekstil Fashion',
              'PHOTOGRAPHY',
              'Kualitas kerajinan tangan dari brand premium sering kali tersembunyi pada kerapatan tenunan benang dan presisi jahitan tepinya. Melalui teknik fotografi makro beresolusi tinggi, kita dapat mengekspos kemewahan tekstur bahan linen organik atau kelembutan fleece premium secara dramatis. Artikel edukatif ini menyajikan tips makrofotografi untuk menaikkan nilai estetika visual lookbook digital Anda.',
              'Published',
              '2026-05-07 11:20:00'
            ],
            [
              'Kombinasi Tekstur: Memadukan Heavy Linen dengan Katun Organik Minimalis',
              'SUSTAINABILITY',
              'Bermain dengan kontras permukaan kain adalah teknik rahasia dalam menciptakan gaya monokrom yang dinamis dan tidak membosankan. Serat kasar alami dari kain heavy linen berpadu sangat selaras dengan kehalusan kaos katun organik yang lembut. Kombinasi dua material ramah lingkungan ini menawarkan kesejukan optimal bagi tubuh sekaligus memperkaya dimensi visual busana kasual Anda.',
              'Published',
              '2026-05-06 15:45:00'
            ],
            [
              'Filosofi Keheningan Spasial: Menghadirkan Suasana Tenang dalam Desain Showroom',
              'INTERIORS',
              'Desain interior yang terlalu ramai dapat menimbulkan kecemasan sensorik bagi pengunjung toko ritel. Melalui penerapan prinsip arsitektur Zen Jepang dan minimalisme Barat, perancang ruangan berusaha menciptakan showroom berdesain bersih dengan langit-langit tinggi dan sekat tipis. Keheningan spasial ini mengundang konsumen untuk berinteraksi secara intim dengan setiap helai pakaian.',
              'Published',
              '2026-05-05 13:10:00'
            ],
            [
              'Estetika Streetwear Retro: Sentuhan Desain Vintage dalam Busana Modern AD7ERclo',
              'THEORY',
              'Elemen retro seperti potongan kerah lebar, efek washed pada kain denim, serta palet warna pudar kembali diminati oleh para desainer pakaian modern. Estetika ini digabungkan secara presisi dengan potongan geometris masa kini untuk menciptakan nostalgia berbalut kemewahan kontemporer. Pelajari cara mengadopsi tren vintage streetwear ke dalam gaya berpakaian urban Anda.',
              'Published',
              '2026-05-04 10:00:00'
            ],
            [
              'Panduan Menciptakan Palet Kapsul Monokrom Sempurna untuk Gaya Berbusana Sehari-hari',
              'THEORY',
              'Konsep lemari kapsul (capsule wardrobe) mengajarkan kita untuk hidup secara efisien dengan memiliki sedikit pakaian yang mudah dipadupadankan. Fokus pada kombinasi warna netral seperti hitam, abu-abu, arang (charcoal), dan putih pudar memudahkan Anda berpakaian dengan cepat setiap pagi tanpa mengorbankan ketajaman gaya berpakaian. Inilah panduan menyusun palet kapsul terbaik.',
              'Published',
              '2026-05-03 09:00:00'
            ]
          ];
          await connection.query(seedBlogsQuery, [blogValues]);
          console.log('[Database] Successfully seeded 20 dynamic streetwear blog posts.');
        }

        isInitialized = true;
        console.log('[Database] Auto-initialization and migrations completed successfully.');
      } finally {
        connection.release();
      }
    } catch (error: any) {
      console.warn(`[Database Warning] Automatic initialization/seeding skipped or failed: ${error.message}`);
      // Do not throw or halt execution, so we can fall back to local static JSON safely
    }
  })();

  return initializingPromise;
}

export interface Item {
  id?: number;
  shop_id: number | null;
  item_id: number | null;
  name: string;
  url: string | null;
  aff_url: string;
  image_url: string;
  price: number;
  discount_pct: number | null;
  rating: number | null;
  sold_count: number | null;
  location: string | null;
  is_mall: boolean | null;
  currency: string;
  original_price: number | null;
  rating_count: number | null;
  category: string;
  isNew: boolean | null;
  tkp_url: string | null;
}

const ITEMS_JSON_PATH = path.resolve(__dirname, '../recipes/items.json');

function readLocalItems(): Item[] {
  try {
    if (fs.existsSync(ITEMS_JSON_PATH)) {
      const data = fs.readFileSync(ITEMS_JSON_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Local Items] Error reading local items.json file:', err);
  }
  
  // Initialize from fallbackItems with added IDs
  const fallback = (fallbackItems as any[]).map((item, idx) => ({
    id: idx + 1,
    shop_id: item.shop_id ? Number(item.shop_id) : null,
    item_id: item.item_id ? Number(item.item_id) : null,
    name: item.name,
    url: item.url || null,
    aff_url: item.aff_url,
    image_url: item.image_url,
    price: Number(item.price),
    discount_pct: item.discount_pct !== null ? Number(item.discount_pct) : null,
    rating: item.rating !== null ? Number(item.rating) : null,
    sold_count: item.sold_count !== null ? Number(item.sold_count) : null,
    location: item.location || null,
    is_mall: item.is_mall ? true : false,
    currency: item.currency || 'IDR',
    original_price: item.original_price !== null ? Number(item.original_price) : null,
    rating_count: item.rating_count !== null ? Number(item.rating_count) : null,
    category: item.category,
    isNew: item.isNew ? true : false,
    tkp_url: item.tkp_url || null
  }));
  writeLocalItems(fallback);
  return fallback;
}

function writeLocalItems(items: Item[]) {
  try {
    const dir = path.dirname(ITEMS_JSON_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ITEMS_JSON_PATH, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Local Items] Error writing local items.json file:', err);
  }
}

export async function getItems(): Promise<Item[]> {
  try {
    // Run automated DB schema checks and migrations
    await ensureDbInitialized();
    
    const connectionPool = getPool();
    // Test if connection works and query the items table
    const [rows] = await connectionPool.query('SELECT * FROM items ORDER BY id ASC');
    console.log(`[Database] Successfully fetched ${(rows as any[]).length} items from MySQL database.`);
    
    return (rows as any[]).map(row => ({
      id: Number(row.id),
      shop_id: row.shop_id ? Number(row.shop_id) : null,
      item_id: row.item_id ? Number(row.item_id) : null,
      name: row.name,
      url: row.url || null,
      aff_url: row.aff_url,
      image_url: row.image_url,
      price: Number(row.price),
      discount_pct: row.discount_pct !== null ? Number(row.discount_pct) : null,
      rating: row.rating !== null ? Number(row.rating) : null,
      sold_count: row.sold_count !== null ? Number(row.sold_count) : null,
      location: row.location || null,
      is_mall: row.is_mall !== null ? Boolean(row.is_mall) : null,
      currency: row.currency || 'IDR',
      original_price: row.original_price !== null ? Number(row.original_price) : null,
      rating_count: row.rating_count !== null ? Number(row.rating_count) : null,
      category: row.category,
      isNew: row.isNew !== null ? Boolean(row.isNew) : null,
      tkp_url: row.tkp_url || null
    }));
  } catch (error: any) {
    console.warn(`[Database Warning] MySQL connection failed. Falling back to local JSON file data. Error: ${error.message}`);
    return readLocalItems();
  }
}

export async function insertItem(
  name: string,
  category: string,
  price: number,
  isNew: boolean,
  image_url: string,
  aff_url: string,
  tkp_url: string = ''
): Promise<number> {
  try {
    await ensureDbInitialized();
    const connectionPool = getPool();
    const [result]: any = await connectionPool.query(
      `INSERT INTO items 
       (name, category, price, isNew, image_url, aff_url, tkp_url, currency, original_price, discount_pct, rating, sold_count, rating_count) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'IDR', ?, 0, 5, 0, 0)`,
      [name, category, price, isNew ? 1 : 0, image_url, aff_url, tkp_url || null, price]
    );
    return result.insertId;
  } catch (error: any) {
    console.warn(`[Database Warning] MySQL product insert failed. Falling back to local JSON persistence: ${error.message}`);
    const items = readLocalItems();
    const nextId = items.length > 0 ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
    const newItem: Item = {
      id: nextId,
      shop_id: null,
      item_id: null,
      name,
      url: null,
      aff_url,
      image_url,
      price,
      discount_pct: 0,
      rating: 5,
      sold_count: 0,
      location: 'Indonesia',
      is_mall: false,
      currency: 'IDR',
      original_price: price,
      rating_count: 0,
      category,
      isNew,
      tkp_url: tkp_url || null
    };
    items.push(newItem);
    writeLocalItems(items);
    return nextId;
  }
}

export async function deleteItem(id: number): Promise<void> {
  try {
    await ensureDbInitialized();
    const connectionPool = getPool();
    await connectionPool.query('DELETE FROM items WHERE id = ?', [id]);
  } catch (error: any) {
    console.warn(`[Database Warning] MySQL product delete failed. Falling back to local JSON persistence: ${error.message}`);
    const items = readLocalItems();
    const updated = items.filter(i => i.id !== id);
    writeLocalItems(updated);
  }
}

export async function updateItem(
  id: number,
  name: string,
  category: string,
  price: number,
  isNew: boolean,
  image_url: string,
  aff_url: string,
  tkp_url: string = ''
): Promise<void> {
  try {
    await ensureDbInitialized();
    const connectionPool = getPool();
    await connectionPool.query(
      `UPDATE items SET 
       name = ?, category = ?, price = ?, isNew = ?, image_url = ?, aff_url = ?, tkp_url = ?, original_price = ? 
       WHERE id = ?`,
      [name, category, price, isNew ? 1 : 0, image_url, aff_url, tkp_url || null, price, id]
    );
  } catch (error: any) {
    console.warn(`[Database Warning] MySQL product update failed. Falling back to local JSON persistence: ${error.message}`);
    const items = readLocalItems();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        name,
        category,
        price,
        isNew,
        image_url,
        aff_url,
        tkp_url: tkp_url || null,
        original_price: price
      };
      writeLocalItems(items);
    } else {
      throw new Error(`Product with ID ${id} not found in local file database.`);
    }
  }
}

export interface BlogPost {
  id: number;
  title: string;
  category: string;
  content: string | null;
  status: string;
  created_at: Date;
}

// Helper to get static fallback blogs array (the 20 blogs)
function getStaticFallbackBlogs(): BlogPost[] {
  return [
    {
      id: 1,
      title: 'Evolusi Streetwear di Indonesia: Dari Komunitas Subkultur ke Kiblat Fashion',
      category: 'THEORY',
      content: 'Streetwear di Indonesia telah menempuh perjalanan panjang dari sekadar tren subkultur komunitas skateboard dan musik independen menjadi pilar utama industri fashion modern. Desain dengan siluet oversized, detail grafis minimalis, dan pesan orisinalitas kini mendominasi panggung gaya perkotaan. Artikel ini mengupas bagaimana brand lokal sukses memadukan estetika global dengan sensitivitas budaya nusantara, menciptakan identitas baru yang berani dan relevan.',
      status: 'Published',
      created_at: new Date('2026-05-22T14:00:00Z')
    },
    {
      id: 2,
      title: 'Minimalisme Brutalis: Mengapa Kaos Oversized Tetap Mendominasi Tren',
      category: 'THEORY',
      content: 'Tren oversized t-shirt bukan sekadar kenyamanan sementara, melainkan sebuah pernyataan estetika brutalism yang menekankan proporsi ekstrem dan kejujuran bentuk. Tanpa lekukan tubuh yang menonjol, pakaian oversized memberikan kebebasan bergerak sekaligus menciptakan siluet arsitektural yang kuat bagi pemakainya. Temukan alasan mengapa potongan longgar tetap menjadi raja di lemari pakaian minimalis Anda.',
      status: 'Published',
      created_at: new Date('2026-05-21T16:30:00Z')
    },
    {
      id: 3,
      title: 'Panduan Memilih Bahan Katun Heavyweight Terbaik untuk Kaos Streetwear Premium',
      category: 'SUSTAINABILITY',
      content: 'Kualitas pakaian streetwear kelas atas sangat ditentukan oleh pemilihan material kain. Kain katun heavyweight dengan gramasi berkisar antara 200 gsm hingga 240 gsm menawarkan struktur siluet boxy yang kokoh serta ketahanan luar biasa meskipun dicuci berulang kali. Ketahui perbedaan karakteristik pintalan benang combed dan carded agar Anda tidak salah berinvestasi pada produk fashion berkualitas premium.',
      status: 'Published',
      created_at: new Date('2026-05-20T11:15:00Z')
    },
    {
      id: 4,
      title: 'Konstruksi Ruang Ganti Minimalis: Merancang Wardrobe Estetik dengan Konsep AD7ERclo',
      category: 'INTERIORS',
      content: 'Menata ruang penyimpanan pakaian pribadi membutuhkan pendekatan arsitektural yang matang untuk menghadirkan ketenangan visual. Melalui integrasi material beton ekspos, gantungan stainless steel industri, serta pencahayaan linear yang lembut, ruang ganti Anda dapat diubah menjadi galeri seni mini. Pelajari panduan praktis penataan baju dengan skema warna terorganisasi demi kepuasan visual harian.',
      status: 'Published',
      created_at: new Date('2026-05-19T09:45:00Z')
    },
    {
      id: 5,
      title: 'Eksplorasi Monokrom dalam Fotografi Streetwear Jalanan Jakarta',
      category: 'PHOTOGRAPHY',
      content: 'Fotografi streetwear monokrom adalah metode terbaik untuk menangkap kontras tajam antara siluet pakaian modern dengan brutalnya arsitektur kota Jakarta. Cahaya matahari tropis yang terik menciptakan bayangan geometris tegas pada dinding beton galeri dan gedung tua, menonjolkan tekstur pakaian tanpa distraksi warna. Mari pelajari teknik komposisi shadow and light untuk memperkuat portofolio fashion editorial Anda.',
      status: 'Published',
      created_at: new Date('2026-05-18T17:20:00Z')
    },
    {
      id: 6,
      title: 'Slow Fashion di Indonesia: Langkah Nyata Menuju Industri Gaya yang Berkelanjutan',
      category: 'SUSTAINABILITY',
      content: 'Konsumsi pakaian yang cepat rusak membebani kelestarian bumi kita. Konsep slow fashion hadir mengajak kita semua untuk memilih kualitas di atas kuantitas. Dengan memproduksi pakaian dalam volume kecil, menggunakan bahan serat alami organik yang ramah lingkungan, serta memastikan kesejahteraan pekerja lokal, industri kreatif tanah air kini bergeser menuju era fashion yang lebih bertanggung jawab dan etis.',
      status: 'Published',
      created_at: new Date('2026-05-17T10:00:00Z')
    },
    {
      id: 7,
      title: 'Psikologi Warna Hitam: Kekuatan Tersembunyi dalam Desain Busana Avant-Garde',
      category: 'THEORY',
      content: 'Warna hitam melambangkan misteri, otoritas, dan keheningan mutlak. Dalam ranah mode avant-garde, ketiadaan warna memaksa mata untuk sepenuhnya fokus pada detail konstruksi jahitan, tekstur kain, dan keunikan siluet potongan baju. Pahami mengapa desainer legendaris dunia selalu memilih palet hitam untuk menyampaikan pesan-pesan filosofis yang paling mendalam.',
      status: 'Published',
      created_at: new Date('2026-05-16T14:10:00Z')
    },
    {
      id: 8,
      title: 'Menghidupkan Kembali Estetika Brutalisme dalam Arsitektur Ritel Fashion Modern',
      category: 'INTERIORS',
      content: 'Brutalisme arsitektur yang mengandalkan kejujuran tekstur beton mentah kini menjadi elemen interior terfavorit bagi butik ritel streetwear global. Suasana klinis, dingin, dan luas memberikan ruang bagi koleksi pakaian untuk tampil menonjol sebagai fokus utama pameran. Temukan rahasia di balik perpaduan material semen ekspos, kaca, dan logam dalam melahirkan pengalaman belanja premium.',
      status: 'Published',
      created_at: new Date('2026-05-15T11:30:00Z')
    },
    {
      id: 9,
      title: 'Seni Bermain Siluet: Oversized Outerwear untuk Proporsi Tubuh Asia',
      category: 'THEORY',
      content: 'Menggunakan luaran bermodel oversized sering kali menjadi tantangan tersendiri bagi orang Asia dengan postur tubuh sedang. Kunci utamanya terletak pada teknik layering dan keseimbangan proporsi tubuh atas dan bawah. Memadukan mantel bersiluet boxy dengan celana bersiluet lurus (straight-cut pants) akan memberikan ilusi tinggi badan yang seimbang sekaligus mempertahankan impresi gaya street fashion yang modern.',
      status: 'Published',
      created_at: new Date('2026-05-14T15:50:00Z')
    },
    {
      id: 10,
      title: 'Fotografi Lookbook: Teknik Pencahayaan Studio untuk Produk Fashion Monokrom',
      category: 'PHOTOGRAPHY',
      content: 'Menciptakan lookbook komersial yang memikat memerlukan kontrol pencahayaan yang sangat presisi untuk menonjolkan keunikan garmen monokromatik. Penggunaan teknik softbox searah dan reflektor abu-abu dapat memunculkan gradasi gelap terang yang dramatis pada lipatan pakaian hitam dan putih. Dapatkan panduan lengkap mengatur setup lighting studio agar detail produk Anda terlihat tajam dan profesional.',
      status: 'Published',
      created_at: new Date('2026-05-13T13:20:00Z')
    },
    {
      id: 11,
      title: 'Pentingnya Upcycling: Mengubah Sisa Bahan Katun Menjadi Aksesori Premium',
      category: 'SUSTAINABILITY',
      content: 'Upcycling adalah seni mentransformasikan limbah kain produksi menjadi barang baru dengan nilai estetika yang jauh lebih tinggi. Daripada membiarkan potongan kain katun heavyweight terbuang di tempat pembuangan akhir, pengrajin lokal mendesain ulang sisa bahan menjadi tas jinjing minimalis, topi bucket serbaguna, hingga strap kamera. Inilah perwujudan nyata sirkular ekonomi dalam dunia fashion kreatif.',
      status: 'Published',
      created_at: new Date('2026-05-12T09:10:00Z')
    },
    {
      id: 12,
      title: 'Desain Interior Butik Minimalis: Menghadirkan Suasana Galeri Seni di Ruang Ritel',
      category: 'INTERIORS',
      content: 'Showroom fashion modern bukan lagi sekadar tempat bertransaksi jual beli, melainkan ruang kontemplasi artistik bagi para pelanggan. Dengan meminimalkan jumlah gantungan baju dan memanfaatkan konsep pencahayaan museum, setiap pakaian yang digantung diperlakukan layaknya karya seni berharga tinggi. Simak filosofi desain ritel modern yang mengutamakan kualitas pengalaman spasial.',
      status: 'Published',
      created_at: new Date('2026-05-11T16:40:00Z')
    },
    {
      id: 13,
      title: 'Sejarah Gaya Cargo Pants: Dari Perlengkapan Militer Hingga Ikon Streetwear',
      category: 'THEORY',
      content: 'Celana kargo yang awalnya dirancang untuk kebutuhan prajurit militer Inggris pada dekade 1930-an kini telah berevolusi menjadi salah satu fashion item wajib bagi pecinta streetwear modern. Fleksibilitas kantong utilitas dipadukan dengan material katun ripstop premium menciptakan fungsionalitas tingkat tinggi yang sangat dicintai oleh generasi muda yang aktif di area perkotaan.',
      status: 'Published',
      created_at: new Date('2026-05-10T10:15:00Z')
    },
    {
      id: 14,
      title: 'Evolusi Kultur Sneakers dalam Melengkapi Estetika Oversized Fit',
      category: 'THEORY',
      content: 'Sneakers tidak pernah bisa dipisahkan dari perkembangan kultur pakaian streetwear global. Sepatu dengan sol tebal (chunky sneakers) atau siluet klasik minimalis berbahan kulit premium bertindak sebagai jangkar visual yang sempurna untuk menyangga potongan celana longgar. Temukan panduan praktis memadukan model sepatu kasual favorit demi menyempurnakan outfit oversized harian Anda.',
      status: 'Published',
      created_at: new Date('2026-05-09T14:00:00Z')
    },
    {
      id: 15,
      title: 'Bagaimana Cara Merawat Pakaian Katun Heavyweight Agar Awet dan Tidak Menyusut',
      category: 'SUSTAINABILITY',
      content: 'Membeli kaos katun premium berkualitas tinggi adalah langkah investasi gaya jangka panjang, namun perawatan yang salah dapat merusak struktur serat kain. Gunakan air dingin saat mencuci, hindari mesin pengering bersuhu panas tinggi, dan jemur pakaian secara horizontal untuk menghindari peregangan bahu baju. Rawat koleksi katun heavyweight kesayangan Anda agar tetap kokoh bertahun-tahun.',
      status: 'Published',
      created_at: new Date('2026-05-08T08:30:00Z')
    },
    {
      id: 16,
      title: 'Menangkap Karakter Kain Melalui Lensa Makro: Fotografi Detail Tekstil Fashion',
      category: 'PHOTOGRAPHY',
      content: 'Kualitas kerajinan tangan dari brand premium sering kali tersembunyi pada kerapatan tenunan benang dan presisi jahitan tepinya. Melalui teknik fotografi makro beresolusi tinggi, kita dapat mengekspos kemewahan tekstur bahan linen organik atau kelembutan fleece premium secara dramatis. Artikel edukatif ini menyajikan tips makrofotografi untuk menaikkan nilai estetika visual lookbook digital Anda.',
      status: 'Published',
      created_at: new Date('2026-05-07T11:20:00Z')
    },
    {
      id: 17,
      title: 'Kombinasi Tekstur: Memadukan Heavy Linen dengan Katun Organik Minimalis',
      category: 'SUSTAINABILITY',
      content: 'Bermain dengan kontras permukaan kain adalah teknik rahasia dalam menciptakan gaya monokrom yang dinamis dan tidak membosankan. Serat kasar alami dari kain heavy linen berpadu sangat selaras dengan kehalusan kaos katun organik yang lembut. Kombinasi dua material ramah lingkungan ini menawarkan kesejukan optimal bagi tubuh sekaligus memperkaya dimensi visual busana kasual Anda.',
      status: 'Published',
      created_at: new Date('2026-05-06T15:45:00Z')
    },
    {
      id: 18,
      title: 'Filosofi Keheningan Spasial: Menghadirkan Suasana Tenang dalam Desain Showroom',
      category: 'INTERIORS',
      content: 'Desain interior yang terlalu ramai dapat menimbulkan kecemasan sensorik bagi pengunjung toko ritel. Melalui penerapan prinsip arsitektur Zen Jepang and minimalisme Barat, perancang ruangan berusaha menciptakan showroom berdesain bersih dengan langit-langit tinggi dan sekat tipis. Keheningan spasial ini mengundang konsumen untuk berinteraksi secara intim dengan setiap helai pakaian.',
      status: 'Published',
      created_at: new Date('2026-05-05T13:10:00Z')
    },
    {
      id: 19,
      title: 'Estetika Streetwear Retro: Sentuhan Desain Vintage dalam Busana Modern AD7ERclo',
      category: 'THEORY',
      content: 'Elemen retro seperti potongan kerah lebar, efek washed pada kain denim, serta palet warna pudar kembali diminati oleh para desainer pakaian modern. Estetika ini digabungkan secara presisi dengan potongan geometris masa kini untuk menciptakan nostalgia berbalut kemewahan kontemporer. Pelajari cara mengadopsi tren vintage streetwear ke dalam gaya berpakaian urban Anda.',
      status: 'Published',
      created_at: new Date('2026-05-04T10:00:00Z')
    },
    {
      id: 20,
      title: 'Panduan Menciptakan Palet Kapsul Monokrom Sempurna untuk Gaya Berbusana Sehari-hari',
      category: 'THEORY',
      content: 'Konsep lemari kapsul (capsule wardrobe) mengajarkan kita untuk hidup secara efisien dengan memiliki sedikit pakaian yang mudah dipadupadankan. Fokus pada kombinasi warna netral seperti hitam, abu-abu, arang (charcoal), dan putih pudar memudahkan Anda berpakaian dengan cepat setiap pagi tanpa mengorbankan ketajaman gaya berpakaian. Inilah panduan menyusun palet kapsul terbaik.',
      status: 'Published',
      created_at: new Date('2026-05-03T09:00:00Z')
    }
  ];
}

// Local file JSON database operations
function readLocalBlogs(): BlogPost[] {
  try {
    if (fs.existsSync(BLOGS_JSON_PATH)) {
      const data = fs.readFileSync(BLOGS_JSON_PATH, 'utf-8');
      const blogs = JSON.parse(data);
      return blogs.map((b: any) => ({
        ...b,
        created_at: new Date(b.created_at)
      }));
    }
  } catch (err) {
    console.error('[Local Blogs] Error reading local blogs.json file:', err);
  }
  
  // If file doesn't exist, create it with the fallback blogs
  const fallback = getStaticFallbackBlogs();
  writeLocalBlogs(fallback);
  return fallback;
}

function writeLocalBlogs(blogs: BlogPost[]) {
  try {
    const dir = path.dirname(BLOGS_JSON_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BLOGS_JSON_PATH, JSON.stringify(blogs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Local Blogs] Error writing local blogs.json file:', err);
  }
}

export async function getBlogs(): Promise<BlogPost[]> {
  try {
    await ensureDbInitialized();
    const connectionPool = getPool();
    const [rows] = await connectionPool.query('SELECT * FROM blogs ORDER BY id DESC');
    return (rows as any[]).map(row => ({
      id: Number(row.id),
      title: row.title,
      category: row.category,
      content: row.content || null,
      status: row.status,
      created_at: new Date(row.created_at)
    }));
  } catch (error: any) {
    console.warn(`[Database Warning] Failed to fetch blogs from MySQL. Falling back to local JSON file data: ${error.message}`);
    return readLocalBlogs().sort((a, b) => b.id - a.id);
  }
}

export async function insertBlog(title: string, category: string, status: string, content: string = ''): Promise<number> {
  try {
    await ensureDbInitialized();
    const connectionPool = getPool();
    const [result]: any = await connectionPool.query(
      'INSERT INTO blogs (title, category, status, content) VALUES (?, ?, ?, ?)',
      [title, category, status, content]
    );
    return result.insertId;
  } catch (error: any) {
    console.warn(`[Database Warning] MySQL insert failed. Falling back to local JSON file persistence. Error: ${error.message}`);
    const blogs = readLocalBlogs();
    const nextId = blogs.length > 0 ? Math.max(...blogs.map(b => b.id)) + 1 : 1;
    const newBlog: BlogPost = {
      id: nextId,
      title,
      category,
      status,
      content: content || null,
      created_at: new Date()
    };
    blogs.push(newBlog);
    writeLocalBlogs(blogs);
    return nextId;
  }
}

export async function deleteBlog(id: number): Promise<void> {
  try {
    await ensureDbInitialized();
    const connectionPool = getPool();
    await connectionPool.query('DELETE FROM blogs WHERE id = ?', [id]);
  } catch (error: any) {
    console.warn(`[Database Warning] MySQL delete failed. Falling back to local JSON file persistence. Error: ${error.message}`);
    const blogs = readLocalBlogs();
    const updated = blogs.filter(b => b.id !== id);
    writeLocalBlogs(updated);
  }
}

export async function updateBlog(id: number, title: string, category: string, status: string, content: string = ''): Promise<void> {
  try {
    await ensureDbInitialized();
    const connectionPool = getPool();
    await connectionPool.query(
      'UPDATE blogs SET title = ?, category = ?, status = ?, content = ? WHERE id = ?',
      [title, category, status, content, id]
    );
  } catch (error: any) {
    console.warn(`[Database Warning] MySQL update failed. Falling back to local JSON file persistence. Error: ${error.message}`);
    const blogs = readLocalBlogs();
    const idx = blogs.findIndex(b => b.id === id);
    if (idx !== -1) {
      blogs[idx] = {
        ...blogs[idx],
        title,
        category,
        status,
        content: content || null
      };
      writeLocalBlogs(blogs);
    } else {
      throw new Error(`Blog post with ID ${id} not found in local file cache.`);
    }
  }
}
