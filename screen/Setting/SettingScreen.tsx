import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Chip,
  Dialog,
  HelperText,
  Portal,
  Provider as PaperProvider,
  Surface,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import supabase from '../../service/SupabaseClient';

type Errors = Partial<
  Record<
    'propertyName' | 'propertyAddress' | 'water' | 'electricity' | 'rentDate' | 'rentDueDate',
    string
  >
>;

const scalePaperThemeFonts = (t: any, scale: number) => {
  const s = Number.isFinite(scale) ? scale : 1;
  const fonts = t?.fonts ?? {};
  const nextFonts: Record<string, any> = { ...fonts };
  Object.keys(nextFonts).forEach((k) => {
    const v = nextFonts[k];
    if (!v || typeof v !== 'object') return;
    const nv: any = { ...v };
    if (typeof nv.fontSize === 'number') nv.fontSize = Math.round(nv.fontSize * s);
    if (typeof nv.lineHeight === 'number') nv.lineHeight = Math.round(nv.lineHeight * s);
    if (typeof nv.letterSpacing === 'number') nv.letterSpacing = Number((nv.letterSpacing * s).toFixed(2));
    nextFonts[k] = nv;
  });
  return { ...t, fonts: nextFonts };
};

export default function SettingScreen() {
  const theme = useTheme();
  const scaledTheme = React.useMemo(() => scalePaperThemeFonts(theme, 1.1), [theme]);

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
  const [dayPickerOpenFor, setDayPickerOpenFor] = React.useState<null | 'rentDate' | 'rentDueDate'>(null);

  const selectDay = React.useCallback(
    (day: number) => {
      const v = String(day);
      if (dayPickerOpenFor === 'rentDate') {
        setRentDate(v);
        setErrors((prev) => ({ ...prev, rentDate: '' }));
      } else if (dayPickerOpenFor === 'rentDueDate') {
        setRentDueDate(v);
        setErrors((prev) => ({ ...prev, rentDueDate: '' }));
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

      const { data: userData, error: userError } = await supabase.auth.getUser();
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
        setRentDueDate(data.rent_due_date != null ? String(data.rent_due_date) : '');
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
    if (rentDate && (!Number.isFinite(rentDay as any) || !isValidDay(rentDay as number))) {
      nextErrors.rentDate = 'Rent date must be a day between 1 and 31';
    }
    if (rentDueDate && (!Number.isFinite(dueDay as any) || !isValidDay(dueDay as number))) {
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

    try {
      setSaving(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData.user?.id;
      if (!userId) throw new Error('User not found. Please login again.');

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

      Alert.alert('Saved', 'Settings have been saved successfully.');

      if (result.data?.id) {
        setRecordId(result.data.id);
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <PaperProvider theme={scaledTheme}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      </PaperProvider>
    );
  }

  return (
    <>
      <PaperProvider theme={scaledTheme}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* ---------- HERO ---------- */}
      <Surface style={styles.hero} elevation={3}>
        <Avatar.Icon size={56} icon="office-building-outline" />
        <View style={{ marginLeft: 16 }}>
          <Text variant="titleLarge" style={styles.heroTitle}>
            Property Settings
          </Text>
          <Text style={styles.heroSubtitle}>
            Manage your property configuration
          </Text>
        </View>
      </Surface>

      {/* ---------- PROPERTY ---------- */}
      <Surface style={styles.section} elevation={2}>
        <SectionTitle title="Property Details" />

        <Field
          label="Property Name *"
          value={propertyName}
          error={errors.propertyName}
          onChange={setPropertyName}
        />

        <Field
          label="Property Address"
          value={propertyAddress}
          error={errors.propertyAddress}
          onChange={setPropertyAddress}
          multiline
        />
      </Surface>

      {/* ---------- UTILITIES ---------- */}
      <Surface style={styles.section} elevation={2}>
        <SectionTitle title="Utility Charges" />

        <Field
          label="Water (numeric)"
          value={water}
          error={errors.water}
          onChange={setWater}
          keyboardType="numeric"
        />

        <Field
          label="Electricity Unit (numeric)"
          value={electricity}
          error={errors.electricity}
          onChange={setElectricity}
          keyboardType="numeric"
        />
      </Surface>

      {/* ---------- RENT CYCLE ---------- */}
      <Surface style={styles.section} elevation={2}>
        <SectionTitle title="Rent Cycle" />

        <DayPickerField
          label="Rent Date (day of month)"
          value={rentDate}
          error={errors.rentDate}
          onPress={() => setDayPickerOpenFor('rentDate')}
        />

        <DayPickerField
          label="Rent Due Date (day of month)"
          value={rentDueDate}
          error={errors.rentDueDate}
          onPress={() => setDayPickerOpenFor('rentDueDate')}
        />

        <Text style={styles.rentHint}>
          Tip: Due date can be in the next month (e.g. Rent = Last day, Due = 5). If you choose 29/30/31,
          months with fewer days will treat it as the last day of that month.
        </Text>

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.primaryButton}
        >
          Save Settings
        </Button>
      </Surface>
        </ScrollView>

      {/* ---------- DAY PICKER (DAY OF MONTH) ---------- */}
      <Portal>
        <Dialog visible={dayPickerOpenFor != null} onDismiss={() => setDayPickerOpenFor(null)}>
          <Dialog.Title>
            {dayPickerOpenFor === 'rentDate' ? 'Select Rent Date' : 'Select Rent Due Date'}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.pickerHint}>
              Pick a day of month (1–31). If the day doesn’t exist in a month, it will auto-adjust to the month’s last day.
            </Text>

            <View style={styles.quickRow}>
              {[1, 5, 10, 15, 20, 25, 28, 30, 31].map((d) => (
                <Chip key={d} compact style={styles.quickChip} onPress={() => selectDay(d)}>
                  {d === 31 ? 'Last day' : String(d)}
                </Chip>
              ))}
            </View>

            <View style={styles.dayGrid}>
              {Array.from({ length: 31 }).map((_, idx) => {
                const day = idx + 1;
                const selected =
                  (dayPickerOpenFor === 'rentDate' ? rentDate : rentDueDate) === String(day);
                return (
                  <Chip
                    key={day}
                    compact
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
                        borderColor: selected ? theme.colors.primary : theme.colors.outline,
                      },
                    ]}
                    textStyle={{
                      fontWeight: '900',
                      color: selected ? theme.colors.primary : theme.colors.onSurface,
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
      </PaperProvider>
    </>
  );
}

/* ---------------- HELPERS ---------------- */

const SectionTitle = ({ title }: { title: string }) => (
  <Text variant="titleMedium" style={styles.sectionTitle}>
    {title}
  </Text>
);

const Field = ({
  label,
  value,
  onChange,
  error,
  keyboardType,
  multiline,
}: any) => (
  <View style={styles.field}>
    <TextInput
      label={label}
      mode="outlined"
      value={value}
      onChangeText={onChange}
      keyboardType={keyboardType}
      multiline={multiline}
      error={!!error}
    />
    <HelperText type="error" visible={!!error}>
      {error || ' '}
    </HelperText>
  </View>
);

const DayPickerField = ({
  label,
  value,
  error,
  onPress,
}: {
  label: string;
  value: string;
  error?: string;
  onPress: () => void;
}) => (
  <View style={styles.field}>
    <TouchableRipple onPress={onPress} borderless>
      <View pointerEvents="none">
        <TextInput
          label={label}
          mode="outlined"
          value={value ? String(value) : ''}
          right={<TextInput.Icon icon="calendar-month" />}
          error={!!error}
        />
      </View>
    </TouchableRipple>
    <HelperText type="error" visible={!!error}>
      {error || ' '}
    </HelperText>
  </View>
);

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
  },

  hero: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#666',
    marginTop: 4,
  },

  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },

  field: {
    marginBottom: 12,
  },
  rentHint: { color: '#6B7280', fontWeight: '800', fontSize: 13, marginTop: 4 },
  pickerHint: { color: '#6B7280', fontWeight: '800', marginBottom: 10 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickChip: { borderRadius: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { borderRadius: 12, borderWidth: 1 },


  primaryButton: {
    marginTop: 8,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
