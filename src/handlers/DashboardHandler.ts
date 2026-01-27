import Mustache from 'mustache';
import { Authenticator } from '../services/Authentication';
import { Request } from '../services/Request';
import { ServiceProvider } from '../services/ServiceProvider';
import { TemplateService } from '../services/TemplateService';
import { DashboardCache } from './DashboardCache';
import { LambdaFunctionUrlEvent, LambdaFunctionUrlResult } from './DashboardTypes';
import { OriginHeader } from './OriginVerification';
// import { ConfigManager } from 'integration-huron-person';

let cache: DashboardCache = new DashboardCache();

/**
 * Lambda event handler for the Integration Dashboard
 * Supports multiple routes and operations via path-based routing
 */
export const handler = async (event: LambdaFunctionUrlEvent): Promise<LambdaFunctionUrlResult> => {
  console.log('Dashboard handler invoked:', JSON.stringify(event, null, 2));
  
  try {
    // Get request object to handle auth and origin verification
    const request = new Request(new Authenticator(event), new OriginHeader(event));
    const {path, body, queryParams } = request;

    // Verify origin header to ensure request came from CloudFront
    if ( ! request.originVerified) {
      console.log('Request origin verification failed. Returning error response.');
      return request.getOriginVerifiedErrorResponse()!;
    }

    // Verify authentication if required
    if ( ! request.isAuthenticated && path.startsWith('/api/')) {
      return createResponse(400, 'application/json', JSON.stringify({ 
        error: 'Request is not authenticated. Requires valid JWT token.' 
      }));
    }
   
    // Route handling
    switch (path) {
      case '/': case '/dashboard':
        if ( ! request.isAuthenticated) {
          console.log('Request is not authenticated. Returning login response.');
          return { statusCode: 302, headers: {
            ["content-type"]: "text/html",
            Location: '/login-page'
          }}

        }
        return await renderDashboard(queryParams.tab);

      case '/login-page':
        if(request.isAuthenticated) {
          return { statusCode: 302, headers: {
            ["content-type"]: "text/html",
            Location: '/dashboard'
          }}
        }
        return await renderLoginPage();

      case '/login-redirect':
        if(request.isAuthenticated) {
          return { statusCode: 302, headers: {
            ["content-type"]: "text/html",
            Location: '/dashboard'
          }}
        }
        return request.getLoginResponse();
      
      case '/api/person-lookup':
        return await handlePersonLookup({requestBody: body, cache });
      
      case '/api/person-sync':
        return await handlePersonSync({requestBody: body, cache });
      
      case '/api/bulk-sync':
        return await handleBulkSync({requestBody: body, cache });
      
      case '/api/history':
        return await getHistory({queryParams, cache});
      
      case '/api/status':
        return await getSystemStatus({ cache });
      
      default:
        return createResponse(404, 'text/html', '<h1>404 - Page Not Found</h1>');
    }
  } catch (error) {
    console.error('Dashboard handler error:', error);
    return createResponse(500, 'application/json', JSON.stringify({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
};

/**
 * Render the main dashboard HTML with tabs
 */
async function renderDashboard(activeTab?: string): Promise<LambdaFunctionUrlResult> {
  try {
    const template = TemplateService.getDashboardTemplate();
    const partials = TemplateService.getPartials();
    const cssAssets = TemplateService.getCssAssets();
    const jsAssets = TemplateService.getJsAssets();
    
    const data = {
      title: 'Integration Dashboard - Boston University Person → Huron',
      activeTab: activeTab || 'individual',
      tabs: [
        { id: 'individual', label: 'Individual Sync', active: (activeTab || 'individual') === 'individual' },
        { id: 'bulk', label: 'Bulk Operations', active: activeTab === 'bulk' },
        { id: 'history', label: 'Activity History', active: activeTab === 'history' },
        { id: 'system', label: 'System Status', active: activeTab === 'system' }
      ],
      individualActive: (activeTab || 'individual') === 'individual',
      bulkActive: activeTab === 'bulk',
      historyActive: activeTab === 'history',
      systemActive: activeTab === 'system',
      currentTime: new Date().toISOString(),
      cssAssets,
      jsAssets
    };
    
    const html = Mustache.render(template, data, partials);
    return createResponse(200, 'text/html', html);
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    return createResponse(500, 'text/html', '<h1>Error Loading Dashboard</h1>');
  }
}

async function renderLoginPage(): Promise<LambdaFunctionUrlResult> {
  try {
    const template = TemplateService.getLoginTemplate();
    const cssAssets = TemplateService.getCssAssets();
    
    const data = {
      title: 'Integration Dashboard - Boston University Person → Huron',
      currentTime: new Date().toISOString(),
      cssAssets
    };
    
    const html = Mustache.render(template, data);
    return createResponse(200, 'text/html', html);
  } catch (error) {
    console.error('Error rendering login page:', error);
    return createResponse(500, 'text/html', '<h1>Error Loading Login Page</h1>');
  }
}

/**
 * Handle person lookup by BUID or other identifier
 */
async function handlePersonLookup(params: { requestBody: string | null, cache: DashboardCache }): Promise<LambdaFunctionUrlResult> {
  const { requestBody, cache } = params;
  if (!requestBody) {
    return createResponse(400, 'application/json', JSON.stringify({ error: 'Request body required' }));
  }

  try {
    const { personId, system, searchType, firstName, lastName } = JSON.parse(requestBody);
    
    if (!personId) {
      return createResponse(400, 'application/json', JSON.stringify({ error: 'personId is required' }));
    }

    const config = await cache.getConfiguration();
    const personLookupService = ServiceProvider.getPersonLookupService(config);
    const personLookupResult = await personLookupService.lookup({
      personId, system, searchType, firstName, lastName
    });

    return createResponse(200, 'application/json', JSON.stringify(personLookupResult));
  } catch (error) {
    console.error('Error in person lookup:', error);
    return createResponse(500, 'application/json', JSON.stringify({ 
      error: 'Lookup failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }));
  }
}

/**
 * Handle individual person synchronization
 */
async function handlePersonSync(params: { requestBody: string | null, cache: DashboardCache }): Promise<LambdaFunctionUrlResult> {
  const { requestBody, cache } = params;
  if (!requestBody) {
    return createResponse(400, 'application/json', JSON.stringify({ error: 'Request body required' }));
  }

  try {
    const { personId, operation } = JSON.parse(requestBody);
    
    if (!personId || !operation) {
      return createResponse(400, 'application/json', JSON.stringify({ 
        error: 'personId and operation are required' 
      }));
    }

    // TODO: Implement actual sync using SinglePersonSync
    // const syncResult = await SinglePersonSync.sync(personId, operation);
    
    const config = await cache.getConfiguration();
    const personSyncService = ServiceProvider.getPersonSyncService(config);
    const mockResult = await personSyncService.sync(personId, operation);

    return createResponse(200, 'application/json', JSON.stringify(mockResult));
  } catch (error) {
    console.error('Error in person sync:', error);
    return createResponse(500, 'application/json', JSON.stringify({ 
      error: 'Sync failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }));
  }
}

/**
 * Handle bulk synchronization operations
 */
async function handleBulkSync(params: { requestBody: string | null, cache: DashboardCache }): Promise<LambdaFunctionUrlResult> {
  const { requestBody, cache } = params;
  if (!requestBody) {
    return createResponse(400, 'application/json', JSON.stringify({ error: 'Request body required' }));
  }

  try {
    const { operation, batchSize, filters } = JSON.parse(requestBody);
    
    // TODO: Implement actual bulk sync
    const config = await cache.getConfiguration();
    const bulkSyncService = ServiceProvider.getBulkSyncService(config);
    const mockResult = await bulkSyncService.start(operation, batchSize, filters);

    return createResponse(200, 'application/json', JSON.stringify(mockResult));
  } catch (error) {
    console.error('Error in bulk sync:', error);
    return createResponse(500, 'application/json', JSON.stringify({ 
      error: 'Bulk sync failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }));
  }
}

/**
 * Get activity history from S3 or database
 */
async function getHistory(params: { queryParams: any, cache: DashboardCache }): Promise<LambdaFunctionUrlResult> {
  const { queryParams, cache } = params;
  try {
    const { startDate, endDate, limit = 50 } = queryParams;
    
    // TODO: Implement actual S3 history retrieval
    const config = await cache.getConfiguration();
    const historyService = ServiceProvider.getHistoryService(config);
    const historyData = await historyService.getHistory(startDate, endDate, limit);

    return createResponse(200, 'application/json', JSON.stringify(historyData));
  } catch (error) {
    console.error('Error getting history:', error);
    return createResponse(500, 'application/json', JSON.stringify({ 
      error: 'Failed to retrieve history', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }));
  }
}

/**
 * Get current system status and health
 */
async function getSystemStatus(params: { cache: DashboardCache }): Promise<LambdaFunctionUrlResult> {
  const { cache } = params;
  try {
    // TODO: Implement actual health checks
    const config = await cache.getConfiguration();
    const systemStatusService = ServiceProvider.getSystemStatusService(config);
    const status = await systemStatusService.getStatus();

    return createResponse(200, 'application/json', JSON.stringify(status));
  } catch (error) {
    console.error('Error getting system status:', error);
    return createResponse(500, 'application/json', JSON.stringify({ 
      error: 'Failed to retrieve status', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }));
  }
}

/**
 * Helper function to create standardized Lambda Function URL responses
 */
function createResponse(statusCode: number, contentType: string, body: string): LambdaFunctionUrlResult {
  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body
  };
}