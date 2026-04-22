import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';
import type { IGetAllOptions } from '../generated/models/CommonModels';

export type EnjazMasterDataRow = {
  new_enjazmasterdataid?: string;
  new_enjazmasterdata1?: string;
  new_uniqueid?: string;
  new_category?: string | number;
  new_categoryname?: string;
  new_code?: string | number;
  new_status?: string | number;
  new_statusname?: string;
  [key: string]: unknown;
};

const client = getClient(dataSourcesInfo);
const DATA_SOURCE = 'new_enjazmasterdatas';

export class EnjazMasterDataService {
  public static async getAll(options?: IGetAllOptions) {
    return client.retrieveMultipleRecordsAsync<EnjazMasterDataRow>(DATA_SOURCE, options);
  }

  public static async create(record: Partial<EnjazMasterDataRow>) {
    return client.createRecordAsync<Partial<EnjazMasterDataRow>, EnjazMasterDataRow>(DATA_SOURCE, record);
  }

  public static async update(id: string, changedFields: Partial<EnjazMasterDataRow>) {
    return client.updateRecordAsync<Partial<EnjazMasterDataRow>, EnjazMasterDataRow>(DATA_SOURCE, id, changedFields);
  }

  public static async delete(id: string) {
    return client.deleteRecordAsync(DATA_SOURCE, id);
  }
}
