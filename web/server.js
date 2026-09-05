const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const config = require('./config');

const app = express();
const mongoose = require('mongoose');
// Connect to MongoDB
console.log(config.mongoUri)
mongoose.connect(config.mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Passport Discord Strategy
passport.use(new DiscordStrategy({
  clientID: config.discord.clientId,
  clientSecret: config.discord.clientSecret,
  callbackURL: config.discord.callbackURL,
  scope: ['identify']
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '../badges')));

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

app.use(passport.initialize());
app.use(passport.session());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth middleware
function isStaff(req, res, next) {
  if (req.isAuthenticated() && config.staffUserIds.includes(req.user.id)) {
    return next();
  }
  res.redirect('/unauthorized');
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    if (config.staffUserIds.includes(req.user.id)) {
      res.redirect('/dashboard');
    } else {
      res.redirect('/unauthorized');
    }
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.get('/unauthorized', (req, res) => {
  res.render('unauthorized', { user: req.user });
});

app.get('/dashboard', isStaff, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Import API routes
const apiRoutes = require('./routes/api');
app.use('/api', isStaff, apiRoutes);

// Start server
app.listen(config.port, () => {
  console.log(`✅ Dashboard running on http://localhost:${config.port}`);
});