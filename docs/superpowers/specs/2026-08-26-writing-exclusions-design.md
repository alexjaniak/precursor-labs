# Writing Exclusions Design

## Goal

Keep four approved articles out of the writings window, including after an automatic writings sync.

## Options

1. Add an `excludedUrls` list to `config/writing-sources.json` and apply it after the saved and fetched records are merged. This keeps the policy visible and removes matching records from both sources.
2. Put the four URLs in TypeScript. This needs less configuration work, but it hides an editorial decision in program code.
3. Delete the four records only from `data/writings.json` and `index.html`. This is not sufficient because a later feed sync can add them again.

Use option 1.

## Design

Add an optional `excludedUrls` array to the writing source configuration. A missing value defaults to an empty array so existing test configurations continue to work. A present value must be an array.

Canonicalize each exclusion before matching: require a safe HTTPS URL with no credentials, remove its query and fragment, and remove final slashes from a non-root path. Reject invalid values and duplicates after canonicalization. Finish this validation before any network request or file write.

The sync parses this list, merges saved and fetched records as it does now, and then removes all records whose canonical URL is in the canonical exclusion set. It writes the filtered records to `data/writings.json` and regenerates the marked writings rows in `index.html`.

Remove these four URLs:

- `https://impermanentfoundation.substack.com/p/star-is-now-governed-by-markets`
- `https://dylanvu.substack.com/p/how-to-always-win-two-self-improving`
- `https://dylanvu.substack.com/p/unsolicited-my-beliefs`
- `https://dylanvu.substack.com/p/dylan-vus-npc-to-pc-conversion-protocol`

Keep the general rule that a missing feed item does not remove a saved historical record. Only an exact URL in `excludedUrls` can remove one.

## Tests

Add a test that runs the sync with an excluded URL in both the saved list and a fetched feed. The final JSON and generated HTML must not contain that URL. Keep a separate non-excluded historical record to prove that normal history retention still works. Test matching across query, fragment, and final-slash variants.

Test that a missing `excludedUrls` value defaults to an empty array. Test that a non-array value, duplicate canonical URL, HTTP URL, credentialed URL, and invalid URL fail before network access and before file writes.

Update the source configuration test. Make the current archive checks confirm that all four excluded URLs are absent from both `data/writings.json` and the generated writings list.

Run the focused writings tests, the full test suite, the type check, the production build, and `git diff --check`.

## Worktree safety

Do not change or commit the existing unrelated edits in `src/terminal-stack.css`, `tests/homepage.test.mjs`, or `artifacts/precursor-twitter-banner.png`, except for the exact writings assertions that this change requires in `tests/homepage.test.mjs`.
