import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const extractRunScript = (stepBlock) => {
  const marker = "        run: |\n";
  const start = stepBlock.indexOf(marker);
  assert.notEqual(start, -1, "step must contain a literal run block");
  return stepBlock
    .slice(start + marker.length)
    .split("\n")
    .map((line) => {
      assert.match(line, /^ {10}/, "run-block line must use the step indent");
      return line.slice(10);
    })
    .join("\n");
};

test("scheduled writings workflow isolates sync concurrency and uses job-scoped permissions", () => {
  const workflow = readSyncWorkflow();
  const syncJob = extractBlock(
    workflow,
    /  sync-build:\n[\s\S]*?(?=\n  deploy:)/,
    "missing bounded sync-build job",
  );
  const deployJob = extractBlock(
    workflow,
    /  deploy:\n[\s\S]*$/,
    "missing bounded deploy job",
  );

  assert.match(workflow, /^name: Sync writings and deploy$/m);
  assert.match(workflow, /^  schedule:\n    - cron: ["']17 9 \* \* \*["']$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(
    workflow,
    /^concurrency:\n  group: writings-sync\n  cancel-in-progress: false$/m,
  );
  assert.match(
    syncJob,
    /^    permissions:\n      contents: write$/m,
  );
  assert.doesNotMatch(syncJob, /^      pages:|^      id-token:/m);
  assert.match(
    deployJob,
    /^    permissions:\n      contents: read\n      pages: write\n      id-token: write$/m,
  );
  assert.doesNotMatch(deployJob, /^      contents: write$/m);
  assert.match(
    deployJob,
    /^    concurrency:\n      group: pages\n      cancel-in-progress: false$/m,
  );
});

test("sync-build checks out the default branch and uses the pinned pnpm and Node setup", () => {
  const workflow = readSyncWorkflow();

  assert.match(workflow, /^  sync-build:\n/m);
  assert.match(
    workflow,
    /^    if: github\.ref_name == github\.event\.repository\.default_branch$/m,
  );
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

test("X sync runs every fourth UTC day while manual runs remain enabled", () => {
  const workflow = readSyncWorkflow();
  const cadenceStep = extractBlock(
    workflow,
    /      - name: Set X sync cadence\n[\s\S]*?(?=\n      - name: Sync writings)/,
    "missing X sync cadence step",
  );
  const cadenceScript = extractRunScript(cadenceStep);

  const runCadence = (eventName, epochDay) => {
    const directory = mkdtempSync(join(tmpdir(), "precursor-x-cadence-"));
    const outputPath = join(directory, "output");
    const script = cadenceScript.replace(
      "$(date -u +%s)",
      String(epochDay * 86400),
    );
    const result = spawnSync("bash", ["-eu", "-o", "pipefail", "-c", script], {
      cwd: directory,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: eventName,
        GITHUB_OUTPUT: outputPath,
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const output = readFileSync(outputPath, "utf8").trim();
    rmSync(directory, { recursive: true, force: true });
    return output;
  };

  assert.equal(runCadence("schedule", 20_692), "x_enabled=true");
  assert.equal(runCadence("schedule", 20_693), "x_enabled=false");
  assert.equal(runCadence("schedule", 20_694), "x_enabled=false");
  assert.equal(runCadence("schedule", 20_695), "x_enabled=false");
  assert.equal(runCadence("schedule", 20_696), "x_enabled=true");
  assert.equal(runCadence("workflow_dispatch", 20_693), "x_enabled=true");
});

test("sync-build runs the sync, focused tests, and build with all required values", () => {
  const workflow = readSyncWorkflow();

  assert.match(workflow, /run: pnpm run sync:writings/);
  assert.match(
    workflow,
    /X_API_BEARER_TOKEN: \$\{\{ steps\.x-cadence\.outputs\.x_enabled == 'true' && secrets\.X_API_BEARER_TOKEN \|\| '' \}\}/,
  );
  assert.match(
    workflow,
    /SUBSTACK_PROXY_BASE: \$\{\{ vars\.SUBSTACK_PROXY_BASE \}\}/,
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
  const guardStep = extractBlock(
    workflow,
    /      - name: Validate repository changes\n[\s\S]*?(?=\n      - name:)/,
    "missing bounded repository-change guard",
  );
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
  assert.ok(
    workflow.indexOf(guardStep) < workflow.indexOf(uploadStep),
    "repository guard must run before artifact upload",
  );

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

test("repository guard accepts exact generated files and rejects every other change class", (t) => {
  const workflow = readSyncWorkflow();
  const guardStep = extractBlock(
    workflow,
    /      - name: Validate repository changes\n[\s\S]*?(?=\n      - name:)/,
    "missing bounded repository-change guard",
  );
  const guardScript = extractRunScript(guardStep);
  assert.match(
    guardScript,
    /git diff --name-only\n\s+git diff --cached --name-only\n\s+git ls-files --others --exclude-standard\n\s+\} \| LC_ALL=C sort -u/,
  );
  const sandbox = mkdtempSync(join(tmpdir(), "precursor-workflow-"));
  t.after(() => rmSync(sandbox, { recursive: true, force: true }));

  mkdirSync(join(sandbox, "data"));
  writeFileSync(join(sandbox, "data/writings.json"), "[]\n");
  writeFileSync(join(sandbox, "data/writing-sync-state.json"), "{}\n");
  writeFileSync(join(sandbox, "index.html"), "base\n");
  writeFileSync(join(sandbox, "tracked.txt"), "base\n");
  execFileSync("git", ["init", "-q"], { cwd: sandbox });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: sandbox });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: sandbox,
  });
  execFileSync("git", ["add", "."], { cwd: sandbox });
  execFileSync("git", ["commit", "-qm", "base"], { cwd: sandbox });

  const runGuard = () =>
    spawnSync("bash", ["-euo", "pipefail", "-c", guardScript], {
      cwd: sandbox,
      encoding: "utf8",
    });

  writeFileSync(join(sandbox, "data/writing-sync-state.json"), '{"cursor":"2"}\n');
  assert.equal(runGuard().status, 0, "one allowed cursor change must pass");

  writeFileSync(join(sandbox, "tracked.txt"), "unexpected\n");
  assert.notEqual(runGuard().status, 0, "unexpected tracked change must fail");
  writeFileSync(join(sandbox, "tracked.txt"), "base\n");

  writeFileSync(join(sandbox, "untracked.txt"), "unexpected\n");
  assert.notEqual(runGuard().status, 0, "unexpected untracked file must fail");
  rmSync(join(sandbox, "untracked.txt"));

  writeFileSync(join(sandbox, "tracked.txt"), "staged\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: sandbox });
  assert.notEqual(runGuard().status, 0, "unexpected staged change must fail");
});

test("commit and deployment steps use the exact safe contract", () => {
  const workflow = readSyncWorkflow();
  const commitStep = extractBlock(
    workflow,
    /      - name: Commit generated changes\n[\s\S]*?(?=\n      - name:)/,
    "missing bounded generated-change commit step",
  );

  assert.match(commitStep, /git config user\.name "github-actions\[bot\]"/);
  assert.match(
    commitStep,
    /git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/,
  );
  assert.match(
    commitStep,
    /allowed='\^\(data\/writings\\\.json\|data\/writing-sync-state\\\.json\|index\\\.html\)\$'/,
  );
  assert.match(
    commitStep,
    /staged_paths="\$\(git diff --cached --name-only \| LC_ALL=C sort -u\)"/,
  );
  assert.match(
    commitStep,
    /printf '%s\\n' "\$staged_paths"[\s\S]*grep -Ev "\$allowed" \|\| true/,
  );
  assert.match(commitStep, /git commit -m "chore: sync writings"/);
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
    /^concurrency:\n  group: pages\n  cancel-in-progress: true$/m,
  );
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
