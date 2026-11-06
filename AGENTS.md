<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Quran reading uses the API's unmodified Uthmani verse text, a Quran-specific font, and a decorative paper layer; script integrity must not depend on visual styling.
- Compass sensor input must be north-referenced, validated, and time-smoothed; relative orientation cannot establish the direction of the Qibla. Keep screen-edge projection and circular angle math in the browser-safe compass helper so tilted, vertical, and wraparound readings can be tested independently.
