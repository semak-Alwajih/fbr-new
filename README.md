# FBR Next.js Exact Schema App

This version maps the sandbox payload closer to the exact FBR JSON schema you shared.

Included:
- single-page invoice workflow
- SN001 and SN002 support
- exact-style seller/buyer field names in payload
- `sellerNTNCNIC`, `buyerNTNCNIC`, `buyerBusinessName`, `buyerRegistrationType`
- item keys like `uoM`, `fixedNotifiedValueOrRetailPrice`, `salesTaxWithheldAtSource`, `saleType`
- validate and post sandbox actions
- payload preview and logs

## Hostinger settings
- Framework: Next.js
- Build command: npm install && npm run build
- Start command: npm start

## Default login
- admin@example.com
- admin123
