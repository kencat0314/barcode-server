const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers
//app.use(express.json());
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));

app.use(express.urlencoded({ extended: true }));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const pages = require('./routes/pages');
app.use('/', pages);

// Error handler (important for stability)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
