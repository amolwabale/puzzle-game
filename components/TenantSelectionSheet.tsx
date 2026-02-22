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
} from 'react-native-paper';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormInput } from './FormInput';
import { TenantRecord } from '../service/tenantService';

interface TenantSelectionSheetProps {
  visible: boolean;
  tenants: TenantRecord[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelectTenant: (tenant: TenantRecord) => void;
  onClose: () => void;
}

const getInitials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2);
  return parts.length
    ? parts
        .map(p => p[0])
        .join('')
        .toUpperCase()
    : 'T';
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

export function TenantSelectionSheet({
  visible,
  tenants,
  query,
  onQueryChange,
  onSelectTenant,
  onClose,
}: TenantSelectionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible) {
      // Keyboard will automatically show with input focus when modal opens
    }
  }, [visible]);

  const filteredTenants = React.useMemo(() => {
    if (query.length === 0) return tenants.slice(0, 8); // Show first 8 as suggestions
    const q = query.toLowerCase();
    return tenants.filter(t => t.name?.toLowerCase().includes(q));
  }, [query, tenants]);

  const handleSelectTenant = (tenant: TenantRecord) => {
    Keyboard.dismiss();
    onQueryChange('');
    onSelectTenant(tenant);
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onQueryChange('');
    onClose();
  };

  const renderItem = ({ item, index }: { item: TenantRecord; index: number }) => {
    const isLast = index === filteredTenants.length - 1;
    return (
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => handleSelectTenant(item)}
        style={[
          styles.listItem,
          !isLast && styles.listItemDivider,
        ]}
      >
        <Avatar.Text
          size={40}
          label={getInitials(item.name)}
          style={{
            backgroundColor: theme.colors.primaryContainer,
          }}
          color={theme.colors.primary}
        />
        <View style={styles.listItemContent}>
          {renderHighlightedText(item.name ?? '-', query)}
          <Text style={styles.listItemHint} numberOfLines={1}>
            Tap to select
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
    >
      <View style={[styles.sheetContainer, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant, paddingTop: (Platform.OS === 'android' ? 12 : 8) + insets.top }]}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Select Tenant</Text>
            <Text style={styles.headerSub}>Find and select a tenant to occupy this room</Text>
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
          <FormInput
            label="Search tenant by name"
            value={query}
            onChange={onQueryChange}
            maxLength={50}
          />
        </View>

        {/* Results */}
        {filteredTenants.length > 0 ? (
          <FlatList
            data={filteredTenants}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={true}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
          />
        ) : query.length > 0 ? (
          <View style={styles.emptyState}>
            <Icon
              source="account-search-outline"
              size={56}
              color={theme.colors.outlineVariant}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
              No tenants found
            </Text>
            <Text style={[styles.emptySub, { color: theme.colors.onSurfaceVariant }]}>
              Try searching with a different name
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon
              source="account-multiple-outline"
              size={56}
              color={theme.colors.outlineVariant}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
              Start typing to search
            </Text>
            <Text style={[styles.emptySub, { color: theme.colors.onSurfaceVariant }]}>
              Type a tenant name to see available options
            </Text>
          </View>
        )}

        {/* Result count */}
        {query.length > 0 && filteredTenants.length > 0 && (
          <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.resultCount, { color: theme.colors.onSurfaceVariant }]}>
              {filteredTenants.length} result{filteredTenants.length === 1 ? '' : 's'} found
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
  listContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
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
