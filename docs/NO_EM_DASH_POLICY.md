# No Em Dash Policy

## Rule

Do not use Unicode code point U+2014 in app copy, page content, modal text, notifications, documentation, comments, migrations, fixtures, tests, seed data, or release notes.

Use ASCII punctuation instead:

- ` - ` for a light sentence break.
- `:` when the second phrase explains the first.
- `,` or `.` when the copy reads better as a normal sentence.
- Parentheses for side notes.

## Required Check

Run this from the workspace root before a build, release, or handoff:

```sh
cd /Users/a1234/Desktop/tiwiapp
rg --hidden -n $'\u2014' . \
  -g '!**/.git/**' \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  -g '!**/build/**' \
  -g '!**/coverage/**' \
  -g '!**/public/charts/**' \
  -g '!**/assets/chart/**' \
  -g '!**/assets/charts/**' \
  -g '!**/artifacts/**' \
  -g '!**/cache/**' \
  -g '!**/package-lock.json' \
  -g '!**/pnpm-lock.yaml' \
  -g '!**/yarn.lock' \
  -g '!**/*.png' \
  -g '!**/*.jpg' \
  -g '!**/*.jpeg' \
  -g '!**/*.gif' \
  -g '!**/*.webp' \
  -g '!**/*.mp4' \
  -g '!**/*.ttf' \
  -g '!**/*.woff' \
  -g '!**/*.woff2' \
  -g '!**/*.svg'
```

The command must return no matches. If it prints any file path, replace U+2014 before shipping.

## Build Gate Option

Use this form in CI or a prebuild script:

```sh
if rg --hidden -n $'\u2014' . \
  -g '!**/.git/**' \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  -g '!**/build/**' \
  -g '!**/coverage/**' \
  -g '!**/public/charts/**' \
  -g '!**/assets/chart/**' \
  -g '!**/assets/charts/**' \
  -g '!**/artifacts/**' \
  -g '!**/cache/**' \
  -g '!**/package-lock.json' \
  -g '!**/pnpm-lock.yaml' \
  -g '!**/yarn.lock' \
  -g '!**/*.png' \
  -g '!**/*.jpg' \
  -g '!**/*.jpeg' \
  -g '!**/*.gif' \
  -g '!**/*.webp' \
  -g '!**/*.mp4' \
  -g '!**/*.ttf' \
  -g '!**/*.woff' \
  -g '!**/*.woff2' \
  -g '!**/*.svg'; then
  echo "U+2014 is not allowed. Use ASCII punctuation instead."
  exit 1
fi
```

## Review Checklist

- Pages, app screens, and website content have no U+2014.
- Modals, toasts, banners, alerts, and notifications have no U+2014.
- Markdown, SQL, scripts, tests, comments, and seed data have no U+2014.
- New copy uses ASCII punctuation unless a product requirement explicitly allows another Unicode character.
