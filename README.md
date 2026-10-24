# Roadster Jump

Drive the Tesla Roadster v2 around the night arena from the film *Jurek Roadster Kickflip*, climb the giant curled "C" ramp on the suction fan, hang upside down from the ceiling, launch off the lip and kickflip on the cold-gas thrusters. Then press L: the camera flies out to a second site 440 m away, where five Teslas (Model 3, Model Y, Semi, Cybertruck, Cybercab) stand side by side on an LED stage as in the "Do a kickflip" film, and you jet-ollie and kickflip over all of them.

Browser game, three.js r160 + Rapier 0.21 from CDN, no build step. Desktop (keyboard + mouse) and phones (touch, landscape).

## Run locally

```
node Niepotrzebne/tools/server.mjs 8840
```

then open http://127.0.0.1:8840/. URL options: `?q=low|high` quality, `?debug` fps counter.

## Controls

| Key | Action |
| --- | --- |
| W / S | throttle / brake, hold S to reverse |
| A / D | steer, spin in the air |
| F | suction fan: presses the car onto the wall and the ceiling |
| Shift | rear thrusters boost |
| Space | jets: tap to hop, hold to ollie (up to about 9 m), soft landing in the air |
| L | fly out to the Tesla lineup and back to the curl (on foot or in the car, you arrive driving) |
| E near a lineup Tesla | drive it (Model 3, Model Y, Semi, Cybertruck, Cybercab as plain cars, no jets or suction) |
| E in the air | open the gullwing doors for the Gullwing bonus |
| ↓ / ↑ on the ground | manual on the rear wheels / nose manual on the front (jets tip the car) |
| O | photo mode: frozen moment, ghost camera, FOV, focus and blur, exposure, tilt, looks, frames (16:9, 4:5, 1:1, 9:16) with a thirds grid, H hides the panel, save PNG cropped to the frame |
| Arrows | flip (up/down) and kickflip roll (left/right) in the air |
| E | get in / get out (Jurek walks on foot) |
| C | camera: chase that rolls with the car, level horizon, cockpit |
| P | replay the last jump on a loop (C: TV cameras or the free-fly ghost camera with WASD, Q/E, Shift and the mouse; Space pause, left/right scrub) |
| K | in a replay: record the TV cut as a 16:9 or 9:16 video clip with sound (MP4 where the browser can) |
| R | reset to the start of the site you are at and put every knocked prop back (in a lineup Tesla: all five back on the stage) |
| T | flight assist on / off (off gives x1.5 points) |
| M | music |

## How it works

- `src/sim/` car physics from Roadster 88: Rapier rigid body, raycast suspension along the car's own down axis (so it works on the curl and the ceiling), slip-based tyres, AWD powertrain, ten gimballed nozzles with the control allocator, plus the suction fan (`CarSim.suction`) that pushes the car onto whatever surface it faces, scaled by attitude (0.35 g on the flat, 1.85 g upside down).
- `src/sim/flight.js` rate control for flips and spins in the air; flight assist damps the spin when you let go, rolls the wheels down before touchdown and turns Space into a soft-landing glide.
- `src/ramp.js` the Film14 ramp profile (quarter pipe R 12.5 m, curl R 12.5 m, 15 m ceiling at 25 m, lip at x = -15) and its collision from convex deck segments.
- `src/arena.js` the Film14 arena and its light show, driven by game events (ramp run, launch, landing).
- `src/lineup.js` the lineup site: hand-built lofted bodies (Model 3, Model Y, Semi, Cybercab) and a faceted Cybertruck merged per material, an event-lighting reflection map, contact shadows, the LED stage, smoke cannons, floodlight towers, power lines and the sodium-lamp road back to the arena, plus the collision boxes and car footprints used to score "Over the lineup". One spotlight moves to whichever site the camera is at, so the second site costs no extra light.
- `src/main.js` the L flight: a cubic path that lifts off from the car or Jurek, swings around the curl, follows the lamp road with thinner fog, then descends behind the Roadster and blends into the live chase camera; the car is teleported at the halfway point, out of sight.
- `src/tricks.js` jump detection and scoring (doubles and triples, late flips, bigspin, varial, gullwing, manuals and a combo chain that multiplies tricks done back to back), `src/replay.js` 60 Hz recorder with a TV director and a free camera, `src/online.js` three Firebase leaderboards.
- `src/avatar/` Jurek on foot and seated (Roadster 88 driver, walker and get-in/out moves).
- `src/props.js` everything loose on the map (rig cases, floor moving heads, barrier segments, poles, work lights, the Film14 semi, smoke cannons, road lamps) stands fixed until a car, a jet or another flying prop reaches it, then turns into a dynamic body.
- `src/ghostcam.js` and `src/photo.js` the free-flying ghost camera (replay free view and photo mode) and the photo bar; depth of field lives in `src/post.js`.
- `src/fx.js` tyre marks on any surface and spark showers where a hull hits, `src/camera.js` landing and crash shake plus the boost FOV kick.
- `src/clip.js` replay clips: `captureStream` of the canvas plus the game mix tapped after the master compressor, recorded with MediaRecorder at the clip's own size, then a looping preview card to save or share.
- `src/radar.js` the heading-up radar in the HUD (ramp, landing X, lamp road, lineup, players, distance to the other site); the HUD also has a Tesla-style speed cluster with P R N D and a power bar, a map of the ten nozzles, an attitude ring in the air, a combo window meter and a stunts list that folds away while you drive.
- `src/net.js` and `src/remote.js` multiplayer: one shared arena (rooms of up to eight) on the Firebase RTDB (`roadsterJump/rooms`, `roadsterJump/live`, rules in `Niepotrzebne/rtdb-roadsterJump.json`), state packed into a short string at up to 10 Hz, remote cars as interpolated bodies with their real mass so crashes trade momentum, remote players on foot as a simple figure, name tags that pop the score of every trick the player lands, a trick feed, join and leave notes and an Online tab in the menu that lists everyone with their site and flies you to them. `?mp=local` runs it between tabs over a BroadcastChannel, `?mp=off` disables it.

## Checks

`Niepotrzebne/tools/test.mjs` (headless Chrome, Metal) boots the game and drives a scripted input sequence: climb to the upside-down ceiling, hang 4 s, reverse down, full run, leave the lip, kickflip, land. `lineup.mjs` renders the lineup and flies a scripted jet ollie kickflip over it (speed-based takeoff, `REPLAY=1` saves the TV replay), `travel.mjs` saves both L flights frame by frame, `hitch.mjs` / `hitch2.mjs` log long frames (first jet firing), `perf_lineup.mjs` fps at both sites, `features.mjs` the new tricks, ghost camera and photo mode, `props.mjs` knocking props over, `fleet.mjs` driving the lineup Teslas, `mp.mjs` two-tab multiplayer with a crash, `mpsocial.mjs` the trick feed and flying to a player, `photo.mjs` photo frames and cropped saves, `clip.mjs` recording both clip formats, `fx.mjs` tyre marks and sparks, `hud.mjs` a tour of every HUD and menu state (add `812 375 1` for the phone layout). `kbd.mjs` checks the real keyboard path, `mobile.mjs` the iPhone layout in WebKit, `perf2.mjs` the frame-time cost of features.

See `CREDITS.md` for assets.
