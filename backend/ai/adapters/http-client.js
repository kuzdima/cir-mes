var https = require('https');
var http = require('http');

function httpRequest(url, method, headers, body, timeout, parseJson) {
  if (parseJson === undefined) parseJson = true;
  return new Promise(function(resolve, reject) {
    var parsedUrl = new URL(url);
    var lib = parsedUrl.protocol === 'https:' ? https : http;
    var options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers,
      timeout: timeout || 30000
    };
    var req = lib.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        if (parseJson) {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch(e) {
            resolve({ status: res.statusCode, body: data });
          }
        } else {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', function(e) { reject(e); });
    req.on('timeout', function() { req.destroy(); reject(new Error('Таймаут')); });
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { httpRequest };
