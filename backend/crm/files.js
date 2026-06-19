var multer = require('multer');
var path = require('path');
var crypto = require('crypto');

var allowedMimes = [
  'image/jpeg', 'image/png', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

var uploadDir = path.join(__dirname, '..', 'uploads');

var storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, uploadDir); },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname);
    cb(null, crypto.randomUUID() + ext);
  }
});
var upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (allowedMimes.indexOf(file.mimetype) !== -1) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла. Разрешены: JPG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX'));
    }
  }
});

module.exports = function(app, pool, io, auth, adminOnly, crmAccessOnly) {

  app.post('/api/crm/upload', auth, crmAccessOnly, function(req, res, next) {
    upload.single('file')(req, res, function(err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ ok: false, error: 'Файл слишком большой. Максимум 50 МБ' });
        }
        return res.status(400).json({ ok: false, error: err.message });
      }
      next();
    });
  }, async function(req, res) {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'Файл не загружен' });
      var { card_id, field_id } = req.body;
      if (!card_id) return res.status(400).json({ ok: false, error: 'card_id обязателен' });
      var r = await pool.query(
        'INSERT INTO crm_card_files (card_id, field_id, file_name, original_name, file_size, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [card_id, field_id || null, req.file.filename, req.file.originalname, req.file.size, req.user.id]
      );
      io.emit('crm:file-added', { card_id: parseInt(card_id), file: r.rows[0] });
      res.json({ ok: true, row: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete('/api/crm/files/:id', auth, async function(req, res) {
    try {
      var fR = await pool.query(
        'SELECT cf.* FROM crm_card_files cf INNER JOIN crm_card_participants cp ON cp.card_id = cf.card_id AND cp.user_id = $1 WHERE cf.id = $2',
        [req.user.id, req.params.id]
      );
      if (!fR.rows.length) return res.status(403).json({ ok: false, error: 'Файл не найден или нет доступа' });
      var file = fR.rows[0];
      await pool.query('DELETE FROM crm_card_files WHERE id = $1', [file.id]);
      io.emit('crm:file-deleted', { card_id: file.card_id, file_id: file.id });
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

};
