const express = require('express');
const router = express.Router();

// Static homepage is handled by express.static
const db = require('../db');
// Route: /order-heads
router.get('/order-heads', (req, res) => {
  const sql = `
  SELECT 
    ORDER_NO,
    NO_ROWS,
    CUST_NAME,
    DEL_ADR_STR1,
    DEL_ADR_CITY,
    DEL_ZIP_CODE,
    DEL_COUNTRY,
    PICKING_STATUS,
    HD_ID,
    STARTED_DATE,
    STARTED_TIME,
    FINISHED_DATE,
    FINISHED_TIME,
    Last_modified
  FROM order_heads
`;
db.query(sql, (err, results) => {
  if (err) {
    console.error('MySQL Error:', err);
    return res.status(500).send('Database error');
  }

  res.render('order_heads', { data: results });
  });
});

module.exports = router;
