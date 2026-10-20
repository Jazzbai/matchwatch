import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
const client = (browser = false) => new S3Client({ region: process.env.AWS_REGION || 'us-east-1',
  ...((browser ? process.env.STREAM_S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT : process.env.S3_ENDPOINT) ? { endpoint: browser ? process.env.STREAM_S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT : process.env.S3_ENDPOINT, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED' as const } : {}),
  ...(process.env.AWS_ACCESS_KEY_ID ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' } } : {}),
});
const bucket = () => process.env.STREAM_S3_BUCKET || 'matchwatch-recordings';
export const videoStorageReady = () => Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.STREAM_S3_BUCKET);
export async function videoUpload(key: string, type: string, owner: string, size: number) {
  return getSignedUrl(client(true), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: type, ContentLength: size, Metadata: { owner } }), { expiresIn: 900, unhoistableHeaders: new Set(['x-amz-meta-owner']) });
}
export async function verifyVideoUpload(key: string, type: string, size: number, owner: string) {
  const object = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  return object.ContentType === type && object.ContentLength === size && object.Metadata?.owner === owner;
}
export async function videoPlayback(key: string) {
  return getSignedUrl(client(true), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 3600 });
}
export async function removeVideo(key: string) { await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })); }
// Multipart upload keeps long game recordings out of API memory and avoids temporary disk files.
export async function archiveVideo(key: string, body: ReadableStream<Uint8Array>, owner: string) {
  const s3 = client(); const params = { Bucket: bucket(), Key: key };
  const started = await s3.send(new CreateMultipartUploadCommand({ ...params, ContentType: 'video/mp4', Metadata: { owner } }));
  const upload = { ...params, UploadId: started.UploadId };
  const parts: { ETag: string; PartNumber: number }[] = []; let bytes = 0;
  const reader = body.getReader(); let chunks: Buffer[] = []; let pending = 0;
  async function flush() {
    const r = await s3.send(new UploadPartCommand({ ...upload, PartNumber: parts.length + 1, Body: Buffer.concat(chunks, pending) }));
    if (!r.ETag) throw new Error('UPLOAD_PART_FAILED');
    parts.push({ ETag: r.ETag, PartNumber: parts.length + 1 }); chunks = []; pending = 0;
  }
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 2 * 1024 ** 3) throw new Error('RECORDING_TOO_LARGE');
      chunks.push(Buffer.from(next.value)); pending += next.value.byteLength;
      if (pending >= 8 * 1024 ** 2) await flush();
    }
    if (pending) await flush(); if (!parts.length) throw new Error('EMPTY_RECORDING');
    await s3.send(new CompleteMultipartUploadCommand({ ...upload, MultipartUpload: { Parts: parts } }));
    return bytes;
  } catch (error) {
    await s3.send(new AbortMultipartUploadCommand(upload)).catch(() => {}); throw error;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
