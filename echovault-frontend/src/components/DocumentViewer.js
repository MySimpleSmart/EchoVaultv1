import React, { useState, useEffect } from 'react';

const DocumentViewer = ({ isOpen, onClose, documentData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchedMediaData, setFetchedMediaData] = useState(null);

  // Debug logging
  console.log('DocumentViewer props:', { isOpen, documentData });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Fetch media details if we only have an ID
  useEffect(() => {
    const fetchMediaDetails = async () => {
      // Extract the actual ID from the documentData
      let mediaId = null;
      
      // Handle different data structures
      if (typeof documentData?.ID === 'number') {
        mediaId = documentData.ID;
      } else if (typeof documentData?.ID === 'string' && !isNaN(documentData.ID)) {
        mediaId = parseInt(documentData.ID);
      } else if (documentData?.ID && typeof documentData.ID === 'object') {
        // If ID is an object, try to extract the actual ID
        mediaId = documentData.ID.ID || documentData.ID.id || documentData.ID.value;
        if (mediaId && typeof mediaId === 'string' && !isNaN(mediaId)) {
          mediaId = parseInt(mediaId);
        }
      }
      
      console.log('Attempting to fetch media details:', {
        documentData: documentData,
        mediaId: mediaId,
        hasSourceUrl: !!documentData?.source_url,
        hasGuid: !!documentData?.guid?.rendered
      });

      if (isOpen && mediaId && !documentData.source_url && !documentData.guid?.rendered) {
        setLoading(true);
        try {
          const token = localStorage.getItem('jwt_token');
          const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
          const response = await fetch(`${apiBase}/wp/v2/media/${mediaId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            mode: 'cors'
          });
          
          if (response.ok) {
            const mediaData = await response.json();
            console.log('Fetched media data:', mediaData);
            setFetchedMediaData(mediaData);
          } else {
            console.error('Failed to fetch media details:', response.status);
          }
        } catch (err) {
          console.error('Error fetching media details:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMediaDetails();
  }, [isOpen, documentData]);

  if (!isOpen || !documentData) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(documentUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        mode: 'cors'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = documentTitle || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Failed to download file:', response.status);
      }
    } catch (error) {
      console.error('Download error:', error);
      // Fallback to regular download
      window.open(documentUrl, '_blank');
    }
  };

  const getFileType = (mimeType) => {
    if (mimeType?.includes('pdf')) return 'pdf';
    if (mimeType?.includes('image')) return 'image';
    return 'other';
  };

  // Use fetched media data if available, otherwise use original documentData
  const currentData = fetchedMediaData || documentData;
  
  // Handle different data structures
  const fileType = getFileType(currentData.mime_type || currentData.post_mime_type);
  
  // Try multiple possible URL fields from WordPress media API
  let documentUrl = currentData.source_url || 
                   currentData.guid?.rendered || 
                   currentData.url || 
                   currentData.link || 
                   currentData.media_details?.sizes?.full?.source_url ||
                   currentData.media_details?.sizes?.large?.source_url ||
                   currentData.media_details?.sizes?.medium?.source_url;

  // Fallback: construct URL from WordPress site URL and file path
  if (!documentUrl && currentData.ID) {
    const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
    const siteUrl = apiBase.replace('/wp-json', '') || window.location.origin;
    const uploadDate = currentData.post_date?.split(' ')[0]?.replace(/-/g, '/');
    
    // Handle different ID formats
    let fileName = null;
    if (typeof currentData.ID === 'string') {
      fileName = currentData.ID;
    } else if (typeof currentData.ID === 'number') {
      fileName = currentData.ID.toString();
    } else if (typeof currentData.ID === 'object' && currentData.ID) {
      fileName = currentData.ID.ID || currentData.ID.id || currentData.ID.value || currentData.ID.toString();
    }
    
    // Try to get a proper filename from other fields
    const properFileName = currentData.post_name || currentData.post_title || fileName;
    
    console.log('Constructing fallback URL:', {
      siteUrl,
      uploadDate,
      fileName: properFileName,
      post_date: currentData.post_date,
      post_name: currentData.post_name,
      post_title: currentData.post_title,
      currentData: currentData,
      originalId: currentData.ID,
      idType: typeof currentData.ID
    });
    
    // Try different URL patterns
    if (uploadDate && properFileName && properFileName !== '[object Object]') {
      documentUrl = `${siteUrl}/wp-content/uploads/${uploadDate}/${properFileName}`;
    } else if (properFileName && properFileName !== '[object Object]') {
      // Try without date
      documentUrl = `${siteUrl}/wp-content/uploads/${properFileName}`;
    } else {
      // Last resort: try direct media URL with numeric ID
      const numericId = typeof currentData.ID === 'number' ? currentData.ID : 
                       (typeof currentData.ID === 'string' && !isNaN(currentData.ID)) ? parseInt(currentData.ID) :
                       (currentData.ID && typeof currentData.ID === 'object') ? (currentData.ID.ID || currentData.ID.id || currentData.ID.value) : null;
      
      if (numericId) {
        documentUrl = `${siteUrl}/wp-content/uploads/${numericId}`;
      }
    }
  }
                     
  const documentTitle = currentData.title?.rendered || currentData.post_title || currentData.title;
  const documentMimeType = currentData.mime_type || currentData.post_mime_type;

  console.log('DocumentViewer data:', {
    fileType,
    documentUrl,
    documentTitle,
    documentMimeType,
    availableFields: Object.keys(currentData),
    fullData: currentData,
    fetchedMediaData: fetchedMediaData,
    originalData: documentData
  });

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {documentTitle || 'Document Viewer'}
              </h3>
              <p className="text-sm text-gray-500">
                {documentMimeType || 'Unknown file type'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading document details...</p>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center">
              {fileType === 'image' ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={documentUrl}
                    alt={documentTitle || 'Document'}
                    className="max-w-[80vw] max-h-[70vh] object-contain rounded-lg shadow-sm"
                    style={{ minHeight: '200px', minWidth: '200px' }}
                    onLoad={() => {
                      setLoading(false);
                      console.log('Image loaded successfully:', documentUrl);
                    }}
                    onError={(e) => {
                      console.error('Image failed to load:', documentUrl, e);
                      setError('Failed to load image');
                    }}
                  />
                </div>
              ) : fileType === 'pdf' ? (
                <div className="w-full h-[600px]">
                  <iframe
                    src={documentUrl}
                    className="w-full h-full border-0 rounded-lg"
                    title={documentTitle || 'PDF Document'}
                    onError={() => setError('Failed to load PDF')}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Document Preview Not Available
                  </h4>
                  <p className="text-gray-600 mb-4">
                    This file type cannot be previewed in the browser.
                  </p>
                  {documentUrl && (
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Document
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-800">{error}</span>
                  </div>
                  {documentUrl && (
                    <div className="mt-3">
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Try Downloading Instead
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </a>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </button>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;