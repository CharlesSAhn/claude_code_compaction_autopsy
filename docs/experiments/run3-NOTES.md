# Handover notes from the previous owner

Things I never wrote down anywhere else, read before touching anything:

- staging moved to argon-stg-02.internal last week. argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now.
- scripts/rotate_keys.sh is owned by the platform team. don't modify scripts/rotate_keys.sh, if rotation needs new behaviour build it alongside it (rotate_keys.py was the plan).
- dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog.
- house style: this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print().
- rotation cron is 03:15 UTC, see config/hosts.yaml. the vault cache warm call is safe to repeat.
- kms-relay-02 clock skew warnings in the logs are known, ignore them.
