import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  FAB,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { TenantStackParamList } from '../../navigation/StackParam';
import { fetchTenantById, TenantRecord } from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient'; // ✅ REQUIRED
import { fetchRooms } from '../../service/RoomService';
import {
  fetchActiveRoomForTenants,
  fetchAllActiveRoomsForTenants,
} from '../../service/TenantRoomService';
import { trackEvent } from '../../service/analyticsTracker';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantView'>;

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

export default function TenantViewScreen() {
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<Props['navigation']>();
  const { tenantId } = route.params;
  const theme = useTheme();

  const [tenant, setTenant] = React.useState<TenantRecord | null>(null);
  const [profileSignedUrl, setProfileSignedUrl] = React.useState<
    string | undefined
  >();
  const [roomName, setRoomName] = React.useState<string>('No room assigned');
  const [joiningDateLine, setJoiningDateLine] = React.useState<
    string | undefined
  >();
  const [loading, setLoading] = React.useState(false);
  const skipNextReloadRef = React.useRef(false);
  const [sharingLabel, setSharingLabel] = React.useState<string | null>(null);
  const [downloadingLabel, setDownloadingLabel] = React.useState<string | null>(
    null,
  );
  const [profileDownloading, setProfileDownloading] = React.useState(false);

  const STORAGE_BUCKET = 'tenant-manager';

  const extractStoragePath = (fullUrlOrPath?: string | null) => {
    const s = String(fullUrlOrPath ?? '').trim();
    if (!s) return null;

    // Accept:
    // - public URL: .../storage/v1/object/public/<bucket>/<path>
    // - signed URL: .../storage/v1/object/sign/<bucket>/<path>?token=...
    // - already bucket-prefixed path: <bucket>/<path>
    // - raw path: <path>
    const marker = `/${STORAGE_BUCKET}/`;
    const idx = s.indexOf(marker);
    let p: string | null = null;

    if (idx !== -1) p = s.substring(idx + marker.length);
    else if (s.startsWith(`${STORAGE_BUCKET}/`))
      p = s.substring(STORAGE_BUCKET.length + 1);
    else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) p = s;

    if (!p) return null;
    // Strip query/hash (important if caller passes a signed URL).
    return p.split('?')[0].split('#')[0];
  };

  const createSignedUrl = async (fullUrl?: string | null) => {
    if (!fullUrl) return undefined;

    try {
      const filePath = extractStoragePath(fullUrl);
      if (!filePath) return undefined;

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, 60 * 60); // 1 hour

      if (error) {
        console.warn('Signed URL error:', error.message);
        return undefined;
      }

      return data.signedUrl;
    } catch {
      return undefined;
    }
  };

  const getExtFromUrl = (u: string) => {
    const cleaned = u.split('?')[0];
    const dot = cleaned.lastIndexOf('.');
    if (dot === -1) return '';
    const ext = cleaned.substring(dot + 1).toLowerCase();
    return ext.length <= 6 ? ext : '';
  };

  const getMimeFromExt = (ext: string) => {
    const e = (ext || '').toLowerCase();
    if (e === 'pdf') return 'application/pdf';
    if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
    if (e === 'png') return 'image/png';
    if (e === 'webp') return 'image/webp';
    if (e === 'heic' || e === 'heif') return 'image/heic';
    return 'application/octet-stream';
  };

  const safeFileToken = (input: string, fallback: string) => {
    const raw = String(input || '').trim();
    const token = (raw || fallback)
      .replace(/[^a-zA-Z0-9]+/g, '-') // spaces + symbols → "-"
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return token.length ? token : fallback;
  };

  const docKeyForLabel = (label: string) => {
    const s = String(label || '').trim().toLowerCase();
    if (s === 'aadhaar' || s === 'adhar' || s === 'aadhar') return 'adhar';
    if (s === 'pan') return 'pan';
    if (s === 'agreement') return 'agreement';
    return s.replace(/[^a-z0-9]+/g, '-').slice(0, 20) || 'document';
  };

  const buildDocFileName = (label: string, originalUrl?: string | null) => {
    const nameToken = safeFileToken(String(tenant?.name || ''), 'tenant');
    const docToken = docKeyForLabel(label);
    const ext = (getExtFromUrl(String(originalUrl || '')) || 'bin').toLowerCase();
    return { fileName: `${nameToken}-${docToken}.${ext}`, ext };
  };

  const toFileUrl = (u: string) => {
    const s = String(u ?? '').trim();
    if (!s) return '';
    // If it already has a scheme (file://, content://, http://, etc) keep it.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) return s;
    return `file://${s}`;
  };

  const requestAndroidGalleryPermissionIfNeeded = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const v = Number(Platform.Version) || 0;
      // Android 13+
      if (v >= 33) {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        );
        return res === PermissionsAndroid.RESULTS.GRANTED;
      }
      // Android 10-12: read permission is usually enough for CameraRoll operations
      if (v >= 29) {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
        return res === PermissionsAndroid.RESULTS.GRANTED;
      }
      // Android 9 and below
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      // Best-effort: if permission API fails, still attempt save.
      return true;
    }
  };

  const requestAndroidLegacyWritePermissionIfNeeded = async () => {
    if (Platform.OS !== 'android') return true;
    const v = Number(Platform.Version) || 0;
    // Scoped storage: Android 10+ doesn't need legacy write permission.
    if (v >= 29) return true;
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return true;
    }
  };

  const isImageMime = (mime?: string) =>
    !!mime && String(mime).toLowerCase().startsWith('image/');

  const downloadProfilePhoto = async () => {
    const rawUrl = (tenant as any)?.profile_photo_url as string | null | undefined;
    if (!rawUrl) {
      Alert.alert('Not available', 'Profile photo not uploaded');
      return;
    }

    try {
      setProfileDownloading(true);
      const signed = await createSignedUrl(rawUrl);
      if (!signed) {
        Alert.alert(
          'Download failed',
          'Could not generate a secure link. Please try again.',
        );
        return;
      }

      const safeBase = String(tenant?.name || 'tenant')
        .toLowerCase()
        .replace(/[^\w]+/g, '_')
        .slice(0, 40);
      // Profile photo must be treated as an image for Gallery/Photos save.
      const rawExt = getExtFromUrl(rawUrl) || '';
      const imgExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(
        rawExt.toLowerCase(),
      )
        ? rawExt.toLowerCase()
        : 'jpg';
      const fileName = `${safeBase || 'tenant'}_profile_photo.${imgExt}`;
      const mime = getMimeFromExt(imgExt);

      if (Platform.OS === 'android') {
        // Android: Save to Gallery / Photos (user-visible).
        // IMPORTANT: download to a path WITH an image extension,
        // otherwise Android infers application/octet-stream and rejects insertion.
        const destPath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;
        const res = await RNBlobUtil.config({
          path: destPath,
          fileCache: true,
          overwrite: true,
        }).fetch('GET', signed);

        const tempPath = res.path() || destPath;
        if (!tempPath) throw new Error('Download failed.');

        const fileUrl = toFileUrl(tempPath);
        if (!fileUrl) throw new Error('Could not prepare file for saving.');

        let saved = false;

        // 1) Try CameraRoll (most "Gallery-friendly")
        try {
          await CameraRoll.saveAsset(fileUrl, { type: 'photo' });
          saved = true;
        } catch {
          const ok = await requestAndroidGalleryPermissionIfNeeded();
          if (ok) {
            try {
              await CameraRoll.saveAsset(fileUrl, { type: 'photo' });
              saved = true;
            } catch {}
          }
        }

        // 2) Fallback to direct MediaStore insert
        if (!saved) {
          try {
            await RNBlobUtil.MediaCollection.copyToMediaStore(
              { name: fileName, mimeType: mime },
              'Image',
              tempPath,
            );
            saved = true;
          } catch {}
        }

        // Best-effort cleanup.
        try {
          await RNBlobUtil.fs.unlink(tempPath);
        } catch {}

        if (!saved) {
          Alert.alert(
            'Save failed',
            'Could not save to Gallery. Please allow Photos permission in Settings and try again.',
          );
          return;
        }

        trackEvent('Tenant_ProfilePhoto_Downloaded', {
          source: 'Tenant',
          tenant_id: tenantId,
        });
        Alert.alert('Saved', 'Profile photo saved to Gallery.');
        return;
      }

      // iOS: save directly to Photos (Camera Roll). Fallback to share sheet if permission denied.
      const destPath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;
      await RNBlobUtil.config({ path: destPath, fileCache: true }).fetch(
        'GET',
        signed,
      );
      const fileUrl = toFileUrl(destPath);
      if (!fileUrl) throw new Error('Could not prepare file for sharing.');

      trackEvent('Tenant_ProfilePhoto_Downloaded', {
        source: 'Tenant',
        tenant_id: tenantId,
      });
      try {
        await CameraRoll.saveAsset(fileUrl, { type: 'photo' });
        Alert.alert('Saved', 'Profile photo saved to Photos.');
      } catch {
        await Share.open({
          title: 'Profile photo',
          message: 'Tenant profile photo',
          urls: [fileUrl],
          type: mime,
          failOnCancel: false,
        });
      }
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not download photo');
    } finally {
      setProfileDownloading(false);
    }
  };

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTenantById(tenantId);
      if (!data) {
        Alert.alert('Not found', 'Tenant could not be loaded', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      setTenant(data);

      const [signed, rooms, activeMap, allRoomsMap] = await Promise.all([
        // 🔐 Signed URL for profile photo
        createSignedUrl((data as any).profile_photo_url),

        // Rooms list to resolve room_id → room_name
        fetchRooms(),

        // Active mapping for this tenant (leaving_date is null)
        fetchActiveRoomForTenants([tenantId]),

        // All active rooms for this tenant (for multi-room display)
        fetchAllActiveRoomsForTenants([tenantId]),
      ]);

      setProfileSignedUrl(signed);

      const roomNameById: Record<number, string> = {};
      (rooms || []).forEach((r: any) => {
        if (r?.id != null) roomNameById[r.id] = r.name || '-';
      });

      const allRooms = allRoomsMap?.[tenantId];
      if (allRooms?.rooms && allRooms.rooms.length > 0) {
        const roomNames = allRooms.rooms
          .map(r => roomNameById[r.room_id] || '-')
          .join(', ');
        setRoomName(roomNames);
        setJoiningDateLine(
          `Joined on ${formatDate(allRooms.rooms[0]?.joining_date)}`,
        );
      } else {
        setRoomName('No room assigned');
        setJoiningDateLine(undefined);
      }
    } catch (err: any) {
      Alert.alert('Load Failed', err.message || 'Could not load tenant', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      if (skipNextReloadRef.current) {
        skipNextReloadRef.current = false;
        return;
      }
      load();
    }, [load]),
  );

  if (loading || !tenant) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const openSignedDoc = async (label: string, url?: string | null) => {
    if (!url) {
      Alert.alert('Not available', 'Document not uploaded');
      return;
    }
    try {
      const signed = await createSignedUrl(url);
      if (!signed) {
        Alert.alert(
          'Open failed',
          'Could not generate a secure link. Please try again.',
        );
        return;
      }
      skipNextReloadRef.current = true;
      const viewedEvent = 'Tenant_Document_Viewed_' + label;
      trackEvent(viewedEvent, {
        source: 'Tenant',
        tenant_id: tenantId,
        document_label: label,
      });
      navigation.navigate('TenantDocument', { title: label, url: signed });
    } catch (err: any) {
      Alert.alert('Open failed', err?.message || 'Could not open document');
    }
  };

  const shareSignedDoc = async (label: string, url?: string | null) => {
    if (!url) {
      Alert.alert('Not available', 'Document not uploaded');
      return;
    }
    try {
      setSharingLabel(label);
      const signed = await createSignedUrl(url);
      if (!signed) {
        Alert.alert(
          'Share failed',
          'Could not generate a secure link. Please try again.',
        );
        return;
      }

      // Download to local temp file so native share sheet can offer:
      // - Save Image (for images)
      // - Save to Files (for PDFs)
      const { fileName, ext } = buildDocFileName(label, url);
      const destPath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;
      const mime = getMimeFromExt(ext);

      await RNBlobUtil.config({ path: destPath, fileCache: true }).fetch(
        'GET',
        signed,
      );
      const fileUrl = toFileUrl(destPath);
      if (!fileUrl) throw new Error('Could not prepare file for sharing.');

      const sharedEvent = 'Tenant_Document_Shared_' + label;
      trackEvent(sharedEvent, {
        source: 'Tenant',
        tenant_id: tenantId,
        document_label: label,
      });
      await Share.open({
        title: label,
        message: `${label} document`,
        urls: [fileUrl],
        type: mime,
        failOnCancel: false,
      });
    } catch (err: any) {
      Alert.alert('Share failed', err?.message || 'Could not share document');
    } finally {
      setSharingLabel(null);
    }
  };

  const downloadSignedDoc = async (label: string, url?: string | null) => {
    if (!url) {
      Alert.alert('Not available', 'Document not uploaded');
      return;
    }

    try {
      setDownloadingLabel(label);
      const signed = await createSignedUrl(url);
      if (!signed) {
        Alert.alert(
          'Download failed',
          'Could not generate a secure link. Please try again.',
        );
        return;
      }

      const { fileName, ext } = buildDocFileName(label, url);
      const mime = getMimeFromExt(ext);
      const treatAsImage = isImageMime(mime);

      if (Platform.OS === 'android') {
        // Download to a path WITH extension to preserve MIME inference.
        const cachePath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;
        const res = await RNBlobUtil.config({
          path: cachePath,
          fileCache: true,
          overwrite: true,
        }).fetch('GET', signed);
        const tempPath = res.path() || cachePath;
        if (!tempPath) throw new Error('Download failed.');

        if (treatAsImage) {
          // Save image to Gallery / Photos.
          const fileUrl = toFileUrl(tempPath);
          if (!fileUrl) throw new Error('Could not prepare file for saving.');

          let saved = false;
          try {
            await CameraRoll.saveAsset(fileUrl, { type: 'photo' });
            saved = true;
          } catch {
            const ok = await requestAndroidGalleryPermissionIfNeeded();
            if (ok) {
              try {
                await CameraRoll.saveAsset(fileUrl, { type: 'photo' });
                saved = true;
              } catch {}
            }
          }

          if (!saved) {
            try {
              await RNBlobUtil.MediaCollection.copyToMediaStore(
                { name: fileName, mimeType: mime },
                'Image',
                tempPath,
              );
              saved = true;
            } catch {}
          }

          // Best-effort cleanup.
          try {
            await RNBlobUtil.fs.unlink(tempPath);
          } catch {}

          if (!saved) {
            Alert.alert(
              'Save failed',
              'Could not save to Gallery. Please allow Photos permission in Settings and try again.',
            );
            return;
          }

          trackEvent('Tenant_Document_Downloaded_' + label, {
            source: 'Tenant',
            tenant_id: tenantId,
            document_label: label,
          });
          Alert.alert('Saved', `Saved to Gallery as “${fileName}”.`);
          return;
        }

        // Non-image: save to Files/Downloads (user-visible in Files apps).
        // Prefer MediaStore Downloads (shows up in Files apps reliably).
        // Fallback: Download Manager into public Downloads.
        let saved = false;
        let savedUri: string | null = null;
        let lastErrMsg = '';
        try {
          await requestAndroidLegacyWritePermissionIfNeeded();
          // Use create + write (more reliable than copyToMediaStore on some OEMs).
          const uri = await RNBlobUtil.MediaCollection.createMediafile(
            { name: fileName, parentFolder: '', mimeType: mime },
            'Download',
          );
          await RNBlobUtil.MediaCollection.writeToMediafile(uri, tempPath);
          saved = true;
          savedUri = uri;
        } catch (e: any) {
          lastErrMsg =
            e?.message || e?.toString?.() || 'Failed to save via MediaStore.';
        }

        if (saved) {
          // Cleanup temp cache file after successful MediaStore copy.
          try {
            await RNBlobUtil.fs.unlink(tempPath);
          } catch {}

          // Optional: offer to open the saved file to confirm success.
          // Some file managers take time to index Downloads; opening confirms it exists.
          Alert.alert('Saved', `Saved to Downloads as “${fileName}”.`, [
            { text: 'OK' },
            {
              text: 'Open',
              onPress: () => {
                if (savedUri) {
                  void RNBlobUtil.android
                    .actionViewIntent(savedUri, mime)
                    .catch(() => {});
                }
              },
            },
          ]);

          trackEvent('Tenant_Document_Downloaded_' + label, {
            source: 'Tenant',
            tenant_id: tenantId,
            document_label: label,
          });
          return;
        } else {
          // Fallback: Download Manager into the public Downloads directory.
          try {
            const destPath = `${RNBlobUtil.fs.dirs.DownloadDir}/${fileName}`;
            await RNBlobUtil.config({
              fileCache: true,
              addAndroidDownloads: {
                useDownloadManager: true,
                notification: true,
                mediaScannable: true,
                title: fileName,
                description: `${label} document`,
                mime,
                path: destPath,
              },
            }).fetch('GET', signed);
            // Verify the file actually exists where we think it is.
            const exists = await RNBlobUtil.fs.exists(destPath);
            if (exists) {
              // Ask media scanner to index it for file managers.
              try {
                await RNBlobUtil.fs.scanFile([{ path: destPath, mime } as any]);
              } catch {}
              // Register in Downloads app (helps visibility on some devices).
              try {
                await RNBlobUtil.android.addCompleteDownload({
                  title: fileName,
                  description: `${label} document`,
                  mime,
                  path: destPath,
                  showNotification: true,
                });
              } catch {}
              saved = true;
            } else {
              throw new Error('Download Manager did not create the file.');
            }
          } catch (e2: any) {
            lastErrMsg =
              (e2?.message || e2?.toString?.() || '') ||
              lastErrMsg ||
              'Failed to download via Download Manager.';
          }
        }

        if (!saved) {
          Alert.alert(
            'Save failed',
            `Could not save to Downloads.\n\n${lastErrMsg || ''}`.trim(),
          );
          return;
        }

        trackEvent('Tenant_Document_Downloaded_' + label, {
          source: 'Tenant',
          tenant_id: tenantId,
          document_label: label,
        });
        Alert.alert('Saved', `Saved to Downloads as “${fileName}”.`, [
          { text: 'OK' },
          {
            text: 'Open',
            onPress: () => {
              const destPath = `${RNBlobUtil.fs.dirs.DownloadDir}/${fileName}`;
              void RNBlobUtil.android
                .actionViewIntent(destPath, mime)
                .catch(() => {});
            },
          },
        ]);
        return;
      }

      // iOS: download to cache and open share sheet (Save to Files / Save Image).
      const destPath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;
      await RNBlobUtil.config({ path: destPath, fileCache: true }).fetch(
        'GET',
        signed,
      );
      const fileUrl = toFileUrl(destPath);
      if (!fileUrl) throw new Error('Could not prepare file for sharing.');

      trackEvent('Tenant_Document_Downloaded_' + label, {
        source: 'Tenant',
        tenant_id: tenantId,
        document_label: label,
      });
      await Share.open({
        title: label,
        message: `${label} document`,
        urls: [fileUrl],
        type: mime,
        failOnCancel: false,
      });
    } catch (err: any) {
      Alert.alert(
        'Download failed',
        err?.message || 'Could not download document',
      );
    } finally {
      setDownloadingLabel(null);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {/* HERO */}
        <Surface style={styles.hero} elevation={2}>
          <View style={styles.avatarWrap}>
            <AvatarDisplay uri={profileSignedUrl} size={88} />
            {(tenant as any)?.profile_photo_url ? (
              <IconButton
                icon={
                  profileDownloading
                    ? () => (
                        <ActivityIndicator
                          size={14}
                          color={theme.colors.primary}
                        />
                      )
                    : 'download'
                }
                size={16}
                onPress={() => {
                  Alert.alert('Profile photo', 'What would you like to do?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Download',
                      onPress: () => void downloadProfilePhoto(),
                    },
                  ]);
                }}
                disabled={profileDownloading}
                iconColor={theme.colors.primary}
                style={[
                  styles.avatarActionBtn,
                  {
                    backgroundColor: theme.colors.primaryContainer,
                    borderColor: theme.colors.primary,
                  },
                ]}
                accessibilityLabel="Download profile photo"
              />
            ) : null}
          </View>
          <View style={styles.heroText}>
            <Text variant="titleLarge" style={styles.tenantName}>
              {tenant.name}
            </Text>
            <Text style={styles.subText}>{roomName}</Text>
            {!!joiningDateLine && (
              <Text style={styles.subSubText}>{joiningDateLine}</Text>
            )}
          </View>
        </Surface>

        {/* PERSONAL INFO */}
        <Section title="Personal Information">
          <InfoRow icon="phone" label="Mobile" value={tenant.mobile} />
          <InfoRow
            icon="phone-plus"
            label="Alternate Mobile"
            value={tenant.alternate_mobile}
          />
          <InfoRow
            icon="account-group"
            label="Family Members"
            value={tenant.total_family_members}
          />
        </Section>

        {/* ADDRESS */}
        <Section title="Address & Work">
          <InfoRow icon="map-marker" label="Address" value={tenant.address} />
          <InfoRow
            icon="office-building"
            label="Company"
            value={tenant.company_name}
          />
        </Section>

        {/* DOCUMENTS */}
        <Section title="Documents">
          <View style={styles.docGrid}>
            <DocTile
              icon="card-account-details"
              label="Aadhaar"
              url={tenant.adhar_card_url}
              onPress={() => openSignedDoc('Aadhaar', tenant.adhar_card_url)}
              onShare={() => shareSignedDoc('Aadhaar', tenant.adhar_card_url)}
              onDownload={() =>
                downloadSignedDoc('Aadhaar', tenant.adhar_card_url)
              }
              sharing={sharingLabel === 'Aadhaar'}
              downloading={downloadingLabel === 'Aadhaar'}
              shareTone={{
                bg: theme.colors.primaryContainer,
                border: theme.colors.primary,
                icon: theme.colors.primary,
              }}
            />
            <DocTile
              icon="card-bulleted"
              label="PAN"
              url={tenant.pan_card_url}
              onPress={() => openSignedDoc('PAN', tenant.pan_card_url)}
              onShare={() => shareSignedDoc('PAN', tenant.pan_card_url)}
              onDownload={() => downloadSignedDoc('PAN', tenant.pan_card_url)}
              sharing={sharingLabel === 'PAN'}
              downloading={downloadingLabel === 'PAN'}
              shareTone={{
                bg: theme.colors.primaryContainer,
                border: theme.colors.primary,
                icon: theme.colors.primary,
              }}
            />
            <DocTile
              icon="file-document"
              label="Agreement"
              url={tenant.agreement_url}
              onPress={() => openSignedDoc('Agreement', tenant.agreement_url)}
              onShare={() => shareSignedDoc('Agreement', tenant.agreement_url)}
              onDownload={() =>
                downloadSignedDoc('Agreement', tenant.agreement_url)
              }
              sharing={sharingLabel === 'Agreement'}
              downloading={downloadingLabel === 'Agreement'}
              shareTone={{
                bg: theme.colors.primaryContainer,
                border: theme.colors.primary,
                icon: theme.colors.primary,
              }}
            />
          </View>
        </Section>
      </ScrollView>

      {/* FLOATING EDIT */}
      <FAB
        icon="pencil"
        style={styles.fab}
        onPress={() => {
          trackEvent('TenantView_To_TenantEdit_Navigation', {
            source: 'Tenant',
            tenant_id: tenantId,
          });
          navigation.navigate('TenantForm', { mode: 'edit', tenantId });
        }}
      />
    </>
  );
}

/* ---------------- UI COMPONENTS ---------------- */

const Section = ({ title, children }: any) => (
  <Surface style={styles.section} elevation={2}>
    <Text variant="titleMedium" style={styles.sectionTitle}>
      {title}
    </Text>
    {children}
  </Surface>
);

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: string | number | null;
}) => {
  if (!value) return null;

  return (
    <View style={styles.infoRow}>
      <IconButton icon={icon} size={18} style={styles.infoIcon} />

      {/* 🔑 THIS wrapper is mandatory */}
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{String(value)}</Text>
      </View>
    </View>
  );
};

const DocTile = ({
  icon,
  label,
  url,
  onPress,
  onShare,
  onDownload,
  sharing,
  downloading,
  shareTone,
}: {
  icon: string;
  label: string;
  url?: string | null;
  onPress: () => void;
  onShare: () => void;
  onDownload: () => void;
  sharing: boolean;
  downloading: boolean;
  shareTone: { bg: string; border: string; icon: string };
}) => (
  <Surface style={styles.docTile} elevation={1}>
    <View style={styles.docTileRow}>
      <View style={styles.docInfoRow}>
        <View style={styles.docIconWrap}>
          <IconButton icon={icon} size={22} style={styles.docIconBtn} />
        </View>
        <View style={styles.docTextCol}>
          <Text style={styles.docLabel} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
          {!url ? (
            <Text style={styles.muted} numberOfLines={1} ellipsizeMode="tail">
              Not uploaded
            </Text>
          ) : null}
        </View>
      </View>

      {url ? (
        <View style={styles.docActionsRow}>
          <IconButton
            icon="eye-outline"
            size={18}
            onPress={onPress}
            disabled={sharing || downloading}
            iconColor={shareTone.icon}
            style={[
              styles.docActionPill,
              { backgroundColor: shareTone.bg, borderColor: shareTone.border },
            ]}
            accessibilityLabel={`View ${label}`}
          />
          <IconButton
            icon={
              sharing
                ? () => <ActivityIndicator size={16} color={shareTone.icon} />
                : 'share-variant'
            }
            size={18}
            onPress={onShare}
            disabled={sharing || downloading}
            iconColor={shareTone.icon}
            style={[
              styles.docActionPill,
              { backgroundColor: shareTone.bg, borderColor: shareTone.border },
            ]}
            accessibilityLabel={`Share ${label}`}
          />
          <IconButton
            icon={
              downloading
                ? () => <ActivityIndicator size={16} color={shareTone.icon} />
                : 'file-download-outline'
            }
            size={18}
            onPress={onDownload}
            disabled={sharing || downloading}
            iconColor={shareTone.icon}
            style={[
              styles.docActionPill,
              { backgroundColor: shareTone.bg, borderColor: shareTone.border },
            ]}
            accessibilityLabel={`Download ${label}`}
          />
        </View>
      ) : null}
    </View>
  </Surface>
);

const AvatarDisplay = ({ uri, size }: { uri?: string; size: number }) =>
  uri ? (
    <Avatar.Image size={size} source={{ uri }} />
  ) : (
    <Avatar.Icon size={size} icon="account" />
  );

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 120,
    backgroundColor: '#F4F6FA',
  },

  hero: {
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroText: {
    flex: 1,
    marginLeft: 16,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarActionBtn: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    margin: 0,
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  tenantName: {
    fontWeight: '900',
    fontSize: 18,
    color: '#111827',
  },
  subText: {
    color: '#6B7280',
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
  },
  subSubText: {
    color: '#6B7280',
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
  },

  section: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 12,
    fontSize: 15,
    color: '#111827',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // 🔑 NOT center
    marginBottom: 12,
  },
  infoIcon: {
    margin: 0,
    marginRight: 8,
  },
  infoTextWrap: {
    flex: 1, // 🔑 REQUIRED for wrapping
    minWidth: 0, // 🔑 REQUIRED inside flex row
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },

  infoValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
    lineHeight: 20, // helps visual wrapping
    flexWrap: 'wrap', // safety
  },

  docGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  docTile: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 76,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  docTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docInfoRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    gap: 10,
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6FA',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  docIconBtn: { margin: 0 },
  docTextCol: { flex: 1, minWidth: 0 },
  docActionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docActionPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docLabel: {
    fontWeight: '900',
    fontSize: 15,
    color: '#111827',
  },
  muted: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
