# Identifying repeated actions

In **Rules** and **Models → Advanced model options**, controls now identify the item they affect. Examples include **Delete rule 2: Run tests**, **More actions for model profile 1: Primary**, and **Edit structure 3: My brief**. Model selection, testing, enable/disable, reordering, deletion and restoring a built-in structure's default all include item identity.

The current row number distinguishes duplicate names, including long labels with identical beginnings. Accessible descriptions use a preview of at most 96 Unicode code points and an ellipsis; empty labels use **Untitled**. Whitespace is simplified only for the control name. Saved rule text, profile/structure names and action targets stay unchanged. The existing buttons, menus, switch behavior and layout remain in place.

## Owner checks still needed

These checks are part of [the desktop acceptance gate](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/29), not claims made by static tests:

1. Create two rules or profiles with the same name. Navigate by Tab and use the screen reader's control list. Confirm each switch/action names the correct numbered item.
2. Open a profile's More menu with the keyboard, move through Edit, Move up/down and Delete, and press Escape. Verify focus returns to that profile's menu button. After reordering or deleting, verify focus remains understandable and announcements match the new order.
3. Edit a structure, cancel/save, then verify focus and the updated name. For an edited built-in structure, confirm Restore the default names that structure.
4. Use voice control with the visible action word (for example **Test**, **Edit** or **Undo**) and confirm it can identify the corresponding control. Check narrow/wide canvases, larger text and zoom for tooltip wrapping without layout shifts.

Automated tests inspect rendered names (with menu contents exposed by a fixture), duplicate/empty/long labels and Unicode handling. They do not exercise real menu portals, focus restoration, screen-reader pronunciation or voice recognition.
