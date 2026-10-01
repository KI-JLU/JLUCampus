#!/usr/bin/env bash
# Fetches gVisor into infra/python-sandbox/.gvisor/ for `runsc-rootless`, the checksum checked.
# Nothing is installed system-wide. The release is the one whose sandbox looks like HAWKI's
# (its /proc/[pid]/status, /proc/mounts and /proc entries); GVISOR_RELEASE picks another one,
# `latest` the newest.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
target="$here/.gvisor"
release="${GVISOR_RELEASE:-20260817}"
url="https://storage.googleapis.com/gvisor/releases/release/$release/$(uname -m)/gvisor.tar.bz2"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl -fsSL -o "$work/gvisor.tar.bz2" "$url"
curl -fsSL -o "$work/gvisor.tar.bz2.sha512" "$url.sha512"
(cd "$work" && sha512sum -c gvisor.tar.bz2.sha512)
# runsc with the binaries it starts next to it (gvisor-bin/).
rm -rf "$target"
mkdir -p "$target"
tar -xjf "$work/gvisor.tar.bz2" -C "$target"
"$target/runsc" --version
