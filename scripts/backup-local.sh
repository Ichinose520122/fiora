#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_root=$(CDPATH= cd -- "$script_dir/.." && pwd)

compose_file=${COMPOSE_FILE:-"$project_root/docker-compose.yaml"}
mongo_service=${MONGO_SERVICE:-mongodb}
mongo_database=${MONGO_DATABASE:-fiora}
uploads_root=${UPLOADS_ROOT:-"$project_root/uploads"}
backup_root=${BACKUP_ROOT:-"$project_root/backups"}
case "$backup_root" in
    ""|"/")
        echo "Refusing unsafe BACKUP_ROOT: '$backup_root'" >&2
        exit 1
        ;;
esac
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_directory="$backup_root/$timestamp"
temporary_directory="$backup_directory.tmp"
temporary_directory_created=false

cleanup() {
    if [ "$temporary_directory_created" = "true" ] &&
        [ -d "$temporary_directory" ]; then
        rm -rf -- "$temporary_directory"
    fi
}
trap cleanup EXIT INT TERM

mkdir -p "$backup_root"
if ! mkdir "$temporary_directory"; then
    echo "Backup already running or timestamp already exists: $temporary_directory" >&2
    exit 1
fi
temporary_directory_created=true

echo "Backing up MongoDB database '$mongo_database'..." >&2
(
    cd "$project_root"
    docker compose -f "$compose_file" exec -T "$mongo_service" \
        mongodump --db "$mongo_database" --archive --gzip
) \
    > "$temporary_directory/mongodb.archive.gz"

echo "Backing up local uploads..." >&2
if [ -d "$uploads_root" ]; then
    tar -C "$uploads_root" -czf "$temporary_directory/uploads.tar.gz" .
else
    mkdir -p "$temporary_directory/empty-uploads"
    tar -C "$temporary_directory/empty-uploads" \
        -czf "$temporary_directory/uploads.tar.gz" .
    rmdir "$temporary_directory/empty-uploads"
fi

(
    cd "$temporary_directory"
    sha256sum mongodb.archive.gz uploads.tar.gz > manifest.sha256
)

mv "$temporary_directory" "$backup_directory"
temporary_directory_created=false
trap - EXIT INT TERM

echo "Backup completed: $backup_directory" >&2
printf '%s\n' "$backup_directory"
