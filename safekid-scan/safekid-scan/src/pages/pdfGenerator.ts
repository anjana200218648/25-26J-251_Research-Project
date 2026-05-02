// src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

interface ReportData {
  analysisReport: {
    score: number;
    riskLevel: string;
    prediction: string;
    confidence: number;
    reasoning: string;
    fileName: string;
    timestamp: string;
    analyzedAt: string;
    scoreBreakdown: {
      imageScore: number;
      textScore: number;
      hashtagScore: number;
      ageFactor: number;
      genderAdjustment: number;
      contextModifier: number;
      baseScore: number;
      calculatedScore: number;
    };
  };
  textAnalysis: any;
  hashtagAnalysis: any;
  contentCategoryAnalysis: any;
  extractedContent: {
    text: string;
    hashtags: string[];
  };
  recommendations: string[];
}

// HTML content generator for English report
const generateEnglishHTML = (data: ReportData): string => {
  const riskColor = data.analysisReport.score <= 30 ? '#22c55e' : 
                    data.analysisReport.score <= 60 ? '#eab308' : '#ef4444';
  
  const riskText = data.analysisReport.score <= 30 ? 'Low Risk' :
                   data.analysisReport.score <= 60 ? 'Medium Risk' : 'High Risk';

  // Function to get category-specific recommendations
  const getCategorySpecificRecommendations = () => {
    const categoryPath = data.contentCategoryAnalysis?.category_hierarchy || "";
    const prediction = data.analysisReport.prediction;

    // Check for Visual Addiction
    if (categoryPath.includes("Visual_addiction") || 
        categoryPath.includes("Visual") ||
        categoryPath.includes("visual")) {
      return {
        title: "Visual Addiction",
        icon: "👁️",
        color: "#3b82f6",
        bgColor: "#eff6ff",
        borderColor: "#bfdbfe",
        english: [
          "Limit screen time to 1-2 hours daily",
          "Encourage educational games",
          "Schedule outdoor activities"
        ],
        sinhala: [
          "දිනකට 1-2 පැය තිර කාලය සීමා කරන්න",
          "රසික ක්‍රීඩා දිරිමත් කරන්න",
          "බාහිර ක්‍රියාකාරකම් සැලසුම් කරන්න"
        ]
      };
    }
    
    // Check for Explicit Harmful
    if (categoryPath.includes("explicit_harmful") || 
        categoryPath.includes("Explicit") ||
        categoryPath.includes("explicit")) {
      return {
        title: "Explicit Harmful Content",
        icon: "💀",
        color: "#dc2626",
        bgColor: "#fef2f2",
        borderColor: "#fecaca",
        english: [
          "Have serious conversation about dangers",
          "Secure dangerous items in home",
          "Use parental controls"
        ],
        sinhala: [
          "අවදානම් ගැන ගරුත්වයෙන් කතා කරන්න",
          "ගෙදර අනතුරු උපකරණ සුරක්ෂිත කරන්න",
          "Parental controls භාවිතා කරන්න"
        ]
      };
    }
    
    // Check for Psychological Triggers
    if (categoryPath.includes("Psychological_triggers") || 
        categoryPath.includes("psychological_triggers") ||
        categoryPath.includes("Psychological")) {
      return {
        title: "Psychological Triggers",
        icon: "⚠️",
        color: "#eab308",
        bgColor: "#fefce8",
        borderColor: "#fef08a",
        english: [
          "Watch content together and discuss",
          "Teach difference between fiction and reality",
          "Follow age ratings"
        ],
        sinhala: [
          "එකට නැරඹීම සහ සාකච්ඡා කිරීම",
          "කල්පිතය හා යථාර්ථය අතර වෙනස උගන්වන්න",
          "වයස් ශ්‍රේණිගත කිරීම් පිළිපදින්න"
        ]
      };
    }
    
    // Non-addictive content
    if (prediction === 'non-addictive' || 
        categoryPath.includes("Non-addictive") ||
        categoryPath.includes("non-addictive")) {
      return {
        title: "Safe / Educational Content",
        icon: "✅",
        color: "#16a34a",
        bgColor: "#f0fdf4",
        borderColor: "#bbf7d0",
        english: [
          "Encourage educational content",
          "Maintain balanced screen time",
          "Discuss learning topics"
        ],
        sinhala: [
          "රසික අන්තර්ගත දිරිමත් කරන්න",
          "සමතුලිත තිර කාලය පවත්වාගන්න",
          "ඉගෙන ගන්නා දේ ගැන සාකච්ඡා කරන්න"
        ]
      };
    }
    
    // Addictive content fallback
    if (prediction === 'addictive') {
      return {
        title: "General Addictive Content",
        icon: "⚠️",
        color: "#f97316",
        bgColor: "#fff7ed",
        borderColor: "#fed7aa",
        english: [
          "Monitor content consumption",
          "Set screen time limits",
          "Encourage offline activities"
        ],
        sinhala: [
          "අන්තර්ගත පරිභෝජනය නිරීක්ෂණය කරන්න",
          "තිර කාලය සීමා කරන්න",
          "නිර්වාහිත ක්‍රියාකාරකම් දිරිමත් කරන්න"
        ]
      };
    }
    
    // Default fallback
    return null;
  };

  const categoryRecommendations = getCategorySpecificRecommendations();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>SafeKid Scan Report</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Arial', 'Iskoola Pota', 'Noto Sans Sinhala', sans-serif;
        }
        body {
          background: white;
          padding: 30px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          padding: 30px;
          border-radius: 15px;
          margin-bottom: 30px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .header h1 {
          font-size: 32px;
          margin-bottom: 5px;
        }
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        .date {
          text-align: right;
          font-size: 12px;
          margin-top: -40px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 25px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid #e5e7eb;
        }
        .card-title {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .card-title span {
          background: #dbeafe;
          color: #2563eb;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
        }
        .score-card {
          background: ${riskColor};
          color: white;
          padding: 30px;
          border-radius: 15px;
          text-align: center;
          margin-bottom: 25px;
        }
        .score-number {
          font-size: 48px;
          font-weight: bold;
        }
        .score-label {
          font-size: 24px;
          margin-top: 10px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 15px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #1e293b;
        }
        .stat-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 5px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        .table th {
          background: #2563eb;
          color: white;
          padding: 10px;
          font-size: 14px;
        }
        .table td {
          padding: 10px;
          border: 1px solid #e2e8f0;
          font-size: 13px;
        }
        .table tr:nth-child(even) {
          background: #f8fafc;
        }
        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge-red {
          background: #fee2e2;
          color: #dc2626;
        }
        .badge-green {
          background: #dcfce7;
          color: #16a34a;
        }
        .badge-yellow {
          background: #fef9c3;
          color: #ca8a04;
        }
        .risk-high { background: #fee2e2; color: #dc2626; }
        .risk-medium { background: #fef9c3; color: #ca8a04; }
        .risk-low { background: #dcfce7; color: #16a34a; }
        .text-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 15px;
          margin: 15px 0;
          font-family: 'Noto Sans Sinhala', 'Iskoola Pota', sans-serif;
        }
        .sinhala-text {
          font-family: 'Noto Sans Sinhala', 'Iskoola Pota', sans-serif;
          font-size: 14px;
          line-height: 1.8;
          background: white;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .footer {
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        .category-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .hashtag-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 5px;
          font-size: 13px;
        }
        /* New styles for category recommendations */
        .recommendation-card {
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid;
        }
        .recommendation-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .recommendation-icon {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .recommendation-title {
          font-size: 18px;
          font-weight: bold;
        }
        .language-section {
          margin-top: 16px;
        }
        .language-tag {
          display: inline-block;
          padding: 4px 12px;
          background: #e2e8f0;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .recommendation-list {
          list-style: none;
          padding: 0;
        }
        .recommendation-list li {
          display: flex;
          align-items: start;
          gap: 10px;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px solid #e2e8f0;
        }
        .recommendation-list li:last-child {
          border-bottom: none;
        }
        .check-icon {
          color: #16a34a;
          font-size: 16px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <h1>SafeKid Scan</h1>
        <p>Content Safety Analysis Report</p>
        <div class="date">Generated: ${format(new Date(data.analysisReport.timestamp), 'PPP p')}</div>
      </div>

      <!-- File Info -->
      <div class="card">
        <div class="card-title">File Information</div>
        <p><strong>File Name:</strong> ${data.analysisReport.fileName}</p>
        <p><strong>Analysis Date:</strong> ${format(new Date(data.analysisReport.timestamp), 'PPP p')}</p>
      </div>

      <!-- Risk Score -->
      <div class="score-card">
        <div class="score-number">${data.analysisReport.score.toFixed(1)}/100</div>
        <div class="score-label">${riskText}</div>
        <div style="margin-top: 15px; font-size: 14px;">Confidence: ${(data.analysisReport.confidence * 100).toFixed(1)}%</div>
      </div>

      <!-- Score Breakdown -->
      <div class="card">
        <div class="card-title">Score Breakdown</div>
        <div class="grid-3">
          <div class="stat-box">
            <div class="stat-value">${data.analysisReport.scoreBreakdown.imageScore.toFixed(1)}</div>
            <div class="stat-label">Image Score</div>
            <div style="font-size: 11px; color: #94a3b8;">40% weight</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.analysisReport.scoreBreakdown.textScore.toFixed(1)}</div>
            <div class="stat-label">Text Score</div>
            <div style="font-size: 11px; color: #94a3b8;">35% weight</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.analysisReport.scoreBreakdown.hashtagScore.toFixed(1)}</div>
            <div class="stat-label">Hashtag Score</div>
            <div style="font-size: 11px; color: #94a3b8;">25% weight</div>
          </div>
        </div>
      </div>

      <!-- AI Analysis -->
      <div class="card">
        <div class="card-title">AI Analysis Details</div>
        <table class="table">
          <tr>
            <th style="width: 30%;">Prediction</th>
            <td>${data.analysisReport.prediction.toUpperCase()}</td>
          </tr>
          <tr>
            <th>Confidence</th>
            <td>${(data.analysisReport.confidence * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <th>AI Reasoning</th>
            <td>${data.analysisReport.reasoning}</td>
          </tr>
        </table>
      </div>

      <!-- Model-Based Content Mapping -->
      ${data.contentCategoryAnalysis && data.contentCategoryAnalysis.category_hierarchy ? `
      <div class="card">
        <div class="card-title">Model-Based Content Mapping</div>
        <div style="margin-bottom: 15px;">
          <strong>Category Path:</strong>
          <div style="margin-top: 10px; padding: 15px; background: #f1f5f9; border-radius: 8px;">
            ${data.contentCategoryAnalysis.category_hierarchy}
          </div>
        </div>
        
        ${data.contentCategoryAnalysis.primary_category ? `
        <div style="margin: 20px 0;">
          <strong>Primary Category:</strong>
          <div style="margin-top: 10px; padding: 15px; background: ${data.contentCategoryAnalysis.primary_category.main_category?.includes('Addictive') ? '#fee2e2' : '#dcfce7'}; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span>${data.contentCategoryAnalysis.primary_category.content_type || 'Unknown'}</span>
              <span class="badge ${data.contentCategoryAnalysis.primary_category.main_category?.includes('Addictive') ? 'badge-red' : 'badge-green'}">
                ${data.contentCategoryAnalysis.primary_category.main_category || 'Unknown'}
              </span>
            </div>
            <div style="font-size: 12px; margin-top: 8px; color: #475569;">
              Confidence: ${((data.contentCategoryAnalysis.primary_category.confidence || 0) * 100).toFixed(0)}% | 
              Method: ${data.contentCategoryAnalysis.primary_category.detected_keyword || 'unknown'}
            </div>
          </div>
        </div>
        ` : ''}

        ${data.contentCategoryAnalysis.detected_items?.length > 0 ? `
        <div>
          <strong>Detected Items:</strong>
          ${data.contentCategoryAnalysis.detected_items.map((item: any) => `
            <div class="category-item" style="background: ${item.main_category?.includes('Addictive') ? '#fee2e2' : '#dcfce7'};">
              <div>
                <strong>${item.content_type || 'Unknown'}</strong>
                <div style="font-size: 11px; color: #475569;">${item.detected_keyword || 'unknown'}</div>
              </div>
              <div style="text-align: right;">
                <span class="badge ${item.main_category?.includes('Addictive') ? 'badge-red' : 'badge-green'}">${item.main_category || 'Unknown'}</span>
                <div style="font-size: 11px; color: #475569;">${((item.confidence || 0) * 100).toFixed(0)}% confidence</div>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Text Analysis -->
      ${data.textAnalysis && data.textAnalysis.original_text ? `
      <div class="card">
        <div class="card-title">Text Analysis & Safety Results</div>
        
        <div class="grid-3">
          <div class="stat-box">
            <div class="stat-value">${data.textAnalysis.safety_score || 0}/100</div>
            <div class="stat-label">Safety Score</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.textAnalysis.age_appropriateness || 'Unknown'}</div>
            <div class="stat-label">Age Appropriateness</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${(data.textAnalysis.ocr_confidence || 0).toFixed(1)}%</div>
            <div class="stat-label">OCR Confidence</div>
          </div>
        </div>

        ${data.textAnalysis.content_analysis ? `
        <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
          <strong style="font-size: 16px;">Content Safety Analysis</strong>
          <p style="margin-top: 10px;"><strong>Risk Level:</strong> ${data.textAnalysis.content_analysis.risk_level?.toUpperCase() || 'Unknown'}</p>
          <p><strong>Explanation:</strong> ${data.textAnalysis.content_analysis.explanation || 'No explanation available'}</p>
          
          ${data.textAnalysis.content_analysis.risk_categories?.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong>Risk Categories:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px;">
              ${data.textAnalysis.content_analysis.risk_categories.map((cat: string) => 
                `<span class="badge badge-red">${cat}</span>`
              ).join('')}
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- Sinhala Text -->
        ${data.textAnalysis.sinhala?.text ? `
        <div style="margin: 20px 0;">
          <strong>Sinhala Text:</strong>
          <div class="sinhala-text">
            ${data.textAnalysis.sinhala.text.substring(0, 500)}${data.textAnalysis.sinhala.text.length > 500 ? '...' : ''}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 5px;">
            Words: ${data.textAnalysis.sinhala.word_count || 0} | 
            Characters: ${data.textAnalysis.sinhala.character_count || 0} | 
            Confidence: ${data.textAnalysis.sinhala.confidence || 0}%
          </div>
        </div>
        ` : ''}

        <!-- English Text -->
        ${data.textAnalysis.english?.text ? `
        <div style="margin: 20px 0;">
          <strong>English Text:</strong>
          <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px;">
            ${data.textAnalysis.english.text.substring(0, 500)}${data.textAnalysis.english.text.length > 500 ? '...' : ''}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 5px;">
            Words: ${data.textAnalysis.english.word_count || 0} | 
            Characters: ${data.textAnalysis.english.character_count || 0} | 
            Confidence: ${data.textAnalysis.english.confidence || 0}%
          </div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Hashtag Analysis -->
      ${data.hashtagAnalysis && data.hashtagAnalysis.total_hashtags > 0 ? `
      <div class="card">
        <div class="card-title">Hashtag Analysis</div>
        
        <div class="grid-3">
          <div class="stat-box">
            <div class="stat-value">${data.hashtagAnalysis.total_hashtags}</div>
            <div class="stat-label">Total Hashtags</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="color: #dc2626;">${data.hashtagAnalysis.addictive_hashtags}</div>
            <div class="stat-label">Addictive Hashtags</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="color: #16a34a;">${data.hashtagAnalysis.safe_hashtags}</div>
            <div class="stat-label">Safe Hashtags</div>
          </div>
        </div>

        ${data.hashtagAnalysis.addictive_percentage ? `
        <div style="margin: 15px 0; padding: 12px; background: #fef9c3; border-radius: 8px; text-align: center;">
          <strong>${data.hashtagAnalysis.addictive_percentage.toFixed(1)}% of hashtags are potentially addictive</strong>
        </div>
        ` : ''}

        ${data.hashtagAnalysis.hashtag_details?.length > 0 ? `
        <div style="margin-top: 20px;">
          <strong>Detected Hashtags:</strong>
          ${data.hashtagAnalysis.hashtag_details.map((detail: any) => `
            <div class="hashtag-item" style="background: ${detail.is_addictive ? '#fee2e2' : '#dcfce7'};">
              <div>
                <strong>#${detail.hashtag || 'unknown'}</strong>
                <span style="font-size: 11px; color: #64748b; margin-left: 10px;">${detail.method || 'unknown'}</span>
              </div>
              <div style="text-align: right;">
                <span class="badge ${detail.is_addictive ? 'badge-red' : 'badge-green'}">
                  ${detail.prediction || (detail.is_addictive ? 'ADDICTIVE' : 'SAFE')}
                </span>
                <span style="font-size: 11px; color: #64748b; margin-left: 10px;">
                  ${((detail.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Category-Specific Recommendations -->
      ${categoryRecommendations ? `
      <div class="card">
        <div class="card-title">Category-Specific Recommendations</div>
        
        <div class="recommendation-card" style="background-color: ${categoryRecommendations.bgColor}; border-color: ${categoryRecommendations.borderColor};">
          <div class="recommendation-header">
            <div class="recommendation-icon" style="background-color: ${categoryRecommendations.color}20;">
              <span>${categoryRecommendations.icon}</span>
            </div>
            <div class="recommendation-title" style="color: ${categoryRecommendations.color};">
              ${categoryRecommendations.title}
            </div>
          </div>
          
          <div class="language-section">
            <div class="language-tag">ENGLISH</div>
            <ul class="recommendation-list">
              ${categoryRecommendations.english.map((rec: string) => `
                <li>
                  <span class="check-icon">✓</span>
                  <span>${rec}</span>
                </li>
              `).join('')}
            </ul>
          </div>
          
          <div class="language-section">
            <div class="language-tag">සිංහල</div>
            <ul class="recommendation-list">
              ${categoryRecommendations.sinhala.map((rec: string) => `
                <li>
                  <span class="check-icon">✓</span>
                  <span style="font-family: 'Noto Sans Sinhala', 'Iskoola Pota', sans-serif;">${rec}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Footer -->
      <div class="footer">
        This report is generated by SafeKid Scan for informational purposes only.<br>
        Powered by SafeKid Scan AI
      </div>
    </body>
    </html>
  `;
};

// HTML content generator for Sinhala report
const generateSinhalaHTML = (data: ReportData): string => {
  const riskColor = data.analysisReport.score <= 30 ? '#22c55e' : 
                    data.analysisReport.score <= 60 ? '#eab308' : '#ef4444';
  
  const riskText = data.analysisReport.score <= 30 ? 'අඩු අවදානම' :
                   data.analysisReport.score <= 60 ? 'මධ්‍යස්ථ අවදානම' : 'ඉහළ අවදානම';

  // Function to get category-specific recommendations (Sinhala version)
  const getCategorySpecificRecommendations = () => {
    const categoryPath = data.contentCategoryAnalysis?.category_hierarchy || "";
    const prediction = data.analysisReport.prediction;

    if (categoryPath.includes("Visual_addiction") || categoryPath.includes("Visual") || categoryPath.includes("visual")) {
      return {
        title: "දෘශ්‍ය ඇබ්බැහිය",
        icon: "👁️",
        color: "#3b82f6",
        bgColor: "#eff6ff",
        borderColor: "#bfdbfe",
        sinhala: [
          "දිනකට 1-2 පැය තිර කාලය සීමා කරන්න",
          "රසික ක්‍රීඩා දිරිමත් කරන්න",
          "බාහිර ක්‍රියාකාරකම් සැලසුම් කරන්න"
        ]
      };
    }
    
    if (categoryPath.includes("explicit_harmful") || categoryPath.includes("Explicit") || categoryPath.includes("explicit")) {
      return {
        title: "අහිතකර අන්තර්ගත",
        icon: "💀",
        color: "#dc2626",
        bgColor: "#fef2f2",
        borderColor: "#fecaca",
        sinhala: [
          "අවදානම් ගැන ගරුත්වයෙන් කතා කරන්න",
          "ගෙදර අනතුරු උපකරණ සුරක්ෂිත කරන්න",
          "Parental controls භාවිතා කරන්න"
        ]
      };
    }
    
    if (categoryPath.includes("Psychological_triggers") || categoryPath.includes("psychological_triggers") || categoryPath.includes("Psychological")) {
      return {
        title: "මානසික උත්තේජක",
        icon: "⚠️",
        color: "#eab308",
        bgColor: "#fefce8",
        borderColor: "#fef08a",
        sinhala: [
          "එකට නැරඹීම සහ සාකච්ඡා කිරීම",
          "කල්පිතය හා යථාර්ථය අතර වෙනස උගන්වන්න",
          "වයස් ශ්‍රේණිගත කිරීම් පිළිපදින්න"
        ]
      };
    }
    
    if (prediction === 'non-addictive' || categoryPath.includes("Non-addictive") || categoryPath.includes("non-addictive")) {
      return {
        title: "ආරක්ෂිත / අධ්‍යාපනික අන්තර්ගත",
        icon: "✅",
        color: "#16a34a",
        bgColor: "#f0fdf4",
        borderColor: "#bbf7d0",
        sinhala: [
          "රසික අන්තර්ගත දිරිමත් කරන්න",
          "සමතුලිත තිර කාලය පවත්වාගන්න",
          "ඉගෙන ගන්නා දේ ගැන සාකච්ඡා කරන්න"
        ]
      };
    }
    
    if (prediction === 'addictive') {
      return {
        title: "සාමාන්‍ය ඇබ්බැහි අන්තර්ගත",
        icon: "⚠️",
        color: "#f97316",
        bgColor: "#fff7ed",
        borderColor: "#fed7aa",
        sinhala: [
          "අන්තර්ගත පරිභෝජනය නිරීක්ෂණය කරන්න",
          "තිර කාලය සීමා කරන්න",
          "නිර්වාහිත ක්‍රියාකාරකම් දිරිමත් කරන්න"
        ]
      };
    }
    
    return null;
  };

  const categoryRecommendations = getCategorySpecificRecommendations();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>SafeKid Scan වාර්තාව</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Arial', 'Iskoola Pota', 'Noto Sans Sinhala', sans-serif;
        }
        body {
          background: white;
          padding: 30px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          padding: 30px;
          border-radius: 15px;
          margin-bottom: 30px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .header h1 {
          font-size: 32px;
          margin-bottom: 5px;
        }
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        .date {
          text-align: right;
          font-size: 12px;
          margin-top: -40px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 25px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid #e5e7eb;
        }
        .card-title {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .score-card {
          background: ${riskColor};
          color: white;
          padding: 30px;
          border-radius: 15px;
          text-align: center;
          margin-bottom: 25px;
        }
        .score-number {
          font-size: 48px;
          font-weight: bold;
        }
        .score-label {
          font-size: 24px;
          margin-top: 10px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
        }
        .stat-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 15px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #1e293b;
        }
        .stat-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 5px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        .table th {
          background: #2563eb;
          color: white;
          padding: 10px;
          font-size: 14px;
        }
        .table td {
          padding: 10px;
          border: 1px solid #e2e8f0;
          font-size: 13px;
        }
        .table tr:nth-child(even) {
          background: #f8fafc;
        }
        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge-red {
          background: #fee2e2;
          color: #dc2626;
        }
        .badge-green {
          background: #dcfce7;
          color: #16a34a;
        }
        .badge-yellow {
          background: #fef9c3;
          color: #ca8a04;
        }
        .category-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .hashtag-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 5px;
          font-size: 13px;
        }
        .sinhala-text {
          font-family: 'Noto Sans Sinhala', 'Iskoola Pota', sans-serif;
          font-size: 16px;
          line-height: 2;
          background: #f8fafc;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .footer {
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        .recommendation-card {
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid;
        }
        .recommendation-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .recommendation-icon {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .recommendation-title {
          font-size: 18px;
          font-weight: bold;
        }
        .language-section {
          margin-top: 16px;
        }
        .language-tag {
          display: inline-block;
          padding: 4px 12px;
          background: #e2e8f0;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .recommendation-list {
          list-style: none;
          padding: 0;
        }
        .recommendation-list li {
          display: flex;
          align-items: start;
          gap: 10px;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px solid #e2e8f0;
        }
        .recommendation-list li:last-child {
          border-bottom: none;
        }
        .check-icon {
          color: #16a34a;
          font-size: 16px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <!-- ශීර්ෂය -->
      <div class="header">
        <h1>SafeKid Scan</h1>
        <p>අන්තර්ගත ආරක්ෂණ විශ්ලේෂණ වාර්තාව</p>
        <div class="date">උත්පාදනය: ${format(new Date(data.analysisReport.timestamp), 'PPP p')}</div>
      </div>

      <!-- ගොනු තොරතුරු -->
      <div class="card">
        <div class="card-title">ගොනුව පිළිබඳ තොරතුරු</div>
        <p><strong>ගොනුවේ නම:</strong> ${data.analysisReport.fileName}</p>
        <p><strong>විශ්ලේෂණ දිනය:</strong> ${format(new Date(data.analysisReport.timestamp), 'PPP p')}</p>
      </div>

      <!-- අවදානම් ලකුණු -->
      <div class="score-card">
        <div class="score-number">${data.analysisReport.score.toFixed(1)}/100</div>
        <div class="score-label">${riskText}</div>
        <div style="margin-top: 15px; font-size: 14px;">විශ්වාසය: ${(data.analysisReport.confidence * 100).toFixed(1)}%</div>
      </div>

      <!-- ලකුණු විග්‍රහය -->
      <div class="card">
        <div class="card-title">ලකුණු විග්‍රහය</div>
        <div class="grid-3">
          <div class="stat-box">
            <div class="stat-value">${data.analysisReport.scoreBreakdown.imageScore.toFixed(1)}</div>
            <div class="stat-label">පින්තූර ලකුණු</div>
            <div style="font-size: 11px; color: #94a3b8;">40% බරතාවය</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.analysisReport.scoreBreakdown.textScore.toFixed(1)}</div>
            <div class="stat-label">පෙළ ලකුණු</div>
            <div style="font-size: 11px; color: #94a3b8;">35% බරතාවය</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.analysisReport.scoreBreakdown.hashtagScore.toFixed(1)}</div>
            <div class="stat-label">හැෂ් ටැග් ලකුණු</div>
            <div style="font-size: 11px; color: #94a3b8;">25% බරතාවය</div>
          </div>
        </div>
      </div>

      <!-- AI විශ්ලේෂණය -->
      <div class="card">
        <div class="card-title">AI විශ්ලේෂණ විස්තර</div>
        <table class="table">
          <tr>
            <th style="width: 30%;">පුරෝකථනය</th>
            <td>${data.analysisReport.prediction.toUpperCase()}</td>
          </tr>
          <tr>
            <th>විශ්වාසය</th>
            <td>${(data.analysisReport.confidence * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <th>AI තර්කනය</th>
            <td>${data.analysisReport.reasoning}</td>
          </tr>
        </table>
      </div>

      <!-- ආකෘති පදනම් වූ අන්තර්ගත සිතියම් කිරීම -->
      ${data.contentCategoryAnalysis && data.contentCategoryAnalysis.category_hierarchy ? `
      <div class="card">
        <div class="card-title">ආකෘති පදනම් වූ අන්තර්ගත සිතියම් කිරීම</div>
        <div style="margin-bottom: 15px;">
          <strong>කාණ්ඩ මාර්ගය:</strong>
          <div style="margin-top: 10px; padding: 15px; background: #f1f5f9; border-radius: 8px;">
            ${data.contentCategoryAnalysis.category_hierarchy}
          </div>
        </div>
        
        ${data.contentCategoryAnalysis.primary_category ? `
        <div style="margin: 20px 0;">
          <strong>ප්‍රාථමික කාණ්ඩය:</strong>
          <div style="margin-top: 10px; padding: 15px; background: ${data.contentCategoryAnalysis.primary_category.main_category?.includes('Addictive') ? '#fee2e2' : '#dcfce7'}; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span>${data.contentCategoryAnalysis.primary_category.content_type || 'Unknown'}</span>
              <span class="badge ${data.contentCategoryAnalysis.primary_category.main_category?.includes('Addictive') ? 'badge-red' : 'badge-green'}">
                ${data.contentCategoryAnalysis.primary_category.main_category || 'Unknown'}
              </span>
            </div>
            <div style="font-size: 12px; margin-top: 8px; color: #475569;">
              විශ්වාසය: ${((data.contentCategoryAnalysis.primary_category.confidence || 0) * 100).toFixed(0)}% | 
              ක්‍රමය: ${data.contentCategoryAnalysis.primary_category.detected_keyword || 'unknown'}
            </div>
          </div>
        </div>
        ` : ''}

        ${data.contentCategoryAnalysis.detected_items?.length > 0 ? `
        <div>
          <strong>හඳුනාගත් අයිතම:</strong>
          ${data.contentCategoryAnalysis.detected_items.map((item: any) => `
            <div class="category-item" style="background: ${item.main_category?.includes('Addictive') ? '#fee2e2' : '#dcfce7'};">
              <div>
                <strong>${item.content_type || 'Unknown'}</strong>
                <div style="font-size: 11px; color: #475569;">${item.detected_keyword || 'unknown'}</div>
              </div>
              <div style="text-align: right;">
                <span class="badge ${item.main_category?.includes('Addictive') ? 'badge-red' : 'badge-green'}">${item.main_category || 'Unknown'}</span>
                <div style="font-size: 11px; color: #475569;">${((item.confidence || 0) * 100).toFixed(0)}% විශ්වාසය</div>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- පෙළ විශ්ලේෂණය -->
      ${data.textAnalysis && data.textAnalysis.sinhala?.text ? `
      <div class="card">
        <div class="card-title">සිංහල පෙළ විශ්ලේෂණය</div>
        <div class="sinhala-text">
          ${data.textAnalysis.sinhala.text}
        </div>
        <div style="margin-top: 15px;">
          <p><strong>වචන ගණන:</strong> ${data.textAnalysis.sinhala.word_count || 0}</p>
          <p><strong>අක්ෂර ගණන:</strong> ${data.textAnalysis.sinhala.character_count || 0}</p>
          <p><strong>විශ්වාසය:</strong> ${data.textAnalysis.sinhala.confidence || 0}%</p>
        </div>
      </div>
      ` : ''}

      <!-- හැෂ් ටැග් විශ්ලේෂණය -->
      ${data.hashtagAnalysis && data.hashtagAnalysis.total_hashtags > 0 ? `
      <div class="card">
        <div class="card-title">හැෂ් ටැග් විශ්ලේෂණය</div>
        
        <div class="grid-3">
          <div class="stat-box">
            <div class="stat-value">${data.hashtagAnalysis.total_hashtags}</div>
            <div class="stat-label">සම්පූර්ණ හැෂ් ටැග්</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="color: #dc2626;">${data.hashtagAnalysis.addictive_hashtags}</div>
            <div class="stat-label">ඇබ්බැහි හැෂ් ටැග්</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="color: #16a34a;">${data.hashtagAnalysis.safe_hashtags}</div>
            <div class="stat-label">ආරක්ෂිත හැෂ් ටැග්</div>
          </div>
        </div>

        ${data.hashtagAnalysis.addictive_percentage ? `
        <div style="margin: 15px 0; padding: 12px; background: #fef9c3; border-radius: 8px; text-align: center;">
          <strong>හැෂ් ටැග් වලින් ${data.hashtagAnalysis.addictive_percentage.toFixed(1)}% ක් ඇබ්බැහි විය හැක</strong>
        </div>
        ` : ''}

        ${data.hashtagAnalysis.hashtag_details?.length > 0 ? `
        <div style="margin-top: 20px;">
          <strong>හඳුනාගත් හැෂ් ටැග්:</strong>
          ${data.hashtagAnalysis.hashtag_details.map((detail: any) => `
            <div class="hashtag-item" style="background: ${detail.is_addictive ? '#fee2e2' : '#dcfce7'};">
              <div>
                <strong>#${detail.hashtag || 'unknown'}</strong>
                <span style="font-size: 11px; color: #64748b; margin-left: 10px;">${detail.method || 'unknown'}</span>
              </div>
              <div style="text-align: right;">
                <span class="badge ${detail.is_addictive ? 'badge-red' : 'badge-green'}">
                  ${detail.prediction || (detail.is_addictive ? 'ඇබ්බැහි' : 'ආරක්ෂිත')}
                </span>
                <span style="font-size: 11px; color: #64748b; margin-left: 10px;">
                  ${((detail.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Category-Specific Recommendations (Sinhala) -->
      ${categoryRecommendations ? `
      <div class="card">
        <div class="card-title">කාණ්ඩය අනුව නිර්දේශ</div>
        
        <div class="recommendation-card" style="background-color: ${categoryRecommendations.bgColor}; border-color: ${categoryRecommendations.borderColor};">
          <div class="recommendation-header">
            <div class="recommendation-icon" style="background-color: ${categoryRecommendations.color}20;">
              <span>${categoryRecommendations.icon}</span>
            </div>
            <div class="recommendation-title" style="color: ${categoryRecommendations.color};">
              ${categoryRecommendations.title}
            </div>
          </div>
          
          <div class="language-section">
            <div class="language-tag">නිර්දේශ</div>
            <ul class="recommendation-list">
              ${categoryRecommendations.sinhala.map((rec: string) => `
                <li>
                  <span class="check-icon">✓</span>
                  <span style="font-family: 'Noto Sans Sinhala', 'Iskoola Pota', sans-serif;">${rec}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- නිර්දේශ -->
      ${data.recommendations && data.recommendations.length > 0 ? `
      <div class="card">
        <div class="card-title">අතිරේක නිර්දේශ</div>
        <ul style="padding-left: 20px;">
          ${data.recommendations.map(rec => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <!-- පාදකය -->
      <div class="footer">
        මෙම වාර්තාව SafeKid Scan මගින් තොරතුරු අරමුණු සඳහා පමණක් ජනනය කර ඇත.<br>
        SafeKid Scan AI මගින් බලගන්වන ලදී
      </div>
    </body>
    </html>
  `;
};

// Generate PDF from HTML
const generatePDFFromHTML = async (html: string, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<jsPDF> => {
  // Create a temporary div to render HTML
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  document.body.appendChild(container);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;
    
    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4'
    });
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
    
    // Add more pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    document.body.removeChild(container);
    return pdf;
  } catch (error) {
    document.body.removeChild(container);
    throw error;
  }
};

/**
 * Generate PDF and return as base64 string
 */
export const generatePDFBase64 = async (
  data: ReportData,
  language: 'english' | 'sinhala' | 'both' = 'both'
): Promise<string> => {
  try {
    console.log('📄 Generating PDF base64...');
    
    let html: string;
    
    if (language === 'english') {
      html = generateEnglishHTML(data);
    } else if (language === 'sinhala') {
      html = generateSinhalaHTML(data);
    } else {
      // For 'both', generate English version (or combine both)
      html = generateEnglishHTML(data);
    }
    
    const pdf = await generatePDFFromHTML(html);
    
    // Convert PDF to base64
    const pdfOutput = pdf.output('datauristring');
    const base64String = pdfOutput.split(',')[1];
    
    console.log('✅ PDF base64 generated successfully');
    return base64String;
    
  } catch (error) {
    console.error('❌ Error generating PDF base64:', error);
    throw new Error('Failed to generate PDF base64');
  }
};

/**
 * Generate PDF and return as Blob
 */
export const generatePDFBlob = async (
  data: ReportData,
  language: 'english' | 'sinhala' | 'both' = 'both'
): Promise<Blob> => {
  try {
    let html: string;
    
    if (language === 'english') {
      html = generateEnglishHTML(data);
    } else if (language === 'sinhala') {
      html = generateSinhalaHTML(data);
    } else {
      html = generateEnglishHTML(data);
    }
    
    const pdf = await generatePDFFromHTML(html);
    
    // Convert PDF to blob
    const pdfBlob = pdf.output('blob');
    
    return pdfBlob;
    
  } catch (error) {
    console.error('Error generating PDF blob:', error);
    throw error;
  }
};

// Main function to download report
export const downloadReport = async (
  data: ReportData,
  language: 'english' | 'sinhala' | 'both' = 'both'
) => {
  try {
    let pdf: jsPDF;
    let fileName: string;
    
    switch (language) {
      case 'english': {
        const html = generateEnglishHTML(data);
        pdf = await generatePDFFromHTML(html);
        fileName = `SafeKid-Scan-Report-${data.analysisReport.fileName.replace(/\.[^/.]+$/, '')}-${format(new Date(), 'yyyy-MM-dd-HHmm')}-EN.pdf`;
        break;
      }
      
    }

    pdf.save(fileName);
    return { success: true, fileName, pdf };
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
};
