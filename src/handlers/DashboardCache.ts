import { BasicCache, Cache, Config } from "integration-huron-person";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

export const SECRETS_CACHE_KEY = 'integration-secrets';
export const SECRET_ARN = 'INTEGRATION_SECRETS_ARN';
export const SECRET_REGION = 'INTEGRATION_SECRETS_REGION';

/**
 * DashboardCache handles caching and retrieval of integration configuration
 * and secrets from AWS Secrets Manager.
 */
export class DashboardCache {
  private cache: Cache<string, string>;
  private initialized: boolean = false;

  constructor() {    
    if(!this.cache) {  
      this.cache = BasicCache.getInstance();
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.cache.get(SECRETS_CACHE_KEY)) {
      const secretArn = process.env[SECRET_ARN];
      const secretRegion = process.env[SECRET_REGION] || 'us-east-1';
      if (!secretArn) {
        throw new Error(`Environment variable ${SECRET_ARN} is not set.`);
      }

      // Retrieve secret from AWS Secrets Manager
      const client = new SecretsManagerClient({ region: secretRegion });
      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      });

      try {
        const response = await client.send(command);
        if (response.SecretString) {
          this.cache.set(SECRETS_CACHE_KEY, response.SecretString);
        } else {
          throw new Error(`Secret ${secretArn} does not contain a SecretString.`);
        }
      } catch (error: any) {
        throw new Error(`Failed to retrieve secret ${secretArn}: ${error.message}`);
      }
    }

    this.initialized = true;
  }

  public get = async (key:string): Promise<any> => {
    await this.initialize();
    return this.cache.get(key);
  }

  public getConfiguration = async (): Promise<Config> => {
    const secretString = await this.get(SECRETS_CACHE_KEY);
    const config = secretString ? JSON.parse(secretString) : {} as Config;
    // Log an error if config is empty
    if (Object.keys(config).length === 0) {
      console.error('Warning: Retrieved configuration is empty.');
    }
    return config;
  }
}


if (require.main === module) {
  (async () => {
    const dashboardCache = new DashboardCache();
    try {
      const config = await dashboardCache.getConfiguration();
      console.log('Retrieved Configuration:', JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error retrieving configuration:', error);
    }
  })();
}