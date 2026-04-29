import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';
import type { IGetAllOptions } from '../generated/models/CommonModels';

const client = getClient(dataSourcesInfo);
const DATA_SOURCE = 'new_sponsors';

export type SponsorRow = {
  new_sponsorid?: string;
  new_sponsorname?: string;
  /** Email (Dataverse column `new_sponsormailid`). */
  new_sponsormailid?: string;
  statecode?: string | number;
  statecodename?: string;
  createdon?: string;
  modifiedon?: string;
  [key: string]: unknown;
};

export class SponsorsService {
  public static async getAll(options?: IGetAllOptions) {
    return client.retrieveMultipleRecordsAsync<SponsorRow>(DATA_SOURCE, options);
  }

  public static async create(record: Partial<SponsorRow>) {
    return client.createRecordAsync<Partial<SponsorRow>, SponsorRow>(DATA_SOURCE, record);
  }

  public static async update(id: string, changed: Partial<SponsorRow>) {
    return client.updateRecordAsync<Partial<SponsorRow>, SponsorRow>(DATA_SOURCE, id, changed);
  }

  public static async delete(id: string): Promise<void> {
    await client.deleteRecordAsync(DATA_SOURCE, id);
  }

  /** Preview label for Add form only (not persisted). */
  public static async getNextIdPreview(): Promise<string> {
    const res = await client.retrieveMultipleRecordsAsync<SponsorRow>(DATA_SOURCE, { top: 5000 });
    if (!res.success) return 'SP1';
    const n = (res.data ?? []).length + 1;
    return `SP${n}`;
  }
}
