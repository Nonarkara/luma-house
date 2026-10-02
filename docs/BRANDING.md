# designon logo assets

Source: the user-supplied `Designon Logo Concepts Board.png`. The PNG variants
were extracted and cleaned with imagegen, then transparent canvas was trimmed
and web sizes exported. The supplied navy/yellow brand colours stay fixed
across the four selectable interface schemes. No CSS tint, filter, opacity,
white backing rectangle or distortion is applied to the logo images.

- `designon-wordmark.png`: header and welcome screen.
- `designon-symbol.png`: header and welcome screen house + light mark.
- `designon-mono.png`: browser favicon.
- `designon-app.png`: square app-icon variant in the platform guide.
- `app-icon-192.png` / `app-icon-512.png`: Android/web-app manifest exports.
- `apple-touch-icon.png`: 180px iOS home-screen export.

Base logos have true alpha, including white negative space. Home-screen
exports use a fixed Solar Pop paper backing so operating-system icon handling
cannot turn their cut-outs into an unreadable black field. This backing is
part of those dedicated platform exports, not a CSS background on base logos.

The manifest uses relative start/scope/icon paths for `/luma-house/` hosting.
The platform guide is available in onboarding and below the workspace, with
native collapsible instructions for Android Chrome and iPhone Safari. These
are web-app instructions, not store-release badges. There is no offline shell
or service-worker cache; loading the application and AI features needs internet.
Plans remain local to the browser/installed app. Share carries a plan between
contexts; installing does not promise data synchronization.

Installation references:
[MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
and [Apple home-screen web apps](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios).

Checks cover real PNG alpha/no painted white, decoded image sizes, untouched
CSS image rendering, all four schemes, welcome and footer controls, ordinary
scrolling, preserved canvas height and correctly resolving manifest icons.
Physical Android/iPhone installation has not been tested in this desktop run.
