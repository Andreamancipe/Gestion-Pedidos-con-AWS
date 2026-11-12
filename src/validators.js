'use strict';

const ESTADOS = ['Pendiente', 'En Proceso', 'Enviado', 'Entregado'];
const ORDENES = ['fecha', 'estado', 'id'];
const DIRECCIONES = ['asc', 'desc'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esTexto = (v) => typeof v === 'string';

function validarPedido(body) {
  const errores = [];
  const b = body && typeof body === 'object' ? body : {};
  const c = b.cliente && typeof b.cliente === 'object' ? b.cliente : {};

  const nombre = esTexto(c.nombre) ? c.nombre.trim() : '';
  if (nombre.length < 2 || nombre.length > 100) errores.push('cliente.nombre es obligatorio (2 a 100 caracteres)');

  let email = null;
  if (c.email !== undefined && c.email !== null && c.email !== '') {
    if (!esTexto(c.email) || !EMAIL_RE.test(c.email.trim()) || c.email.length > 150) errores.push('cliente.email no es válido');
    else email = c.email.trim();
  }

  let telefono = null;
  if (c.telefono !== undefined && c.telefono !== null && c.telefono !== '') {
    if (!esTexto(c.telefono) || c.telefono.trim().length > 30) errores.push('cliente.telefono no es válido (máximo 30 caracteres)');
    else telefono = c.telefono.trim();
  }

  const direccion = esTexto(b.direccion_envio) ? b.direccion_envio.trim() : '';
  if (direccion.length < 5 || direccion.length > 255) errores.push('direccion_envio es obligatoria (5 a 255 caracteres)');

  const productos = [];
  if (!Array.isArray(b.productos) || b.productos.length === 0) {
    errores.push('productos debe ser una lista con al menos un producto');
  } else if (b.productos.length > 50) {
    errores.push('productos admite máximo 50 elementos');
  } else {
    b.productos.forEach((p, i) => {
      const n = i + 1;
      const item = p && typeof p === 'object' ? p : {};
      const prod = esTexto(item.nombre) ? item.nombre.trim() : '';
      if (prod.length < 1 || prod.length > 150) errores.push(`productos[${n}].nombre es obligatorio (máximo 150 caracteres)`);
      if (!Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 10000) {
        errores.push(`productos[${n}].cantidad debe ser un entero entre 1 y 10000`);
      }
      let precio = 0;
      if (item.precio_unitario !== undefined && item.precio_unitario !== null) {
        if (typeof item.precio_unitario !== 'number' || !Number.isFinite(item.precio_unitario) || item.precio_unitario < 0) {
          errores.push(`productos[${n}].precio_unitario debe ser un número mayor o igual a 0`);
        } else precio = item.precio_unitario;
      }
      productos.push({ producto: prod, cantidad: item.cantidad, precio_unitario: precio });
    });
  }

  if (errores.length) return { errores, datos: null };
  return { errores: [], datos: { cliente: { nombre, email, telefono }, direccion_envio: direccion, productos } };
}

function validarCambioEstado(actual, nuevo) {
  if (!ESTADOS.includes(nuevo)) return { ok: false, motivo: `estado inválido. Valores permitidos: ${ESTADOS.join(', ')}` };
  const i = ESTADOS.indexOf(actual);
  const j = ESTADOS.indexOf(nuevo);
  if (j === i) return { ok: false, motivo: `el pedido ya está en estado "${actual}"` };
  if (j !== i + 1) {
    const sig = ESTADOS[i + 1];
    return { ok: false, motivo: sig ? `desde "${actual}" solo se puede pasar a "${sig}"` : `el pedido ya está "${actual}" y no admite más cambios` };
  }
  return { ok: true };
}

function validarFiltros(query) {
  const q = query || {};
  const errores = [];
  const f = { estado: null, orden: 'fecha', direccion: 'desc', limite: 50, pagina: 1 };

  if (q.estado !== undefined && q.estado !== '') {
    if (!ESTADOS.includes(q.estado)) errores.push(`estado inválido. Valores permitidos: ${ESTADOS.join(', ')}`);
    else f.estado = q.estado;
  }
  if (q.orden !== undefined && q.orden !== '') {
    if (!ORDENES.includes(q.orden)) errores.push(`orden inválido. Valores permitidos: ${ORDENES.join(', ')}`);
    else f.orden = q.orden;
  }
  if (q.direccion !== undefined && q.direccion !== '') {
    const d = String(q.direccion).toLowerCase();
    if (!DIRECCIONES.includes(d)) errores.push('direccion inválida. Valores permitidos: asc, desc');
    else f.direccion = d;
  }
  if (q.limite !== undefined && q.limite !== '') {
    const n = Number(q.limite);
    if (!Number.isInteger(n) || n < 1 || n > 100) errores.push('limite debe ser un entero entre 1 y 100');
    else f.limite = n;
  }
  if (q.pagina !== undefined && q.pagina !== '') {
    const n = Number(q.pagina);
    if (!Number.isInteger(n) || n < 1) errores.push('pagina debe ser un entero mayor o igual a 1');
    else f.pagina = n;
  }
  return errores.length ? { errores, filtros: null } : { errores: [], filtros: f };
}

module.exports = { ESTADOS, ORDENES, validarPedido, validarCambioEstado, validarFiltros };
