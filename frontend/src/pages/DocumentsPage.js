/**
 * Documents Page
 * File upload with drag & drop, document management, processing status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Trash2, FileText, RefreshCw, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { documentAPI, chatAPI } from '../services/api';
import AppLayout from '../components/Layout/AppLayout';

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    completed:  { cls: 'badge-success', icon: <CheckCircle size={10} />, label: 'Ready' },
    processing: { cls: 'badge-warning', icon: <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Processing' },
    pending:    { cls: 'badge-muted',   icon: <Clock size={10} />, label: 'Pending' },
    failed:     { cls: 'badge-danger',  icon: <XCircle size={10} />, label: 'Failed' }
  };
  const s = map[status] || map.pending;
  return <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>;
}

// ─── Document Card ────────────────────────────────────────────────────────────
function DocumentCard({ doc, onDelete, onChat }) {
  const iconMap = { pdf: '📕', txt: '📄', md: '📝', docx: '📘' };
  const sizeLabel = (bytes) => {
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="document-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="doc-icon">{iconMap[doc.fileType] || '📄'}</div>
        <StatusBadge status={doc.embeddingStatus} />
      </div>

      <div className="doc-name" title={doc.name}
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {doc.name}
      </div>

      <div className="doc-meta">
        {doc.fileType.toUpperCase()} · {sizeLabel(doc.fileSize)}
        {doc.pageCount > 0 && ` · ${doc.pageCount} pages`}
        {doc.chunkCount > 0 && ` · ${doc.chunkCount} chunks`}
      </div>

      {doc.summary && (
        <div className="doc-summary" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {doc.summary}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Added {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {doc.embeddingStatus === 'completed' && (
            <button className="btn btn-secondary btn-sm" onClick={() => onChat(doc)}>
              <MessageSquare size={12} /> Chat
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => onDelete(doc._id)}
            style={{ color: 'var(--danger)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Dropzone ──────────────────────────────────────────────────────────
function UploadZone({ onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]  = useState(0);
  const [subject, setSubject]    = useState('General');

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    setUploading(true);
    setProgress(0);

    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('subject', subject);

      try {
        await documentAPI.upload(formData, setProgress);
        toast.success(`"${file.name}" uploaded! Processing in background...`);
        onUpload();
      } catch (err) {
        toast.error(err.response?.data?.error || `Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    setProgress(0);
  }, [subject, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    maxSize: 20 * 1024 * 1024,
    disabled: uploading
  });

  return (
    <div style={{ marginBottom: 28 }}>
      <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'drag-over' : ''}`}>
        <input {...getInputProps()} />
        <div className="upload-icon">{isDragActive ? '📥' : '📤'}</div>
        <h3>{isDragActive ? 'Drop files here' : 'Upload Study Materials'}</h3>
        <p>Drag & drop PDF, TXT, or MD files here, or click to browse</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Max 20MB per file</p>
      </div>

      {uploading && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subject:</label>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="form-input"
          style={{ maxWidth: 200 }}
        >
          {['General', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Literature', 'Economics', 'Other'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Main Documents Page ──────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    try {
      const { data } = await documentAPI.getAll();
      setDocuments(data.documents || []);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Poll for status updates on processing docs
    const interval = setInterval(() => {
      const hasProcessing = documents.some(d => d.embeddingStatus === 'processing' || d.embeddingStatus === 'pending');
      if (hasProcessing) fetchDocuments();
    }, 5000);
    return () => clearInterval(interval);
  }, [documents.length]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document? It will be removed from the AI index.')) return;
    try {
      await documentAPI.delete(id);
      setDocuments(d => d.filter(doc => doc._id !== id));
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const handleChatAbout = async (doc) => {
    try {
      const { data } = await chatAPI.createSession({ title: `Chat about: ${doc.name}` });
      navigate(`/chat/${data.session._id}?prompt=${encodeURIComponent(`Tell me about the key topics covered in "${doc.name}"`)}`);
    } catch {
      navigate('/chat');
    }
  };

  const completedCount   = documents.filter(d => d.embeddingStatus === 'completed').length;
  const processingCount  = documents.filter(d => d.embeddingStatus === 'processing' || d.embeddingStatus === 'pending').length;

  return (
    <AppLayout>
      <div className="documents-page fade-in">
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Study Materials</h1>
            <p className="page-subtitle">
              {completedCount} documents ready for AI · {processingCount} processing
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchDocuments}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <UploadZone onUpload={fetchDocuments} />

        {loading && (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p>Loading documents...</p>
          </div>
        )}

        {!loading && documents.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>No documents yet</h3>
            <p>Upload your study materials to enable AI-powered contextual answers</p>
          </div>
        )}

        {documents.length > 0 && (
          <div className="documents-grid">
            {documents.map(doc => (
              <DocumentCard
                key={doc._id}
                doc={doc}
                onDelete={handleDelete}
                onChat={handleChatAbout}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
