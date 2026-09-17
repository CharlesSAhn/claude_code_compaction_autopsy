#!/usr/bin/env bash
# Manual deploy of the static build to an S3 website bucket. Not part of npm run build.
# Usage: AUTOPSY_BUCKET=<bucket> [AWS_REGION=<region>] bash scripts/deploy-s3.sh
# See docs/deployment.md for the bucket setup and the egress rule the human lifts for the sync.
set -euo pipefail

if [ -z "${AUTOPSY_BUCKET:-}" ]; then
  echo "deploy-s3: AUTOPSY_BUCKET is not set; nothing built, nothing synced" >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"

region_args=()
if [ -n "${AWS_REGION:-}" ]; then
  region_args=(--region "$AWS_REGION")
fi

echo "deploy-s3: building"
npm run build

echo "deploy-s3: syncing dist/ to s3://$AUTOPSY_BUCKET"
aws s3 sync dist/ "s3://$AUTOPSY_BUCKET" --delete ${region_args[@]+"${region_args[@]}"}

region_label="${AWS_REGION:-<region>}"
echo "deploy-s3: done"
echo "website URL: http://$AUTOPSY_BUCKET.s3-website-$region_label.amazonaws.com"
echo "(some regions use a dot: http://$AUTOPSY_BUCKET.s3-website.$region_label.amazonaws.com)"
