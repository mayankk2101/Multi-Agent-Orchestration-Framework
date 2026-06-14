import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

type VerificationStatus = 'PASSED' | 'NEEDS_REWORK' | 'FAILED';

const STATUS_COLORS: Record<VerificationStatus, string> = {
  PASSED: '#22c55e',
  NEEDS_REWORK: '#f59e0b',
  FAILED: '#ef4444',
};

export default function QualityVerificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [score, setScore] = useState(80);
  const [status, setStatus] = useState<VerificationStatus>('PASSED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.quality.createVerification({
        assignment_id: id,
        score,
        notes: notes || undefined,
        status,
      });
      Alert.alert('Submitted', 'Quality verification recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, gap: 12 },
    card: { backgroundColor: theme.backgroundElement, borderRadius: 14, padding: 16 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    scoreDisplay: { fontSize: 52, fontWeight: '800', color: theme.text, width: 80 },
    adjustCol: { flex: 1, gap: 8 },
    adjustRow: { flexDirection: 'row', gap: 8 },
    adjustBtn: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    adjustBtnText: { fontSize: 16, fontWeight: '700', color: theme.text },
    statusRow: { flexDirection: 'row', gap: 8 },
    statusChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 2,
    },
    statusChipText: { fontSize: 11, fontWeight: '700' },
    notesInput: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      color: theme.text,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    button: {
      backgroundColor: '#7c3aed',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

  const adj = (delta: number) => setScore((s) => Math.min(100, Math.max(0, s + delta)));

  return (
    <>
      <Stack.Screen options={{ title: 'Quality Check', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Score (0–100)</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreDisplay}>{score}</Text>
            <View style={styles.adjustCol}>
              <View style={styles.adjustRow}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adj(10)}>
                  <Text style={styles.adjustBtnText}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adj(-10)}>
                  <Text style={styles.adjustBtnText}>-10</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.adjustRow}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adj(1)}>
                  <Text style={styles.adjustBtnText}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adj(-1)}>
                  <Text style={styles.adjustBtnText}>-1</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Outcome</Text>
          <View style={styles.statusRow}>
            {(['PASSED', 'NEEDS_REWORK', 'FAILED'] as VerificationStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  {
                    borderColor: STATUS_COLORS[s],
                    backgroundColor: status === s ? `${STATUS_COLORS[s]}22` : 'transparent',
                  },
                ]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusChipText, { color: STATUS_COLORS[s] }]}>
                  {s.replace('_', '\n')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Describe findings..."
            placeholderTextColor={theme.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.button, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Submit Verification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
