import { Config, DataMapper, HuronPersonDataSource, ReadPeople, ReadPerson, TokenAuthConfig } from 'integration-huron-person';
import { IContext } from '../../context/IContext';
import { PersonLookupParams, PersonLookupResult, PersonLookupService } from './ServiceTypes';

/**
 * Person lookup implementation using actual integration APIs
 */
export class PersonLookup implements PersonLookupService {

  constructor(private config: Config) { }

  async lookup(params: PersonLookupParams): Promise<PersonLookupResult> {
    const { system } = params;
    const { lookupSourcePerson, lookupTargetPerson } = this;
    let lookupResult: PersonLookupResult;

    switch (system) {
      case 'source':
        lookupResult = await lookupSourcePerson(params, lookupTargetPerson);
        break;
      case 'source-only':
        lookupResult = await lookupSourcePerson(params);
        break;
      case 'target':
        lookupResult = await lookupTargetPerson(params, lookupSourcePerson);
        break;
      case 'target-only':
        lookupResult = await lookupTargetPerson(params);
        break;
      default:
        throw new Error(`Unknown system type: ${system}`);
    }
    
    // For now just return a mock value.
    // return new MockPersonLookupService().lookup({ personId, system, searchType });

    return lookupResult;
  }

  /**
   * Lookup person in source system. If a single record is found and a lookupTarget function is 
   * provided, lookup the corresponding person in the target system as well.
   * @param params 
   * @param lookupTarget 
   * @returns 
   */
  private lookupSourcePerson = async (params: PersonLookupParams, lookupTarget?: (params: PersonLookupParams) => Promise<PersonLookupResult>): Promise<PersonLookupResult> =>  {
    const { personId, system, searchType, firstName, lastName } = params;
    console.log(`Looking up person in source system by ${searchType}: ${personId}`);
    const dataMapper = new DataMapper();
    const dataSource = new HuronPersonDataSource({
      config: this.config, dataMapper, buid: personId
    });
    const sourceData = await dataSource.fetchRaw();
    console.log('Fetched CDM Person Data:', JSON.stringify(sourceData, null, 2));
    if( sourceData.length === 0 ) {
      return { personId, sourceData: [] as any[], targetData: [] as any[] } as PersonLookupResult;
    }
    if( sourceData.length > 1 ) {
      return { personId, sourceData, targetData: [] as any[] } as PersonLookupResult;
    }
    const buid = sourceData[0]?.personid;
    if( ! buid ) {
      throw new Error(`No personid found in source data for personId: ${personId}`);
    }
    if( ! lookupTarget ) {
      return { personId: buid, sourceData, targetData: [] as any[] } as PersonLookupResult;
    }
    
    const targetResult: PersonLookupResult = await lookupTarget({ personId: buid, system: 'target', searchType: 'sid' });
    const { targetData } = targetResult;
    return { personId: buid, sourceData, targetData } as PersonLookupResult;
  }

  /**
   * Lookup person in target system. If a single record is found and a lookupSource function is 
   * provided, lookup the corresponding person in the source system as well.
   * @param params 
   * @param lookupSource 
   * @returns 
   */
  private lookupTargetPerson = async (params: PersonLookupParams, lookupSource?: (params: PersonLookupParams) => Promise<PersonLookupResult>): Promise<PersonLookupResult> => {
    const { personId, searchType, firstName, lastName } = params;
    let targetData: any[] = [];
    const reader = new ReadPerson(this.config);
    switch (searchType) {
      case 'hrn':
        console.log(`Looking up person in target system by HRN: ${personId}`);
        const person = await reader.readPersonByHRN(personId);
        targetData.push(person);
        break;
      case 'name':
        console.log(`Looking up person in target system by Name: ${firstName} ${lastName}`);
        if( ! firstName && ! lastName ) {
          throw new Error('First name and last name must be provided for name search');
        }
        const peopleReader = new ReadPeople(this.config);
        if( firstName && lastName) {
          targetData = await peopleReader.readPeopleByFullName(firstName, lastName);
        }
        else if( firstName ) {
          targetData = await peopleReader.readPeopleByFirstName(firstName);
        }
        else if( lastName ) {
          targetData = await peopleReader.readPeopleByLastName(lastName);
        }
        break;
      case 'sid':
        console.log(`Looking up person in target system by Source ID: ${personId}`);
        targetData = await reader.readPersonBySourceIdentifier(personId!);
        break;
      case 'uid':
        console.log(`Looking up person in target system by User ID: ${personId}`);
        targetData = await reader.readPersonByUserId(personId!);
        break;
      case 'email':
        console.log(`Looking up person in target system by Email: ${personId}`);
        targetData = await reader.readPersonByEmail(personId!);
        break;
      default:
        throw new Error(`Unsupported search type for target system: ${searchType}`);
    }

    const isABuid = (id:string) => /^U[0-9]{8}$/.test(id);
    let sid: string;

    if( targetData.length === 0 && searchType === 'sid' && isABuid(personId) && lookupSource) {
      sid = personId;
      const sourceResult: PersonLookupResult = await lookupSource({ personId: sid, system: 'source', searchType: 'buid' });
      const { sourceData } = sourceResult;
      return { personId: sid, sourceData, targetData } as PersonLookupResult;    
    }
    else {
      if( targetData.length === 0 ) {
        return { personId: params.personId, sourceData: [] as any[], targetData: [] as any[] } as PersonLookupResult;
      }
      if( targetData.length > 1 ) {
        return { personId: params.personId, sourceData: [] as any[], targetData } as PersonLookupResult;
      }

      // Single person result. Search for a the BUID in the Huron data (could be in sourceIdentifier or id field)
      const hrn = targetData[0]?.hrn;
      let sid = targetData[0]?.sourceIdentifier;
      if( ! isABuid(sid) ) {
        sid = targetData[0]?.id;
      }
      if( ! isABuid(sid) ) {
        console.warn(`No valid BUID found in target data for personId: ${personId}`);
      }

      if( ! hrn ) {
        throw new Error(`No HRN found in target data for personId: ${personId}`);
      }
      if( ! lookupSource ) {
        return { personId: hrn, sourceData: [] as any[], targetData } as PersonLookupResult;
      }

      const sourceResult: PersonLookupResult = await lookupSource({ personId: sid, system: 'source', searchType: 'buid' });
      const { sourceData } = sourceResult;
      return { personId: hrn, sourceData, targetData } as PersonLookupResult;    
    }
  }
}


if (require.main === module) {
  // Simple test run
  (async () => {
    const context = require('../../context/context.json') as IContext;
    const { INTEGRATION_CONFIG } = context;
    if( ! INTEGRATION_CONFIG ) {
      throw new Error('INTEGRATION_CONFIG is missing in context');
    }
    
    const config: Config = { ...INTEGRATION_CONFIG } as Config;

    const {
      DATASOURCE_ENDPOINTCONFIG_API_KEY,
      DATATARGET_ENDPOINTCONFIG_EXTERNAL_TOKEN
    } = process.env;

    if( ! DATASOURCE_ENDPOINTCONFIG_API_KEY ) {
      throw new Error('DATASOURCE_ENDPOINTCONFIG_API_KEY is missing in environment variables');
    }
    if( ! DATATARGET_ENDPOINTCONFIG_EXTERNAL_TOKEN ) {
      throw new Error('DATATARGET_ENDPOINTCONFIG_EXTERNAL_TOKEN is missing in environment variables');
    }    

    config.dataSource.endpointConfig.apiKey = DATASOURCE_ENDPOINTCONFIG_API_KEY;
    (config.dataTarget.endpointConfig as TokenAuthConfig).externalToken = DATATARGET_ENDPOINTCONFIG_EXTERNAL_TOKEN;

    const personLookup = new PersonLookup(config);
    try {
      const result = await personLookup.lookup({
        personId: 'U21967744',
        system: 'source',
        searchType: 'buid'
      });
      console.log('Lookup result:', result);
    } catch (error) {
      console.error('Error during person lookup:', error);
    }
  })();
}