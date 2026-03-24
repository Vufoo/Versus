import React, { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onPress?: () => void;
  activeOpacity?: number;
};

const STRIPS = 200;

export default function GradientCard({ style, children, onPress, activeOpacity = 0.85 }: Props) {
  const { mode, colors } = useTheme();

  const tintColor = mode === 'dark' ? '#2563EB' : '#a3b0d9';
  // Base tint covers the whole card — just enough to eliminate the left gap
  const baseOpacity = mode === 'dark' ? 0.014 : 0.03;
  // Strips ramp from 0 → extraOpacity, creating a subtle left-to-right contrast
  const extraOpacity = mode === 'dark' ? 0.07 : 0.15;

  const strips = useMemo(() => {
    const stripW = 100 / STRIPS;
    return Array.from({ length: STRIPS }, (_, i) => {
      const t = (i + 0.5) / STRIPS;
      const opacity = t * extraOpacity;
      const rightPct = (STRIPS - 1 - i) * stripW;
      return (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, bottom: 0,
            right: `${rightPct}%`,
            width: `${stripW}%`,
            backgroundColor: tintColor,
            opacity,
          }}
        />
      );
    });
  }, [mode, tintColor, extraOpacity]);

  const baseStyle = [{ backgroundColor: colors.cardBg, overflow: 'hidden' as const }, style];

  if (onPress) {
    return (
      <TouchableOpacity style={baseStyle} onPress={onPress} activeOpacity={activeOpacity}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tintColor, opacity: baseOpacity }} />
        {strips}
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={baseStyle}>
      {/* Full-card base tint — no gap anywhere */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tintColor, opacity: baseOpacity }}
      />
      {/* Gradient strips ramp up toward the right */}
      {strips}
      {children}
    </View>
  );
}
