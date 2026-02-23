# Kahade Monorepo

Turborepo monorepo untuk Kahade — Platform Escrow P2P Indonesia.

## Struktur

```
kahade-monorepo/
├── apps/
│   ├── landing/      → kahade.id (halaman publik)
│   ├── dashboard/    → app.kahade.id (halaman user)
│   └── admin/        → admin.kahade.id (panel admin)
├── packages/
│   ├── ui/           → Shared UI components
│   ├── utils/        → Shared utilities & API
│   ├── types/        → Shared TypeScript types
│   └── config/       → Shared config
└── .github/workflows/ → CI/CD GitHub Actions
```

## Perintah

```bash
# Install semua dependencies
pnpm install

# Dev semua sekaligus
pnpm dev

# Dev satu app saja
pnpm dev:landing
pnpm dev:dashboard
pnpm dev:admin

# Build
pnpm build

# Build satu app
pnpm build:landing
pnpm build:dashboard
pnpm build:admin
```

## Setup GitHub Secrets

Tambahkan secrets berikut di repository GitHub:

| Secret | Keterangan |
|--------|-----------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_REGION` | Region AWS (contoh: ap-southeast-1) |
| `VITE_API_BASE_URL` | URL backend API |
| `VITE_APP_DOMAIN` | URL dashboard (contoh: https://app.kahade.id) |
| `VITE_LANDING_DOMAIN` | URL landing (contoh: https://kahade.id) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `S3_BUCKET_LANDING` | Nama S3 bucket untuk landing |
| `S3_BUCKET_DASHBOARD` | Nama S3 bucket untuk dashboard |
| `S3_BUCKET_ADMIN` | Nama S3 bucket untuk admin |
| `CF_DISTRIBUTION_LANDING` | CloudFront distribution ID landing |
| `CF_DISTRIBUTION_DASHBOARD` | CloudFront distribution ID dashboard |
| `CF_DISTRIBUTION_ADMIN` | CloudFront distribution ID admin |

## Setup AWS

1. Buat 3 S3 bucket (landing, dashboard, admin) dengan static website hosting
2. Buat 3 CloudFront distribution yang pointing ke masing-masing S3 bucket
3. Setup custom domain via Route 53 atau CNAME
4. Buat IAM user dengan permission S3 + CloudFront untuk GitHub Actions
