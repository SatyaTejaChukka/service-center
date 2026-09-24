# 🔧 Service Center — Workshop Management System

A production-grade, **100% offline-first** vehicle service center management system. Manage the complete lifecycle of every vehicle — from intake to invoice — without any internet dependency.

---

## ✨ Feature Overview

| Module | What It Does |
|---|---|
| **Dashboard** | Live KPIs — active job cards, total revenue, pending payments, daily/weekly trends |
| **Job Cards** | Full service lifecycle: intake → diagnosis → estimate → approval → completion |
| **Invoices & Billing** | Auto-generated invoices with GST, line-item approval, PDF export |
| **Customer Management** | Customer profiles with service history and linked vehicles |
| **Vehicle Registry** | Vehicle database with registration lookup, odometer tracking, service timeline |
| **Catalogue Management** | Pre-configured labour services and parts with pricing |
| **Reports** | Revenue reports, outstanding receivables, daily summaries with date-range filters |
| **WhatsApp Integration** | 1-click message templates for estimates, receipts, and intake gatepasses |
| **Global Search** | Omnibox search (`Ctrl+K`) across vehicles, customers, job cards, invoices |
| **Backup & Restore** | Online SQLite backup with SHA-256 manifest verification |
| **Setup Wizard** | First-run wizard for admin credentials and workshop profile configuration |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React + TypeScript                    │
│              (Vite • TailwindCSS • Lucide)              │
│                   localhost:5173                         │
├─────────────────────────────────────────────────────────┤
│                     REST API (JSON)                      │
├─────────────────────────────────────────────────────────┤
│                FastAPI + SQLAlchemy ORM                  │
│               (ReportLab PDF • Passlib)                  │
│                   localhost:8000                         │
├─────────────────────────────────────────────────────────┤
│              SQLite (WAL Mode) — Single File             │
│                  Local Data Directory                    │
└─────────────────────────────────────────────────────────┘
```

### Design Principles

- **Offline-First**: Runs entirely on `127.0.0.1` with zero internet, cloud, or external service dependency.
- **Financial Precision**: All monetary values stored as **integer paise** (1/100 ₹). Totals computed server-side; never stored as floats.
- **Audit Trail**: Unapproved/rejected line items are retained in the database for audit but excluded from billing totals.
- **Phase 2 Ready**: Clean separation between React UI and FastAPI REST backend. Easily migrate to PostgreSQL + cloud hosting without rewriting UI or business logic.

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |

### Option 1: One-Click Launch (Windows)

Double-click **`launch.bat`** in the project root. It will:
1. Start the FastAPI backend at `http://127.0.0.1:8000`
2. Start the Vite dev server at `http://127.0.0.1:5173`
3. Open the browser automatically

### Option 2: Manual Setup

**1. Clone and install backend:**
```bash
git clone <repository-url>
cd service-center

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (macOS/Linux)
source .venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

**2. Install frontend:**
```bash
cd frontend
npm install
cd ..
```

**3. Start the backend:**
```bash
# From project root, with venv activated
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

**4. Start the frontend (in a separate terminal):**
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

**5. Open** `http://127.0.0.1:5173` in your browser.

### First-Run Setup

On first launch (when no admin user exists), the **Setup Wizard** will guide you through:
1. Creating an admin account (username & password)
2. Configuring your workshop profile (name, address, phone, GSTIN, UPI ID)

---

## 📋 Core Workshop Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Vehicle  │───▶│ Job Card │───▶│ Customer │───▶│ Invoice  │───▶│ Payment  │
│  Intake   │    │ Created  │    │ Approval │    │ Finalized│    │ Settled  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Step-by-Step

1. **New Job Card** → Click `+ New Job Card` from the sidebar
2. **Vehicle Lookup** → Enter registration number (format-insensitive: `AP 31 XX 1234` or `ap31xx1234`)
   - Returning vehicles show previous service summary
3. **Customer Complaints** → Record itemised complaints with auto-complete suggestions
4. **Inspection Checklist** → Checklist categories: Engine, Brakes, Battery, Tyres, Suspension, Lights, Fluids, AC, Others
   - Mark each as `Normal` or `Needs Attention` with notes
5. **Labour & Parts** → Select from configured catalogs or add custom line items
   - Supports fractional quantities (e.g., 3.5 litres of engine oil)
6. **Customer Approval** → Toggle individual items or "Approve All"
   - Rejected items are visually crossed out and excluded from billing
7. **Generate Invoice** → Finalising assigns a sequential `INV-YYYY-NNNNN` number and locks the job card
   - Download or print A4 PDF with workshop branding
8. **Record Payment** → Cash, UPI, Card, Bank Transfer, or Cheque
   - Supports partial payments with remaining balance tracking
9. **WhatsApp Notification** → Send estimate, receipt, or gatepass via WhatsApp with one click

---

## 🔌 API Reference

The backend exposes a RESTful API at `http://127.0.0.1:8000/api/v1/`.

| Endpoint Group | Base Path | Key Operations |
|---|---|---|
| **Auth** | `/api/v1/auth` | Login, token refresh, setup wizard |
| **Job Cards** | `/api/v1/job-cards` | CRUD, status transitions, item management |
| **Invoices** | `/api/v1/invoices` | Create from job card, finalise, payments, PDF download |
| **Customers** | `/api/v1/customers` | CRUD, service history lookup |
| **Vehicles** | `/api/v1/vehicles` | CRUD, registration search, service timeline |
| **Catalogs** | `/api/v1/catalogs` | Labour & parts catalog management |
| **Dashboard** | `/api/v1/dashboard` | KPI stats, revenue metrics |
| **Reports** | `/api/v1/reports` | Revenue, receivables, daily summary with date filters |
| **Search** | `/api/v1/search` | Omnibox search across all entities |
| **Backup** | `/api/v1/backup` | Create & restore database snapshots |
| **Settings** | `/api/v1/settings` | Workshop profile, preferences |
| **Users** | `/api/v1/users` | User management |

> 💡 Interactive API docs available at `http://127.0.0.1:8000/api/v1/openapi.json` when the backend is running.

---

## 💰 Financial Calculation Engine

All monetary calculations follow strict rules to ensure accuracy:

- **Storage**: All amounts stored as **integer paise** (`₹1,000.00` → `100000`)
- **Line Item Total**: `unit_price × quantity` (per item)
- **Tax**: Applied per line item: `line_total × tax_rate / 100`
- **Discount**: Applied per line item: `line_total × discount_rate / 100`
- **Invoice Total**: Sum of `(line_total + tax - discount)` for **approved items only**
- **Rejected items**: Retained in DB for audit, excluded from all billing totals
- **Payment tracking**: Prevents overpayment; tracks partial payments with balance due

---

## 🧪 Testing

Run the automated test suite:

```bash
# Ensure virtual environment is activated
.venv\Scripts\pytest.exe
# or
pytest
```

### Test Suites

| Test File | Coverage |
|---|---|
| `test_calculations.py` | Financial calculation scenarios — tax, discount, rejection, fractional quantities |
| `test_full_lifecycle.py` | End-to-end API lifecycle: intake → approval → invoice → payment → PDF |
| `test_benchmark_100k.py` | Search latency benchmark with indexed queries |

---

## 📁 Project Structure

```
service-center/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/       # Route handlers
│   │   │   │   ├── auth.py          # Authentication & setup wizard
│   │   │   │   ├── job_cards.py     # Job card CRUD & item management
│   │   │   │   ├── invoices.py      # Invoice lifecycle & payments
│   │   │   │   ├── customers.py     # Customer management
│   │   │   │   ├── vehicles.py      # Vehicle registry
│   │   │   │   ├── catalogs.py      # Labour & parts catalogs
│   │   │   │   ├── dashboard.py     # KPI metrics
│   │   │   │   ├── reports.py       # Financial reports
│   │   │   │   ├── search.py        # Global search
│   │   │   │   ├── backup.py        # Database backup/restore
│   │   │   │   ├── settings.py      # Workshop settings
│   │   │   │   ├── users.py         # User management
│   │   │   │   └── audit.py         # Audit trail
│   │   │   └── api.py               # Router aggregation
│   │   ├── core/
│   │   │   ├── config.py            # Application settings & paths
│   │   │   ├── database.py          # SQLite engine & session management
│   │   │   ├── security.py          # JWT auth & password hashing
│   │   │   └── audit.py             # Audit logging
│   │   ├── models/
│   │   │   └── __init__.py          # SQLAlchemy ORM models
│   │   ├── schemas/
│   │   │   └── __init__.py          # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── calculation_service.py   # Financial computation engine
│   │   │   ├── pdf_service.py           # ReportLab A4 PDF generator
│   │   │   ├── numbering_service.py     # Sequential JC/INV numbering
│   │   │   ├── search_service.py        # Full-text search
│   │   │   └── backup_service.py        # SQLite online backup
│   │   └── main.py                  # FastAPI application entry point
│   ├── tests/
│   │   ├── conftest.py              # Pytest fixtures
│   │   ├── test_calculations.py     # Financial calculation tests
│   │   ├── test_full_lifecycle.py   # End-to-end API tests
│   │   └── test_benchmark_100k.py   # Performance benchmarks
│   └── requirements.txt             # Python dependencies
├── frontend/
│   ├── public/
│   │   ├── favicon.svg              # Browser tab icon
│   │   └── icons.svg                # UI icon sprites
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   └── WhatsAppPreviewModal.tsx
│   │   │   ├── customer/
│   │   │   │   └── NewCustomerModal.tsx
│   │   │   ├── invoice/
│   │   │   │   └── InvoiceDetailModal.tsx
│   │   │   ├── jobcard/
│   │   │   │   └── NewJobCardModal.tsx
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   └── search/
│   │   │       └── GlobalSearchModal.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # Authentication state management
│   │   ├── lib/
│   │   │   ├── api.ts               # API client (fetch wrapper)
│   │   │   ├── formatters.ts        # Currency & date formatters
│   │   │   └── whatsapp.ts          # WhatsApp message templates
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx     # Main dashboard with KPIs
│   │   │   ├── JobCardsPage.tsx      # Job cards listing
│   │   │   ├── JobCardDetailPage.tsx # Job card detail & editing
│   │   │   ├── InvoicesPage.tsx      # Invoices listing
│   │   │   ├── CustomersPage.tsx     # Customers listing
│   │   │   ├── CustomerDetailPage.tsx# Customer profile & history
│   │   │   ├── VehiclesPage.tsx      # Vehicles listing
│   │   │   ├── VehicleDetailPage.tsx # Vehicle profile & service log
│   │   │   ├── CatalogsPage.tsx      # Catalogue management
│   │   │   ├── ReportsPage.tsx       # Financial reports
│   │   │   ├── SettingsPage.tsx      # Workshop settings & backup
│   │   │   ├── LoginPage.tsx         # Login screen
│   │   │   └── SetupWizardPage.tsx   # First-run configuration
│   │   ├── App.tsx                   # Root component & navigation
│   │   ├── App.css                   # Global styles
│   │   ├── index.css                 # Tailwind directives
│   │   └── main.tsx                  # React entry point
│   ├── index.html                    # HTML shell
│   ├── package.json                  # npm dependencies
│   ├── tailwind.config.js            # Tailwind configuration
│   ├── postcss.config.js             # PostCSS configuration
│   ├── tsconfig.json                 # TypeScript configuration
│   └── vite.config.ts                # Vite build configuration
├── launch.bat                        # One-click Windows launcher
├── pytest.ini                        # Pytest configuration
├── .gitignore                        # Git ignore rules
└── README.md                         # This file
```

---

## 🔐 Security

- **Authentication**: JWT-based with bcrypt password hashing (via `passlib`)
- **Session**: 24-hour access token expiry
- **Network**: Binds to `127.0.0.1` only — no external network access in Phase 1
- **CORS**: Whitelisted origins for local development ports only

---

## 💾 Data & Backup

| Item | Location (Windows) |
|---|---|
| **Database** | `%LOCALAPPDATA%/PushpaRajAutomotive/data/automotive.db` |
| **Documents (PDFs)** | `%LOCALAPPDATA%/PushpaRajAutomotive/documents/` |
| **Backups** | `%LOCALAPPDATA%/PushpaRajAutomotive/backups/` |

- **WAL Mode**: SQLite Write-Ahead Logging for crash safety
- **Backup Process**: Online SQLite backup API with SHA-256 manifest checksums
- **Restore**: Safety pre-restore backup created automatically before restoring

> ⚠️ The system warns if no backup has been performed in the last 3 days.

> 💡 Override the data directory with the `PR_DATA_DIR` environment variable.

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | REST API framework |
| SQLAlchemy | ORM & database management |
| SQLite | Embedded database (WAL mode) |
| Pydantic | Request/response validation |
| ReportLab | PDF generation (invoices, job cards) |
| Passlib + python-jose | Authentication (bcrypt + JWT) |
| pytest + httpx | Automated testing |

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type-safe JavaScript |
| Vite | Build tool & dev server |
| TailwindCSS | Utility-first CSS framework |
| Lucide React | Icon library |

---

## 📝 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PR_DATA_DIR` | `%LOCALAPPDATA%/PushpaRajAutomotive` | Base directory for all application data |

Create a `.env` file in the project root to override defaults.

---

## 📜 License

Private — for internal workshop use.
