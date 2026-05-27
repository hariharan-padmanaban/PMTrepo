import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { NewUserRow } from './services/NewUsersService';
import { ManageUsersScreen } from './ManageUsersScreen';
import { AddClientScreen } from './AddClientScreen';
import { AddVendorScreen } from './AddVendorScreen';
import { AddSponsorScreen } from './AddSponsorScreen';
import { ManageClientScreen } from './ManageClientScreen';
import { ManageVendorScreen } from './ManageVendorScreen';
import { ManageSponsorScreen } from './ManageSponsorScreen';
import ManageMasterDataScreen from './ManageMasterDataScreen';

type DataSection = 'master' | 'user' | 'client' | 'vendor' | 'sponsor';

export type ManageDataScreenProps = {
  userRows: NewUserRow[];
  userLoading: boolean;
  onRefreshUsers: () => Promise<void>;
  ownUserRecordId: string | null;
};

export default function ManageDataScreen({
  userRows,
  userLoading,
  onRefreshUsers,
  ownUserRecordId,
}: ManageDataScreenProps) {
  const [dataSection, setDataSection] = useState<DataSection>('user');
  const [referenceSub, setReferenceSub] = useState<'manage' | 'add'>('manage');

  const goSection = (id: DataSection) => {
    setDataSection(id);
    if (id === 'client' || id === 'vendor' || id === 'sponsor') setReferenceSub('manage');
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="mb-3 shrink-0 space-y-2.5">
        <h2 className="enj-screen-header">Manage Data</h2>
        <p className="text-xs leading-relaxed text-gray-600">
          Users, clients, vendors, sponsors, and master data in one place.
        </p>
        <div className="flex flex-wrap gap-2.5">
        {(
          [
            { id: 'user' as const, label: 'Users' },
            { id: 'client' as const, label: 'Clients' },
            { id: 'vendor' as const, label: 'Vendors' },
            { id: 'sponsor' as const, label: 'Sponsors' },
            { id: 'master' as const, label: 'Master data' },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => goSection(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              dataSection === id ? 'bg-[#151d5d] text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {dataSection === 'user' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <ManageUsersScreen
              rows={userRows}
              loading={userLoading}
              onRefresh={onRefreshUsers}
              ownUserRecordId={ownUserRecordId}
              embeddedInManageData
            />
          </div>
        )}
        {dataSection === 'client' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {referenceSub === 'manage' ? (
              <ManageClientScreen onAddNew={() => setReferenceSub('add')} />
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <div className="mb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReferenceSub('manage')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ArrowLeft size={14} />
                    Back to list
                  </button>
                </div>
                <AddClientScreen onCreated={() => setReferenceSub('manage')} />
              </div>
            )}
          </div>
        )}
        {dataSection === 'vendor' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {referenceSub === 'manage' ? (
              <ManageVendorScreen onAddNew={() => setReferenceSub('add')} />
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <div className="mb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReferenceSub('manage')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ArrowLeft size={14} />
                    Back to list
                  </button>
                </div>
                <AddVendorScreen onCreated={() => setReferenceSub('manage')} />
              </div>
            )}
          </div>
        )}
        {dataSection === 'sponsor' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {referenceSub === 'manage' ? (
              <ManageSponsorScreen onAddNew={() => setReferenceSub('add')} />
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <div className="mb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReferenceSub('manage')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ArrowLeft size={14} />
                    Back to list
                  </button>
                </div>
                <AddSponsorScreen onCreated={() => setReferenceSub('manage')} />
              </div>
            )}
          </div>
        )}
        {dataSection === 'master' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <ManageMasterDataScreen embeddedInManageData />
          </div>
        )}
      </div>
    </section>
  );
}
