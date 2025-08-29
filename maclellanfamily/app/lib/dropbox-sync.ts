import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Dropbox, DropboxResponseError } from 'dropbox';
import fetch from 'cross-fetch';
import sharp from 'sharp';
import { adminDb } from './firebase-admin';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const dropbox = new Dropbox({
  clientId: process.env.DROPBOX_CLIENT_ID!,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN!,
  fetch
});

const sqsClient = process.env.SQS_QUEUE_URL
  ? new SQSClient({
      region: process.env.AWS_S3_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : undefined;

function ensureLeadingSlash(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

export interface SyncOptions {
  userFolderPath: string;
  pathPrefix?: string; // e.g., '0 US'
  recursive?: boolean;
}

export async function syncDropboxToS3(options: SyncOptions) {
  const prefix = options.pathPrefix ?? '0 US';
  const cleanUser = options.userFolderPath.replace(/^\/+|\/+$/g, '');
  const dropboxBase = ensureLeadingSlash(`${prefix}/${cleanUser}`);

  // Load saved cursor from Firestore (for incremental listing)
  const cursorDocRef = adminDb.collection('integrations').doc('dropbox');
  const cursorDoc = await cursorDocRef.get();
  let cursor: string | undefined = cursorDoc.exists ? (cursorDoc.data()?.cursor as string | undefined) : undefined;

  // If no cursor, start with filesListFolder
  if (!cursor) {
    const res = await dropbox.filesListFolder({
      path: dropboxBase,
      recursive: options.recursive ?? true,
      include_non_downloadable_files: false
    });
    await processEntries(res.result.entries, prefix, cleanUser);
    cursor = res.result.cursor;
  }

  // Drain changes using filesListFolderContinue
  let hasMore = true;
  while (hasMore && cursor) {
    const cont = await dropbox.filesListFolderContinue({ cursor });
    await processEntries(cont.result.entries, prefix, cleanUser);
    cursor = cont.result.cursor;
    hasMore = cont.result.has_more;
  }

  // Persist latest cursor
  await cursorDocRef.set({ cursor }, { merge: true });
}

async function processEntries(entries: any[], prefix: string, cleanUser: string) {
  for (const entry of entries) {
    if (entry['.tag'] === 'file') {
      const pathLower: string = entry.path_lower; // like /0 us/<user>/folder/file.jpg
      // Normalize to actual key casing segment after base
      const relative = pathLower.replace(/^\/+/, '').replace(/^0 us\//, '0 US/');
      const isImage = isImageFile(relative);
      const isVideo = isVideoFile(relative);
      if (!isImage && !isVideo) continue;
      const s3Key = relative.replace(/^0 US\//, `0 US/`); // keep same keying

      // If SQS is configured, enqueue job and skip inline processing (best for Vercel)
      if (sqsClient && process.env.SQS_QUEUE_URL) {
        await enqueueSqsJob({
          dropboxId: entry.id,
          path: `/${relative}`,
          type: isVideo ? 'video' : 'image',
          userFolderPath: cleanUser,
          imageSizes: [480, 960, 1600]
        });
        continue;
      }

      // Fallback inline processing for images only (dev/small files)
      if (isImage) {
        await mirrorFileToS3(entry.id, s3Key);
      }
    }
  }
}

function isImageFile(key: string) {
  const lower = key.toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => lower.endsWith(ext));
}

function isVideoFile(key: string) {
  const lower = key.toLowerCase();
  return ['.mp4', '.mov', '.m4v', '.avi', '.mkv'].some(ext => lower.endsWith(ext));
}

async function mirrorFileToS3(fileId: string, s3Key: string) {
  // Download content from Dropbox by file id
  const dl = await dropbox.filesDownload({ path: fileId });
  const fileBinary = (dl.result as any).fileBinary as ArrayBuffer | undefined;
  const fileBlob = (dl.result as any).fileBlob as Blob | undefined;

  let inputBuffer: Buffer;
  if (fileBinary) {
    inputBuffer = Buffer.from(fileBinary);
  } else if (fileBlob) {
    inputBuffer = Buffer.from(await fileBlob.arrayBuffer());
  } else {
    const file = (dl.result as any).file as ArrayBuffer | undefined;
    if (!file) return;
    inputBuffer = Buffer.from(file);
  }

  const compressed = await sharp(inputBuffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key,
    Body: compressed,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable'
  }));
}

async function enqueueSqsJob(payload: {
  dropboxId: string;
  path: string;
  type: 'image' | 'video';
  userFolderPath: string;
  imageSizes?: number[];
}) {
  if (!sqsClient || !process.env.SQS_QUEUE_URL) return;
  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify(payload)
  });
  await sqsClient.send(command);
}


