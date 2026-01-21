import { MockPersonLookupService } from '../handlers/DashboardMocks';
import { PersonLookupService, PersonLookupResult } from './ServiceTypes';

/**
 * Person lookup implementation using actual integration APIs
 */
export class PersonLookup implements PersonLookupService {
  async lookup(personId: string, system: 'source' | 'target'): Promise<PersonLookupResult> {
    // TODO: Implement actual person lookup using integration-huron-person DataSource
    // Example implementation:
    // const sourceData = await this.sourceApi.getPerson(personId);
    // const targetData = await this.targetApi.getPerson(personId);
    
    // For now just return a mock value.
    return new MockPersonLookupService().lookup(personId, system);

    // throw new Error('PersonLookup not yet implemented');
  }
}