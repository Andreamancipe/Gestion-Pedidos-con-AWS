'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../src/app');

/** Repositorio en memoria: permite probar la API sin base de datos. */
function repoEnMemoria() {
  const pedidos = [];
  let siguiente = 1;
  return {
    pedidos,
    async crear(datos) {
      const p = {
        id: siguiente++, cliente: datos.cliente, direccion_envio: datos.direccion_envio, estado: 'Pendiente',
        productos: datos.productos,
        total: datos.productos.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0),
        creado_en: new Date().toISOString()
      };
      pedidos.push(p);
      return p;
    },
    async listar(f) {
      let lista = pedidos.filter((p) => !f.estado || p.estado === f.estado);
      lista = [...lista].sort((a, b) => (f.direccion === 'asc' ? a.id - b.id : b.id - a.id));
      return { pedidos: lista, total: lista.length };
    },
    async obtener(id) { return pedidos.find((p) => p.id === id) || null; },
    async actualizarEstado(id, desde, hacia) {
      const p = pedidos.find((x) => x.id === id);
      if (!p || p.estado !== desde) return false;
      p.estado = hacia;
      return true;
    },
    async ping() { return true; }
  };
}

async function conServidor(repo, fn) {
  const app = crearApp({ repo });
  // Se enlaza explícitamente a 127.0.0.1 (IPv4) para evitar ambigüedades de red en entornos de CI
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve(s)));
    s.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const http = async (ruta, opciones = {}) => {
    const res = await fetch(base + ruta, {
      method: opciones.method || 'GET',
      headers: opciones.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opciones.raw !== undefined ? opciones.raw : opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined
    });
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* sin cuerpo JSON */ }
    return { status: res.status, json, texto, headers: res.headers };
  };
  try { await fn(http, repo); } finally { await new Promise((r) => server.close(r)); }
}

const pedidoNuevo = () => ({
  cliente: { nombre: 'Ana Pérez', email: 'ana@correo.com' },
  direccion_envio: 'Calle 10 # 5-20, Bogotá',
  productos: [{ nombre: 'Camisa', cantidad: 2, precio_unitario: 45000 }, { nombre: 'Gorra', cantidad: 1, precio_unitario: 20000 }]
});

test('GET /health responde ok', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    const r = await http('/health');
    assert.equal(r.status, 200, `respuesta inesperada: ${r.status} ${r.texto.slice(0, 200)}`);
    assert.deepEqual(r.json, { ok: true });
  });
});

test('GET /api/health informa el estado de la base de datos', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    const r = await http('/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, database: true });
  });
  const repoCaido = { ...repoEnMemoria(), ping: async () => { throw new Error('sin conexión'); } };
  await conServidor(repoCaido, async (http) => {
    const r = await http('/api/health');
    assert.equal(r.status, 503);
    assert.equal(r.json.database, false);
  });
});

test('POST /api/pedidos crea un pedido en estado Pendiente', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    const r = await http('/api/pedidos', { method: 'POST', body: pedidoNuevo() });
    assert.equal(r.status, 201);
    assert.equal(r.json.id, 1);
    assert.equal(r.json.estado, 'Pendiente');
    assert.equal(r.json.total, 110000);
    assert.equal(r.headers.get('location'), '/api/pedidos/1');
  });
});

test('POST /api/pedidos rechaza datos inválidos con el detalle de los errores', async () => {
  await conServidor(repoEnMemoria(), async (http, repo) => {
    const r = await http('/api/pedidos', { method: 'POST', body: { cliente: {}, productos: [] } });
    assert.equal(r.status, 400);
    assert.ok(r.json.detalles.length >= 3);
    assert.equal(repo.pedidos.length, 0);
  });
});

test('POST /api/pedidos rechaza un JSON mal formado', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    const r = await http('/api/pedidos', { method: 'POST', body: {}, raw: '{esto no es json' });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /JSON/);
  });
});

test('GET /api/pedidos lista y filtra por estado', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    await http('/api/pedidos', { method: 'POST', body: pedidoNuevo() });
    await http('/api/pedidos', { method: 'POST', body: pedidoNuevo() });
    await http('/api/pedidos/2/estado', { method: 'PATCH', body: { estado: 'En Proceso' } });

    const todos = await http('/api/pedidos');
    assert.equal(todos.status, 200);
    assert.equal(todos.json.total, 2);

    const enProceso = await http('/api/pedidos?estado=En%20Proceso');
    assert.equal(enProceso.json.total, 1);
    assert.equal(enProceso.json.pedidos[0].id, 2);
  });
});

test('GET /api/pedidos valida los parámetros de consulta', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    const r = await http('/api/pedidos?estado=Perdido&orden=precio');
    assert.equal(r.status, 400);
    assert.equal(r.json.detalles.length, 2);
  });
});

test('GET /api/pedidos/:id devuelve el pedido, 404 si no existe y 400 si el id es inválido', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    await http('/api/pedidos', { method: 'POST', body: pedidoNuevo() });
    assert.equal((await http('/api/pedidos/1')).status, 200);
    assert.equal((await http('/api/pedidos/99')).status, 404);
    assert.equal((await http('/api/pedidos/abc')).status, 400);
  });
});

test('PATCH /api/pedidos/:id/estado recorre todas las etapas', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    await http('/api/pedidos', { method: 'POST', body: pedidoNuevo() });
    for (const estado of ['En Proceso', 'Enviado', 'Entregado']) {
      const r = await http('/api/pedidos/1/estado', { method: 'PATCH', body: { estado } });
      assert.equal(r.status, 200);
      assert.equal(r.json.estado, estado);
    }
  });
});

test('PATCH /api/pedidos/:id/estado rechaza saltos de etapa y estados inválidos', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    await http('/api/pedidos', { method: 'POST', body: pedidoNuevo() });
    const salto = await http('/api/pedidos/1/estado', { method: 'PATCH', body: { estado: 'Entregado' } });
    assert.equal(salto.status, 409);
    const invalido = await http('/api/pedidos/1/estado', { method: 'PATCH', body: { estado: 'Cancelado' } });
    assert.equal(invalido.status, 409);
    const sinCuerpo = await http('/api/pedidos/1/estado', { method: 'PATCH' });
    assert.equal(sinCuerpo.status, 409);
    assert.equal((await http('/api/pedidos/1')).json.estado, 'Pendiente');
  });
});

test('PATCH /api/pedidos/:id/estado devuelve 404 si el pedido no existe', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    const r = await http('/api/pedidos/50/estado', { method: 'PATCH', body: { estado: 'En Proceso' } });
    assert.equal(r.status, 404);
  });
});

test('Una ruta de API desconocida devuelve 404 en JSON', async () => {
  await conServidor(repoEnMemoria(), async (http) => {
    const r = await http('/api/clientes');
    assert.equal(r.status, 404);
    assert.equal(r.json.error, 'Ruta no encontrada');
  });
});
