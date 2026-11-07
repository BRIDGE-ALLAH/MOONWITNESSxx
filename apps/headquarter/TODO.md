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

- [x] Pilih ARSY DECK sebagai reference feature berdasarkan IA dan kebutuhan weekly owner review.
- [x] Dokumentasikan user journey, domain ownership, kondisi sumber data, batas permission, dan belum adanya tindakan sensitif di `src/features/arsy-deck/README.md`.
- [x] Pisahkan page composition, feature view, repository boundary, demo fixture, dan domain types di `src/features/arsy-deck`; tests belum ditandai selesai karena test runner belum tersedia.
- [ ] Integrasikan backend nyata setelah ARSY menerbitkan workspace-pulse contract; saat ini `apps/arsy` belum menyediakan endpoint tersebut.
- [ ] Implementasikan lifecycle state produksi (loading/empty/error/forbidden/stale/partial/success) setelah API contract dan permission model tersedia; route-level fallback ada, bukan pengganti state domain.
- [ ] Implementasikan search/filter/sort/pagination sesuai kebutuhan domain.
- [ ] Implementasikan detail view/drawer dan action confirmation bila relevan.
- [ ] Untuk tindakan berisiko, tampilkan impact, confirmation, progress, hasil, dan audit reference bila tersedia.
- [x] Pastikan semua status sample diberi label eksplisit demo dan tidak mengklaim data aktual.
- [x] Tambahkan unit test awal untuk ARSY API client dan integritas data fixture; component behavior masih menunggu test harness UI/browser.
- [ ] Tambahkan integration test untuk API boundary dan permission behavior.
- [ ] Tambahkan E2E untuk alur pengguna utama.
- [x] Dokumentasikan pola reference implementation untuk direplikasi feature lain di `src/features/arsy-deck/README.md`.

**Gate Phase 4**
- [ ] Satu feature dapat dipakai sebagai contoh implementasi end-to-end.
- [x] Tidak ada mock yang menyamar sebagai data produksi pada ARSY DECK; disclosure demo selalu terlihat.
- [ ] Semua lifecycle state dan permission behavior teruji.
- [ ] Pola dapat direplikasi tanpa copy-paste struktur yang tidak perlu.

---

## Phase 5 — Navigation, administration, dan feature rollout

**Tujuan:** memperluas fondasi ke seluruh area produk dengan ownership yang jelas.

### 5.1 Navigation dan information architecture
- [x] Cocokkan menu dengan `docs/09-information-architecture.md`.
- [x] Kelompokkan menu menjadi Command, Operations, dan Administration berdasarkan mental model produk.
- [x] Pisahkan navigation group Administration dari Command dan Operations.
- [x] Tetapkan label, deskripsi, route, dan status prototype/planned untuk setiap menu; icon dan permission menunggu sistem ikon/authorization resmi.
- [x] Entri tanpa route ditampilkan disabled sebagai PLANNED, bukan tautan ke halaman palsu.
- [ ] Pastikan deep link dan breadcrumb konsisten.

### 5.2 Administration
- [x] Rancang Policy Center untuk policy/configuration governance di `ADMINISTRATION-IA.md`.
- [x] Rancang Security & Audit untuk event, access history, dan aktivitas sensitif di `ADMINISTRATION-IA.md`.
- [x] Rancang Marketplace Accounts untuk koneksi dan lifecycle akun/integrasi di `ADMINISTRATION-IA.md`.
- [x] Rancang AI Providers untuk konfigurasi provider, health, dan capability di `ADMINISTRATION-IA.md`.
- [x] Rancang Addon Manager untuk lifecycle addon/plugin dan permission di `ADMINISTRATION-IA.md`.
- [x] Rancang ORM/Infrastructure Health sebagai observability/diagnostic surface, bukan tempat mengelola internal backend secara langsung di `ADMINISTRATION-IA.md`.
- [x] Rancang Workspace Settings untuk konfigurasi workspace dan preference di `ADMINISTRATION-IA.md`.
- [ ] Tetapkan role/permission model, auditability, dan confirmation per halaman saat kontrak capability ARSY tersedia; desain requirement dicatat di `ADMINISTRATION-IA.md`.

### 5.3 Feature rollout
- [x] Buat register readiness dan production gate di `FEATURE-ROLLOUT.md`.
- [ ] Migrasikan feature satu per satu ke struktur dan API pattern yang telah tervalidasi.
- [ ] Jangan membuka route sebagai production-ready sebelum data, permission, failure state, dan tests tersedia.
- [x] Tandai capability administrasi yang belum tersedia sebagai planned/disabled dengan deskripsi yang akurat.
- [ ] Hapus prototype state dan placeholder setelah pengganti nyata tersedia.
- [ ] Pastikan setiap feature memiliki owner dan dokumentasi operasional.

**Gate Phase 5**
- [ ] Navigation mencerminkan kemampuan produk yang benar-benar tersedia.
- [x] Area administration terpisah secara konseptual; enforcement permission menunggu kontrak ARSY.
- [ ] Feature rollout tidak mengorbankan konsistensi UX atau boundary arsitektur.

---

## Phase 6 — Enterprise hardening dan release readiness

**Tujuan:** menutup fondasi engineering Headquarter dengan quality gate yang wajib, dapat diulang, dan memiliki bukti. Penutupan fase ini tidak sama dengan sertifikasi semua prototype sebagai production-ready.

### 6.1 Testing
- [x] Node 24 built-in test runner untuk ARSY browser client dan ARSY DECK fixture.
- [x] Test keamanan request path: absolute URL, protocol-relative URL, backslash, dan parent traversal literal/encoded.
- [x] Test awal Decision Graph: provenance, traceability, evidence expiry, confidence, dan dangling references.
- [x] Test awal Scenario Forge: deterministic replay, baseline immutability, rationale, invalid metric, dan shadow-only output.
- [ ] Browser component/E2E, accessibility, visual regression, dan ARSY contract tests menunggu browser harness serta kontrak backend yang disetujui.

### 6.2 Security dan privacy
- [x] Tolak URL eksternal dan path traversal pada browser API boundary sebelum network request.
- [x] Error gateway non-JSON dinormalisasi tanpa menampilkan body internal.
- [x] Mutation tidak pernah di-retry otomatis.
- [ ] Dependency vulnerability/license review berkala.
- [ ] Verifikasi CSP, CSRF/session, XSS, redirect, bundle exposure, dan storage setelah deployment/auth architecture tersedia.
- [ ] Authorization direct-route/API harus diuji bersama ARSY; UI hiding bukan security control.

### 6.3 Performance dan reliability
- [x] Timeout, cancellation, retry GET-only, no-store, dan request correlation baseline pada ARSY client.
- [ ] Tetapkan bundle/performance budget berdasarkan hosting dan target perangkat yang disepakati.
- [ ] Browser profiling, slow-network, hydration, dan visual responsiveness checks.
- [ ] Definisikan SLO/error budget setelah telemetry dan traffic baseline tersedia.

### 6.4 CI/CD dan release
- [x] CI menjalankan lint, workspace type-check, Headquarter tests, asset validation, dan Headquarter production build.
- [x] Jadikan full-workspace validation dan production build sebagai job wajib (tidak lagi bergantung pada `FULL_QUALITY_CI`).
- [x] Full-workspace validation dan seluruh production builds lulus pada PR #43, workflow run `42398091453`.
- [ ] Staging/production deployment, smoke test, environment secrets, dan rollback memerlukan target deployment serta otorisasi operator.

### 6.5 Documentation dan ownership
- [x] Dokumentasikan architecture, API boundary, test suite, feature rollout, dan release readiness.
- [x] Catat batas tanggung jawab Headquarter vs ARSY dan larangan menganggap demo sebagai data live.
- [x] Tambahkan ownership dan production gate untuk dua domain baru pada Phase 7 dan Phase 8.
- [ ] Owner operasional dan jalur eskalasi final ditetapkan oleh maintainer proyek.

**Gate Phase 6**
- [x] Headquarter-scoped test, type-check, lint/repository integrity, asset checks, production build, dan CodeQL lulus pada PR #38.
- [x] Full-workspace validation dan build wajib lulus; diverifikasi hijau pada PR #43 (run `42398091453`).
- [ ] Production readiness untuk modul yang memakai backend tetap menunggu API, identity, permission, deployment, dan browser verification; gate ini dipisahkan dalam `RELEASE-READINESS.md`.

---

## Phase 7 — Decision Graph / WHY Engine

**Tujuan:** menjadikan keputusan dapat dijelaskan, ditelusuri, diperdebatkan, dan dievaluasi kembali dari bukti asalnya.

- [x] Definisikan graph model: decision, evidence, policy, actor, action, outcome.
- [x] Definisikan relasi supports, contradicts, constrained_by, made_by, causes, supersedes.
- [x] Implementasikan pure integrity assessor untuk provenance, confidence, expiry, traceability, dan dangling edges.
- [x] Tambahkan test untuk keputusan tanpa rationale, bukti kedaluwarsa, confidence invalid, dan malformed validity timestamp.
- [x] Dokumentasikan trust boundary: AI explanation bukan evidence; ARSY tetap pemilik authorization dan audit.
- [ ] Buat graph explorer UI yang accessible dan dapat menangani graph besar.
- [ ] Hubungkan ke append-only decision/evidence contract ARSY dan policy redaction/retention.
- [ ] Tambahkan review workflow untuk contradictory/stale evidence dan outcome feedback.

**Gate Phase 7:** keputusan memiliki provenance yang dapat diperiksa, kontradiksi tidak disembunyikan, bukti kedaluwarsa terdeteksi, dan akses sumber ditegakkan oleh backend.

---

## Phase 8 — Scenario Forge / Shadow Reality

**Tujuan:** menyediakan laboratorium what-if yang aman, deterministik, dan terpisah dari jalur eksekusi produksi.

- [x] Definisikan baseline metric, assumption, ordered operation, dan replay result contract.
- [x] Implementasikan pure deterministic engine untuk set/add/multiply.
- [x] Tolak duplicate IDs, unknown metric, rationale kosong, operasi tidak dikenal, dan nilai non-finite.
- [x] Pastikan baseline tidak dimutasi dan result selalu berstatus shadow-only.
- [x] Tambahkan test deterministic replay, immutability, validation, dan isolation.
- [x] Dokumentasikan hubungan hasil simulasi dengan Decision Graph sebagai analysis evidence.
- [ ] Tambahkan multi-scenario comparison, sensitivity analysis, dan uncertainty semantics.
- [ ] Hubungkan ke ARSY read-only snapshot dengan scope, source timestamp, units, dan freshness.
- [ ] Bangun Scenario Arena UI; jangan menyediakan tombol eksekusi produksi dari hasil simulasi.
- [ ] Jika kelak ada promotion workflow, wajib ada approval terpisah, policy evaluation, diff, idempotency, dan audit event.

**Gate Phase 8:** replay identik untuk input/versi engine yang sama; semua asumsi dapat diperiksa; hasil simulasi tidak pernah otomatis menjadi perubahan produksi.

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

## Execution record — 2026-11-08

- [x] Phase 0 source audit recorded in [AUDIT.md](./AUDIT.md).
- [x] Phase 1 shell decomposition and folder conventions recorded in [ARCHITECTURE.md](./ARCHITECTURE.md).
- [x] Phase 2 browser-safe ARSY API boundary added in `src/platform/arsy` (public endpoint contracts and authentication flows remain gated on ARSY implementation).
- [x] Phase 3 semantic Night Riot/Paper Riot token foundation, status tokens, reduced-motion baseline, and focus treatment added to `packages/ui`.
- [x] Command palette keyboard focus containment added; manual browser/screen-reader verification remains pending.
- [x] Route-level loading, error recovery, and not-found UI added; browser verification remains pending.
- [x] Shared design-token contract documented in `packages/ui/DESIGN-TOKENS.md`.
- [ ] Feature pages migrated to live ARSY endpoints; current module content remains demo/static and ARSY Deck now uses a domain-owned, explicitly demo-only repository.
- [ ] Identity/session, authorization, workspace context, and route-aware localization implemented against approved backend contracts.
- [ ] Complete primitive audit, responsive/contrast checks, and visual regression baseline verified; these require browser-level validation.
- [x] Clean-checkout repository lint, workspace type-check, Headquarter production build, and asset registry tests verified in GitHub Actions (PR #35; repository integrity + asset integrity passed).
- [ ] Browser-level responsive and accessibility checks verified; CI does not run a browser or screen-reader audit.
- [ ] Route-aware `/id` and `/en` localization implemented; current locale toggle remains prototype-only.
- [x] Phase 4 ARSY Deck reference-feature structure established without inventing unavailable backend contracts.
- [x] Phase 5 navigation aligned with approved IA; unimplemented administration routes are disabled and marked planned.
- [x] Feature rollout and production promotion gates documented in `FEATURE-ROLLOUT.md`.
- [x] Administration information architecture, data boundaries, intended audiences, and backend gates documented in `ADMINISTRATION-IA.md`.
- [x] Repository validation repaired and verified: lockfile, native build-script allowlist, root type-check alias, ARSY TypeScript types/config, shared lint config, and Headquarter lint.
- [x] PR #35 merged to `main` as `51bfe984cde513f5190ab192491681fe41f96aab`; Repository CI and CodeQL passed on PR head.


## Phase 6 execution record — 2026-11-08

- [x] Tambahkan `apps/headquarter/tests/arsy-client.test.mjs` menggunakan Node 24 built-in test runner dan native TypeScript stripping; termasuk guard terhadap absolute URL, backslash, dan parent-directory traversal.
- [x] Tambahkan `apps/headquarter/tests/arsy-deck.test.mjs` untuk menjaga demo disclosure, uniqueness, confidence bounds, dan sample-only agent states.
- [x] Tambahkan script `pnpm --filter @riotworks/headquarter test` tanpa dependency framework tambahan.
- [x] Tambahkan test command ke Asset Integrity CI; branch `headquarter/phase-6-testing-foundation` juga dimasukkan ke trigger push CI.
- [x] GitHub Actions pada PR #38 lulus: Headquarter tests, type-check assets/UI/Headquarter, production build, asset validation/tests, Repository Integrity, dan CodeQL. Full-workspace quality tetap skipped oleh konfigurasi `FULL_QUALITY_CI`.
- [ ] Browser E2E, accessibility automation/manual review, visual regression, performance budgets, dan backend contract tests tetap terbuka.


## Phase 7–8 execution record — 2026-11-08

- [x] Decision Graph foundation added under `src/features/decision-graph`.
- [x] Scenario Forge shadow kernel added under `src/features/scenario-forge`.
- [x] Both modules have domain READMEs, tests, and phase-level product/acceptance specifications.
- [x] Neither module claims a live API, production UI, persistent storage, or real-world execution capability.

- [x] Phase 6 engineering-foundation gate closed after required full-workspace validation/build and CodeQL passed on PR #43.


## Phase 9–10 execution record — 2026-11-08

- [x] Phase 9 Decision Graph Explorer route and read-only synthetic graph UI added at `/decision-graph`.
- [x] Decision Graph UI surfaces traceability, stale evidence, contradiction edges, Decision Debt, and deterministic integrity findings.
- [x] Phase 10 Scenario Arena route and interactive scenario selection added at `/scenario-forge`.
- [x] Scenario Arena compares conservative, expected, and stress cases against one immutable synthetic baseline; includes assumption ledger and sensitivity ranking.
- [x] Navigation exposes both routes as prototype modules; both remain visibly demo/shadow-only.
- [x] Research notes recorded in `PHASE-9-10-RESEARCH.md` covering papers, GitHub projects, community discussions, product hypotheses, and evaluation metrics.
- [ ] Browser E2E, keyboard/screen-reader verification, visual regression, and live ARSY contracts remain open.
- [ ] No live data, persistence, authorization, or production mutation has been claimed or implemented by these UI phases.


## Phase 11–13 execution record — 2026-11-08

- [x] Phase 11 Replay Capsule: canonical JSON serialization, SHA-256 content digest, input snapshot, ordered scenario operations, deterministic result, digest verification, and replay recomputation.
- [x] Phase 12 Decision Debt Compiler: deterministic findings for missing support, stale support, invalid provenance, unresolved contradictions, and downstream `causes` impact traversal.
- [x] Phase 13 Uncertainty & Governance Gate: low/base/high envelopes, source-quality checks, evidence coverage, stale/contradiction/assumption checks, and fail-closed human-review eligibility.
- [x] Governance Lab prototype route `/governance-lab` demonstrates all three engines using explicitly synthetic fixtures.
- [x] Added domain tests for capsule tamper detection/replay, decision debt, downstream impact, and governance gate states.
- [ ] ARSY versioned read contracts, identity/workspace authorization, append-only persistence, trusted signatures/timestamps, and audit event integration remain production gates.
- [ ] Browser E2E, keyboard/screen-reader verification, visual regression, and deployment smoke/rollback remain open.


## Phase 14–16 — Sentinel Fabric

- [x] Phase 14: Belief Drift Sentinel compares versioned claims, confidence deltas, and evidence-reference changes; malformed snapshots fail closed.
- [x] Phase 15: Counterfactual Blast-Radius traverses explicit causal edges with cycle detection and bounded traversal.
- [x] Phase 16: Evidence Expiry Budget ranks expired/near-expiry evidence and counts exposed decisions without extending validity.
- [x] Add deterministic Node test coverage and research/prior-art notes.
- [ ] Connect only after ARSY publishes versioned, tenant-scoped read contracts and evidence provenance.
- [ ] Validate drift/impact/expiry thresholds against labelled historical outcomes before operational use.

**Execution boundary:** phases 14–16 are pure TypeScript domain engines. They are not cryptographic authorization, causal discovery, evidence renewal, or production enforcement.
