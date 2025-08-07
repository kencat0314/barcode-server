const mysql = require('mysql');

const db = mysql.createConnection({
  host: "localhost",
  user: "hda",
  password: "ptl2023",
  database: "pickByLight",
  debug: true,
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
  } else {
    console.log('MySQL connected!');
  }
});

module.exports = db;