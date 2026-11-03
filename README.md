# Tailor Manager — Offline Tailor Management System

A fast, simple desktop app for tailor shops to manage customers, measurements, orders and print measurement slips — fully offline.

Built with **Electron + React + TypeScript + Tailwind CSS** and a local **SQLite** database (no internet required, ever).

## Features

- **Login / Logout** — single owner account (default: `admin` / `admin123`, change it in Settings)
- **Customers** — full name, phone, CNIC; instant search by any of them
- **Measurements** — one measurement set per customer, 23 fields exactly matching the printed slip, plus special notes, urgent flag and "measured by"
- **Orders** — garment type, quantity, price, advance payment, remaining balance (auto-calculated), order & delivery dates
- **Order status workflow** — click the status badge to advance: Pending → Stitching → Ready → Delivered
- **Dashboard** — customers, orders by status, due today, overdue orders and total outstanding balance
- **Measurement slip printing** — enhanced Urdu slip (bigger fonts, bordered grid, shop header, slip #, date/time, CNIC, signature line) printed **silently** to the selected/default printer; also supports on-screen preview
- **Settings** — shop name/address printed on slips, printer selection, password change

## Getting Started

```bash
npm install     # install dependencies
npm run dev     # run app in development mode
```

Default login: **admin / admin123**

## Building the Windows Installer

```bash
npm run build:win
```

The setup `.exe` is created in the `dist/` folder — copy it to the tailor's PC to install.

## Where is the data stored?

A single SQLite file: `%APPDATA%\Tailor Manager\tailor.db`

Back up this one file to keep a full backup of the shop's data.

## Project Structure

```
src/
├── shared/            # types + measurement field definitions (used by main & renderer)
├── main/              # Electron main process
│   ├── db.ts          # SQLite connection, migrations, first-run seed
│   ├── auth.ts        # password hashing, login/session
│   ├── print.ts       # slip printing (hidden window + silent print)
│   ├── ipc/           # IPC handlers, one file per feature
│   └── index.ts       # app entry, window setup
├── preload/           # contextBridge — safe typed API exposed to React
└── renderer/          # React UI (Tailwind CSS)
    └── src/
        ├── pages/     # Login, Dashboard, Customers, CustomerDetail, Orders, Settings, SlipPrint
        ├── components/# Layout, MeasurementForm, OrderForm, ui/ primitives
        ├── context/   # Auth + Toast providers
        └── lib/       # api wrapper, formatters
```

## Notes

- The database uses `node:sqlite` (built into Electron) — no native modules to compile, nothing extra to install on the target PC.
- The Urdu font (Noto Nastaliq Urdu, SIL Open Font License) is bundled, so slips print correctly even on PCs without Urdu fonts.
- Slips print **silently** to the printer chosen in Settings (or the Windows default printer). If printing fails, the slip opens on screen so you can print manually.
