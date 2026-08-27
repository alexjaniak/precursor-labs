import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const syncWorkflowUrl = new URL(".github/workflows/sync-writings.yml", root);
const deployWorkflowUrl = new URL(".github/workflows/deploy.yml", root);

const readSyncWorkflow = () => {
  assert.ok(existsSync(syncWorkflowUrl), "missing scheduled writings workflow");
  return readFileSync(syncWorkflowUrl, "utf8");
};

const extractBlock = (source, pattern, message) => {
  const match = source.match(pattern);
  assert.ok(match, message);
  return match[0];
};

test("scheduled writings workflow has the required trigger, permissions, and shared concurrency", () => {
  const workflow = readSyncWorkflow();

  assert.match(workflow, /^name: Sync writings and deploy$/m);
  assert.match(workflow, /^  schedule:\n    - cron: ["']17 9 \* \* \*["']$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(
    workflow,
    /^permissions:\n  contents: write\n  pages: write\n  id-token: write$/m,
  );
  assert.match(
    workflow,
    /^concurrency:\n  group: pages\n  cancel-in-progress: false$/m,
  );
});

test("sync-build checks out the default branch and uses the pinned pnpm and Node setup", () => {
  const workflow = readSyncWorkflow();

  assert.match(workflow, /^  sync-build:\n/m);
  assert.match(
    workflow,
    /uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(
    workflow,
    /uses: pnpm\/action-setup@v4\n\s+with:\n\s+version: 9\.13\.1/,
  );
  assert.match(
    workflow,
    /uses: actions\/setup-node@v4\n\s+with:\n\s+node-version: 22\n\s+cache: pnpm/,
  );
  assert.match(workflow, /run: pnpm install --frozen-lockfile/);
});

test("sync-build runs the sync, focused tests, and build with all required values", () => {
  const workflow = readSyncWorkflow();

  assert.match(workflow, /run: pnpm run sync:writings/);
  assert.match(
    workflow,
    /X_API_BEARER_TOKEN: \$\{\{ secrets\.X_API_BEARER_TOKEN \}\}/,
  );
  assert.match(
    workflow,
    /run: pnpm exec tsx --test tests\/writings-sync\.test\.mjs tests\/homepage\.test\.mjs tests\/writings-workflow\.test\.mjs/,
  );
  assert.match(workflow, /run: pnpm run build/);
  assert.match(
    workflow,
    /VITE_MIXPANEL_TOKEN: \$\{\{ secrets\.VITE_MIXPANEL_TOKEN \}\}/,
  );
  assert.match(
    workflow,
    /VITE_CONTACT_ENDPOINT: \$\{\{ vars\.VITE_CONTACT_ENDPOINT \}\}/,
  );
  assert.match(
    workflow,
    /VITE_TURNSTILE_SITE_KEY: \$\{\{ vars\.VITE_TURNSTILE_SITE_KEY \}\}/,
  );
});

test("cursor-only state changes commit but do not upload or deploy the site", () => {
  const workflow = readSyncWorkflow();
  const changeStep = extractBlock(
    workflow,
    /      - name: Detect generated changes\n[\s\S]*?(?=\n      - name:)/,
    "missing bounded generated-change step",
  );
  const uploadStep = extractBlock(
    workflow,
    /      - name: Upload Pages artifact\n[\s\S]*?(?=\n\n  deploy:)/,
    "missing bounded Pages artifact step",
  );
  const deployJob = extractBlock(
    workflow,
    /\n  deploy:\n[\s\S]*$/,
    "missing bounded deploy job",
  );

  assert.match(
    workflow,
    /^    outputs:\n      any_changed: \$\{\{ steps\.changes\.outputs\.any_changed \}\}\n      site_changed: \$\{\{ steps\.changes\.outputs\.site_changed \}\}$/m,
  );
  assert.equal(
    changeStep,
    `      - name: Detect generated changes
        id: changes
        shell: bash
        run: |
          any_changed=false
          site_changed=false
          if ! git diff --quiet -- data/writings.json data/writing-sync-state.json index.html; then
            any_changed=true
          fi
          if ! git diff --quiet -- index.html; then
            site_changed=true
          fi
          echo "any_changed=$any_changed" >> "$GITHUB_OUTPUT"
          echo "site_changed=$site_changed" >> "$GITHUB_OUTPUT"`,
  );
  assert.equal(
    uploadStep,
    `      - name: Upload Pages artifact
        if: steps.changes.outputs.site_changed == 'true'
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist`,
  );
  assert.match(
    deployJob,
    /^\n  deploy:\n    needs: sync-build\n    if: needs\.sync-build\.outputs\.site_changed == 'true'$/m,
  );
  assert.doesNotMatch(uploadStep, /any_changed/);
  assert.doesNotMatch(deployJob, /any_changed/);

  assert.match(
    workflow,
    /if: steps\.changes\.outputs\.any_changed == 'true'/,
  );
  assert.match(
    workflow,
    /git add -- data\/writings\.json data\/writing-sync-state\.json index\.html/,
  );
  assert.match(
    workflow,
    /git diff --cached --name-only[\s\S]*chore: sync writings[\s\S]*git push origin "HEAD:\$\{\{ github\.event\.repository\.default_branch \}\}"/,
  );
});

test("commit and deployment steps use the exact safe contract", () => {
  const workflow = readSyncWorkflow();

  assert.match(workflow, /git config user\.name "github-actions\[bot\]"/);
  assert.match(
    workflow,
    /git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/,
  );
  assert.match(
    workflow,
    /allowed='\^\(data\/writings\\\.json\|data\/writing-sync-state\\\.json\|index\\\.html\)\$'/,
  );
  assert.match(
    workflow,
    /git diff --cached --name-only \| grep -Ev "\$allowed" \|\| true/,
  );
  assert.match(workflow, /git commit -m "chore: sync writings"/);
  assert.match(workflow, /^  deploy:\n    needs: sync-build$/m);
  assert.match(
    workflow,
    /environment:\n\s+name: github-pages\n\s+url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/,
  );
  assert.match(
    workflow,
    /- id: deployment\n\s+uses: actions\/deploy-pages@v4/,
  );
});

test("normal Pages deploy keeps its triggers and supplies contact build variables", () => {
  const workflow = readFileSync(deployWorkflowUrl, "utf8");

  assert.match(workflow, /^  push:\n    branches: \[main\]$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(
    workflow,
    /VITE_MIXPANEL_TOKEN: \$\{\{ secrets\.VITE_MIXPANEL_TOKEN \}\}/,
  );
  assert.match(
    workflow,
    /VITE_CONTACT_ENDPOINT: \$\{\{ vars\.VITE_CONTACT_ENDPOINT \}\}/,
  );
  assert.match(
    workflow,
    /VITE_TURNSTILE_SITE_KEY: \$\{\{ vars\.VITE_TURNSTILE_SITE_KEY \}\}/,
  );
});
