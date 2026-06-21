var fs = require('fs');
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

module.exports = function(app, pool, io, auth, adminOnly, crmAccessOnly, uploadDir) {

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

  app.post('/api/crm/upload', auth, crmAccessOnly, function(req, res, next) {
    upload.array('file', 10)(req, res, function(err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ ok: false, error: 'Файл слишком большой. Максимум 50 МБ' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ ok: false, error: 'Максимум 10 файлов за раз' });
        }
        return res.status(400).json({ ok: false, error: err.message });
      }
      next();
    });
  }, async function(req, res) {
    try {
      if (!req.files || !req.files.length) return res.status(400).json({ ok: false, error: 'Файлы не загружены' });
      var { card_id, field_id } = req.body;
      if (!card_id) return res.status(400).json({ ok: false, error: 'card_id обязателен' });
      var rows = [];
      for (var fi = 0; fi < req.files.length; fi++) {
        var targetDir = path.join(uploadDir, String(card_id));
        fs.mkdirSync(targetDir, { recursive: true });
        await fs.promises.rename(req.files[fi].path, path.join(targetDir, req.files[fi].filename));
        var r = await pool.query(
          'INSERT INTO crm_card_files (card_id, field_id, file_name, original_name, file_size, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [parseInt(card_id), field_id ? parseInt(field_id) : null, card_id + '/' + req.files[fi].filename, Buffer.from(req.files[fi].originalname, 'latin1').toString('utf8'), req.files[fi].size, req.user.id]
        );
        rows.push(r.rows[0]);
        io.emit('crm:file-added', { card_id: parseInt(card_id), file: r.rows[0] });
      }
      res.json({ ok: true, rows: rows, count: rows.length });
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

      try {
        await fs.promises.unlink(path.join(uploadDir, file.file_name));
      } catch (unlinkErr) {
        if (unlinkErr.code !== 'ENOENT') {
          console.error('Ошибка удаления файла с диска:', unlinkErr.message);
        }
      }

      await pool.query('DELETE FROM crm_card_files WHERE id = $1', [file.id]);
      io.emit('crm:file-deleted', { card_id: file.card_id, file_id: file.id });
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

};
