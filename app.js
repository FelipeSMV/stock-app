// Importar módulos necesarios
const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mysql = require('mysql2');
const multer = require('multer');
const bcrypt = require('bcryptjs');

// Configurar conexión a MariaDB
const pool = mysql.createPool({
  host: '127.0.0.1', // Forzar IPv4
  user: 'stock_user', // Usuario creado en MariaDB
  password: 'tu_contraseña_segura', // Contraseña del usuario
  database: 'stock_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

// Configurar Multer para subir imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Ej: 1620000001.jpg
  }
});
const upload = multer({ storage });

// Middleware para servir archivos estáticos y procesar formularios
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Configurar sesión
app.use(session({
  secret: 'tu_secreto_seguro', // Cambia esto por una cadena única y segura
  resave: false,
  saveUninitialized: false
}));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Configurar Passport (autenticación local)
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return done(null, false, { message: 'Usuario no encontrado' });
    
    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return done(null, false, { message: 'Contraseña incorrecta' });
    
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

// Middleware para proteger rutas de administrador
function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') return next();
  res.redirect('/');
}

// Ruta principal: Mostrar productos
app.get('/', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products');
    res.render('index', { products, user: req.user });
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).send('Error interno');
  }
});

// Ruta de login
app.get('/login', (req, res) => {
  res.render('login');
});

// Procesar login
app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

// Cerrar sesión
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

// Ruta de administración (protegida)
app.get('/admin', ensureAdmin, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products');
    res.render('admin', { products });
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).send('Error interno');
  }
});

// Añadir producto (protegido)
app.post('/admin/add-product', ensureAdmin, upload.single('image'), async (req, res) => {
  const { name, stock } = req.body;
  const imagePath = `/uploads/${req.file.filename}`;
  
  try {
    await pool.query('INSERT INTO products (name, stock, image_path) VALUES (?, ?, ?)', [name, stock, imagePath]);
    res.redirect('/admin');
  } catch (err) {
    console.error('Error al añadir producto:', err);
    res.status(500).send('Error interno');
  }
});

// Puerto del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});