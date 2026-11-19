# CalmID — Pre-merge QA & Demo Plan

**Branch:** `feature/presage-live-camera-preview`  
**Stable release:** `main` / `v1.0.0-hackthehill` (do not modify until checks pass)  
**Target:** physical Pixel Android with development build, Expo SDK 57  
**Scope:** native Presage live preview + vitals, ElevenLabs-first voice, English default, local TTS fallback

## Before testing

1. `git status` — confirm clean working tree on the feature branch.
2. `git pull origin feature/presage-live-camera-preview`
3. `npx expo start --dev-client --clear`
4. Keep the development APK that already supports native `PresageCameraView` (rebuild only after Kotlin/native changes).
5. Use a stable Wi-Fi connection between PC and Pixel; allow camera and microphone permissions.
6. For better Presage measurements: steady phone, face adequately lit, minimal movement and at least ~30 seconds of scanning.
7. Record results as **PASS**, **FAIL**, or **NOT TESTED**. Never infer a result from the existence of code alone.

> Privacy: avoid showing API keys, personal conversations, or sensitive notifications in screenshots or video. Consent is required to show any other person's face or voice.

## Acceptance tests (run on actual Pixel)

| ID | Test / steps | Expected result | Status |
| --- | --- | --- | --- |
| A01 | Cold launch development app from closed state | Home visible; no red-screen error | NOT TESTED |
| A02 | Tap **Start scan** | Front-facing live mirror appears; camera permission request works | NOT TESTED |
| A03 | Tap **Start analysis** | Continuous *moving* native Presage preview — not black or frozen | PASS (observed screenshot on Pixel) |
| A04 | Scan in good lighting for 30+ seconds | SDK running, live guidance updates, pulse/breathing values shown when available | PASS (pulse ~78 BPM, breathing ~20/min observed) |
| A05 | Move slightly during scan, then stay still | Presage guidance changes, e.g. excessive motion then OK | PASS (observed) |
| A06 | Tap **Start calm session** | Camera and Presage stop; animated breathing screen opens; retained prior scan values show | NOT TESTED |
| A07 | On new recovery session, default language | **EN** selected; no local TTS until AI actually fails | NOT TESTED |
| A08 | Enter recovery with internet + microphone allowed | ElevenLabs automatically connects, introduces itself, asks how user feels; voice works both ways | NOT TESTED |
| A09 | Answer agent and ask for breathing | Agent responds meaningfully, orb continues 4-1-6 visually; no overlapping local TTS | NOT TESTED |
| A10 | Tap **End** | ElevenLabs mic session closes; local TTS stops; return home without red LogBox | NOT TESTED |
| A11 | Tap **Just Breathe** from home | No camera or biometrics; ElevenLabs auto-starts in English | NOT TESTED |
| A12 | Select **FR** in recovery | Existing session ends and new AI session uses French; no double audio | NOT TESTED |
| A13 | Select **EN** again | Agent reconnects in English; no stuck connecting state | NOT TESTED |
| A14 | Disable mic permission then start recovery | ElevenLabs fails appropriately; local TTS speaks breathing cues; app remains usable | NOT TESTED |
| A15 | Restore mic permission, tap retry | ElevenLabs can connect and local TTS stops | NOT TESTED |
| A16 | Repeat biometric scan and recovery **3 times** | No stuck camera, lingering audio session, frozen preview or app crash | NOT TESTED |
| A17 | Return to Android home, foreground app during an active session | No crash, stuck camera, background microphone misuse or overlapping sessions | NOT TESTED |
| A18 | Scan without a reliable signal | Missing values show `--`; no invented biometrics | NOT TESTED |
| A19 | Check Metro/Android logs after tests | No unhandled errors; expected SDK warnings documented separately | NOT TESTED |

**Known caution:** `FRAME_RATE_TOO_LOW` occurred intermittently previously and can affect the reliability of biometrics; do not assume an uninterrupted measurement stream. The UI may retain a last valid pulse/breathing value when a subsequent native poll returns null. **Do not present retained numbers as continuous real-time updates.**

**Known integration risk:** switching language while an ElevenLabs session is still connecting can race with disconnect/reconnect callbacks. A12–A13 and A17 are important gates for a clean demo.

## Quick environment commands

```powershell
git status
git pull origin feature/presage-live-camera-preview
npx expo-doctor
npx expo start --dev-client --clear
```

A changed `App.tsx` or README does **not** need a new EAS native build. A changed native module (`PresageModule.kt`, Android Gradle config, native packages) **does**.

For fallback testing, temporarily deny the **microphone permission** in Android Settings → Apps → CalmID → Permissions, then enter **Just Breathe**. Restore the permission afterward. Do not remove or publish credentials to force a failure.

## Go / no-go decision for merging

**GO** only after A01–A13 and A16 pass, A14–A15 behave safely, and the recording can be produced without visible errors. Address any reproducible A17–A19 failures. Re-test the core flows after the last code change. If a test fails, leave the PR in draft and record the exact steps, logs, and whether the app was freshly launched.

Do not merge solely because the native preview works; the latest ElevenLabs-first logic has not yet been confirmed on a physical device.

---

# Demo video — target about 2 minutes

Film **vertically** (real Android app), on a stable mount, in good lighting and with Do Not Disturb enabled. Before the final take, test whether Android screen recording captures **both** your microphone and ElevenLabs playback. If not, use a second device's camera/mic to record the Pixel and narrate separately. Avoid voice/video edits that misrepresent actual functionality.

| Approx. video time | What to show on screen | English narration / speaking prompt |
| --- | --- | --- |
| 0:00–0:12 | CalmID home and animated orb | “CalmID started from a personal moment: I helped someone close to me breathe through a panic episode over the phone.” |
| 0:12–0:25 | Tap **Start scan**, show live front-facing framing | “I built a React Native and Expo Android app that combines simple breathing support with optional camera-based wellness signals.” |
| 0:25–0:48 | Tap **Start analysis**, show the face moving and validation feedback; stay still for actual measurement | “During analysis, Presage processes the camera stream while a native CameraX preview stays visible. It gives positioning feedback and may report pulse and breathing rate when a reliable signal is available.” |
| 0:48–1:03 | Show actual numbers when present, then tap **Start calm session** after 30 s elapsed (edit montage to compress waiting without pretending the scan is faster) | “The hardest part was allowing Presage and the on-screen preview to work from the same camera session, using a Kotlin Expo module.” |
| 1:03–1:35 | Recovery orb + English voice connection | “The conversational guide uses ElevenLabs first. It introduces itself and asks how I'm feeling before suggesting an exercise.” |
| 1:35–1:50 | Reply to the agent: **“I've had a stressful day. Could you help me slow down?”** | Let the live agent respond naturally. Do not script or pre-claim what it will say. |
| 1:50–2:03 | Tap **End**; reopen via **Just Breathe** | “There’s also a meditation-only path — no scan, and no biometrics shown.” |
| 2:03–2:15 | Orb and final home or end screen | “CalmID is a wellness prototype, not a diagnostic or medical tool. The goal is a small, accessible moment of support.” |

## Alternate takes / plan B

- **ElevenLabs connection slow:** allow a short pause; do not claim it connected before the UI confirms. If it fails, demonstrate local TTS and describe it as a fallback. Record the English AI segment separately when the service is available, without editing it to simulate a single uninterrupted real-time connection.
- **Biometric value delayed:** show real-time video + validation, then use a later continuous segment with actual values; never fabricate numbers or hide failure conditions.
- **Privacy:** no real mental-health disclosures required. Use a simple simulated “stressful day” scenario.
- **No live recording audio:** record a separate spoken narration, mark actual agent audio clearly, and keep any captions truthful.

## After the tests

- Store the filled QA table / short notes on this branch.
- Keep the PR as draft until all merge gates pass.
- Then merge into `main`, create a new version/tag (not the old stable tag), and record the clean final demo.
