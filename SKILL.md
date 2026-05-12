# registrierkassa

A CLI and systemd-managed service for an Austrian RKSV-compliant cash register.

## Commands

- `npm run cli setup` - Interactive setup and configuration.
- `npm run cli create-receipt` - Interactively create a receipt.
- `npm run cli list` - List receipts.
- `npm run cli storno <id>` - Storno receipt.
- `npm run cli email <id> <address>` - Send email.

Runs as a systemd service on port 1235.
