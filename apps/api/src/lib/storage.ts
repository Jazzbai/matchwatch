import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import { logger } from './logger';

export type StorageUploadPurpose = 'avatar' | 'venue_cover' | 'venue_gallery' | 'menu_item' | 'post';

export const STORAGE_MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.AWS_ACCESS_KEY_ID ? {
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    } : {}),
});

const BUCKET = process.env.S3_BUCKET || 'matchwatch-uploads';
const OBJECT_ACL = (() => {
    const raw = process.env.STORAGE_OBJECT_ACL?.trim();
    if (!raw) return null;
    if (raw.toLowerCase() === 'none' || raw.toLowerCase() === 'false') return null;
    return raw;
})();

function sanitizeActorId(actorId: string) {
    return actorId.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'anonymous';
}

export function getStorageBucket() {
    return BUCKET;
}

export function buildStoragePublicUrl(key: string) {
    return process.env.CDN_URL
        ? `${process.env.CDN_URL}/${key}`
        : `https://${BUCKET}.s3.amazonaws.com/${key}`;
}

export async function createPresignedUpload(params: {
    actorId: string;
    filename: string;
    contentType: string;
    purpose: StorageUploadPurpose;
    fileSize: number;
}) {
    const ext = params.filename.split('.').pop() || 'jpg';
    const actorPath = sanitizeActorId(params.actorId);
    const key = `${params.purpose}/${actorPath}/${nanoid(12)}.${ext}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ...(OBJECT_ACL ? { ACL: OBJECT_ACL as any } : {}),
        ContentType: params.contentType,
        Metadata: {
            actorId: actorPath,
            purpose: params.purpose,
            originalFilename: params.filename,
            fileSize: String(params.fileSize),
        },
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    return {
        uploadUrl,
        publicUrl: buildStoragePublicUrl(key),
        ...(OBJECT_ACL ? {
            uploadHeaders: {
                'x-amz-acl': OBJECT_ACL,
            },
        } : {}),
        key,
        expiresIn: 300,
    };
}

export async function deleteStorageObjects(rawKeys: Array<string | null | undefined>) {
    const keys = Array.from(new Set(
        rawKeys
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean),
    ));

    if (keys.length === 0) return { deletedCount: 0 };

    try {
        await s3.send(new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
                Objects: keys.map((Key) => ({ Key })),
                Quiet: true,
            },
        }));
        return { deletedCount: keys.length };
    } catch (err) {
        logger.error(
            { err, bucket: BUCKET, region: process.env.AWS_REGION || 'us-east-1', keys },
            'Failed to delete storage objects',
        );
        throw err;
    }
}
