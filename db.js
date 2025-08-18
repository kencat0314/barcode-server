const mysql = require('mysql');

const db = mysql.createPool({
  host: "localhost",
  user: "hda",
  password: "ptl2023",
  database: "pickByLight",
  queueLimit: 0,
  //debug: true,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("MySQL pool connection error:", err);
  } else {
    console.log("MySQL pool connected!");
    connection.release(); // release back to the pool
  }
});

module.exports = db;