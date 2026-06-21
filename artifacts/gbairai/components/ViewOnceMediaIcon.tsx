import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  color: string;
  size?: number;
  opened?: boolean;
};

const DOT_LAYOUT = [
  { topRatio: 0.1, leftRatio: 0.92 },
  { topRatio: 0.28, leftRatio: 1.02 },
  { topRatio: 0.5, leftRatio: 1.08 },
  { topRatio: 0.72, leftRatio: 1.02 },
  { topRatio: 0.9, leftRatio: 0.92 },
] as const;

export function ViewOnceMediaIcon({ color, size = 26, opened = false }: Props) {
  const dotSize = Math.max(2.5, size * 0.1);

  return (
    <View style={[styles.wrap, { width: size + 10, height: size }]}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            borderStyle: opened ? "dashed" : "solid",
          },
        ]}
      >
        {opened ? (
          <Ionicons name="eye-off-outline" size={size * 0.46} color={color} />
        ) : (
          <Text style={[styles.number, { color, fontSize: size * 0.42 }]}>1</Text>
        )}
      </View>
      {!opened
        ? DOT_LAYOUT.map((dot, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: color,
                  top: size * dot.topRatio,
                  left: size * dot.leftRatio,
                },
              ]}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    justifyContent: "center",
  },
  ring: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    fontFamily: "Inter_700Bold",
    lineHeight: 16,
  },
  dot: {
    position: "absolute",
  },
});
