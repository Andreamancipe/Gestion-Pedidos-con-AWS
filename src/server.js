'use strict';

const { inicializarBD, crearPool } = require('./db');
const { crearPedidosRepo } = require('./repositories/pedidosRepo');
const { crearApp } = require('./app');

async function main() {
  try {
    await inicializarBD();
    console.log('Base de datos lista');
  } catch (err) {
    
    console.error('No se pudo inicializar la base de datos:', err.message);
  }
  const app = crearApp({ repo: crearPedidosRepo(crearPool()) });
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
}

main();
