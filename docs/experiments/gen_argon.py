#!/usr/bin/env python3
"""Generate the fake 'argon' key-rotation service for a compaction experiment.
Every name is invented. Deterministic (seed 4127). Run inside an empty folder."""
import os, random, textwrap

random.seed(4127)
AREAS = ["vault", "lease", "rotate", "audit", "sched", "notify", "cache", "policy", "kms", "acl"]
HOSTS = ["argon-stg-01.internal", "argon-stg-02.internal", "argon-prod-03.internal",
         "argon-prod-04.internal", "vault-cache-07.internal", "kms-relay-02.internal"]
VERBS = ["fetch", "renew", "revoke", "verify", "seal", "unseal", "stage", "commit", "reconcile", "drain"]
NOUNS = ["lease", "key", "token", "bundle", "shard", "policy", "grant", "cert", "secret", "epoch"]

os.makedirs("src/argon", exist_ok=True)
os.makedirs("scripts", exist_ok=True)
os.makedirs("config", exist_ok=True)
os.makedirs("logs", exist_ok=True)
os.makedirs("tests", exist_ok=True)

open("src/argon/__init__.py", "w").write('"""argon: key rotation service."""\n__version__ = "3.14.2"\n')

def func(name, host):
    args = ", ".join(random.sample(["lease_id", "key_id", "shard", "epoch", "ttl_s", "retries", "actor"], random.randint(2, 4)))
    body = []
    body.append(f'    """{name.replace("_", " ").capitalize()} for one {random.choice(NOUNS)}.')
    body.append("")
    body.append(f"    Talks to {host} on port {random.choice([8200, 8201, 9443, 7100])}. Returns a dict with")
    body.append(f"    status, elapsed_ms and the {random.choice(NOUNS)} id. Raises RotationError on")
    body.append(f"    a {random.choice(['stale lease', 'sealed vault', 'quorum miss', 'clock skew', 'acl denial'])}.")
    body.append('    """')
    body.append(f"    started = time.monotonic()")
    body.append(f"    target = HOST if HOST else \"{host}\"")
    body.append(f"    payload = {{\"op\": \"{name}\", \"actor\": actor if 'actor' in locals() else \"system\", \"epoch\": EPOCH}}")
    for i in range(random.randint(3, 7)):
        k = random.choice(NOUNS)
        body.append(f"    payload[\"{k}_{i}\"] = _digest(f\"{k}:{{target}}:{{{i}}}\")[: {random.randint(8, 24)}]")
    body.append(f"    for attempt in range({random.randint(2, 5)}):")
    body.append(f"        resp = _client.post(target, payload, timeout={random.choice(['None', '2.5', '10', 'None', 'DEFAULT_TIMEOUT'])})")
    body.append(f"        if resp.get(\"status\") == \"ok\":")
    body.append(f"            logger.info(\"{name} ok host=%s attempt=%d\", target, attempt)")
    body.append(f"            break")
    body.append(f"        time.sleep({random.choice(['0.2', '0.5', '1.0'])} * (attempt + 1))")
    body.append(f"    else:")
    body.append(f"        raise RotationError(f\"{name} failed on {{target}} after retries\")")
    body.append(f"    return {{\"status\": \"ok\", \"elapsed_ms\": int((time.monotonic() - started) * 1000), \"id\": payload.get(\"{random.choice(NOUNS)}_0\")}}")
    return f"def {name}({args}):\n" + "\n".join(body) + "\n\n"

for area in AREAS:
    for n in range(1, 7):
        host = random.choice(HOSTS)
        lines = [
            f'"""{area.capitalize()} module {n} of the argon rotation service.',
            "",
            f"Owns the {random.choice(NOUNS)} {random.choice(VERBS)} path for the {area} subsystem.",
            f"Default upstream is {host}. Override with ARGON_{area.upper()}_HOST.",
            '"""',
            "import hashlib",
            "import logging",
            "import os",
            "import time",
            "",
            "from argon.client import _client, RotationError",
            "",
            "logger = logging.getLogger(__name__)",
            f'HOST = os.environ.get("ARGON_{area.upper()}_HOST", "{host}")',
            f"EPOCH = {random.randint(1000, 9999)}",
            f"DEFAULT_TIMEOUT = {random.choice([2.0, 5.0, 10.0, 30.0])}",
            "",
            "",
            "def _digest(s):",
            '    return hashlib.sha256(s.encode()).hexdigest()',
            "",
            "",
        ]
        for f in range(random.randint(6, 9)):
            name = f"{random.choice(VERBS)}_{random.choice(NOUNS)}_{f}"
            lines.append(func(name, random.choice(HOSTS)))
        open(f"src/argon/{area}_{n}.py", "w").write("\n".join(lines))

open("src/argon/client.py", "w").write(textwrap.dedent('''\
    """Thin HTTP client used by every argon module."""
    import json
    import logging
    import urllib.request

    logger = logging.getLogger(__name__)


    class RotationError(RuntimeError):
        pass


    class _Client:
        def post(self, host, payload, timeout=None):
            url = f"https://{host}/v1/rotate"
            req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST")
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())


    _client = _Client()
'''))

open("scripts/rotate_keys.sh", "w").write(textwrap.dedent('''\
    #!/usr/bin/env bash
    # rotate_keys.sh - nightly key rotation for the argon service.
    # Owner: platform team. Runs from cron on the rotation host.
    set -euo pipefail

    STAGING_HOST="argon-stg-01.internal"
    PROD_HOSTS=("argon-prod-03.internal" "argon-prod-04.internal")
    VAULT_CACHE="vault-cache-07.internal"
    LEASE_TTL="${LEASE_TTL:-86400}"
    LOG="/var/log/argon/rotate.log"

    log() { printf '%s %s\\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG"; }

    rotate_host() {
      local host="$1"
      log "rotating keys on $host"
      curl -fsS -X POST "https://$host/v1/rotate" -d "{\\"ttl\\": $LEASE_TTL}" >/dev/null
      log "rotated $host"
    }

    warm_cache() {
      log "warming $VAULT_CACHE"
      curl -fsS "https://$VAULT_CACHE/v1/warm" >/dev/null
    }

    main() {
      log "rotation start epoch=$(date +%s)"
      rotate_host "$STAGING_HOST"
      for h in "${PROD_HOSTS[@]}"; do
        rotate_host "$h"
      done
      warm_cache
      log "rotation done"
    }

    main "$@"
'''))
os.chmod("scripts/rotate_keys.sh", 0o755)

open("config/hosts.yaml", "w").write(textwrap.dedent('''\
    # argon environment map
    staging:
      api: argon-stg-01.internal
      vault_cache: vault-cache-07.internal
    production:
      api:
        - argon-prod-03.internal
        - argon-prod-04.internal
      vault_cache: vault-cache-07.internal
      kms_relay: kms-relay-02.internal
    rotation:
      cron: "15 3 * * *"
      lease_ttl_s: 86400
'''))

open("README.md", "w").write(textwrap.dedent('''\
    # argon

    Key rotation service. Modules under `src/argon/`, nightly rotation in `scripts/rotate_keys.sh`,
    environment map in `config/hosts.yaml`. Logs from the rotation hosts are mirrored into `logs/`.
'''))
open("requirements.txt", "w").write("pyyaml==6.0.2\n")
open("tests/test_smoke.py", "w").write("def test_import():\n    import argon\n    assert argon.__version__\n")

# Logs: three days, ~1500 lines each. stg-01 goes quiet on day 3 after 11:40.
LEVELS = ["INFO"] * 12 + ["WARN"] * 3 + ["ERROR"]
MSGS = [
    "lease {lid} renewed ttl={ttl}s", "key {kid} rotated epoch={ep}", "rotation deferred: lease {lid} expires in {m}m",
    "vault sealed, retrying in {m}s", "acl denied actor=svc-rotate op={op}", "quorum miss on shard {sh}",
    "cache warm ok entries={n}", "clock skew {m}ms vs kms-relay-02.internal", "cert {kid} expires in {n}d",
    "drain complete shard {sh}", "bundle {kid} verified", "timeout after {m}s host={h}",
]
for day, date in enumerate(["2026-09-09", "2026-09-10", "2026-09-11"]):
    out = []
    t = 0
    for i in range(1500):
        t += random.randint(5, 90)
        hh, mm, ss = t // 3600 % 24, t // 60 % 60, t % 60
        host = random.choice(HOSTS)
        if day == 2 and (hh, mm) >= (11, 40) and host == "argon-stg-01.internal":
            host = "argon-stg-02.internal"
        lvl = random.choice(LEVELS)
        msg = random.choice(MSGS).format(
            lid=f"L{random.randint(10000, 99999)}", kid=f"k-{random.randint(100, 999)}", ttl=random.choice([3600, 86400]),
            ep=random.randint(1000, 9999), m=random.randint(1, 59), op=random.choice(VERBS), sh=random.randint(0, 15),
            n=random.randint(1, 900), h=random.choice(HOSTS))
        out.append(f"{date}T{hh:02d}:{mm:02d}:{ss:02d}Z {host} rotate[{random.randint(1000, 9999)}] {lvl} {msg}")
    open(f"logs/rotate-{date}.log", "w").write("\n".join(out) + "\n")

print("generated:", sum(len(f) for _, _, f in os.walk(".")), "files")
