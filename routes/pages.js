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
      'DEL_ZIP_CODE', 'DEL_COUNTRY', 'PICKING_STATUS', 'HD_ID'
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
        DEL_ZIP_CODE, DEL_COUNTRY, PICKING_STATUS, HD_ID,
        DATE_FORMAT(Last_modified, '%d.%m.%Y %H:%i:%s') AS Last_modified
        FROM order_heads
        LIMIT ? OFFSET ?
      `,
      params: [limit, offset]
    },
    rows: {
      sql: `
        SELECT ORW_NUMBER, ORW_ART_NO, ORW_BAR_CODE, ORW_NAME_1,
               QTY_Left_to_pick, QTY_Picked, QTY_Original_Order,
               ORW_STOCK_LOCATION, STATUS,
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

  const values = config.fields.map(field => req.body[field] || null);
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
      DEL_ZIP_CODE, DEL_COUNTRY, PICKING_STATUS, HD_ID,
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

module.exports = router;
