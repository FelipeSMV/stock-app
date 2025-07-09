const mysql = require('mysql2');
const pool = mysql.createPool({
  host: 'localhost',
  user: 'tu_usuario',     // Reemplaza con tu usuario de MySQL
  password: 'tu_contraseña', // Reemplaza con tu contraseña
  database: 'stock_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();