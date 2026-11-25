# VexHub — Vexuno Studio

VexHub is a responsive browser-based game client for Vexuno Studio. Its first playable title is **SUNSET STRIKE 3D**, an arcade space shooter released as **0.1 BETA**.

## Run locally

1. Download and extract this project.
2. Open a terminal in the extracted `VexHub` folder.
3. Run `python -m http.server 8000`.
4. Visit `http://localhost:8000` and select **Play now** on the dashboard, or open **Discover**.

## Publish with GitHub Pages

1. Upload the contents of this folder to the root of your GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your main branch and `/ (root)`, then save.
5. Open the published VexHub URL and launch SUNSET STRIKE 3D.

The game uses relative project paths, so it works from a GitHub Pages repository subpath.

## Included in VexHub 1.1.0 preview

- Responsive dashboard, Discover catalogue, and personal library.
- SUNSET STRIKE 3D featured as the first available playable game.
- Local favourites, profile display name, accent colour, and reduced-motion setting.
- Search, navigation, and local preferences.
- Playable SUNSET STRIKE 3D 0.1 BETA.

## SUNSET STRIKE 3D — 0.1 BETA

- Three-dimensional interceptor, enemy fighters, effects, stars, and flagship boss.
- Three enemy classes and escalating waves.
- Automatic weapons with three upgrade levels.
- Hull damage, repair pickups, weapon pickups, and shockwave bombs.
- Boss health bar and wave progression.
- Local best score, mission count, and hostiles-down record.
- Keyboard, mouse/touch-drag, and mobile on-screen controls.
- Synthesized sound effects with a mute toggle.
- Pause/resume and restart flow.

### Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Mouse / touch drag | Steer |
| Space | Use a bomb |
| P / Esc | Pause or resume |
| M | Toggle sound |

The game is in `games/sunset-strike-3d/`. It loads Three.js r128 from cdnjs, so a network connection and WebGL support are required when playing. Scores are stored locally in the current browser; there is no online account, synced profile, or global leaderboard backend.

## Source note

The supplied game archive contained the title, HUD, and style sheet, but its `app.js` was a CSS duplicate rather than a gameplay implementation. The playable 0.1 BETA is a new implementation based on the supplied identity and visible gameplay concepts, not recovered original game code.
