import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';

export type PickedLocation = {
  latitude: number;
  longitude: number;
  name: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
  colors: ThemeColors;
  initial?: { latitude: number; longitude: number; name?: string } | null;
};

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    card: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      width: '90%',
      maxWidth: 400,
    },
    title: { ...typography.heading, color: c.text, marginBottom: spacing.md },
    body: { ...typography.body, color: c.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
    btn: { backgroundColor: c.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
    btnText: { ...typography.heading, color: c.textOnPrimary },
  });
}

export default function LocationPickerModal({ visible, onClose, colors }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.wrapper}>
        <View style={styles.card}>
          <Text style={styles.title}>Location picker</Text>
          <Text style={styles.body}>
            Map-based location picking is available on the iOS and Android app.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.btnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
