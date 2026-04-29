import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';
import type { IGetAllOptions } from '../generated/models/CommonModels';

export type EnjazMasterDataRow = {
  new_enjazmasterdataid?: string;
  new_enjazmasterdata1?: string;
  new_uniqueid?: string;
  new_category?: string | number;
  new_categorytype?: string;
  new_categoryname?: string;
  new_code?: string | number;
  new_status?: string | number;
  new_statusname?: string;
  [key: string]: unknown;
};

const client = getClient(dataSourcesInfo);
const DATA_SOURCE = 'new_enjazmasterdatas';

/** `new_category` = Deliverables (New_enjazmasterdatasnew_category) */
const ENJAZ_CATEGORY_DELIVERABLES = 100000009;
/** `new_category` = ReportType (Dataverse / schema “Report Type”) */
const ENJAZ_CATEGORY_REPORT_TYPE = 100000006;
/** `new_status` = Active (New_enjazmasterdatasnew_status) */
const ENJAZ_STATUS_ACTIVE = 100000000;

function rowIsDeliverablesCategoryAndActiveStatus(r: EnjazMasterDataRow): boolean {
  const cat = r.new_category;
  const st = r.new_status;
  const catN = cat === null || cat === undefined ? Number.NaN : Number(cat);
  const stN = st === null || st === undefined ? Number.NaN : Number(st);
  const catName = String(r.new_categoryname ?? '').trim().toLowerCase();
  const catType = String(r.new_categorytype ?? '').trim().toLowerCase();
  const stName = String(r.new_statusname ?? '').trim().toLowerCase();
  const isDeliverables =
    (!Number.isNaN(catN) && catN === ENJAZ_CATEGORY_DELIVERABLES) || catType === 'deliverables' || catName === 'deliverables';
  const isActive = (!Number.isNaN(stN) && stN === ENJAZ_STATUS_ACTIVE) || stName === 'active';
  return isDeliverables && isActive;
}

function rowIsReportTypeCategoryAndActiveStatus(r: EnjazMasterDataRow): boolean {
  const cat = r.new_category;
  const st = r.new_status;
  const catN = cat === null || cat === undefined ? Number.NaN : Number(cat);
  const stN = st === null || st === undefined ? Number.NaN : Number(st);
  const catName = String(r.new_categoryname ?? '').trim().toLowerCase();
  const catType = String(r.new_categorytype ?? '').trim().toLowerCase();
  const stName = String(r.new_statusname ?? '').trim().toLowerCase();
  const isReportType =
    (!Number.isNaN(catN) && catN === ENJAZ_CATEGORY_REPORT_TYPE) || catType === 'report type' || catType === 'reporttype' || catName === 'report type' || catName === 'reporttype';
  const isActive = (!Number.isNaN(stN) && stN === ENJAZ_STATUS_ACTIVE) || stName === 'active';
  return isReportType && isActive;
}

export class EnjazMasterDataService {
  public static async getAll(options?: IGetAllOptions) {
    return client.retrieveMultipleRecordsAsync<EnjazMasterDataRow>(DATA_SOURCE, options);
  }

  /**
   * Rows from table `new_enjazmasterdata` (set `new_enjazmasterdatas`) for **Deliverable Include** options:
   * `new_category` = Deliverables and `new_status` = Active. Uses display column `new_enjazmasterdata1` for labels.
   */
  public static async getActiveDeliverableMasterRows() {
    const odata = await this.getAll({
      top: 2000,
      orderBy: ['new_enjazmasterdata1 asc'],
      filter: `new_status eq ${ENJAZ_STATUS_ACTIVE} and (new_category eq ${ENJAZ_CATEGORY_DELIVERABLES} or new_categorytype eq 'Deliverables')`,
    });
    if (odata.success) {
      const data = (odata.data ?? []).filter((r) => String(r.new_enjazmasterdata1 ?? '').trim() !== '');
      return { ...odata, data };
    }
    const all = await this.getAll({ top: 2000, orderBy: ['new_enjazmasterdata1 asc'] });
    if (!all.success) return all;
    const data = (all.data ?? [])
      .filter(rowIsDeliverablesCategoryAndActiveStatus)
      .filter((r) => String(r.new_enjazmasterdata1 ?? '').trim() !== '');
    data.sort((a, b) =>
      String(a.new_enjazmasterdata1 ?? '').localeCompare(String(b.new_enjazmasterdata1 ?? ''), undefined, { sensitivity: 'base' }),
    );
    return { ...all, data };
  }

  /**
   * `new_enjazmasterdata` rows: **Category** = Report Type, **Status** = Active. Labels: `new_enjazmasterdata1`.
   */
  public static async getActiveReportTypeMasterRows() {
    const odata = await this.getAll({
      top: 2000,
      orderBy: ['new_enjazmasterdata1 asc'],
      filter: `new_status eq ${ENJAZ_STATUS_ACTIVE} and (new_category eq ${ENJAZ_CATEGORY_REPORT_TYPE} or new_categorytype eq 'Report Type' or new_categorytype eq 'ReportType')`,
    });
    if (odata.success) {
      const data = (odata.data ?? []).filter((r) => String(r.new_enjazmasterdata1 ?? '').trim() !== '');
      return { ...odata, data };
    }
    const all = await this.getAll({ top: 2000, orderBy: ['new_enjazmasterdata1 asc'] });
    if (!all.success) return all;
    const data = (all.data ?? [])
      .filter(rowIsReportTypeCategoryAndActiveStatus)
      .filter((r) => String(r.new_enjazmasterdata1 ?? '').trim() !== '');
    data.sort((a, b) =>
      String(a.new_enjazmasterdata1 ?? '').localeCompare(String(b.new_enjazmasterdata1 ?? ''), undefined, { sensitivity: 'base' }),
    );
    return { ...all, data };
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
