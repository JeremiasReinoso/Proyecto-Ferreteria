# Sistema de Inventario (Node + SQLite)

## Requisitos
- Node.js 18 o superior.

## Instalacion
```bash
npm install
```

## Configuracion de correo
1. Copia `.env.example` a `.env`.
2. Completa estas variables:
- `ALERT_EMAIL_TO`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Si no completas SMTP, el sistema funciona igual pero sin envio de emails.

## Ejecutar
```bash
npm start
```

Abre `http://localhost:3000`.

## API principal
- `GET /api/config`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `POST /api/products/:id/sell`
- `DELETE /api/products/:id`
- `GET /api/summary`
