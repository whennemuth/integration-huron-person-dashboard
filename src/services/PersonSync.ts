import { PersonSyncService, PersonSyncResult } from './ServiceTypes';

/**
 * Person synchronization implementation using SinglePersonSync
 */
export class PersonSync implements PersonSyncService {
  async sync(personId: string, operation: string): Promise<PersonSyncResult> {
    // TODO: Implement actual person sync using SinglePersonSync
    // Example implementation:
    // const syncResult = await SinglePersonSync.sync(personId, operation);
    // return this.mapToPersonSyncResult(syncResult);
    
    throw new Error('PersonSync not yet implemented');
  }
}