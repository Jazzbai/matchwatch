import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { isYoutubeRecapSearchEnabled, processRecentFinishedMatchRecaps } from '../lib/youtubeRecaps';

const QUEUE_NAME = 'youtubeRecapSync';
const DEFAULT_RECAP_CRON = '0 12 * * *';
const DEFAULT_RECAP_LIMIT = 12;
const DEFAULT_RECAP_LEAGUES = ['mls'];

let youtubeRecapQueueInstance: Queue | null = null;

export function getYoutubeRecapQueue() {
    if (!youtubeRecapQueueInstance) {
        youtubeRecapQueueInstance = new Queue(QUEUE_NAME, {
            connection: redis,
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: 'exponential', delay: 10000 },
                removeOnComplete: 50,
                removeOnFail: 50,
            },
        });
    }
    return youtubeRecapQueueInstance;
}

export async function scheduleYoutubeRecapSync() {
    if (!isYoutubeRecapSearchEnabled()) {
        logger.warn('YouTube recap worker disabled because YOUTUBE_API_KEY is not configured');
        return;
    }

    const queue = getYoutubeRecapQueue();
    const pattern = process.env.YOUTUBE_RECAP_CRON?.trim() || DEFAULT_RECAP_CRON;
    const existingJobs = await queue.getRepeatableJobs();
    for (const job of existingJobs) {
        await queue.removeRepeatableByKey(job.key);
    }

    await queue.add('recent-finished-recaps', {}, {
        repeat: { pattern },
        jobId: 'recent-finished-recaps',
    });

    logger.info({ pattern }, 'YouTube recap sync scheduled');
}

export function startYoutubeRecapWorker() {
    if (!isYoutubeRecapSearchEnabled()) {
        logger.warn('YouTube recap worker not started because YOUTUBE_API_KEY is not configured');
        return null;
    }

    const worker = new Worker(QUEUE_NAME, async (job) => {
        logger.info({ jobId: job.id, jobName: job.name }, 'Starting YouTube recap sync job');
        return processRecentFinishedMatchRecaps({
            limit: Number(process.env.YOUTUBE_RECAP_BATCH_LIMIT || DEFAULT_RECAP_LIMIT),
            leagueSlugs: (process.env.YOUTUBE_RECAP_LEAGUES || DEFAULT_RECAP_LEAGUES.join(','))
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
        });
    }, {
        connection: redis,
        concurrency: 1,
        limiter: { max: 1, duration: 30000 },
    });

    worker.on('completed', (job) => {
        logger.info({ jobId: job.id, jobName: job.name }, 'YouTube recap sync job completed');
    });

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'YouTube recap sync job failed');
    });

    logger.info('YouTube recap worker started');
    return worker;
}

export async function triggerYoutubeRecapSync(options: { limit?: number; forceRefresh?: boolean; matchIds?: string[]; leagueSlugs?: string[] } = {}) {
    if (!isYoutubeRecapSearchEnabled()) {
        throw new Error('YOUTUBE_API_KEY is not configured');
    }
    return processRecentFinishedMatchRecaps(options);
}
