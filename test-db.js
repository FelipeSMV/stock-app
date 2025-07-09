const db = require('./config/db');

async function testConnection() {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS solution');
    console.log('Conexión exitosa:', rows[0].solution); // Debe imprimir "2"
  } catch (err) {
    console.error('Error conectando a MariaDB:', err.message);
  }
}

testConnection();