// Tiny service with a deliberate bug for repro-flow acceptance testing:
// /add?a=1&b=2 returns string concat "12" instead of 3 (missing Number()).
const http = require('http');

function add(a, b) {
  return a + b; // BUG: a and b arrive as strings from the query
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200); res.end('ok'); return;
  }
  if (url.pathname === '/add') {
    const result = add(url.searchParams.get('a'), url.searchParams.get('b'));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ result }));
    return;
  }
  res.writeHead(404); res.end();
});

if (require.main === module) {
  server.listen(process.env.PORT || 3123, () =>
    console.log(`hello-svc listening on ${process.env.PORT || 3123}`));
}

module.exports = { add };
