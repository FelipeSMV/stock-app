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
const flash = require('connect-flash');

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

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpg, jpeg, png, gif)'));
  }
});

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');          // 👈 Establece EJS como motor
app.set('views', path.join(__dirname, 'views'));

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

// Configurar flash messages
app.use(flash());

// Middleware para pasar mensajes a las vistas
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

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

// Middleware para proteger rutas (solo usuarios autenticados)
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Middleware para proteger rutas de administrador
function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') return next();
  res.redirect('/');
}

// Ruta de login (pública)
app.get('/login', (req, res) => {
  const message = req.session.messages ? req.session.messages[0] : null;
  res.render('login', { message });
});

// Procesar login (pública)
app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

// Cerrar sesión (pública)
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

// Ruta principal: Mostrar productos (protegida)
app.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products');
    res.render('index', { products, user: req.user });
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).send('Error interno');
  }
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
  
  if (!name || !stock || !req.file) {
    req.flash('error_msg', 'Todos los campos son obligatorios');
    return res.redirect('/admin');
  }

  const imagePath = `/uploads/${req.file.filename}`;
  
  try {
    await pool.query('INSERT INTO products (name, stock, image_path) VALUES (?, ?, ?)', [name, stock, imagePath]);
    res.redirect('/admin');
  } catch (err) {
    console.error('Error al añadir producto:', err);
    req.flash('error_msg', 'Error al guardar el producto');
    res.redirect('/admin');
  }
});

// Editar producto (protegido)
app.post('/admin/edit-product/:id', ensureAdmin, upload.single('image'), async (req, res) => {
  const { name, stock } = req.body;
  const productId = req.params.id;
  
  if (!name || !stock) {
    req.flash('error_msg', 'Todos los campos son obligatorios');
    return res.redirect('/admin');
  }

  let imagePath = req.body.oldImagePath; // Mantener imagen existente si no se carga una nueva

  if (req.file) {
    imagePath = `/uploads/${req.file.filename}`;
  }

  try {
    await pool.query(
      'UPDATE products SET name = ?, stock = ?, image_path = ? WHERE id = ?',
      [name, stock, imagePath, productId]
    );
    res.redirect('/admin');
  } catch (err) {
    console.error('Error al editar producto:', err);
    req.flash('error_msg', 'Error al actualizar el producto');
    res.redirect('/admin');
  }
});

// Eliminar producto (protegido)
app.post('/admin/delete-product/:id', ensureAdmin, async (req, res) => {
  const productId = req.params.id;

  try {
    await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    res.redirect('/admin');
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    req.flash('error_msg', 'Error al eliminar el producto');
    res.redirect('/admin');
  }
});

// Puerto del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});