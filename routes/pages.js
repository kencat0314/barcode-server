const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const db = require('../db');

const upload = multer({ dest: 'uploads/' });

const tabConfig = {
  heads: {
    title: 'Order Heads',
    table: 'order_heads',
    fields: [
      'ORDER_NO', 'CUST_NAME', 'DEL_ADR_STR1', 'DEL_ADR_CITY',
      'DEL_ZIP_CODE', 'DEL_COUNTRY'
    ]
  },
  rows: {
    title: 'Order Rows',
    table: 'order_rows',
    fields: [
      'ORW_NUMBER', 'ORW_ART_NO', 'ORW_BAR_CODE', 'ORW_NAME_1',
      'QTY_Left_to_pick', 'QTY_Picked', 'QTY_Original_Order',
      'ORW_STOCK_LOCATION', 'STATUS'
    ]
  },
  stock: {
    title: 'Stock Levels',
    table: 'stock_levels',
    fields: [
      'Article_NO', 'Barcode', 'Article_text',
      'Stock_Location', 'QTY'
    ]
  }
};

// Redirect to dashboard
router.get('/', (req, res) => res.redirect('/dashboard'));

router.get('/dashboard', (req, res) => {
  const limit = 100;
  const page = parseInt(req.query.page) || 1;
  const activeTab = req.query.tab || 'heads';
  const offset = (page - 1) * limit;

  const queries = {
    heads: {
      sql: `
        SELECT ORDER_NO, CUST_NAME, DEL_ADR_STR1, DEL_ADR_CITY,
        DEL_ZIP_CODE, DEL_COUNTRY, 
        DATE_FORMAT(Last_modified, '%d.%m.%Y %H:%i:%s') AS Last_modified
        FROM order_heads
        LIMIT ? OFFSET ?
      `, //PICKING_STATUS, HD_ID,
      params: [limit, offset]
    },
    rows: {
      sql: `
        SELECT ORW_NUMBER, ORW_ART_NO, ORW_BAR_CODE, ORW_NAME_1,
               QTY_Left_to_pick, QTY_Picked, QTY_Original_Order,
               ORW_STOCK_LOCATION,
               DATE_FORMAT(Last_modified, '%d.%m.%Y %H:%i:%s') AS Last_modified
        FROM order_rows
        LIMIT ? OFFSET ?
      `,
      params: [limit, offset]
    },
    stock: {
      sql: `
        SELECT Article_NO, Barcode, Article_text, Stock_Location, QTY,
               DATE_FORMAT(Last_modified, '%d.%m.%Y %H:%i:%s') AS Last_modified
        FROM stock_levels
        LIMIT ? OFFSET ?
      `,
      params: [limit, offset]
    }
  };

  const results = {};
  const keys = Object.keys(queries);
  let completed = 0;

  keys.forEach(key => {
    const { sql, params } = queries[key];
    db.query(sql, params, (err, rows) => {
      results[key] = err ? [] : rows;
      completed++;
      if (completed === keys.length) {
        res.render('dashboard', {
          ...results,
          error: null,
          currentPage: page,
          activeTab
        });
      }
    });
  });
});

router.post('/add/:tab', (req, res) => {
  const tab = req.params.tab;
  const config = tabConfig[tab];
  if (!config) return res.status(400).send('Invalid tab');

	const values = config.fields.map(field => req.body[field] ?? '');

  //const values = config.fields.map(field => req.body[field] || null);
  const sql = `
    INSERT INTO ${config.table} (${config.fields.join(', ')}, Last_modified)
    VALUES (${values.map(() => '?').join(', ')}, NOW())
  `;
  db.query(sql, values, (err) => {
    if (err) {
      console.error(err);
      return loadDashboard(res, 'Insert failed: ' + err.message, tab);
    }
    res.redirect('/dashboard?tab=' + tab);
  });
});

router.post('/upload/:tab', upload.single('csvfile'), (req, res) => {
  const tab = req.params.tab;
  const config = tabConfig[tab];
  if (!config) return res.status(400).send('Invalid tab');

  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ';', headers: config.fields }))
    .on('data', (data) => rows.push(data))
    .on('end', () => {
      const sql = `
        INSERT INTO ${config.table} (${config.fields.join(', ')}, Last_modified)
        VALUES ?
      `;
      const values = rows.map(row =>
        config.fields.map(field => row[field] || null).concat(new Date())
      );

      db.query(sql, [values], (err) => {
        fs.unlinkSync(filePath);
        if (err) {
          console.error(err);
          return loadDashboard(res, 'Upload failed: ' + err.message, tab);
        }
        res.redirect('/dashboard?tab=' + tab);
      });
    });
});

router.post('/delete/:tab', (req, res) => {
  const tab = req.params.tab;
  const config = tabConfig[tab];
  if (!config) return res.status(400).send('Invalid tab');

  const ids = req.body.ids || [];
  const singleId = req.body.singleId;
  const allIds = singleId ? [singleId] : ids;

  if (!allIds.length) return loadDashboard(res, 'No rows selected for deletion.', tab);

  const idField = {
    heads: 'ORDER_NO',
    rows: 'ORW_NUMBER',
    stock: 'Article_NO'
  }[tab];

  const placeholders = allIds.map(() => '?').join(',');
  const sql = `DELETE FROM ${config.table} WHERE ${idField} IN (${placeholders})`;

  db.query(sql, allIds, (err) => {
    if (err) {
      console.error(err);
      return loadDashboard(res, 'Delete failed: ' + err.message, tab);
    }
    res.redirect('/dashboard?tab=' + tab);
  });
});

router.post('/edit/:tab', (req, res) => {
  const tab = req.params.tab;
  const config = tabConfig[tab];
  if (!config) return res.status(400).send('Invalid tab');

  const idField = {
    heads: 'ORDER_NO',
    rows: 'ORW_NUMBER',
    stock: 'Article_NO'
  }[tab];

  const idValue = req.body.id;
  const updates = config.fields.map(field => `${field} = ?`).join(', ');
  const values = config.fields.map(field => req.body[field] || null);

  const sql = `
    UPDATE ${config.table}
    SET ${updates}, Last_modified = NOW()
    WHERE ${idField} = ?
  `;

  db.query(sql, [...values, idValue], (err) => {
    if (err) {
      console.error(err);
      return loadDashboard(res, 'Edit failed: ' + err.message, tab);
    }
    res.redirect('/dashboard?tab=' + tab);
  });
});

function loadDashboard(res, errorMessage = null, activeTab = 'heads') {
  const queries = {
    heads: `
      SELECT ORDER_NO, CUST_NAME, DEL_ADR_STR1, DEL_ADR_CITY,
      DEL_ZIP_CODE, DEL_COUNTRY, 
      DATE_FORMAT(Last_modified, '%d.%m.%Y %H:%i:%s') AS Last_modified
      FROM order_heads
    `,
    rows: `
      SELECT ORW_NUMBER, ORW_ART_NO, ORW_BAR_CODE, ORW_NAME_1,
             QTY_Left_to_pick, QTY_Picked, QTY_Original_Order,
             ORW_STOCK_LOCATION, STATUS,
             DATE_FORMAT(Last_modified, '%d.%m.%Y %H:%i:%s') AS Last_modified
      FROM order_rows
    `,
    stock: `
      SELECT Article_NO, Barcode, Article_text, Stock_Location, QTY,
             DATE_FORMAT(Last_modified, '%d.%m.%Y %H:%i:%s') AS Last_modified
      FROM stock_levels
    `
  };

  const results = {};
  const keys = Object.keys(queries);
  let completed = 0;

  keys.forEach(key => {
    db.query(queries[key], (err, rows) => {
      results[key] = err ? [] : rows;
      completed++;
      if (completed === keys.length) {
        res.render('dashboard', {
          ...results,
          error: errorMessage,
          currentPage: 1,
          activeTab
        });
      }
    });
  });
}


// GET /api/order_heads - return order heads as JSON
router.get('/order_heads', (req, res) => {
  const sql = `
    SELECT ORDER_NO, CUST_NAME    FROM order_heads
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows); // return array of order_heads
  });
});

router.get('/order_rows', (req, res) => {
  const orderNo = req.query.order_no; // get order_no from URL query
  const sql = 'SELECT * FROM order_rows WHERE ORW_NUMBER = ?';

  db.query(sql, [orderNo], (err, rows) => {
    if (err) {
      res.status(500).send({ error: 'Database error' });
    } else {
      res.json(rows);
    }
  });
});

router.get('/stock_levels', (req, res) => {
  const artNo = req.query.art_no;
  const sql = 'SELECT QTY FROM stock_levels WHERE Article_NO = ?';

  db.query(sql, [artNo], (err, rows) => {
    if (err) {
      res.status(500).send({ error: 'Database error' });
    } else if (rows.length > 0) {
      res.json(rows[0].QTY); // return just the quantity number
    } else {
      res.status(404).send({ error: 'Item not found' });
    }
  });
});

router.post('/update_stock', (req, res) => {
  console.log('--- Incoming POST to /update_stock ---');
  console.log('Headers:', req.headers);
  console.log('Raw Body:', req.rawBody?.toString());
  console.log('Parsed Body:', req.body);
  console.log('--------------------------------------');
  let  { picked_qty, order_no, article_no } = req.body;

  picked_qty = parseInt(picked_qty, 10);
  order_no = parseInt(order_no, 10);

  if (!article_no || typeof picked_qty !== 'number') {
    return res.status(400).json({ error: 'Invalid request data' });
  }
  const sqlStockLv = `UPDATE stock_levels
    SET QTY = QTY - ?
    WHERE Article_NO = ?`;

  const sqlOrderRows = `
    UPDATE order_rows 
    SET QTY_Picked = QTY_Picked + ?, QTY_Left_to_pick = QTY_Left_to_pick - ? 
    WHERE ORW_ART_NO = ? AND ORW_NUMBER = ?
  `;

  db.query(sqlStockLv, [picked_qty, article_no], (err, result1) => {
    if (err) {
      return res.status(500).send({ error: 'Database error (stock update)' });
    }
    if (result1.affectedRows === 0) {
      return res.status(404).send({ error: 'Item not found in stock_levels' });
    }

    db.query(sqlOrderRows, [picked_qty, picked_qty, article_no, order_no], (err, result2) => {
      if (err) {
        return res.status(500).send({ error: 'Database error (order row update)' });
      }
      if (result2.affectedRows === 0) {
        return res.status(404).send({ error: 'Item not found in order_rows' });
      }

      res.json({ message: 'Stock and order rows updated successfully' });
    });
  });
});

function rollback(connection, res, message) {
  connection.rollback(() => {
    connection.release();
    res.status(500).send({ error: message });
  });
}


module.exports = router;
