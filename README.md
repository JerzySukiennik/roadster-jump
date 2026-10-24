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
| Arrows | flip (up/down) and kickflip roll (left/right) in the air |
| E | get in / get out (Jurek walks on foot) |
| C | camera: chase that rolls with the car, level horizon, cockpit |
| P | replay the last jump (C: TV cameras / free orbit, Space pause, left/right scrub) |
| R | reset to the start of the site you are at |
| T | flight assist on / off (off gives x1.5 points) |
| M | music |

## How it works

- `src/sim/` car physics from Roadster 88: Rapier rigid body, raycast suspension along the car's own down axis (so it works on the curl and the ceiling), slip-based tyres, AWD powertrain, ten gimballed nozzles with the control allocator, plus the suction fan (`CarSim.suction`) that pushes the car onto whatever surface it faces, scaled by attitude (0.35 g on the flat, 1.85 g upside down).
- `src/sim/flight.js` rate control for flips and spins in the air; flight assist damps the spin when you let go, rolls the wheels down before touchdown and turns Space into a soft-landing glide.
- `src/ramp.js` the Film14 ramp profile (quarter pipe R 12.5 m, curl R 12.5 m, 15 m ceiling at 25 m, lip at x = -15) and its collision from convex deck segments.
- `src/arena.js` the Film14 arena and its light show, driven by game events (ramp run, launch, landing).
- `src/lineup.js` the lineup site: hand-built lofted bodies (Model 3, Model Y, Semi, Cybercab) and a faceted Cybertruck merged per material, an event-lighting reflection map, contact shadows, the LED stage, smoke cannons, floodlight towers, power lines and the sodium-lamp road back to the arena, plus the collision boxes and car footprints used to score "Over the lineup". One spotlight moves to whichever site the camera is at, so the second site costs no extra light.
- `src/main.js` the L flight: a cubic path that lifts off from the car or Jurek, swings around the curl, follows the lamp road with thinner fog, then descends behind the Roadster and blends into the live chase camera; the car is teleported at the halfway point, out of sight.
- `src/tricks.js` jump detection and scoring, `src/replay.js` 60 Hz recorder with a TV director and a free camera, `src/online.js` three Firebase leaderboards.
- `src/avatar/` Jurek on foot and seated (Roadster 88 driver, walker and get-in/out moves).

## Checks

`Niepotrzebne/tools/test.mjs` (headless Chrome, Metal) boots the game and drives a scripted input sequence: climb to the upside-down ceiling, hang 4 s, reverse down, full run, leave the lip, kickflip, land. `lineup.mjs` renders the lineup and flies a scripted jet ollie kickflip over it (speed-based takeoff, `REPLAY=1` saves the TV replay), `travel.mjs` saves both L flights frame by frame, `hitch.mjs` / `hitch2.mjs` log long frames (first jet firing), `perf_lineup.mjs` fps at both sites. `kbd.mjs` checks the real keyboard path, `mobile.mjs` the iPhone layout in WebKit, `perf2.mjs` the frame-time cost of features.

See `CREDITS.md` for assets.
