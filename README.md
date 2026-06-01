# Registrierkassa 🇦🇹

> **⚠️ DISCLAIMER / NO WARRANTY:** 
> This software is provided "as is", without warranty of any kind, express or implied. There is no guarantee that this code functions correctly, securely, or complies fully with Austrian fiscal laws (RKSV). Use at your own risk. The author(s) are not responsible for any legal or financial consequences resulting from the use of this software.
>
> **🤖 AI AUTHORSHIP:** 
> Please note that significant portions of this code were written by an AI assistant (OpenClaw / Google Gemini) and may contain errors, logical bugs, or non-standard implementations.

An open-source, Austrian RKSV-compliant Point of Sale (POS) / Cash Register system. 

Built with Next.js and Node.js, this project takes a unique approach to the mandatory "Datenerfassungsprotokoll" (DEP-7 audit trail) by backing the data layer with an **immutable Git repository**. Every invoice generates a JSON entry and a PDF, which are cryptographically chained and committed to Git automatically.

<img width="1135" height="1006" alt="image" src="https://github.com/user-attachments/assets/99eb680d-d8dc-4446-8083-83110c1647d4" />


## ✨ Key Advantages

- **Open Source & Low Cost:** Completely free from expensive POS subscriptions or vendor lock-in. Your only running cost is the raw cryptographic signatures (e.g., ~€20/year via A-Trust API).
- **Self-Hosted Privacy:** Run it on your own hardware (Raspberry Pi, local PC) or a cheap VPS. Your financial data never sits on a third-party server.
- **Infinite Extendability:** Built on modern standard web technologies (React/Next.js/Node.js), making it incredibly easy to customize to your exact business workflow.
- **CLI Automation:** Features a robust command-line interface, allowing you to trigger receipts, automate zero-receipts, or pipe data to other tools natively.
- **Interactive Onboarding Tool:** Get up and running in minutes with an interactive CLI setup that configures your company details, database paths, and preferences.
- **SEPA QR Codes:** Automatically generate and print EPC SEPA QR codes on invoices when paying via bank transfer (Überweisung) for fast, error-free customer payments.
- **Payment Method Fees:** Configure percentage-based fees (e.g., for Stripe or credit cards) that automatically calculate and apply the correct tax rate to the invoice total.
- **Automatic Storage & Backup:** The Git-backed database automatically creates immutable, timestamped revisions of every single transaction and pushes them to a remote backup repository without any manual intervention.
- **OpenClaw AI Integration:** Includes a ready-to-use OpenClaw skill (`SKILL.md`), allowing your AI assistant to manage receipts, send invoices via email, and handle recurring bureaucratic reminders (like scanning the annual `Jahresbeleg`).

## 🏗 Architecture

1. **Next.js Web Frontend:** A UI providing a simple POS cart system. Supports configurable item templates, dynamic tax rates, Proforma, and Final invoices.
2. **Next.js API Routes:** Processes frontend requests, handles the cryptographic chain logic, and generates standard-compliant German PDFs.
3. **Node.js CLI:** A terminal interface specifically for triggering RKSV mandatory zero-receipts (`Startbeleg`, `Monatsbeleg`, `Jahresbeleg`, `Tagesbeleg`, `Nullbeleg`).
4. **Git-Backed DB:** The `db.json` and generated PDFs reside in a *separate* folder that is automatically initialized as a Git repository. Every receipt triggers an atomic `git commit`, natively satisfying RKSV immutability and version control requirements.

## 🚀 Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configuration
The easiest way to configure your cash register is by running the interactive setup tool:
```bash
npm run cli setup
```
This tool will guide you through setting up your business details, taxes, and database path.

Alternatively, you can manually copy the configuration template:
```bash
cp config.template.json ~/.registrierkassa/config.json
```
Edit `config.json` to include:
- `business`: Your legal company name, address, and UID (VAT number).
- `invoiceTexts`: Standard text snippets used on the generated PDFs. Added custom defaults!
- `itemTemplates`: Predefined POS items with prices and Austrian tax rates (20%, 13%, 10%, 0%).
- `paymentMethods`: Configure available payment methods. You can optionally add a percentage fee (`feePercentage`) and its corresponding tax rate (`feeTaxRate`). If configured, selecting this payment method will automatically add the fee to the invoice total.
- `sepa`: If configured with your IBAN, BIC, and Recipient Name, the system will automatically print an EPC SEPA QR code on the invoice PDF whenever the payment method "Überweisung" is selected.
- `rksv`: Your Kassen-ID and AES-256 key for the encrypted turnover counter.

### 3. Database Initialization
You do not need to manually create the database. The system will read the `dbGitRepoPath` from your `~/.registrierkassa/config.json` (defaults to `db`, which resolves to `~/.registrierkassa/db`), create the directory, inject `db.template.json`, and run `git init` automatically on the first transaction.

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
**Development Mode:**
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

**Production Mode (Systemd Service):**
If running via the provided `registrierkassa.service`, the app will be accessible on `http://localhost:1235` (or your server's IP at port 1235).

From the Web UI, you can add items, change quantities, select tax rates, preview, storno, and generate Final/Proforma invoices. You can also export the database as a CSV file.

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
> **⚠️ IMPORTANT:** Every Jahresbeleg **MUST** be validated using the official "BMF Belegcheck" app (available on iOS/Android). The cron job above only *creates* the receipt in your system. You must manually scan the QR code of this receipt with your smartphone to transmit the verification to FinanzOnline. Legally, you have until February 15th of the new year to do this.

**Other commands:**
- `npm run cli tagesbeleg` (Daily zero-receipt)
- `npm run cli nullbeleg` (Generic zero-receipt)
- `npm run cli export` (Export database to CSV)

### Official DEP Export (Datenerfassungsprotokoll)
Austrian law requires an official JSON export format for the DEP in case of an audit. You can generate this using the provided export script. It reads your database, compiles the `Belege-Gruppe` structure, saves it as `dep-export.json` inside your git-backed database repository, and automatically commits/pushes the file.

```bash
node scripts/export-dep.js
```

## 🌍 Production Deployment (Linux / Systemd)

If you are running the cash register on a Linux server (like a VPS or a Raspberry Pi), it's highly recommended to run it as a background service using `systemd`. This ensures it automatically starts on boot and restarts if it crashes.

1. **Copy the template:**
   ```bash
   cp registrierkassa.service.template registrierkassa.service
   ```
2. **Edit the service file:**
   Open `registrierkassa.service` and replace `<YOUR_USERNAME>` with your actual Linux user, and `/path/to/registrierkassa` with the absolute path to your installation. Ensure `ExecStart` points to your `npm` or `node` binary.
   *(Note: `registrierkassa.service` is in `.gitignore`, so your local paths and usernames will never be accidentally committed to git).*
3. **Install and start the service:**
   ```bash
   sudo ln -s /full/path/to/registrierkassa/registrierkassa.service /etc/systemd/system/registrierkassa.service
   sudo systemctl daemon-reload
   sudo systemctl enable registrierkassa.service
   sudo systemctl start registrierkassa.service
   ```

## 🕒 Automating Receipts (Cron Jobs)

To ensure you never miss your monthly and yearly receipts, you can set up a cron job on your server to automatically run the CLI commands.

Open your crontab using `crontab -e` and add the following lines (adjust the path `/path/to/registrierkassa` to match your installation):

```cron
# Generate a Monatsbeleg at 23:50 on the last day of every month
50 23 28-31 * * [ "$(date +\%d -d tomorrow)" = "01" ] && cd /path/to/registrierkassa && npm run cli monatsbeleg

# Generate a Jahresbeleg at 23:55 on December 31st
55 23 31 12 * cd /path/to/registrierkassa && npm run cli jahresbeleg

# Generate and backup the official DEP export quarterly (at 02:00 AM on the 1st of Jan, Apr, Jul, Oct)
0 2 1 1,4,7,10 * cd /path/to/registrierkassa && node scripts/export-dep.js
```

## 🔐 RKSV Cryptography Integration (Action Required)

To achieve full legal compliance, the cryptographic stubs in `src/lib/rksv.ts` must be connected to a qualified signature creation device (QSCD).

Because this system already implements the Data Capture Log (DEP) and payload logic natively, the most efficient approach is using a **Cloud Signature Provider (Online HSM)**. Instead of plugging a physical USB smartcard reader into your server, your software makes an API call to a certified provider to securely sign each receipt.

### 6 Steps to Setup (Cloud Solution)

**1. Purchase a Cloud Certificate**
Buy an "Online-Signatur" (e.g., a-sign RK Online) from a trusted provider. You will receive API credentials and a certificate serial number.

**2. Generate your AES-256 Key & Prüfwert**
You need a random 32-byte AES key (Base64 encoded) and a specific "Prüfwert" (checksum) to register the cash register in FinanzOnline. Generate both by running this command in your terminal:

```bash
node -e "const crypto = require('crypto'); const key = crypto.randomBytes(32).toString('base64'); const pruefwert = crypto.createHash('sha256').update(key, 'utf8').digest().subarray(0, 3).toString('base64').replace(/=/g, ''); console.log('\nAES-Key (Benutzerschlüssel): ' + key + '\nPrüfwert: ' + pruefwert + '\n');"
```

Save the generated `AES-Key` in your `config.json` under `rksv.aesKey`.

**3. Register in FinanzOnline**
Log into FinanzOnline (section "Registrierkassen") and register:
- **The Cash Register (Kassa):** Enter your "Kassen-ID", the generated **AES-Key** (Benutzerschlüssel), and the **Prüfwert** from Step 2.
- **The Signature Device (Sicherheitseinrichtung):** Enter the serial number (Hex format) of your cloud certificate and select "HSM" (Hardware Security Module of a service provider).

**4. Implement the API in your Code**
In `src/lib/rksv.ts`, replace the stubs:
- **AES Encryption:** Implement standard Node.js `crypto` to encrypt the turnover using your AES key (fully local and free).
- **JWS Signature:** Replace `STUB_SIGNATURE` with an HTTP `POST` request to your provider's API. Send the payload string, and their server returns the cryptographic signature.

**5. Generate the Startbeleg**
Create your first zero-receipt (`npm run cli startbeleg`). This receipt will have a legally valid QR code.

**6. Verify the Startbeleg**
Scan the QR code of the Startbeleg with the official **BMF Belegcheck App**. Once the app says "Valid", your cash register is legally active.

### Cloud Provider Cost Overview

**Option A: A-Trust (Recommended)**
A-Trust is the market leader in Austria and the most cost-effective for this self-hosted setup, as you only pay for the raw signatures.
- **Pricing:** € 100 for a 5-year basic package.
- *Estimated Total Cost:* € 100 to get started for the first 5 years (for low volume).

**Option B: Fiskaly**
Fiskaly offers a modern REST API that can handle the whole DEP storage, AES encryption, and FinanzOnline reporting. Since this project handles DEP natively via Git, much of Fiskaly's feature set is redundant here.
- **Pricing:** Subscription-based, ~€ 10.00 - € 15.00 per month per cash register.
- *Estimated Total Cost:* ~€ 120 - € 180 per year.

**Option C: GlobalTrust**
Similar to A-Trust. Usually around € 40 for a 3-year certificate including a set amount of cloud signatures.
