import React, { useState, useEffect } from 'react';
import { HeartIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';

// Use relative URLs to leverage Vite proxy
const fetchPrograms = async () => {
  const res = await fetch('/api/programs');
  return await res.json();
};
const fetchBeneficiaries = async () => {
  const res = await fetch('/api/beneficiaries');
  return await res.json();
};

const SocialServices = () => {
  const [programs, setPrograms] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const navigate = useNavigate();
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProgram, setEditProgram] = useState({});
  const [editData, setEditData] = useState({});
  const [addProgramMode, setAddProgramMode] = useState(false);
  const [addBeneficiaryMode, setAddBeneficiaryMode] = useState(false);
  const [currentProgramForBeneficiary, setCurrentProgramForBeneficiary] = useState(null);

  // Add Program form state
    const [programForm, setProgramForm] = useState({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: '',
      beneficiaryType: '',
      assistanceType: '',
      amount: '',
      maxBeneficiaries: '',
    });
  const [programFormError, setProgramFormError] = useState('');
  const [programFormLoading, setProgramFormLoading] = useState(false);
  const [programFormSuccess, setProgramFormSuccess] = useState('');

  useEffect(() => {
    fetchPrograms().then(setPrograms);
    fetchBeneficiaries().then(setBeneficiaries);
  }, []);

  const getBeneficiariesByProgram = (programId) => beneficiaries.filter(b => b.program_id === programId);

  const handleAddProgramClick = () => {
    setEditProgram({});
    setProgramForm({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: '',
      beneficiaryType: '',
      assistanceType: '',
      amount: '',
      maxBeneficiaries: '',
    });
    setProgramFormError('');
    setProgramFormSuccess('');
    setAddProgramMode(true);
    setShowProgramModal(true);
  };

  const handleEditProgramClick = (program) => {
    setEditProgram(program);
    setProgramForm({
      name: program.name || '',
      description: program.description || '',
      startDate: program.start_date || program.startDate || '',
      endDate: program.end_date || program.endDate || '',
      status: program.status || 'draft',
      beneficiaryType: program.beneficiary_type || program.beneficiaryType || '',
      assistanceType: program.assistance_type || program.assistanceType || '',
      amount: program.amount || '',
      maxBeneficiaries: program.max_beneficiaries || program.maxBeneficiaries || '',
    });
    setProgramFormError('');
    setProgramFormSuccess('');
    setAddProgramMode(false);
    setShowProgramModal(true);
  };
  const handleDeleteProgram = async (programId) => {
    if (!window.confirm('Are you sure you want to delete this program?')) return;
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        alert('Failed to delete program.');
        return;
      }
      fetchPrograms().then(setPrograms);
    } catch (err) {
      alert('Failed to delete program. ' + (err?.message || ''));
    }
  };
  const handleModalClose = () => {
    setShowModal(false);
    setEditData({});
    setAddBeneficiaryMode(false);
    setCurrentProgramForBeneficiary(null);
  };
  const handleProgramModalClose = () => {
    setShowProgramModal(false);
    setAddProgramMode(false);
    setProgramFormError('');
    setProgramFormSuccess('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const toInputDate = (dateString) => {
    if (!dateString) return '';
    // Handles ISO format like "2024-01-01T00:00:00.000000Z"
    return dateString.split('T')[0];
  };

  // --- Enhanced Analytics calculations ---
  const totalPrograms = programs.length;
  const totalBeneficiaries = beneficiaries.length;
  let earliestStart = null, latestEnd = null;
  let activePrograms = 0;
  let completedPrograms = 0;
  let draftPrograms = 0;
  const today = new Date();
  const beneficiariesPerProgram = programs.map(p => ({
    id: p.id,
    name: p.name,
    count: beneficiaries.filter(b => b.program_id === p.id).length
  }));
  programs.forEach(p => {
    if (p.start_date && (!earliestStart || new Date(p.start_date) < new Date(earliestStart))) {
      earliestStart = p.start_date;
    }
    if (p.end_date && (!latestEnd || new Date(p.end_date) > new Date(latestEnd))) {
      latestEnd = p.end_date;
    }
    // Status counts (use status field if present, else fallback to date logic)
    if (p.status) {
      if (p.status === 'ongoing') activePrograms++;
      else if (p.status === 'complete') completedPrograms++;
      else if (p.status === 'draft') draftPrograms++;
    } else if (p.start_date && p.end_date) {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      if (today >= start && today <= end) activePrograms++;
      else if (today < start) draftPrograms++;
      else if (today > end) completedPrograms++;
    }
  });

  // Top 3 programs by beneficiaries
  const topPrograms = [...beneficiariesPerProgram].sort((a, b) => b.count - a.count).slice(0, 3);

  // State for toggling analytics visibility
  const [showTopPrograms, setShowTopPrograms] = useState(true);
  const [showBeneficiariesBar, setShowBeneficiariesBar] = useState(true);

  return (
    <main className="bg-gradient-to-br from-green-50 to-white min-h-screen pt-20 px-2 sm:px-4 md:px-8 pb-10 font-sans lg:ml-64">
      <div className="w-full max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-green-700 mb-2">Government Programs Management</h1>
            <p className="text-gray-600 max-w-xl">Manage social assistance programs and their beneficiaries in a modern, card-based dashboard.</p>
          </div>
          <button
            className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-semibold transition-all duration-300 transform hover:scale-105"
            onClick={handleAddProgramClick}
          >
            <span className="text-lg font-bold">+</span> Add Program
          </button>
        </div>

        {/* Enhanced Analytics Section */}
        <div className="w-full flex flex-col gap-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-md border border-green-100 p-6 flex flex-col items-center justify-center">
              <div className="text-3xl font-bold text-green-700">{totalPrograms}</div>
              <div className="text-gray-600 text-sm mt-1">Total Programs</div>
            </div>
            <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 flex flex-col items-center justify-center">
              <div className="text-3xl font-bold text-blue-700">{totalBeneficiaries}</div>
              <div className="text-gray-600 text-sm mt-1">Total Beneficiaries</div>
            </div>
            <div className="bg-white rounded-2xl shadow-md border border-indigo-100 p-6 flex flex-col items-center justify-center">
              <div className="text-lg font-semibold text-indigo-700">{earliestStart ? formatDate(earliestStart) : 'N/A'} - {latestEnd ? formatDate(latestEnd) : 'N/A'}</div>
              <div className="text-gray-600 text-sm mt-1">Programs Date Range</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-6 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-emerald-700">{activePrograms}</div>
              <div className="text-gray-600 text-sm mt-1">Ongoing Programs</div>
            </div>
            <div className="bg-white rounded-2xl shadow-md border border-yellow-100 p-6 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-yellow-700">{draftPrograms}</div>
              <div className="text-gray-600 text-sm mt-1">Draft Programs</div>
            </div>
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-gray-700">{completedPrograms}</div>
              <div className="text-gray-600 text-sm mt-1">Completed Programs</div>
            </div>
          </div>
          {/* Top Programs Table with toggle */}
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-lg text-blue-700">Top 3 Programs by Beneficiaries (Detailed)</div>
              <button
                className="text-xs px-3 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold transition"
                onClick={() => setShowTopPrograms(v => !v)}
              >
                {showTopPrograms ? 'Hide' : 'Show'}
              </button>
            </div>
            {showTopPrograms && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-1">Program</th>
                    <th className="py-1">Description</th>
                    <th className="py-1">Date Range</th>
                    <th className="py-1">Status</th>
                    <th className="py-1">Beneficiaries</th>
                    <th className="py-1">% of Total</th>
                    <th className="py-1">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {topPrograms.map(p => {
                    const program = programs.find(pr => pr.id === p.id) || {};
                    const percent = totalBeneficiaries ? ((p.count / totalBeneficiaries) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="py-1 font-medium">{p.name}</td>
                        <td className="py-1">{program.description || 'N/A'}</td>
                        <td className="py-1">{formatDate(program.start_date)} - {formatDate(program.end_date)}</td>
                        <td className="py-1">{program.status ? program.status.charAt(0).toUpperCase() + program.status.slice(1) : 'N/A'}</td>
                        <td className="py-1">{p.count}</td>
                        <td className="py-1">{percent}%</td>
                        <td className="py-1">
                          <button
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition"
                            onClick={() => navigate(`/admin/social-services/program/${p.id}`)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* Simple Bar Chart Visualization with toggle */}
          <div className="bg-white rounded-2xl shadow-md border border-indigo-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-lg text-indigo-700">Beneficiaries per Program</div>
              <button
                className="text-xs px-3 py-1 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold transition"
                onClick={() => setShowBeneficiariesBar(v => !v)}
              >
                {showBeneficiariesBar ? 'Hide' : 'Show'}
              </button>
            </div>
            {showBeneficiariesBar && (
              <div className="w-full flex flex-col gap-2">
                {beneficiariesPerProgram.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-32 truncate text-gray-700 text-xs">{p.name}</span>
                    <div className="flex-1 bg-indigo-100 rounded h-4 relative">
                      <div
                        className="bg-indigo-500 h-4 rounded"
                        style={{ width: `${totalBeneficiaries ? (p.count / Math.max(...beneficiariesPerProgram.map(x => x.count), 1)) * 100 : 0}%`, minWidth: p.count > 0 ? '8px' : '0' }}
                      ></div>
                    </div>
                    <span className="ml-2 text-indigo-700 font-semibold text-xs">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Program Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {programs.map(program => (
            <div
              key={program.id}
              className={`rounded-2xl shadow-xl border-2 border-gray-100 bg-white p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl`}
              onClick={() => navigate(`/admin/social-services/program/${program.id}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-green-700">{program.name}</h2>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">{getBeneficiariesByProgram(program.id).length} Beneficiaries</span>
              </div>
              <p className="text-gray-600 mb-2">{program.description}</p>
              <div className="text-xs text-gray-500 mb-4">{formatDate(program.start_date)} - {formatDate(program.end_date)}</div>
              <div className="flex gap-2">
                <button
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all duration-300"
                  onClick={e => { e.stopPropagation(); handleDeleteProgram(program.id); }}
                >
                  Delete
                </button>
                <button
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all duration-300"
                  onClick={e => { e.stopPropagation(); handleEditProgramClick(program); }}
                >
                  Edit Program
                </button>
              </div>

              {/* Table now appears on a new page, not inline */}
            </div>
          ))}
        </div>

        {/* Add/Edit Beneficiary Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-3xl shadow-2xl border border-green-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-3xl p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {addBeneficiaryMode ? '+ Add Beneficiary' : 'Edit Beneficiary'}
                  </h2>
                  <button
                    onClick={handleModalClose}
                    className="text-white hover:text-red-200 transition-colors duration-200"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {/* ...beneficiary form fields here... */}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Program Modal */}
        {showProgramModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-3xl shadow-2xl border border-blue-100 w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-3xl p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {addProgramMode ? '+ Add Program' : 'Edit Program'}
                  </h2>
                  <button
                    onClick={handleProgramModalClose}
                    className="text-white hover:text-red-200 transition-colors duration-200"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <form
                  className="space-y-4"
                  onSubmit={async e => {
                    e.preventDefault();
                    setProgramFormError('');
                    setProgramFormSuccess('');
                    setProgramFormLoading(true);
                    try {
                      let url = '/api/programs';
                      let method = 'POST';
                      if (editProgram && editProgram.id) {
                        url = `/api/programs/${editProgram.id}`;
                        method = 'PUT';
                      }
                      const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: programForm.name,
                          description: programForm.description,
                          start_date: programForm.startDate,
                          end_date: programForm.endDate,
                          status: programForm.status,
                          beneficiary_type: programForm.beneficiaryType,
                          assistance_type: programForm.assistanceType,
                          amount: programForm.amount,
                          max_beneficiaries: programForm.maxBeneficiaries,
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setProgramFormError(data?.message || (editProgram && editProgram.id ? 'Failed to update program.' : 'Failed to add program.'));
                        return;
                      }
                      setProgramFormSuccess(editProgram && editProgram.id ? 'Program updated successfully!' : 'Program added successfully!');
                      setShowProgramModal(false);
                      setProgramForm({ name: '', description: '', startDate: '', endDate: '', status: '', beneficiaryType: '', assistanceType: '', amount: '', maxBeneficiaries: '' });
                      fetchPrograms().then(setPrograms);
                    } catch (err) {
                      setProgramFormError((editProgram && editProgram.id ? 'Failed to update program. ' : 'Failed to add program. ') + (err?.message || ''));
                    } finally {
                      setProgramFormLoading(false);
                    }
                  }}
                >
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Program Name</label>
                    <input
                      type="text"
                      value={programForm.name}
                      onChange={e => setProgramForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter program name"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      value={programForm.description}
                      onChange={e => setProgramForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter description"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={toInputDate(programForm.startDate)}
                        onChange={e => setProgramForm(f => ({ ...f, startDate: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={toInputDate(programForm.endDate)}
                        onChange={e => setProgramForm(f => ({ ...f, endDate: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                        required
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Beneficiaries</label>
                    <input
                      type="number"
                      min="1"
                      value={programForm.maxBeneficiaries}
                      onChange={e => setProgramForm(f => ({ ...f, maxBeneficiaries: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter maximum number of beneficiaries"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status <span className="text-red-600">*</span></label>
                    <select
                      value={programForm.status}
                      onChange={e => setProgramForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      required
                    >
                      <option value="">Select Status</option>
                      <option value="draft">Draft</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Beneficiary Type</label>
                    <input
                      type="text"
                      value={programForm.beneficiaryType}
                      onChange={e => setProgramForm(f => ({ ...f, beneficiaryType: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter beneficiary type"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Assistance Type</label>
                    <input
                      type="text"
                      value={programForm.assistanceType}
                      onChange={e => setProgramForm(f => ({ ...f, assistanceType: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter assistance type"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                    <input
                      type="number"
                      value={programForm.amount}
                      onChange={e => setProgramForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                  {programFormError && <div className="text-red-600 text-center mt-2">{programFormError}</div>}
                  {programFormSuccess && <div className="text-green-600 text-center mt-2">{programFormSuccess}</div>}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleProgramModalClose}
                      className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={programFormLoading}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-60"
                    >
                      {programFormLoading ? 'Saving...' : 'Save Program'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default SocialServices;