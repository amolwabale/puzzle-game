import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { pick, types as pickerTypes } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Button,
  Icon,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { createTicket } from '../../service/ticketService';
import type { FileInput, Ticket } from '../../service/ticketTypes';
import { useNavigation } from '@react-navigation/native';
import { FormInput } from '../../components/FormInput';
import { trackEvent } from '../../service/analyticsTracker';

export default function AddTicketScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [file, setFile] = React.useState<FileInput | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    title?: string;
    description?: string;
  }>({});

  const validate = React.useCallback(() => {
    const next: { title?: string; description?: string } = {};
    if (!title.trim()) next.title = 'Required';
    if (!description.trim()) next.description = 'Required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [title, description]);

  const pickFromGallery = React.useCallback(async () => {
    try {
      const r = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });
      const a = r.assets?.[0];
      if (!a?.uri) return;

      const fileSize =
        (a as any).fileSize != null ? Number((a as any).fileSize) : null;
      if (fileSize != null && Number.isFinite(fileSize) && fileSize > MAX_FILE_BYTES) {
        Alert.alert('File too large', 'Please choose a file smaller than 20 MB.');
        return;
      }

      setFile({
        uri: a.uri,
        name: a.fileName || 'photo.jpg',
        type: a.type ?? undefined,
      });
    } catch (e: any) {
      Alert.alert('Pick failed', e?.message || 'Could not select photo');
    }
  }, []);

  const pickFromFiles = React.useCallback(async () => {
    try {
      const result = await pick({
        // Allow any file type (pdf, images, docs, etc).
        type: [pickerTypes.allFiles],
        allowMultiSelection: false,
      });

      const file = result?.[0];
      if (!file?.uri) return;

      const size =
        (file as any).size != null ? Number((file as any).size) : null;
      if (size != null && Number.isFinite(size) && size > MAX_FILE_BYTES) {
        Alert.alert('File too large', 'Please choose a file smaller than 20 MB.');
        return;
      }

      setFile({
        uri: file.uri,
        name: file.name ?? 'attachment',
        type: file.type ?? undefined,
      });
    } catch (e: any) {
      if (e?.code === 'DOCUMENT_PICKER_CANCELED') return;
      Alert.alert('Pick failed', e?.message || 'Could not select file');
    }
  }, []);

  const pickAttachmentWithChoice = React.useCallback(() => {
    Alert.alert('Attach file', 'Choose where to pick from', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Gallery', onPress: () => void pickFromGallery() },
      { text: 'Files', onPress: () => void pickFromFiles() },
    ]);
  }, [pickFromFiles, pickFromGallery]);

  const onSubmit = React.useCallback(async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const created: Ticket = await createTicket({
        title,
        description,
        file,
      });
      trackEvent('Support_TicketCreated', {
        source: 'Support',
        ticket_id: created.id,
      });
      Alert.alert('Ticket created', 'Your request has been sent to support.', [
        {
          text: 'Open Ticket',
          onPress: () =>
            navigation.replace('SupportTicketChat', { ticketId: created.id }),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not create ticket');
    } finally {
      setSaving(false);
    }
  }, [validate, title, description, file, navigation]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Surface style={styles.section} elevation={2}>
        <View style={styles.sectionTitleRow}>
          <View
            style={[
              styles.sectionIcon,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon source="lifebuoy" size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sectionTitle}>New support ticket</Text>
            <Text style={styles.sectionSub} numberOfLines={1}>
              Tell us what went wrong and we’ll help you.
            </Text>
          </View>
        </View>

        <View>
          <FormInput
            label="Title *"
            value={title}
            error={errors.title}
            onChange={(t: any) => {
              setTitle(t);
            }}
            maxLength={255}
          />
        </View>

        <View>
          <FormInput
            label="Description *"
            value={description}
            error={errors.description}
            onChange={(t: any) => {
              setDescription(t);
            }}
            multiline={true}
            maxLength={500}
          />
        </View>

        <View style={styles.attachRow}>
          <Button
            mode="outlined"
            onPress={pickAttachmentWithChoice}
            icon="paperclip"
            disabled={saving}
          >
            Attach file
          </Button>
          {file ? (
            <View style={styles.filePill}>
              <Icon
                source="file-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text
                style={[styles.fileName, { color: theme.colors.primary }]}
                numberOfLines={1}
              >
                {file.name}
              </Text>
              <IconButton
                icon="close"
                size={16}
                onPress={() => setFile(null)}
                disabled={saving}
              />
            </View>
          ) : null}
        </View>

        <Button
          mode="contained"
          onPress={() => void onSubmit()}
          loading={saving}
          disabled={saving}
          style={styles.primaryBtn}
        >
          Create ticket
        </Button>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 24 },

  section: { borderRadius: 16, padding: 14, backgroundColor: '#FFFFFF' },
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
  sectionSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
  },

  field: { marginBottom: 10 },
  inputSingle: { minHeight: 48 },
  helper: { marginTop: 0, paddingVertical: 2 },
  multiline: { minHeight: 120 },

  attachRow: { marginTop: 4, gap: 10 },
  filePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fileName: { flex: 1, fontWeight: '800', fontSize: 13 },

  primaryBtn: { marginTop: 12 },
});
