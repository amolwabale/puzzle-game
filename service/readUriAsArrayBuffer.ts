import ReactNativeBlobUtil from 'react-native-blob-util';

function base64ToUint8Array(base64: string, maxBytes?: number) {
  // Remove any data URL prefix.
  const clean = String(base64 || '')
    .replace(/^data:.*;base64,/, '')
    .replace(/\s+/g, '');

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = clean;
  let outputLen = (str.length * 3) / 4;
  if (str.endsWith('==')) outputLen -= 2;
  else if (str.endsWith('=')) outputLen -= 1;
  outputLen = Math.max(0, Math.floor(outputLen));

  if (maxBytes != null && Number.isFinite(maxBytes) && outputLen > maxBytes) {
    const mb = Math.round((Number(maxBytes) / (1024 * 1024)) * 10) / 10;
    throw new Error(`File too large. Please choose a file smaller than ${mb} MB.`);
  }

  const bytes = new Uint8Array(outputLen);

  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (let i = 0; i < str.length; i += 1) {
    const c = str.charAt(i);
    const val = chars.indexOf(c);
    if (val < 0) continue;

    buffer = (buffer << 6) | (val & 0x3f);
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      if (index < bytes.length) {
        bytes[index] = (buffer >> bits) & 0xff;
        index += 1;
      }
    }
  }

  return bytes;
}

/**
 * Read a local file URI into an ArrayBuffer.
 * Works for:
 * - Android: `content://...` (DocumentPicker/ImagePicker)
 * - iOS: `file://...`
 * - Android/iOS: absolute paths like `/data/...`
 */
export async function readUriAsArrayBuffer(
  uri: string,
  opts?: { maxBytes?: number },
): Promise<ArrayBuffer> {
  const raw = String(uri || '').trim();
  if (!raw) throw new Error('Missing file URI');

  // For fs.readFile:
  // - keep `content://` as-is
  // - strip `file://` to a path
  // - keep raw paths as-is
  const fsPath = raw.startsWith('file://') ? raw.replace('file://', '') : raw;

  let b64: string | null = null;

  try {
    b64 = await ReactNativeBlobUtil.fs.readFile(fsPath, 'base64');
  } catch {
    // Fallback: use blob-util fetch (handles content:// on Android well).
    const fetchUri = raw.startsWith('content://')
      ? raw
      : raw.startsWith('file://')
      ? raw
      : `file://${raw}`;
    b64 = await ReactNativeBlobUtil.fetch('GET', fetchUri).then((r) => r.base64());
  }

  const u8 = base64ToUint8Array(b64 || '', opts?.maxBytes);
  if (!u8.byteLength) throw new Error('Selected file is empty or unreadable');

  // Slice to exact view to avoid extra bytes.
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

