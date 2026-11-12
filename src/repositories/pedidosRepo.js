'use strict';

const COLUMNAS_ORDEN = { fecha: 'p.creado_en', estado: 'p.estado', id: 'p.id' };

function construirListado(filtros) {
  const where = [];
  const params = [];
  if (filtros.estado) { where.push('p.estado = ?'); params.push(filtros.estado); }
  const condicion = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const columna = COLUMNAS_ORDEN[filtros.orden] || COLUMNAS_ORDEN.fecha;
  const sentido = filtros.direccion === 'asc' ? 'ASC' : 'DESC';
  const limite = Number(filtros.limite) || 50;
  const offset = ((Number(filtros.pagina) || 1) - 1) * limite;

  const sql =
    'SELECT p.*, ' +
    '(SELECT COALESCE(SUM(i.cantidad * i.precio_unitario), 0) FROM pedido_items i WHERE i.pedido_id = p.id) AS total, ' +
    '(SELECT COUNT(*) FROM pedido_items i WHERE i.pedido_id = p.id) AS cantidad_productos ' +
    `FROM pedidos p ${condicion} ORDER BY ${columna} ${sentido}, p.id DESC LIMIT ${limite} OFFSET ${offset}`;
  const sqlConteo = `SELECT COUNT(*) AS total FROM pedidos p ${condicion}`;
  return { sql, params, sqlConteo };
}

function mapearPedido(fila, items) {
  const pedido = {
    id: fila.id,
    cliente: { nombre: fila.cliente_nombre, email: fila.cliente_email, telefono: fila.cliente_telefono },
    direccion_envio: fila.direccion_envio,
    estado: fila.estado,
    total: Number(fila.total ?? 0),
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en
  };
  if (fila.cantidad_productos !== undefined) pedido.cantidad_productos = Number(fila.cantidad_productos);
  if (items) {
    pedido.productos = items.map((i) => ({
      producto: i.producto, cantidad: i.cantidad, precio_unitario: Number(i.precio_unitario)
    }));
    pedido.total = items.reduce((s, i) => s + i.cantidad * Number(i.precio_unitario), 0);
  }
  return pedido;
}

function crearPedidosRepo(pool) {
  async function obtener(id) {
    const [filas] = await pool.execute('SELECT * FROM pedidos WHERE id = ?', [id]);
    if (filas.length === 0) return null;
    const [items] = await pool.execute(
      'SELECT producto, cantidad, precio_unitario FROM pedido_items WHERE pedido_id = ? ORDER BY id', [id]);
    return mapearPedido(filas[0], items);
  }

  async function crear(datos) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.execute(
        'INSERT INTO pedidos (cliente_nombre, cliente_email, cliente_telefono, direccion_envio) VALUES (?, ?, ?, ?)',
        [datos.cliente.nombre, datos.cliente.email, datos.cliente.telefono, datos.direccion_envio]);
      for (const p of datos.productos) {
        await conn.execute(
          'INSERT INTO pedido_items (pedido_id, producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
          [r.insertId, p.producto, p.cantidad, p.precio_unitario]);
      }
      await conn.commit();
      return await obtener(r.insertId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async function listar(filtros) {
    const { sql, params, sqlConteo } = construirListado(filtros);
    const [filas] = await pool.query(sql, params);
    const [conteo] = await pool.query(sqlConteo, params);
    return { pedidos: filas.map((f) => mapearPedido(f)), total: Number(conteo[0].total) };
  }

  /** Cambia el estado solo si el pedido sigue en el estado "desde" (evita choques entre usuarios). */
  async function actualizarEstado(id, desde, hacia) {
    const [r] = await pool.execute('UPDATE pedidos SET estado = ? WHERE id = ? AND estado = ?', [hacia, id, desde]);
    return r.affectedRows === 1;
  }

  async function ping() {
    await pool.query('SELECT 1');
    return true;
  }

  return { crear, listar, obtener, actualizarEstado, ping };
}

module.exports = { crearPedidosRepo, construirListado, mapearPedido };
