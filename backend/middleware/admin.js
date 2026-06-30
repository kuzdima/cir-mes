module.exports = function(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ ok: false, error: 'Только для администратора' });
};