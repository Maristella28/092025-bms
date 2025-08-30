import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useResidents from '../../../../hooks/useResidents';

// Use relative URLs to leverage Vite proxy

// Fetch programs with credentials for Sanctum
const fetchPrograms = async () => {
  const res = await fetch('/api/programs', {
    credentials: 'include',
  });
  return await res.json();
};

// Fetch beneficiaries for a program
const fetchBeneficiaries = async (programId) => {
  const res = await fetch('/api/beneficiaries', {
    credentials: 'include',
  });
  const all = await res.json();
  return all.filter((b) => String(b.program_id) === String(programId));
};

const ProgramDetails = () => {
  // State to toggle predictive analysis visibility
  const [showPredictive, setShowPredictive] = useState(true);
  // --- Program-specific analytics ---
  // Move analytics code below beneficiaries state initialization
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    beneficiaryType: '',
    assistanceType: '',
    status: '',
    amount: '',
    contactNumber: '',
    email: '',
    fullAddress: '',
    remarks: '',
  });

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const { residents, loading: residentsLoading, error: residentsError } = useResidents();

  useEffect(() => {
    // First fetch CSRF cookie for Sanctum
    fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      .then(() => {
        fetchPrograms().then((programs) => {
          const found = programs.find((p) => String(p.id) === String(id));
          setProgram(found);
        });
        fetchBeneficiaries(id).then(setBeneficiaries);
      });
  }, [id]);



  // Autofill Beneficiary Type, Assistance Type, and Amount only if empty when opening modal
  useEffect(() => {
    if (showModal && program) {
      setForm(f => ({
        ...f,
        beneficiaryType: f.beneficiaryType || program.beneficiary_type || program.beneficiaryType || '',
        assistanceType: f.assistanceType || program.assistance_type || program.assistanceType || '',
        amount: f.amount || program.amount || '',
      }));
    }
    // eslint-disable-next-line
  }, [showModal, program]);
  // Reset resident selection and autofilled fields when modal closes (must be outside render)
  useEffect(() => {
    if (!showModal) {
      setForm({
        name: '',
        beneficiaryType: '',
        assistanceType: '',
        status: '',
        amount: '',
        contactNumber: '',
        email: '',
        fullAddress: '',
        remarks: '',
        selectedResidentId: '',
      });
    }
  }, [showModal]);

  if (!program) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 text-xl font-bold mb-4">Program not found</div>
        <div className="text-gray-600 mb-4">
          The program with ID <span className="font-mono">{id}</span> does not exist or was deleted.
        </div>
        <button
          onClick={() => navigate(-1)}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl shadow-lg text-sm font-semibold transition-all duration-300"
        >
          &larr; Back to Programs
        </button>
      </div>
    );
  }

  // --- Program-specific analytics (after beneficiaries is initialized) ---
  const totalBeneficiaries = beneficiaries.length;
  // Support both snake_case and camelCase for program fields
  const maxBeneficiary = program?.max_beneficiaries ?? program?.maxBeneficiaries ?? 'N/A';
  const programStatus = program?.status ?? 'N/A';
  const statusCounts = beneficiaries.reduce((acc, b) => {
    const status = b.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const statusLabels = Object.keys(statusCounts);

  // --- Predictive Analysis ---
  // Predict if the program will reach its maximum beneficiaries before the end date
  let predictionText = '';
  let predictionColor = 'text-black';
  let chartData = null;
  // Use both snake_case and camelCase for start/end dates
  const startDate = program?.start_date || program?.startDate || '';
  const endDate = program?.end_date || program?.endDate || '';
  function cropDate(dateStr) {
    if (!dateStr) return '';
    // Accepts both '2025-08-18T00:00:00.000000Z' and '2025-08-18'
    return dateStr.split('T')[0];
  }

  if (startDate && endDate && maxBeneficiary !== 'N/A' && !isNaN(Number(maxBeneficiary)) && Number(maxBeneficiary) > 0) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const daysTotal = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
    const beneficiariesPerDay = daysElapsed > 0 ? totalBeneficiaries / daysElapsed : 0;
    const daysLeft = Math.max(0, Math.round((end - today) / (1000 * 60 * 60 * 24)));
    const predictedTotal = beneficiariesPerDay * daysTotal;
    chartData = {
      totalBeneficiaries,
      maxBeneficiary: Number(maxBeneficiary),
      predictedTotal: Math.round(predictedTotal),
      daysLeft,
    };
    if (daysElapsed === 0) {
      predictionText = 'Not enough data yet to predict beneficiary growth.';
    } else if (predictedTotal >= Number(maxBeneficiary)) {
      predictionText = `At the current rate, this program is likely to reach its maximum beneficiaries (${maxBeneficiary}) before the end date (${cropDate(endDate)}).`;
    } else {
      predictionText = `At the current rate, this program may not reach its maximum beneficiaries (${maxBeneficiary}) by the end date (${cropDate(endDate)}). Consider increasing outreach or extending the program.`;
    }
  } else {
    predictionText = 'Insufficient data for prediction (missing dates or maximum beneficiaries).';
  }

  return (
    <main className="bg-gradient-to-br from-green-50 to-white min-h-screen pt-20 px-2 sm:px-4 md:px-8 pb-10 font-sans lg:ml-64">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        <button onClick={() => navigate(-1)} className="text-green-700 hover:underline mb-4">
          &larr; Back to Programs
        </button>

        {/* Predictive Analysis Section with Hide/Show Button */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-300 p-8 mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-7 h-7 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h2a4 4 0 014 4v2M9 17H7a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v6a4 4 0 01-4 4h-2M9 17v2a4 4 0 004 4h2a4 4 0 004-4v-2" /></svg>
              <span className="font-bold text-2xl text-emerald-700">Predictive Analysis</span>
            </div>
            <button
              className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg font-semibold text-sm shadow transition-all duration-200"
              onClick={() => setShowPredictive(v => !v)}
            >
              {showPredictive ? 'Hide' : 'Show'}
            </button>
          </div>
          {showPredictive && (
            <>
              <div className={predictionColor + " text-base mb-6 font-medium"}>{predictionText}</div>
              {chartData && (
                <div className="w-full max-w-lg mx-auto">
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500 text-xs">Current Beneficiaries</span>
                        <span className="text-green-700 font-bold text-2xl">{chartData.totalBeneficiaries}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500 text-xs">Maximum Allowed</span>
                        <span className="text-blue-700 font-bold text-2xl">{chartData.maxBeneficiary}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500 text-xs">Predicted Total</span>
                        <span className="text-indigo-700 font-bold text-2xl">{chartData.predictedTotal}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500 text-xs">Days Left</span>
                        <span className="text-emerald-700 font-bold text-2xl">{chartData.daysLeft}</span>
                      </div>
                    </div>
                    <div className="w-full h-6 bg-gray-100 rounded-lg mt-2 relative flex items-center">
                      {/* Bar chart: green = current, indigo = predicted, blue = max */}
                      <div className="absolute left-0 top-0 h-6 bg-green-500 rounded-l-lg" style={{ width: `${Math.min(100, (chartData.totalBeneficiaries / chartData.maxBeneficiary) * 100)}%`, zIndex: 2 }}></div>
                      <div className="absolute left-0 top-0 h-6 bg-indigo-400 rounded-l-lg opacity-70" style={{ width: `${Math.min(100, (chartData.predictedTotal / chartData.maxBeneficiary) * 100)}%`, zIndex: 1 }}></div>
                      <div className="absolute left-0 top-0 h-6 border-l-4 border-blue-700 h-full" style={{ left: `calc(100% - 2px)`, zIndex: 3 }}></div>
                      <div className="absolute w-full flex justify-between px-2 text-xs top-1">
                        <span className="text-green-700 font-semibold">Current</span>
                        <span className="text-indigo-700 font-semibold">Predicted</span>
                        <span className="text-blue-700 font-semibold">Max</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {/* Program Analytics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-md border border-green-100 p-6 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-green-700">{totalBeneficiaries}</div>
            <div className="text-gray-600 text-sm mt-1">Total Beneficiaries</div>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-blue-700">{maxBeneficiary}</div>
            <div className="text-gray-600 text-sm mt-1">Maximum Beneficiaries Allowed</div>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-indigo-100 p-6 flex flex-col items-center justify-center">
            <div className="text-lg font-semibold text-indigo-700">{programStatus}</div>
            <div className="text-gray-600 text-sm mt-1">Program Status</div>
          </div>
        </div>
        {/* Beneficiary Status Breakdown */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 mb-8">
          <div className="font-bold text-lg text-gray-700 mb-2">Beneficiary Status Breakdown</div>
          <div className="flex flex-wrap gap-4">
            {statusLabels.length === 0 ? (
              <div className="text-gray-400">No beneficiaries yet.</div>
            ) : (
              statusLabels.map(label => (
                <div key={label} className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <span className="text-xl font-bold text-green-700">{statusCounts[label]}</span>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Program Details Card */}
        <div className="rounded-2xl shadow-xl border-2 border-green-500 bg-white p-8">
          <h2 className="text-3xl font-bold text-green-700 mb-2">{program.name}</h2>
          <p className="text-gray-600 mb-2">{program.description}</p>
          <div className="text-xs text-gray-500 mb-4">
            {cropDate(program.start_date || program.startDate)} - {cropDate(program.end_date || program.endDate)}
          </div>
          <button
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2 rounded-xl shadow-lg text-sm font-semibold transition-all duration-300 mt-2"
            onClick={() => setShowModal(true)}
          >
            + Add Beneficiary
          </button>
        </div>

        {/* Beneficiaries Table */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
            <h3 className="text-white font-semibold text-lg">Beneficiaries</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Assistance</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {beneficiaries.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                    No beneficiaries for this program.
                  </td>
                </tr>
              ) : (
                beneficiaries.map((beneficiary) => (
                  <tr key={beneficiary.id} className="hover:bg-green-50 transition-all duration-200 group">
                    <td className="px-4 py-3 font-semibold text-gray-900">{beneficiary.name}</td>
                    <td className="px-4 py-3">{beneficiary.beneficiary_type || beneficiary.beneficiaryType}</td>
                    <td className="px-4 py-3">{beneficiary.assistance_type || beneficiary.assistanceType}</td>
                    <td className="px-4 py-3">{beneficiary.status}</td>
                    <td className="px-4 py-3 text-green-700 font-semibold">
                      ₱ {beneficiary.amount?.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Beneficiary Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-3xl shadow-2xl border border-green-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-3xl p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    + Add Beneficiary
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-white hover:text-red-200 transition-colors duration-200"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setFormError('');
                    setFormSuccess('');
                    setFormLoading(true);
                    try {
                      // Ensure CSRF cookie is set
                      await fetch('/sanctum/csrf-cookie', {
                        credentials: 'include',
                      });

                      const res = await fetch('/api/beneficiaries', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          name: form.name,
                          beneficiary_type: form.beneficiaryType,
                          assistance_type: form.assistanceType,
                          status: form.status,
                          amount: form.amount,
                          contact_number: form.contactNumber,
                          email: form.email,
                          full_address: form.fullAddress,
                          remarks: form.remarks,
                          program_id: program.id,
                        }),
                      });

                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setFormError(data?.message || 'Failed to add beneficiary.');
                        return;
                      }
                      setFormSuccess('Beneficiary added successfully!');
                      setShowModal(false);
                      setForm({
                        name: '',
                        beneficiaryType: '',
                        assistanceType: '',
                        status: '',
                        amount: '',
                        contactNumber: '',
                        email: '',
                        fullAddress: '',
                        remarks: '',
                      });
                      fetchBeneficiaries(id).then(setBeneficiaries);
                    } catch (err) {
                      setFormError('Failed to add beneficiary. ' + (err?.message || ''));
                    } finally {
                      setFormLoading(false);
                    }
                  }}
                >
                  <div>
                    {/* DEBUG: Show residents array info */}
                    <div className="mb-2 text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2">
                      Residents loaded: {Array.isArray(residents) ? residents.length : 'N/A'}<br />
                      {residents && residents.length > 0 && (
                        <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap">{JSON.stringify(residents.slice(0,2), null, 2)}{residents.length > 2 ? '\n...more' : ''}</pre>
                      )}
                    </div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Resident</label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm"
                      value={form.selectedResidentId || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setForm(f => ({
                            ...f,
                            selectedResidentId: '',
                            name: '',
                            contactNumber: '',
                            email: '',
                            fullAddress: '',
                          }));
                        } else {
                          const selected = residents.find(r => String(r.id) === val);
                          setForm(f => ({
                            ...f,
                            selectedResidentId: val,
                            name: selected ? `${selected.first_name} ${selected.last_name}` : '',
                            contactNumber: selected && (selected.mobile_number || selected.contact_number || selected.contactNumber) ? String(selected.mobile_number || selected.contact_number || selected.contactNumber) : '',
                            email: selected && (selected.email || selected.email_address) ? String(selected.email || selected.email_address) : '',
                            fullAddress: selected && (selected.current_address || selected.full_address || selected.address) ? String(selected.current_address || selected.full_address || selected.address) : '',
                          }));
                        }
                      }}
                    >
                      <option value="">Select Resident</option>
                      {residents.map(r => (
                        <option key={r.id} value={r.id}>{`${r.first_name} ${r.last_name}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Beneficiary Type</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-100"
                        required
                        value={form.beneficiaryType}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Assistance Type</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-100"
                        required
                        value={form.assistanceType}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                      <select
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm"
                        required
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      >
                        <option value="">Select Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-100"
                        required
                        value={form.amount}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm"
                        required
                        value={form.contactNumber}
                        onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm"
                        required
                        value={form.fullAddress}
                        onChange={(e) => setForm((f) => ({ ...f, fullAddress: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm"
                        value={form.remarks}
                        onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                      />
                    </div>
                  </div>
                  {formError && <div className="text-red-600 text-center mt-2">{formError}</div>}
                  {formSuccess && <div className="text-green-600 text-center mt-2">{formSuccess}</div>}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={formLoading}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-60"
                    >
                      {formLoading ? 'Saving...' : 'Save Beneficiary'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
  </main>
  );
};

export default ProgramDetails;
