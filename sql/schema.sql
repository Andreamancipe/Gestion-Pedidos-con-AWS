-- Esquema de la plataforma de gestión de pedidos (MySQL 8)
CREATE TABLE IF NOT EXISTS pedidos (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_nombre VARCHAR(100) NOT NULL,
  cliente_email VARCHAR(150) NULL,
  cliente_telefono VARCHAR(30) NULL,
  direccion_envio VARCHAR(255) NOT NULL,
  estado ENUM('Pendiente','En Proceso','Enviado','Entregado') NOT NULL DEFAULT 'Pendiente',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pedidos_estado (estado),
  KEY idx_pedidos_creado (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pedido_items (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  producto VARCHAR(150) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_items_pedido (pedido_id),
  CONSTRAINT fk_items_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
