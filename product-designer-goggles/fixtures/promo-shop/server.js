// Two-page fixture for product-designer-goggles acceptance: cart with promo
// input -> checkout with total. Promo SAVE10 gives 10% off a 100.00 cart.
const http = require('http');

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title><style>body{font:16px sans-serif;max-width:480px;margin:40px auto}
input,button{font:inherit;padding:6px}</style></head><body>${body}</body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (url.pathname === '/cart') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page('Cart', `<h1>Cart</h1><p>Concert ticket — 100.00</p>
      <form action="/checkout" method="get">
        <input name="promo" placeholder="Promo code" aria-label="Promo code">
        <button type="submit">Checkout</button></form>`));
    return;
  }
  if (url.pathname === '/checkout') {
    const promo = url.searchParams.get('promo') || '';
    const total = promo === 'SAVE10' ? '90.00' : '100.00';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page('Checkout', `<h1>Checkout</h1>
      <p>Promo: ${promo ? promo : 'none'}</p><p id="total">Total: ${total}</p>
      <button>Pay</button>`));
    return;
  }
  res.writeHead(302, { location: '/cart' }); res.end();
});

if (require.main === module) {
  server.listen(process.env.PORT || 3124, () =>
    console.log(`promo-shop listening on ${process.env.PORT || 3124}`));
}

module.exports = { server };
