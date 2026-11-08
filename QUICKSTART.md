# MOONWITNESS Local Quickstart Guide

Panduan praktis menjalankan aplikasi di monorepo MOONWITNESS untuk pengembangan sehari-hari.

---

## 1. Peta Port & Layanan Aplikasi

| Aplikasi        |  Port   | Tipe                                 | Perintah Dev (dari Root)   |
| --------------- | :-----: | ------------------------------------ | -------------------------- |
| **GATE**        | `:3001` | Public Entrance & Universe Discovery | `pnpm dev:gate`            |
| **HEADQUARTER** | `:3000` | Management, Executive & Governance   | `pnpm dev:headquarter`     |
| **COCKPIT**     | `:3002` | Desktop NOC & Telemetry Flight Deck  | `pnpm dev:cockpit`         |
| **ARSY**        | `:4000` | Fastify Core Backend Orchestrator    | `pnpm dev:arsy`            |
| **ORACLE**      | `:8000` | Python Analytical & Compute Engine   | `docker compose up oracle` |

---

## 2. Perintah Penting Sehari-hari

### Menjalankan Satu Aplikasi Tertentu:

```bash
# Menjalankan Public Gateway (Gate)
pnpm dev:gate

# Menjalankan Cockpit Dashboard
pnpm dev:cockpit

# Menjalankan Daemon Desktop Cockpit (Rust)
pnpm dev:cockpit:desktop

# Menjalankan Backend ARSY
pnpm dev:arsy
```

### Menjalankan Semua Aplikasi Frontend & Backend Sekaligus:

```bash
pnpm dev:all
```

---

## 3. Fitur Multi-Environment COCKPIT

Aplikasi **COCKPIT** dilengkapi tombol switcher environment di bagian header:

- **Local Workstation:** Memantau `localhost` (`:4000`, `:8000`, `:5432`, `:1812`).
- **Development Staging:** Memantau cluster staging remote (`dev-cluster.moonwitness.internal`).
- **Production (Air-Gapped / VPN):** Khusus operator berotorisasi dengan verifikasi Ed25519 token.
