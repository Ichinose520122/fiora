#!/usr/bin/env sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

for directory in Avatar BackgroundImage FileMessage GroupAvatar ImageMessage; do
    mkdir -p "$project_root/uploads/$directory"
done

mkdir -p "$project_root/backups"

echo "Storage directories are ready under $project_root"
