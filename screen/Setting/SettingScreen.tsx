import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Chip,
  Dialog,
  FAB,
  Portal,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import supabase from '../../service/SupabaseClient';
import { FormInput } from '../../components/FormInput';
import analytics from '@react-native-firebase/analytics';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { trackEvent } from '../../service/analyticsTracker';
import { getCurrentUserId } from '../../service/authSession';
import { traceAsync } from '../../service/perfTrace';
type Errors = Partial<
  Record<
    | 'propertyName'
    | 'propertyAddress'
    | 'water'
    | 'electricity'
    | 'rentDate'
    | 'rentDueDate',
    string
  >
>;

export default function SettingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  /* ---------------- FORM STATE ---------------- */

  const [propertyName, setPropertyName] = React.useState('');
  const [propertyAddress, setPropertyAddress] = React.useState('');
  const [water, setWater] = React.useState('');
  const [electricity, setElectricity] = React.useState('');
  const [rentDate, setRentDate] = React.useState('');
  const [rentDueDate, setRentDueDate] = React.useState('');
  const [recordId, setRecordId] = React.useState<number | null>(null);

  /* ---------------- UI STATE ---------------- */

  const [initialLoading, setInitialLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});
  const [dayPickerOpenFor, setDayPickerOpenFor] = React.useState<
    null | 'rentDate' | 'rentDueDate'
  >(null);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const getKeyboardHeight = (e: any) => {
      const h = Number(e?.endCoordinates?.height ?? 0);
      if (Number.isFinite(h) && h > 0) return h;

      const screenY = Number(e?.endCoordinates?.screenY ?? NaN);
      if (Number.isFinite(screenY) && screenY > 0) {
        const winH = Dimensions.get('window').height;
        return Math.max(0, winH - screenY);
      }

      return 0;
    };

    const subShow = Keyboard.addListener(showEvent as any, e => {
      setKeyboardHeight(getKeyboardHeight(e));
    });
    const subHide = Keyboard.addListener(hideEvent as any, () => {
      setKeyboardHeight(0);
    });
    const subFrame =
      Platform.OS === 'android'
        ? Keyboard.addListener('keyboardDidChangeFrame' as any, e => {
            setKeyboardHeight(getKeyboardHeight(e));
          })
        : null;

    return () => {
      subShow.remove();
      subHide.remove();
      subFrame?.remove();
    };
  }, []);

  React.useEffect(() => {
    if (saving) setDayPickerOpenFor(null);
  }, [saving]);

  const selectDay = React.useCallback(
    (day: number) => {
      const v = String(day);
      if (dayPickerOpenFor === 'rentDate') {
        setRentDate(v);
        setErrors(prev => ({ ...prev, rentDate: '' }));
      } else if (dayPickerOpenFor === 'rentDueDate') {
        setRentDueDate(v);
        setErrors(prev => ({ ...prev, rentDueDate: '' }));
      }
      setDayPickerOpenFor(null);
    },
    [dayPickerOpenFor],
  );

  /* ---------------- FETCH SETTINGS ---------------- */

  const fetchSettings = React.useCallback(async () => {
    let active = true;

    try {
      setInitialLoading(true);

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData.user?.id;
      if (!userId) throw new Error('User not found. Please login again.');

      const { data, error } = await supabase
        .from('setting')
        .select('*')
        .eq('user_id', userId)
        .order('modified_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) throw error;

      if (data) {
        setRecordId(data.id ?? null);
        setPropertyName(data.property_name ?? '');
        setPropertyAddress(data.property_address ?? '');
        setWater(data.water != null ? String(data.water) : '');
        setElectricity(
          data.electricity_unit != null ? String(data.electricity_unit) : '',
        );
        setRentDate(data.rent_date != null ? String(data.rent_date) : '');
        setRentDueDate(
          data.rent_due_date != null ? String(data.rent_due_date) : '',
        );
      }
    } catch (err: any) {
      Alert.alert('Load Failed', err.message || 'Could not load settings');
    } finally {
      setInitialLoading(false);
    }

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchSettings();
    }, [fetchSettings]),
  );

  /* ---------------- VALIDATION ---------------- */

  const validate = () => {
    const nextErrors: Errors = {};

    if (!propertyName.trim()) {
      nextErrors.propertyName = 'Property name is required';
    }
    if (water && isNaN(Number(water))) {
      nextErrors.water = 'Water must be a number';
    }
    if (electricity && isNaN(Number(electricity))) {
      nextErrors.electricity = 'Electricity unit must be a number';
    }
    const rentDay = rentDate ? Number(rentDate) : null;
    const dueDay = rentDueDate ? Number(rentDueDate) : null;

    const isValidDay = (d: number) => Number.isFinite(d) && d >= 1 && d <= 31;
    if (
      rentDate &&
      (!Number.isFinite(rentDay as any) || !isValidDay(rentDay as number))
    ) {
      nextErrors.rentDate = 'Rent date must be a day between 1 and 31';
    }
    if (
      rentDueDate &&
      (!Number.isFinite(dueDay as any) || !isValidDay(dueDay as number))
    ) {
      nextErrors.rentDueDate = 'Rent due date must be a day between 1 and 31';
    }
    // Important: due date can be in the next month.
    // Example: rent_date = 31 (last day), rent_due_date = 5 (5th of next month).
    // So we intentionally DO NOT enforce dueDay >= rentDay.

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /* ---------------- SAVE ---------------- */

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await traceAsync(
        'action_setting_save',
        async () => {
          const userId = await getCurrentUserId();

          const payload = {
            property_name: propertyName.trim(),
            property_address: propertyAddress.trim() || null,
            water: water ? Number(water) : null,
            electricity_unit: electricity ? Number(electricity) : null,
            rent_date: rentDate ? Number(rentDate) : null,
            rent_due_date: rentDueDate ? Number(rentDueDate) : null,
            user_id: userId,
            modified_at: new Date().toISOString(),
          };

          let result;

          if (recordId) {
            result = await supabase
              .from('setting')
              .update(payload)
              .eq('id', recordId)
              .eq('user_id', userId)
              .select()
              .maybeSingle();
          } else {
            result = await supabase
              .from('setting')
              .insert(payload)
              .select()
              .maybeSingle();
          }

          if (result.error) {
            throw new Error(result.error.message);
          }

          trackEvent('Setting_Saved', {
            source: 'Setting',
            setting_id: result.data?.id,
          });

          queryClient.invalidateQueries({ queryKey: ['latestSetting'] });

          Alert.alert('Saved', 'Settings have been saved successfully.');

          if (result.data?.id) {
            setRecordId(result.data.id);
          }
        },
        { mode: recordId ? 'edit' : 'add' },
      );
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const fabBottom = keyboardHeight > 0 ? keyboardHeight + 75 : 24;

  return (
    <View style={styles.screenRoot}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View pointerEvents={saving ? 'none' : 'auto'}>
          {/* HERO (Support/Room style) */}
          <Surface style={styles.hero} elevation={2}>
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.heroIconWrap,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Avatar.Icon
                  size={18}
                  icon="office-building-outline"
                  style={{ backgroundColor: 'transparent' }}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  Property settings
                </Text>
                <Text style={styles.heroSubtitle} numberOfLines={1}>
                  Manage your property configuration
                </Text>
              </View>
            </View>
          </Surface>

          <Section title="Property details" icon="office-building-outline">
            <FormInput
              label="Property Name *"
              value={propertyName}
              onChange={setPropertyName}
              error={errors.propertyName}
              maxLength={70}
            />
            <FormInput
              label="Property Address"
              value={propertyAddress}
              onChange={setPropertyAddress}
              maxLength={255}
              multiline={true}
            />
          </Section>

          <Section title="Utility charges" icon="water-outline">
            <FormInput
              label="Water (numeric)"
              value={water}
              onChange={setWater}
              error={errors.water}
              keyboard="number-pad"
              maxLength={5}
            />
            <FormInput
              label="Electricity unit (numeric)"
              value={electricity}
              onChange={setElectricity}
              error={errors.electricity}
              keyboard="number-pad"
              maxLength={5}
            />
          </Section>

          <Section title="Rent cycle" icon="calendar-month-outline">
            <DaySelectRow
              label="Rent date (day of month)"
              value={rentDate}
              error={errors.rentDate}
              onPress={() => setDayPickerOpenFor('rentDate')}
            />
            <DaySelectRow
              label="Rent due date (day of month)"
              value={rentDueDate}
              error={errors.rentDueDate}
              onPress={() => setDayPickerOpenFor('rentDueDate')}
            />

            <Text style={styles.rentHint}>
              Tip: Due date can be in the next month (e.g. Rent = Last day, Due =
              5). If you choose 29/30/31, months with fewer days will treat it as
              the last day of that month.
            </Text>

          </Section>
        </View>
      </ScrollView>

      <FAB
        icon="content-save"
        style={[styles.fab, { bottom: fabBottom }]}
        loading={saving}
        onPress={handleSave}
        disabled={saving}
      />

      {/* ---------- DAY PICKER (DAY OF MONTH) ---------- */}
      <Portal>
        <Dialog
          visible={dayPickerOpenFor != null && !saving}
          onDismiss={() => setDayPickerOpenFor(null)}
        >
          <Dialog.Title>
            {dayPickerOpenFor === 'rentDate'
              ? 'Select Rent Date'
              : 'Select Rent Due Date'}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.pickerHint}>
              Pick a day of month (1–31). If the day doesn’t exist in a month,
              it will auto-adjust to the month’s last day.
            </Text>

            <View style={styles.quickRow}>
              {[1, 5, 10, 15, 20, 25, 28, 30, 31].map(d => (
                <Chip
                  key={d}
                  compact
                  style={styles.quickChip}
                  onPress={() => selectDay(d)}
                >
                  {d === 31 ? 'Last day' : String(d)}
                </Chip>
              ))}
            </View>

            <View style={styles.dayGrid}>
              {Array.from({ length: 31 }).map((_, idx) => {
                const day = idx + 1;
                const selected =
                  (dayPickerOpenFor === 'rentDate' ? rentDate : rentDueDate) ===
                  String(day);
                return (
                  <Chip
                    key={day}
                    compact
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: selected
                          ? theme.colors.primaryContainer
                          : theme.colors.surface,
                        borderColor: selected
                          ? theme.colors.primary
                          : theme.colors.outline,
                      },
                    ]}
                    textStyle={{
                      fontWeight: '900',
                      color: selected
                        ? theme.colors.primary
                        : theme.colors.onSurface,
                      fontVariant: ['tabular-nums'],
                    }}
                    onPress={() => selectDay(day)}
                  >
                    {String(day)}
                  </Chip>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                if (dayPickerOpenFor === 'rentDate') setRentDate('');
                if (dayPickerOpenFor === 'rentDueDate') setRentDueDate('');
                setDayPickerOpenFor(null);
              }}
            >
              Clear
            </Button>
            <Button onPress={() => setDayPickerOpenFor(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {saving ? <View pointerEvents="none" style={styles.screenScrim} /> : null}
    </View>
  );
}

/* ---------------- HELPERS ---------------- */

const Section = ({ title, icon, children }: any) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  return (
    <Surface style={[styles.section, { borderColor: outline }]} elevation={2}>
      <View style={styles.sectionTitleRow}>
        <View
          style={[
            styles.sectionIcon,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Avatar.Icon
            size={18}
            icon={icon}
            style={{ backgroundColor: 'transparent' }}
          />
        </View>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children}
    </Surface>
  );
};

const DaySelectRow = ({
  label,
  value,
  error,
  onPress,
}: {
  label: string;
  value: string;
  error?: string;
  onPress: () => void;
}) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  return (
    <View style={styles.selectWrap}>
      <TouchableRipple
        onPress={onPress}
        borderless
        style={[styles.selectRow, { borderColor: outline }]}
      >
        <View style={styles.selectRowInner}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.selectLabel} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.selectValue} numberOfLines={1}>
              {value ? String(value) : 'Tap to select'}
            </Text>
          </View>
          <View
            style={[
              styles.selectIconWrap,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Avatar.Icon
              size={18}
              icon="calendar-month"
              style={{ backgroundColor: 'transparent' }}
            />
          </View>
        </View>
      </TouchableRipple>
      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },

  hero: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  heroSubtitle: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
  },

  section: {
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },

  selectWrap: { marginTop: 12 },
  selectRow: {
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  selectRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  selectLabel: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  selectValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },
  selectIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { marginTop: 6, fontSize: 12, fontWeight: '800' },

  rentHint: { color: '#6B7280', fontWeight: '800', fontSize: 13, marginTop: 4 },
  pickerHint: { color: '#6B7280', fontWeight: '800', marginBottom: 10 },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickChip: { borderRadius: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { borderRadius: 12, borderWidth: 1 },

  fab: {
    position: 'absolute',
    right: 16,
  },
  screenScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
