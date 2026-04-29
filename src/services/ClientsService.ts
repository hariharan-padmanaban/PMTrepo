import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';
import type { IGetAllOptions } from '../generated/models/CommonModels';

const client = getClient(dataSourcesInfo);
const DATA_SOURCE = 'new_clients';

export type ClientRow = {
  new_clientid?: string;
  new_clientname?: string;
  new_clientemail?: string;
  new_industrysector?: string;
  new_primarycontactname?: string;
  new_businesstype?: string;
  new_phonenumber?: string;
  new_status?: string;
  /** Used to store display client codes such as `CL1`, `CL2` (see getNextClCode). */
  new_appstatus?: string;
  statecode?: string | number;
  statecodename?: string;
  createdon?: string;
  modifiedon?: string;
  [key: string]: unknown;
};

export class ClientsService {
  /**
   * Next human-friendly client id `CL{n}` (stored in `new_appstatus`). Call before create to avoid duplicate numbers in normal use.
   */
  public static async getNextClCode(): Promise<string> {
    const res = await client.retrieveMultipleRecordsAsync<ClientRow>(DATA_SOURCE, { top: 5000, orderBy: ['createdon desc'] });
    if (!res.success) return 'CL1';
    let max = 0;
    for (const r of res.data ?? []) {
      const a = String(r.new_appstatus ?? '').trim();
      const m = a.match(/^CL(\d+)$/i);
      if (m) max = Math.max(max, parseInt(m[1]!, 10));
    }
    return `CL${max + 1}`;
  }

  public static async getAll(options?: IGetAllOptions) {
    return client.retrieveMultipleRecordsAsync<ClientRow>(DATA_SOURCE, options);
  }

  public static async create(record: Partial<ClientRow>) {
    return client.createRecordAsync<Partial<ClientRow>, ClientRow>(DATA_SOURCE, record);
  }

  public static async update(id: string, changed: Partial<ClientRow>) {
    return client.updateRecordAsync<Partial<ClientRow>, ClientRow>(DATA_SOURCE, id, changed);
  }

  public static async delete(id: string): Promise<void> {
    await client.deleteRecordAsync(DATA_SOURCE, id);
  }
}
