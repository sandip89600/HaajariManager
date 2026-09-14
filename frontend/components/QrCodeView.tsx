import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { generateQrMatrix } from "@/utils/qrCodeGenerator";

interface QrCodeViewProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  quietZoneModules?: number;
}

export const QrCodeView: React.FC<QrCodeViewProps> = ({
  value,
  size = 220,
  backgroundColor = "#FFFFFF",
  foregroundColor = "#0F172A",
  quietZoneModules = 2,
}) => {
  const matrix = useMemo(() => {
    try {
      if (!value) return [];
      return generateQrMatrix(value);
    } catch (e) {
      console.warn("QR code generation error:", e);
      return [];
    }
  }, [value]);

  if (!matrix.length) {
    return <View style={[{ width: size, height: size, backgroundColor }]} />;
  }

  const moduleCount = matrix.length + quietZoneModules * 2;
  const cellSize = size / moduleCount;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor,
          padding: quietZoneModules * cellSize,
        },
      ]}
    >
      {matrix.map((row, rIdx) => (
        <View key={`r-${rIdx}`} style={[styles.row, { height: cellSize }]}>
          {row.map((isDark, cIdx) => (
            <View
              key={`c-${cIdx}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: isDark ? foregroundColor : backgroundColor,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 12,
  },
  row: {
    flexDirection: "row",
  },
});
