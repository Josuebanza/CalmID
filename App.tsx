import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PermissionsAndroid,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Presage from "./modules/presage/src/PresageModule";

type Mode = "idle" | "scanning" | "recovery";

export default function App() {
  const [mode, setMode] = useState<Mode>("idle");

  const [pulse, setPulse] = useState(72);
  const [breathing, setBreathing] = useState(14);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);

  const breathingScale = useRef(new Animated.Value(1)).current;
  const breathingOpacity = useRef(new Animated.Value(0.65)).current;

  // Chrono du scan
  useEffect(() => {
    if (mode !== "scanning" || scanStartedAt === null) {
      return;
    }

    const updateTimer = () => {
      const seconds = Math.floor(
        (Date.now() - scanStartedAt) / 1000
      );

      setElapsedSeconds(seconds);
    };

    updateTimer();

    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [mode, scanStartedAt]);

  // Lecture des vraies métriques Presage
  useEffect(() => {
    if (mode !== "scanning") return;

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
      } catch (error) {
        console.error("Vitals error:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mode]);

  // Animation de respiration
  useEffect(() => {
    if (mode !== "recovery") {
      breathingScale.stopAnimation();
      breathingScale.setValue(1);
      breathingOpacity.setValue(0.65);
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
            toValue: 0.65,
            duration: 6000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [mode, breathingScale, breathingOpacity]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  };

  const getScanMessage = () => {
    if (elapsedSeconds < 12) {
      return "Calibrating pulse...";
    }

    if (elapsedSeconds < 30) {
      return "Pulse window ready • calibrating breathing...";
    }

    return "Measurement window ready";
  };

  const startScan = async () => {
    // Le chrono commence dès le clic
    setScanStartedAt(Date.now());
    setElapsedSeconds(0);

    try {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );

      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        setScanStartedAt(null);
        alert("Camera permission is required.");
        return;
      }

      const apiKey = process.env.EXPO_PUBLIC_PRESAGE_API_KEY;

      if (!apiKey) {
        setScanStartedAt(null);
        alert("Presage API key is missing.");
        return;
      }

      Presage.configure(apiKey);

      setPulse(0);
      setBreathing(0);
      setMode("scanning");

      const status = Presage.getStatus();

      console.log("Presage status before start:", status);

      if (status === "RUNNING" || status === "STARTING") {
        console.log("Presage is already running");
        return;
      }

      if (status === "STOPPING") {
        console.log("Presage is currently stopping");
        return;
      }

      await Presage.start();

      console.log("Presage started");
    } catch (error) {
      console.error("Presage error:", error);
      alert(`Presage error: ${String(error)}`);
    }
  };

  const startRecovery = async () => {
  try {
    const status = Presage.getStatus();

    console.log("Presage status before recovery:", status);

    if (status === "STARTING") {
      alert("Measurement is still starting. Please wait a few seconds.");
      return;
    }

    if (status === "STOPPING") {
      alert("Measurement is stopping. Please wait a moment.");
      return;
    }

    if (status === "RUNNING") {
      await Presage.stop();
    }

    setMode("recovery");
  } catch (error) {
    console.log("Presage stop before recovery:", error);
  }
};

  const reset = async () => {
    try {
      const status = Presage.getStatus();

      if (status === "RUNNING" || status === "STARTING") {
        await Presage.stop();
      }
    } catch (error) {
      console.log("Presage stop:", error);
    }

    setMode("idle");
    setPulse(72);
    setBreathing(14);

    setElapsedSeconds(0);
    setScanStartedAt(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>CalmID</Text>
            <Text style={styles.subtitle}>
              Adaptive biometric wellness
            </Text>
          </View>

          <View style={styles.statusDot} />
        </View>

        {mode === "idle" && (
          <View style={styles.center}>
            <View style={styles.heroOrb}>
              <Text style={styles.heroIcon}>◉</Text>
            </View>

            <Text style={styles.title}>
              Understand your body.
            </Text>

            <Text style={styles.description}>
              CalmID uses physiological signals to adapt a guided
              breathing experience to you.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={startScan}
            >
              <Text style={styles.primaryButtonText}>
                Start scan
              </Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Wellness demonstration — not a medical diagnostic tool.
            </Text>
          </View>
        )}

        {mode === "scanning" && (
          <>
            <View style={styles.scanHeader}>
              <Text style={styles.sectionLabel}>
                LIVE ANALYSIS
              </Text>

              <Text style={styles.scanTitle}>
                Reading your signals
              </Text>

              <Text style={styles.scanDescription}>
                Real-time physiological measurements.
              </Text>
            </View>

            <View style={styles.cameraPlaceholder}>
              <View style={styles.scanTimerContainer}>
                <Text style={styles.scanTimer}>
                  {formatTime(elapsedSeconds)}
                </Text>

                <Text style={styles.scanTimerHint}>
                  {getScanMessage()}
                </Text>
              </View>

              <View style={styles.faceGuide}>
                <Text style={styles.faceIcon}>☺</Text>
              </View>

              <View style={styles.scanningBadge}>
                <View style={styles.smallDot} />

                <Text style={styles.scanningText}>
                  SIGNAL ACTIVE
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>
                  PULSE
                </Text>

                <View style={styles.metricValueRow}>
                  <Text style={styles.metricValue}>
                    {pulse > 0 ? pulse : "--"}
                  </Text>

                  <Text style={styles.metricUnit}>
                    BPM
                  </Text>
                </View>

                <Text style={styles.metricStatus}>
                  {elapsedSeconds < 12
                    ? "calibrating..."
                    : pulse > 0
                    ? "signal captured"
                    : "waiting for signal"}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>
                  BREATHING
                </Text>

                <View style={styles.metricValueRow}>
                  <Text style={styles.metricValue}>
                    {breathing > 0 ? breathing : "--"}
                  </Text>

                  <Text style={styles.metricUnit}>
                    / MIN
                  </Text>
                </View>

                <Text style={styles.metricStatus}>
                  {elapsedSeconds < 30
                    ? "calibrating..."
                    : breathing > 0
                    ? "signal captured"
                    : "waiting for signal"}
                </Text>
              </View>
            </View>

            <View style={styles.insightCard}>
              <Text style={styles.insightLabel}>
                CALMID INSIGHT
              </Text>

              {elapsedSeconds < 30 ? (
                <>
                  <Text style={styles.insightTitle}>
                    Building a reliable reading.
                  </Text>

                  <Text style={styles.insightText}>
                    Stay still and keep your face and upper chest
                    visible while CalmID collects your signals.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.insightTitle}>
                    Measurement window complete.
                  </Text>

                  <Text style={styles.insightText}>
                    CalmID can now use the available signals to guide
                    your breathing session.
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={startRecovery}
            >
              <Text style={styles.primaryButtonText}>
                Start Calm Session
              </Text>
            </TouchableOpacity>
          </>
        )}

        {mode === "recovery" && (
          <View style={styles.center}>
            <Text style={styles.sectionLabel}>
              GUIDED RECOVERY
            </Text>

            <Text style={styles.title}>
              Follow the rhythm
            </Text>

            <View style={styles.breathingArea}>
              <Animated.View
                style={[
                  styles.breathingOrb,
                  {
                    transform: [
                      {
                        scale: breathingScale,
                      },
                    ],
                    opacity: breathingOpacity,
                  },
                ]}
              />

              <View style={styles.breathingTextContainer}>
                <Text style={styles.breathingText}>
                  BREATHE
                </Text>
              </View>
            </View>

            <Text style={styles.description}>
              Inhale slowly as the circle expands.
              {"\n"}
              Exhale as it contracts.
            </Text>

            <View style={styles.sessionStats}>
              <View>
                <Text style={styles.smallLabel}>
                  BEFORE
                </Text>

                <Text style={styles.statValue}>
                  {pulse > 0 ? pulse : "--"} BPM
                </Text>
              </View>

              <Text style={styles.arrow}>→</Text>

              <View>
                <Text style={styles.smallLabel}>
                  TARGET
                </Text>

                <Text style={styles.statValue}>
                  ~72 BPM
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={reset}
            >
              <Text style={styles.secondaryButtonText}>
                End session
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07101f",
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: "#07101f",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },

  brand: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    color: "#8492aa",
    fontSize: 12,
    marginTop: 3,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: "#72e5c2",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  heroOrb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141d3a",
    borderWidth: 1,
    borderColor: "#5365e9",
    marginBottom: 32,
  },

  heroIcon: {
    color: "#8c9cff",
    fontSize: 48,
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    maxWidth: 360,
  },

  description: {
    color: "#9da9bd",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 28,
    maxWidth: 370,
  },

  disclaimer: {
    color: "#59687f",
    fontSize: 11,
    textAlign: "center",
    marginTop: 18,
  },

  primaryButton: {
    backgroundColor: "#6b63ff",
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 28,
    width: "100%",
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  scanHeader: {
    marginBottom: 18,
  },

  sectionLabel: {
    color: "#7f8cff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textAlign: "center",
  },

  scanTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 6,
  },

  scanDescription: {
    color: "#8492aa",
    marginTop: 5,
  },

  cameraPlaceholder: {
    height: 230,
    backgroundColor: "#0d182b",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1e304b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  scanTimerContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    alignItems: "center",
  },

  scanTimer: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },

  scanTimerHint: {
    color: "#9da9bd",
    fontSize: 11,
    marginTop: 2,
    textAlign: "center",
  },

  faceGuide: {
    width: 120,
    height: 155,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#5e6fec",
    alignItems: "center",
    justifyContent: "center",
  },

  faceIcon: {
    color: "#6676e9",
    fontSize: 42,
  },

  scanningBadge: {
    position: "absolute",
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12263a",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },

  smallDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: "#72e5c2",
    marginRight: 7,
  },

  scanningText: {
    color: "#72e5c2",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },

  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#1d2940",
  },

  metricLabel: {
    color: "#7c899f",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 7,
  },

  metricValue: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
  },

  metricUnit: {
    color: "#7d8ca3",
    marginLeft: 5,
    fontSize: 11,
  },

  metricStatus: {
    color: "#ffad76",
    fontSize: 11,
    marginTop: 3,
  },

  insightCard: {
    backgroundColor: "#15172f",
    borderColor: "#323461",
    borderWidth: 1,
    borderRadius: 20,
    padding: 17,
    marginBottom: 16,
  },

  insightLabel: {
    color: "#8d8aff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  insightTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 7,
  },

  insightText: {
    color: "#949db3",
    lineHeight: 19,
    marginTop: 5,
    fontSize: 13,
  },

  breathingArea: {
    width: 260,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 32,
  },

  breathingOrb: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 70,
    backgroundColor: "#625df5",
  },

  breathingTextContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  breathingText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },

  sessionStats: {
    width: "100%",
    backgroundColor: "#101a2d",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  smallLabel: {
    color: "#69768d",
    fontSize: 10,
    fontWeight: "700",
  },

  statValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },

  arrow: {
    color: "#6573e7",
    fontSize: 24,
  },

  secondaryButton: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#273653",
  },

  secondaryButtonText: {
    color: "#9aa8bd",
    fontWeight: "700",
  },
});