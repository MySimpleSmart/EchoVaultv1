import React, { useState, useEffect } from 'react';
import SuccessMessage from './components/SuccessMessage';
import ConfirmationModal from './components/ConfirmationModal';

const Notes = ({ token }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ show: false, message: '', type: 'success' });
  const [form, setForm] = useState({
    note_title: '',
    note: '',
    note_type: 'General'
  });
  const [selectedNote, setSelectedNote] = useState(null);
  const [showNoteDetails, setShowNoteDetails] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({
    note_title: '',
    note: '',
    note_type: 'General'
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const [noteToDelete, setNoteToDelete] = useState(null);
  const [originalEditForm, setOriginalEditForm] = useState({
    note_title: '',
    note: '',
    note_type: 'General'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;

  // Note types
  const noteTypes = [
    'General',
    'Client',
    'Loan',
    'System',
    'Other'
  ];

  // Fetch notes
  const fetchNotes = async () => {
    if (!token) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Try different possible endpoint names
      const possibleEndpoints = ['notes', 'note-system', 'note'];
      let response = null;
      let data = null;

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Trying endpoint: ${apiBase}/wp/v2/${endpoint}`);
          response = await fetch(`${apiBase}/wp/v2/${endpoint}?status=publish,draft&per_page=100`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            data = await response.json();
            console.log(`Success with endpoint: ${endpoint}`, data);
            break;
          } else {
            console.log(`Failed with endpoint ${endpoint}: ${response.status} ${response.statusText}`);
          }
        } catch (endpointErr) {
          console.log(`Error with endpoint ${endpoint}:`, endpointErr);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Failed to fetch notes from any endpoint. Last status: ${response?.status} ${response?.statusText}`);
      }

      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError(`Failed to load notes: ${err.message}. Please check if the PODS backend is configured correctly.`);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreateNew = () => {
    setForm({
      note_title: '',
      note: '',
      note_type: 'General'
    });
    setShowForm(true);
  };

  const handleViewDetails = (note) => {
    setSelectedNote(note);
    setShowNoteDetails(true);
  };

  const handleCloseDetails = () => {
    setSelectedNote(null);
    setShowNoteDetails(false);
  };

  const handleDeleteNote = (noteId) => {
    setNoteToDelete(noteId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteNote = async () => {
    if (!token || !noteToDelete) return;

    try {
      const response = await fetch(`${apiBase}/wp/v2/notes/${noteToDelete}?force=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete note: ${response.status} ${response.statusText}`);
      }

      // Remove note from local state
      setNotes(prev => prev.filter(note => String(note.id) !== String(noteToDelete)));
      setSuccessMessage({ show: true, message: 'Note deleted successfully', type: 'success' });
      
      // Close all modals
      setShowDeleteConfirm(false);
      setNoteToDelete(null);
      handleCloseDetails();
    } catch (err) {
      console.error('Error deleting note:', err);
      setError(`Failed to delete note: ${err.message}`);
      setShowDeleteConfirm(false);
      setNoteToDelete(null);
    }
  };

  const cancelDeleteNote = () => {
    setShowDeleteConfirm(false);
    setNoteToDelete(null);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    
    // Strip HTML tags from content since we're using plain textarea
    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').trim();
    };
    
    const initialForm = {
      note_title: note.note_title || note.title?.rendered || '',
      note: stripHtml(note.note || note.content?.rendered || ''),
      note_type: note.note_type || 'General'
    };
    
    // Create deep copies to avoid object reference issues
    const editFormCopy = { ...initialForm };
    const originalFormCopy = { ...initialForm };
    
    setEditForm(editFormCopy);
    setOriginalEditForm(originalFormCopy);
    setShowEditForm(true);
    handleCloseDetails();
  };

  const hasChanges = () => {
    // Handle note_type as array (from API) vs string (from form)
    const currentType = Array.isArray(editForm.note_type) ? editForm.note_type[0] : editForm.note_type;
    const originalType = Array.isArray(originalEditForm.note_type) ? originalEditForm.note_type[0] : originalEditForm.note_type;
    
    const titleChanged = editForm.note_title !== originalEditForm.note_title;
    const noteChanged = editForm.note !== originalEditForm.note;
    const typeChanged = currentType !== originalType;
    
    return titleChanged || noteChanged || typeChanged;
  };

  const handleCloseEdit = () => {
    if (hasChanges()) {
      setShowUnsavedConfirm(true);
    } else {
      closeEditForm();
    }
  };

  const closeEditForm = () => {
    setEditingNote(null);
    setShowEditForm(false);
    setEditForm({
      note_title: '',
      note: '',
      note_type: 'General'
    });
    setOriginalEditForm({
      note_title: '',
      note: '',
      note_type: 'General'
    });
    setShowUnsavedConfirm(false);
  };

  const handleConfirmCancel = () => {
    setShowEditForm(false);
    setShowUnsavedConfirm(false);
  };

  const handleConfirmSave = () => {
    setShowUnsavedConfirm(false);
    handleUpdateNote({ preventDefault: () => {} });
  };

  const handleUpdateNote = async (e) => {
    e.preventDefault();
    if (!token || !editingNote) return;

    // Validate form
    if (!editForm.note_title.trim()) {
      setError('Note title is required');
      return;
    }
    
    if (!editForm.note.trim()) {
      setError('Note content is required');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage({ show: false, message: '', type: 'success' });
    
    try {
      const noteData = {
        title: editForm.note_title,
        status: 'publish',
        note_title: editForm.note_title,
        note: editForm.note,
        note_type: editForm.note_type
      };

      const response = await fetch(`${apiBase}/wp/v2/notes/${editingNote.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update note: ${response.status} ${response.statusText}`);
      }

      const updatedNote = await response.json();
      
      // Update note in local state
      setNotes(prev => prev.map(note => 
        note.id === editingNote.id ? updatedNote : note
      ));

      setSuccessMessage({ show: true, message: 'Note updated successfully', type: 'success' });
      closeEditForm();
    } catch (err) {
      console.error('Error updating note:', err);
      setError(`Failed to update note: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    // Validate form
    if (!form.note_title.trim()) {
      setError('Note title is required');
      return;
    }
    
    if (!form.note.trim()) {
      setError('Note content is required');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage({ show: false, message: '', type: 'success' });
    
    try {
      const noteData = {
        title: form.note_title,
        status: 'publish',
        note_title: form.note_title,
        note: form.note,
        note_type: form.note_type
      };

      // Try different possible endpoint names for creating notes
      const possibleEndpoints = ['notes', 'note-system', 'note'];
      let response = null;
      let success = false;

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Trying to create note with endpoint: ${apiBase}/wp/v2/${endpoint}`);
          response = await fetch(`${apiBase}/wp/v2/${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(noteData),
          });

          if (response.ok) {
            success = true;
            console.log(`Success creating note with endpoint: ${endpoint}`);
            break;
          } else {
            console.log(`Failed creating note with endpoint ${endpoint}: ${response.status} ${response.statusText}`);
          }
        } catch (endpointErr) {
          console.log(`Error creating note with endpoint ${endpoint}:`, endpointErr);
        }
      }

      if (!success || !response || !response.ok) {
        throw new Error(`Failed to create note with any endpoint. Last status: ${response?.status} ${response?.statusText}`);
      }

      const newNote = await response.json();
      
      // Add the new note to the list
      setNotes(prev => [newNote, ...prev]);
      
      // Show success message
      setSuccessMessage({ show: true, message: 'Note created successfully!', type: 'success' });
      
      // Reset form and close
      setForm({
        note_title: '',
        note: '',
        note_type: 'General'
      });
      setShowForm(false);
      
    } catch (err) {
      console.error('Error creating note:', err);
      setError(`Failed to create note: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getNoteTypeColor = (type) => {
    switch (type) {
      case 'General':
        return 'bg-gray-100 text-gray-800';
      case 'Client':
        return 'bg-blue-100 text-blue-800';
      case 'Loan':
        return 'bg-green-100 text-green-800';
      case 'System':
        return 'bg-purple-100 text-purple-800';
      case 'Other':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter notes based on search term and type
  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchTerm === '' || 
      (note.note_title || note.title?.rendered || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.note || note.content?.rendered || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'All' || note.note_type === filterType;
    
    return matchesSearch && matchesType;
  });

  if (showForm) {
    return (
      <div>
        {/* Header Section */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Add New Note</h1>
            <p className="text-gray-600">Create and save an internal note</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Note Title */}
              <div>
                <label htmlFor="note_title" className="block text-sm font-medium text-gray-700 mb-2">
                  Note Title *
                </label>
                <input
                  type="text"
                  id="note_title"
                  name="note_title"
                  value={form.note_title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter note title"
                />
              </div>

              {/* Note Type */}
              <div>
                <label htmlFor="note_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Note Type *
                </label>
                <select
                  id="note_type"
                  name="note_type"
                  value={form.note_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {noteTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note Content */}
            <div>
              <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
                Note Content *
              </label>
              <textarea
                id="note"
                name="note"
                value={form.note}
                onChange={handleInputChange}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Write your note here..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
                  {submitting 
                    ? 'Creating...' 
                    : 'Create Note'
                  }
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Edit Note Form
  if (showEditForm && editingNote) {
    return (
      <div>
        {/* Header Section */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Note</h1>
            <p className="text-gray-600">Update note information</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleUpdateNote} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Note Title */}
              <div>
                <label htmlFor="edit_note_title" className="block text-sm font-medium text-gray-700 mb-2">
                  Note Title *
                </label>
                <input
                  type="text"
                  id="edit_note_title"
                  name="note_title"
                  value={editForm.note_title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, note_title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter note title"
                />
              </div>

              {/* Note Type */}
              <div>
                <label htmlFor="edit_note_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Note Type *
                </label>
                <select
                  id="edit_note_type"
                  name="note_type"
                  value={editForm.note_type}
                  onChange={(e) => setEditForm(prev => ({ ...prev, note_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {noteTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note Content */}
            <div>
              <label htmlFor="edit_note" className="block text-sm font-medium text-gray-700 mb-2">
                Note Content *
              </label>
              <textarea
                id="edit_note"
                name="note"
                value={editForm.note}
                onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Write your note here..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
                  {submitting 
                    ? 'Updating...' 
                    : 'Update Note'
                  }
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Unsaved Changes Confirmation Modal */}
        {showUnsavedConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Unsaved Changes</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    You have unsaved changes. Do you want to save them before closing?
                  </p>
                </div>
                <div className="flex justify-center gap-3 mt-6">
                  <button
                    onClick={handleConfirmCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={handleConfirmSave}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Notes</h1>
            <p className="text-gray-600">Create and manage your internal notes</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add New Note</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading notes...</h3>
          <p className="text-gray-500">Please wait while we fetch your notes.</p>
        </div>
      )}

      {/* No Results State */}
      {!loading && notes.length > 0 && filteredNotes.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No notes found</h3>
          <p className="text-gray-500 mb-6">
            No notes match your search criteria. Try adjusting your search or filter.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterType('All');
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Clear Filters
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && notes.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h10M7 11h10M7 15h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No notes yet</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Create and organize notes related to loans and borrowers. This section will hold your internal notes.</p>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add First Note</span>
          </button>
        </div>
      )}

      {/* Search and Filter Section */}
      {!loading && notes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Input */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Notes
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search by title or content..."
                />
              </div>
            </div>

            {/* Filter by Type */}
            <div>
              <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Type
              </label>
              <select
                id="filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="All">All Types</option>
                {noteTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Results Count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredNotes.length} of {notes.length} notes
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {!loading && filteredNotes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note, index) => {
            // Handle note_type from API response
            let noteType = note.note_type;
            if (Array.isArray(noteType)) {
              noteType = noteType[0];
            }
            
            // Get content for preview
            const noteContent = note.note || note.content?.rendered || 'No content';
            const previewContent = noteContent.length > 150 
              ? noteContent.substring(0, 150) + '...' 
              : noteContent;
            
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {note.note_title || note.title?.rendered || 'Untitled Note'}
                      </h3>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${getNoteTypeColor(noteType)}`}>
                      {noteType || 'General'}
                    </span>
                  </div>
                  
                  {/* Content Preview */}
                  <div className="text-gray-700 text-sm flex-1 mb-4">
                    <div 
                      className="overflow-hidden"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.4',
                        maxHeight: '5.6em'
                      }}
                    >
                      {previewContent}
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="mt-auto pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {new Date(note.date).toLocaleDateString()}
                      </div>
                      <button 
                        onClick={() => handleViewDetails(note)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Success Message */}
      <SuccessMessage
        isVisible={successMessage.show}
        onClose={() => setSuccessMessage({ show: false, message: '', type: 'success' })}
        message={successMessage.message}
        type={successMessage.type}
      />

      {/* Note Details Modal */}
      {showNoteDetails && selectedNote && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Note Details</h3>
                <button
                  onClick={handleCloseDetails}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* Title and Type */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold text-gray-900">
                      {selectedNote.note_title || selectedNote.title?.rendered || 'Untitled Note'}
                    </h4>
                  </div>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ml-4 ${getNoteTypeColor(selectedNote.note_type)}`}>
                    {selectedNote.note_type || 'General'}
                  </span>
                </div>

                {/* Note Content */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Content</h5>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-60 overflow-y-auto">
                    <div className="whitespace-pre-wrap">
                      {selectedNote.note || selectedNote.content?.rendered || 'No content'}
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Created:</span> {new Date(selectedNote.date).toLocaleDateString()} at {new Date(selectedNote.date).toLocaleTimeString()}
                    </div>
                    <div>
                      <span className="font-medium">Note ID:</span> {selectedNote.id}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                  <button
                    onClick={() => handleDeleteNote(selectedNote.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleCloseDetails}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => handleEditNote(selectedNote)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                    >
                      Edit Note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={cancelDeleteNote}
        onConfirm={confirmDeleteNote}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="error"
      />

    </div>
  );
};

export default Notes;
