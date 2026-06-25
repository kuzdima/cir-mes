var jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  var SECRET = process.env.JWT_SECRET;
  var h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
  try { req.user = jwt.verify(h.slice(7), SECRET); next(); }
  catch(e) { res.status(401).json({ ok: false, error: 'Токен недействителен' }); }
};
