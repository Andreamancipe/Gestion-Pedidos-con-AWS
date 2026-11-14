'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const { validarPedido, validarCambioEstado, validarFiltros } = require('./validators');

const ID_RE = /^[1-9]\d*$/;

function crearApp({ repo }) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // Verificación simple del servidor
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Verificación del servidor y la base de datos
  app.get('/api/health', async (req, res) => {
    try {
      await repo.ping();
      res.json({ ok: true, database: true });
    } catch (err) {
      console.error('Error de base de datos:', err.message);
      res.status(503).json({ ok: false, database: false });
    }
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Crear pedido
  app.post('/api/pedidos', async (req, res) => {
    const { errores, datos } = validarPedido(req.body);
    if (errores.length) return res.status(400).json({ error: 'Datos inválidos', detalles: errores });
    const pedido = await repo.crear(datos);
    res.status(201).location(`/api/pedidos/${pedido.id}`).json(pedido);
  });

  // Listar pedidos (filtro por estado, orden y paginación)
  app.get('/api/pedidos', async (req, res) => {
    const { errores, filtros } = validarFiltros(req.query);
    if (errores.length) return res.status(400).json({ error: 'Parámetros inválidos', detalles: errores });
    const { pedidos, total } = await repo.listar(filtros);
    res.json({ total, pagina: filtros.pagina, limite: filtros.limite, pedidos });
  });

  // Ver un pedido
  app.get('/api/pedidos/:id', async (req, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: 'El id debe ser un entero positivo' });
    const pedido = await repo.obtener(Number(req.params.id));
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  });

  // Actualizar el estado de un pedido
  app.patch('/api/pedidos/:id/estado', async (req, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: 'El id debe ser un entero positivo' });
    const id = Number(req.params.id);
    const nuevo = req.body && req.body.estado;
    const pedido = await repo.obtener(id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const cambio = validarCambioEstado(pedido.estado, nuevo);
    if (!cambio.ok) return res.status(409).json({ error: 'Cambio de estado no permitido', detalles: [cambio.motivo] });

    const hecho = await repo.actualizarEstado(id, pedido.estado, nuevo);
    if (!hecho) return res.status(409).json({ error: 'El pedido fue modificado por otro usuario. Intenta de nuevo' });
    res.json(await repo.obtener(id));
  });

  // Rutas de API no existentes
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Manejo de errores
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { crearApp };
