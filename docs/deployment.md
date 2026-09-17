# Deployment

The app is a static build in `dist/`: one `index.html`, hashed assets, the three fixtures
inlined. It is served from an S3 bucket with static website hosting. No CloudFront, no custom
domain, no auth.

## One-time bucket setup

Done once, by the human, in the AWS console or in Terminal with the `aws` CLI.

1. Create a bucket. The name becomes part of the URL. Turn off "Block all public access" for
   this bucket; a website bucket must be readable by anyone.
2. Enable static website hosting on the bucket. Set both the index document and the error
   document to `index.html`.
3. Attach a bucket policy that allows public `s3:GetObject` on every object:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::<bucket>/*"
       }
     ]
   }
   ```

No server-side routing is needed. The app has no routes: it is one screen, and the view state
travels in the query string (`?session=…&compaction=…&item=…&view=…`). Every URL the app
produces resolves to `/index.html`, so the error document is a safety net, not a router.

## Variables

- `AUTOPSY_BUCKET`, required: the bucket name. The script refuses to run without it.
- `AWS_REGION`, optional: passed to `aws s3 sync` as `--region` when set. Otherwise the CLI's
  own configuration decides.

Credentials come from the usual `aws` CLI sources (profile, environment, SSO). The script does
not handle them.

## Deploy

From the repository root:

```sh
AUTOPSY_BUCKET=<bucket> bash scripts/deploy-s3.sh
```

The script runs `npm run build`, then `aws s3 sync dist/ s3://<bucket> --delete`, then prints
the website URL pattern. `--delete` removes objects that are no longer in `dist/`, so old hashed
assets do not accumulate. The script is a manual tool. It is not referenced from
`package.json` scripts and is not part of `npm run build`.

The egress rule: `aws` and `curl` are hard-deny rules in `.claude/settings.json`, backed by the
egress guard hook, and auto mode ignores `ask`, so the agent cannot run the sync. The human
either lifts the `aws` deny for that one command and restores it after, or runs the command
above in Terminal. Either way the run's output is pasted into `docs/tasks/T5-ship.md` under
"Deploy log".

## Verify

From Terminal, or with the `curl` rule lifted for the step:

```sh
curl -sS -o /dev/null -w '%{http_code}' <URL>
```

Expect `200`. Then run the browser checks against the live URL:

```sh
BASE_URL=<URL> npm run e2e
npm run screenshots -- <URL>
```

`npm run e2e` runs the Playwright smoke test in the machine's Google Chrome. `npm run
screenshots` writes four PNGs into the gitignored `screenshots/` folder: the landing view, the
compaction bar clicked, the LOST trace of the file-edit case, and the story view. The human
confirms the URL opens on a phone and shows the ticket case by default.

## URL as deployed

URL: (set by T5-ship)

Bucket: (set by T5-ship)

Region: (set by T5-ship)
