import Mustache from 'mustache';
import { LambdaFunctionUrlEvent, LambdaFunctionUrlResult } from './DashboardTypes';
import { TemplateService } from '../services/TemplateService';
import { ServiceProvider } from '../services/ServiceProvider';
import { verifyOriginHeader } from './OriginVerification';
// import { SinglePersonSync } from 'integration-huron-person';
// import { ConfigManager } from 'integration-huron-person';

/**
 * Lambda event handler for the Integration Dashboard
 * Supports multiple routes and operations via path-based routing
 */
export const handler = async (event: LambdaFunctionUrlEvent): Promise<LambdaFunctionUrlResult> => {
  console.log('Dashboard handler invoked:', JSON.stringify(event, null, 2));
  
  try {
    // Verify origin header to ensure request came from CloudFront
    const originVerification = verifyOriginHeader(event);
    if (!originVerification.isValid && originVerification.errorResponse) {
      return originVerification.errorResponse;
    }

    const path = event.rawPath || event.requestContext?.http?.path || '/';
    const method = event.requestContext?.http?.method || 'GET';
    const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : null;
    const queryParams = event.queryStringParameters || {};

    // Route handling
    switch (path) {
      case '/': case '/dashboard':
        return await renderDashboard(queryParams.tab);
      
      case '/api/person-lookup':
        return await handlePersonLookup(body);
      
      case '/api/person-sync':
        return await handlePersonSync(body);
      
      case '/api/bulk-sync':
        return await handleBulkSync(body);
      
      case '/api/history':
        return await getHistory(queryParams);
      
      case '/api/status':
        return await getSystemStatus();
      
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

/**
 * Handle person lookup by BUID or other identifier
 */
async function handlePersonLookup(requestBody: string | null): Promise<LambdaFunctionUrlResult> {
  if (!requestBody) {
    return createResponse(400, 'application/json', JSON.stringify({ error: 'Request body required' }));
  }

  try {
    const { personId, system = 'source' } = JSON.parse(requestBody);
    
    if (!personId) {
      return createResponse(400, 'application/json', JSON.stringify({ error: 'personId is required' }));
    }

    // TODO: Implement actual person lookup
    // This would use the integration-huron-person DataSource
    const personLookupService = ServiceProvider.getPersonLookupService();
    const mockResult = await personLookupService.lookup(personId, system);

    return createResponse(200, 'application/json', JSON.stringify(mockResult));
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
async function handlePersonSync(requestBody: string | null): Promise<LambdaFunctionUrlResult> {
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
    
    const personSyncService = ServiceProvider.getPersonSyncService();
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
async function handleBulkSync(requestBody: string | null): Promise<LambdaFunctionUrlResult> {
  if (!requestBody) {
    return createResponse(400, 'application/json', JSON.stringify({ error: 'Request body required' }));
  }

  try {
    const { operation, batchSize, filters } = JSON.parse(requestBody);
    
    // TODO: Implement actual bulk sync
    const bulkSyncService = ServiceProvider.getBulkSyncService();
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
async function getHistory(queryParams: any): Promise<LambdaFunctionUrlResult> {
  try {
    const { startDate, endDate, limit = 50 } = queryParams;
    
    // TODO: Implement actual S3 history retrieval
    const historyService = ServiceProvider.getHistoryService();
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
async function getSystemStatus(): Promise<LambdaFunctionUrlResult> {
  try {
    // TODO: Implement actual health checks
    const systemStatusService = ServiceProvider.getSystemStatusService();
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