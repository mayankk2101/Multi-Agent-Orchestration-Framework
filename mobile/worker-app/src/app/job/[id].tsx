import { StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { api, ApiError } from '@/lib/api';
import { Spacing } from '@/constants/theme';
import type { WorkRequest } from '@/types/api';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.infoRow} type="backgroundElement">
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </ThemedView>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<WorkRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.workRequests.get(id).then(setJob).finally(() => setLoading(false));
  }, [id]);

  const handleApply = async () => {
    if (!job) return;
    setApplying(true);
    try {
      await api.applications.apply(job.id);
      const updated = await api.workRequests.get(job.id);
      setJob(updated);
      Alert.alert('Applied!', 'Your application has been submitted.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to apply.');
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!job?.my_application) return;
    Alert.alert('Withdraw Application', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          setApplying(true);
          try {
            await api.applications.withdraw(job.id, job.my_application!.id);
            const updated = await api.workRequests.get(job.id);
            setJob(updated);
          } catch (err) {
            Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to withdraw.');
          } finally {
            setApplying(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!job) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary">Job not found.</ThemedText>
      </ThemedView>
    );
  }

  const applied = !!job.my_application;
  const canApply = job.status === 'OPEN' || job.status === 'PARTIALLY_FILLED';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ThemedText type="small" themeColor="textSecondary">← Back</ThemedText>
        </Pressable>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle" style={styles.title}>{job.position}</ThemedText>
          {job.hotel && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hotelName}>
              {job.hotel.name}
            </ThemedText>
          )}

          <ThemedView type="backgroundElement" style={styles.section}>
            <InfoRow
              label="Date"
              value={new Date(job.shift_date).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            />
            <View style={styles.divider} />
            <InfoRow label="Time" value={`${job.shift_start_time} – ${job.shift_end_time}`} />
            <View style={styles.divider} />
            <InfoRow label="Pay" value={job.hourly_rate ? `$${job.hourly_rate}/hr` : 'TBD'} />
            <View style={styles.divider} />
            <InfoRow label="Spots" value={`${job.workers_confirmed}/${job.workers_needed} filled`} />
            <View style={styles.divider} />
            <InfoRow label="Status" value={job.status.replace(/_/g, ' ')} />
          </ThemedView>

          {job.description ? (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                Description
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.descCard}>
                <ThemedText type="small">{job.description}</ThemedText>
              </ThemedView>
            </>
          ) : null}

          {applied ? (
            <>
              <View style={styles.appliedBanner}>
                <ThemedText type="small" style={styles.appliedText}>
                  Application: {job.my_application?.status.replace(/_/g, ' ')}
                </ThemedText>
              </View>
              {job.my_application?.status === 'PENDING' && (
                <Pressable
                  onPress={handleWithdraw}
                  disabled={applying}
                  style={({ pressed }) => [styles.withdrawBtn, { opacity: pressed || applying ? 0.7 : 1 }]}
                >
                  {applying ? <ActivityIndicator color="#fff" /> : (
                    <ThemedText type="smallBold" style={styles.btnText}>Withdraw</ThemedText>
                  )}
                </Pressable>
              )}
            </>
          ) : canApply ? (
            <Pressable
              onPress={handleApply}
              disabled={applying}
              style={({ pressed }) => [styles.applyBtn, { opacity: pressed || applying ? 0.7 : 1 }]}
            >
              {applying ? <ActivityIndicator color="#fff" /> : (
                <ThemedText type="smallBold" style={styles.btnText}>Apply Now</ThemedText>
              )}
            </Pressable>
          ) : (
            <ThemedView type="backgroundElement" style={styles.closedBanner}>
              <ThemedText type="small" themeColor="textSecondary">
                This job is no longer accepting applications.
              </ThemedText>
            </ThemedView>
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
  title: { marginBottom: Spacing.one },
  hotelName: { marginBottom: Spacing.three },
  section: { borderRadius: Spacing.two, overflow: 'hidden', marginBottom: Spacing.three },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  divider: { height: 1, backgroundColor: '#E0E1E6', marginHorizontal: Spacing.three },
  sectionLabel: { marginBottom: Spacing.two, textTransform: 'uppercase', letterSpacing: 0.8 },
  descCard: { borderRadius: Spacing.two, padding: Spacing.three, marginBottom: Spacing.three },
  appliedBanner: { backgroundColor: '#2B6CB0', borderRadius: Spacing.two, padding: Spacing.three, marginBottom: Spacing.two },
  appliedText: { color: '#fff', textAlign: 'center' },
  applyBtn: { backgroundColor: '#3182CE', borderRadius: Spacing.two, height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.three },
  withdrawBtn: { backgroundColor: '#E53E3E', borderRadius: Spacing.two, height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.three },
  closedBanner: { borderRadius: Spacing.two, padding: Spacing.three, alignItems: 'center' },
  btnText: { color: '#fff' },
});
