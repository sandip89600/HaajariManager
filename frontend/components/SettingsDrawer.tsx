import React from "react";
import { Modal, StyleSheet, View } from "react-native";
import SettingsScreen from "@/screens/SettingsScreen";

interface SettingsDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({
  visible,
  onClose,
}: SettingsDrawerProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <SettingsScreen isInDrawer={true} onClose={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
