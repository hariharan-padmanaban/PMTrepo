import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';
import type { IGetAllOptions } from '../generated/models/CommonModels';

export type NewUserRow = {
  new_usersid?: string;
  new_name?: string;
  /** Dataverse "UserID" — stores the employee / user identifier. */
  new_userid?: string;
  /** Dataverse "EmailID" (primary name) — stores the user’s email. */
  new_newcolumn?: string;
  new_role?: string | number;
  new_rolename?: string;
  new_status?: string | number;
  new_statusname?: string;
  new_onboardeddate?: string;
  new_lastloggedapp?: string;
  /** Last In Time — ISO string of user’s last login. */
  crcf8_lastintime?: string;
  /** Last Out Time — ISO string of user’s last logout. */
  crcf8_lastouttime?: string;
  [key: string]: unknown;
};

const client = getClient(dataSourcesInfo);
// Dataverse table is `new_users`, entity set name is `new_userses`.
const DATA_SOURCE = 'new_userses';

export class NewUsersService {
  public static async getAll(options?: IGetAllOptions) {
    return client.retrieveMultipleRecordsAsync<NewUserRow>(DATA_SOURCE, options);
  }

  public static async create(record: Partial<NewUserRow>) {
    return client.createRecordAsync<Partial<NewUserRow>, NewUserRow>(DATA_SOURCE, record);
  }

  public static async update(id: string, changedFields: Partial<NewUserRow>) {
    return client.updateRecordAsync<Partial<NewUserRow>, NewUserRow>(DATA_SOURCE, id, changedFields);
  }

  public static async delete(id: string): Promise<void> {
    await client.deleteRecordAsync(DATA_SOURCE, id);
  }
}
