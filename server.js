const express = require('express');
const path = require('path');

const app = express();
const port = 8080;

// Import your routes
const pages = require('./routes/pages');

// Serve static assets (CSS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));


// Use EJS for rendering views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Optional: Redirect root path to /dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Use your router for dynamic pages
app.use('/', pages);

app.listen(port, '0.0.0.0', () => {
  //console.log(Server running on http://192.168.69.152:${port});
});