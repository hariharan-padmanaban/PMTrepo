import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';
import type { IGetAllOptions } from '../generated/models/CommonModels';

const client = getClient(dataSourcesInfo);
const DATA_SOURCE = 'new_vendors';

/** Row shape for `new_vendor` with optional and expanded fields from retrieve. */
export type VendorRow = {
  new_vendorid?: string;
  new_vendorname?: string;
  new_vendoremail?: string;
  new_businesstype?: string | number;
  new_businesstypename?: string;
  new_phonenumber?: string;
  new_primarycontactperson?: string;
  new_sector?: string;
  new_gender?: string;
  new_date?: string;
  new_appstatus?: string;
  new_status?: string | number;
  new_statusname?: string;
  statecode?: string | number;
  statecodename?: string;
  createdon?: string;
  modifiedon?: string;
  [key: string]: unknown;
};

export class VendorsService {
  /**
   * Next display code `V{n}` in `new_appstatus` (same pattern as client `CL{n}`).
   */
  public static async getNextVnCode(): Promise<string> {
    const res = await client.retrieveMultipleRecordsAsync<VendorRow>(DATA_SOURCE, { top: 5000, orderBy: ['createdon desc'] });
    if (!res.success) return 'V1';
    let max = 0;
    for (const r of res.data ?? []) {
      const a = String(r.new_appstatus ?? '').trim();
      const m = a.match(/^V(\d+)$/i);
      if (m) max = Math.max(max, parseInt(m[1]!, 10));
    }
    return `V${max + 1}`;
  }

  public static async getAll(options?: IGetAllOptions) {
    return client.retrieveMultipleRecordsAsync<VendorRow>(DATA_SOURCE, options);
  }

  public static async create(record: Partial<VendorRow>) {
    return client.createRecordAsync<Partial<VendorRow>, VendorRow>(DATA_SOURCE, record);
  }

  public static async update(id: string, changed: Partial<VendorRow>) {
    return client.updateRecordAsync<Partial<VendorRow>, VendorRow>(DATA_SOURCE, id, changed);
  }

  public static async delete(id: string): Promise<void> {
    await client.deleteRecordAsync(DATA_SOURCE, id);
  }
}
