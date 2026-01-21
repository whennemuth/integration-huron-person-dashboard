import {
  PersonLookupService,
  PersonSyncService,
  BulkSyncService,
  HistoryService,
  SystemStatusService
} from './ServiceTypes';

// Import mock implementations
import {
  MockPersonLookupService,
  MockPersonSyncService,
  MockBulkSyncService,
  MockHistoryService,
  MockSystemStatusService
} from '../handlers/DashboardMocks';

// Import concrete implementations
import { PersonLookup } from './PersonLookup';
import { PersonSync } from './PersonSync';
import { BulkSync } from './BulkSync';
import { History } from './History';
import { SystemStatus } from './SystemStatus';

/**
 * Service provider that provides mock or concrete implementations
 * based on environment configuration
 */
export class ServiceProvider {
  
  /**
   * Determine if we should use mock implementations
   */
  private static shouldUseMocks(): boolean {
    // In Lambda environment, always use concrete implementations
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return false;
    }
    
    // In local environment, use mocks if explicitly requested
    return process.env.LOCALHOST_WITH_MOCKS === 'true';
  }

  /**
   * Get person lookup service implementation
   */
  static getPersonLookupService(): PersonLookupService {
    if (this.shouldUseMocks()) {
      return new MockPersonLookupService();
    } else {
      return new PersonLookup();
    }
  }

  /**
   * Get person sync service implementation
   */
  static getPersonSyncService(): PersonSyncService {
    if (this.shouldUseMocks()) {
      return new MockPersonSyncService();
    } else {
      return new PersonSync();
    }
  }

  /**
   * Get bulk sync service implementation
   */
  static getBulkSyncService(): BulkSyncService {
    if (this.shouldUseMocks()) {
      return new MockBulkSyncService();
    } else {
      return new BulkSync();
    }
  }

  /**
   * Get history service implementation
   */
  static getHistoryService(): HistoryService {
    if (this.shouldUseMocks()) {
      return new MockHistoryService();
    } else {
      return new History();
    }
  }

  /**
   * Get system status service implementation
   */
  static getSystemStatusService(): SystemStatusService {
    if (this.shouldUseMocks()) {
      return new MockSystemStatusService();
    } else {
      return new SystemStatus();
    }
  }
}