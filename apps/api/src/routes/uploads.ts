import { Hono } from 'hono';
import { apiResponse, apiError } from '../lib/utils';
import { presignedUploadSchema } from '@matchwatch/shared';
import { authMiddleware } from '../middleware';
import { logger } from '../lib/logger';
import { deleteStorageObjects, STORAGE_MAX_FILE_SIZE, createPresignedUpload as createStoragePresignedUpload } from '../lib/storage';
import { z } from 'zod';

const uploadRoutes = new Hono();
uploadRoutes.use('*', authMiddleware);

const deleteUploadSchema = z.object({
    keys: z.array(z.string().min(1).max(500)).min(1).max(20),
});

async function createPresignedUpload(c: any) {
    const body = await c.req.json();
    const parsed = presignedUploadSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const user = c.get('user');
    const { filename, contentType, purpose, fileSize } = parsed.data;
    if (fileSize > STORAGE_MAX_FILE_SIZE) {
        return c.json(
            apiError('VALIDATION_ERROR', 'File too large. Max size is 4MB.'),
            400,
        );
    }

    try {
        return c.json(apiResponse(await createStoragePresignedUpload({
            actorId: user.id,
            filename,
            contentType,
            purpose,
            fileSize,
        })));
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
            { err, bucket: process.env.S3_BUCKET || 'matchwatch-uploads', region: process.env.AWS_REGION || 'us-east-1', hasAccessKey: Boolean(process.env.AWS_ACCESS_KEY_ID) },
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

async function deleteUploadObjects(c: any) {
    const body = await c.req.json().catch(() => ({}));
    const parsed = deleteUploadSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    try {
        const result = await deleteStorageObjects(parsed.data.keys);
        return c.json(apiResponse(result));
    } catch {
        return c.json(apiError('INTERNAL_ERROR', 'Failed to delete upload objects'), 500);
    }
}

uploadRoutes.post('/presigned-url', createPresignedUpload);
uploadRoutes.post('/presigned', createPresignedUpload);
uploadRoutes.post('/delete-objects', deleteUploadObjects);
uploadRoutes.delete('/objects', deleteUploadObjects);

export default uploadRoutes;
