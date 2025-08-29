import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { SQSRecord, SQSEvent, Context } from 'aws-lambda';
import { Dropbox } from 'dropbox';
import fetch from 'cross-fetch';
import sharp from 'sharp';
import { MediaConvertClient, CreateJobCommand } from '@aws-sdk/client-mediaconvert';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const mediaconvert = new MediaConvertClient({ region: process.env.AWS_REGION, endpoint: process.env.MEDIACONVERT_ENDPOINT });

const dropbox = new Dropbox({
  clientId: process.env.DROPBOX_CLIENT_ID!,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN!,
  fetch
});

const BUCKET = process.env.AWS_S3_BUCKET!;

type JobPayload = {
  dropboxId: string;
  path: string; // e.g. /0 US/user/album/file.jpg
  type: 'image' | 'video';
  userFolderPath: string;
  imageSizes?: number[];
};

export const handler = async (event: SQSEvent, _context: Context) => {
  for (const record of event.Records) {
    const payload = JSON.parse(record.body) as JobPayload;
    if (payload.type === 'image') {
      await processImage(payload);
    } else if (payload.type === 'video') {
      await processVideo(payload);
    }
  }
};

async function processImage(payload: JobPayload) {
  const dl = await dropbox.filesDownload({ path: payload.dropboxId });
  const fileBlob = (dl.result as any).fileBlob as Blob | undefined;
  const fileBinary = (dl.result as any).fileBinary as ArrayBuffer | undefined;
  let inputBuffer: Buffer;
  if (fileBinary) inputBuffer = Buffer.from(fileBinary);
  else if (fileBlob) inputBuffer = Buffer.from(await fileBlob.arrayBuffer());
  else {
    const file = (dl.result as any).file as ArrayBuffer | undefined;
    if (!file) return;
    inputBuffer = Buffer.from(file);
  }

  // Upload original (compressed) and size variants
  const baseKey = payload.path.replace(/^\/+/, ''); // 0 US/.../file.jpg
  const { dir, name } = splitKey(baseKey);
  const sizes = payload.imageSizes ?? [960, 1600];

  // original compressed
  const original = await sharp(inputBuffer)
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  await putS3(`${dir}/${name}.jpg`, original, 'image/jpeg');

  for (const width of sizes) {
    const variant = await sharp(inputBuffer)
      .resize(width, width, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    await putS3(`${dir}/${name}_w${width}.jpg`, variant, 'image/jpeg');
  }
}

async function processVideo(payload: JobPayload) {
  // Step 1: stream original to S3 (multipart)
  const tempLink = await dropbox.filesGetTemporaryLink({ path: payload.dropboxId });
  const url = tempLink.result.link;
  const baseKey = payload.path.replace(/^\/+/, '');
  const { dir, name } = splitKey(baseKey);
  const originalKey = `${dir}/${name}` + getExtensionFromPath(baseKey);

  await streamUrlToS3(url, BUCKET, originalKey, getContentTypeFromExt(originalKey));

  // Step 2: create MediaConvert HLS job
  const destination = `s3://${BUCKET}/${dir}/outputs/${name}/`;
  const job = buildHlsJob(originalKey, destination);
  await mediaconvert.send(new CreateJobCommand(job));
}

function buildHlsJob(inputKey: string, destination: string) {
  return {
    Role: process.env.MEDIACONVERT_ROLE_ARN!,
    Settings: {
      TimecodeConfig: { Source: 'ZEROBASED' },
      Inputs: [
        {
          FileInput: `s3://${BUCKET}/${inputKey}`,
          AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } },
          VideoSelector: {}
        }
      ],
      OutputGroups: [
        {
          Name: 'HLS Group',
          OutputGroupSettings: {
            Type: 'HLS_GROUP_SETTINGS',
            HlsGroupSettings: {
              Destination: destination,
              SegmentLength: 6,
              MinSegmentLength: 0,
              ManifestDurationFormat: 'INTEGER',
              CodecSpecification: 'RFC_4281',
              DirectoryStructure: 'SINGLE_DIRECTORY',
              ManifestCompression: 'NONE',
              ClientCache: 'ENABLED'
            }
          },
          Outputs: [
            hlsVideoOutput(1920, 'H264', 5000000, 1920, 1080),
            hlsVideoOutput(1280, 'H264', 3000000, 1280, 720),
            hlsVideoOutput(854, 'H264', 1200000, 854, 480),
            hlsAudioOutput()
          ]
        }
      ]
    }
  } as const;
}

function hlsVideoOutput(maxBitrate: number, codec: 'H264', bitrate: number, width: number, height: number) {
  return {
    VideoDescription: {
      CodecSettings: {
        Codec: codec,
        H264Settings: {
          Bitrate: bitrate,
          RateControlMode: 'CBR',
          CodecLevel: 'AUTO',
          CodecProfile: 'MAIN',
          MaxBitrate: maxBitrate,
          GopSize: 2,
          GopSizeUnits: 'SECONDS',
          NumberBFramesBetweenReferenceFrames: 2,
          AdaptiveQuantization: 'HIGH',
          SceneChangeDetect: 'TRANSITION_DETECTION'
        }
      },
      Width: width,
      Height: height
    },
    ContainerSettings: { Container: 'M3U8' },
    NameModifier: `_${height}p`
  } as const;
}

function hlsAudioOutput() {
  return {
    AudioDescriptions: [
      {
        CodecSettings: {
          Codec: 'AAC',
          AacSettings: { Bitrate: 96000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 }
        }
      }
    ],
    ContainerSettings: { Container: 'M3U8' },
    NameModifier: '_audio'
  } as const;
}

function splitKey(key: string) {
  const parts = key.split('/');
  const file = parts.pop() as string;
  const dir = parts.join('/');
  const dot = file.lastIndexOf('.');
  const name = dot > -1 ? file.slice(0, dot) : file;
  return { dir, name };
}

function getExtensionFromPath(key: string) {
  const dot = key.lastIndexOf('.');
  return dot > -1 ? key.slice(dot) : '';
}

function getContentTypeFromExt(key: string) {
  const ext = getExtensionFromPath(key).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.m4v') return 'video/x-m4v';
  return 'application/octet-stream';
}

async function putS3(key: string, body: Buffer, contentType: string) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable'
    }
  });
  await upload.done();
}

async function streamUrlToS3(url: string, bucket: string, key: string, contentType: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Failed to fetch Dropbox temporary link');
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: res.body as any,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable'
    }
  });
  await upload.done();
}


