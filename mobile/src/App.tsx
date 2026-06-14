import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { startPeripheral, sendButtonEvent } from "./ble/PeripheralService";
import { useKeepAwake } from "./hooks/useKeepAwake";
import { DEVICE_NAME } from "./ble/constants";

const BUTTON_IDS = Array.from({ length: 15 }, (_, i) => `btn_${i + 1}`);

function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the screen on while this screen is mounted so the GATT server stays alive.
  useKeepAwake(true);

  useEffect(() => {
    let mounted = true;

    startPeripheral()
      .then(() => {
        if (mounted) {
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(String(err));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handlePress = useCallback(async (buttonId: string) => {
    try {
      await sendButtonEvent({ button_id: buttonId, action: "press" });
    } catch (err) {
      Alert.alert("BLE error", String(err));
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Stream Deck Remote</Text>
        <Text style={styles.subtitle}>
          {error ? `Error: ${error}` : ready ? `Advertising as "${DEVICE_NAME}"` : "Starting BLE peripheral..."}
        </Text>
      </View>

      <View style={styles.grid}>
        {BUTTON_IDS.map((id) => (
          <TouchableOpacity
            key={id}
            style={styles.button}
            onPress={() => handlePress(id)}
            disabled={!ready}
          >
            <Text style={styles.buttonLabel}>{id.replace("btn_", "Button ")}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f10",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: "#e5e5e5",
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: "#a3a3a3",
    fontSize: 13,
    marginTop: 4,
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
  },
  button: {
    width: "33.3333%",
    aspectRatio: 1,
    padding: 6,
  },
  buttonLabel: {
    flex: 1,
    backgroundColor: "#262626",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#404040",
    color: "#e5e5e5",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default App;
