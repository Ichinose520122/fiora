#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_root=$(CDPATH= cd -- "$script_dir/.." && pwd)

: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"

r2_prefix=${R2_PREFIX:-fiora-backups}
r2_endpoint=${R2_ENDPOINT:-"https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"}
aws_cli_image=${AWS_CLI_IMAGE:-amazon/aws-cli:2}

if [ "${SKIP_LOCAL_BACKUP:-false}" = "true" ]; then
    backup_directory=${BACKUP_DIRECTORY:?BACKUP_DIRECTORY is required when SKIP_LOCAL_BACKUP=true}
else
    backup_directory=$("$script_dir/backup-local.sh")
fi

backup_directory=$(CDPATH= cd -- "$backup_directory" && pwd)
backup_root=$(dirname -- "$backup_directory")
backup_name=$(basename -- "$backup_directory")

if [ ! -f "$backup_directory/manifest.sha256" ]; then
    echo "Backup manifest is missing: $backup_directory/manifest.sha256" >&2
    exit 1
fi
(
    cd "$backup_directory"
    sha256sum --check manifest.sha256
)

echo "Uploading $backup_name to R2 bucket $R2_BUCKET..." >&2

if command -v aws >/dev/null 2>&1; then
    AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
    AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
    AWS_DEFAULT_REGION=auto \
        aws --endpoint-url "$r2_endpoint" \
        s3 cp "$backup_directory" \
        "s3://$R2_BUCKET/$r2_prefix/$backup_name/" \
        --recursive --only-show-errors
else
    docker run --rm \
        -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
        -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
        -e AWS_DEFAULT_REGION=auto \
        -v "$backup_root:/backups:ro" \
        "$aws_cli_image" \
        --endpoint-url "$r2_endpoint" \
        s3 cp "/backups/$backup_name" \
        "s3://$R2_BUCKET/$r2_prefix/$backup_name/" \
        --recursive --only-show-errors
fi

echo "R2 backup completed: s3://$R2_BUCKET/$r2_prefix/$backup_name/" >&2
