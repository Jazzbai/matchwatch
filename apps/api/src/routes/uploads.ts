import { Hono } from 'hono';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { apiResponse, apiError } from '../lib/utils';
import { presignedUploadSchema } from '@matchwatch/shared';
import { authMiddleware } from '../middleware';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';

const uploadRoutes = new Hono();
uploadRoutes.use('*', authMiddleware);

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
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

async function createPresignedUpload(c: any) {
    const body = await c.req.json();
    const parsed = presignedUploadSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const user = c.get('user');
    const { filename, contentType, purpose, fileSize } = parsed.data;
    if (fileSize > MAX_FILE_SIZE) {
        return c.json(
            apiError('VALIDATION_ERROR', 'File too large. Max size is 4MB.'),
            400,
        );
    }
    const ext = filename.split('.').pop() || 'jpg';
    const key = `${purpose}/${user.id}/${nanoid(12)}.${ext}`;

    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: contentType,
            Metadata: {
                userId: user.id,
                purpose,
                originalFilename: filename,
                fileSize: String(fileSize),
            },
        });

        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
        const publicUrl = process.env.CDN_URL
            ? `${process.env.CDN_URL}/${key}`
            : `https://${BUCKET}.s3.amazonaws.com/${key}`;

        return c.json(apiResponse({
            uploadUrl: presignedUrl,
            publicUrl,
            key,
            expiresIn: 300,
        }));
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
            { err, bucket: BUCKET, region: process.env.AWS_REGION || 'us-east-1', hasAccessKey: Boolean(process.env.AWS_ACCESS_KEY_ID) },
            'Failed to generate upload presigned URL',
        );

        if (/credential|access key|secret/i.test(message)) {
            return c.json(
                apiError('UPLOAD_MISCONFIGURED', 'S3 credentials are missing or invalid. Configure AWS keys (or EC2 IAM role) and restart API.'),
                500,
            );
        }

        return c.json(apiError('INTERNAL_ERROR', 'Failed to generate upload URL'), 500);
    }
}

uploadRoutes.post('/presigned-url', createPresignedUpload);
uploadRoutes.post('/presigned', createPresignedUpload);

export default uploadRoutes;
