import { logger } from './logger';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY?.trim();
const RECAPTCHA_MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || '0.5');

type VerifyRecaptchaParams = {
    token?: string;
    expectedAction: string;
    remoteIp?: string;
};

type VerifyRecaptchaResponse = {
    success: boolean;
    score?: number;
    action?: string;
    hostname?: string;
    challenge_ts?: string;
    'error-codes'?: string[];
};

export class RecaptchaVerificationError extends Error {
    code: string;
    status: number;
    details?: unknown;

    constructor(code: string, message: string, status: number, details?: unknown) {
        super(message);
        this.name = 'RecaptchaVerificationError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

export function getRequestIp(headers: Headers) {
    const cfConnectingIp = headers.get('cf-connecting-ip')?.trim();
    if (cfConnectingIp) return cfConnectingIp;

    const xForwardedFor = headers.get('x-forwarded-for');
    if (xForwardedFor) {
        const first = xForwardedFor.split(',')[0]?.trim();
        if (first) return first;
    }

    const xRealIp = headers.get('x-real-ip')?.trim();
    if (xRealIp) return xRealIp;

    return undefined;
}

function shouldBypassRecaptcha() {
    return !RECAPTCHA_SECRET_KEY && process.env.NODE_ENV !== 'production';
}

export async function verifyRecaptchaToken({ token, expectedAction, remoteIp }: VerifyRecaptchaParams) {
    if (shouldBypassRecaptcha()) {
        logger.warn({ expectedAction }, 'reCAPTCHA verification bypassed because RECAPTCHA_SECRET_KEY is not configured outside production');
        return { success: true, skipped: true } as const;
    }

    if (!RECAPTCHA_SECRET_KEY) {
        throw new RecaptchaVerificationError(
            'RECAPTCHA_NOT_CONFIGURED',
            'Login and signup security checks are not configured.',
            503,
        );
    }

    if (!token) {
        throw new RecaptchaVerificationError(
            'RECAPTCHA_REQUIRED',
            'Please complete the security check and try again.',
            400,
        );
    }

    const body = new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
    });

    if (remoteIp) {
        body.set('remoteip', remoteIp);
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });

    if (!response.ok) {
        throw new RecaptchaVerificationError(
            'RECAPTCHA_UNAVAILABLE',
            'Security verification is temporarily unavailable. Please try again.',
            502,
        );
    }

    const result = await response.json() as VerifyRecaptchaResponse;

    if (!result.success) {
        throw new RecaptchaVerificationError(
            'RECAPTCHA_FAILED',
            'Security verification failed. Please try again.',
            400,
            result['error-codes'],
        );
    }

    if (result.action && result.action !== expectedAction) {
        throw new RecaptchaVerificationError(
            'RECAPTCHA_ACTION_MISMATCH',
            'Security verification did not match this action. Please try again.',
            400,
            { expectedAction, receivedAction: result.action },
        );
    }

    if (typeof result.score === 'number' && result.score < RECAPTCHA_MIN_SCORE) {
        throw new RecaptchaVerificationError(
            'RECAPTCHA_LOW_SCORE',
            'Security verification could not be completed. Please try again.',
            400,
            { score: result.score, minimum: RECAPTCHA_MIN_SCORE },
        );
    }

    return result;
}
