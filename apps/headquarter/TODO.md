# Headquarter — Architecture & Enterprise Readiness TODO

> **Tujuan:** membangun `apps/headquarter` sebagai command center manusia untuk ekosistem MOONWITNESS/RIOTWORKS: arsitektur rapi, konsisten, aman, mudah dikembangkan oleh banyak tim, dan memiliki identitas visual Extreme Riot.
>
> **Prinsip utama:** *Enterprise-grade architecture, Riotworks-grade identity.*
>
> Dokumen ini adalah rencana kerja bertahap, bukan klaim bahwa seluruh fitur sudah tersedia. Centang task hanya setelah implementasi dan verifikasi benar-benar selesai.

---

## 0. Kontrak arsitektur dan prinsip kerja

- [ ] Tetapkan `apps/headquarter` sebagai aplikasi UI manusia berbasis Next.js App Router.
- [ ] Tetapkan `apps/arsy` sebagai backend/API dan orchestration runtime; Headquarter mengaksesnya melalui kontrak API, bukan import internal backend.
- [ ] Gunakan `packages/*` untuk kapabilitas reusable lintas aplikasi; jangan memindahkan business feature Headquarter ke package generik tanpa alasan lintas-app yang jelas.
- [ ] Gunakan `packages/ui` sebagai sumber primitive UI dan design token bersama; Headquarter menyusun pola dan pengalaman domain di atasnya.
- [ ] Pertahankan batas dependensi: Headquarter tidak bergantung pada Fastify, database driver, ORM, atau internal implementation ARSY.
- [ ] Terapkan prinsip feature-oriented: setiap domain/fitur memiliki ownership, komponen, state, API adapter, dan test yang jelas.
- [ ] Hindari big-bang rewrite. Refactor bertahap dengan perilaku aplikasi tetap dapat diverifikasi.
- [ ] Jangan membuat folder, abstraction, provider, atau layer hanya untuk memenuhi bentuk arsitektur; setiap layer harus punya tanggung jawab nyata.
- [ ] Dokumentasikan keputusan arsitektur penting dan alasan perubahan agar konsistensi terjaga saat tim bertambah.

**Acceptance criteria**
- [ ] Ada dokumen ringkas yang menjelaskan boundary Headquarter, ARSY, dan packages.
- [ ] Tidak ada dependency langsung Headquarter ke database/ORM atau internal backend.
- [ ] Struktur folder merefleksikan ownership yang nyata, bukan sekadar folder kosong.

---

## Phase 0 — Audit dan baseline

**Tujuan:** memahami kondisi aktual sebelum mengubah struktur. Catat temuan berdasarkan source code dan hasil command, bukan asumsi.

### 0.1 Inventaris aplikasi
- [x] Inventaris seluruh route App Router, layout, page, loading, error, not-found, dan route handler.
- [x] Petakan komponen shell: sidebar, topbar, navigation, workspace selector, command palette, notification center, user menu, mobile navigation.
- [x] Petakan semua feature yang sudah ada dan statusnya: production-ready, partial, prototype, placeholder, atau belum ada (lihat tabel status di `AUDIT.md`).
- [x] Identifikasi komponen yang hanya digunakan satu feature vs yang benar-benar reusable.
- [x] Inventaris assets, fonts, global CSS, Tailwind config, theme provider, dan token yang digunakan.
- [x] Inventaris seluruh environment variable dan konfigurasi runtime; tidak ditemukan pembacaan env/secret pada source Headquarter yang diaudit.

### 0.2 Dependency dan kualitas
- [x] Audit dependency internal dan eksternal di `package.json`; tandai dependency duplikat, tidak terpakai, atau berisiko.
- [x] Petakan import graph dan cari circular dependency pada boundary Headquarter yang diaudit.
- [x] Verifikasi integrasi `@riotworks/ui`, termasuk exports, styles, Tailwind preset/config, dan transpilation.
- [ ] Jalankan lint, typecheck, test, dan build; simpan baseline hasil aktual.
- [x] Perbaiki script quality gate yang menelan error (contoh pola `|| echo lint-skip`); command gagal harus membuat proses gagal.
- [x] Identifikasi konfigurasi yang berbeda atau bertentangan dengan standar monorepo.

### 0.3 UX dan accessibility baseline
- [ ] Audit semua route pada desktop, tablet, dan mobile.
- [ ] Audit keyboard navigation, focus visibility, dialog semantics, screen reader labels, dan color contrast.
- [x] Inventaris state UI yang belum tersedia: loading, empty, error, permission denied, offline, stale, partial data, dan demo.
- [x] Bedakan interaksi sungguhan dari simulasi/prototype (mis. notification, locale, workspace, command palette, theme).

### 0.4 Dokumentasi audit
- [x] Cocokkan implementasi aktual dengan Information Architecture dan dokumen DNA/guideline proyek.
- [x] Tandai dokumentasi historis yang sudah tidak sesuai source saat ini; jangan jadikan dokumen lama sebagai fakta implementasi.
- [x] Buat ringkasan gap: P0 blocker, P1 high, P2 medium, P3 polish (lihat `AUDIT.md`).
- [x] Simpan baseline command dan hasil audit; eksekusi command lokal tetap menunggu clean checkout/CI.

**Gate Phase 0**
- [ ] Route inventory, dependency map, UX audit, dan baseline quality tersedia.
- [ ] Setiap temuan prioritas memiliki file/lokasi, dampak, rekomendasi, dan cara verifikasi.
- [ ] Tidak memulai pemindahan folder besar sebelum audit disetujui.

---

## Phase 1 — Structural foundation

**Tujuan:** membentuk struktur yang konsisten dan scalable tanpa membuat abstraksi berlebihan.

### 1.1 Struktur ownership
- [x] Definisikan konvensi folder resmi untuk `app`, `shell`, `features`, `platform`, `components`, `hooks`, `lib`, `styles`, dan `types` (lihat `ARCHITECTURE.md`).
- [ ] Pisahkan route composition dari implementasi feature; page sebaiknya menjadi composition layer yang tipis.
- [x] Kelompokkan komponen global shell ke area shell tersendiri.
- [ ] Kelompokkan domain-specific UI, hooks, API adapters, types, dan tests di dalam feature pemiliknya.
- [ ] Letakkan primitive reusable di `packages/ui`; jangan membuat salinan primitive di Headquarter.
- [ ] Letakkan integrasi lintas-feature (auth, API client, workspace context, localization, telemetry) di platform layer hanya jika benar-benar shared.
- [ ] Hindari barrel export yang menyebabkan import cycle atau menyembunyikan dependency terlalu luas.
- [ ] Tetapkan aturan penamaan file, komponen, hooks, types, constants, dan test.

### 1.2 Routing dan layout
- [x] Evaluasi route grouping untuk workspace dan administration; keputusan Phase 1 adalah mempertahankan URL saat ini sampai locale/auth/workspace routing siap.
- [x] Tetapkan keputusan locale: target URL `/id` dan `/en` didokumentasikan; implementasi routing ditunda sampai platform localization siap.
- [ ] Pastikan root layout, locale layout, dan workspace layout memiliki tanggung jawab berbeda.
- [x] Tambahkan not-found, error boundary, dan loading boundary pada level route App Router.
- [ ] Pastikan deep-link, refresh halaman, dan navigasi browser berfungsi konsisten.
- [x] Pastikan navigasi mobile dan desktop menggunakan sumber konfigurasi yang sama.

### 1.3 Dependency boundaries
- [x] Tetapkan aturan arah import: route → feature/shell composition → platform/packages; hindari dependency melingkar (lihat `ARCHITECTURE.md`).
- [ ] Pisahkan server-only module dari client component; tandai boundary dengan benar.
- [ ] Pastikan secret, privileged token, dan server configuration tidak pernah diimpor ke client.
- [ ] Tambahkan lint/import rules untuk mencegah dependency terlarang.
- [ ] Tetapkan public entrypoint feature hanya jika dibutuhkan consumer lain.

### 1.4 Refactor shell
- [ ] Pecah AppShell berdasarkan tanggung jawab (navigation, topbar, command palette, notification center, user menu, mobile shell).
- [ ] Jaga AppShell sebagai composition/orchestration UI, bukan tempat business logic feature.
- [x] Ekstrak konfigurasi navigation ke satu sumber data dengan grouping dan metadata yang eksplisit.
- [x] Hilangkan state duplikat antara desktop navigation dan mobile navigation.
- [x] Pastikan active route dan nested route memiliki perilaku konsisten; disabled/permission-aware item menunggu model authorization.
- [ ] Tambahkan test untuk shell navigation dan route matching.

**Gate Phase 1**
- [ ] Struktur baru terdokumentasi dan semua route lama yang wajib dipertahankan tetap dapat diakses.
- [ ] Tidak ada circular import atau dependency boundary violation yang diketahui.
- [ ] Lint, typecheck, test, dan build lulus setelah refactor.

---

## Phase 2 — Enterprise platform foundation

**Tujuan:** menyediakan kapabilitas lintas-feature yang aman dan konsisten.

### 2.1 API integration
- [x] Tetapkan satu browser-safe API client/integration boundary untuk komunikasi dengan ARSY (`src/platform/arsy`).
- [ ] Finalisasi kontrak request/response dan error envelope bersama public API ARSY; adapter frontend saat ini hanya menyediakan typed baseline, bukan klaim kontrak backend sudah final.
- [x] Standarkan timeout, cancellation, retry policy, dan penanganan network failure pada browser client.
- [x] Batasi retry otomatis hanya untuk GET; mutation tidak pernah di-retry otomatis.
- [ ] Tambahkan server-only API adapter terpisah setelah kebutuhan Server Component/BFF dan model session ARSY dipastikan.
- [ ] Hindari fetch langsung yang tersebar di komponen presentational.
- [ ] Pastikan error backend ditampilkan sebagai pesan yang aman dan actionable; jangan membocorkan stack trace atau secret.

### 2.2 Identity, session, dan authorization
- [ ] Dokumentasikan sumber identity dan lifecycle session.
- [ ] Implementasikan authentication flow berdasarkan keputusan platform yang berlaku.
- [ ] Definisikan model permission/capability yang dapat dipakai konsisten oleh UI.
- [ ] Terapkan permission-aware navigation, action, page, dan data visibility.
- [ ] Perlakukan backend ARSY sebagai security enforcement boundary; UI hiding bukan kontrol keamanan.
- [ ] Sediakan state unauthorized, forbidden, session expired, dan re-authentication.
- [ ] Audit akses langsung melalui URL dan API, bukan hanya melalui menu.

### 2.3 Workspace dan application context
- [ ] Definisikan workspace context dan lifecycle pemilihannya.
- [ ] Tetapkan konteks global yang memang diperlukan: workspace, timezone, locale, date range, currency, environment/live-demo, dan user identity.
- [ ] Hindari global context yang tidak relevan untuk seluruh fitur.
- [ ] Pastikan perubahan workspace membersihkan atau memuat ulang data yang terikat workspace.
- [ ] Pastikan cache/query key mencakup scope workspace dan permission yang relevan.
- [ ] Tampilkan workspace/environment aktif secara jelas agar user tidak salah mengoperasikan environment.

### 2.4 Preferences dan localization
- [ ] Tetapkan satu mekanisme locale yang sinkron dengan routing dan preference user.
- [ ] Hindari string UI tersebar atau conditional translation manual di komponen.
- [ ] Pastikan format tanggal, waktu, angka, dan currency mengikuti locale/timezone.
- [ ] Persist theme dan preference yang memang perlu lintas sesi.
- [ ] Pastikan preference memiliki default dan fallback yang jelas.

### 2.5 Operational UX
- [ ] Definisikan standar notification center dan sumber event yang valid.
- [ ] Definisikan command palette sebagai navigasi dan action registry, bukan sekadar filter label menu.
- [ ] Tambahkan empty state yang menjelaskan penyebab dan tindakan berikutnya.
- [ ] Tambahkan error state dengan retry/recovery bila aman.
- [ ] Tampilkan data freshness/stale state jika relevan.
- [ ] Bedakan status koneksi, status service, status job, dan status data; jangan menggunakan satu indikator generik.
- [ ] Hilangkan indikator sukses/online palsu yang tidak berasal dari health/status aktual.
- [ ] Sediakan audit trail UI untuk tindakan sensitif jika backend menyediakan event/audit data.

### 2.6 Observability dan resilience
- [ ] Standarkan structured client logging tanpa data sensitif.
- [x] Kirim `x-request-id` pada setiap request dan baca request ID dari response/error envelope bila tersedia.
- [ ] Integrasikan error reporting sesuai platform.
- [x] Tambahkan route-level error boundary, loading skeleton, dan not-found fallback UI.
- [ ] Pastikan operasi async memiliki pending, success, failure, dan cancellation behavior.
- [ ] Definisikan strategi cache, invalidation, dan stale data per jenis data.

**Gate Phase 2**
- [ ] Semua feature menggunakan integration boundary yang disepakati.
- [ ] Permission enforcement tetap dilakukan backend dan telah diuji.
- [ ] Workspace/environment context tidak menyebabkan data lintas-scope tercampur.
- [ ] Tidak ada interaksi inti yang hanya menampilkan simulasi seolah-olah operasi berhasil.

---

## Phase 3 — Design system dan visual DNA

**Tujuan:** menjadikan UI konsisten, khas MOONWITNESS/RIOTWORKS, dan tetap nyaman untuk penggunaan operasional jangka panjang.

### 3.1 Audit dan kontrak design system
- [x] Audit exports, API, styling, token, dan primitive inti `packages/ui` pada scope yang digunakan Headquarter.
- [x] Tetapkan ownership token: source of truth berada di `packages/ui`, bukan salinan per aplikasi.
- [x] Definisikan semantic tokens untuk surface, text, border, accent, focus, status, overlay, dan interactive state.
- [ ] Migrasikan seluruh komponen/halaman agar memakai semantic token; migrasi awal tersedia pada global foundation dan Badge/Button.
- [ ] Finalisasi spacing, radius, elevation, border, motion, typography, dan z-index scale secara menyeluruh.
- [x] Dokumentasikan aturan kapan memakai primitive UI dan kapan membuat domain pattern di `packages/ui/DESIGN-TOKENS.md`.

### 3.2 Visual identity
- [ ] Pertahankan DNA Extreme Riot, MoonWitness comic universe, punk-zine energy, industrial brutalism, dan premium game HUD.
- [ ] Gunakan identitas visual secara terarah; jangan menjadikan semua panel penuh dekorasi atau efek.
- [x] Finalisasi semantic mapping awal palette Night Riot dan Paper Riot.
- [x] Pastikan theme switch mengubah token semantik untuk surface, content, focus, dan status, bukan sekadar membalik background.
- [ ] Definisikan typography hierarchy: display, heading, body, label, data, dan monospace.
- [ ] Gunakan display type yang kuat untuk identitas, sans yang mudah dibaca untuk operasional, dan monospace untuk data teknis.
- [ ] Standarkan iconography, illustration, brand mark, dan penggunaan character artwork.
- [x] Tetapkan baseline motion yang cepat dan purposeful serta menghormati reduced-motion preference.

### 3.3 Component primitives dan patterns
- [ ] Audit/standarkan Button, IconButton, Input, Select, Checkbox, Switch, Tabs, Badge, Tooltip, Dialog, Drawer, Dropdown, Popover, dan Toast.
- [ ] Standarkan DataTable, pagination, filter bar, search, detail panel, action menu, status indicator, dan empty state.
- [ ] Pastikan setiap interactive primitive memiliki keyboard behavior, focus state, accessible name, dan disabled state (Button dan command palette sudah mendapat perbaikan awal; audit menyeluruh belum).
- [ ] Standarkan form validation, helper text, error message, dan dirty/submitting state.
- [ ] Pastikan komponen memiliki API yang konsisten dan tidak terlalu banyak variant yang tumpang tindih.
- [ ] Tambahkan contoh penggunaan dan dokumentasi singkat untuk pattern utama.

### 3.4 Accessibility dan responsive
- [ ] Audit WCAG 2.2 AA untuk kontras, keyboard, focus, label, dan struktur heading pada area inti.
- [ ] Dialog/drawer harus mendukung focus management, Escape, focus return, dan semantics yang tepat (command palette sudah memiliki focus containment, Escape, focus return, dan dialog semantics; browser verification pending).
- [ ] Pastikan command palette mendukung keyboard navigation dan screen reader announcement.
- [ ] Pastikan sidebar/topbar tidak menghalangi konten pada viewport kecil.
- [ ] Uji zoom, text wrapping, reduced motion, dan touch target.
- [ ] Hindari menyampaikan status hanya melalui warna.

### 3.5 Visual regression
- [ ] Tambahkan visual test/screenshot baseline untuk komponen dan halaman representatif.
- [ ] Uji Night Riot dan Paper Riot.
- [ ] Uji viewport desktop, tablet, dan mobile.
- [ ] Dokumentasikan cara memperbarui baseline tanpa menutupi regresi.

**Gate Phase 3**
- [x] Semantic token menjadi satu sumber kebenaran di `packages/ui`.
- [ ] Primitive dan pattern inti konsisten pada minimal satu feature representatif.
- [ ] Accessibility dan visual regression checks berjalan di CI.

---

## Phase 4 — Feature foundation dan reference implementation

**Tujuan:** membuktikan pola arsitektur pada satu feature sebelum diterapkan ke semua domain.

- [ ] Pilih satu feature representatif (disarankan ARSY DECK bila sesuai prioritas produk) sebagai reference implementation.
- [ ] Dokumentasikan user journey, domain ownership, data source, permission, dan tindakan sensitif feature tersebut.
- [ ] Pisahkan page composition, feature components, hooks/state, API adapter, types, dan tests.
- [ ] Implementasikan integrasi backend nyata melalui API boundary.
- [ ] Implementasikan loading, empty, error, forbidden, stale, partial, dan success state.
- [ ] Implementasikan search/filter/sort/pagination sesuai kebutuhan domain.
- [ ] Implementasikan detail view/drawer dan action confirmation bila relevan.
- [ ] Untuk tindakan berisiko, tampilkan impact, confirmation, progress, hasil, dan audit reference bila tersedia.
- [ ] Pastikan status yang ditampilkan berasal dari data aktual, bukan hardcoded/demo state.
- [ ] Tambahkan unit test untuk logic dan component behavior.
- [ ] Tambahkan integration test untuk API boundary dan permission behavior.
- [ ] Tambahkan E2E untuk alur pengguna utama.
- [ ] Dokumentasikan pola reference implementation untuk direplikasi feature lain.

**Gate Phase 4**
- [ ] Satu feature dapat dipakai sebagai contoh implementasi end-to-end.
- [ ] Tidak ada mock yang menyamar sebagai data produksi.
- [ ] Semua lifecycle state dan permission behavior teruji.
- [ ] Pola dapat direplikasi tanpa copy-paste struktur yang tidak perlu.

---

## Phase 5 — Navigation, administration, dan feature rollout

**Tujuan:** memperluas fondasi ke seluruh area produk dengan ownership yang jelas.

### 5.1 Navigation dan information architecture
- [ ] Cocokkan menu dengan Information Architecture resmi.
- [ ] Kelompokkan menu berdasarkan mental model user, bukan struktur internal backend.
- [ ] Bedakan area workspace/operasional dari administration/system management.
- [ ] Tetapkan label, deskripsi, icon, route, permission, dan status availability untuk setiap menu.
- [ ] Hilangkan menu yang belum memiliki route/fitur nyata atau beri status yang jujur.
- [ ] Pastikan deep link dan breadcrumb konsisten.

### 5.2 Administration
- [ ] Rancang Policy Center untuk policy/configuration governance.
- [ ] Rancang Security & Audit untuk event, access history, dan aktivitas sensitif.
- [ ] Rancang Marketplace Accounts untuk koneksi dan lifecycle akun/integrasi.
- [ ] Rancang AI Providers untuk konfigurasi provider, health, dan capability.
- [ ] Rancang Addon Manager untuk lifecycle addon/plugin dan permission.
- [ ] Rancang ORM/Infrastructure Health sebagai observability/diagnostic surface, bukan tempat mengelola internal backend secara langsung.
- [ ] Rancang Workspace Settings untuk konfigurasi workspace dan preference.
- [ ] Pastikan setiap halaman administration memiliki role/permission model, auditability, dan confirmation untuk perubahan sensitif.

### 5.3 Feature rollout
- [ ] Buat checklist kesiapan yang sama untuk setiap feature.
- [ ] Migrasikan feature satu per satu ke struktur dan API pattern yang telah tervalidasi.
- [ ] Jangan membuka route sebagai production-ready sebelum data, permission, failure state, dan tests tersedia.
- [ ] Tandai capability yang belum tersedia sebagai planned/disabled dengan penjelasan yang akurat.
- [ ] Hapus prototype state dan placeholder setelah pengganti nyata tersedia.
- [ ] Pastikan setiap feature memiliki owner dan dokumentasi operasional.

**Gate Phase 5**
- [ ] Navigation mencerminkan kemampuan produk yang benar-benar tersedia.
- [ ] Area administration terpisah secara konseptual dan permission dari operasional harian.
- [ ] Feature rollout tidak mengorbankan konsistensi UX atau boundary arsitektur.

---

## Phase 6 — Enterprise hardening dan release readiness

**Tujuan:** memastikan aplikasi dapat dikembangkan, dioperasikan, dan dirilis dengan kualitas terukur.

### 6.1 Testing
- [ ] Unit test untuk utility, hooks, state logic, permission mapping, dan API adapters.
- [ ] Component/integration test untuk shell, forms, dialogs, tables, dan feature flows.
- [ ] E2E test untuk login/session, workspace switch, navigation, critical workflows, dan forbidden access.
- [ ] Accessibility automated checks ditambah manual keyboard/screen reader review.
- [ ] Visual regression untuk theme dan viewport representatif.
- [ ] Contract test untuk integrasi Headquarter–ARSY.
- [ ] Tambahkan test untuk timeout, offline, retry, cancellation, dan partial failure.

### 6.2 Security dan privacy
- [ ] Audit dependency vulnerabilities dan lisensi dependency.
- [ ] Audit secret exposure, client bundle, storage, logging, dan error reporting.
- [ ] Pastikan authorization divalidasi server-side untuk setiap operasi sensitif.
- [ ] Pastikan data sensitif tidak muncul di URL, log, analytics, atau browser storage tanpa alasan dan perlindungan.
- [ ] Audit XSS, unsafe HTML, redirect, CSRF/session behavior sesuai auth architecture.
- [ ] Verifikasi permission boundary melalui direct route/API access.

### 6.3 Performance dan reliability
- [ ] Tetapkan budget bundle untuk route utama.
- [ ] Audit unnecessary client components dan hydration cost.
- [ ] Optimalkan loading data, cache, pagination, dan rendering tabel besar.
- [ ] Audit image/font loading dan asset size.
- [ ] Uji navigasi dan interaksi pada jaringan lambat.
- [ ] Definisikan performance baseline dan regression threshold.

### 6.4 CI/CD dan release
- [ ] CI wajib menjalankan lint, typecheck, unit/integration tests, build, dan quality checks.
- [ ] Pastikan setiap command mengembalikan exit code yang benar.
- [ ] Tambahkan dependency/build cache tanpa mengurangi reliabilitas.
- [ ] Tetapkan environment configuration untuk local, preview, staging, dan production.
- [ ] Dokumentasikan release, rollback, dan troubleshooting.
- [ ] Pastikan migration/configuration backend yang dibutuhkan memiliki koordinasi dengan owner ARSY.
- [ ] Tambahkan smoke test setelah deployment.

### 6.5 Documentation dan ownership
- [ ] Dokumentasikan cara setup dan menjalankan Headquarter secara lokal.
- [ ] Dokumentasikan struktur folder dan aturan import.
- [ ] Dokumentasikan API integration, auth, workspace context, localization, dan theming.
- [ ] Dokumentasikan cara membuat feature baru mengikuti reference implementation.
- [ ] Dokumentasikan cara menambah primitive/pattern ke `packages/ui`.
- [ ] Tetapkan ownership dan jalur eskalasi untuk shell, platform, design system, dan feature.
- [ ] Sinkronkan dokumen arsitektur ketika implementasi berubah.

**Gate Phase 6**
- [ ] CI hijau dan tidak ada quality gate yang diabaikan.
- [ ] Security, accessibility, performance, dan critical E2E checks memenuhi kriteria rilis.
- [ ] Setup, deployment, rollback, dan ownership terdokumentasi.

---

## Definition of Done — berlaku untuk setiap feature dan perubahan

Sebuah task/feature hanya boleh ditandai selesai jika seluruh bagian yang relevan terpenuhi:

- [ ] **User value:** masalah pengguna dan hasil yang diharapkan jelas.
- [ ] **Ownership:** domain, data source, dan pemilik implementasi jelas.
- [ ] **Architecture:** mengikuti dependency boundary dan struktur feature.
- [ ] **Security:** permission divalidasi backend; tidak mengandalkan UI hiding.
- [ ] **Data:** loading, empty, error, stale, partial, dan success state ditangani sesuai kebutuhan.
- [ ] **Interaction:** pending, confirmation, cancellation, success, dan failure behavior jelas.
- [ ] **Accessibility:** keyboard, focus, semantics, labels, dan contrast diperiksa.
- [ ] **Responsive:** layout diuji pada viewport relevan.
- [ ] **Testing:** test sesuai risiko dan perilaku perubahan tersedia serta lulus.
- [ ] **Observability:** error dan operasi penting dapat ditelusuri tanpa membocorkan data sensitif.
- [ ] **Documentation:** kontrak atau keputusan yang berubah diperbarui.
- [ ] **Quality gates:** lint, typecheck, tests, dan build lulus.

---

## Prioritas eksekusi

| Prioritas | Cakupan | Alasan |
|---|---|---|
| P0 | Phase 0 audit, quality gate, boundary ARSY/UI | Menghindari refactor berdasarkan asumsi dan mencegah fondasi yang salah |
| P1 | Phase 1 structural foundation, shell decomposition | Mengurangi coupling dan membuat ownership jelas |
| P1 | Phase 2 API, auth/permission, workspace context | Fondasi keamanan dan integrasi enterprise |
| P1 | Phase 3 design token, primitive, accessibility | Menjaga konsistensi visual dan UX |
| P2 | Phase 4 reference feature | Membuktikan pola sebelum scale-out |
| P2 | Phase 5 navigation dan administration rollout | Memperluas kemampuan setelah fondasi valid |
| P1 sebelum release | Phase 6 hardening | Kualitas rilis tidak boleh menjadi pekerjaan opsional |

## Catatan implementasi

1. Kerjakan secara incremental dan commit per milestone yang dapat diverifikasi.
2. Jangan menandai task selesai hanya karena file/folder telah dibuat.
3. Jangan menambah mock data atau simulasi untuk menggantikan integrasi yang belum tersedia tanpa label demo yang eksplisit.
4. Jangan mengubah kontrak API atau ownership ARSY secara sepihak dari Headquarter.
5. Jika keputusan belum pasti, tulis sebagai open decision dan sertakan opsi, dampak, serta rekomendasi.
6. Perbarui checklist ini setelah setiap milestone; sertakan commit/PR dan bukti verifikasi bila tersedia.


---

## Execution record — 2026-11-07

- [x] Phase 0 source audit recorded in [AUDIT.md](./AUDIT.md).
- [x] Phase 1 shell decomposition and folder conventions recorded in [ARCHITECTURE.md](./ARCHITECTURE.md).
- [x] Phase 2 browser-safe ARSY API boundary added in `src/platform/arsy` (public endpoint contracts and authentication flows remain gated on ARSY implementation).
- [x] Phase 3 semantic Night Riot/Paper Riot token foundation, status tokens, reduced-motion baseline, and focus treatment added to `packages/ui`.
- [x] Command palette keyboard focus containment added; manual browser/screen-reader verification remains pending.
- [x] Route-level loading, error recovery, and not-found UI added; browser verification remains pending.
- [x] Shared design-token contract documented in `packages/ui/DESIGN-TOKENS.md`.
- [ ] Feature pages migrated to live ARSY endpoints; current module content remains demo/static.
- [ ] Identity/session, authorization, workspace context, and route-aware localization implemented against approved backend contracts.
- [ ] Complete primitive audit, responsive/contrast checks, and visual regression baseline verified.
- [ ] Clean-checkout lint, type-check, tests, and Next.js build verified in CI or local environment.
- [ ] Browser-level responsive and accessibility checks verified.
- [ ] Route-aware `/id` and `/en` localization implemented; current locale toggle remains prototype-only.
