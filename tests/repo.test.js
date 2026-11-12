'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { construirListado, mapearPedido } = require('../src/repositories/pedidosRepo');

test('construirListado sin filtros ordena por fecha descendente', () => {
  const { sql, params, sqlConteo } = construirListado({ estado: null, orden: 'fecha', direccion: 'desc', limite: 50, pagina: 1 });
  assert.match(sql, /ORDER BY p\.creado_en DESC/);
  assert.match(sql, /LIMIT 50 OFFSET 0/);
  assert.doesNotMatch(sql, /FROM pedidos p\s+WHERE/);
  assert.deepEqual(params, []);
  assert.doesNotMatch(sqlConteo, /WHERE/);
});

test('construirListado filtra por estado usando parámetros (sin concatenar texto)', () => {
  const { sql, params } = construirListado({ estado: 'Enviado', orden: 'id', direccion: 'asc', limite: 10, pagina: 3 });
  assert.match(sql, /WHERE p\.estado = \?/);
  assert.match(sql, /ORDER BY p\.id ASC/);
  assert.match(sql, /LIMIT 10 OFFSET 20/);
  assert.deepEqual(params, ['Enviado']);
});

test('construirListado ignora un orden desconocido', () => {
  const { sql } = construirListado({ estado: null, orden: 'x; DROP TABLE pedidos', direccion: 'desc', limite: 5, pagina: 1 });
  assert.doesNotMatch(sql, /DROP/);
  assert.match(sql, /ORDER BY p\.creado_en/);
});

test('mapearPedido calcula el total a partir de los productos', () => {
  const fila = { id: 7, cliente_nombre: 'Ana', cliente_email: null, cliente_telefono: null, direccion_envio: 'Calle 1', estado: 'Pendiente' };
  const items = [
    { producto: 'A', cantidad: 2, precio_unitario: '1000.50' },
    { producto: 'B', cantidad: 1, precio_unitario: '500.00' }
  ];
  const p = mapearPedido(fila, items);
  assert.equal(p.total, 2501);
  assert.equal(p.productos.length, 2);
  assert.equal(p.cliente.nombre, 'Ana');
});
