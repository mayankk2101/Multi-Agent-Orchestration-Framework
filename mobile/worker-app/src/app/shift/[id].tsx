import { StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { api, ApiError } from '@/lib/api';
import { Spacing } from '@/constants/theme';
import type { WorkerAssignment } from '@/types/api';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.infoRow} type="backgroundElement">
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </ThemedView>
  );
}

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [shift, setShift] = useState<WorkerAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const reload = async () => {
    if (!id) return;
    const res = await api.assignments.get(id);
    setShift(res);
  };

  useEffect(() => {
    if (!id) return;
    api.assignments.get(id).then(setShift).finally(() => setLoading(false));
  }, [id]);

  const handleCheckIn = async () => {
    if (!shift) return;
    setActing(true);
    try {
      await api.attendance.checkIn(shift.id);
      await reload();
      Alert.alert('Checked In', 'You have successfully checked in.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Check-in failed.');
    } finally {
      setActing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!shift?.attendance?.id) return;
    setActing(true);
    try {
      await api.attendance.checkOut(shift.attendance.id);
      await reload();
      Alert.alert('Checked Out', 'You have successfully checked out.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Check-out failed.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!shift) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary">Shift not found.</ThemedText>
      </ThemedView>
    );
  }

  const wr = shift.work_request;
  const att = shift.attendance;
  const canCheckIn = ['CONFIRMED', 'IN_PROGRESS'].includes(shift.status) && !att?.check_in_time;
  const canCheckOut = !!(att?.check_in_time && !att?.check_out_time);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ThemedText type="small" themeColor="textSecondary">← Back</ThemedText>
        </Pressable>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle" style={styles.title}>
            {wr?.position ?? 'Shift Details'}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.section}>
            {wr ? (
              <>
                <InfoRow
                  label="Date"
                  value={new Date(wr.shift_date).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                />
                <View style={styles.divider} />
                <InfoRow label="Time" value={`${wr.shift_start_time} – ${wr.shift_end_time}`} />
                <View style={styles.divider} />
              </>
            ) : null}
            <InfoRow label="Status" value={shift.status.replace(/_/g, ' ')} />
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Attendance
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.section}>
            <InfoRow
              label="Check-in"
              value={att?.check_in_time ? new Date(att.check_in_time).toLocaleTimeString() : '—'}
            />
            <View style={styles.divider} />
            <InfoRow
              label="Check-out"
              value={att?.check_out_time ? new Date(att.check_out_time).toLocaleTimeString() : '—'}
            />
            {att?.status ? (
              <>
                <View style={styles.divider} />
                <InfoRow label="Attendance Status" value={att.status} />
              </>
            ) : null}
          </ThemedView>

          {canCheckIn && (
            <Pressable
              onPress={handleCheckIn}
              disabled={acting}
              style={({ pressed }) => [styles.checkInBtn, { opacity: pressed || acting ? 0.7 : 1 }]}
            >
              {acting ? <ActivityIndicator color="#fff" /> : (
                <ThemedText type="smallBold" style={styles.btnText}>Check In</ThemedText>
              )}
            </Pressable>
          )}

          {canCheckOut && (
            <Pressable
              onPress={handleCheckOut}
              disabled={acting}
              style={({ pressed }) => [styles.checkOutBtn, { opacity: pressed || acting ? 0.7 : 1 }]}
            >
              {acting ? <ActivityIndicator color="#fff" /> : (
                <ThemedText type="smallBold" style={styles.btnText}>Check Out</ThemedText>
              )}
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  back: { marginBottom: Spacing.three },
  scroll: { paddingBottom: Spacing.six },
  title: { marginBottom: Spacing.three },
  section: { borderRadius: Spacing.two, overflow: 'hidden', marginBottom: Spacing.three },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  divider: { height: 1, backgroundColor: '#E0E1E6', marginHorizontal: Spacing.three },
  sectionLabel: { marginBottom: Spacing.two, textTransform: 'uppercase', letterSpacing: 0.8 },
  checkInBtn: { backgroundColor: '#38A169', borderRadius: Spacing.two, height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.two },
  checkOutBtn: { backgroundColor: '#DD6B20', borderRadius: Spacing.two, height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.three },
  btnText: { color: '#fff' },
});
