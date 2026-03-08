import React, { useState } from 'react'
import axios from 'axios'
import './AnalysisResults.css'

function AnalysisResults({ results, onDownload, onReset, onViewReports }) {
  const { analysis, text_report, report_url, notarization } = results

  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifyError, setVerifyError] = useState(null)

  // External PDF Verification state (separate from internal verify)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [externalVerifying, setExternalVerifying] = useState(false)
  const [externalVerifyResult, setExternalVerifyResult] = useState(null)
  const [externalVerifyError, setExternalVerifyError] = useState(null)

  const getRiskClass = (score) => {
    if (score >= 70) return 'risk-high'
    if (score >= 40) return 'risk-medium'
    return 'risk-low'
  }

  const getRiskLabel = (score) => {
    if (score >= 70) return 'High Risk'
    if (score >= 40) return 'Medium Risk'
    return 'Low Risk'
  }

  const getConflictColor = (conflictType) => {
    switch (conflictType) {
      case 'Consistent':
        return '#48bb78'
      case 'Partial Inconsistency':
        return '#ed8936'
      case 'High Inconsistency':
        return '#f56565'
      default:
        return '#a0aec0'
    }
  }

  const getReportId = () => {
    // Use explicit report_id from backend only
    return results?.report_id || null
  }

  const handleVerify = async () => {
    const reportId = getReportId()
    if (!reportId) {
      setVerifyError('Report ID is not available for verification.')
      return
    }

    setVerifying(true)
    setVerifyError(null)
    setVerifyResult(null)

    try {
      const response = await axios.get(
        `http://localhost:5003/api/reports/${reportId}/verify`
      )
      setVerifyResult(response.data)
    } catch (err) {
      console.error('Verification error:', err)
      setVerifyError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          'Verification failed. Please try again.'
      )
    } finally {
      setVerifying(false)
    }
  }

  // -------- External PDF Verification handlers --------
  const handleExternalFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type === 'application/pdf') {
      setUploadedFile(file)
      setExternalVerifyError(null)
      setExternalVerifyResult(null)
    } else {
      setExternalVerifyError('Please upload a valid PDF file.')
      setUploadedFile(null)
      setExternalVerifyResult(null)
    }
  }

  const handleExternalDragOver = (e) => {
    e.preventDefault()
  }

  const handleExternalDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (file.type === 'application/pdf') {
      setUploadedFile(file)
      setExternalVerifyError(null)
      setExternalVerifyResult(null)
    } else {
      setExternalVerifyError('Please upload a valid PDF file.')
      setUploadedFile(null)
      setExternalVerifyResult(null)
    }
  }

  const handleExternalVerify = async () => {
    const reportId = getReportId()
    if (!reportId) {
      setExternalVerifyError('Report ID not available; verification cannot be performed.')
      return
    }
    if (!uploadedFile) {
      setExternalVerifyError('Please upload a PDF to verify.')
      return
    }

    setExternalVerifying(true)
    setExternalVerifyError(null)
    setExternalVerifyResult(null)

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)

      const response = await axios.post(
        `http://localhost:5003/api/reports/verify_external/${reportId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setExternalVerifyResult(response.data)
    } catch (err) {
      console.error('External verification error:', err)
      setExternalVerifyError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          'Verification failed. Please try again.'
      )
    } finally {
      setExternalVerifying(false)
    }
  }

  return (
    <div className="analysis-results">
      <div className="card results-header">
        <div className="success-icon">✅</div>
        <h2>Analysis Complete</h2>
        <p>AI has successfully analyzed both reports and generated the final decision report.</p>
      </div>

      <div className="card">
        <h3>📊 Risk Assessment Summary</h3>
        
        <div className="result-grid">
          <div className="result-item">
            <div className="result-label">Media Risk Score</div>
            <div className="result-value">
              {analysis.media_risk_score}/100
            </div>
            <span className={`risk-badge ${getRiskClass(analysis.media_risk_score)}`}>
              {getRiskLabel(analysis.media_risk_score)}
            </span>
          </div>

          <div className="result-item">
            <div className="result-label">Complaint Risk Score</div>
            <div className="result-value">
              {analysis.complaint_risk_score}/100
            </div>
            <span className={`risk-badge ${getRiskClass(analysis.complaint_risk_score)}`}>
              {getRiskLabel(analysis.complaint_risk_score)}
            </span>
          </div>

          <div className="result-item">
            <div className="result-label">Risk Gap</div>
            <div className="result-value">
              {analysis.risk_gap}
            </div>
            <div className="result-sublabel">Difference between scores</div>
          </div>

          {analysis.unified_risk_score !== null ? (
            <div className="result-item highlight">
              <div className="result-label">Unified Risk Score</div>
              <div className="result-value">
                {analysis.unified_risk_score}/100
              </div>
              <span className={`risk-badge ${getRiskClass(analysis.unified_risk_score)}`}>
                {getRiskLabel(analysis.unified_risk_score)}
              </span>
            </div>
          ) : (
            <div className="result-item highlight suspended">
              <div className="result-label">Status</div>
              <div className="result-value suspended-text">
                SUSPENDED
              </div>
              <span className="risk-badge risk-uncertain">
                Manual Review Required
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>⚖️ Conflict Analysis</h3>
        
        <div className="conflict-info">
          <div className="conflict-badge" style={{ borderColor: getConflictColor(analysis.conflict_type) }}>
            <div className="conflict-label">Conflict Type</div>
            <div className="conflict-value" style={{ color: getConflictColor(analysis.conflict_type) }}>
              {analysis.conflict_type}
            </div>
          </div>

          <div className="confidence-meter">
            <div className="confidence-label">
              Confidence Level: {(analysis.confidence_level * 100).toFixed(1)}%
            </div>
            <div className="confidence-bar">
              <div 
                className="confidence-fill" 
                style={{ 
                  width: `${analysis.confidence_level * 100}%`,
                  background: analysis.confidence_level >= 0.7 
                    ? '#48bb78' 
                    : analysis.confidence_level >= 0.4 
                      ? '#ed8936' 
                      : '#f56565'
                }}
              ></div>
            </div>
          </div>
        </div>

        {analysis.requires_manual_review && (
          <div className="alert alert-error">
            <strong>⚠️ Manual Review Required</strong>
            <p>
              High inconsistency detected between reports. This case requires expert evaluation
              before making final decisions.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>🤖 AI Analysis Summary</h3>
        <div className="summary-text">
          {analysis.summary}
        </div>
      </div>

      <div className="card">
        <h3>📄 Final Report</h3>
        <div className="report-text">
          <pre>{text_report}</pre>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => navigator.clipboard.writeText(text_report)}
        >
          📋 Copy Report
        </button>
      </div>

      {/* External PDF Verification Panel */}
      <div className="card">
        <h3>🔍 External PDF Verification</h3>

        <div
          className="dropzone"
          onDragOver={handleExternalDragOver}
          onDrop={handleExternalDrop}
          style={{
            border: '2px dashed #cbd5e0',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'center',
            marginBottom: '1rem',
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('external-pdf-input')?.click()}
        >
          <p>Drag &amp; drop a PDF here, or click to select.</p>
          <p className="helper-text">
            Current file: {uploadedFile ? uploadedFile.name : 'None selected'}
          </p>
          <input
            id="external-pdf-input"
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={handleExternalFileChange}
          />
        </div>

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleExternalVerify}
            disabled={externalVerifying || !getReportId()}
          >
            {externalVerifying ? 'Verifying...' : '✅ Verify Uploaded PDF'}
          </button>
          {!getReportId() && (
            <p className="helper-text">
              Report ID not available; verification cannot be performed.
            </p>
          )}
        </div>

        {externalVerifyError && (
          <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>
            <strong>Verification Error:</strong> {externalVerifyError}
          </div>
        )}

        {externalVerifyResult && (
          <div className="verification-results" style={{ marginTop: '1rem' }}>
            <h4>Verification Results</h4>
            <div className="notarization-grid">
              <div className="notarization-item">
                <div className="result-label">Matches Database Hash</div>
                <div className="result-value">
                  {externalVerifyResult.matches_db ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Matches Blockchain Hash</div>
                <div className="result-value">
                  {externalVerifyResult.matches_blockchain ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Local Hash</div>
                <div className="result-value code-mono">
                  {externalVerifyResult.local_hash || 'N/A'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">DB Hash</div>
                <div className="result-value code-mono">
                  {externalVerifyResult.db_hash || 'N/A'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Blockchain Hash</div>
                <div className="result-value code-mono">
                  {externalVerifyResult.blockchain_hash || 'N/A'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Blockchain Status</div>
                <div className="result-value">
                  {externalVerifyResult.blockchain_status || 'SKIPPED'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Tx Hash</div>
                <div className="result-value">
                  {externalVerifyResult.blockchain_tx_hash &&
                  externalVerifyResult.blockchain_tx_hash !== 'N/A' ? (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${externalVerifyResult.blockchain_tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {externalVerifyResult.blockchain_tx_hash}
                    </a>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Block Number</div>
                <div className="result-value">
                  {externalVerifyResult.blockchain_block_number ?? 'N/A'}
                </div>
              </div>
            </div>

            {externalVerifyResult.error && (
              <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>
                <strong>Notice:</strong> {externalVerifyResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Blockchain Notarization Panel */}
      <div className="card">
        <h3>🔗 Blockchain Notarization</h3>
        {!notarization ? (
          <p>No notarization information available for this report.</p>
        ) : (
          <div className="notarization-grid">
            <div className="notarization-item">
              <div className="result-label">PDF SHA256 Hash</div>
              <div className="result-value code-mono">
                {notarization.pdf_hash || 'N/A'}
              </div>
            </div>
            <div className="notarization-item">
              <div className="result-label">Blockchain Status</div>
              <div className="result-value">
                {notarization.blockchain_status || 'SKIPPED'}
              </div>
            </div>
            <div className="notarization-item">
              <div className="result-label">Transaction Hash</div>
              <div className="result-value">
                {notarization.blockchain_tx_hash ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${notarization.blockchain_tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {notarization.blockchain_tx_hash}
                  </a>
                ) : (
                  'N/A'
                )}
              </div>
            </div>
            <div className="notarization-item">
              <div className="result-label">Block Number</div>
              <div className="result-value">
                {notarization.blockchain_block_number ?? 'N/A'}
              </div>
            </div>
          </div>
        )}

        {notarization?.error && (
          <div className="alert alert-error">
            <strong>Notarization Warning:</strong> {notarization.error}
          </div>
        )}

        <div className="actions" style={{ marginTop: '1rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleVerify}
            disabled={verifying || !getReportId()}
          >
            {verifying ? 'Verifying...' : '✅ Verify Against Blockchain'}
          </button>
          {!getReportId() && (
            <p className="helper-text">
              Report ID not available; verification cannot be performed.
            </p>
          )}
        </div>

        {verifyError && (
          <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>
            <strong>Verification Error:</strong> {verifyError}
          </div>
        )}

        {verifyResult && (
          <div className="verification-results" style={{ marginTop: '1rem' }}>
            <h4>Verification Results</h4>
            <div className="notarization-grid">
              <div className="notarization-item">
                <div className="result-label">Matches Database Hash</div>
                <div className="result-value">
                  {verifyResult.matches_db ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Matches Blockchain Hash</div>
                <div className="result-value">
                  {verifyResult.matches_blockchain ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Local Hash</div>
                <div className="result-value code-mono">
                  {verifyResult.local_hash}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">DB Hash</div>
                <div className="result-value code-mono">
                  {verifyResult.db_hash || 'N/A'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Blockchain Hash</div>
                <div className="result-value code-mono">
                  {verifyResult.blockchain_hash || 'N/A'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Blockchain Status</div>
                <div className="result-value">
                  {verifyResult.blockchain_status || 'N/A'}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Tx Hash</div>
                <div className="result-value">
                  {verifyResult.blockchain_tx_hash ? (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${verifyResult.blockchain_tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {verifyResult.blockchain_tx_hash}
                    </a>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div className="notarization-item">
                <div className="result-label">Block Number</div>
                <div className="result-value">
                  {verifyResult.blockchain_block_number ?? 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card actions-card">
        <div className="actions">
          <button 
            className="btn btn-primary"
            onClick={onDownload}
          >
            📥 Download Full Report (PDF)
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onViewReports}
          >
            📋 View All Reports
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onReset}
          >
            🔄 Analyze New Reports
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnalysisResults

