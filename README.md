# Pushpa Raj Automotive Services Management System

A fast, dependable, 100% offline-first vehicle workshop management system built for **Pushpa Raj Automotive Services**.

---

## 🌟 Key Highlights & Architectural Guarantees

1. **100% Offline Single-Computer Operation (Phase 1)**:
   - Runs entirely on the workshop computer with zero internet, cloud account, or external dependency.
   - Binds strictly to `127.0.0.1` (loopback).
2. **"The Golden Rule" Financial Precision**:
   - Never stores only the final total; stores individual line components in integer paise (`1/100 Rupee`).
   - Authoritative totals are derived by the backend service engine. Unapproved/rejected lines are retained for audit but strictly excluded from billing totals.
3. **High-Fidelity Server-Side PDF Engine**:
   - Generates pixel-perfect A4 Invoices and Job Cards directly from database data via **ReportLab** with embedded TrueType fonts for the Indian Rupee (`₹`) symbol and VOID watermarks.
4. **Data Safety & Online SQLite Backup**:
   - SQLite Write-Ahead Logging (`WAL`) mode with `NORMAL` synchronous mode for crash safety.
   - One-click consistent snapshot backups using SQLite's online backup API with SHA-256 manifest verification and safety pre-restore backups.
5. **Phase 2 Ready (API-Driven)**:
   - Clean decoupled separation between React UI and FastAPI REST backend. When internet/multi-device access is needed in Phase 2, the app connects to a cloud PostgreSQL backend without rewriting UI or business logic.

---

## 🚀 Quick Start (Running Locally)

### 1. One-Click Launch (Windows)
Double-click `launch.bat` in the project root:
- Starts the FastAPI backend at `http://127.0.0.1:8000`
- Starts the React frontend at `http://127.0.0.1:5173`
- Automatically opens the default browser

### 2. Manual Terminal Launch

**Backend**:
```bash
# Activate virtual environment
.venv\Scripts\activate

# Run FastAPI server
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

**Frontend**:
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

---

## 📋 Core Workshop Workflow

1. **First-Run Setup Wizard**:
   - Runs automatically on initial launch when no Admin exists.
   - Sets up initial Admin credentials and workshop profile (Name, address, contact phone, GSTIN, UPI ID).
2. **Vehicle & Customer Intake**:
   - Open New Job Card via `+ New Job Card` button.
   - Format-insensitive vehicle registration lookup (`AP 31 XX 1234` or `ap31xx1234`).
   - Shows inline "Previous Service Summary" for returning vehicles.
3. **Itemised Customer Complaints**:
   - Record distinct complaints with quick auto-complete suggestions.
4. **Inspection & Diagnosis Checklist**:
   - Standard categories: Engine, Brakes, Battery, Tyres, Suspension, Lights, Fluids, AC, Others.
   - Mark as `Normal` or `Needs Attention` with notes.
5. **Labour & Parts Selection**:
   - Choose from pre-configured catalogs or type custom items.
   - Supports fractional quantities for fluids (e.g. 3.5 litres).
6. **Customer Approval / Estimate**:
   - Toggle individual items or "Approve All".
   - Rejected items are crossed out and excluded from bill totals in real-time.
7. **Invoicing & Locking**:
   - Finalizing assigns sequential `INV-YYYY-NNNNN` and locks line items from further edits.
   - Direct PDF download & print.
8. **Payment Settlement**:
   - Record full or partial payments via Cash, UPI, Card, Bank Transfer, or Cheque.
   - Tracks remaining balance due; prevents overpayment.
9. **Global Omnibox Search (`Ctrl + K` or `/`)**:
   - Instant search across vehicle registrations, customer mobile, name, job card, and invoice numbers.
10. **Backup & Restore**:
    - Settings &rarr; Backup & Restore &rarr; "Backup Now" creates a complete snapshot into `backups/backup_YYYY-MM-DD_HHMMSS/` with manifest checksums.
    - Automatic warning if no backup has been performed in over 3 days.

---

## 🧪 Automated Testing & Verification

Run the automated test suite verifying all 20+ financial calculation scenarios, Appendix B test cases, and the end-to-end service lifecycle:

```bash
# Run pytest with the virtual environment
.venv\Scripts\pytest.exe
```

All 6 test suites cover:
- Appendix B Creta invoice calculation (₹7,400 with air filter rejected)
- Post-approval secondary rejection (brake pads rejected, reducing total to ₹4,600)
- Fractional quantities for fluids (3.5L synthetic oil)
- Payment transitions (UNPAID &rarr; PARTIALLY_PAID &rarr; PAID &rarr; REVERSED)
- Full end-to-end API lifecycle test with report generation and online SQLite backup
- Sub-300ms indexed search latency benchmark
