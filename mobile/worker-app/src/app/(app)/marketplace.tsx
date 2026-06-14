import { StyleSheet, FlatList, TextInput, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { api } from '@/lib/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WorkRequest } from '@/types/api';

function JobCard({ item, onPress }: { item: WorkRequest; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedView style={styles.cardHeader} type="backgroundElement">
          <ThemedText type="smallBold" style={styles.position}>
            {item.position}
          </ThemedText>
        </ThemedView>
        {item.hotel && (
          <ThemedText type="small" themeColor="textSecondary">{item.hotel.name}</ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {new Date(item.shift_date).toLocaleDateString()} · {item.shift_start_time} – {item.shift_end_time}
        </ThemedText>
        {item.hourly_rate && (
          <ThemedText type="small">${item.hourly_rate}/hr</ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {item.workers_confirmed}/{item.workers_needed} filled
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [items, setItems] = useState<WorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.workRequests.list({ status: 'OPEN', limit: 50 });
      setItems(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const filtered = items.filter((i) =>
    !search || i.position.toLowerCase().includes(search.toLowerCase()) ||
    (i.hotel?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.header}>Job Marketplace</ThemedText>
        <TextInput
          style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Search jobs..."
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <JobCard
                item={item}
                onPress={() => router.push(`/job/${item.id}`)}
              />
            )}
            ListEmptyComponent={
              <ThemedView type="backgroundElement" style={styles.empty}>
                <ThemedText type="small" themeColor="textSecondary">No open jobs found.</ThemedText>
              </ThemedView>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  header: { marginBottom: Spacing.three },
  search: { borderRadius: Spacing.two, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginBottom: Spacing.three, fontSize: 14 },
  loader: { marginTop: Spacing.six },
  list: { gap: Spacing.two, paddingBottom: Spacing.six },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  position: { flex: 1 },
  empty: { borderRadius: Spacing.two, padding: Spacing.four, alignItems: 'center', marginTop: Spacing.four },
});
