function buildDateFilter(column, timeframe) {
  if (!timeframe || !timeframe.from || !timeframe.to) {
    return { clause: '', params: [] };
  }
  return {
    clause: ' AND ' + column + ' >= $1::date AND ' + column + ' < $2::date + interval \'1 day\'',
    params: [timeframe.from, timeframe.to]
  };
}

module.exports = { buildDateFilter };
