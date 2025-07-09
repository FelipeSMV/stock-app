const pool = mysql.createPool({
  host: '127.0.0.1',    // 👈 Forzar IPv4
  user: 'stock_user',
  password: 'tu_contraseña_segura',
  database: 'stock_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});