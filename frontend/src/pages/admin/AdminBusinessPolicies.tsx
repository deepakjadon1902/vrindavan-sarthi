import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Sliders,
  Building2,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  History,
  Save,
  RotateCcw,
} from 'lucide-react';
import { api, withAuth } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface PolicyTier {
  hoursBeforeCheckIn: number;
  refundPercent: number;
  description: string;
}

interface PlatformPolicy {
  policyKey: string;
  title: string;
  description: string;
  tiers: PolicyTier[];
  version: number;
  history?: Array<{
    version: number;
    tiers: PolicyTier[];
    updatedByName: string;
    reason: string;
    updatedAt: string;
  }>;
}

interface HotelPolicyItem {
  _id: string;
  name: string;
  propertyType: string;
  location: string;
  cancellationPolicyType?: 'platform_default' | 'custom';
  customCancellationPolicy?: {
    tiers: PolicyTier[];
    version: number;
    updatedAt?: string;
    reason?: string;
  };
  dharamshalaServiceFee?: number;
  dharamshalaServiceFeeVersion?: number;
  dharamshalaFeeHistory?: any[];
  dharamshalaFeeApprovalStatus?: 'pending_review' | 'approved' | 'explicitly_free' | 'unconfigured';
  feeApprovalStatus?: 'pending_review' | 'approved' | 'explicitly_free' | 'unconfigured';
  feeApprovalLabel?: string;
  dharamshalaFeeConfigured?: boolean;
  partnerName?: string;
}

interface AuditLogItem {
  _id: string;
  action: string;
  actorName: string;
  actorRole: string;
  targetEntityType: string;
  reason: string;
  beforeState: any;
  afterState: any;
  createdAt: string;
}

export const AdminBusinessPolicies: React.FC = () => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'platform' | 'hotels' | 'dharamshala' | 'audit'>('platform');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Platform Policy State
  const [platformPolicy, setPlatformPolicy] = useState<PlatformPolicy | null>(null);
  const [editingPlatform, setEditingPlatform] = useState(false);
  const [platformTiers, setPlatformTiers] = useState<PolicyTier[]>([]);
  const [platformReason, setPlatformReason] = useState('');

  // Hotel Custom Policy State
  const [hotels, setHotels] = useState<HotelPolicyItem[]>([]);
  const [hotelSearch, setHotelSearch] = useState('');
  const [selectedHotel, setSelectedHotel] = useState<HotelPolicyItem | null>(null);
  const [hotelPolicyMode, setHotelPolicyMode] = useState<'platform_default' | 'custom'>('platform_default');
  const [hotelTiers, setHotelTiers] = useState<PolicyTier[]>([]);
  const [hotelReason, setHotelReason] = useState('');
  const [hotelModalOpen, setHotelModalOpen] = useState(false);

  // Dharamshala Fee State
  const [dharamshalas, setDharamshalas] = useState<HotelPolicyItem[]>([]);
  const [editingDharamshala, setEditingDharamshala] = useState<HotelPolicyItem | null>(null);
  const [newFee, setNewFee] = useState<number>(79);
  const [feeReason, setFeeReason] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Load Platform Default Policy
  const loadPlatformPolicy = async () => {
    try {
      setLoading(true);
      const res = await api.get('/policies/cancellation/platform-default');
      if (res.data?.success) {
        setPlatformPolicy(res.data.data);
        setPlatformTiers(res.data.data.tiers || []);
      }
    } catch (err: any) {
      console.error('Failed to load platform default policy:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Commercial Hotels
  const loadHotels = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hotels', { params: { limit: 200 } });
      if (res.data?.success) {
        const items = (res.data.data || []).filter((h: any) => h.propertyType !== 'dharamshala');
        setHotels(items);
      }
    } catch (err: any) {
      console.error('Failed to load hotels:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Dharamshalas
  const loadDharamshalas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/policies/dharamshalas', withAuth(token));
      if (res.data?.success) {
        setDharamshalas(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load dharamshalas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Policy Audit Logs
  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/policies/audit-logs', withAuth(token));
      if (res.data?.success) {
        setAuditLogs(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load policy audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'platform') void loadPlatformPolicy();
    if (activeTab === 'hotels') void loadHotels();
    if (activeTab === 'dharamshala') void loadDharamshalas();
    if (activeTab === 'audit') void loadAuditLogs();
  }, [activeTab]);

  // Save Platform Default Policy
  const handleSavePlatformPolicy = async () => {
    if (!platformReason.trim()) {
      setMessage({ type: 'error', text: 'A mandatory justification reason is required to update platform policies.' });
      return;
    }

    try {
      setLoading(true);
      const res = await api.put(
        '/policies/cancellation/platform-default',
        {
          tiers: platformTiers,
          reason: platformReason,
        },
        withAuth(token)
      );

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Platform default cancellation policy successfully updated.' });
        setEditingPlatform(false);
        setPlatformReason('');
        await loadPlatformPolicy();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update platform policy' });
    } finally {
      setLoading(false);
    }
  };

  // Open Hotel Policy Configuration Dialog
  const handleOpenHotelConfig = (hotel: HotelPolicyItem) => {
    setSelectedHotel(hotel);
    const isCustom = hotel.cancellationPolicyType === 'custom';
    setHotelPolicyMode(isCustom ? 'custom' : 'platform_default');
    setHotelTiers(
      isCustom && hotel.customCancellationPolicy?.tiers?.length
        ? hotel.customCancellationPolicy.tiers
        : platformPolicy?.tiers || [
            { hoursBeforeCheckIn: 48, refundPercent: 75, description: '> 48h before check-in' },
            { hoursBeforeCheckIn: 24, refundPercent: 50, description: '24h - 48h before check-in' },
            { hoursBeforeCheckIn: 0, refundPercent: 0, description: '< 24h before check-in' },
          ]
    );
    setHotelReason('');
    setHotelModalOpen(true);
  };

  // Save Hotel Custom Policy
  const handleSaveHotelPolicy = async () => {
    if (!selectedHotel) return;
    if (!hotelReason.trim()) {
      setMessage({ type: 'error', text: 'A mandatory justification reason is required to update hotel policy.' });
      return;
    }

    try {
      setLoading(true);
      const res = await api.put(
        `/policies/hotels/${selectedHotel._id}/cancellation`,
        {
          policyType: hotelPolicyMode,
          tiers: hotelPolicyMode === 'custom' ? hotelTiers : [],
          reason: hotelReason,
        },
        withAuth(token)
      );

      if (res.data?.success) {
        setMessage({ type: 'success', text: res.data.message });
        setHotelModalOpen(false);
        await loadHotels();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update hotel policy' });
    } finally {
      setLoading(false);
    }
  };

  // Revert Hotel to Platform Default
  const handleResetHotelToDefault = async (hotelId: string) => {
    const reason = prompt('Enter justification reason for reverting this property to platform default policy:');
    if (!reason || !reason.trim()) return;

    try {
      setLoading(true);
      const res = await api.put(
        `/policies/hotels/${hotelId}/cancellation/reset-default`,
        { reason },
        withAuth(token)
      );
      if (res.data?.success) {
        setMessage({ type: 'success', text: res.data.message });
        await loadHotels();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reset hotel policy' });
    } finally {
      setLoading(false);
    }
  };

  // Save Dharamshala Service Fee
  const handleSaveDharamshalaFee = async () => {
    if (!editingDharamshala) return;
    if (!feeReason.trim()) {
      setMessage({ type: 'error', text: 'A mandatory justification reason is required to update service fees.' });
      return;
    }

    try {
      setLoading(true);
      const res = await api.put(
        `/policies/dharamshalas/${editingDharamshala._id}/fee`,
        {
          fee: newFee,
          reason: feeReason,
        },
        withAuth(token)
      );

      if (res.data?.success) {
        setMessage({ type: 'success', text: res.data.message });
        setEditingDharamshala(null);
        setFeeReason('');
        await loadDharamshalas();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update Dharamshala service fee' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-primary" />
            Business Policy Configuration Engine
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Configure platform cancellation tiers, hotel policy overrides, Dharamshala service fees, and view immutable audit trails.
          </p>
        </div>
      </div>

      {/* Notification Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-stone-200 space-x-6">
        <button
          onClick={() => setActiveTab('platform')}
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'platform' ? 'border-primary text-primary font-semibold' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Platform Default Policy
        </button>
        <button
          onClick={() => setActiveTab('hotels')}
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'hotels' ? 'border-primary text-primary font-semibold' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Hotel Policy Overrides
        </button>
        <button
          onClick={() => setActiveTab('dharamshala')}
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'dharamshala' ? 'border-primary text-primary font-semibold' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Dharamshala Service Fees
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'audit' ? 'border-primary text-primary font-semibold' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Policy Audit History
        </button>
      </div>

      {/* TAB 1: Platform Default Policy */}
      {activeTab === 'platform' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Commercial Hotel — Full Payment Default Policy</h2>
                <p className="text-sm text-stone-500">
                  Applied to all commercial hotel 100% online bookings that do not have property-specific custom overrides.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-stone-100 text-stone-700 px-3 py-1 rounded-full font-mono">
                  Version: v{platformPolicy?.version || 1}
                </span>
                {!editingPlatform ? (
                  <button
                    onClick={() => setEditingPlatform(true)}
                    className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition"
                  >
                    Edit Default Tiers
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingPlatform(false);
                      setPlatformTiers(platformPolicy?.tiers || []);
                    }}
                    className="px-4 py-2 bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg hover:bg-stone-200 transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Advance 30% Notice Box */}
            <div className="my-4 p-4 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              <span className="font-bold">Mandatory Advance Booking Rule:</span> 30% advance reservations are strictly governed by the non-refundable deposit rule. Voluntary customer cancellation yields <strong>0% refund</strong>. If the property or platform fails to provide the stay, <strong>100% online amount</strong> is refunded. Hotel custom policies cannot override this statutory advance rule.
            </div>

            {/* Tiers View / Edit */}
            <div className="mt-4 space-y-4">
              <h3 className="text-sm font-semibold text-stone-800">Current Cancellation Tiers</h3>
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 border-b">
                    <tr>
                      <th className="p-3">Notice Before Check-in</th>
                      <th className="p-3">Refund Percentage</th>
                      <th className="p-3">Deduction (Platform Retention)</th>
                      <th className="p-3">Description</th>
                      {editingPlatform && <th className="p-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {platformTiers.map((tier, idx) => (
                      <tr key={idx} className="hover:bg-stone-50/50">
                        <td className="p-3 font-medium">
                          {editingPlatform ? (
                            <div className="flex items-center gap-1">
                              <span>&gt;=</span>
                              <input
                                type="number"
                                min="0"
                                value={tier.hoursBeforeCheckIn}
                                disabled={idx === platformTiers.length - 1}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = [...platformTiers];
                                  updated[idx].hoursBeforeCheckIn = val;
                                  setPlatformTiers(updated);
                                }}
                                className="w-20 px-2 py-1 border rounded text-xs"
                              />
                              <span>hours</span>
                            </div>
                          ) : (
                            <span>
                              {tier.hoursBeforeCheckIn === 0
                                ? '< 24 hours'
                                : tier.hoursBeforeCheckIn === 24
                                ? '24h – 48h (inclusive)'
                                : `> ${tier.hoursBeforeCheckIn} hours`}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-emerald-600">
                          {editingPlatform ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={tier.refundPercent}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = [...platformTiers];
                                  updated[idx].refundPercent = val;
                                  setPlatformTiers(updated);
                                }}
                                className="w-20 px-2 py-1 border rounded text-xs"
                              />
                              <span>%</span>
                            </div>
                          ) : (
                            `${tier.refundPercent}% Refund`
                          )}
                        </td>
                        <td className="p-3 text-stone-500">{100 - tier.refundPercent}%</td>
                        <td className="p-3 text-stone-600">
                          {editingPlatform ? (
                            <input
                              type="text"
                              value={tier.description}
                              onChange={(e) => {
                                const updated = [...platformTiers];
                                updated[idx].description = e.target.value;
                                setPlatformTiers(updated);
                              }}
                              className="w-full px-2 py-1 border rounded text-xs"
                            />
                          ) : (
                            tier.description
                          )}
                        </td>
                        {editingPlatform && (
                          <td className="p-3 text-right">
                            {platformTiers.length > 2 && idx < platformTiers.length - 1 && (
                              <button
                                onClick={() => {
                                  setPlatformTiers(platformTiers.filter((_, i) => i !== idx));
                                }}
                                className="text-rose-600 hover:text-rose-800 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editingPlatform && (
                <div className="mt-4 p-4 border rounded-lg bg-stone-50 space-y-3">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => {
                        const newTier: PolicyTier = {
                          hoursBeforeCheckIn: 72,
                          refundPercent: 90,
                          description: 'Early cancellation > 72 hours',
                        };
                        const updated = [newTier, ...platformTiers].sort(
                          (a, b) => b.hoursBeforeCheckIn - a.hoursBeforeCheckIn
                        );
                        setPlatformTiers(updated);
                      }}
                      className="text-xs flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      <Plus className="w-4 h-4" /> Add Time Threshold Tier
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Mandatory Change Justification Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={platformReason}
                      onChange={(e) => setPlatformReason(e.target.value)}
                      placeholder="Specify business reason for updating platform default cancellation tiers (e.g., Seasonal festival policy adjustment)..."
                      className="w-full px-3 py-2 border rounded-lg text-xs"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingPlatform(false)}
                      className="px-4 py-2 border rounded-lg text-xs hover:bg-stone-100 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePlatformPolicy}
                      disabled={loading}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                    >
                      Save New Policy Version
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Hotel Custom Policy Overrides */}
      {activeTab === 'hotels' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Hotel-Specific Policy Overrides</h2>
                <p className="text-sm text-stone-500">
                  Configure custom cancellation policies per commercial hotel or inherit platform defaults.
                </p>
              </div>
              <input
                type="text"
                placeholder="Search hotel by name or location..."
                value={hotelSearch}
                onChange={(e) => setHotelSearch(e.target.value)}
                className="px-3 py-2 border rounded-lg text-xs w-full sm:w-64"
              />
            </div>

            <div className="mt-4 border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 border-b">
                  <tr>
                    <th className="p-3">Property Name</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Policy Mode</th>
                    <th className="p-3">Effective Terms</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {hotels
                    .filter((h) =>
                      h.name.toLowerCase().includes(hotelSearch.toLowerCase()) ||
                      (h.location && h.location.toLowerCase().includes(hotelSearch.toLowerCase()))
                    )
                    .map((h) => {
                      const isCustom = h.cancellationPolicyType === 'custom';
                      return (
                        <tr key={h._id} className="hover:bg-stone-50/50">
                          <td className="p-3 font-bold text-stone-900">{h.name}</td>
                          <td className="p-3 text-stone-500">{h.location}</td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isCustom ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {isCustom ? 'Custom Hotel Policy' : 'Platform Default'}
                            </span>
                          </td>
                          <td className="p-3 text-stone-600">
                            {isCustom ? (
                              <span className="text-purple-900 font-medium">
                                {h.customCancellationPolicy?.tiers?.length || 0} custom tiers (v{h.customCancellationPolicy?.version || 1})
                              </span>
                            ) : (
                              <span className="text-stone-500">Standard (&gt;48h: 75%, 24-48h: 50%, &lt;24h: 0%)</span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => handleOpenHotelConfig(h)}
                              className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded text-xs font-semibold transition"
                            >
                              Configure Policy
                            </button>
                            {isCustom && (
                              <button
                                onClick={() => handleResetHotelToDefault(h._id)}
                                title="Revert to Platform Default for future reservations"
                                className="px-2 py-1.5 text-stone-500 hover:text-stone-800 border rounded text-xs"
                              >
                                Revert
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Dharamshala Service Fees */}
      {activeTab === 'dharamshala' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <div className="pb-4 border-b">
              <h2 className="text-lg font-bold text-stone-900">Individually Configurable Dharamshala Service Fees</h2>
              <p className="text-sm text-stone-500">
                Configure transparent platform booking service fees independently for every pilgrimage ashram and Dharamshala. Service fees can be set to ₹0 or any non-negative amount.
              </p>
            </div>

            <div className="mt-4 border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 border-b">
                  <tr>
                    <th className="p-3">Dharamshala Name</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Configured Platform Fee</th>
                    <th className="p-3">Fee Version</th>
                    <th className="p-3">Partner Contact</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {dharamshalas.map((d) => (
                    <tr key={d._id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-bold text-stone-900">{d.name}</td>
                      <td className="p-3 text-stone-500">{d.location}</td>
                      <td className="p-3">
                        <div className="font-bold text-emerald-700 flex items-center gap-1.5">
                          ₹{d.dharamshalaServiceFee ?? 79}
                          {d.dharamshalaServiceFee === 0 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-normal">
                              Zero Fee / Seva
                            </span>
                          )}
                        </div>
                        {(() => {
                          const effectiveStatus = d.feeApprovalStatus || d.dharamshalaFeeApprovalStatus || 'unconfigured';
                          if (effectiveStatus === 'explicitly_free') {
                            return (
                              <span className="inline-block mt-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                                ✓ Explicitly Free (₹0)
                              </span>
                            );
                          }
                          if (effectiveStatus === 'approved') {
                            return (
                              <span className="inline-block mt-0.5 text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-medium">
                                ✓ Approved
                              </span>
                            );
                          }
                          if (effectiveStatus === 'pending_review') {
                            return (
                              <span className="inline-block mt-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                                ⚠ Pending Review
                              </span>
                            );
                          }
                          return (
                            <span className="inline-block mt-0.5 text-[10px] bg-stone-100 text-stone-700 border border-stone-300 px-1.5 py-0.5 rounded font-medium">
                              ⚠ Unconfigured
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3 font-mono text-stone-500">v{d.dharamshalaServiceFeeVersion || 1}</td>
                      <td className="p-3 text-stone-500">{d.partnerName || 'Platform Managed'}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setEditingDharamshala(d);
                            setNewFee(d.dharamshalaServiceFee ?? 79);
                            setFeeReason('');
                          }}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-semibold text-xs transition"
                        >
                          Edit Service Fee
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Policy Audit History */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <div className="pb-4 border-b">
            <h2 className="text-lg font-bold text-stone-900">Policy &amp; Service Fee Audit Trail</h2>
            <p className="text-sm text-stone-500">
              Immutable chronological record of all administrative policy modifications, custom tier changes, and fee updates.
            </p>
          </div>

          <div className="mt-4 border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 border-b">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Administrator</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Scope / Target</th>
                  <th className="p-3">Justification Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-stone-50/50">
                    <td className="p-3 text-stone-500 font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold text-stone-800">
                      {log.actorName} <span className="text-[10px] text-stone-400">({log.actorRole})</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-stone-600 uppercase font-mono text-[10px]">
                      {log.targetEntityType}
                    </td>
                    <td className="p-3 text-stone-700 italic">
                      "{log.reason || 'Administrative policy update'}"
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hotel Policy Configuration Modal */}
      {hotelModalOpen && selectedHotel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Configure Cancellation Policy: {selectedHotel.name}
                </h3>
                <p className="text-xs text-stone-500">
                  Choose between platform default terms or configure property custom tiers.
                </p>
              </div>
              <button
                onClick={() => setHotelModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex gap-4 p-3 bg-stone-50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                <input
                  type="radio"
                  name="hotelPolicyMode"
                  value="platform_default"
                  checked={hotelPolicyMode === 'platform_default'}
                  onChange={() => setHotelPolicyMode('platform_default')}
                />
                Use Platform Default Policy
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                <input
                  type="radio"
                  name="hotelPolicyMode"
                  value="custom"
                  checked={hotelPolicyMode === 'custom'}
                  onChange={() => setHotelPolicyMode('custom')}
                />
                Configure Custom Hotel Policy
              </label>
            </div>

            {/* Custom Tiers Configuration */}
            {hotelPolicyMode === 'custom' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-stone-700">Custom Cancellation Tiers</h4>
                  <button
                    onClick={() => {
                      const newTier: PolicyTier = {
                        hoursBeforeCheckIn: 72,
                        refundPercent: 80,
                        description: 'Early cancellation > 72 hours',
                      };
                      setHotelTiers([...hotelTiers, newTier].sort((a, b) => b.hoursBeforeCheckIn - a.hoursBeforeCheckIn));
                    }}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 text-stone-600 border-b">
                      <tr>
                        <th className="p-2">Notice (Hours)</th>
                        <th className="p-2">Refund %</th>
                        <th className="p-2">Description</th>
                        <th className="p-2 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {hotelTiers.map((tier, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={tier.hoursBeforeCheckIn}
                              disabled={idx === hotelTiers.length - 1}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updated = [...hotelTiers];
                                updated[idx].hoursBeforeCheckIn = val;
                                setHotelTiers(updated);
                              }}
                              className="w-20 px-2 py-1 border rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={tier.refundPercent}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updated = [...hotelTiers];
                                updated[idx].refundPercent = val;
                                setHotelTiers(updated);
                              }}
                              className="w-20 px-2 py-1 border rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={tier.description}
                              onChange={(e) => {
                                const updated = [...hotelTiers];
                                updated[idx].description = e.target.value;
                                setHotelTiers(updated);
                              }}
                              className="w-full px-2 py-1 border rounded text-xs"
                            />
                          </td>
                          <td className="p-2 text-right">
                            {hotelTiers.length > 2 && idx < hotelTiers.length - 1 && (
                              <button
                                onClick={() => setHotelTiers(hotelTiers.filter((_, i) => i !== idx))}
                                className="text-rose-600 hover:text-rose-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mandatory Reason */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Mandatory Change Justification Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={hotelReason}
                onChange={(e) => setHotelReason(e.target.value)}
                placeholder="Specify justification reason for property cancellation policy update..."
                className="w-full px-3 py-2 border rounded-lg text-xs"
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                onClick={() => setHotelModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHotelPolicy}
                disabled={loading}
                className="px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition"
              >
                Save Hotel Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dharamshala Fee Modal */}
      {editingDharamshala && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Update Service Fee: {editingDharamshala.name}
                </h3>
                <p className="text-xs text-stone-500">
                  Set platform booking service fee. Allows ₹0 for non-profit seva properties.
                </p>
              </div>
              <button
                onClick={() => setEditingDharamshala(null)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-stone-700">
                  Platform Service Fee (₹)
                </label>
                <button
                  type="button"
                  onClick={() => setNewFee(0)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline"
                >
                  Set Free Seva (₹0)
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={newFee}
                onChange={(e) => setNewFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-emerald-700"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                {newFee === 0
                  ? 'Fee set to ₹0. Will be registered as Explicitly Free Seva upon saving.'
                  : `Customer will be shown: "Platform Service Fee: ₹${newFee}" prior to booking confirmation.`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Mandatory Change Justification Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={feeReason}
                onChange={(e) => setFeeReason(e.target.value)}
                placeholder="Specify reason for adjusting service fee (e.g. Trust donation agreement)..."
                className="w-full px-3 py-2 border rounded-lg text-xs"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                onClick={() => setEditingDharamshala(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDharamshalaFee}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
              >
                Update Service Fee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBusinessPolicies;
