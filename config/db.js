const mysql = require('mysql2');
const pool = mysql.createPool({
  host: '127.0.0.1',    // 👈 Forzar IPv4
  user: 'stock_user',      // 👈 Usuario creado en MariaDB
  password: 'tu_contraseña_segura', // 👈 Contraseña del usuario
  database: 'stock_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();