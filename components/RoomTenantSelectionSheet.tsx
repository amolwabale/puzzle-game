import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Keyboard,
  Platform,
  FlatList,
} from 'react-native';
import {
  Text,
  Avatar,
  Icon,
  IconButton,
  useTheme,
  Surface,
  TextInput,
} from 'react-native-paper';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormInput } from './FormInput';
import { RoomRecord } from '../service/RoomService';
import { TenantRecord } from '../service/tenantService';

interface RoomTenantSelectionSheetProps {
  visible: boolean;
  pairs: Array<{ room: RoomRecord; tenant: TenantRecord }>;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectPair: (pair: { room: RoomRecord; tenant: TenantRecord }) => void;
  onClose: () => void;
}

const getInitials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2);
  return parts.length
    ? parts
        .map(p => p[0])
        .join('')
        .toUpperCase()
    : 'R';
};

const renderHighlightedText = (label: string, query: string) => {
  if (!query) return <Text style={styles.itemTitle}>{label}</Text>;
  const low = label.toLowerCase();
  const q = query.toLowerCase();
  const idx = low.indexOf(q);
  if (idx < 0) return <Text style={styles.itemTitle}>{label}</Text>;

  const before = label.slice(0, idx);
  const match = label.slice(idx, idx + query.length);
  const after = label.slice(idx + query.length);
  return (
    <Text style={styles.itemTitle} numberOfLines={1}>
      {before}
      <Text style={styles.itemMatch}>{match}</Text>
      {after}
    </Text>
  );
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export function RoomTenantSelectionSheet({
  visible,
  pairs,
  query,
  onQueryChange,
  onSelectPair,
  onClose,
}: RoomTenantSelectionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = React.useRef<any>(null);

  const handleModalShow = () => {
    // Focus input when modal is shown
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const filteredPairs = React.useMemo(() => {
    if (query.length === 0) return pairs.slice(0, 5); // Show first 5 as suggestions
    const q = query.toLowerCase();
    return pairs.filter(
      ({ room, tenant }) =>
        (room.name?.toLowerCase().includes(q) ?? false) ||
        (tenant.name?.toLowerCase().includes(q) ?? false),
    );
  }, [query, pairs]);

  const handleSelectPair = (pair: { room: RoomRecord; tenant: TenantRecord }) => {
    onSelectPair(pair);
    onQueryChange('');
    Keyboard.dismiss();
    setTimeout(() => {
      onClose();
    }, 150);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onQueryChange('');
    onClose();
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: { room: RoomRecord; tenant: TenantRecord };
    index: number;
  }) => {
    const isLast = index === filteredPairs.length - 1;
    const pairLabel = `${item.room.name || '-'} - ${item.tenant.name || '-'}`;

    return (
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => handleSelectPair(item)}
        style={[
          styles.listItem,
          !isLast && styles.listItemDivider,
        ]}
      >
        <Avatar.Text
          size={40}
          label={getInitials(item.room.name)}
          style={{
            backgroundColor: theme.colors.primaryContainer,
          }}
          color={theme.colors.primary}
        />
        <View style={styles.listItemContent}>
          {renderHighlightedText(pairLabel, query)}
          <Text style={styles.listItemHint} numberOfLines={1}>
            Rent: {item.room.rent ? formatMoney(Number(item.room.rent)) : '-'}
          </Text>
        </View>
        <Icon source="chevron-right" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent={Platform.OS === 'android'}
      onShow={handleModalShow}
    >
      <View style={[styles.sheetContainer, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant, paddingTop: (Platform.OS === 'android' ? 12 : 8) + insets.top }]}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Select Room & Tenant</Text>
            <Text style={styles.headerSub}>Find and select a room-tenant pair</Text>
          </View>
          <IconButton
            icon="close"
            size={24}
            onPress={handleClose}
            style={styles.closeBtn}
          />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            ref={inputRef}
            label="Search by room or tenant name"
            value={query}
            onChangeText={onQueryChange}
            maxLength={50}
            mode="outlined"
            autoFocus={true}
          />
        </View>

        {/* Results */}
        {filteredPairs.length > 0 ? (
          <View style={styles.flatListContainer} key={`flatlist-${visible}`}>
            <FlatList
              data={filteredPairs}
              renderItem={renderItem}
              keyExtractor={(item) => `${item.room.id}-${item.tenant.id}`}
              scrollEnabled={true}
              contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === 'android' ? insets.bottom + 12 : 12 }]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={5}
              extraData={filteredPairs}
              nestedScrollEnabled={false}
            />
          </View>
        ) : query.length > 0 ? (
          <View style={[styles.emptyState, { paddingBottom: Platform.OS === 'android' ? insets.bottom + 12 : 12 }]}>
            <Icon
              source="home-search-outline"
              size={56}
              color={theme.colors.outlineVariant}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
              No occupied rooms found
            </Text>
            <Text style={[styles.emptySub, { color: theme.colors.onSurfaceVariant }]}>
              Try searching with a different name
            </Text>
          </View>
        ) : (
          <View style={[styles.emptyState, { paddingBottom: Platform.OS === 'android' ? insets.bottom + 12 : 12 }]}>
            <Icon
              source="home-multiple-outline"
              size={56}
              color={theme.colors.outlineVariant}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
              Start typing to search
            </Text>
            <Text style={[styles.emptySub, { color: theme.colors.onSurfaceVariant }]}>
              Type a room or tenant name to see available options
            </Text>
          </View>
        )}

        {/* Result count */}
        {query.length > 0 && filteredPairs.length > 0 && (
          <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant, paddingBottom: Platform.OS === 'android' ? insets.bottom + 12 : 12 }]}>
            <Text style={[styles.resultCount, { color: theme.colors.onSurfaceVariant }]}>
              {filteredPairs.length} result{filteredPairs.length === 1 ? '' : 's'} found
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    margin: 0,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  flatListContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    flexGrow: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 64,
  },
  listItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },
  itemMatch: {
    backgroundColor: '#FEF3C7',
    fontWeight: '900',
    color: '#111827',
  },
  listItemHint: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: '#6B7280',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  resultCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textAlign: 'center',
  },
});
