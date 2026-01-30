import { CrudOperation } from 'integration-core';
import { Config, HuronPersonDataTarget, PersonPushRequest, SinglePersonSync } from 'integration-huron-person';
import { PersonSyncResult, PersonSyncService } from './ServiceTypes';

/**
 * Person synchronization implementation using SinglePersonSync
 */
export class PersonSync implements PersonSyncService {

  constructor(private config: Config) { }

  async preview(personId: string, crudOperation: CrudOperation): Promise<PersonPushRequest> {
    const { config } = this;
    const sync = new SinglePersonSync({ config, buid:personId });
    const mapped = await sync.getMappedPerson();
    const pushRequest = HuronPersonDataTarget.convertFieldSetToRequest(mapped.fieldSets?.[0], crudOperation);
    return pushRequest;
  }
  
  async sync(personId: string, crudOperation: CrudOperation): Promise<PersonSyncResult> {
    const { config } = this;
    try {
      const syncOp = new SinglePersonSync({ config, buid:personId });
      await syncOp.sync({ crudOperation });
      return {
        personId,
        operation: crudOperation,
        status: 'Success',
        timestamp: new Date().toISOString(),
        recordsProcessed: 1,
        details: `Person (${personId}) synchronization completed successfully`
      } as PersonSyncResult;
    } 
    catch (error) {
      console.error(`Person sync failed for Person ID: ${personId}:`, error);
      return {
        personId,
        operation: crudOperation,
        status: 'Failed',
        timestamp: new Date().toISOString(),
        recordsProcessed: 0,
        details: `Person (${personId}) synchronization failed: ${error instanceof Error ? error.message : String(error)}`
      } as PersonSyncResult;
    }
  }
}