# Models

Enhance Prompt uses the models available through your GitHub Copilot account. In **Models > Effort models**, assign model/reasoning pairs to Low, Medium and High or use the recommended presets. Choose directly from your account's catalog without creating profiles. Claude, GPT and other model families shown here all use Copilot authentication and usage accounting. See [effort settings](settings.md#effort-models) for the preset table and upgrade behavior.

## Choose a model

Select the model and reasoning dropdowns for each effort; changes save automatically. Existing assignments and reasoning choices stay intact. The helper reuses the SDK and executable supplied by the running Copilot desktop app; it needs no API key, separate SDK installation or runtime download.

The helper must verify the same GitHub account as the attached session. A desktop sign-in that is unavailable to the helper produces an access error. See [background rewriting](copilot-background-rewriting.md) for account checks and compatibility limits.

The **Model** field lists eligible models from the attached Copilot session. **Check connection** refreshes discovery without generating text and displays a completion time and check number. Failures offer **Retry connection**, with **Show Logs** available for diagnosis. The **Fetch model lists online** privacy switch must be enabled because each rewrite verifies current model access. A model name alone does not establish access; the runtime must identify it as an eligible Copilot model.

Direct provider APIs, local model servers, subscription CLIs and custom commands are no longer supported. Upgrade removes their saved profiles from active configuration instead of converting them into Copilot models. An effort assignment that referred to a removed profile needs an explicit replacement in Models, including an explicit selection saved before effort levels existed. A retired AI-assisted file picker selection remains unavailable until you choose a Copilot profile or Follow the selected effort under Advanced model options. Existing Copilot profiles and assignments are retained.

## Advanced model options

Open this disclosure for optional saved profiles, fallback order, model tests and a separate AI-assisted context model. **Add advanced profile** creates a named, enabled Copilot model entry. It is not required to configure any effort. Existing profile-based assignments still use their saved profiles until you choose a direct model instead.

## Fallback

The **More** menu on each profile card changes its order; the enabled switch skips that profile when off. The model assigned to the selected effort is tried first. With **Fallback to the next model when one fails** enabled, remaining eligible Copilot profiles can back it up within the run's time budget.

Enabling fallback allows other model errors to try the next profile. An existing saved restriction to transient errors remains effective until fallback is re-enabled. Accounting failures and unsupported or unapplied reasoning stop fallback. Fallback models use their own default reasoning. The result identifies the model that answered and any failed attempts.

The **File picker model** selects the profile used for [AI-assisted context](context-levels.md). **AI Test** uses the selected effort's model for its research rounds and does not use research fallback. All of these requests stay within Copilot.

## Test a model

**Test** on a card sends a small request through that model alone and reports its duration or error. It uses your Copilot plan and can incur usage. Refreshing the model list does not make this request.
