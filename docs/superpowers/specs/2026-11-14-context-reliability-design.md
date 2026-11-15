# Reliable, understandable prompt context

The owner approved the context audit recommendations and four clearer menu choices.
The goal is quick prompt creation with relevant project context and dependable controls.

Keep Off, Project overview (Standard), Relevant code (Deep), and AI-assisted (Max).
Keep the existing default and honor saved Basic selections, showing Basic only when selected.
Relevant code adds local search without another model call; AI-assisted explicitly adds a
selector request. Cap its final file selection at ten, with AI choices before heuristic fill.

Use one file policy across instructions, summaries, snippets, tree, selector, and Git changes.
Unchecked files must not return through a diff or an alias. Mask recognized secrets in all
automatically gathered text before shortening it. Explicit user input and attachments retain
their existing behavior. Preview and enhancement reread static project context; hook caches
must match current file preferences. Walk supported instruction directories without Git and
provide bounded content search with line numbers and a clear note when its limit is reached.

Refresh visible previews after debounced request, level, target, project, exclusion, or context
preference changes. Cancel obsolete previews and ignore late results. Keep unchecked items
available for re-selection. Add a manual refresh for edits outside the panel and explain that
AI selection happens only during enhancement.

Alternatives: retaining five choices leaves Basic competing with more useful choices;
collapsing to a single automatic mode hides the cost and data-sharing difference of AI selection.
The chosen four-choice menu preserves that decision without changing existing preferences.

No desktop/browser control, paid model tests, dependency additions, unrelated layout changes,
or changes to sending safeguards. Verify source and generated package, bump to 0.3.1, and
commit/push main without tags or releases.
