'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos'
};

async function inicializarBD() {
  if (!/^[A-Za-z0-9_]+$/.test(config.database)) throw new Error('DB_NAME solo puede tener letras, números y guion bajo');
  const conn = await mysql.createConnection({ host: config.host, port: config.port, user: config.user, password: config.password });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4`);
    await conn.query(`USE \`${config.database}\``);
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
    const sentencias = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const s of sentencias) await conn.query(s);
  } finally {
    await conn.end();
  }
}

function crearPool() {
  return mysql.createPool({ ...config, waitForConnections: true, connectionLimit: 5 });
}

module.exports = { config, inicializarBD, crearPool };
