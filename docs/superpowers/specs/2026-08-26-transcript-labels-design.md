# Transcript Labels Design

## Goal

Shorten the terminal command labels and combine related research content without changing the rest of the page.

## Selected design

- Keep the terminal title `PRECURSOR_LABS — zsh` unchanged.
- Change the section commands to `about`, `thesis`, `research and interests`, `backers`, and `team experience`.
- Remove the `precursor` prefix from every section command.
- Combine the current research and interests entries into one transcript entry.
- Keep both existing research and interests paragraphs under the combined command, in their current order.
- Keep all body copy, links, analytics values, layout, and styling unchanged.

## Alternatives

- One long combined paragraph: rejected because the two ideas are easier to scan as separate paragraphs.
- A visible separator between the two paragraphs: rejected because it adds unnecessary visual noise.
- Renaming the commands without combining the entries: rejected because it does not meet the request.

## Verification

- A source test requires the five new commands in the approved order.
- The test confirms that no section command contains the `precursor` prefix.
- The test confirms that the research and interests copy is inside one transcript entry.
- Existing link, analytics, layout, animation, and build checks continue to pass.
- A localhost check confirms that the combined entry renders correctly.
