// config/passport.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./db'); // Conexión a MariaDB

module.exports = function(passport) {
  // Estrategia local para autenticar usuarios
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
      if (rows.length === 0) {
        return done(null, false, { message: 'Usuario no encontrado' });
      }

      const user = rows[0];
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: 'Contraseña incorrecta' });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  // Serializar usuario (almacena su ID en la sesión)
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserializar usuario (recupera sus datos desde la base de datos)
  passport.deserializeUser(async (id, done) => {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
      done(null, rows[0]);
    } catch (err) {
      done(err);
    }
  });
};