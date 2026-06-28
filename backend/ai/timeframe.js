function resolveTimeframe(timeframe) {
  if (timeframe == null) return resolveTimeframe('month');

  if (typeof timeframe === 'object') {
    if (!timeframe.from || !timeframe.to)
      throw new Error('timeframe.from и timeframe.to обязательны');
    if (timeframe.from > timeframe.to)
      throw new Error('timeframe.from не может быть больше timeframe.to');
    return { from: timeframe.from, to: timeframe.to };
  }

  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth();
  var d = now.getDate();

  function fmtDate(date) {
    var yy = date.getFullYear();
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var dd = String(date.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  }

  var todayStr = fmtDate(now);

  switch (timeframe) {
    case 'today':
      return { from: todayStr, to: todayStr };

    case 'week': {
      var dayOfWeek = now.getDay();
      var diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      var monday = new Date(now);
      monday.setDate(d - diff);
      return { from: fmtDate(monday), to: todayStr };
    }

    case 'month':
      return {
        from: y + '-' + String(m + 1).padStart(2, '0') + '-01',
        to: todayStr
      };

    case 'quarter': {
      var qStart = Math.floor(m / 3) * 3;
      return {
        from: y + '-' + String(qStart + 1).padStart(2, '0') + '-01',
        to: todayStr
      };
    }

    case 'year':
      return { from: y + '-01-01', to: todayStr };

    case 'all':
      return null;

    default:
      return resolveTimeframe('month');
  }
}

module.exports = { resolveTimeframe };
