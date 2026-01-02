'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../../components/AppShell';
import { useToast } from '@/components/Toast';

export default function FamilyPortalPage() {
  const toast = useToast();

  // Ref to track shown errors and prevent toast flooding
  const shownErrorsRef = useRef(new Set());
  const lastFetchRef = useRef({});
  const [activeTab, setActiveTab] = useState('messages');
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [familyContacts, setFamilyContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [education, setEducation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [loadingEducation, setLoadingEducation] = useState(false);
  const [error, setError] = useState(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    event: '',
    milestoneType: 'custom',
    date: new Date().toISOString().split('T')[0],
    shared: true,
    notes: '',
  });

  // Helper to show error toast only once per error type
  const showErrorOnce = useCallback((errorKey, message) => {
    if (!shownErrorsRef.current.has(errorKey)) {
      shownErrorsRef.current.add(errorKey);
      toast.error(message);
      // Clear after 10 seconds to allow showing again if issue persists
      setTimeout(() => shownErrorsRef.current.delete(errorKey), 10000);
    }
  }, [toast]);

  // Fetch patients with family contacts
  const fetchFamilies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/patients?includeDischarged=false');
      if (!response.ok) {
        // Don't show toast for auth errors (401/403) - expected when not logged in
        if (response.status === 401 || response.status === 403) {
          setError('Please sign in to access the Family Portal');
          return;
        }
        throw new Error('Failed to fetch patients');
      }
      const data = await response.json();

      // Transform patients to family view
      const familyData = (data.data || []).map(patient => ({
        id: patient.id,
        patient: patient.name,
        mrn: patient.mrn,
        bed: patient.bed,
        status: patient.status,
        gestationalAge: patient.gestationalAge,
        dayOfLife: patient.dayOfLife,
        unread: 0, // Will be calculated from messages
      }));

      setFamilies(familyData);
      // Clear errors on success
      shownErrorsRef.current.clear();
      if (familyData.length > 0 && !selectedFamily) {
        setSelectedFamily(familyData[0]);
      }
    } catch (err) {
      setError(err.message);
      showErrorOnce('patients', 'Failed to load patients: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedFamily, showErrorOnce]);

  // Fetch family contacts for selected patient
  const fetchFamilyContacts = useCallback(async (patientId) => {
    if (!patientId) return;
    try {
      const response = await fetch(`/api/family?patientId=${patientId}`);
      if (!response.ok) {
        setFamilyContacts([]);
        setSelectedContact(null);
        return;
      }
      const data = await response.json();
      const contacts = data.data || [];
      setFamilyContacts(contacts);

      // Auto-select primary contact or first contact
      if (contacts.length > 0) {
        const primaryContact = contacts.find(c => c.isPrimaryContact);
        setSelectedContact(primaryContact || contacts[0]);
      } else {
        setSelectedContact(null);
      }
    } catch (err) {
      console.error('Failed to fetch family contacts:', err);
      setFamilyContacts([]);
      setSelectedContact(null);
    }
  }, []);

  // Fetch messages for selected patient
  const fetchMessages = useCallback(async (patientId) => {
    if (!patientId) return;

    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/family/messages/${patientId}`);
      if (!response.ok) {
        // Silently handle auth errors - main error shown by fetchFamilies
        setMessages([]);
        return;
      }
      const data = await response.json();
      setMessages(data.data || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setMessages([]);
      // Only show error toast once for network errors
      showErrorOnce('messages', 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, [showErrorOnce]);

  // Fetch milestones for selected patient
  const fetchMilestones = useCallback(async (patientId) => {
    if (!patientId) return;

    setLoadingMilestones(true);
    try {
      const response = await fetch(`/api/family/milestones/${patientId}`);
      if (!response.ok) {
        // Silently handle auth errors - main error shown by fetchFamilies
        setMilestones([]);
        return;
      }
      const data = await response.json();
      setMilestones(data.data || []);
    } catch (err) {
      console.error('Failed to fetch milestones:', err);
      setMilestones([]);
      showErrorOnce('milestones', 'Failed to load milestones');
    } finally {
      setLoadingMilestones(false);
    }
  }, [showErrorOnce]);

  // Fetch education materials
  const fetchEducation = useCallback(async (familyData, contactData) => {
    // Debounce - skip if called too recently
    const now = Date.now();
    if (lastFetchRef.current.education && now - lastFetchRef.current.education < 1000) {
      return;
    }
    lastFetchRef.current.education = now;

    setLoadingEducation(true);
    try {
      const params = new URLSearchParams();

      // Add patient-specific filters if available
      if (familyData?.gestationalAge) {
        params.append('gestationalAge', familyData.gestationalAge);
      }
      if (familyData?.dayOfLife) {
        params.append('dayOfLife', familyData.dayOfLife);
      }
      if (contactData?.id) {
        params.append('familyContactId', contactData.id);
      }

      const response = await fetch(`/api/family/education?${params}`);
      if (!response.ok) {
        // Silently handle auth errors - main error shown by fetchFamilies
        setEducation([]);
        return;
      }
      const data = await response.json();
      setEducation(data.data || []);
    } catch (err) {
      console.error('Failed to fetch education:', err);
      setEducation([]);
      showErrorOnce('education', 'Failed to load education materials');
    } finally {
      setLoadingEducation(false);
    }
  }, [showErrorOnce]);

  // Initial load
  useEffect(() => {
    fetchFamilies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Load family contacts when selected family changes
  useEffect(() => {
    if (selectedFamily?.id) {
      fetchFamilyContacts(selectedFamily.id);
    }
  }, [selectedFamily?.id, fetchFamilyContacts]);

  // Load data when family changes
  useEffect(() => {
    if (selectedFamily?.id) {
      fetchMessages(selectedFamily.id);
      fetchMilestones(selectedFamily.id);
    }
  }, [selectedFamily?.id, fetchMessages, fetchMilestones]);

  // Reload education when contact changes or family changes
  useEffect(() => {
    fetchEducation(selectedFamily, selectedContact);
  }, [selectedFamily?.id, selectedContact?.id, fetchEducation]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !selectedFamily || !selectedContact) {
      toast.warning('Please select a family contact to send a message');
      return;
    }

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/family/messages/${selectedFamily.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyContactId: selectedContact.id,
          content: newMessageText,
          messageType: 'update',
          channel: 'app',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to send message');
      }

      const result = await response.json();

      // Add the new message to the list
      setMessages(prev => [result.data, ...prev]);
      setNewMessageText('');
      toast.success('Message sent successfully');
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message: ' + err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  // Create milestone handler
  const handleCreateMilestone = async () => {
    if (!newMilestone.event.trim() || !selectedFamily) {
      toast.warning('Please enter a milestone event');
      return;
    }

    try {
      const response = await fetch(`/api/family/milestones/${selectedFamily.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMilestone,
          patientId: selectedFamily.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create milestone');
      }

      const result = await response.json();

      // Add the new milestone to the list
      setMilestones(prev => [result.data, ...prev]);
      setNewMilestone({
        event: '',
        milestoneType: 'custom',
        date: new Date().toISOString().split('T')[0],
        shared: true,
        notes: '',
      });
      setShowNewMilestone(false);
      toast.success('Milestone created successfully');
    } catch (err) {
      console.error('Failed to create milestone:', err);
      toast.error('Failed to create milestone: ' + err.message);
    }
  };

  // Milestone type options
  const milestoneTypes = [
    { value: 'first_breath', label: 'First Breath' },
    { value: 'off_oxygen', label: 'Off Oxygen' },
    { value: 'first_feed', label: 'First Feed' },
    { value: 'first_bottle', label: 'First Bottle' },
    { value: 'first_breastfeed', label: 'First Breastfeed' },
    { value: 'kangaroo_care', label: 'Kangaroo Care' },
    { value: 'weight_gain', label: 'Weight Gain' },
    { value: 'phototherapy_complete', label: 'Phototherapy Complete' },
    { value: 'extubation', label: 'Extubation' },
    { value: 'discharge_ready', label: 'Discharge Ready' },
    { value: 'custom', label: 'Custom' },
  ];

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
            <div className="text-slate-400">Loading family portal...</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Family Portal</h1>
            <p className="text-slate-400 text-sm">
              Parent communication and education
              {familyContacts.length > 0 && (
                <span className="ml-2">
                  | {familyContacts.length} family contact{familyContacts.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          {selectedContact && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  {selectedContact.fullName}
                </div>
                <div className="text-xs text-slate-400 capitalize">
                  {selectedContact.relationship}
                  {selectedContact.isPrimaryContact && ' (Primary)'}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('messages')}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                New Message
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Patient Sidebar */}
          <div className="col-span-3 bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Patients</h3>
            <div className="space-y-2">
              {families.map((family) => (
                <button
                  key={family.id}
                  onClick={() => setSelectedFamily(family)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedFamily?.id === family.id
                      ? 'bg-cyan-500/20 border border-cyan-500/50'
                      : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{family.patient}</span>
                    {family.unread > 0 && (
                      <span className="w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                        {family.unread}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Bed {family.bed} | {family.mrn}
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Patient Info */}
            {selectedFamily && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <h4 className="text-sm font-medium text-white mb-3">{selectedFamily.patient}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {selectedFamily.mrn}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Bed {selectedFamily.bed}
                  </div>
                </div>

                {/* Family Contacts */}
                {familyContacts.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h5 className="text-xs font-medium text-slate-400 mb-2">Family Contacts</h5>
                    <div className="space-y-1">
                      {familyContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className={`w-full p-2 rounded text-left text-xs transition-colors ${
                            selectedContact?.id === contact.id
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                          }`}
                        >
                          <div className="font-medium">{contact.fullName}</div>
                          <div className="capitalize text-xs opacity-75">
                            {contact.relationship}
                            {contact.isPrimaryContact && ' (Primary)'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {familyContacts.length === 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-500">No family contacts registered</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="col-span-9 space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {['messages', 'milestones', 'education', 'photos'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                    activeTab === tab ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'messages' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">
                      Message History - {selectedFamily?.patient}
                    </h3>
                    {selectedContact && (
                      <div className="text-xs text-slate-400">
                        Messaging: {selectedContact.fullName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                  {loadingMessages ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <div className="text-slate-400 text-sm">Loading messages...</div>
                    </div>
                  ) : !selectedContact ? (
                    <div className="text-center text-slate-400 py-8">
                      <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                      <p>No family contact selected.</p>
                      <p className="text-sm mt-1">Please register a family contact to send messages.</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p>No messages yet.</p>
                      <p className="text-sm mt-1">Start a conversation with the family.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.isInbound ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-md p-3 rounded-lg ${
                          msg.isInbound
                            ? 'bg-slate-700 text-white'
                            : 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-400">{msg.from}</span>
                            <span className="text-xs text-slate-500">{formatTime(msg.createdAt)}</span>
                          </div>
                          <p className="text-sm">{msg.content}</p>
                          {msg.status && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className={`text-xs ${
                                msg.status === 'sent' || msg.status === 'delivered'
                                  ? 'text-green-400'
                                  : msg.status === 'pending'
                                  ? 'text-yellow-400'
                                  : 'text-slate-400'
                              }`}>
                                {msg.status}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-4 border-t border-slate-700">
                  {!selectedContact ? (
                    <div className="text-center text-slate-500 text-sm py-2">
                      No family contact available to message
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        disabled={sendingMessage}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !newMessageText.trim()}
                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendingMessage ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'milestones' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Milestones</h3>
                  <button
                    onClick={() => setShowNewMilestone(true)}
                    className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm hover:bg-cyan-500/30 transition-colors"
                  >
                    Add Milestone
                  </button>
                </div>
                <div className="space-y-3">
                  {loadingMilestones ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <div className="text-slate-400 text-sm">Loading milestones...</div>
                    </div>
                  ) : milestones.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <p>No milestones recorded yet.</p>
                      <p className="text-sm mt-1">Click &quot;Add Milestone&quot; to record achievements.</p>
                    </div>
                  ) : (
                    milestones.map((milestone) => (
                      <div key={milestone.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-white font-medium">{milestone.event}</div>
                            <div className="text-sm text-slate-400">
                              {formatDate(milestone.date)}
                              {milestone.notes && (
                                <span className="ml-2 text-xs">- {milestone.notes}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                          milestone.shared ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
                        }`}>
                          {milestone.shared ? 'Shared with family' : 'Not shared'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'education' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <h3 className="font-semibold text-white mb-4">Parent Education</h3>
                <div className="space-y-3">
                  {loadingEducation ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <div className="text-slate-400 text-sm">Loading education materials...</div>
                    </div>
                  ) : education.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <p>No education materials available.</p>
                    </div>
                  ) : (
                    education.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            item.contentType === 'video'
                              ? 'bg-red-500/20'
                              : item.contentType === 'article'
                              ? 'bg-blue-500/20'
                              : item.contentType === 'pdf'
                              ? 'bg-purple-500/20'
                              : 'bg-slate-500/20'
                          }`}>
                            {item.contentType === 'video' ? (
                              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : item.contentType === 'pdf' ? (
                              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">{item.title}</div>
                            <div className="text-xs text-slate-400 capitalize">
                              {item.category} | {item.contentType}
                              {item.estimatedMinutes && (
                                <span className="ml-2">| {item.estimatedMinutes} min</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.progress?.status === 'completed' || item.completed ? (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Completed</span>
                          ) : item.progress?.status === 'in_progress' ? (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">In Progress</span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-600 text-slate-400 rounded text-xs">Available</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Photo Gallery</h3>
                  <button className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm hover:bg-cyan-500/30 transition-colors">
                    Upload Photo
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-square bg-slate-700 rounded-lg flex items-center justify-center text-slate-500">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* New Milestone Modal */}
        {showNewMilestone && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Add Milestone</h3>
                <button
                  onClick={() => {
                    setShowNewMilestone(false);
                    setNewMilestone({
                      event: '',
                      milestoneType: 'custom',
                      date: new Date().toISOString().split('T')[0],
                      shared: true,
                      notes: '',
                    });
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Milestone Type */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Milestone Type</label>
                  <select
                    value={newMilestone.milestoneType}
                    onChange={(e) => setNewMilestone({ ...newMilestone, milestoneType: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {milestoneTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Event Description */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Event Description *</label>
                  <input
                    type="text"
                    value={newMilestone.event}
                    onChange={(e) => setNewMilestone({ ...newMilestone, event: e.target.value })}
                    placeholder="e.g., First successful breastfeed"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Date</label>
                  <input
                    type="date"
                    value={newMilestone.date}
                    onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Notes (Optional)</label>
                  <textarea
                    value={newMilestone.notes}
                    onChange={(e) => setNewMilestone({ ...newMilestone, notes: e.target.value })}
                    placeholder="Additional details..."
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Share with Family */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="shareWithFamily"
                    checked={newMilestone.shared}
                    onChange={(e) => setNewMilestone({ ...newMilestone, shared: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-2 focus:ring-cyan-500"
                  />
                  <label htmlFor="shareWithFamily" className="text-sm text-white cursor-pointer">
                    Share with family
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowNewMilestone(false);
                    setNewMilestone({
                      event: '',
                      milestoneType: 'custom',
                      date: new Date().toISOString().split('T')[0],
                      shared: true,
                      notes: '',
                    });
                  }}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMilestone}
                  disabled={!newMilestone.event.trim()}
                  className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Milestone
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
