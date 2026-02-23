#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Kahade Frontend — AWS S3 + CloudFront Deploy Script
# Usage: ./cloudfront-deploy.sh [landing|dashboard|admin|all]
#
# FIX (Issue V2-3): Added --exclude "*" before --include "*.html"
# in the HTML-only sync step. Without --exclude "*", AWS S3 sync
# re-uploads ALL files (not just HTML) with wrong cache-control headers.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── CONFIGURATION — edit these ────────────────────────────────
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"

S3_LANDING="kahade-landing-prod"
S3_DASHBOARD="kahade-dashboard-prod"
S3_ADMIN="kahade-admin-prod"

CF_LANDING="${CF_DISTRIBUTION_LANDING:-}"
CF_DASHBOARD="${CF_DISTRIBUTION_DASHBOARD:-}"
CF_ADMIN="${CF_DISTRIBUTION_ADMIN:-}"
# ──────────────────────────────────────────────────────────────

TARGET="${1:-all}"

log()  { echo "▸ $*"; }
ok()   { echo "✓ $*"; }
fail() { echo "✗ $*" >&2; exit 1; }

require_vars() {
  [[ -z "$CF_LANDING" ]]   && fail "CF_DISTRIBUTION_LANDING env var not set"
  [[ -z "$CF_DASHBOARD" ]] && fail "CF_DISTRIBUTION_DASHBOARD env var not set"
  [[ -z "$CF_ADMIN" ]]     && fail "CF_DISTRIBUTION_ADMIN env var not set"
  return 0
}

build_app() {
  local app=$1
  log "Building @kahade/$app..."
  pnpm --filter "@kahade/$app" build
  ok "Build complete: apps/$app/dist"
}

deploy_to_s3() {
  local app=$1
  local bucket=$2
  local dist="apps/$app/dist"

  [[ ! -d "$dist" ]] && fail "Dist folder not found: $dist — did the build run?"
  [[ -z "$(ls -A "$dist")" ]] && fail "Dist folder is empty: $dist"

  log "Deploying $app → s3://$bucket"

  # ── Step 1: Upload ALL non-HTML assets (hashed JS/CSS/fonts/images)
  # with long-lived immutable cache. --delete removes stale files.
  aws s3 sync "$dist" "s3://$bucket" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --exclude "*.html" \
    --cache-control "public, max-age=31536000, immutable" \
    --delete

  # ── Step 2: Upload HTML files with no-cache.
  # FIX (Issue V2-3): MUST use --exclude "*" FIRST, then --include "*.html".
  # Without --exclude "*", S3 sync re-uploads ALL files (not just HTML),
  # overwriting the immutable cache-control set in Step 1.
  aws s3 sync "$dist" "s3://$bucket" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --exclude "*" \
    --include "*.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html; charset=utf-8"

  ok "S3 upload complete: s3://$bucket"
}

invalidate_cloudfront() {
  local app=$1
  local dist_id=$2

  log "Invalidating CloudFront cache for $app (${dist_id})..."
  aws cloudfront create-invalidation \
    --profile "$AWS_PROFILE" \
    --distribution-id "$dist_id" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text
  ok "Cache invalidation created for $app"
}

deploy_single() {
  local app=$1
  local bucket=$2
  local cf_id=$3

  [[ -z "$cf_id" ]] && fail "CloudFront distribution ID not set for $app"

  build_app "$app"
  deploy_to_s3 "$app" "$bucket"
  invalidate_cloudfront "$app" "$cf_id"
}

# ── MAIN ──────────────────────────────────────────────────────
log "Kahade Frontend Deploy — target: $TARGET"
require_vars

case "$TARGET" in
  landing)
    deploy_single "landing" "$S3_LANDING" "$CF_LANDING"
    ;;
  dashboard)
    deploy_single "dashboard" "$S3_DASHBOARD" "$CF_DASHBOARD"
    ;;
  admin)
    deploy_single "admin" "$S3_ADMIN" "$CF_ADMIN"
    ;;
  all)
    deploy_single "landing"   "$S3_LANDING"   "$CF_LANDING"
    deploy_single "dashboard" "$S3_DASHBOARD" "$CF_DASHBOARD"
    deploy_single "admin"     "$S3_ADMIN"     "$CF_ADMIN"
    ;;
  *)
    fail "Unknown target '$TARGET'. Use: landing | dashboard | admin | all"
    ;;
esac

log ""
ok "🚀 Deployment complete for: $TARGET"
