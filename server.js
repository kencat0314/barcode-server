const express = require('express');
const path = require('path');

const app = express();
const port = 8080;

const pages = require('./routes/pages');

app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/', pages);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
