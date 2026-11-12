# Plataforma de Gestión de Pedidos

API REST (Node.js + Express + MySQL) desplegada con un pipeline CI/CD en AWS:
GitHub -> CodePipeline -> CodeBuild (pruebas unitarias) -> Elastic Beanstalk, con base de datos en Amazon RDS.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/pedidos` | Crea un pedido (estado inicial: Pendiente) |
| GET | `/api/pedidos` | Lista pedidos. Filtros: `estado`, `orden` (fecha, estado, id), `direccion` (asc, desc), `limite`, `pagina` |
| GET | `/api/pedidos/:id` | Muestra un pedido con sus productos |
| PATCH | `/api/pedidos/:id/estado` | Avanza el estado: Pendiente > En Proceso > Enviado > Entregado |
| GET | `/health` | Estado del servidor |
| GET | `/api/health` | Estado del servidor y de la base de datos |

La interfaz web para probar la API está en la ruta `/`.

### Ejemplos

```bash
# Crear
curl -X POST http://localhost:3000/api/pedidos -H "Content-Type: application/json" -d '{
  "cliente": {"nombre": "Ana Pérez", "email": "ana@correo.com", "telefono": "3001234567"},
  "direccion_envio": "Calle 10 # 5-20, Bogotá",
  "productos": [{"nombre": "Camisa", "cantidad": 2, "precio_unitario": 45000}]
}'

# Listar los pendientes, del más reciente al más antiguo
curl "http://localhost:3000/api/pedidos?estado=Pendiente&orden=fecha&direccion=desc"

# Cambiar el estado
curl -X PATCH http://localhost:3000/api/pedidos/1/estado -H "Content-Type: application/json" -d '{"estado": "En Proceso"}'
```

## Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `DB_HOST` | Servidor MySQL | localhost |
| `DB_PORT` | Puerto | 3306 |
| `DB_USER` | Usuario | root |
| `DB_PASSWORD` | Contraseña | (vacía) |
| `DB_NAME` | Base de datos (se crea sola si no existe) | gestion_pedidos |
| `PORT` | Puerto del servidor | 3000 |

Al iniciar, la aplicación crea la base de datos y las tablas del archivo `sql/schema.sql` si no existen.

## Ejecutar en local

```bash
npm install
npm start      # http://localhost:3000
npm test       # pruebas unitarias (no necesitan base de datos)
```

## Pruebas unitarias

Usan el ejecutor de pruebas incluido en Node.js (`node --test`), sin dependencias extra.
Cubren validaciones, reglas de cambio de estado, construcción de consultas y todos los endpoints
(con un repositorio en memoria). En CodeBuild se publican como reporte JUnit (`reports/junit.xml`).

## Estructura

```
src/            código de la API (app, validaciones, repositorio MySQL)
public/         interfaz web de prueba
sql/schema.sql  esquema de la base de datos
tests/          pruebas unitarias
buildspec.yml   pasos de CodeBuild (instalar, probar, reportar, cachear)
Procfile        comando de inicio para Elastic Beanstalk
```
