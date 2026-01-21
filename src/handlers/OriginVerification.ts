/**
 * Origin verification utility for validating CloudFront requests
 */

import { LambdaFunctionUrlEvent, LambdaFunctionUrlResult } from './DashboardTypes';

export interface OriginVerificationResult {
  isValid: boolean;
  errorResponse?: LambdaFunctionUrlResult;
}

/**
 * Validates that a request originated from CloudFront by checking the origin verification header
 */
export function verifyOriginHeader(event: LambdaFunctionUrlEvent): OriginVerificationResult {
  const expectedSecret = process.env.ORIGIN_VERIFY_SECRET;

  const isLambdaEnvironment = (): boolean => {
    return !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  }

  if ( ! isLambdaEnvironment()) {
    // If not Lambda environment, skip verification (might be running locally or in a test environment).
    return { isValid: true };
  }
  
  if (!expectedSecret) {
    console.error('ORIGIN_VERIFY_SECRET environment variable not set');
    return {
      isValid: false,
      errorResponse: {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Server configuration error',
          message: 'Origin verification not configured'
        }),
      }
    };
  }

  const originVerifyHeader = event.headers['X-Origin-Verify'] || event.headers['x-origin-verify'];
  
  if (!originVerifyHeader) {
    console.warn('Request blocked: Missing X-Origin-Verify header', {
      sourceIp: event.requestContext?.http?.sourceIp,
      userAgent: event.headers['User-Agent'] || 'Unknown',
      path: event.rawPath
    });
    
    return {
      isValid: false,
      errorResponse: {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Access Denied',
          message: 'Direct access not allowed'
        }),
      }
    };
  }

  if (originVerifyHeader !== expectedSecret) {
    console.warn('Request blocked: Invalid X-Origin-Verify header', {
      sourceIp: event.requestContext?.http?.sourceIp,
      userAgent: event.headers['User-Agent'] || 'Unknown',
      path: event.rawPath,
      headerValue: originVerifyHeader.substring(0, 10) + '...' // Log partial value for debugging
    });
    
    return {
      isValid: false,
      errorResponse: {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Access Denied',
          message: 'Invalid origin verification'
        }),
      }
    };
  }

  return { isValid: true };
}

/**
 * Middleware wrapper that applies origin verification to any handler
 */
export function withOriginVerification(
  handler: (event: LambdaFunctionUrlEvent) => Promise<LambdaFunctionUrlResult>
) {
  return async (event: LambdaFunctionUrlEvent): Promise<LambdaFunctionUrlResult> => {
    const verification = verifyOriginHeader(event);
    
    if (!verification.isValid && verification.errorResponse) {
      return verification.errorResponse;
    }
    
    return handler(event);
  };
}