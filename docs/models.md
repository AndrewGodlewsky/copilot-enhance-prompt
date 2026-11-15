# Models

Enhance Prompt uses the models available through your GitHub Copilot account. Manage saved profiles in **Models**, then assign them to Low, Medium and High in **Settings > Effort models**. Claude, GPT and other model families shown in this catalog all use Copilot authentication and usage accounting.

## Add and choose a model

Click **Add a model**, choose a model from the live Copilot list, and save. Each profile has a name, model and enabled switch. The helper reuses the SDK and executable supplied by the running Copilot desktop app; it needs no API key, separate SDK installation or runtime download.

The helper must verify the same GitHub account as the attached session. A desktop sign-in that is unavailable to the helper produces an access error. See [background rewriting](copilot-background-rewriting.md) for account checks and compatibility limits.

The **Model** field lists eligible models from the attached Copilot session. **Refresh model list** retries discovery without generating text. The **Fetch model lists online** privacy switch must be enabled because each rewrite verifies current model access. A model name alone does not establish access; the runtime must identify it as an eligible Copilot model.

Direct provider APIs, local model servers, subscription CLIs and custom commands are no longer supported. Upgrade removes their saved profiles from active configuration instead of converting them into Copilot models. An effort assignment that referred to a removed profile needs an explicit replacement in Settings, including an explicit selection saved before effort levels existed. A retired AI-assisted file picker selection remains unavailable until you choose a Copilot model or Follow the selected effort in Models. Existing Copilot profiles and assignments are retained.

## Fallback

The **#** menu on each card sets its position; the switch skips that profile. The model assigned to the selected effort is tried first. With **Fallback to the next model when one fails** enabled, remaining eligible Copilot profiles can back it up within the run's time budget.

**Fall back on** selects either any model error or only network errors, timeouts, rate limits and server errors. Accounting failures stop fallback. The result identifies the model that answered and any failed attempts.

The **File picker model** selects the profile used for [AI-assisted context](context-levels.md). **AI Test** uses the selected effort's model for its research rounds and does not use research fallback. All of these requests stay within Copilot.

## Test a model

**Test** on a card sends a small request through that model alone and reports its duration or error. It uses your Copilot plan and can incur usage. Refreshing the model list does not make this request.
