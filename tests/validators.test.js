'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPedido, validarCambioEstado, validarFiltros, ESTADOS } = require('../src/validators');

const pedidoValido = () => ({
  cliente: { nombre: 'Ana Pérez', email: 'ana@correo.com', telefono: '3001234567' },
  direccion_envio: 'Calle 10 # 5-20, Bogotá',
  productos: [{ nombre: 'Camisa', cantidad: 2, precio_unitario: 45000 }]
});

test('validarPedido acepta un pedido correcto', () => {
  const { errores, datos } = validarPedido(pedidoValido());
  assert.deepEqual(errores, []);
  assert.equal(datos.cliente.nombre, 'Ana Pérez');
  assert.equal(datos.productos[0].cantidad, 2);
});

test('validarPedido limpia espacios y usa precio 0 si no se envía', () => {
  const p = pedidoValido();
  p.cliente.nombre = '  Ana  ';
  delete p.productos[0].precio_unitario;
  const { datos } = validarPedido(p);
  assert.equal(datos.cliente.nombre, 'Ana');
  assert.equal(datos.productos[0].precio_unitario, 0);
});

test('validarPedido rechaza un cuerpo vacío', () => {
  const { errores, datos } = validarPedido(undefined);
  assert.equal(datos, null);
  assert.ok(errores.length >= 3);
});

test('validarPedido exige nombre del cliente y dirección', () => {
  const p = pedidoValido();
  p.cliente.nombre = '';
  p.direccion_envio = 'abc';
  const { errores } = validarPedido(p);
  assert.ok(errores.some((e) => e.includes('cliente.nombre')));
  assert.ok(errores.some((e) => e.includes('direccion_envio')));
});

test('validarPedido rechaza un email inválido', () => {
  const p = pedidoValido();
  p.cliente.email = 'no-es-un-correo';
  const { errores } = validarPedido(p);
  assert.ok(errores.some((e) => e.includes('email')));
});

test('validarPedido exige al menos un producto', () => {
  const p = pedidoValido();
  p.productos = [];
  const { errores } = validarPedido(p);
  assert.ok(errores.some((e) => e.includes('productos')));
});

test('validarPedido rechaza cantidades no válidas', () => {
  for (const cantidad of [0, -1, 1.5, '2', null]) {
    const p = pedidoValido();
    p.productos[0].cantidad = cantidad;
    const { errores } = validarPedido(p);
    assert.ok(errores.some((e) => e.includes('cantidad')), `cantidad ${cantidad} debía rechazarse`);
  }
});

test('validarPedido rechaza precios negativos', () => {
  const p = pedidoValido();
  p.productos[0].precio_unitario = -5;
  const { errores } = validarPedido(p);
  assert.ok(errores.some((e) => e.includes('precio_unitario')));
});

test('validarCambioEstado permite avanzar una etapa', () => {
  assert.equal(validarCambioEstado('Pendiente', 'En Proceso').ok, true);
  assert.equal(validarCambioEstado('En Proceso', 'Enviado').ok, true);
  assert.equal(validarCambioEstado('Enviado', 'Entregado').ok, true);
});

test('validarCambioEstado no permite saltar ni retroceder', () => {
  assert.equal(validarCambioEstado('Pendiente', 'Enviado').ok, false);
  assert.equal(validarCambioEstado('Enviado', 'Pendiente').ok, false);
  assert.equal(validarCambioEstado('Pendiente', 'Pendiente').ok, false);
});

test('validarCambioEstado rechaza estados desconocidos y pedidos ya entregados', () => {
  assert.equal(validarCambioEstado('Pendiente', 'Cancelado').ok, false);
  assert.equal(validarCambioEstado('Entregado', 'Pendiente').ok, false);
  assert.equal(validarCambioEstado('Entregado', 'Entregado').ok, false);
});

test('validarFiltros usa valores por defecto', () => {
  const { errores, filtros } = validarFiltros({});
  assert.deepEqual(errores, []);
  assert.deepEqual(filtros, { estado: null, orden: 'fecha', direccion: 'desc', limite: 50, pagina: 1 });
});

test('validarFiltros acepta cada estado válido', () => {
  for (const estado of ESTADOS) assert.equal(validarFiltros({ estado }).filtros.estado, estado);
});

test('validarFiltros rechaza valores inválidos', () => {
  assert.ok(validarFiltros({ estado: 'Perdido' }).errores.length > 0);
  assert.ok(validarFiltros({ orden: 'precio; DROP TABLE pedidos' }).errores.length > 0);
  assert.ok(validarFiltros({ direccion: 'arriba' }).errores.length > 0);
  assert.ok(validarFiltros({ limite: '1000' }).errores.length > 0);
  assert.ok(validarFiltros({ pagina: '0' }).errores.length > 0);
});
