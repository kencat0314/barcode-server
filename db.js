const mysql = require('mysql');

const db = mysql.createConnection({
  host: "localhost",
  user: "test",
  password: "1234",
  database: "testDb"
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
  } else {
    console.log('MySQL connected!');
  }
});

module.exports = db;