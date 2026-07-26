#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/compose.yaml" ]]; then
  readonly DEPLOY_DIR="${SCRIPT_DIR}"
elif [[ -f "${SCRIPT_DIR}/../compose.yaml" ]]; then
  readonly DEPLOY_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
else
  echo "Error: compose.yaml was not found next to this script or in its parent directory." >&2
  exit 1
fi

readonly HEALTH_TIMEOUT_SECONDS="${UPDATE_HEALTH_TIMEOUT_SECONDS:-180}"
readonly HEALTH_POLL_SECONDS="${UPDATE_HEALTH_POLL_SECONDS:-2}"
readonly LOCK_DIR="${DEPLOY_DIR}/.update.lock"

log() {
  printf '[%(%Y-%m-%d %H:%M:%S)T] %s\n' -1 "$*"
}

fail() {
  log "Error: $*" >&2
  exit 1
}

compose() {
  docker compose --project-directory "${DEPLOY_DIR}" -f "${DEPLOY_DIR}/compose.yaml" "$@"
}

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

show_failure() {
  local service="$1"

  log "Recent ${service} logs:"
  compose logs --no-color --tail 100 "${service}" >&2 || true
}

wait_for_healthy() {
  local service="$1"
  local started_at="${SECONDS}"
  local container_id
  local status

  log "Waiting up to ${HEALTH_TIMEOUT_SECONDS}s for ${service} to become healthy..."

  while (( SECONDS - started_at < HEALTH_TIMEOUT_SECONDS )); do
    container_id="$(compose ps --all -q "${service}")"

    if [[ -n "${container_id}" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"
      case "${status}" in
        healthy)
          log "${service} is healthy."
          return 0
          ;;
        exited|dead)
          show_failure "${service}"
          return 1
          ;;
      esac
    fi

    sleep "${HEALTH_POLL_SECONDS}"
  done

  show_failure "${service}"
  return 1
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed or not in PATH."
docker compose version >/dev/null 2>&1 || fail "the Docker Compose plugin is unavailable."

case "${HEALTH_TIMEOUT_SECONDS}" in
  ''|*[!0-9]*) fail "UPDATE_HEALTH_TIMEOUT_SECONDS must be a positive integer." ;;
esac

case "${HEALTH_POLL_SECONDS}" in
  ''|*[!0-9]*) fail "UPDATE_HEALTH_POLL_SECONDS must be a positive integer." ;;
esac

(( HEALTH_TIMEOUT_SECONDS > 0 )) || fail "UPDATE_HEALTH_TIMEOUT_SECONDS must be greater than zero."
(( HEALTH_POLL_SECONDS > 0 )) || fail "UPDATE_HEALTH_POLL_SECONDS must be greater than zero."

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  fail "another update appears to be running (${LOCK_DIR} exists)."
fi
trap cleanup EXIT

cd "${DEPLOY_DIR}"

log "Validating the Compose configuration..."
compose config --quiet

log "Pulling application images..."
compose pull app redis

log "Ensuring Redis is running..."
compose up -d redis
wait_for_healthy redis || fail "redis is not healthy; update aborted."

log "Recreating application container..."
compose up -d --no-deps --force-recreate app
wait_for_healthy app || fail "app did not become healthy after recreate."

log "Update completed successfully."
compose ps app redis

if [[ "${PRUNE_OLD_IMAGES:-0}" == "1" ]]; then
  log "Pruning unused images..."
  docker image prune -f
fi
