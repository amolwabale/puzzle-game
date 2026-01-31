import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import DocumentPicker, { types as docTypes } from 'react-native-document-picker';
import {
  Button,
  HelperText,
  Icon,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { createTicket } from '../../service/ticketService';
import type { FileInput, Ticket } from '../../service/ticketTypes';
import { useNavigation } from '@react-navigation/native';

export default function AddTicketScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [file, setFile] = React.useState<FileInput | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ title?: string; description?: string }>({});

  const validate = React.useCallback(() => {
    const next: { title?: string; description?: string } = {};
    if (!title.trim()) next.title = 'Required';
    if (!description.trim()) next.description = 'Required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [title, description]);

  const pickFile = React.useCallback(async () => {
    try {
      const r = await DocumentPicker.pickSingle({
        type: [docTypes.images, docTypes.pdf, docTypes.plainText, docTypes.allFiles],
        copyTo: 'cachesDirectory',
      });
      const uri = (r.fileCopyUri || r.uri) as string;
      setFile({ uri, name: r.name || 'attachment', type: r.type || undefined });
    } catch (e: any) {
      if (DocumentPicker.isCancel(e)) return;
      Alert.alert('Pick failed', e?.message || 'Could not select file');
    }
  }, []);

  const onSubmit = React.useCallback(async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const created: Ticket = await createTicket({
        title,
        description,
        file,
      });
      Alert.alert('Ticket created', 'Your request has been sent to support.', [
        {
          text: 'Open Ticket',
          onPress: () => navigation.replace('SupportTicketChat', { ticketId: created.id }),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not create ticket');
    } finally {
      setSaving(false);
    }
  }, [validate, title, description, file, navigation]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Surface style={styles.section} elevation={2}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="lifebuoy" size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sectionTitle}>New support ticket</Text>
            <Text style={styles.sectionSub} numberOfLines={1}>
              Tell us what went wrong and we’ll help you.
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <TextInput
            label="Title *"
            mode="outlined"
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setErrors((p) => ({ ...p, title: undefined }));
            }}
            dense
            contentStyle={styles.inputContent}
            error={!!errors.title}
          />
          {errors.title ? (
            <HelperText type="error" visible style={styles.helper}>
              {errors.title}
            </HelperText>
          ) : null}
        </View>

        <View style={styles.field}>
          <TextInput
            label="Description *"
            mode="outlined"
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              setErrors((p) => ({ ...p, description: undefined }));
            }}
            multiline
            numberOfLines={5}
            style={styles.multiline}
            error={!!errors.description}
          />
          {errors.description ? (
            <HelperText type="error" visible style={styles.helper}>
              {errors.description}
            </HelperText>
          ) : null}
        </View>

        <View style={styles.attachRow}>
          <Button mode="outlined" onPress={() => void pickFile()} icon="paperclip">
            Attach file
          </Button>
          {file ? (
            <View style={styles.filePill}>
              <Icon source="file-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.fileName, { color: theme.colors.primary }]} numberOfLines={1}>
                {file.name}
              </Text>
              <IconButton icon="close" size={16} onPress={() => setFile(null)} />
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
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sectionIcon: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  sectionSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 13 },

  field: { marginBottom: 10 },
  inputContent: { paddingVertical: 8 },
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

