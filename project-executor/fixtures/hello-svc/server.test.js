const { test } = require('node:test');
const assert = require('node:assert');
const { add } = require('./server');

test('add adds numbers', () => {
  assert.strictEqual(add(1, 2), 3); // passes with numbers — bug only bites via HTTP
});
