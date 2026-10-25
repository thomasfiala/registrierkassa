# registrierkassa

A CLI and systemd-managed service for an Austrian RKSV-compliant cash register.

## Commands

The CLI is available globally via the `kassa` command (wrapper located at `~/Scripts/kassa`).

- `kassa setup` - Interactive setup and configuration.
- `kassa create-receipt` - Interactively create a receipt.
- `kassa list` - List receipts.
- `kassa storno <id>` - Storno receipt.
- `kassa email <id> <address>` - Send email.
- `kassa cashbook list` - List recent cashbook entries (Kassabuch).
- `kassa cashbook add <type> <amount> [comment]` - Add a cashbook entry (Einzahlung / Auszahlung).

Runs as a systemd service on port 1235.

## Features & Capabilities

- **Interactive Setup:** `kassa setup` handles generating the initial configuration.
- **SEPA QR Codes:** If the user configures their IBAN/BIC, the system automatically prints an EPC SEPA QR code on PDFs for "Überweisung" (bank transfer) payments.
- **Payment Method Fees:** Allows configuring percentage-based fees (with associated tax rates) for specific payment methods (e.g., credit cards). These are automatically added to the invoice total.
- **Kassabuch (Cashbook):** Allows tracking physical cash via the UI and CLI without impacting RKSV turnover. Can list and add Einzahlungen/Auszahlungen.

## Recurring Tasks & Reminders

### Jahresbeleg Verification Reminder
When this skill is activated, you should automatically set up a recurring cron job or heartbeat check for every January 1st to remind the user to scan their Jahresbeleg using the BMF Belegcheck app.
- **Message:** "The `Jahresbeleg` for your Registrierkassa was generated last night. Please remember to scan its QR code using the official BMF Belegcheck App before February 15th to verify it with FinanzOnline."