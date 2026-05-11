# Registrierkassa 🇦🇹

An open-source, Austrian RKSV-compliant Point of Sale (POS) / Cash Register system. 

Built with Next.js and Node.js, this project takes a unique approach to the mandatory "Datenerfassungsprotokoll" (DEP-7 audit trail) by backing the data layer with an **immutable Git repository**. Every invoice generates a JSON entry and a PDF, which are cryptographically chained and committed to Git automatically.

## 🏗 Architecture

1. **Next.js Web Frontend:** An English UI providing a simple POS cart system. Supports configurable item templates, dynamic tax rates, Proforma, and Final invoices.
2. **Next.js API Routes:** Processes frontend requests, handles the cryptographic chain logic, and generates standard-compliant German PDFs.
3. **Node.js CLI:** A terminal interface specifically for triggering RKSV mandatory zero-receipts (`Startbeleg`, `Monatsbeleg`, `Jahresbeleg`, `Tagesbeleg`, `Nullbeleg`).
4. **Git-Backed DB:** The `db.json` and generated PDFs reside in a *separate* folder that is automatically initialized as a Git repository. Every receipt triggers an atomic `git commit`, natively satisfying RKSV immutability and version control requirements.

## 🚀 Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configuration
Copy the configuration template and fill in your company details:
```bash
cp config.template.json config.json
```
Edit `config.json` to include:
- `business`: Your legal company name, address, and UID (VAT number).
- `invoiceTexts`: Standard text snippets used on the generated PDFs. Added custom defaults!
- `itemTemplates`: Predefined POS items with prices and Austrian tax rates (20%, 13%, 10%, 0%).
- `paymentMethods`: Configure available payment methods. You can optionally add a percentage fee (`feePercentage`) and its corresponding tax rate (`feeTaxRate`). If configured, selecting this payment method will automatically add the fee to the invoice total.
- `rksv`: Your Kassen-ID and AES-256 key for the encrypted turnover counter.

### 3. Database Initialization
You do not need to manually create the database. The system will read the `dbGitRepoPath` from your `config.json` (defaults to `../registrierkassa-db`), create the directory, inject `db.template.json`, and run `git init` automatically on the first transaction.

### 4. Git Backup Integration (Optional)
To ensure your receipts and database are safe against hardware failures, the app can automatically push every new receipt (git commit) to a remote Git repository (like GitHub or GitLab).

1. In your `config.json`, enable the feature:
   ```json
   "gitBackup": {
     "enabled": true,
     "remote": "origin",
     "branch": "main"
   }
   ```
2. Manually add the remote to your database repository once. By default, this is in the `~/.registrierkassa/db` folder:
   ```bash
   cd ~/.registrierkassa/db
   git remote add origin git@github.com:yourusername/registrierkassa-db-backup.git
   ```

*(Errors during the git push are caught and logged so the app will not crash if you are temporarily offline.)*

## 🖥 Usage

### Starting the Web UI (POS Terminal)
```bash
npm run dev
```
Open `http://localhost:3000` in your browser. From here you can add items, change quantities, select tax rates, preview, storno, and generate Final/Proforma invoices. You can also export the database as a CSV file.

### RKSV CLI Commands
Austrian law mandates specific zero-receipts to maintain the cryptographic chain at specific intervals. Run these directly from your terminal:

**Initial Setup (Must be reported to FinanzOnline):**
```bash
npm run cli startbeleg
```

**End of Month (Optional but recommended):**
```bash
npm run cli monatsbeleg
```

**End of Year (Mandatory, must be checked with the BMF Belegcheck App):**
```bash
npm run cli jahresbeleg
```
> **⚠️ IMPORTANT:** Every Jahresbeleg **MUST** be validated using the official "BMF Belegcheck" app (available on iOS/Android). This verifies that the signature chain and cryptographic parameters are sound before reporting to the FinanzOnline service.

**Other commands:**
- `npm run cli tagesbeleg` (Daily zero-receipt)
- `npm run cli nullbeleg` (Generic zero-receipt)
- `npm run cli export` (Export database to CSV)

## 🕒 Automating Receipts (Cron Jobs)

To ensure you never miss your monthly and yearly receipts, you can set up a cron job on your server to automatically run the CLI commands.

Open your crontab using `crontab -e` and add the following lines (adjust the path `/path/to/registrierkassa` to match your installation):

```cron
# Generate a Monatsbeleg at 23:50 on the last day of every month
50 23 28-31 * * [ "$(date +\%d -d tomorrow)" = "01" ] && cd /path/to/registrierkassa && npm run cli monatsbeleg

# Generate a Jahresbeleg at 23:55 on December 31st
55 23 31 12 * cd /path/to/registrierkassa && npm run cli jahresbeleg
```

## 🔐 RKSV Cryptography Integration (Action Required)

To achieve full legal compliance, the cryptographic stubs in `src/lib/rksv.ts` must be connected to a qualified signature creation device (QSCD).

Currently, `rksv.ts` outlines the exact data structures and hashes the chain correctly, but the actual AES and ECDSA signing functions are **stubs**.

You must integrate one of the following to replace the stubs:
- **A-Trust Smartcard:** Using local PC/SC readers or the A-Trust online HSM.
- **Fiskaly API:** A cloud-based signature provider.
- **BMF Mustercode:** Manual implementation of the JWS specs using raw crypto libraries.

## 📄 PDF Generation
Invoices are dynamically rendered via `pdfkit`. The script automatically regroups line items by tax rate at the footer, calculates Net, VAT, and Gross totals, and appends the RKSV QR Code for final receipts.