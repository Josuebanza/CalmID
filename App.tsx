import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  LogBox,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Speech from "expo-speech";
import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react-native";

import Presage from "./modules/presage/src/PresageModule";

type Mode = "idle" | "framing" | "scanning" | "recovery";
type BreathPhase = "INHALE" | "HOLD" | "EXHALE";
type SessionKind = "scan" | "meditation";
type VoiceMode = "local" | "elevenlabs";
type TtsLanguage = "fr" | "en";

const STATUS_TOP =
  Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 0;

const BOTTOM_SAFE = Platform.OS === "android" ? 58 : 22;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// LiveKit can emit this while a WebRTC room is intentionally closing.
// In a development build React Native promotes console errors to a red LogBox.
// Keep other errors visible; ignore only this known disconnect message.
LogBox.ignoreLogs([
  "error reading from signal stream",
]);

function TechButton({
  title,
  subtitle,
  onPress,
  disabled = false,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.8,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.35,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );

    if (!disabled) {
      loop.start();
    }

    return () => loop.stop();
  }, [disabled, glow]);

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 25,
      bounciness: 4,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 4,
    }).start();
  };

  const wrapperStyle = compact
    ? styles.techButtonWrapCompact
    : undefined;

  const buttonStyle = compact
    ? styles.techButtonCompact
    : undefined;

  return (
    <Animated.View
      style={[
        styles.techButtonWrap,
        wrapperStyle,
        {
          transform: [{ scale }],
          opacity: disabled ? 0.42 : 1,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.techButtonGlow,
          { opacity: glow },
        ]}
      />
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.techButton, buttonStyle]}
      >
        <Text style={styles.techButtonTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.techButtonSubtitle}>{subtitle}</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function App() {
  return (
    <ConversationProvider>
      <CalmIDApp />
    </ConversationProvider>
  );
}

function CalmIDApp() {
  const [mode, setMode] = useState<Mode>("idle");
  const [sessionKind, setSessionKind] =
    useState<SessionKind>("scan");
  const [voiceMode, setVoiceMode] =
    useState<VoiceMode>("local");
  const [ttsLanguage, setTtsLanguage] =
    useState<TtsLanguage>("fr");

  const [pulse, setPulse] = useState<number | null>(null);
  const [breathing, setBreathing] = useState<number | null>(null);

  const [validationCode, setValidationCode] = useState<string | null>(null);
  const [validationHint, setValidationHint] = useState<string>(
    "Stay still and face the camera."
  );

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);

  const [mirrorReady, setMirrorReady] = useState(false);
  const [mirrorShotUri, setMirrorShotUri] = useState<string | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [breathPhase, setBreathPhase] =
    useState<BreathPhase>("INHALE");
  const [breathRemaining, setBreathRemaining] = useState(4);

  const breathingScale = useRef(new Animated.Value(1)).current;
  const breathingOpacity = useRef(new Animated.Value(0.7)).current;
  const scanLine = useRef(new Animated.Value(0)).current;
  const guidePulse = useRef(new Animated.Value(0.6)).current;

  const [voiceError, setVoiceError] = useState<string | null>(null);

  const conversation = useConversation({
    overrides: {
      agent: {
        language: ttsLanguage === "fr" ? "fr" : "en",
        firstMessage:
          ttsLanguage === "fr"
            ? "Bonjour. Laisse tes pensées passer et concentre-toi sur ta respiration. Je vais te guider."
            : "Hi. Let your thoughts pass and focus on your breathing. I will guide you.",
      },
    },
    onConnect: () => {
      console.log("ElevenLabs connected");
      setVoiceError(null);
      setVoiceMode("elevenlabs");
      Speech.stop();
    },
    onDisconnect: () => {
      console.log("ElevenLabs disconnected");
      setVoiceMode("local");
    },
    onError: (error) => {
      // Keep cloud voice optional during the hackathon demo.
      // A failed live-agent connection should never break meditation.
      console.log("ElevenLabs error:", error);
      setVoiceError(String(error));
      setVoiceMode("local");
    },
    onMessage: (message) => {
      console.log("ElevenLabs message:", message);
    },
  });

  // --------------------------------------------------
  // SUBTLE TECH ANIMATIONS
  // --------------------------------------------------

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(guidePulse, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(guidePulse, {
          toValue: 0.6,
          duration: 1300,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [guidePulse]);

  useEffect(() => {
    if (mode !== "scanning") {
      scanLine.stopAnimation();
      scanLine.setValue(0);
      return;
    }

    const lineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 3200,
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 3200,
          useNativeDriver: true,
        }),
      ])
    );

    lineLoop.start();

    return () => lineLoop.stop();
  }, [mode, scanLine]);

  // --------------------------------------------------
  // TIMER
  // --------------------------------------------------

  useEffect(() => {
    if (mode !== "scanning" || scanStartedAt === null) {
      return;
    }

    const update = () => {
      setElapsedSeconds(
        Math.floor((Date.now() - scanStartedAt) / 1000)
      );
    };

    update();
    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [mode, scanStartedAt]);

  // --------------------------------------------------
  // PRESAGE METRICS + REAL VALIDATION HINTS
  // --------------------------------------------------

  useEffect(() => {
    if (mode !== "scanning") {
      return;
    }

    const interval = setInterval(() => {
      try {
        const vitals = Presage.getVitals();

        console.log("Presage vitals:", vitals);

        if (vitals.pulse !== null) {
          setPulse(Math.round(vitals.pulse));
        }

        if (vitals.breathingRate !== null) {
          setBreathing(Math.round(vitals.breathingRate));
        }

        if (vitals.validationCode) {
          setValidationCode(vitals.validationCode);
        }

        if (vitals.validationHint) {
          setValidationHint(vitals.validationHint);
        }
      } catch (error) {
        console.error("Vitals error:", error);
      }
    }, 750);

    return () => clearInterval(interval);
  }, [mode]);

  // --------------------------------------------------
  // CAMERA HANDOFF:
  // Expo Camera unmounts first, then Presage owns camera
  // --------------------------------------------------

  useEffect(() => {
    if (mode !== "scanning") {
      return;
    }

    let cancelled = false;

    const waitForIdle = async () => {
      for (let i = 0; i < 28; i++) {
        if (cancelled) {
          return false;
        }

        const status = Presage.getStatus();

        if (
          status === "IDLE" ||
          status === "ERROR" ||
          status === "UNKNOWN"
        ) {
          return true;
        }

        await sleep(250);
      }

      return false;
    };

    const startPresage = async () => {
      try {
        // Gives Expo Camera enough time to fully release the lens.
        await sleep(900);

        if (cancelled) {
          return;
        }

        const apiKey =
          process.env.EXPO_PUBLIC_PRESAGE_API_KEY;

        if (!apiKey) {
          alert("Presage API key is missing.");
          return;
        }

        Presage.configure(apiKey);

        let status = Presage.getStatus();

        console.log(
          "Presage status before camera session:",
          status
        );

        if (status === "RUNNING" || status === "STARTING") {
          try {
            await Presage.stop();
          } catch (error) {
            console.log("Presage cleanup stop:", error);
          }
        }

        status = Presage.getStatus();

        if (
          status === "RUNNING" ||
          status === "STARTING" ||
          status === "STOPPING"
        ) {
          const idle = await waitForIdle();

          if (!idle || cancelled) {
            console.log("Presage did not return to IDLE");
            return;
          }
        }

        if (cancelled) {
          return;
        }

        console.log(
          "Presage status before new start:",
          Presage.getStatus()
        );

        await Presage.start();

        console.log("Presage camera session started");
        console.log(
          "Presage status after start:",
          Presage.getStatus()
        );
      } catch (error) {
        console.error("Presage start error:", error);
        alert(`Presage error: ${String(error)}`);
      }
    };

    startPresage();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  // --------------------------------------------------
  // BREATHING PHASE CLOCK: 4 / 1 / 6
  // --------------------------------------------------

  useEffect(() => {
    if (mode !== "recovery") {
      return;
    }

    const startedAt = Date.now();
    const cycleMs = 11000;

    const updatePhase = () => {
      const t = (Date.now() - startedAt) % cycleMs;

      if (t < 4000) {
        setBreathPhase("INHALE");
        setBreathRemaining(Math.max(1, Math.ceil((4000 - t) / 1000)));
      } else if (t < 5000) {
        setBreathPhase("HOLD");
        setBreathRemaining(1);
      } else {
        setBreathPhase("EXHALE");
        setBreathRemaining(Math.max(1, Math.ceil((11000 - t) / 1000)));
      }
    };

    updatePhase();
    const interval = setInterval(updatePhase, 150);

    return () => clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    if (mode !== "recovery") {
      breathingScale.stopAnimation();
      breathingScale.setValue(1);
      breathingOpacity.setValue(0.7);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathingScale, {
            toValue: 1.55,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(breathingOpacity, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1000),
        Animated.parallel([
          Animated.timing(breathingScale, {
            toValue: 1,
            duration: 6000,
            useNativeDriver: true,
          }),
          Animated.timing(breathingOpacity, {
            toValue: 0.7,
            duration: 6000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [mode, breathingScale, breathingOpacity]);

  // --------------------------------------------------
  // LOCAL TTS FALLBACK
  // --------------------------------------------------

  useEffect(() => {
    if (mode !== "recovery" || voiceMode !== "local") {
      return;
    }

    const frenchMessage =
      breathPhase === "INHALE"
        ? "Inspire doucement."
        : breathPhase === "HOLD"
        ? "Garde doucement."
        : "Expire lentement.";

    const englishMessage =
      breathPhase === "INHALE"
        ? "Breathe in slowly."
        : breathPhase === "HOLD"
        ? "Hold gently."
        : "Breathe out slowly.";

    const message =
      ttsLanguage === "fr"
        ? frenchMessage
        : englishMessage;

    // Local TTS remains fully offline and independent from ElevenLabs.
    Speech.stop();
    Speech.speak(message, {
      language:
        ttsLanguage === "fr"
          ? "fr-FR"
          : "en-US",
      rate: 0.76,
      pitch: 0.96,
    });
  }, [mode, breathPhase, voiceMode, ttsLanguage]);

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  };

  const getValidationText = () => {
    switch (validationCode) {
      case "OK":
        return "Good framing • hold still";
      case "CHEST_NOT_VISIBLE":
        return "Step back • include your upper chest";
      case "FACE_NOT_CENTERED":
        return "Center your face";
      case "FACE_TOO_LOW":
        return "Move slightly up";
      case "FACE_TOO_HIGH":
        return "Move slightly down";
      case "FACE_NOT_FORWARD":
        return "Face the camera";
      case "FACE_TOO_CLOSE":
        return "Move a little farther away";
      case "FACE_TOO_FAR":
        return "Move a little closer";
      case "EXCESSIVE_MOTION":
        return "Hold still • motion affects accuracy";
      case "MULTIPLE_FACES_FOUND":
        return "Only one person should be visible";
      case "TOO_DARK":
        return "Move toward better lighting";
      case "TOO_BRIGHT":
        return "Reduce direct light";
      default:
        return validationHint || "Stay still and face the camera";
    }
  };

  const isValidationGood =
    !validationCode || validationCode === "OK";

  const getVoiceLabel = () => {
    if (voiceMode === "local") {
      return ttsLanguage === "fr"
        ? "Guide local • Français"
        : "Local guide • English";
    }

    if (conversation.status === "connecting") {
      return "Connecting live coach...";
    }

    if (conversation.status === "connected") {
      if (conversation.isSpeaking) {
        return "Live coach is speaking";
      }

      if (conversation.isListening) {
        return "Live coach is listening";
      }

      return "Live coach connected";
    }

    if (voiceError) {
      return "Live coach unavailable • local guide active";
    }

    return "Local TTS breathing guide";
  };

  const changeGuidanceLanguage = async (
    nextLanguage: TtsLanguage
  ) => {
    if (nextLanguage === ttsLanguage) {
      return;
    }

    Speech.stop();

    try {
      if (
        conversation.status === "connected" ||
        conversation.status === "connecting"
      ) {
        await conversation.endSession();
      }
    } catch (error) {
      // Some LiveKit builds report a ConnectionError while the room is
      // already closing. The next session can still start normally.
      console.log("Voice language switch disconnect:", error);
    }

    setVoiceError(null);
    setVoiceMode("local");
    setTtsLanguage(nextLanguage);
  };

  // --------------------------------------------------
  // OPEN LIVE MIRROR
  // --------------------------------------------------

  const openMirror = async () => {
    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();

        if (!permission.granted) {
          alert("Camera permission is required.");
          return;
        }
      }

      setMirrorReady(false);
      setMirrorShotUri(null);
      setPulse(null);
      setBreathing(null);
      setValidationCode(null);
      setValidationHint("Stay still and face the camera.");
      setMode("framing");
    } catch (error) {
      console.error("Mirror camera error:", error);
      alert(`Camera error: ${String(error)}`);
    }
  };

  // --------------------------------------------------
  // FREEZE MIRROR + HAND CAMERA TO PRESAGE
  // --------------------------------------------------

  const beginAnalysis = async () => {
    try {
      let uri: string | null = null;

      if (cameraRef.current && mirrorReady) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.45,
            skipProcessing: false,
          });

          uri = photo?.uri ?? null;
        } catch (error) {
          console.log("Mirror snapshot skipped:", error);
        }
      }

      setMirrorShotUri(uri);
      setElapsedSeconds(0);
      setScanStartedAt(Date.now());

      // Unmounts CameraView immediately.
      setMode("scanning");
    } catch (error) {
      console.error("Begin analysis error:", error);
      setMode("scanning");
    }
  };

  // --------------------------------------------------
  // ELEVENLABS
  // --------------------------------------------------

  const startVoiceCoach = async () => {
    const agentId =
      process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID;

    setVoiceMode("elevenlabs");

    if (!agentId) {
      setVoiceError("Missing ElevenLabs Agent ID");
      setVoiceMode("local");
      return;
    }

    if (
      conversation.status === "connected" ||
      conversation.status === "connecting"
    ) {
      return;
    }

    try {
      setVoiceError(null);
      Speech.stop();

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone permission",
          message:
            "CalmID needs microphone access for the breathing coach.",
          buttonPositive: "Allow",
          buttonNegative: "Cancel",
        }
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setVoiceError("Microphone permission denied");
        return;
      }

      console.log("Starting ElevenLabs agent:", agentId);

      await conversation.startSession({
        agentId,
      });

      // Do not depend on the return value. The reactive status + callbacks
      // tell us whether the session actually connected.
      console.log("ElevenLabs startSession resolved");
    } catch (error) {
      console.log("ElevenLabs start error:", error);
      setVoiceError(String(error));
      setVoiceMode("local");
    }
  };

  // --------------------------------------------------
  // START CALM SESSION
  // --------------------------------------------------

  const startRecovery = async () => {
    try {
      const status = Presage.getStatus();

      console.log("Presage status before recovery:", status);

      if (status === "STARTING" || status === "STOPPING") {
        alert("Measurement is still transitioning. Try again in a moment.");
        return;
      }

      if (status === "RUNNING") {
        await Presage.stop();
      }
    } catch (error) {
      console.log("Presage stop before recovery:", error);
    }

    // Scan path keeps the captured biometrics.
    setSessionKind("scan");
    setVoiceMode("local");
    setMode("recovery");
  };

  const startMeditation = async () => {
    // Meditation-only path deliberately has no biometric claims.
    setSessionKind("meditation");
    setPulse(null);
    setBreathing(null);
    setVoiceMode("local");
    setVoiceError(null);
    setMode("recovery");
  };

  // --------------------------------------------------
  // RESET
  // --------------------------------------------------

  const reset = async () => {
    Speech.stop();

    try {
      if (conversation.status !== "disconnected") {
        await conversation.endSession();
      }
    } catch (error) {
      console.log("ElevenLabs end session:", error);
    }

    try {
      const status = Presage.getStatus();

      if (status === "RUNNING") {
        await Presage.stop();
      }
    } catch (error) {
      console.log("Presage stop:", error);
    }

    setMode("idle");
    setSessionKind("scan");
    setVoiceMode("local");
    setPulse(null);
    setBreathing(null);
    setValidationCode(null);
    setValidationHint("Stay still and face the camera.");
    setElapsedSeconds(0);
    setScanStartedAt(null);
    setMirrorShotUri(null);
    setVoiceError(null);
  };

  const familiarVoiceDemo = () => {
    alert(
      "Familiar Voice is a prototype. A future version can let the user add a trusted person's voice with that person's consent."
    );
  };

  // --------------------------------------------------
  // IDLE
  // --------------------------------------------------

  if (mode === "idle") {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />

        <View style={styles.idleHeader}>
          <View>
            <Text style={styles.brand}>CalmID</Text>
            <Text style={styles.brandSub}>
              Adaptive biometric wellness
            </Text>
          </View>

          <Animated.View
            style={[
              styles.onlineDot,
              {
                opacity: guidePulse,
              },
            ]}
          />
        </View>

        <View style={styles.idleCenter}>
          <Animated.View
            style={[
              styles.idleOrbOuter,
              {
                opacity: guidePulse,
                transform: [
                  {
                    scale: guidePulse.interpolate({
                      inputRange: [0.6, 1],
                      outputRange: [0.96, 1.06],
                    }),
                  },
                ],
              },
            ]}
          />

          <View style={styles.idleOrb}>
            <Text style={styles.idleOrbMark}>◉</Text>
          </View>

          <Text style={styles.idleTitle}>
            Understand your body.
          </Text>

          <Text style={styles.idleDescription}>
            Frame yourself, let CalmID read your signals, then follow a
            guided breathing session.
          </Text>

          <TechButton
            title="Start scan"
            subtitle="Mirror → Presage → guided recovery"
            onPress={openMirror}
          />

          <TouchableOpacity
            onPress={startMeditation}
            activeOpacity={0.85}
            style={styles.meditationOnlyButton}
          >
            <Text style={styles.meditationOnlyTitle}>
              Just breathe
            </Text>
            <Text style={styles.meditationOnlySub}>
              Meditation only • no scan • no biometrics
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Wellness demonstration — not a medical diagnostic tool.
          </Text>
        </View>
      </View>
    );
  }

  // --------------------------------------------------
  // LIVE FRONT MIRROR — VIDEO CALL STYLE
  // --------------------------------------------------

  if (mode === "framing") {
    return (
      <View style={styles.fullScreen}>
        <StatusBar barStyle="light-content" translucent />

        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mirror
          onCameraReady={() => setMirrorReady(true)}
          onMountError={(event) => {
            console.error(
              "Expo Camera mount error:",
              event.nativeEvent?.message
            );
          }}
        />

        <View style={styles.cameraShade} />

        <View style={styles.callTopBar}>
          <View>
            <Text style={styles.callBrand}>CalmID</Text>
            <Text style={styles.callMode}>FRAMING MIRROR</Text>
          </View>

          <View style={styles.livePill}>
            <Animated.View
              style={[
                styles.liveDot,
                {
                  opacity: guidePulse,
                },
              ]}
            />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View pointerEvents="none" style={styles.bodyGuideWrap}>
          <Animated.View
            style={[
              styles.bodyGuideHead,
              {
                opacity: guidePulse,
              },
            ]}
          />
          <View style={styles.bodyGuideShoulders} />

          <Text style={styles.bodyGuideText}>
            Face + shoulders + upper chest
          </Text>
        </View>

        <View style={styles.callBottomDock}>
          <View style={styles.mirrorTipsRow}>
            <View style={styles.tipChip}>
              <Text style={styles.tipChipText}>Face camera</Text>
            </View>
            <View style={styles.tipChip}>
              <Text style={styles.tipChipText}>Shoulders visible</Text>
            </View>
            <View style={styles.tipChip}>
              <Text style={styles.tipChipText}>Good light</Text>
            </View>
          </View>

          <Text style={styles.mirrorHelp}>
            Hold the phone naturally. Face, shoulders and some upper chest
            are enough for the framing guide. Presage gives live corrections next.
          </Text>

          <TechButton
            title={mirrorReady ? "Start analysis" : "Starting camera..."}
            subtitle="Hold still for about 30 seconds"
            onPress={beginAnalysis}
            disabled={!mirrorReady}
            compact
          />
        </View>
      </View>
    );
  }

  // --------------------------------------------------
  // SCANNING — SNAPSHOT/WATERMARK + LIVE PRESAGE DATA
  // --------------------------------------------------

  if (mode === "scanning") {
    return (
      <View style={styles.fullScreen}>
        <StatusBar barStyle="light-content" translucent />

        <ImageBackground
          source={mirrorShotUri ? { uri: mirrorShotUri } : undefined}
          style={styles.analysisBackdrop}
          imageStyle={styles.analysisImage}
        >
          <View style={styles.analysisShade} />

          <View style={styles.callTopBar}>
            <View>
              <Text style={styles.callBrand}>CalmID</Text>
              <Text style={styles.callMode}>LIVE ANALYSIS</Text>
            </View>

            <View
              style={[
                styles.validationPill,
                !isValidationGood && styles.validationPillWarning,
              ]}
            >
              <Animated.View
                style={[
                  styles.liveDot,
                  !isValidationGood && styles.warningDot,
                  {
                    opacity: guidePulse,
                  },
                ]}
              />
              <Text style={styles.validationPillText}>
                {isValidationGood ? "SIGNAL OK" : "ADJUST"}
              </Text>
            </View>
          </View>

          <View style={styles.timerGlass}>
            <Text style={styles.timerBig}>
              {formatTime(elapsedSeconds)}
            </Text>
            <Text style={styles.timerSmall}>
              {elapsedSeconds < 12
                ? "Calibrating pulse"
                : elapsedSeconds < 30
                ? "Reading breathing"
                : "Measurement window ready"}
            </Text>
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.scanLine,
              {
                transform: [
                  {
                    translateY: scanLine.interpolate({
                      inputRange: [0, 1],
                      outputRange: [145, 540],
                    }),
                  },
                ],
              },
            ]}
          />

          <View style={styles.metricsGlassRow}>
            <View style={styles.metricGlass}>
              <Text style={styles.metricGlassLabel}>PULSE</Text>
              <Text style={styles.metricGlassValue}>
                {pulse ?? "--"}
                <Text style={styles.metricGlassUnit}> BPM</Text>
              </Text>
            </View>

            <View style={styles.metricGlass}>
              <Text style={styles.metricGlassLabel}>BREATHING</Text>
              <Text style={styles.metricGlassValue}>
                {breathing ?? "--"}
                <Text style={styles.metricGlassUnit}> /MIN</Text>
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.guidanceGlass,
              !isValidationGood && styles.guidanceGlassWarning,
            ]}
          >
            <Text style={styles.guidanceEyebrow}>
              PRESAGE LIVE GUIDANCE
            </Text>

            <Text style={styles.guidanceMain}>
              {getValidationText()}
            </Text>

            <Text style={styles.guidanceRaw}>
              {validationCode
                ? validationCode.replaceAll("_", " ")
                : "Acquiring framing feedback"}
            </Text>
          </View>

          <View style={styles.analysisBottomDock}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      100,
                      (elapsedSeconds / 30) * 100
                    )}%`,
                  },
                ]}
              />
            </View>

            <TechButton
              title={
                elapsedSeconds < 30
                  ? `Calm session in ${30 - elapsedSeconds}s`
                  : "Start calm session"
              }
              subtitle={
                elapsedSeconds < 30
                  ? "Keep still while the signal settles"
                  : "Voice-guided 4 • 1 • 6 breathing"
              }
              onPress={startRecovery}
              disabled={elapsedSeconds < 30}
              compact
            />
          </View>
        </ImageBackground>
      </View>
    );
  }

  // --------------------------------------------------
  // RECOVERY — NO SCROLL, BREATH PHASE + VOICE FALLBACK
  // --------------------------------------------------

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={styles.recoveryScreen}>
        <View style={styles.recoveryTop}>
          <View>
            <Text style={styles.recoveryEyebrow}>
              GUIDED RECOVERY
            </Text>
            <Text style={styles.recoveryTitle}>
              Follow the rhythm
            </Text>
          </View>

          <View
            style={[
              styles.voiceMiniPill,
              (voiceMode === "local" ||
                conversation.status === "connected") &&
                styles.voiceMiniPillConnected,
            ]}
          >
            <View
              style={[
                styles.voiceMiniDot,
                (voiceMode === "local" ||
                  conversation.status === "connected") &&
                  styles.voiceMiniDotConnected,
              ]}
            />
            <Text style={styles.voiceMiniText}>
              {getVoiceLabel()}
            </Text>
          </View>
        </View>

        <View style={styles.ttsLanguageBar}>
            <Text style={styles.ttsLanguageLabel}>
              GUIDE LANGUAGE
            </Text>

            <View style={styles.ttsLanguageSwitch}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  void changeGuidanceLanguage("fr");
                }}
                style={[
                  styles.ttsLanguageOption,
                  ttsLanguage === "fr" &&
                    styles.ttsLanguageOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.ttsLanguageOptionText,
                    ttsLanguage === "fr" &&
                      styles.ttsLanguageOptionTextActive,
                  ]}
                >
                  FR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  void changeGuidanceLanguage("en");
                }}
                style={[
                  styles.ttsLanguageOption,
                  ttsLanguage === "en" &&
                    styles.ttsLanguageOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.ttsLanguageOptionText,
                    ttsLanguage === "en" &&
                      styles.ttsLanguageOptionTextActive,
                  ]}
                >
                  EN
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        <View style={styles.recoveryCenter}>
          <View style={styles.breathingHalo}>
            <Animated.View
              style={[
                styles.breathingAuraOuter,
                {
                  transform: [
                    {
                      scale: breathingScale.interpolate({
                        inputRange: [1, 1.55],
                        outputRange: [0.94, 1.18],
                      }),
                    },
                  ],
                  opacity: breathingOpacity.interpolate({
                    inputRange: [0.7, 1],
                    outputRange: [0.18, 0.42],
                  }),
                },
              ]}
            />

            <Animated.View
              style={[
                styles.breathingAuraMiddle,
                {
                  transform: [
                    {
                      scale: breathingScale.interpolate({
                        inputRange: [1, 1.55],
                        outputRange: [0.96, 1.24],
                      }),
                    },
                  ],
                  opacity: breathingOpacity.interpolate({
                    inputRange: [0.7, 1],
                    outputRange: [0.24, 0.55],
                  }),
                },
              ]}
            />

            <Animated.View
              style={[
                styles.breathingAuraInner,
                {
                  transform: [
                    {
                      scale: breathingScale.interpolate({
                        inputRange: [1, 1.55],
                        outputRange: [0.98, 1.30],
                      }),
                    },
                  ],
                  opacity: breathingOpacity.interpolate({
                    inputRange: [0.7, 1],
                    outputRange: [0.38, 0.72],
                  }),
                },
              ]}
            />

            <Animated.View
              style={[
                styles.breathingOrb,
                {
                  transform: [
                    {
                      scale: breathingScale.interpolate({
                        inputRange: [1, 1.55],
                        outputRange: [1, 1.38],
                      }),
                    },
                  ],
                  opacity: breathingOpacity,
                },
              ]}
            />

            <View style={styles.breathingCore}>
              <Text style={styles.breathPhase}>
                {ttsLanguage === "fr"
                  ? breathPhase === "INHALE"
                    ? "INSPIRE"
                    : breathPhase === "HOLD"
                    ? "PAUSE"
                    : "EXPIRE"
                  : breathPhase}
              </Text>
              <Text style={styles.breathCount}>
                {breathRemaining}
              </Text>
              <Text style={styles.breathCue}>
                {ttsLanguage === "fr"
                  ? breathPhase === "INHALE"
                    ? "inspire doucement"
                    : breathPhase === "HOLD"
                    ? "reste détendu"
                    : "expire lentement"
                  : breathPhase === "INHALE"
                  ? "slowly breathe in"
                  : breathPhase === "HOLD"
                  ? "stay soft"
                  : "let the air out"}
              </Text>
            </View>
          </View>

          <Text style={styles.mindfulnessText}>
            {ttsLanguage === "fr"
              ? "Laisse les pensées passer.\nConcentre-toi seulement sur ta respiration."
              : "Let thoughts pass.\nFocus only on the air moving in and out."}
          </Text>
        </View>

        <View style={styles.recoveryBottom}>
          {sessionKind === "scan" ? (
            <View style={styles.recoveryStats}>
              <View>
                <Text style={styles.recoveryStatLabel}>BEFORE</Text>
                <Text style={styles.recoveryStatValue}>
                  {pulse ?? "--"} BPM
                </Text>
              </View>

              <View style={styles.rhythmDivider} />

              <View>
                <Text style={styles.recoveryStatLabel}>BREATHING</Text>
                <Text style={styles.recoveryStatValue}>
                  {breathing ?? "--"} /MIN
                </Text>
              </View>

              <View style={styles.rhythmDivider} />

              <View>
                <Text style={styles.recoveryStatLabel}>RHYTHM</Text>
                <Text style={styles.recoveryStatValue}>
                  4 • 1 • 6
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.recoveryStatsMeditation}>
              <View>
                <Text style={styles.recoveryStatLabel}>MODE</Text>
                <Text style={styles.recoveryStatValue}>MEDITATION</Text>
              </View>

              <View style={styles.rhythmDivider} />

              <View>
                <Text style={styles.recoveryStatLabel}>RHYTHM</Text>
                <Text style={styles.recoveryStatValue}>4 • 1 • 6</Text>
              </View>

              <View style={styles.rhythmDivider} />

              <View>
                <Text style={styles.recoveryStatLabel}>GUIDE</Text>
                <Text style={styles.recoveryStatValueSmall}>
                  {ttsLanguage === "fr" ? "TTS FR" : "TTS EN"}
                </Text>
              </View>
            </View>
          )}

          {voiceMode === "elevenlabs" &&
          conversation.status === "disconnected" ? (
            <TouchableOpacity
              onPress={startVoiceCoach}
              style={styles.retryVoice}
            >
              <Text style={styles.retryVoiceText}>
                Retry ElevenLabs voice
              </Text>
            </TouchableOpacity>
          ) : null}

          {voiceMode === "local" ? (
            <TouchableOpacity
              onPress={startVoiceCoach}
              style={styles.liveCoachOptional}
            >
              <Text style={styles.liveCoachOptionalTitle}>
                Try ElevenLabs live coach
              </Text>
              <Text style={styles.liveCoachOptionalSub}>
                optional cloud voice • local guide keeps working if unavailable
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.bottomActionsRow}>
            <TouchableOpacity
              onPress={familiarVoiceDemo}
              style={styles.secondaryChip}
            >
              <Text style={styles.secondaryChipTitle}>
                + Familiar voice
              </Text>
              <Text style={styles.secondaryChipSub}>
                prototype
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={reset}
              style={styles.endButton}
            >
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06101e",
  },

  fullScreen: {
    flex: 1,
    backgroundColor: "#020710",
  },

  // IDLE

  idleHeader: {
    paddingHorizontal: 24,
    paddingTop: STATUS_TOP + 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },

  brandSub: {
    color: "#7f8ca2",
    fontSize: 12,
    marginTop: 3,
  },

  onlineDot: {
    width: 11,
    height: 11,
    borderRadius: 11,
    backgroundColor: "#66e4c3",
  },

  idleCenter: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  idleOrbOuter: {
    position: "absolute",
    top: "22%",
    width: 155,
    height: 155,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "#6f6cff",
  },

  idleOrb: {
    width: 112,
    height: 112,
    borderRadius: 60,
    backgroundColor: "#151d3a",
    borderWidth: 1,
    borderColor: "#4f5fd5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },

  idleOrbMark: {
    color: "#9aa6ff",
    fontSize: 44,
  },

  idleTitle: {
    color: "#ffffff",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
  },

  idleDescription: {
    color: "#a1adbf",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
    marginTop: 14,
    marginBottom: 28,
  },

  disclaimer: {
    color: "#53627a",
    fontSize: 10,
    textAlign: "center",
    marginTop: 17,
  },

  meditationOnlyButton: {
    width: "100%",
    maxWidth: 430,
    minHeight: 58,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2d3b58",
    backgroundColor: "#0d1728",
    alignItems: "center",
    justifyContent: "center",
  },

  meditationOnlyTitle: {
    color: "#dce4f2",
    fontSize: 14,
    fontWeight: "850",
  },

  meditationOnlySub: {
    color: "#728096",
    fontSize: 9,
    marginTop: 3,
  },

  // TECH BUTTON

  techButtonWrap: {
    width: "100%",
    maxWidth: 430,
    position: "relative",
  },

  techButtonWrapCompact: {
    maxWidth: undefined,
  },

  techButtonGlow: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 3,
    bottom: -4,
    borderRadius: 20,
    backgroundColor: "#5d5cff",
  },

  techButton: {
    minHeight: 68,
    borderRadius: 19,
    backgroundColor: "#655fff",
    borderWidth: 1,
    borderColor: "#8a86ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  techButtonCompact: {
    minHeight: 58,
    borderRadius: 18,
  },

  techButtonTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "850",
  },

  techButtonSubtitle: {
    color: "#d5d4ff",
    fontSize: 10,
    marginTop: 3,
  },

  // FRAMING / VIDEO CALL

  cameraShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 9, 18, 0.12)",
  },

  callTopBar: {
    position: "absolute",
    top: STATUS_TOP + 10,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  callBrand: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  callMode: {
    color: "#ccd5e8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginTop: 3,
  },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(6, 16, 30, 0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: "#61e8bd",
    marginRight: 7,
  },

  liveText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  bodyGuideWrap: {
    position: "absolute",
    top: "15%",
    left: "8%",
    right: "8%",
    height: "56%",
    alignItems: "center",
    justifyContent: "center",
  },

  bodyGuideHead: {
    width: 172,
    height: 220,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: "#a29fff",
  },

  bodyGuideShoulders: {
    width: 318,
    height: 142,
    borderTopLeftRadius: 159,
    borderTopRightRadius: 159,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: "rgba(162,159,255,0.72)",
    marginTop: 12,
  },

  bodyGuideText: {
    position: "absolute",
    bottom: 0,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(5,12,24,0.62)",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
  },

  callBottomDock: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: BOTTOM_SAFE,
    borderRadius: 26,
    padding: 14,
    backgroundColor: "rgba(6, 13, 25, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },

  mirrorTipsRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 8,
  },

  tipChip: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  tipChipText: {
    color: "#e2e8f4",
    fontSize: 9,
    fontWeight: "700",
  },

  mirrorHelp: {
    color: "#9eabba",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 10,
  },

  // SCANNING

  analysisBackdrop: {
    flex: 1,
    backgroundColor: "#081321",
  },

  analysisImage: {
    opacity: 0.64,
    resizeMode: "cover",
  },

  analysisShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 10, 19, 0.38)",
  },

  validationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(9, 31, 31, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(98,232,189,0.45)",
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 36,
  },

  validationPillWarning: {
    backgroundColor: "rgba(55, 30, 13, 0.78)",
    borderColor: "rgba(255,174,112,0.55)",
  },

  validationPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  warningDot: {
    backgroundColor: "#ffaf73",
  },

  timerGlass: {
    position: "absolute",
    top: 105,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(5, 12, 24, 0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  timerBig: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
  },

  timerSmall: {
    color: "#ccd4e1",
    fontSize: 10,
    marginTop: 1,
  },

  scanLine: {
    position: "absolute",
    left: 28,
    right: 28,
    top: 0,
    height: 1,
    backgroundColor: "#8a86ff",
    shadowColor: "#8a86ff",
    shadowOpacity: 1,
    shadowRadius: 10,
  },

  metricsGlassRow: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 180,
    flexDirection: "row",
    gap: 10,
  },

  metricGlass: {
    flex: 1,
    backgroundColor: "rgba(4, 12, 25, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  metricGlassLabel: {
    color: "#9da9bd",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  metricGlassValue: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 4,
  },

  metricGlassUnit: {
    color: "#9aa6b8",
    fontSize: 10,
    fontWeight: "700",
  },

  guidanceGlass: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 158,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 21,
    backgroundColor: "rgba(7, 20, 27, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(98,232,189,0.34)",
  },

  guidanceGlassWarning: {
    backgroundColor: "rgba(34, 21, 17, 0.82)",
    borderColor: "rgba(255,173,112,0.42)",
  },

  guidanceEyebrow: {
    color: "#8a86ff",
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "900",
  },

  guidanceMain: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "850",
    marginTop: 4,
  },

  guidanceRaw: {
    color: "#9ca8b8",
    fontSize: 9,
    marginTop: 3,
  },

  analysisBottomDock: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: BOTTOM_SAFE,
    borderRadius: 24,
    padding: 13,
    backgroundColor: "rgba(5, 12, 24, 0.89)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  progressTrack: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    marginBottom: 11,
  },

  progressFill: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "#7771ff",
  },

  // RECOVERY

  recoveryScreen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: STATUS_TOP + 10,
    paddingBottom: BOTTOM_SAFE + 12,
  },

  recoveryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  recoveryEyebrow: {
    color: "#817dff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.6,
  },

  recoveryTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 3,
  },

  voiceMiniPill: {
    maxWidth: 160,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: "#111b2c",
    borderWidth: 1,
    borderColor: "#253550",
  },

  voiceMiniPillConnected: {
    borderColor: "#2f705f",
  },

  voiceMiniDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: "#69758a",
    marginRight: 7,
  },

  voiceMiniDotConnected: {
    backgroundColor: "#66e4c3",
  },

  voiceMiniText: {
    color: "#c7d0dd",
    fontSize: 9,
    fontWeight: "700",
    flexShrink: 1,
  },

  ttsLanguageBar: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },

  ttsLanguageLabel: {
    color: "#68758b",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },

  ttsLanguageSwitch: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 2,
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#273653",
  },

  ttsLanguageOption: {
    minWidth: 36,
    height: 26,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  ttsLanguageOptionActive: {
    backgroundColor: "#655fff",
  },

  ttsLanguageOptionText: {
    color: "#7f8ca2",
    fontSize: 9,
    fontWeight: "900",
  },

  ttsLanguageOptionTextActive: {
    color: "#ffffff",
  },

  recoveryCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
  },

  breathingHalo: {
    width: 270,
    height: 270,
    alignItems: "center",
    justifyContent: "center",
  },

  breathingAuraOuter: {
    position: "absolute",
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: "rgba(59, 79, 246, 0.16)",
    borderWidth: 2,
    borderColor: "rgba(77, 206, 255, 0.30)",
  },

  breathingAuraMiddle: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(87, 72, 246, 0.20)",
    borderWidth: 2,
    borderColor: "rgba(137, 118, 255, 0.42)",
  },

  breathingAuraInner: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(57, 195, 255, 0.22)",
    borderWidth: 2,
    borderColor: "rgba(93, 222, 255, 0.56)",
  },

  breathingOrb: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "#625df5",
    borderWidth: 2,
    borderColor: "#8ca6ff",
    elevation: 12,
    shadowColor: "#54cfff",
    shadowOpacity: 0.9,
    shadowRadius: 24,
  },

  breathingCore: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
  },

  breathPhase: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },

  breathCount: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    marginTop: 2,
  },

  breathCue: {
    color: "#d6d4ff",
    fontSize: 9,
    marginTop: 1,
  },

  mindfulnessText: {
    color: "#98a4b7",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  recoveryBottom: {
    width: "100%",
    paddingBottom: 6,
  },

  recoveryStats: {
    minHeight: 67,
    borderRadius: 20,
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#1d2b42",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 9,
  },

  recoveryStatsMeditation: {
    minHeight: 67,
    borderRadius: 20,
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#1d2b42",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 9,
  },

  recoveryStatLabel: {
    color: "#68758b",
    fontSize: 8,
    fontWeight: "900",
  },

  recoveryStatValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "850",
    marginTop: 3,
  },

  recoveryStatValueSmall: {
    color: "#72e5c2",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },

  rhythmDivider: {
    width: 1,
    height: 29,
    backgroundColor: "#26364f",
  },

  retryVoice: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "#171931",
    borderWidth: 1,
    borderColor: "#3f4278",
    marginBottom: 8,
  },

  retryVoiceText: {
    color: "#aaa8ff",
    fontSize: 10,
    fontWeight: "800",
  },

  liveCoachOptional: {
    width: "100%",
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: "#111a2c",
    borderWidth: 1,
    borderColor: "#29395c",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  liveCoachOptionalTitle: {
    color: "#9f9cff",
    fontSize: 11,
    fontWeight: "850",
  },

  liveCoachOptionalSub: {
    color: "#66758b",
    fontSize: 8,
    marginTop: 2,
  },

  bottomActionsRow: {
    flexDirection: "row",
    gap: 9,
  },

  secondaryChip: {
    flex: 1,
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "#15172f",
    borderWidth: 1,
    borderColor: "#343864",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryChipTitle: {
    color: "#aaa8ff",
    fontSize: 11,
    fontWeight: "850",
  },

  secondaryChipSub: {
    color: "#666f83",
    fontSize: 8,
    marginTop: 1,
  },

  endButton: {
    width: 105,
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#2a3b55",
    backgroundColor: "#0a1423",
    alignItems: "center",
    justifyContent: "center",
  },

  endButtonText: {
    color: "#d2dae6",
    fontSize: 13,
    fontWeight: "850",
  },
});
