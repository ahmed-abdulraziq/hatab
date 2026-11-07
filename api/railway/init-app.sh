#!/bin/sh
# Runs on Railway before each new version goes live (the service's Pre-Deploy Command):
# brings the database up to date. If it fails, the old version keeps running.
set -e
php artisan migrate --force
