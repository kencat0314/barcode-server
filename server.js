const express = require('express');
const path = require('path');
const getRawBody = require('raw-body');
const contentType = require('content-type');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Capture raw body for all requests (before body parsing)
app.use((req, res, next) => {
  const contentTypeHeader = req.headers['content-type'] || '';
  if (contentTypeHeader.includes('application/json')) {
    getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
      encoding: (() => {
        try {
          return contentType.parse(req).parameters.charset || 'utf-8';
        } catch {
          return 'utf-8';
        }
      })(),
    })
      .then(raw => {
        req.rawBody = raw.toString();
        try {
          req.body = JSON.parse(req.rawBody);
        } catch (err) {
          req.body = undefined;
        }
        next();
      })
      .catch(err => next(err));
  } else {
    next();
  }
});



app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const pages = require('./routes/pages');
app.use('/', pages);

// Redirect root to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
